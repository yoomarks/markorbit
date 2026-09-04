import { createHash, randomUUID } from 'node:crypto';
import type {
  ControlledHandoffEnvelopeV1,
  ControlledHandoffVersionReferenceV1
} from '@markorbit/contracts/controlled-privacy-handoff';
import type {
  ProviderSelectionCurrentValidationV1,
  ProviderSelectionScopeReferenceV1,
  ProviderSelectionV1,
  ProviderSelectionVersionReferenceV1
} from '@markorbit/contracts/provider-selection';
import type { ProviderId, ProviderSupplyCapabilityId } from '@markorbit/contracts/provider-execution';
import {
  AllocationProviderAcceptanceService,
  type AllocateProviderServiceCommand,
  type AllocationProviderAcceptanceReplay,
  type AllocationProviderAcceptanceRepository,
  type AllocationRecord,
  type ProviderAcceptanceRecord
} from './allocation-provider-acceptance.js';
import type {
  ControlledHandoffRepository,
  ControlledPrivacyHandoffService
} from './controlled-privacy-handoff.js';
import type { ProviderSelectionRepository, ProviderSelectionService } from './provider-selection.js';

const sha256Pattern = /^[0-9a-f]{64}$/;

export type GovernedAllocationHandoffAdmission =
  | Readonly<{ mode: 'NONE_EXPLICIT' }>
  | Readonly<{
      mode: 'EXACT';
      handoff: Readonly<ControlledHandoffVersionReferenceV1>;
      envelopeFingerprintSha256: string;
      purposeFingerprintSha256: string;
      projectionFingerprintSha256: string;
      sourceSetFingerprintSha256: string;
    }>;

export interface GovernedAllocateProviderCommand extends AllocateProviderServiceCommand {
  selection: Readonly<{
    reference: Readonly<ProviderSelectionVersionReferenceV1>;
    scope: Readonly<ProviderSelectionScopeReferenceV1>;
  }>;
  handoffAdmission: GovernedAllocationHandoffAdmission;
}

export interface GovernedAllocationSelectionAdmission {
  reference: Readonly<ProviderSelectionVersionReferenceV1>;
  scopeFingerprintSha256: string;
  validationPurpose: 'ALLOCATION_PREREQUISITE_REVIEW';
  validationDecision: 'CURRENTLY_USABLE_FOR_BOUNDED_REVIEW';
  validationCurrentlyUsable: true;
  validationEvaluatedAt: string;
  validationPolicyVersion: string;
  validationCheckedAuthorityReferences: readonly string[];
  validationFingerprintSha256: string;
  validationDoesNotAuthorizeDownstreamAction: true;
}

export interface GovernedAllocationDirectExecutorAdmission {
  established: true;
  providerId: ProviderId;
  providerWorkspaceId: string;
  authorityReference: string;
  authorityVersion: number | string;
  checkedAt: string;
  validationFingerprintSha256: string;
  currentAuthorityRevalidationRequiredBeforeOwnerCommit: true;
}

export type GovernedAllocationHandoffLineage =
  | Readonly<{ mode: 'NONE_EXPLICIT' }>
  | Readonly<{
      mode: 'EXACT';
      handoff: Readonly<ControlledHandoffVersionReferenceV1>;
      envelopeFingerprintSha256: string;
      purposeFingerprintSha256: string;
      projectionFingerprintSha256: string;
      sourceSetFingerprintSha256: string;
      validationPurpose: 'HANDOFF_CONSUMPTION';
      validationDecision: 'CURRENTLY_USABLE_FOR_EXACT_CONSUMPTION';
      validationCurrentlyUsable: true;
      validationCurrentExactDisclosurePermitted: true;
      validationEvaluatedAt: string;
      validationPolicyVersion: string;
      validationCheckedAuthorityReferences: readonly string[];
      validationFingerprintSha256: string;
      validationIsNotBearerCapability: true;
      validationDoesNotAuthorizeDownstreamAction: true;
    }>;

