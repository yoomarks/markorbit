import { randomUUID } from 'node:crypto';
import type { MarkOrbitId } from '@markorbit/contracts';
import type {
  ProviderId,
  ProviderSupplyCapabilityId
} from '@markorbit/contracts/provider-execution';
import {
  AllocationProviderAcceptanceError,
  type AllocateProviderServiceCommand,
  type AllocationProviderAcceptanceRepository,
  type AllocationRecord
} from './allocation-provider-acceptance.js';
import type {
  ExecutionSourceAdmissionSource,
  ServicePackageEligibilityRepository
} from './service-package-eligibility.js';
import type { ProviderRegistryRepository } from './provider-registry.js';
import type { ProviderResponsibilityService } from './provider-responsibility.js';
import type {
  GovernedAllocationDirectExecutorSource,
  GovernedAllocationPlanner
} from './governed-allocation.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha256Pattern = /^[0-9a-f]{64}$/;

function text(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized)
    throw new AllocationProviderAcceptanceError('INVALID_INPUT', `${field} is required.`, 422);
  return normalized;
}

function workspace(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!uuidPattern.test(normalized))
    throw new AllocationProviderAcceptanceError(
      'INVALID_INPUT',
      'workspaceId must be a Core Workspace UUID.',
      422
    );
  return normalized;
}

function sha256(value: string, field: string): string {
  const normalized = value.trim().toLowerCase();
  if (!sha256Pattern.test(normalized))
    throw new AllocationProviderAcceptanceError(
      'INVALID_INPUT',
      `${field} must be a lowercase SHA-256 fingerprint.`,
      422
    );
  return normalized;
}

/**
 * Pure M4 Allocation preflight for the governed path.
 *
 * This intentionally mirrors the immutable/current M4 source checks but does not invoke the legacy
 * mutation repository. The one-active-allocation decision belongs only to
 * PostgresGovernedAllocationRepository.commit() under its transaction lock. Reading active state
 * here would create a TOCTOU window where a concurrent identical idempotent command can observe the
 * winner's Allocation before the caller has a chance to resolve the winner's governed replay.
 */
export class ExactM4GovernedAllocationPlanner implements GovernedAllocationPlanner {
  constructor(
    private readonly allocations: AllocationProviderAcceptanceRepository,
    private readonly servicePackageEligibility: ServicePackageEligibilityRepository,
    private readonly providerRegistry: ProviderRegistryRepository,
    private readonly executionSource: ExecutionSourceAdmissionSource,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly allocationIdFactory: () => AllocationRecord['allocationId'] = () =>
      `allocation_${randomUUID()}`
  ) {}

