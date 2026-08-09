import type {
  Channel,
  ExecutionReleaseId,
  FilingAuthorizationId,
  FilingExecutionTaskDraftId,
  FormalMatterId,
  MarkOrbitId,
  PreparationLockId,
  RelationshipModel
} from './index.js';

/**
 * Milestone 4 provider-execution contract boundary.
 *
 * This module freezes the minimum shared vocabulary needed for one governed
 * Execution -> MGSN provider-delivery -> Execution evidence loop. It deliberately
 * does not create finance, legal appointment, external filing or Official Truth.
 */

export type ProviderId = `provider_${string}`;
export type ProviderSupplyCapabilityId = `provider-supply-capability_${string}`;
export type ServicePackageId = `service-package_${string}`;
export type EligibilityEvaluationId = `eligibility-evaluation_${string}`;
export type AllocationId = `allocation_${string}`;
export type ProviderAcceptanceId = `provider-acceptance_${string}`;
export type ProviderReturnId = `provider-return_${string}`;
export type EvidenceHandoffId = `evidence-handoff_${string}`;

export const providerOperationalStatuses = ['ACTIVE', 'SUSPENDED', 'INACTIVE'] as const;
export type ProviderOperationalStatus = (typeof providerOperationalStatuses)[number];

export const providerSupplyCapabilityStatuses = ['ACTIVE', 'SUSPENDED', 'RETIRED'] as const;
export type ProviderSupplyCapabilityStatus = (typeof providerSupplyCapabilityStatuses)[number];

export const servicePackageStatuses = ['ADMITTED', 'STALE', 'CANCELLED'] as const;
export type ServicePackageStatus = (typeof servicePackageStatuses)[number];

export const eligibilityOutcomes = ['ELIGIBLE', 'INELIGIBLE'] as const;
export type EligibilityOutcome = (typeof eligibilityOutcomes)[number];

export const allocationStatuses = ['ACTIVE', 'CANCELLED', 'SUPERSEDED'] as const;
export type AllocationStatus = (typeof allocationStatuses)[number];

export const providerAcceptanceDecisions = ['ACCEPTED', 'DECLINED'] as const;
export type ProviderAcceptanceDecision = (typeof providerAcceptanceDecisions)[number];

export const providerReturnStatuses = ['CURRENT', 'SUPERSEDED'] as const;
export type ProviderReturnStatus = (typeof providerReturnStatuses)[number];

/**
 * Bounded provider identity reference. Core remains owner of Workspace / organization
 * identity; MGSN may only retain the reference needed for provider-network truth.
 */
export interface ProviderReference {
  providerId: ProviderId;
  providerWorkspaceId: string;
  displayName: string;
  operationalStatus: ProviderOperationalStatus;
}

export interface EffectivePeriod {
  effectiveFrom: string;
  effectiveUntil?: string;
}

/**
 * Private supply-side capability evidence. This is not a user Capability and must
 * never be promoted into Capability Engine evidence by contract implication.
 */
