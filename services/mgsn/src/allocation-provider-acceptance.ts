import { createHash, randomUUID } from 'node:crypto';
import type { MarkOrbitId } from '@markorbit/contracts';
import type {
  AllocateProviderCommand,
  Allocation,
  AllocationId,
  EligibilityEvaluationId,
  ProviderAcceptance,
  ProviderAcceptanceId,
  ProviderExecutionErrorCode,
  ProviderId,
  ProviderSupplyCapabilityId,
  RespondToAllocationCommand,
  ServicePackageId
} from '@markorbit/contracts/provider-execution';
import type {
  ProviderRegistryRecord,
  ProviderRegistryRepository,
  ProviderSupplyCapabilityRecord
} from './provider-registry.js';
import type {
  EligibilityEvaluationRecord,
  ServicePackageEligibilityRepository,
  ServicePackageRecord
} from './service-package-eligibility.js';

export interface AllocationRecord extends Allocation {
  providerVersion: number;
  providerSupplyCapabilityFingerprintSha256: string;
}

export interface ProviderAcceptanceRecord extends ProviderAcceptance {
  providerActorId: string;
}

export interface AllocationProviderAcceptanceReplay {
  fingerprint: string;
  targetType: 'ALLOCATION' | 'PROVIDER_ACCEPTANCE';
  targetId: string;
  responseVersion: number;
  responseRecord: AllocationRecord | ProviderAcceptanceRecord;
}

export interface AllocationProviderAcceptanceRepository {
  findReplay(
    scopeKey: string,
    idempotencyKey: string
  ): Promise<AllocationProviderAcceptanceReplay | undefined>;
  findAllocation(allocationId: AllocationId, version?: number): Promise<AllocationRecord | undefined>;
  findActiveAllocation(servicePackageId: ServicePackageId): Promise<AllocationRecord | undefined>;
  createAllocation(
    record: AllocationRecord,
    scopeKey: string,
    idempotencyKey: string,
    requestFingerprint: string
  ): Promise<AllocationRecord>;
  findProviderAcceptance(
    providerAcceptanceId: ProviderAcceptanceId
  ): Promise<ProviderAcceptanceRecord | undefined>;
  findProviderAcceptanceForAllocation(
    allocationId: AllocationId
  ): Promise<ProviderAcceptanceRecord | undefined>;
  recordProviderResponse(
    record: ProviderAcceptanceRecord,
    currentAllocation: AllocationRecord,
    supersededAllocation: AllocationRecord | undefined,
    scopeKey: string,
    idempotencyKey: string,
    requestFingerprint: string
  ): Promise<ProviderAcceptanceRecord>;
}

export type AllocationProviderAcceptanceErrorCode =
  | ProviderExecutionErrorCode
  | 'INVALID_INPUT'
  | 'SERVICE_PACKAGE_NOT_FOUND'
  | 'ELIGIBILITY_EVALUATION_NOT_FOUND'
  | 'ALLOCATION_NOT_FOUND'
  | 'PROVIDER_ACCEPTANCE_NOT_FOUND';

export class AllocationProviderAcceptanceError extends Error {
  constructor(
    public readonly code: AllocationProviderAcceptanceErrorCode,
    message: string,
    public readonly status = 400,
    public readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = 'AllocationProviderAcceptanceError';
  }
}

export interface AllocateProviderServiceCommand extends AllocateProviderCommand {
  actorId: string;
}

export interface AuthenticatedProviderPrincipal {
  actorId: string;
  providerWorkspaceId: string;
}

export interface RespondToAllocationServiceCommand extends RespondToAllocationCommand {
  principal: Readonly<AuthenticatedProviderPrincipal>;
}

export const allocationProviderAcceptanceAuthorityConsequences = Object.freeze({
  servicePackageCreated: true,
  eligibilityEvaluated: true,
  providerAllocated: true,
  providerAccepted: true,
  legalProfessionalAppointmentCreated: false,
  paymentCreated: false,
  invoiceCreated: false,
  filingSubmitted: false,
  officialApplicationCreated: false,
  formalMatterCompletedAutomatically: false,
  userCapabilityVerifiedAutomatically: false,
  officialTruthCreated: false
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha256Pattern = /^[0-9a-f]{64}$/;

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(stableSerialize(value)).digest('hex');
}

function cleanText(value: string, field: string): string {
  const cleaned = value.trim();
  if (!cleaned)
    throw new AllocationProviderAcceptanceError('INVALID_INPUT', `${field} is required.`, 422);
  return cleaned;
}

function cleanWorkspaceId(value: string, field = 'workspaceId'): string {
  const cleaned = value.trim().toLowerCase();
  if (!uuidPattern.test(cleaned))
    throw new AllocationProviderAcceptanceError(
      'INVALID_INPUT',
      `${field} must be a Core Workspace UUID.`,
      422
    );
  return cleaned;
}

function assertSha256(value: string, field: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!sha256Pattern.test(cleaned))
    throw new AllocationProviderAcceptanceError(
      'INVALID_INPUT',
      `${field} must be a lowercase SHA-256 fingerprint.`,
      422
    );
  return cleaned;
}

