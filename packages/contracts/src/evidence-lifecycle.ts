import type { FormalMatterId, MarkOrbitId } from './index.js';
import type {
  EvidenceHandoffId,
  ExactVersionReference,
  ProviderId,
  ProviderReturnId
} from './provider-execution.js';

/**
 * Milestone 5 evidence-review and lifecycle contract boundary.
 *
 * This module freezes the shared vocabulary for turning an exact Execution-owned
 * PENDING_REVIEW evidence receipt into an explicit internal review decision and,
 * only when admitted, a MarkReg-owned lifecycle projection and non-executing
 * Recommended Action. Nothing in this contract creates external filing or
 * trademark-office Official Truth.
 */

export type EvidenceReceiptId = `evidence-receipt_${string}`;
export type EvidenceReviewDecisionId = `evidence-review-decision_${string}`;
export type ReviewedSourceAdmissionId = `reviewed-source-admission_${string}`;
export type LifecycleEventId = `lifecycle-event_${string}`;
export type LifecycleViewId = `lifecycle-view_${string}`;
export type RecommendedActionId = `recommended-action_${string}`;

export const evidenceReviewOutcomes = [
  'ADMITTED_FOR_INTERNAL_USE',
  'CORRECTION_REQUIRED',
  'REJECTED'
] as const;
export type EvidenceReviewOutcome = (typeof evidenceReviewOutcomes)[number];

export const lifecycleProjectionStates = [
  'INTERNAL_PROCESSING',
  'REVIEWED_PROVIDER_EVIDENCE',
  'CUSTOMER_ACTION_NEEDED',
  'WAITING_NO_ACTION',
  'CORRECTION_OR_REVIEW_ISSUE'
] as const;
export type LifecycleProjectionState = (typeof lifecycleProjectionStates)[number];

export const recommendedActionStatuses = [
  'OPEN',
  'ACKNOWLEDGED',
  'DISMISSED',
  'SUPPRESSED'
] as const;
export type RecommendedActionStatus = (typeof recommendedActionStatuses)[number];

/**
 * Exact Execution evidence identity presented for review. The receipt fingerprint
 * protects the complete reviewable receipt while Provider Return lineage remains
 * explicit evidence provenance rather than Official Truth.
 */
export interface EvidenceReviewSource {
  schemaVersion: 1;
  workspaceId: string;
  evidenceReceipt: Readonly<ExactVersionReference<EvidenceReceiptId>>;
  evidenceReceiptFingerprintSha256: string;
  evidenceHandoffId: EvidenceHandoffId;
  providerReturn: Readonly<ExactVersionReference<ProviderReturnId>>;
  providerReturnFingerprintSha256: string;
  providerId: ProviderId;
  correlationId: MarkOrbitId;
  capturedAt: string;
}

export interface EvidenceReviewCorrectionReason {
  code: string;
  message: string;
  evidenceReferences: readonly string[];
}

/**
 * Execution-owned review truth. A decision may govern bounded internal use, but it
 * never certifies the Provider Return or creates trademark-office truth.
 */
export interface EvidenceReviewDecision {
  schemaVersion: 1;
  evidenceReviewDecisionId: EvidenceReviewDecisionId;
  workspaceId: string;
  version: number;
  source: Readonly<EvidenceReviewSource>;
  outcome: EvidenceReviewOutcome;
  reviewerPrincipalId: MarkOrbitId;
  rationale: string;
  correctionReasons: ReadonlyArray<Readonly<EvidenceReviewCorrectionReason>>;
  decisionFingerprintSha256: string;
  reviewedAt: string;
  correlationId: MarkOrbitId;
}

/**
 * Exact Execution-to-MarkReg admission envelope. This exists only for an admitted
 * review decision and identifies the Formal Matter that may receive an internal
 * lifecycle projection. It is not a Filing Submission or official-status event.
 */
export interface ReviewedSourceAdmissionEnvelope {
  schemaVersion: 1;
  reviewedSourceAdmissionId: ReviewedSourceAdmissionId;
  workspaceId: string;
  version: number;
  formalMatter: Readonly<ExactVersionReference<FormalMatterId>>;
  reviewDecision: Readonly<ExactVersionReference<EvidenceReviewDecisionId>>;
  reviewDecisionFingerprintSha256: string;
  evidenceSource: Readonly<EvidenceReviewSource>;
  admittedEvidenceReferences: readonly string[];
  admissionFingerprintSha256: string;
  admittedAt: string;
  correlationId: MarkOrbitId;
}