export interface ProviderSupplyCapability {
  schemaVersion: 1;
  providerSupplyCapabilityId: ProviderSupplyCapabilityId;
  provider: Readonly<ProviderReference>;
  version: number;
  status: ProviderSupplyCapabilityStatus;
  jurisdictions: readonly string[];
  serviceTypes: readonly string[];
  effectivePeriod: Readonly<EffectivePeriod>;
  capacityUnits?: number;
  evidenceReferences: readonly string[];
  sourceFingerprintSha256: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExactVersionReference<TId extends string> {
  id: TId;
  version: number | string;
}

export interface ProviderExecutionWindow {
  startsAt: string;
  endsAt: string;
}

/**
 * Exact governed Execution lineage admitted into MGSN. MGSN receives these values
 * through a bounded API and never reads MarkReg or Execution databases directly.
 */
export interface ProviderExecutionSourceSnapshot {
  schemaVersion: 1;
  workspaceId: string;
  formalMatter?: Readonly<ExactVersionReference<FormalMatterId>>;
  preparationLock: Readonly<ExactVersionReference<PreparationLockId>>;
  filingAuthorization: Readonly<ExactVersionReference<FilingAuthorizationId>>;
  executionRelease: Readonly<ExactVersionReference<ExecutionReleaseId>>;
  filingExecutionTaskDraft: Readonly<ExactVersionReference<FilingExecutionTaskDraftId>>;
  jurisdiction: string;
  serviceType: string;
  serviceScope: readonly string[];
  documentReferences: readonly string[];
  instructionReferences: readonly string[];
  executionWindow: Readonly<ProviderExecutionWindow>;
  channel?: Channel;
  relationshipModel?: RelationshipModel;
  sourceFingerprintSha256: string;
  correlationId: MarkOrbitId;
  capturedAt: string;
}

/** Service Package is MGSN admission truth, not allocation or acceptance. */
export interface ServicePackage {
  schemaVersion: 1;
  servicePackageId: ServicePackageId;
  workspaceId: string;
  version: number;
  source: Readonly<ProviderExecutionSourceSnapshot>;
  sourceFingerprintSha256: string;
  servicePackageFingerprintSha256: string;
  jurisdiction: string;
  serviceType: string;
  serviceScope: readonly string[];
  status: ServicePackageStatus;
  createdAt: string;
  updatedAt: string;
}

export type EligibilityCheckStatus = 'PASS' | 'FAIL';
export interface EligibilityCheck {
  code: string;
  status: EligibilityCheckStatus;
  blocking: boolean;
  reason: string;
  evidenceReferences: readonly string[];
}

/** Deterministic suitability truth only. It has no allocation consequence. */
export interface EligibilityEvaluation {
  schemaVersion: 1;
  eligibilityEvaluationId: EligibilityEvaluationId;
  workspaceId: string;
  version: number;
  servicePackage: Readonly<ExactVersionReference<ServicePackageId>>;
  servicePackageFingerprintSha256: string;
  provider: Readonly<ProviderReference>;
  providerSupplyCapability: Readonly<ExactVersionReference<ProviderSupplyCapabilityId>>;
  providerSupplyCapabilityFingerprintSha256: string;
  policyVersion: string;
  outcome: EligibilityOutcome;
  checks: ReadonlyArray<Readonly<EligibilityCheck>>;
  deterministicFingerprintSha256: string;
  evaluatedAt: string;
  correlationId: MarkOrbitId;
}

/** Explicit internal MGSN assignment decision. It is not provider acceptance. */
export interface Allocation {
  schemaVersion: 1;
  allocationId: AllocationId;
  workspaceId: string;
  version: number;
  servicePackage: Readonly<ExactVersionReference<ServicePackageId>>;
  servicePackageFingerprintSha256: string;
  eligibilityEvaluation: Readonly<ExactVersionReference<EligibilityEvaluationId>>;
  eligibilityFingerprintSha256: string;
  provider: Readonly<ProviderReference>;
  providerSupplyCapability: Readonly<ExactVersionReference<ProviderSupplyCapabilityId>>;
  allocatedBy: MarkOrbitId;
  rationale: string;
  status: AllocationStatus;
  createdAt: string;
  updatedAt: string;
  correlationId: MarkOrbitId;
}

/**
 * Provider response to an Allocation. Provider identity is expected to be supplied by
 * authenticated Principal context at runtime, never trusted from a request payload.
 */
export interface ProviderAcceptance {
  schemaVersion: 1;
  providerAcceptanceId: ProviderAcceptanceId;
  workspaceId: string;
  version: number;
  allocation: Readonly<ExactVersionReference<AllocationId>>;
  servicePackage: Readonly<ExactVersionReference<ServicePackageId>>;
  providerId: ProviderId;
  providerWorkspaceId: string;
  decision: ProviderAcceptanceDecision;
  acknowledgement: string;
  responseFingerprintSha256: string;
  respondedAt: string;
  correlationId: MarkOrbitId;
}

export interface ProviderReturnArtifact {
  reference: string;
  fileName?: string;
  mediaType?: string;
  sha256?: string;
}

export interface ProviderAssertion {
  code: string;
  value: string | number | boolean | null;
  evidenceReferences: readonly string[];
}

/**
 * Structured provider claim/evidence package. Even when assertions describe an
 * external filing event, this record is provider evidence and never Official Truth.
 */
export interface ProviderReturn {
  schemaVersion: 1;
  providerReturnId: ProviderReturnId;
  workspaceId: string;
  version: number;
  servicePackage: Readonly<ExactVersionReference<ServicePackageId>>;
  allocation: Readonly<ExactVersionReference<AllocationId>>;
  providerAcceptance: Readonly<ExactVersionReference<ProviderAcceptanceId>>;
  providerId: ProviderId;
  providerWorkspaceId: string;
  workStatusClaim: string;
  artifacts: ReadonlyArray<Readonly<ProviderReturnArtifact>>;
  assertions: ReadonlyArray<Readonly<ProviderAssertion>>;
  returnFingerprintSha256: string;
  status: ProviderReturnStatus;
  supersedes?: Readonly<ExactVersionReference<ProviderReturnId>>;
  submittedAt: string;
  correlationId: MarkOrbitId;
}

/** Exact retry-safe reference handed from MGSN to Execution for reviewable evidence. */
export interface EvidenceHandoffReference {
  schemaVersion: 1;
  evidenceHandoffId: EvidenceHandoffId;
  workspaceId: string;
  providerReturn: Readonly<ExactVersionReference<ProviderReturnId>>;
  providerReturnFingerprintSha256: string;
  executionRelease: Readonly<ExactVersionReference<ExecutionReleaseId>>;
  filingExecutionTaskDraft: Readonly<ExactVersionReference<FilingExecutionTaskDraftId>>;
  correlationId: MarkOrbitId;
  handedOffAt: string;
}

export interface CreateServicePackageCommand {
  workspaceId: string;
  source: Readonly<ProviderExecutionSourceSnapshot>;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

export interface EvaluateProviderEligibilityCommand {
  workspaceId: string;
  servicePackageId: ServicePackageId;
  expectedServicePackageVersion: number;
  expectedServicePackageFingerprintSha256: string;
  providerSupplyCapabilityId: ProviderSupplyCapabilityId;
  expectedProviderSupplyCapabilityVersion: number;
  expectedProviderSupplyCapabilityFingerprintSha256: string;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

export interface AllocateProviderCommand {
  workspaceId: string;
  servicePackageId: ServicePackageId;
  expectedServicePackageVersion: number;
  expectedServicePackageFingerprintSha256: string;
  eligibilityEvaluationId: EligibilityEvaluationId;
  expectedEligibilityEvaluationVersion: number;
  expectedEligibilityFingerprintSha256: string;
  providerId: ProviderId;
  providerSupplyCapabilityId: ProviderSupplyCapabilityId;
  expectedProviderSupplyCapabilityVersion: number;
  rationale: string;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

export interface RespondToAllocationCommand {
  workspaceId: string;
  allocationId: AllocationId;
  expectedAllocationVersion: number;
  decision: ProviderAcceptanceDecision;
  acknowledgement: string;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

export interface CreateProviderReturnCommand {
  workspaceId: string;
  allocationId: AllocationId;
  expectedAllocationVersion: number;
  providerAcceptanceId: ProviderAcceptanceId;
  expectedProviderAcceptanceVersion: number;
  servicePackageId: ServicePackageId;
  expectedServicePackageVersion: number;
  workStatusClaim: string;
  artifacts: ReadonlyArray<Readonly<ProviderReturnArtifact>>;
  assertions: ReadonlyArray<Readonly<ProviderAssertion>>;
  supersedes?: Readonly<ExactVersionReference<ProviderReturnId>>;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

export interface HandoffProviderReturnEvidenceCommand {
  workspaceId: string;
  providerReturnId: ProviderReturnId;
  expectedProviderReturnVersion: number;
  expectedProviderReturnFingerprintSha256: string;
  executionReleaseId: ExecutionReleaseId;
  expectedExecutionReleaseVersion: number;
  filingExecutionTaskDraftId: FilingExecutionTaskDraftId;
  expectedFilingExecutionTaskDraftVersion: number | string;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

export const providerExecutionErrorCodes = [
  'STALE_SOURCE',
  'SOURCE_VERSION_MISMATCH',
  'SOURCE_FINGERPRINT_MISMATCH',
  'PERMISSION_DENIED',
  'POLICY_DENIED',
  'IDEMPOTENCY_CONFLICT',
  'VERSION_CONFLICT',
  'PROVIDER_NOT_FOUND',
  'PROVIDER_SUSPENDED',
  'SUPPLY_CAPABILITY_INACTIVE',
  'PROVIDER_NOT_ELIGIBLE',
  'ACTIVE_ALLOCATION_EXISTS',
  'ALLOCATION_NOT_CURRENT',
  'PROVIDER_IDENTITY_MISMATCH',
  'RETURN_SUPERSEDED',
  'PERSISTENCE_UNAVAILABLE',
  'DEPENDENCY_UNAVAILABLE'
] as const;
export type ProviderExecutionErrorCode = (typeof providerExecutionErrorCodes)[number];

export interface ProviderExecutionOperationError {
  code: ProviderExecutionErrorCode;
  message: string;
  retryable: boolean;
  details?: Readonly<Record<string, unknown>>;
}

/**
 * Authority-consequence fixture shared by the bounded M4 path. Internal MGSN and
 * Execution evidence truth may progress only through explicit commands. Financial,
 * legal-appointment, external-filing, Matter-completion and user-Capability truth do
 * not follow automatically from any provider-delivery stage.
 */
export interface ProviderExecutionAuthorityConsequences {
  servicePackageCreated: boolean;
  eligibilityEvaluated: boolean;
  providerAllocated: boolean;
  providerAccepted: boolean;
  providerReturnCreated: boolean;
  executionEvidenceHandedOff: boolean;
  paymentCreated: false;
  invoiceCreated: false;
  professionalLegallyAppointedAutomatically: false;
  filingSubmitted: false;
  officialApplicationCreated: false;
  officialApplicationNumberReceived: false;
  trademarkOfficeAcceptance: false;
  trademarkOfficeContactedAsVerifiedTruth: false;
  formalMatterCompletedAutomatically: false;
  userCapabilityVerifiedAutomatically: false;
}

function providerExecutionConsequences(
  internal: Pick<
    ProviderExecutionAuthorityConsequences,
    | 'servicePackageCreated'
    | 'eligibilityEvaluated'
    | 'providerAllocated'
    | 'providerAccepted'
    | 'providerReturnCreated'
    | 'executionEvidenceHandedOff'
  >
): Readonly<ProviderExecutionAuthorityConsequences> {
  return Object.freeze({
    ...internal,
    paymentCreated: false,
    invoiceCreated: false,
    professionalLegallyAppointedAutomatically: false,
    filingSubmitted: false,
    officialApplicationCreated: false,
    officialApplicationNumberReceived: false,
    trademarkOfficeAcceptance: false,
    trademarkOfficeContactedAsVerifiedTruth: false,
    formalMatterCompletedAutomatically: false,
    userCapabilityVerifiedAutomatically: false
  });
}

export const servicePackageAuthorityConsequences = providerExecutionConsequences({
  servicePackageCreated: true,
  eligibilityEvaluated: false,
  providerAllocated: false,
  providerAccepted: false,
  providerReturnCreated: false,
  executionEvidenceHandedOff: false
});

export const eligibilityAuthorityConsequences = providerExecutionConsequences({
  servicePackageCreated: true,
  eligibilityEvaluated: true,
  providerAllocated: false,
  providerAccepted: false,
  providerReturnCreated: false,
  executionEvidenceHandedOff: false
});

export const allocationAuthorityConsequences = providerExecutionConsequences({
  servicePackageCreated: true,
  eligibilityEvaluated: true,
  providerAllocated: true,
  providerAccepted: false,
  providerReturnCreated: false,
  executionEvidenceHandedOff: false
});

export const providerAcceptanceAuthorityConsequences = providerExecutionConsequences({
  servicePackageCreated: true,
  eligibilityEvaluated: true,
  providerAllocated: true,
  providerAccepted: true,
  providerReturnCreated: false,
  executionEvidenceHandedOff: false
});

export const providerReturnAuthorityConsequences = providerExecutionConsequences({
  servicePackageCreated: true,
  eligibilityEvaluated: true,
  providerAllocated: true,
  providerAccepted: true,
  providerReturnCreated: true,
  executionEvidenceHandedOff: false
});

export const evidenceHandoffAuthorityConsequences = providerExecutionConsequences({
  servicePackageCreated: true,
  eligibilityEvaluated: true,
  providerAllocated: true,
  providerAccepted: true,
  providerReturnCreated: true,
  executionEvidenceHandedOff: true
});
