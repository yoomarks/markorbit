import type { ProductLoopExactReference } from './product-loop.js';
import type {
  TrademarkAssetFreshnessState,
  TrademarkAssetId,
  TrademarkAssetRelation,
  TrademarkAssetSourceReference
} from './trademark-asset-workspace.js';

export type TrademarkAssetManagementSignalId = `trademark-asset-management-signal_${string}`;
export type TrademarkAssetManagementRecommendationId =
  `trademark-asset-management-recommendation_${string}`;
export type TrademarkAssetManagementDispositionId =
  `trademark-asset-management-disposition_${string}`;
export type TrademarkAssetManagementHandoffId = `trademark-asset-management-handoff_${string}`;

export const trademarkAssetManagementChangeKinds = [
  'OBSERVATION_ADDED',
  'OBSERVATION_REMOVED',
  'OBSERVATION_CHANGED',
  'FRESHNESS_CHANGED',
  'CONFLICT_INTRODUCED',
  'CONFLICT_RESOLVED_BY_SOURCE',
  'OWNER_LIFECYCLE_CHANGED',
  'KNOWLEDGE_RELEVANCE_CHANGED',
  'WORKSPACE_PRIORITY_CHANGED'
] as const;
export type TrademarkAssetManagementChangeKind =
  (typeof trademarkAssetManagementChangeKinds)[number];

export interface TrademarkAssetManagementChangeReference {
  kind: TrademarkAssetManagementChangeKind;
  sourceReferences: ReadonlyArray<Readonly<TrademarkAssetSourceReference>>;
  previousSourceVersion?: string;
  currentSourceVersion?: string;
  observedAt: string;
  freshness: TrademarkAssetFreshnessState;
}

export const trademarkAssetManagementSignalDimensions = [
  'OBSERVED_DATE_PROXIMITY',
  'SOURCE_FRESHNESS',
  'MISSING_CONSEQUENTIAL_CONTEXT',
  'SOURCE_CONFLICT',
  'LIFECYCLE_RELEVANCE',
  'KNOWLEDGE_CHANGE_RELEVANCE',
  'USER_PRIORITY',
  'PORTFOLIO_PATTERN'
] as const;
export type TrademarkAssetManagementSignalDimension =
  (typeof trademarkAssetManagementSignalDimensions)[number];

export const trademarkAssetManagementSignalSeverities = [
  'INFO',
  'NOTICE',
  'IMPORTANT',
  'URGENT'
] as const;
export type TrademarkAssetManagementSignalSeverity =
  (typeof trademarkAssetManagementSignalSeverities)[number];

/**
 * Product-owned explanation for why an Asset may deserve management attention.
 * A Management Signal is derived from source-owned observations and remains explicitly
 * separate from official registry truth, certified legal deadlines and protected execution.
 */
export interface TrademarkAssetManagementSignal {
  schemaVersion: 1;
  managementSignalId: TrademarkAssetManagementSignalId;
  workspaceId: string;
  version: number;
  asset: Readonly<ProductLoopExactReference<TrademarkAssetId>>;
  dimension: TrademarkAssetManagementSignalDimension;
  severity: TrademarkAssetManagementSignalSeverity;
  reason: string;
  changes: ReadonlyArray<Readonly<TrademarkAssetManagementChangeReference>>;
  evidence: ReadonlyArray<Readonly<TrademarkAssetSourceReference>>;
  freshness: TrademarkAssetFreshnessState;
  generatedAt: string;
  legalDeadlineCertified: false;
  officialStatusVerifiedByLite: false;
  legalConclusionVerified: false;
  conflictResolvedByLite: false;
  executionAuthorized: false;
}

export const trademarkAssetManagementRecommendationKinds = [
  'VERIFY_SOURCE_OR_DEADLINE',
  'GATHER_MISSING_INFORMATION',
  'REVIEW_LIFECYCLE_RECOMMENDATION',
  'PREPARE_OWNER_WORK_CANDIDATE',
  'PREPARE_TODAY_CANDIDATE',
  'PREPARE_CONTENT_CANDIDATE',
  'WATCH',
  'DEFER',
  'DISMISS'
] as const;
export type TrademarkAssetManagementRecommendationKind =
  (typeof trademarkAssetManagementRecommendationKinds)[number];

/**
 * Reviewable Product recommendation only. It may prepare a candidate for an existing
 * governed surface, but it cannot itself create owner-domain truth or authorize consequence.
 */
