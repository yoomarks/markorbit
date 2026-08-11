import { describe, expect, it } from 'vitest';
import type { RecommendedAction } from '../src/evidence-lifecycle.js';
import {
  contentDraftStatuses,
  contentOpportunityStatuses,
  contentReviewOutcomes,
  noAutomaticProductLoopConsequences,
  opportunityCandidateStatuses,
  opportunityQualificationOutcomes,
  preparedActionKinds,
  productLoopAiAuthority,
  productLoopErrorCodes,
  productLoopFeedbackOutcomes,
  productLoopHandoffTargets,
  productLoopSourceKinds,
  productLoopSourceOwners,
  todayRecommendationKinds,
  todayRecommendationStatuses,
  type ContentDraft,
  type ContentOpportunity,
  type ContentReviewDecision,
  type FormalTrademarkServiceOpportunity,
  type MarkRegIntakeHandoff,
  type OpportunityCandidate,
  type OpportunityQualificationDecision,
  type PreparedAction,
  type ProductLoopUseFeedback,
  type PublishPackage,
  type TodayRecommendation
} from '../src/product-loop.js';

const shaA = 'a'.repeat(64);
const shaB = 'b'.repeat(64);
const workspaceId = 'workspace_plc-01';
const correlationId = 'correlation_plc-01' as const;
const principalId = 'principal_plc-reviewer' as const;

const source = {
  schemaVersion: 1,
  owner: 'KNOWLEDGE',
  kind: 'KNOWLEDGE_READY_PACKAGE',
  sourceId: 'rdp_contract-01',
  sourceVersion: '1.0',
  sourceFingerprintSha256: shaA,
  observedAt: '2026-08-11T07:45:00.000Z',
  correlationId
} as const;

const recommendation = {
  schemaVersion: 1,
  todayRecommendationId: 'today-recommendation_contract-01',
  workspaceId,
  version: 1,
  kind: 'CONTENT_PREPARATION',
  title: 'Prepare a client-relevant trademark update',
  explanation: 'A governed ReadyPackage contains a change relevant to the current Workspace.',
  sources: [source],
  status: 'OPEN',
  recommendationFingerprintSha256: shaB,
  executionAuthorized: false,
  createdAt: '2026-08-11T07:46:00.000Z',
  updatedAt: '2026-08-11T07:46:00.000Z'
} as const satisfies TodayRecommendation;

const preparedAction = {
  schemaVersion: 1,
  preparedActionId: 'prepared-action_contract-01',
  workspaceId,
  version: 1,
  recommendation: { id: recommendation.todayRecommendationId, version: recommendation.version },
  recommendationFingerprintSha256: recommendation.recommendationFingerprintSha256,
  kind: 'PREPARE_CONTENT',
  summary: 'Prepare a bounded content draft for human review.',
  confirmationEffect: 'Creates only Lite-owned preparation state.',
  handoffTarget: 'LITE_CONTENT_PREPARATION',
  sources: [source],
  preparedActionFingerprintSha256: shaA,
  confirmationRequired: true,
  executionAuthorized: false,
  createdAt: '2026-08-11T07:47:00.000Z',
  updatedAt: '2026-08-11T07:47:00.000Z'
} as const satisfies PreparedAction;

const contentOpportunity = {
  schemaVersion: 1,
  contentOpportunityId: 'content-opportunity_contract-01',
  workspaceId,
  version: 1,
  sourceRecommendation: {
    id: recommendation.todayRecommendationId,
    version: recommendation.version
  },
  sources: [source],
  title: 'Client-facing update opportunity',
  rationale: 'The source is useful enough to prepare content but does not authorize publication.',
  status: 'ACCEPTED_FOR_PREPARATION',
  contentOpportunityFingerprintSha256: shaA,
  publishAuthorized: false,
  formalBusinessOpportunityCreated: false,
  createdAt: '2026-08-11T07:48:00.000Z',
  updatedAt: '2026-08-11T07:48:00.000Z'
} as const satisfies ContentOpportunity;

const draft = {
  schemaVersion: 1,
  contentDraftId: 'content-draft_contract-01',
  workspaceId,
  version: 2,
  contentOpportunity: { id: contentOpportunity.contentOpportunityId, version: 1 },
  sources: [source],
  title: 'Trademark update',
  body: 'Prepared content body.',
  status: 'READY_FOR_HUMAN_REVIEW',
  contentDraftFingerprintSha256: shaB,
  humanReviewRequired: true,
  published: false,
  createdAt: '2026-08-11T07:49:00.000Z',
  updatedAt: '2026-08-11T07:50:00.000Z'
} as const satisfies ContentDraft;

const review = {
  schemaVersion: 1,
  contentReviewDecisionId: 'content-review-decision_contract-01',
  workspaceId,
  version: 1,
  contentDraft: { id: draft.contentDraftId, version: draft.version },
  expectedContentDraftFingerprintSha256: draft.contentDraftFingerprintSha256,
  outcome: 'APPROVED_FOR_PUBLISH_PACKAGE',
  reviewerPrincipalId: principalId,
  rationale: 'Approved for package preparation only.',
  reviewedAt: '2026-08-11T07:51:00.000Z',
  publishesExternally: false
} as const satisfies ContentReviewDecision;