  async plan(command: AllocateProviderServiceCommand): Promise<Readonly<AllocationRecord>> {
    const workspaceId = workspace(command.workspaceId);
    const actorId = text(command.actorId, 'actorId') as MarkOrbitId;
    const rationale = text(command.rationale, 'rationale');
    text(command.idempotencyKey, 'idempotencyKey');
    const expectedPackageFingerprint = sha256(
      command.expectedServicePackageFingerprintSha256,
      'expectedServicePackageFingerprintSha256'
    );
    const expectedEligibilityFingerprint = sha256(
      command.expectedEligibilityFingerprintSha256,
      'expectedEligibilityFingerprintSha256'
    );

    const servicePackage = await this.servicePackageEligibility.findServicePackage(
      command.servicePackageId
    );
    if (!servicePackage)
      throw new AllocationProviderAcceptanceError(
        'SERVICE_PACKAGE_NOT_FOUND',
        'Service Package was not found.',
        404
      );
    if (servicePackage.workspaceId !== workspaceId)
      throw new AllocationProviderAcceptanceError(
        'PERMISSION_DENIED',
        'Service Package belongs to another Workspace.',
        403
      );
    if (servicePackage.version !== command.expectedServicePackageVersion)
      throw new AllocationProviderAcceptanceError(
        'SOURCE_VERSION_MISMATCH',
        'Service Package version changed.',
        409
      );
    if (servicePackage.servicePackageFingerprintSha256 !== expectedPackageFingerprint)
      throw new AllocationProviderAcceptanceError(
        'SOURCE_FINGERPRINT_MISMATCH',
        'Service Package fingerprint changed.',
        409
      );
    if (servicePackage.status !== 'ADMITTED')
      throw new AllocationProviderAcceptanceError(
        'STALE_SOURCE',
        'Only an admitted Service Package may be allocated.',
        409
      );
    if (servicePackage.source.correlationId !== command.correlationId)
      throw new AllocationProviderAcceptanceError(
        'SOURCE_VERSION_MISMATCH',
        'Correlation lineage does not match the Service Package source.',
        409
      );

    const executionVerification = await this.executionSource.verifyCurrentSource(
      servicePackage.source
    );
    if (executionVerification.status !== 'CURRENT')
      throw new AllocationProviderAcceptanceError(
        'STALE_SOURCE',
        executionVerification.reason ?? 'Execution source is no longer current.',
        409
      );
    if (
      executionVerification.exactSourceFingerprintSha256 !== servicePackage.sourceFingerprintSha256
    )
      throw new AllocationProviderAcceptanceError(
        'SOURCE_FINGERPRINT_MISMATCH',
        'Execution source fingerprint changed after Eligibility Evaluation.',
        409
      );

    const evaluation = await this.servicePackageEligibility.findEligibilityEvaluation(
      command.eligibilityEvaluationId
    );
    if (!evaluation)
      throw new AllocationProviderAcceptanceError(
        'ELIGIBILITY_EVALUATION_NOT_FOUND',
        'Eligibility Evaluation was not found.',
        404
      );
    if (evaluation.workspaceId !== servicePackage.workspaceId)
      throw new AllocationProviderAcceptanceError(
        'PERMISSION_DENIED',
        'Eligibility Evaluation belongs to another Workspace.',
        403
      );
    if (evaluation.version !== command.expectedEligibilityEvaluationVersion)
      throw new AllocationProviderAcceptanceError(
        'SOURCE_VERSION_MISMATCH',
        'Eligibility Evaluation version changed.',
        409
      );
    if (evaluation.deterministicFingerprintSha256 !== expectedEligibilityFingerprint)
      throw new AllocationProviderAcceptanceError(
        'SOURCE_FINGERPRINT_MISMATCH',
        'Eligibility Evaluation fingerprint changed.',
        409
      );
    if (evaluation.outcome !== 'ELIGIBLE')
      throw new AllocationProviderAcceptanceError(
        'PROVIDER_NOT_ELIGIBLE',
        'Only an ELIGIBLE Provider evaluation may be allocated.',
        409
      );
    if (
      evaluation.servicePackage.id !== servicePackage.servicePackageId ||
      evaluation.servicePackage.version !== servicePackage.version ||
      evaluation.servicePackageFingerprintSha256 !== servicePackage.servicePackageFingerprintSha256
    )
      throw new AllocationProviderAcceptanceError(
        'SOURCE_VERSION_MISMATCH',
        'Eligibility Evaluation does not belong to the exact Service Package.',
        409
      );
    if (
      evaluation.provider.providerId !== command.providerId ||
      evaluation.providerSupplyCapability.id !== command.providerSupplyCapabilityId ||
      evaluation.providerSupplyCapability.version !==
        command.expectedProviderSupplyCapabilityVersion
    )
      throw new AllocationProviderAcceptanceError(
        'PROVIDER_NOT_ELIGIBLE',
        'Requested Provider or Supply Capability does not match the exact Eligibility Evaluation.',
        409
      );
    if (evaluation.correlationId !== command.correlationId)
      throw new AllocationProviderAcceptanceError(
        'SOURCE_VERSION_MISMATCH',
        'Correlation lineage does not match the Eligibility Evaluation.',
        409
      );

    const provider = await this.providerRegistry.findProviderById(command.providerId);
    if (!provider)
      throw new AllocationProviderAcceptanceError(
        'PROVIDER_NOT_FOUND',
        'Provider was not found.',
        404
      );
    const capability = await this.requireCurrentSupply(
      command.providerSupplyCapabilityId,
      command.expectedProviderSupplyCapabilityVersion,
      evaluation.providerSupplyCapabilityFingerprintSha256
    );
    if (provider.version !== evaluation.providerVersion || provider.operationalStatus !== 'ACTIVE')
      throw new AllocationProviderAcceptanceError(
        provider.operationalStatus === 'ACTIVE' ? 'SOURCE_VERSION_MISMATCH' : 'PROVIDER_SUSPENDED',
        provider.operationalStatus === 'ACTIVE'
          ? 'Provider record changed after Eligibility Evaluation.'
          : 'Provider is not operationally active.',
        409
      );
    if (
      capability.provider.providerId !== provider.providerId ||
      capability.status !== 'ACTIVE' ||
      capability.verificationState !== 'VERIFIED_FOR_SUPPLY' ||
      capability.availabilityUnits <= 0
    )
      throw new AllocationProviderAcceptanceError(
        'SUPPLY_CAPABILITY_INACTIVE',
        'Provider Supply Capability is no longer operationally eligible.',
        409
      );

    const at = this.now();
    return {
      schemaVersion: 1,
      allocationId: this.allocationIdFactory(),
      workspaceId,
      version: 1,
      servicePackage: { id: servicePackage.servicePackageId, version: servicePackage.version },
      servicePackageFingerprintSha256: servicePackage.servicePackageFingerprintSha256,
      eligibilityEvaluation: {
        id: evaluation.eligibilityEvaluationId,
        version: evaluation.version
      },
      eligibilityFingerprintSha256: evaluation.deterministicFingerprintSha256,
      provider: {
        providerId: provider.providerId,
        providerWorkspaceId: provider.providerWorkspaceId,
        displayName: provider.displayName,
        operationalStatus: provider.operationalStatus
      },
      providerVersion: provider.version,
      providerSupplyCapability: {
        id: capability.providerSupplyCapabilityId,
        version: capability.version
      },
      providerSupplyCapabilityFingerprintSha256: capability.sourceFingerprintSha256,
      allocatedBy: actorId,
      rationale,
      status: 'ACTIVE',
      createdAt: at,
      updatedAt: at,
      correlationId: command.correlationId
    };
  }