export interface TrademarkAssetManagementRecommendation {
  schemaVersion: 1;
  recommendationId: TrademarkAssetManagementRecommendationId;
  workspaceId: string;
  version: number;
  asset: Readonly<ProductLoopExactReference<TrademarkAssetId>>;
  signalReferences: ReadonlyArray<
    Readonly<ProductLoopExactReference<TrademarkAssetManagementSignalId>>
  >;
  kind: TrademarkAssetManagementRecommendationKind;
  title: string;
  explanation: string;
  evidence: ReadonlyArray<Readonly<TrademarkAssetSourceReference>>;
  relatedOwnerReferences: ReadonlyArray<Readonly<TrademarkAssetRelation>>;
  staleOrConflictingEvidencePresent: boolean;
  userConfirmationRequired: true;
  officialTruthVerified: false;
  legalDeadlineCertified: false;
  filingAuthorized: false;
  customerOrProviderContactAuthorized: false;
  externalPublicationAuthorized: false;
  paidExecutionAuthorized: false;
  capabilityVerified: false;
  createdAt: string;
}

export const trademarkAssetManagementDispositionKinds = [
  'WATCHED',
  'DEFERRED',
  'DISMISSED',
  'CONTINUED',
  'RESOLVED_BY_WORKFLOW_REFERENCE'
] as const;
export type TrademarkAssetManagementDispositionKind =
  (typeof trademarkAssetManagementDispositionKinds)[number];

export interface TrademarkAssetManagementDisposition {
  schemaVersion: 1;
  dispositionId: TrademarkAssetManagementDispositionId;
  workspaceId: string;
  version: number;
  asset: Readonly<ProductLoopExactReference<TrademarkAssetId>>;
  signal: Readonly<ProductLoopExactReference<TrademarkAssetManagementSignalId>>;
  recommendation?: Readonly<ProductLoopExactReference<TrademarkAssetManagementRecommendationId>>;
  kind: TrademarkAssetManagementDispositionKind;
  subjectUserId: string;
  note?: string;
  workflowReference?: Readonly<TrademarkAssetRelation>;
  recordedAt: string;
  officialTruthCreated: false;
  legalConclusionVerified: false;
  capabilityVerified: false;
}

export const trademarkAssetManagementHandoffDestinations = [
  'TODAY',
  'WORK',
  'MARKREG_MATTER',
  'ORDER_PREPARATION',
  'EXECUTION_REVIEW'
] as const;
export type TrademarkAssetManagementHandoffDestination =
  (typeof trademarkAssetManagementHandoffDestinations)[number];

/**
 * Exact, user-confirmed bridge into an existing governed owner/Product surface.
 * The handoff transports evidence and intent; it does not grant the destination authority.
 */
export interface TrademarkAssetManagementHandoff {
  schemaVersion: 1;
  handoffId: TrademarkAssetManagementHandoffId;
  workspaceId: string;
  version: number;
  asset: Readonly<ProductLoopExactReference<TrademarkAssetId>>;
  signal: Readonly<ProductLoopExactReference<TrademarkAssetManagementSignalId>>;
  recommendation: Readonly<ProductLoopExactReference<TrademarkAssetManagementRecommendationId>>;
  destination: TrademarkAssetManagementHandoffDestination;
  evidenceSnapshot: ReadonlyArray<Readonly<TrademarkAssetSourceReference>>;
  requestedByUserId: string;
  requestedAt: string;
  userConfirmed: true;
  protectedActionAuthorized: false;
  filingAuthorized: false;
  externalContactAuthorized: false;
  paymentAuthorized: false;
  publicationAuthorized: false;
}

export const trademarkAssetManagementAuthority = {
  mayDetectSourceOwnedChange: true,
  mayExplainManagementAttention: true,
  mayHighlightObservedDateProximity: true,
  maySurfaceConflictOrMissingContext: true,
  mayPrepareReviewableRecommendation: true,
  mayPersistPrivateDisposition: true,
  mayPrepareGovernedHandoffAfterUserConfirmation: true,
  mayCertifyLegalDeadline: false,
  mayVerifyOfficialStatus: false,
  mayCreateLegalConclusion: false,
  mayResolveSourceConflict: false,
  mayFileExternally: false,
  mayContactCustomerProviderOrAuthority: false,
  mayAuthorizePayment: false,
  mayPublishExternally: false,
  mayCreateVerifiedCapability: false,
  mayBypassOwnerDomainValidation: false,
  mayUseCrossServiceSql: false
} as const;

export const noAutomaticTrademarkAssetManagementConsequences = [
  'OFFICIAL_STATUS_VERIFICATION',
  'DEADLINE_CERTIFICATION',
  'LEGAL_CONCLUSION',
  'CONFLICT_RESOLUTION',
  'FILING_SUBMISSION',
  'CUSTOMER_PROVIDER_OR_AUTHORITY_CONTACT',
  'PAYMENT',
  'EXTERNAL_PUBLICATION',
  'PROFESSIONAL_REVIEW_APPROVAL',
  'CAPABILITY_VERIFICATION',
  'OWNER_DOMAIN_VALIDATION_BYPASS'
] as const;
