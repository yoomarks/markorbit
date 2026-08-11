import type { CustomerIntent, MarkOrbitId, RelationshipModel } from './index.js';

/**
 * PLC-WP-01 freezes the minimum Product-loop vocabulary needed to prove Lite's
 * Today -> Recommendation -> Prepared Action -> Confirmation -> Handoff path.
 *
 * These contracts describe candidate/preparation state and one bounded MarkReg
 * formal Opportunity boundary. They do not create runtime persistence, publish
 * externally, contact a customer, create an Order/Matter, appoint a provider or
 * submit a filing.
 */

export type TodayRecommendationId = `today-recommendation_${string}`;
export type PreparedActionId = `prepared-action_${string}`;
export type ContentOpportunityId = `content-opportunity_${string}`;
export type ContentDraftId = `content-draft_${string}`;
export type ContentReviewDecisionId = `content-review-decision_${string}`;
export type PublishPackageId = `publish-package_${string}`;
export type ProductLoopFeedbackId = `product-loop-feedback_${string}`;
export type OpportunityCandidateId = `opportunity-candidate_${string}`;
export type OpportunityQualificationDecisionId = `opportunity-qualification_${string}`;
export type FormalTrademarkServiceOpportunityId = `trademark-service-opportunity_${string}`;

export interface ProductLoopExactReference<TId extends string = string> {
  id: TId;
  version: number | string;
}

export const productLoopSourceOwners = [
  'CORE',
  'KNOWLEDGE',
  'LITE',
  'MARKREG',
  'EXECUTION',
  'MGSN'
] as const;
export type ProductLoopSourceOwner = (typeof productLoopSourceOwners)[number];

export const productLoopSourceKinds = [
  'KNOWLEDGE_READY_PACKAGE',
  'TRADEMARK_CONTEXT',
  'CUSTOMER_CONTEXT',
  'MARKREG_RECOMMENDED_ACTION',
  'MANUAL_WORK_SIGNAL',
  'CONTENT_USE_FEEDBACK'
] as const;
export type ProductLoopSourceKind = (typeof productLoopSourceKinds)[number];

/** Exact or equivalently stable provenance supplied by the owning boundary. */
export interface ProductLoopSourceReference {
  schemaVersion: 1;
  owner: ProductLoopSourceOwner;
  kind: ProductLoopSourceKind;
  sourceId: string;
  sourceVersion: number | string;
  sourceFingerprintSha256: string;
  observedAt: string;
  correlationId?: MarkOrbitId;
}

export const todayRecommendationKinds = [
  'CONTENT_PREPARATION',
  'OPPORTUNITY_REVIEW',
  'MARKREG_HANDOFF',
  'WORK_FOLLOW_UP'
] as const;
export type TodayRecommendationKind = (typeof todayRecommendationKinds)[number];

export const todayRecommendationStatuses = [
  'OPEN',
  'ACKNOWLEDGED',
  'DISMISSED',
  'SUPERSEDED'
] as const;
export type TodayRecommendationStatus = (typeof todayRecommendationStatuses)[number];

/**
 * Lite-owned Product recommendation. It is intentionally broader than the
 * lifecycle-specific MarkReg RecommendedAction contract, which requires a
 * Formal Matter/Lifecycle View and therefore cannot represent every Today item.
 */
export interface TodayRecommendation {
  schemaVersion: 1;
  todayRecommendationId: TodayRecommendationId;
  workspaceId: string;
  version: number;
  kind: TodayRecommendationKind;
  title: string;
  explanation: string;
  sources: ReadonlyArray<Readonly<ProductLoopSourceReference>>;
  status: TodayRecommendationStatus;
  recommendationFingerprintSha256: string;
  executionAuthorized: false;
  createdAt: string;
  updatedAt: string;
}

export const preparedActionKinds = [
  'PREPARE_CONTENT',
  'REVIEW_OPPORTUNITY',
  'CREATE_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
  'START_MARKREG_INTAKE'
] as const;
export type PreparedActionKind = (typeof preparedActionKinds)[number];

export const productLoopHandoffTargets = [
  'LITE_CONTENT_PREPARATION',
  'MARKREG_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
  'MARKREG_INTAKE'
] as const;
export type ProductLoopHandoffTarget = (typeof productLoopHandoffTargets)[number];

/** Reviewable Product intent before any owner mutation or protected action. */
export interface PreparedAction {
  schemaVersion: 1;
  preparedActionId: PreparedActionId;
  workspaceId: string;
  version: number;
  recommendation: Readonly<ProductLoopExactReference<TodayRecommendationId>>;
  recommendationFingerprintSha256: string;
  kind: PreparedActionKind;
  summary: string;
  confirmationEffect: string;
  handoffTarget: ProductLoopHandoffTarget;
  sources: ReadonlyArray<Readonly<ProductLoopSourceReference>>;
  preparedActionFingerprintSha256: string;
  confirmationRequired: true;
  executionAuthorized: false;
  createdAt: string;
  updatedAt: string;
}