export interface GovernedAllocationAdmissionLineageRecord {
  allocationAdmissionLineageId: string;
  version: 1;
  allocation: Readonly<{ id: string; version: number }>;
  originatingWorkspaceId: string;
  servicePackage: Readonly<{ id: string; version: number; fingerprintSha256: string }>;
  provider: Readonly<{ providerId: ProviderId; providerWorkspaceId: string }>;
  providerSupplyCapability: Readonly<{
    id: ProviderSupplyCapabilityId;
    version: number;
    fingerprintSha256: string;
  }>;
  selection: Readonly<GovernedAllocationSelectionAdmission>;
  directExecutor: Readonly<GovernedAllocationDirectExecutorAdmission>;
  handoff: GovernedAllocationHandoffLineage;
  lineageFingerprintSha256: string;
  correlationId: string;
  createdAt: string;
  containsIncomingFieldValues: false;
  containsBearerSecrets: false;
  containsRawCustomerData: false;
  containsRawEvidenceArtifacts: false;
  containsEndClientRelationshipInformation: false;
  containsPricingMarginOrProfit: false;
  providerAcceptanceAuthorized: false;
  providerContactAuthorized: false;
  professionalAppointmentCreated: false;
  protectedActionReleased: false;
  filingAuthorized: false;
  filingSubmitted: false;
  paymentAuthorized: false;
  paymentCreated: false;
  officialTruthCreated: false;
  matterCompleted: false;
}

export interface GovernedAllocationResult {
  allocation: Readonly<AllocationRecord>;
  lineage: Readonly<GovernedAllocationAdmissionLineageRecord>;
  replayed: boolean;
  selectionIsPrerequisiteNotAllocationAuthority: true;
  handoffIsPrerequisiteNotAllocationAuthority: true;
  allocationDoesNotCreateProviderAcceptance: true;
}

export interface GovernedAllocationReplay {
  requestFingerprintSha256: string;
  result: GovernedAllocationResult;
}

export interface GovernedAllocationRepository {
  findReplay(scopeKey: string, idempotencyKey: string): Promise<GovernedAllocationReplay | undefined>;
  findLineage(
    allocationId: string,
    allocationVersion?: number
  ): Promise<GovernedAllocationAdmissionLineageRecord | undefined>;
  commit(input: {
    allocation: AllocationRecord;
    lineage: GovernedAllocationAdmissionLineageRecord;
    allocationScopeKey: string;
    lineageScopeKey: string;
    idempotencyKey: string;
    requestFingerprintSha256: string;
  }): Promise<GovernedAllocationResult | undefined>;
}

export type GovernedAllocationErrorCode =
  | 'INVALID_INPUT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'SELECTION_NOT_CURRENT'
  | 'SELECTION_MISMATCH'
  | 'DIRECT_EXECUTOR_NOT_ESTABLISHED'
  | 'HANDOFF_NOT_CURRENT'
  | 'HANDOFF_MISMATCH'
  | 'PERSISTENCE_UNAVAILABLE';

export class GovernedAllocationError extends Error {
  constructor(
    public readonly code: GovernedAllocationErrorCode,
    message: string,
    public readonly status = 409,
    public readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = 'GovernedAllocationError';
  }
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function governedAllocationFingerprint(value: unknown): string {
  return createHash('sha256').update(stableSerialize(value)).digest('hex');
}

function sameVersion(left: number | string, right: number | string): boolean {
  return typeof left === typeof right && left === right;
}

function sameSelectionReference(
  left: Readonly<ProviderSelectionVersionReferenceV1>,
  right: Readonly<ProviderSelectionVersionReferenceV1>
): boolean {
  return (
    left.providerSelectionId === right.providerSelectionId &&
    left.version === right.version &&
    left.scopeVersion === right.scopeVersion
  );
}

function sameScope(
  left: Readonly<ProviderSelectionScopeReferenceV1>,
  right: Readonly<ProviderSelectionScopeReferenceV1>
): boolean {
  return (
    left.owner === right.owner &&
    left.reference === right.reference &&
    sameVersion(left.version, right.version) &&
    left.fingerprintSha256 === right.fingerprintSha256
  );
}

function exactSha256(value: string, field: string): string {
  const normalized = value.trim().toLowerCase();
  if (!sha256Pattern.test(normalized)) {
    throw new GovernedAllocationError(
      'INVALID_INPUT',
      `${field} must be a lowercase SHA-256 fingerprint.`,
      422
    );
  }
  return normalized;
}

function allocationScope(workspaceId: string, servicePackageId: string): string {
  return `allocation:${workspaceId.toLowerCase()}:${servicePackageId}`;
}

function lineageScope(workspaceId: string, servicePackageId: string): string {
  return `allocation-admission-lineage:${workspaceId.toLowerCase()}:${servicePackageId}`;
}

function selectionValidationFingerprint(validation: ProviderSelectionCurrentValidationV1): string {
  return governedAllocationFingerprint({
    schemaVersion: validation.schemaVersion,
    selection: validation.selection,
    requesterWorkspaceId: validation.requesterWorkspaceId,
    scope: validation.scope,
    purpose: validation.purpose,
    evaluatedAt: validation.evaluatedAt,
    validationPolicyVersion: validation.validationPolicyVersion,
    checkedAuthorityReferences: validation.checkedAuthorityReferences,
    decision: validation.decision,
    currentlyUsable: validation.currentlyUsable,
    validationDoesNotAuthorizeDownstreamAction: validation.validationDoesNotAuthorizeDownstreamAction
  });
}

function directExecutorSource(selection: ProviderSelectionV1) {
  return selection.sourceLineage.historicalSourceVersions.find(
    (source) => source.owner === 'MGSN' && source.sourceType === 'PROVIDER_RESPONSIBILITY_PROFILE'
  );
}

function exactEnvelopeReference(
  envelope: ControlledHandoffEnvelopeV1,
  expected: Readonly<ControlledHandoffVersionReferenceV1>
): boolean {
  return (
    envelope.controlledHandoffId === expected.controlledHandoffId && envelope.version === expected.version
  );
}

/**
 * Reuses the legacy M4 Allocation service as a validation engine while deliberately suppressing
 * its final write. Governed commit is performed later by GovernedAllocationRepository in one transaction.
 */
export class ValidationOnlyAllocationRepository implements AllocationProviderAcceptanceRepository {
  constructor(private readonly delegate: AllocationProviderAcceptanceRepository) {}