function allocationScope(workspaceId: string, servicePackageId: ServicePackageId) {
  return `allocation:${workspaceId}:${servicePackageId}`;
}

function acceptanceScope(allocationId: AllocationId) {
  return `provider-acceptance:${allocationId}`;
}

export class AllocationProviderAcceptanceService {
  constructor(
    private readonly repository: AllocationProviderAcceptanceRepository,
    private readonly servicePackageEligibility: ServicePackageEligibilityRepository,
    private readonly providerRegistry: ProviderRegistryRepository,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly allocationIdFactory: () => AllocationId = () => `allocation_${randomUUID()}`,
    private readonly providerAcceptanceIdFactory: () => ProviderAcceptanceId = () =>
      `provider-acceptance_${randomUUID()}`
  ) {}

  async allocateProvider(command: AllocateProviderServiceCommand): Promise<AllocationRecord> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const actorId = cleanText(command.actorId, 'actorId') as MarkOrbitId;
    const rationale = cleanText(command.rationale, 'rationale');
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey');
    const expectedPackageFingerprint = assertSha256(
      command.expectedServicePackageFingerprintSha256,
      'expectedServicePackageFingerprintSha256'
    );
    const expectedEligibilityFingerprint = assertSha256(
      command.expectedEligibilityFingerprintSha256,
      'expectedEligibilityFingerprintSha256'
    );
    const scopeKey = allocationScope(workspaceId, command.servicePackageId);
    const requestFingerprint = fingerprint({
      command: 'ALLOCATE_PROVIDER',
      workspaceId,
      servicePackageId: command.servicePackageId,
      expectedServicePackageVersion: command.expectedServicePackageVersion,
      expectedPackageFingerprint,
      eligibilityEvaluationId: command.eligibilityEvaluationId,
      expectedEligibilityEvaluationVersion: command.expectedEligibilityEvaluationVersion,
      expectedEligibilityFingerprint,
      providerId: command.providerId,
      providerSupplyCapabilityId: command.providerSupplyCapabilityId,
      expectedProviderSupplyCapabilityVersion: command.expectedProviderSupplyCapabilityVersion,
      rationale,
      actorId,
      correlationId: command.correlationId
    });
    const replay = await this.allocationReplay(scopeKey, idempotencyKey, requestFingerprint);
    if (replay) return replay;

    const servicePackage = await this.requireServicePackage(command.servicePackageId);
    this.assertPackageForAllocation(
      servicePackage,
      workspaceId,
      command.expectedServicePackageVersion,
      expectedPackageFingerprint,
      command.correlationId
    );

    const evaluation = await this.requireEligibilityEvaluation(command.eligibilityEvaluationId);
    this.assertEligibilityForAllocation(
      evaluation,
      servicePackage,
      command.expectedEligibilityEvaluationVersion,
      expectedEligibilityFingerprint,
      command.providerId,
      command.providerSupplyCapabilityId,
      command.expectedProviderSupplyCapabilityVersion,
      command.correlationId
    );

    const provider = await this.requireProvider(command.providerId);
    const capability = await this.requireCurrentSupplyCapability(
      command.providerSupplyCapabilityId,
      command.expectedProviderSupplyCapabilityVersion,
      evaluation.providerSupplyCapabilityFingerprintSha256
    );
    this.assertCurrentProviderAndSupply(evaluation, provider, capability);

    if (await this.repository.findActiveAllocation(servicePackage.servicePackageId))
      throw new AllocationProviderAcceptanceError(
        'ACTIVE_ALLOCATION_EXISTS',
        'An active Allocation already exists for this Service Package.',
        409
      );

    const at = this.now();
    const record: AllocationRecord = {
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
    return this.repository.createAllocation(record, scopeKey, idempotencyKey, requestFingerprint);
  }