/** Exact provenance retained by every MarkReg lifecycle projection event. */
export interface LifecycleProjectionSource {
  reviewedSourceAdmission: Readonly<ExactVersionReference<ReviewedSourceAdmissionId>>;
  admissionFingerprintSha256: string;
  evidenceReviewDecision: Readonly<ExactVersionReference<EvidenceReviewDecisionId>>;
  evidenceReceipt: Readonly<ExactVersionReference<EvidenceReceiptId>>;
  providerReturn: Readonly<ExactVersionReference<ProviderReturnId>>;
  formalMatter: Readonly<ExactVersionReference<FormalMatterId>>;
}

export interface LifecycleEventProjection {
  schemaVersion: 1;
  lifecycleEventId: LifecycleEventId;
  workspaceId: string;
  formalMatter: Readonly<ExactVersionReference<FormalMatterId>>;
  version: number;
  source: Readonly<LifecycleProjectionSource>;
  state: LifecycleProjectionState;
  eventCode: string;
  customerSafeLabel: string;
  customerSafeSummary: string;
  occurredAt: string;
  projectedAt: string;
  lifecycleEventFingerprintSha256: string;
  officialStatusVerified: false;
  correlationId: MarkOrbitId;
}

/**
 * Deterministic MarkReg-owned current read model derived from durable lifecycle
 * events. It is not a second source of official trademark-office status.
 */
export interface CurrentLifecycleView {
  schemaVersion: 1;
  lifecycleViewId: LifecycleViewId;
  workspaceId: string;
  formalMatter: Readonly<ExactVersionReference<FormalMatterId>>;
  version: number;
  currentEvent: Readonly<ExactVersionReference<LifecycleEventId>>;
  currentEventFingerprintSha256: string;
  state: LifecycleProjectionState;
  customerSafeLabel: string;
  customerSafeSummary: string;
  lifecycleViewFingerprintSha256: string;
  officialStatusVerified: false;
  updatedAt: string;
}

/**
 * Explainable advisory state. It can be acknowledged/dismissed/suppressed, but
 * creation of this record never authorizes or executes the recommended action.
 */
export interface RecommendedAction {
  schemaVersion: 1;
  recommendedActionId: RecommendedActionId;
  workspaceId: string;
  formalMatter: Readonly<ExactVersionReference<FormalMatterId>>;
  version: number;
  sourceLifecycleView: Readonly<ExactVersionReference<LifecycleViewId>>;
  sourceLifecycleViewFingerprintSha256: string;
  policyVersion: string;
  actionCode: string;
  title: string;
  explanation: string;
  dueAt?: string;
  timingBasis?: string;
  status: RecommendedActionStatus;
  recommendedActionFingerprintSha256: string;
  executionAuthorized: false;
  createdAt: string;
  updatedAt: string;
}