  findReplay(): Promise<AllocationProviderAcceptanceReplay | undefined> {
    return Promise.resolve(undefined);
  }

  findAllocation(...args: Parameters<AllocationProviderAcceptanceRepository['findAllocation']>) {
    return this.delegate.findAllocation(...args);
  }

  findActiveAllocation(
    ...args: Parameters<AllocationProviderAcceptanceRepository['findActiveAllocation']>
  ) {
    return this.delegate.findActiveAllocation(...args);
  }

  createAllocation(record: AllocationRecord): Promise<AllocationRecord> {
    return Promise.resolve(structuredClone(record));
  }

  findProviderAcceptance(
    ...args: Parameters<AllocationProviderAcceptanceRepository['findProviderAcceptance']>
  ) {
    return this.delegate.findProviderAcceptance(...args);
  }

  findProviderAcceptanceForAllocation(
    ...args: Parameters<AllocationProviderAcceptanceRepository['findProviderAcceptanceForAllocation']>
  ) {
    return this.delegate.findProviderAcceptanceForAllocation(...args);
  }

  recordProviderResponse(
    ...args: Parameters<AllocationProviderAcceptanceRepository['recordProviderResponse']>
  ): Promise<ProviderAcceptanceRecord> {
    return this.delegate.recordProviderResponse(...args);
  }
}

export class GovernedAllocationService {
  constructor(
    private readonly repository: GovernedAllocationRepository,
    private readonly allocationValidator: AllocationProviderAcceptanceService,
    private readonly selectionRepository: ProviderSelectionRepository,
    private readonly selectionService: ProviderSelectionService,
    private readonly handoffRepository: ControlledHandoffRepository,
    private readonly handoffService: ControlledPrivacyHandoffService,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly lineageIdFactory: () => string = () =>
      `allocation-admission-lineage_${randomUUID()}`
  ) {}

  async allocate(command: GovernedAllocateProviderCommand): Promise<GovernedAllocationResult> {
    const requestFingerprintSha256 = governedAllocationFingerprint({
      command: 'GOVERNED_ALLOCATE_PROVIDER',
      workspaceId: command.workspaceId.toLowerCase(),
      servicePackageId: command.servicePackageId,
      expectedServicePackageVersion: command.expectedServicePackageVersion,
      expectedServicePackageFingerprintSha256: command.expectedServicePackageFingerprintSha256,
      eligibilityEvaluationId: command.eligibilityEvaluationId,
      expectedEligibilityEvaluationVersion: command.expectedEligibilityEvaluationVersion,
      expectedEligibilityFingerprintSha256: command.expectedEligibilityFingerprintSha256,
      providerId: command.providerId,
      providerSupplyCapabilityId: command.providerSupplyCapabilityId,
      expectedProviderSupplyCapabilityVersion: command.expectedProviderSupplyCapabilityVersion,
      rationale: command.rationale,
      actorId: command.actorId,
      correlationId: command.correlationId,
      selection: command.selection,
      handoffAdmission: command.handoffAdmission
    });
    const replayScope = lineageScope(command.workspaceId, command.servicePackageId);
    const replay = await this.repository.findReplay(replayScope, command.idempotencyKey);
    if (replay) {
      if (replay.requestFingerprintSha256 !== requestFingerprintSha256) {
        throw new GovernedAllocationError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key is already bound to different Selection/Handoff lineage.',
          409
        );
      }
      return { ...structuredClone(replay.result), replayed: true };
    }