export interface PreparedActionConfirmation {
  schemaVersion: 1;
  preparedAction: Readonly<ProductLoopExactReference<PreparedActionId>>;
  expectedPreparedActionFingerprintSha256: string;
  confirmedByPrincipalId: MarkOrbitId;
  confirmedAt: string;
  acknowledgedEffect: string;
  protectedActionAuthorized: false;
}

export const contentOpportunityStatuses = [
  'CANDIDATE',
  'ACCEPTED_FOR_PREPARATION',
  'REJECTED',
  'DEFERRED'
] as const;
export type ContentOpportunityStatus = (typeof contentOpportunityStatuses)[number];

/** Lite-owned candidate reason to prepare useful professional content. */
export interface ContentOpportunity {
  schemaVersion: 1;
  contentOpportunityId: ContentOpportunityId;
  workspaceId: string;
  version: number;
  sourceRecommendation: Readonly<ProductLoopExactReference<TodayRecommendationId>>;
  sources: ReadonlyArray<Readonly<ProductLoopSourceReference>>;
  title: string;
  rationale: string;
  status: ContentOpportunityStatus;
  contentOpportunityFingerprintSha256: string;
  publishAuthorized: false;
  formalBusinessOpportunityCreated: false;
  createdAt: string;
  updatedAt: string;
}

export const contentDraftStatuses = [
  'DRAFT',
  'READY_FOR_HUMAN_REVIEW',
  'REVIEWED_READY_FOR_PACKAGE',
  'CHANGES_REQUIRED',
  'REJECTED',
  'SUPERSEDED'
] as const;
export type ContentDraftStatus = (typeof contentDraftStatuses)[number];

/** Bounded Lite Product draft; this is not a universal Artifact model. */
export interface ContentDraft {
  schemaVersion: 1;
  contentDraftId: ContentDraftId;
  workspaceId: string;
  version: number;
  contentOpportunity: Readonly<ProductLoopExactReference<ContentOpportunityId>>;
  sources: ReadonlyArray<Readonly<ProductLoopSourceReference>>;
  title: string;
  body: string;
  status: ContentDraftStatus;
  contentDraftFingerprintSha256: string;
  humanReviewRequired: true;
  published: false;
  createdAt: string;
  updatedAt: string;
}

export const contentReviewOutcomes = [
  'APPROVED_FOR_PUBLISH_PACKAGE',
  'CHANGES_REQUIRED',
  'REJECTED'
] as const;
export type ContentReviewOutcome = (typeof contentReviewOutcomes)[number];

/** Human review permits package preparation only; it does not perform publication. */
export interface ContentReviewDecision {
  schemaVersion: 1;
  contentReviewDecisionId: ContentReviewDecisionId;
  workspaceId: string;
  version: number;
  contentDraft: Readonly<ProductLoopExactReference<ContentDraftId>>;
  expectedContentDraftFingerprintSha256: string;
  outcome: ContentReviewOutcome;
  reviewerPrincipalId: MarkOrbitId;
  rationale: string;
  reviewedAt: string;
  publishesExternally: false;
}

export interface PublishPackage {
  schemaVersion: 1;
  publishPackageId: PublishPackageId;
  workspaceId: string;
  version: number;
  contentDraft: Readonly<ProductLoopExactReference<ContentDraftId>>;
  contentDraftFingerprintSha256: string;
  reviewDecision: Readonly<ProductLoopExactReference<ContentReviewDecisionId>>;
  title: string;
  body: string;
  publishPackageFingerprintSha256: string;
  status: 'PREPARED';
  externalPublishExecuted: false;
  createdAt: string;
}

export const productLoopFeedbackOutcomes = [
  'USER_REPORTED_PUBLISHED',
  'USER_REPORTED_DELIVERED',
  'USER_REPORTED_USED',
  'NOT_USED'
] as const;
export type ProductLoopFeedbackOutcome = (typeof productLoopFeedbackOutcomes)[number];

/**
 * Manual after-the-fact feedback. MarkOrbit records the user's report; creating
 * this record never claims that MarkOrbit performed or independently verified
 * the external action.
 */
export interface ProductLoopUseFeedback {
  schemaVersion: 1;
  productLoopFeedbackId: ProductLoopFeedbackId;
  workspaceId: string;
  version: number;
  publishPackage: Readonly<ProductLoopExactReference<PublishPackageId>>;
  outcome: ProductLoopFeedbackOutcome;
  externalReference?: string;
  recordedByPrincipalId: MarkOrbitId;
  recordedAt: string;
  externalActionExecutedByMarkOrbit: false;
  externalOutcomeVerifiedByMarkOrbit: false;
}

export const opportunityCandidateStatuses = [
  'OPEN',
  'UNDER_REVIEW',
  'DISPOSITIONED'
] as const;
export type OpportunityCandidateStatus = (typeof opportunityCandidateStatuses)[number];

/** Lite-owned pre-qualification state; never a formal business Opportunity. */
export interface OpportunityCandidate {
  schemaVersion: 1;
  opportunityCandidateId: OpportunityCandidateId;
  workspaceId: string;
  version: number;
  kind: 'TRADEMARK_SERVICE';
  customerId?: MarkOrbitId;
  title: string;
  serviceNeedSummary: string;
  sources: ReadonlyArray<Readonly<ProductLoopSourceReference>>;
  status: OpportunityCandidateStatus;
  opportunityCandidateFingerprintSha256: string;
  formalOpportunityCreated: false;
  customerContacted: false;
  createdAt: string;
  updatedAt: string;
}