export interface RecordEvidenceReviewDecisionCommand {
  workspaceId: string;
  evidenceReceiptId: EvidenceReceiptId;
  expectedEvidenceReceiptVersion: number;
  expectedEvidenceReceiptFingerprintSha256: string;
  outcome: EvidenceReviewOutcome;
  rationale: string;
  correctionReasons: ReadonlyArray<Readonly<EvidenceReviewCorrectionReason>>;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

export interface AdmitReviewedSourceCommand {
  workspaceId: string;
  evidenceReviewDecisionId: EvidenceReviewDecisionId;
  expectedEvidenceReviewDecisionVersion: number;
  expectedEvidenceReviewDecisionFingerprintSha256: string;
  formalMatterId: FormalMatterId;
  expectedFormalMatterVersion: number | string;
  admittedEvidenceReferences: readonly string[];
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

export interface ProjectLifecycleEventCommand {
  workspaceId: string;
  reviewedSourceAdmissionId: ReviewedSourceAdmissionId;
  expectedReviewedSourceAdmissionVersion: number;
  expectedAdmissionFingerprintSha256: string;
  formalMatterId: FormalMatterId;
  expectedFormalMatterVersion: number | string;
  state: LifecycleProjectionState;
  eventCode: string;
  customerSafeLabel: string;
  customerSafeSummary: string;
  occurredAt: string;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

export interface CreateRecommendedActionCommand {
  workspaceId: string;
  lifecycleViewId: LifecycleViewId;
  expectedLifecycleViewVersion: number;
  expectedLifecycleViewFingerprintSha256: string;
  policyVersion: string;
  actionCode: string;
  title: string;
  explanation: string;
  dueAt?: string;
  timingBasis?: string;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

export const evidenceLifecycleErrorCodes = [
  'STALE_SOURCE',
  'SOURCE_VERSION_MISMATCH',
  'SOURCE_FINGERPRINT_MISMATCH',
  'PERMISSION_DENIED',
  'POLICY_DENIED',
  'IDEMPOTENCY_CONFLICT',
  'VERSION_CONFLICT',
  'REVIEW_DECISION_NOT_ADMISSIBLE',
  'LIFECYCLE_SOURCE_NOT_ADMITTED',
  'RECOMMENDATION_SOURCE_STALE',
  'PERSISTENCE_UNAVAILABLE',
  'DEPENDENCY_UNAVAILABLE'
] as const;
export type EvidenceLifecycleErrorCode = (typeof evidenceLifecycleErrorCodes)[number];

export interface EvidenceLifecycleOperationError {
  code: EvidenceLifecycleErrorCode;
  message: string;
  retryable: boolean;
  details?: Readonly<Record<string, unknown>>;
}

export interface EvidenceLifecycleAuthorityConsequences {
  evidenceReviewDecisionRecorded: boolean;
  reviewedSourceAdmitted: boolean;
  lifecycleProjectionCreated: boolean;
  recommendedActionCreated: boolean;
  providerReturnCertifiedAsOfficialTruth: false;
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
  recommendedActionExecutedAutomatically: false;
  aiAuthoritativeReviewDecision: false;
}

function evidenceLifecycleConsequences(
  internal: Pick<
    EvidenceLifecycleAuthorityConsequences,
    | 'evidenceReviewDecisionRecorded'
    | 'reviewedSourceAdmitted'
    | 'lifecycleProjectionCreated'
    | 'recommendedActionCreated'
  >
): Readonly<EvidenceLifecycleAuthorityConsequences> {
  return Object.freeze({
    ...internal,
    providerReturnCertifiedAsOfficialTruth: false,
    paymentCreated: false,
    invoiceCreated: false,
    professionalLegallyAppointedAutomatically: false,
    filingSubmitted: false,
    officialApplicationCreated: false,
    officialApplicationNumberReceived: false,
    trademarkOfficeAcceptance: false,
    trademarkOfficeContactedAsVerifiedTruth: false,
    formalMatterCompletedAutomatically: false,
    userCapabilityVerifiedAutomatically: false,
    recommendedActionExecutedAutomatically: false,
    aiAuthoritativeReviewDecision: false
  });
}

export const evidenceReviewAuthorityConsequences = evidenceLifecycleConsequences({
  evidenceReviewDecisionRecorded: true,
  reviewedSourceAdmitted: false,
  lifecycleProjectionCreated: false,
  recommendedActionCreated: false
});

export const reviewedSourceAdmissionAuthorityConsequences = evidenceLifecycleConsequences({
  evidenceReviewDecisionRecorded: true,
  reviewedSourceAdmitted: true,
  lifecycleProjectionCreated: false,
  recommendedActionCreated: false
});

export const lifecycleProjectionAuthorityConsequences = evidenceLifecycleConsequences({
  evidenceReviewDecisionRecorded: true,
  reviewedSourceAdmitted: true,
  lifecycleProjectionCreated: true,
  recommendedActionCreated: false
});

export const recommendedActionAuthorityConsequences = evidenceLifecycleConsequences({
  evidenceReviewDecisionRecorded: true,
  reviewedSourceAdmitted: true,
  lifecycleProjectionCreated: true,
  recommendedActionCreated: true
});

/** AI assistance boundary for M5. AI can assist, but cannot create protected truth. */
export const evidenceLifecycleAiAuthority = Object.freeze({
  maySummarizeEvidence: true,
  mayHighlightInconsistencies: true,
  mayDraftReviewNotes: true,
  mayExplainLifecycleState: true,
  maySuggestRecommendedActionCandidates: true,
  mayRecordAuthoritativeReviewDecision: false,
  mayAdmitReviewedSource: false,
  mayExecuteRecommendedAction: false,
  maySubmitFiling: false,
  mayCreateOfficialTruth: false
});