    // This performs all existing M4 package/eligibility/provider/supply/source checks but does not write.
    const allocation = await this.allocationValidator.allocateProvider(command);
    const at = this.instant(this.now());
    const selection = await this.requireSelection(command, allocation, at);
    const handoff = await this.requireHandoff(command, allocation, selection.record, at);
    const responsibility = directExecutorSource(selection.record);
    if (!responsibility) {
      throw new GovernedAllocationError(
        'DIRECT_EXECUTOR_NOT_ESTABLISHED',
        'Exact Provider Responsibility lineage is missing from the current Selection.',
        409
      );
    }

    const selectionAdmission: GovernedAllocationSelectionAdmission = {
      reference: structuredClone(command.selection.reference),
      scopeFingerprintSha256: selection.record.scope.fingerprintSha256,
      validationPurpose: 'ALLOCATION_PREREQUISITE_REVIEW',
      validationDecision: 'CURRENTLY_USABLE_FOR_BOUNDED_REVIEW',
      validationCurrentlyUsable: true,
      validationEvaluatedAt: selection.validation.evaluatedAt,
      validationPolicyVersion: selection.validation.validationPolicyVersion,
      validationCheckedAuthorityReferences: [...selection.validation.checkedAuthorityReferences],
      validationFingerprintSha256: selectionValidationFingerprint(selection.validation),
      validationDoesNotAuthorizeDownstreamAction: true
    };
    const directExecutor: GovernedAllocationDirectExecutorAdmission = {
      established: true,
      providerId: allocation.provider.providerId,
      providerWorkspaceId: allocation.provider.providerWorkspaceId,
      authorityReference: responsibility.sourceId,
      authorityVersion: responsibility.version,
      checkedAt: selection.validation.evaluatedAt,
      validationFingerprintSha256: governedAllocationFingerprint({
        selectionValidationFingerprintSha256: selectionAdmission.validationFingerprintSha256,
        providerResponsibilityProfile: {
          sourceId: responsibility.sourceId,
          version: responsibility.version,
          fingerprintSha256: responsibility.fingerprintSha256,
          authorityState: responsibility.authorityState
        }
      }),
      currentAuthorityRevalidationRequiredBeforeOwnerCommit: true
    };
    const baseLineage = {
      allocationAdmissionLineageId: this.lineageIdFactory(),
      version: 1 as const,
      allocation: { id: allocation.allocationId, version: allocation.version },
      originatingWorkspaceId: allocation.workspaceId,
      servicePackage: {
        id: allocation.servicePackage.id,
        version: allocation.servicePackage.version,
        fingerprintSha256: allocation.servicePackageFingerprintSha256
      },
      provider: {
        providerId: allocation.provider.providerId,
        providerWorkspaceId: allocation.provider.providerWorkspaceId
      },
      providerSupplyCapability: {
        id: allocation.providerSupplyCapability.id,
        version: allocation.providerSupplyCapability.version,
        fingerprintSha256: allocation.providerSupplyCapabilityFingerprintSha256
      },
      selection: selectionAdmission,
      directExecutor,
      handoff,
      correlationId: allocation.correlationId,
      createdAt: at,
      containsIncomingFieldValues: false as const,
      containsBearerSecrets: false as const,
      containsRawCustomerData: false as const,
      containsRawEvidenceArtifacts: false as const,
      containsEndClientRelationshipInformation: false as const,
      containsPricingMarginOrProfit: false as const,
      providerAcceptanceAuthorized: false as const,
      providerContactAuthorized: false as const,
      professionalAppointmentCreated: false as const,
      protectedActionReleased: false as const,
      filingAuthorized: false as const,
      filingSubmitted: false as const,
      paymentAuthorized: false as const,
      paymentCreated: false as const,
      officialTruthCreated: false as const,
      matterCompleted: false as const
    };
    const lineage: GovernedAllocationAdmissionLineageRecord = {
      ...baseLineage,
      lineageFingerprintSha256: governedAllocationFingerprint(baseLineage)
    };
    const committed = await this.repository.commit({
      allocation,
      lineage,
      allocationScopeKey: allocationScope(allocation.workspaceId, allocation.servicePackage.id),
      lineageScopeKey: replayScope,
      idempotencyKey: command.idempotencyKey,
      requestFingerprintSha256
    });
    if (committed) return committed;
    return {
      allocation,
      lineage,
      replayed: false,
      selectionIsPrerequisiteNotAllocationAuthority: true,
      handoffIsPrerequisiteNotAllocationAuthority: true,
      allocationDoesNotCreateProviderAcceptance: true
    };
  }