  async respondToAllocation(
    command: RespondToAllocationServiceCommand
  ): Promise<ProviderAcceptanceRecord> {
    const workspaceId = cleanWorkspaceId(command.workspaceId);
    const providerWorkspaceId = cleanWorkspaceId(
      command.principal.providerWorkspaceId,
      'principal.providerWorkspaceId'
    );
    const providerActorId = cleanText(command.principal.actorId, 'principal.actorId');
    const acknowledgement = cleanText(command.acknowledgement, 'acknowledgement');
    const idempotencyKey = cleanText(command.idempotencyKey, 'idempotencyKey');
    const scopeKey = acceptanceScope(command.allocationId);
    const requestFingerprint = fingerprint({
      command: 'RESPOND_TO_ALLOCATION',
      workspaceId,
      allocationId: command.allocationId,
      expectedAllocationVersion: command.expectedAllocationVersion,
      decision: command.decision,
      acknowledgement,
      providerWorkspaceId,
      providerActorId,
      correlationId: command.correlationId
    });
    const replay = await this.acceptanceReplay(scopeKey, idempotencyKey, requestFingerprint);
    if (replay) return replay;

    const allocation = await this.requireAllocation(command.allocationId);
    if (allocation.workspaceId !== workspaceId)
      throw new AllocationProviderAcceptanceError(
        'PERMISSION_DENIED',
        'Allocation belongs to another Workspace.',
        403
      );
    if (allocation.version !== command.expectedAllocationVersion || allocation.status !== 'ACTIVE')
      throw new AllocationProviderAcceptanceError(
        'ALLOCATION_NOT_CURRENT',
        'Allocation is no longer the current active version.',
        409
      );
    if (allocation.correlationId !== command.correlationId)
      throw new AllocationProviderAcceptanceError(
        'SOURCE_VERSION_MISMATCH',
        'Correlation lineage does not match the Allocation.',
        409
      );
    if (await this.repository.findProviderAcceptanceForAllocation(allocation.allocationId))
      throw new AllocationProviderAcceptanceError(
        'ALLOCATION_NOT_CURRENT',
        'Provider response has already been recorded for this Allocation.',
        409
      );

    const provider = await this.providerRegistry.findProviderByWorkspaceId(providerWorkspaceId);
    if (!provider || provider.providerId !== allocation.provider.providerId)
      throw new AllocationProviderAcceptanceError(
        'PROVIDER_IDENTITY_MISMATCH',
        'Authenticated Provider identity does not match the allocated Provider.',
        403
      );
    if (provider.operationalStatus !== 'ACTIVE')
      throw new AllocationProviderAcceptanceError(
        'PROVIDER_SUSPENDED',
        'Provider is not operationally active.',
        409
      );

    const respondedAt = this.now();
    const responseFingerprintSha256 = fingerprint({
      allocationId: allocation.allocationId,
      allocationVersion: allocation.version,
      servicePackageId: allocation.servicePackage.id,
      servicePackageVersion: allocation.servicePackage.version,
      providerId: provider.providerId,
      providerWorkspaceId,
      providerActorId,
      decision: command.decision,
      acknowledgement,
      correlationId: command.correlationId
    });
    const record: ProviderAcceptanceRecord = {
      schemaVersion: 1,
      providerAcceptanceId: this.providerAcceptanceIdFactory(),
      workspaceId,
      version: 1,
      allocation: { id: allocation.allocationId, version: allocation.version },
      servicePackage: {
        id: allocation.servicePackage.id,
        version: allocation.servicePackage.version
      },
      providerId: provider.providerId,
      providerWorkspaceId,
      providerActorId,
      decision: command.decision,
      acknowledgement,
      responseFingerprintSha256,
      respondedAt,
      correlationId: command.correlationId
    };
    const supersededAllocation =
      command.decision === 'DECLINED'
        ? ({
            ...allocation,
            version: allocation.version + 1,
            status: 'SUPERSEDED',
            updatedAt: respondedAt
          } satisfies AllocationRecord)
        : undefined;
    return this.repository.recordProviderResponse(
      record,
      allocation,
      supersededAllocation,
      scopeKey,
      idempotencyKey,
      requestFingerprint
    );
  }

  getAllocation(allocationId: AllocationId, version?: number) {
    return this.repository.findAllocation(allocationId, version);
  }

  getProviderAcceptance(providerAcceptanceId: ProviderAcceptanceId) {
    return this.repository.findProviderAcceptance(providerAcceptanceId);
  }

  private assertPackageForAllocation(
    servicePackage: ServicePackageRecord,
    workspaceId: string,
    expectedVersion: number,
    expectedFingerprint: string,
    correlationId: MarkOrbitId
  ) {
    if (servicePackage.workspaceId !== workspaceId)
      throw new AllocationProviderAcceptanceError(
        'PERMISSION_DENIED',
        'Service Package belongs to another Workspace.',
        403
      );
    if (servicePackage.version !== expectedVersion)
      throw new AllocationProviderAcceptanceError(
        'SOURCE_VERSION_MISMATCH',
        'Service Package version changed.',
        409
      );
    if (servicePackage.servicePackageFingerprintSha256 !== expectedFingerprint)
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
    if (servicePackage.source.correlationId !== correlationId)
      throw new AllocationProviderAcceptanceError(
        'SOURCE_VERSION_MISMATCH',
        'Correlation lineage does not match the Service Package source.',
        409
      );
  }