const publishPackage = {
  schemaVersion: 1,
  publishPackageId: 'publish-package_contract-01',
  workspaceId,
  version: 1,
  contentDraft: { id: draft.contentDraftId, version: draft.version },
  contentDraftFingerprintSha256: draft.contentDraftFingerprintSha256,
  reviewDecision: { id: review.contentReviewDecisionId, version: review.version },
  title: draft.title,
  body: draft.body,
  publishPackageFingerprintSha256: shaA,
  status: 'PREPARED',
  externalPublishExecuted: false,
  createdAt: '2026-08-11T07:52:00.000Z'
} as const satisfies PublishPackage;

const candidate = {
  schemaVersion: 1,
  opportunityCandidateId: 'opportunity-candidate_contract-01',
  workspaceId,
  version: 1,
  kind: 'TRADEMARK_SERVICE',
  customerId: 'customer_contract-01',
  title: 'Potential Canada filing need',
  serviceNeedSummary: 'A user-reported content interaction suggests a possible Canada filing need.',
  sources: [source],
  status: 'UNDER_REVIEW',
  opportunityCandidateFingerprintSha256: shaB,
  formalOpportunityCreated: false,
  customerContacted: false,
  createdAt: '2026-08-11T07:53:00.000Z',
  updatedAt: '2026-08-11T07:53:00.000Z'
} as const satisfies OpportunityCandidate;

const qualification = {
  schemaVersion: 1,
  opportunityQualificationDecisionId: 'opportunity-qualification_contract-01',
  workspaceId,
  version: 1,
  candidate: { id: candidate.opportunityCandidateId, version: candidate.version },
  expectedCandidateFingerprintSha256: candidate.opportunityCandidateFingerprintSha256,
  outcome: 'QUALIFIED_FOR_MARKREG',
  decidedByPrincipalId: principalId,
  rationale: 'Relevant enough to create a formal MarkReg trademark-service opportunity.',
  decidedAt: '2026-08-11T07:54:00.000Z',
  formalOpportunityCreated: false,
  customerContacted: false
} as const satisfies OpportunityQualificationDecision;

const formalOpportunity = {
  schemaVersion: 1,
  formalTrademarkServiceOpportunityId: 'trademark-service-opportunity_contract-01',
  workspaceId,
  version: 1,
  owningService: 'MARKREG',
  sourceCandidate: { id: candidate.opportunityCandidateId, version: candidate.version },
  sourceQualificationDecision: {
    id: qualification.opportunityQualificationDecisionId,
    version: qualification.version
  },
  customerId: candidate.customerId,
  serviceNeedSummary: candidate.serviceNeedSummary,
  relationshipModel: 'DIRECT',
  status: 'QUALIFIED',
  formalOpportunityFingerprintSha256: shaA,
  orderCreated: false,
  matterCreated: false,
  paymentCreated: false,
  filingSubmitted: false,
  customerContactedByCreation: false,
  createdAt: '2026-08-11T07:55:00.000Z',
  updatedAt: '2026-08-11T07:55:00.000Z'
} as const satisfies FormalTrademarkServiceOpportunity;