  private async requireSelection(
    command: GovernedAllocateProviderCommand,
    allocation: AllocationRecord,
    checkedAt: string
  ): Promise<{ record: ProviderSelectionV1; validation: ProviderSelectionCurrentValidationV1 }> {
    const record = await this.selectionRepository.findLatestSelection(
      command.selection.reference.providerSelectionId
    );
    if (
      !record ||
      record.status !== 'CURRENT' ||
      record.requesterWorkspaceId.toLowerCase() !== allocation.workspaceId.toLowerCase() ||
      !sameSelectionReference(command.selection.reference, {
        providerSelectionId: record.providerSelectionId,
        version: record.version,
        scopeVersion: record.scopeVersion
      }) ||
      !sameScope(command.selection.scope, record.scope)
    ) {
      throw new GovernedAllocationError(
        'SELECTION_NOT_CURRENT',
        'Governed Allocation requires the exact current Human Provider Selection.',
        409
      );
    }
    if (
      record.sourceLineage.provider.providerId !== allocation.provider.providerId ||
      record.sourceLineage.provider.providerWorkspaceId.toLowerCase() !==
        allocation.provider.providerWorkspaceId.toLowerCase() ||
      record.sourceLineage.providerSupplyCapability.id !== allocation.providerSupplyCapability.id ||
      record.sourceLineage.providerSupplyCapability.version !==
        allocation.providerSupplyCapability.version ||
      record.sourceLineage.providerSupplyCapability.fingerprintSha256 !==
        allocation.providerSupplyCapabilityFingerprintSha256
    ) {
      throw new GovernedAllocationError(
        'SELECTION_MISMATCH',
        'Selection Provider/Workspace/Supply lineage does not match the Allocation target.',
        409
      );
    }
    const validation = await this.selectionService.validateCurrent(
      { workspaceId: allocation.workspaceId },
      {
        scope: command.selection.scope,
        providerSelectionId: command.selection.reference.providerSelectionId,
        purpose: 'ALLOCATION_PREREQUISITE_REVIEW',
        checkedAt
      }
    );
    if (
      validation.decision !== 'CURRENTLY_USABLE_FOR_BOUNDED_REVIEW' ||
      validation.currentlyUsable !== true ||
      !sameSelectionReference(validation.selection, command.selection.reference)
    ) {
      throw new GovernedAllocationError(
        'SELECTION_NOT_CURRENT',
        'Selection is not currently usable for Allocation prerequisite review.',
        409,
        'denialReason' in validation ? { denialReason: validation.denialReason } : undefined
      );
    }
    return { record, validation };
  }