export const opportunityQualificationOutcomes = [
  'QUALIFIED_FOR_MARKREG',
  'REJECTED',
  'DEFERRED'
] as const;
export type OpportunityQualificationOutcome = (typeof opportunityQualificationOutcomes)[number];

/** Explicit human qualification; owner mutation is a separate step. */
export interface OpportunityQualificationDecision {
  schemaVersion: 1;
  opportunityQualificationDecisionId: OpportunityQualificationDecisionId;
  workspaceId: string;
  version: number;
  candidate: Readonly<ProductLoopExactReference<OpportunityCandidateId>>;
  expectedCandidateFingerprintSha256: string;
  outcome: OpportunityQualificationOutcome;
  decidedByPrincipalId: MarkOrbitId;
  rationale: string;
  decidedAt: string;
  formalOpportunityCreated: false;
  customerContacted: false;
}

/**
 * MarkReg-owned formal business record for the bounded trademark-service loop.
 * This does not establish a universal cross-Product Opportunity service.
 */
export interface FormalTrademarkServiceOpportunity {
  schemaVersion: 1;
  formalTrademarkServiceOpportunityId: FormalTrademarkServiceOpportunityId;
  workspaceId: string;
  version: number;
  owningService: 'MARKREG';
  sourceCandidate: Readonly<ProductLoopExactReference<OpportunityCandidateId>>;
  sourceQualificationDecision: Readonly<
    ProductLoopExactReference<OpportunityQualificationDecisionId>
  >;
  customerId?: MarkOrbitId;
  serviceNeedSummary: string;
  proposedCustomerIntent?: Readonly<CustomerIntent>;
  relationshipModel: RelationshipModel;
  status: 'QUALIFIED' | 'HANDED_OFF_TO_INTAKE' | 'CLOSED';
  intakeId?: MarkOrbitId;
  formalOpportunityFingerprintSha256: string;
  orderCreated: false;
  matterCreated: false;
  paymentCreated: false;
  filingSubmitted: false;
  customerContactedByCreation: false;
  createdAt: string;
  updatedAt: string;
}

/** Prepared handoff envelope; the existing MarkReg intake owner still creates Intake. */
export interface MarkRegIntakeHandoff {
  schemaVersion: 1;
  workspaceId: string;
  formalOpportunity: Readonly<
    ProductLoopExactReference<FormalTrademarkServiceOpportunityId>
  >;
  expectedFormalOpportunityFingerprintSha256: string;
  target: 'MARKREG_INTAKE';
  channel: 'LITE_PROFESSIONAL';
  relationshipModel: RelationshipModel;
  customerIntent: Readonly<CustomerIntent>;
  confirmedByPrincipalId: MarkOrbitId;
  confirmedAt: string;
  intakeCreated: false;
  orderCreated: false;
  matterCreated: false;
}

export interface ProductLoopAuthorityConsequences {
  externalPublishExecuted: false;
  customerContactedAutomatically: false;
  formalOpportunityCreatedAutomatically: false;
  orderCreatedAutomatically: false;
  matterCreatedAutomatically: false;
  paymentCreated: false;
  providerAppointed: false;
  filingSubmitted: false;
  officialTruthCreated: false;
}

export const noAutomaticProductLoopConsequences: ProductLoopAuthorityConsequences = Object.freeze({
  externalPublishExecuted: false,
  customerContactedAutomatically: false,
  formalOpportunityCreatedAutomatically: false,
  orderCreatedAutomatically: false,
  matterCreatedAutomatically: false,
  paymentCreated: false,
  providerAppointed: false,
  filingSubmitted: false,
  officialTruthCreated: false
});

export const productLoopAiAuthority = Object.freeze({
  mayExplain: true,
  mayRecommend: true,
  mayDraftContent: true,
  mayPrepareCandidate: true,
  mayConfirmForUser: false,
  mayApproveContent: false,
  mayPublishExternally: false,
  mayContactCustomer: false,
  mayQualifyOpportunity: false,
  mayCreateFormalOpportunity: false,
  mayCreateOrderOrMatter: false,
  mayExecuteProtectedAction: false
} as const);

export const productLoopErrorCodes = [
  'STALE_SOURCE',
  'SOURCE_VERSION_MISMATCH',
  'SOURCE_FINGERPRINT_MISMATCH',
  'PERMISSION_DENIED',
  'POLICY_DENIED',
  'CONFIRMATION_REQUIRED',
  'HUMAN_REVIEW_REQUIRED',
  'CANDIDATE_NOT_QUALIFIED',
  'IDEMPOTENCY_CONFLICT',
  'VERSION_CONFLICT',
  'PERSISTENCE_UNAVAILABLE',
  'DEPENDENCY_UNAVAILABLE'
] as const;
export type ProductLoopErrorCode = (typeof productLoopErrorCodes)[number];