  private assertEligibilityForAllocation(
    evaluation: EligibilityEvaluationRecord,
    servicePackage: ServicePackageRecord,
    expectedVersion: number,
    expectedFingerprint: string,
    providerId: ProviderId,
    capabilityId: ProviderSupplyCapabilityId,
    capabilityVersion: number,
    correlationId: MarkOrbitId
  ) {
    if (evaluation.workspaceId !== servicePackage.workspaceId)
      throw new AllocationProviderAcceptanceError(
        'PERMISSION_DENIED',
        'Eligibility Evaluation belongs to another Workspace.',
        403
      );
    if (evaluation.version !== expectedVersion)
      throw new AllocationProviderAcceptanceError(
        'SOURCE_VERSION_MISMATCH',
        'Eligibility Evaluation version changed.',
        409
      );
    if (evaluation.deterministicFingerprintSha256 !== expectedFingerprint)
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
      evaluation.provider.providerId !== providerId ||
      evaluation.providerSupplyCapability.id !== capabilityId ||
      evaluation.providerSupplyCapability.version !== capabilityVersion
    )
      throw new AllocationProviderAcceptanceError(
        'PROVIDER_NOT_ELIGIBLE',
        'Requested Provider or Supply Capability does not match the exact Eligibility Evaluation.',
        409
      );
    if (evaluation.correlationId !== correlationId)
      throw new AllocationProviderAcceptanceError(
        'SOURCE_VERSION_MISMATCH',
        'Correlation lineage does not match the Eligibility Evaluation.',
        409
      );
  }

  private assertCurrentProviderAndSupply(
    evaluation: EligibilityEvaluationRecord,
    provider: ProviderRegistryRecord,
    capability: ProviderSupplyCapabilityRecord
  ) {
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
  }

  private async requireServicePackage(servicePackageId: ServicePackageId) {
    const record = await this.servicePackageEligibility.findServicePackage(servicePackageId);
    if (!record)
      throw new AllocationProviderAcceptanceError(
        'SERVICE_PACKAGE_NOT_FOUND',
        'Service Package was not found.',
        404
      );
    return record;
  }

  private async requireEligibilityEvaluation(eligibilityEvaluationId: EligibilityEvaluationId) {
    const record = await this.servicePackageEligibility.findEligibilityEvaluation(
      eligibilityEvaluationId
    );
    if (!record)
      throw new AllocationProviderAcceptanceError(
        'ELIGIBILITY_EVALUATION_NOT_FOUND',
        'Eligibility Evaluation was not found.',
        404
      );
    return record;
  }

  private async requireProvider(providerId: ProviderId) {
    const provider = await this.providerRegistry.findProviderById(providerId);
    if (!provider)
      throw new AllocationProviderAcceptanceError(
        'PROVIDER_NOT_FOUND',
        'Provider was not found.',
        404
      );
    return provider;
  }

  private async requireCurrentSupplyCapability(
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

  private async requireAllocation(allocationId: AllocationId) {
    const record = await this.repository.findAllocation(allocationId);
    if (!record)
      throw new AllocationProviderAcceptanceError(
        'ALLOCATION_NOT_FOUND',
        'Allocation was not found.',
        404
      );
    return record;
  }

  private async allocationReplay(scopeKey: string, idempotencyKey: string, requestFingerprint: string) {
    const replay = await this.repository.findReplay(scopeKey, idempotencyKey);
    if (!replay) return undefined;
    if (replay.fingerprint !== requestFingerprint)
      throw new AllocationProviderAcceptanceError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key has a different payload.',
        409
      );
    if (replay.targetType !== 'ALLOCATION' || !('allocationId' in replay.responseRecord))
      throw new AllocationProviderAcceptanceError(
        'PERSISTENCE_UNAVAILABLE',
        'Idempotent Allocation result is unavailable.',
        503
      );
    return replay.responseRecord;
  }

  private async acceptanceReplay(scopeKey: string, idempotencyKey: string, requestFingerprint: string) {
    const replay = await this.repository.findReplay(scopeKey, idempotencyKey);
    if (!replay) return undefined;
    if (replay.fingerprint !== requestFingerprint)
      throw new AllocationProviderAcceptanceError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key has a different payload.',
        409
      );
    if (
      replay.targetType !== 'PROVIDER_ACCEPTANCE' ||
      !('providerAcceptanceId' in replay.responseRecord)
    )
      throw new AllocationProviderAcceptanceError(
        'PERSISTENCE_UNAVAILABLE',
        'Idempotent Provider Acceptance result is unavailable.',
        503
      );
    return replay.responseRecord;
  }
}