  private async requireHandoff(
    command: GovernedAllocateProviderCommand,
    allocation: AllocationRecord,
    selection: ProviderSelectionV1,
    checkedAt: string
  ): Promise<GovernedAllocationHandoffLineage> {
    if (command.handoffAdmission.mode === 'NONE_EXPLICIT') return { mode: 'NONE_EXPLICIT' };
    const admission = command.handoffAdmission;
    const envelope = await this.handoffRepository.findLatest(admission.handoff.controlledHandoffId);
    if (
      !envelope ||
      envelope.status !== 'AUTHORIZED' ||
      !exactEnvelopeReference(envelope, admission.handoff)
    ) {
      throw new GovernedAllocationError(
        'HANDOFF_NOT_CURRENT',
        'Exact Controlled Handoff is not the current authorized version.',
        409
      );
    }
    exactSha256(admission.envelopeFingerprintSha256, 'handoffAdmission.envelopeFingerprintSha256');
    exactSha256(admission.purposeFingerprintSha256, 'handoffAdmission.purposeFingerprintSha256');
    exactSha256(admission.projectionFingerprintSha256, 'handoffAdmission.projectionFingerprintSha256');
    exactSha256(admission.sourceSetFingerprintSha256, 'handoffAdmission.sourceSetFingerprintSha256');
    const envelopeSelection = envelope.sourceLineage.selectionLineage.selection;
    if (
      envelope.originatingWorkspaceId.toLowerCase() !== allocation.workspaceId.toLowerCase() ||
      envelope.recipient.providerId !== allocation.provider.providerId ||
      envelope.recipient.providerWorkspaceId.toLowerCase() !==
        allocation.provider.providerWorkspaceId.toLowerCase() ||
      !sameSelectionReference(envelopeSelection, command.selection.reference) ||
      !sameSelectionReference(envelopeSelection, {
        providerSelectionId: selection.providerSelectionId,
        version: selection.version,
        scopeVersion: selection.scopeVersion
      }) ||
      envelope.envelopeFingerprintSha256 !== admission.envelopeFingerprintSha256 ||
      envelope.purpose.purposeFingerprintSha256 !== admission.purposeFingerprintSha256 ||
      envelope.authorizedProjection.projectionFingerprintSha256 !==
        admission.projectionFingerprintSha256 ||
      envelope.authorizedProjection.sourceSetFingerprintSha256 !==
        admission.sourceSetFingerprintSha256
    ) {
      throw new GovernedAllocationError(
        'HANDOFF_MISMATCH',
        'Controlled Handoff exact recipient/Selection/purpose/projection/source lineage is mismatched.',
        409
      );
    }
    const validation = await this.handoffService.validateCurrent(
      { workspaceId: allocation.workspaceId },
      {
        envelope: admission.handoff,
        purpose: 'HANDOFF_CONSUMPTION',
        attempt: {
          originatingWorkspaceId: allocation.workspaceId,
          recipientProviderId: allocation.provider.providerId,
          recipientProviderWorkspaceId: allocation.provider.providerWorkspaceId,
          purposeFingerprintSha256: admission.purposeFingerprintSha256,
          projectionFingerprintSha256: admission.projectionFingerprintSha256,
          sourceSetFingerprintSha256: admission.sourceSetFingerprintSha256,
          artifactRetrievalRequested: false,
          attemptedAt: checkedAt,
          correlationId: allocation.correlationId
        }
      }
    );
    if (
      validation.decision !== 'CURRENTLY_USABLE_FOR_EXACT_CONSUMPTION' ||
      validation.currentlyUsable !== true ||
      validation.currentExactDisclosurePermitted !== true
    ) {
      throw new GovernedAllocationError(
        'HANDOFF_NOT_CURRENT',
        'Controlled Handoff is not currently usable for exact consumption.',
        409,
        'denialReason' in validation ? { denialReason: validation.denialReason } : undefined
      );
    }
    return {
      mode: 'EXACT',
      handoff: structuredClone(admission.handoff),
      envelopeFingerprintSha256: admission.envelopeFingerprintSha256,
      purposeFingerprintSha256: admission.purposeFingerprintSha256,
      projectionFingerprintSha256: admission.projectionFingerprintSha256,
      sourceSetFingerprintSha256: admission.sourceSetFingerprintSha256,
      validationPurpose: 'HANDOFF_CONSUMPTION',
      validationDecision: 'CURRENTLY_USABLE_FOR_EXACT_CONSUMPTION',
      validationCurrentlyUsable: true,
      validationCurrentExactDisclosurePermitted: true,
      validationEvaluatedAt: validation.evaluatedAt,
      validationPolicyVersion: validation.validationPolicyVersion,
      validationCheckedAuthorityReferences: [...validation.checkedAuthorityReferences],
      validationFingerprintSha256: governedAllocationFingerprint(validation),
      validationIsNotBearerCapability: true,
      validationDoesNotAuthorizeDownstreamAction: true
    };
  }

  private instant(value: string): string {
    if (!Number.isFinite(Date.parse(value))) {
      throw new GovernedAllocationError('INVALID_INPUT', 'Governed Allocation clock is invalid.', 422);
    }
    return new Date(value).toISOString();
  }
}