  private async requireCurrentSupply(
    providerSupplyCapabilityId: ProviderSupplyCapabilityId,
    expectedVersion: number,
    expectedFingerprint: string
  ) {
    const exact = await this.providerRegistry.findSupplyCapability(
      providerSupplyCapabilityId,
      expectedVersion
    );
    if (!exact)
      throw new AllocationProviderAcceptanceError(
        'SUPPLY_CAPABILITY_INACTIVE',
        'Exact Provider Supply Capability version was not found.',
        409
      );
    if (exact.sourceFingerprintSha256 !== expectedFingerprint)
      throw new AllocationProviderAcceptanceError(
        'SOURCE_FINGERPRINT_MISMATCH',
        'Provider Supply Capability fingerprint changed.',
        409
      );
    const current = await this.providerRegistry.findSupplyCapability(providerSupplyCapabilityId);
    if (!current || current.version !== exact.version)
      throw new AllocationProviderAcceptanceError(
        'SOURCE_VERSION_MISMATCH',
        'Provider Supply Capability is no longer the current version.',
        409
      );
    return exact;
  }
}

export class ProviderResponsibilityGovernedAllocationSource implements GovernedAllocationDirectExecutorSource {
  constructor(private readonly responsibility: ProviderResponsibilityService) {}

  async assessCurrent(input: {
    providerId: ProviderId;
    providerWorkspaceId: string;
    checkedAt: string;
  }) {
    const result = await this.responsibility.assessCurrent(
      input.providerId,
      input.providerWorkspaceId,
      input.checkedAt
    );
    const assessment = result.assessment;
    if (
      !assessment ||
      assessment.directExecutorEstablished !== true ||
      assessment.profileAuthorityState !== 'CURRENT' ||
      assessment.finalExecutionProviderId !== input.providerId ||
      assessment.finalExecutionProviderWorkspaceId.toLowerCase() !==
        input.providerWorkspaceId.toLowerCase()
    ) {
      return undefined;
    }
    return {
      established: true as const,
      providerId: input.providerId,
      providerWorkspaceId: input.providerWorkspaceId.toLowerCase(),
      authorityReference: `mgsn-provider-responsibility:${assessment.profile.providerResponsibilityProfileId}`,
      authorityVersion: assessment.profile.version,
      checkedAt: assessment.checkedAt,
      validationFingerprintSha256: assessment.assessmentFingerprintSha256
    };
  }
}