describe('PLC-WP-01 Product loop contract', () => {
  it('locks the Today-driven Product vocabulary without protected-action shortcut states', () => {
    expect(todayRecommendationKinds).toEqual([
      'CONTENT_PREPARATION',
      'OPPORTUNITY_REVIEW',
      'MARKREG_HANDOFF',
      'WORK_FOLLOW_UP'
    ]);
    expect(todayRecommendationStatuses).toEqual(['OPEN', 'ACKNOWLEDGED', 'DISMISSED', 'SUPERSEDED']);
    expect(preparedActionKinds).toContain('START_MARKREG_INTAKE');
    expect(productLoopHandoffTargets).toEqual([
      'LITE_CONTENT_PREPARATION',
      'MARKREG_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
      'MARKREG_INTAKE'
    ]);
    expect(productLoopSourceOwners).toContain('KNOWLEDGE');
    expect(productLoopSourceKinds).toContain('KNOWLEDGE_READY_PACKAGE');

    const vocabulary = [
      ...todayRecommendationStatuses,
      ...contentOpportunityStatuses,
      ...contentDraftStatuses,
      ...opportunityCandidateStatuses
    ];
    for (const state of ['PUBLISHED', 'CONTACTED', 'ORDERED', 'FILED', 'PAID', 'APPOINTED'])
      expect(vocabulary).not.toContain(state);
  });

  it('keeps a Today Recommendation broader than lifecycle-specific MarkReg RecommendedAction', () => {
    expect(recommendation.executionAuthorized).toBe(false);
    expect(recommendation.sources[0]?.kind).toBe('KNOWLEDGE_READY_PACKAGE');

    const lifecycleSpecific = {} as RecommendedAction;
    expect('formalMatter' in lifecycleSpecific).toBe(false);
    expect(recommendation).not.toHaveProperty('formalMatter');
    expect(recommendation).not.toHaveProperty('sourceLifecycleView');
  });

  it('separates preparation, human review, package creation and external publication', () => {
    expect(preparedAction.confirmationRequired).toBe(true);
    expect(preparedAction.executionAuthorized).toBe(false);
    expect(contentOpportunity.publishAuthorized).toBe(false);
    expect(draft.humanReviewRequired).toBe(true);
    expect(draft.published).toBe(false);
    expect(contentReviewOutcomes).toEqual([
      'APPROVED_FOR_PUBLISH_PACKAGE',
      'CHANGES_REQUIRED',
      'REJECTED'
    ]);
    expect(review.publishesExternally).toBe(false);
    expect(publishPackage.status).toBe('PREPARED');
    expect(publishPackage.externalPublishExecuted).toBe(false);
  });

  it('records manual use feedback without fabricating external execution or verification', () => {
    const feedback = {
      schemaVersion: 1,
      productLoopFeedbackId: 'product-loop-feedback_contract-01',
      workspaceId,
      version: 1,
      publishPackage: { id: publishPackage.publishPackageId, version: publishPackage.version },
      outcome: 'USER_REPORTED_PUBLISHED',
      externalReference: 'https://example.invalid/user-reported-post',
      recordedByPrincipalId: principalId,
      recordedAt: '2026-08-11T07:56:00.000Z',
      externalActionExecutedByMarkOrbit: false,
      externalOutcomeVerifiedByMarkOrbit: false
    } as const satisfies ProductLoopUseFeedback;

    expect(productLoopFeedbackOutcomes).toContain(feedback.outcome);
    expect(feedback.externalActionExecutedByMarkOrbit).toBe(false);
    expect(feedback.externalOutcomeVerifiedByMarkOrbit).toBe(false);
  });

  it('requires explicit qualification before a separate MarkReg-owned formal Opportunity', () => {
    expect(opportunityQualificationOutcomes).toEqual([
      'QUALIFIED_FOR_MARKREG',
      'REJECTED',
      'DEFERRED'
    ]);
    expect(candidate.formalOpportunityCreated).toBe(false);
    expect(qualification.formalOpportunityCreated).toBe(false);
    expect(formalOpportunity.owningService).toBe('MARKREG');
    expect(formalOpportunity.sourceCandidate.id).toBe(candidate.opportunityCandidateId);
    expect(formalOpportunity.sourceQualificationDecision.id).toBe(
      qualification.opportunityQualificationDecisionId
    );
    expect(formalOpportunity.orderCreated).toBe(false);
    expect(formalOpportunity.matterCreated).toBe(false);
  });

  it('prepares an explicit MarkReg intake handoff without creating the intake or downstream state', () => {
    const handoff = {
      schemaVersion: 1,
      workspaceId,
      formalOpportunity: {
        id: formalOpportunity.formalTrademarkServiceOpportunityId,
        version: formalOpportunity.version
      },
      expectedFormalOpportunityFingerprintSha256:
        formalOpportunity.formalOpportunityFingerprintSha256,
      target: 'MARKREG_INTAKE',
      channel: 'LITE_PROFESSIONAL',
      relationshipModel: formalOpportunity.relationshipModel,
      customerIntent: {
        brandName: 'NORTHWIND',
        applicantCountry: 'US',
        targetJurisdictions: ['CA'],
        goodsServicesDescription: 'Outdoor apparel and related retail services.'
      },
      confirmedByPrincipalId: principalId,
      confirmedAt: '2026-08-11T07:57:00.000Z',
      intakeCreated: false,
      orderCreated: false,
      matterCreated: false
    } as const satisfies MarkRegIntakeHandoff;

    expect(handoff.target).toBe('MARKREG_INTAKE');
    expect(handoff.channel).toBe('LITE_PROFESSIONAL');
    expect(handoff.intakeCreated).toBe(false);
    expect(handoff.orderCreated).toBe(false);
    expect(handoff.matterCreated).toBe(false);
  });

  it('keeps automatic authority consequences false and AI assistive only', () => {
    expect(Object.values(noAutomaticProductLoopConsequences).every((value) => value === false)).toBe(
      true
    );
    expect(productLoopAiAuthority.mayExplain).toBe(true);
    expect(productLoopAiAuthority.mayDraftContent).toBe(true);
    expect(productLoopAiAuthority.mayConfirmForUser).toBe(false);
    expect(productLoopAiAuthority.mayApproveContent).toBe(false);
    expect(productLoopAiAuthority.mayPublishExternally).toBe(false);
    expect(productLoopAiAuthority.mayQualifyOpportunity).toBe(false);
    expect(productLoopAiAuthority.mayCreateFormalOpportunity).toBe(false);
    expect(productLoopAiAuthority.mayExecuteProtectedAction).toBe(false);
  });

  it('freezes stale, review, authority, concurrency and dependency failures', () => {
    expect(productLoopErrorCodes).toEqual([
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
    ]);
  });
});
