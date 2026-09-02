import type {
  ContentDraft,
  ContentOpportunity,
  ContentReviewDecision,
  ProductLoopSourceReference,
  ProductLoopUseFeedback,
  PublishPackage
} from '@markorbit/contracts/product-loop';
import type { VisualBrief, VisualOutputReference } from '@markorbit/contracts/daily-workspace';
import type {
  ContentStudioClient,
  ContentStudioWorkDetail,
  ContentStudioWorkList,
  ContentStudioWorkSummary,
  VisualBriefRecord
} from '../../api/content-studio.js';

export const fixtureWorkspaceId = '38383838-3838-4383-8383-383838383838';
const fingerprint = 'a'.repeat(64);
const at = '2026-08-31T09:00:00.000Z';
const source: ProductLoopSourceReference = {
  schemaVersion: 1,
  owner: 'KNOWLEDGE',
  kind: 'KNOWLEDGE_READY_PACKAGE',
  sourceId: 'knowledge-ready-package_413',
  sourceVersion: 2,
  sourceFingerprintSha256: fingerprint,
  observedAt: at
};

export const opportunity: ContentOpportunity = {
  schemaVersion: 1,
  contentOpportunityId: 'content-opportunity_413',
  workspaceId: fixtureWorkspaceId,
  version: 3,
  sourceRecommendation: { id: 'today-recommendation_413', version: 1 },
  sources: [source],
  title: 'Explain evidence-first trademark preparation',
  rationale: 'Practitioners repeatedly need a concise explanation of governed preparation.',
  status: 'ACCEPTED_FOR_PREPARATION',
  contentOpportunityFingerprintSha256: fingerprint,
  publishAuthorized: false,
  formalBusinessOpportunityCreated: false,
  createdAt: '2026-08-30T09:00:00.000Z',
  updatedAt: at
};

export const draft: ContentDraft = {
  schemaVersion: 1,
  contentDraftId: 'content-draft_413',
  workspaceId: fixtureWorkspaceId,
  version: 2,
  contentOpportunity: { id: opportunity.contentOpportunityId, version: opportunity.version },
  sources: [source],
  title: opportunity.title,
  body: 'A reviewed draft keeps source evidence, authority boundaries, and version lineage visible.',
  status: 'REVIEWED_READY_FOR_PACKAGE',
  contentDraftFingerprintSha256: fingerprint,
  humanReviewRequired: true,
  published: false,
  createdAt: at,
  updatedAt: '2026-08-31T10:00:00.000Z'
};

export const review: ContentReviewDecision = {
  schemaVersion: 1,
  contentReviewDecisionId: 'content-review-decision_413',
  workspaceId: fixtureWorkspaceId,
  version: 1,
  contentDraft: { id: draft.contentDraftId, version: draft.version },
  expectedContentDraftFingerprintSha256: fingerprint,
  outcome: 'APPROVED_FOR_PUBLISH_PACKAGE',
  reviewerPrincipalId: '11111111-1111-4111-8111-111111111111',
  rationale: 'The exact draft version is suitable for package preparation.',
  reviewedAt: '2026-08-31T11:00:00.000Z',
  publishesExternally: false
};

export const publishPackage: PublishPackage = {
  schemaVersion: 1,
  publishPackageId: 'publish-package_413',
  workspaceId: fixtureWorkspaceId,
  version: 1,
  contentDraft: { id: draft.contentDraftId, version: draft.version },
  contentDraftFingerprintSha256: fingerprint,
  reviewDecision: { id: review.contentReviewDecisionId, version: review.version },
  title: draft.title,
  body: draft.body,
  publishPackageFingerprintSha256: fingerprint,
  status: 'PREPARED',
  externalPublishExecuted: false,
  createdAt: '2026-08-31T12:00:00.000Z'
};

export const feedback: ProductLoopUseFeedback = {
  schemaVersion: 1,
  productLoopFeedbackId: 'product-loop-feedback_413',
  workspaceId: fixtureWorkspaceId,
  version: 1,
  publishPackage: { id: publishPackage.publishPackageId, version: publishPackage.version },
  outcome: 'USER_REPORTED_PUBLISHED',
  externalReference: 'user supplied reference',
  recordedByPrincipalId: '11111111-1111-4111-8111-111111111111',
  recordedAt: '2026-08-31T13:00:00.000Z',
  externalActionExecutedByMarkOrbit: false,
  externalOutcomeVerifiedByMarkOrbit: false
};

export const visualBrief: VisualBrief = {
  schemaVersion: 1,
  visualBriefId: 'visual-brief_413',
  workspaceId: fixtureWorkspaceId,
  version: 2,
  contentKit: { id: 'content-kit_413', version: 1 },
  title: 'Evidence-first preparation cover',
  keyMessage: 'Keep governed preparation and evidence visible.',
  audience: 'Trademark practitioners',
  outputKind: 'XIAOHONGSHU_COVER',
  aspectRatio: '3:4',
  styleIntent: 'Editorial blue-track note',
  requestedIpPackage: 'moki-editorial',
  sceneIntent: 'A structured evidence trail with a calm editorial focal point.',
  reuseFirstRequired: true,
  paidExecutionAuthorized: false,
  createdAt: '2026-08-31T14:00:00.000Z'
};

export const visualBriefRecord: VisualBriefRecord = {
  brief: visualBrief,
  visualBriefFingerprintSha256: 'b'.repeat(64),
  consumerIdentity: { ipId: 'moki-editorial', styleId: 'blue-track-note' }
};

export const visualOutput: VisualOutputReference = {
  schemaVersion: 1,
  visualOutputReferenceId: 'visual-output_413',
  workspaceId: fixtureWorkspaceId,
  version: 3,
  visualBrief: { id: visualBrief.visualBriefId, version: visualBrief.version },
  owner: 'VISUAL_ENGINE',
  requestReference: 'delivery://requests/visual-413',
  outputReference: 'library://visual-output-413',
  status: 'READY',
  qcStatus: 'PASS_WITH_WARNINGS',
  providerExecutionAuthorizedByLite: false,
  paidExecutionAuthorizedByLite: false,
  createdAt: '2026-08-31T15:00:00.000Z'
};

export const secondVisualBriefRecord: VisualBriefRecord = {
  brief: {
    ...visualBrief,
    visualBriefId: 'visual-brief_414',
    version: 1,
    title: 'Governed review social card',
    outputKind: 'MOMENTS_SOCIAL_CARD',
    aspectRatio: '1:1',
    sceneIntent: 'A review checkpoint separated from external publication.',
    createdAt: '2026-08-31T16:00:00.000Z'
  },
  visualBriefFingerprintSha256: 'c'.repeat(64),
  consumerIdentity: { ipId: 'moki-editorial', styleId: 'review-card' }
};

export const secondVisualOutput: VisualOutputReference = {
  schemaVersion: 1,
  visualOutputReferenceId: 'visual-output_414',
  workspaceId: fixtureWorkspaceId,
  version: 1,
  visualBrief: {
    id: secondVisualBriefRecord.brief.visualBriefId,
    version: secondVisualBriefRecord.brief.version
  },
  owner: 'VISUAL_ENGINE',
  requestReference: 'delivery://requests/visual-414',
  status: 'PLANNING_REQUIRED',
  providerExecutionAuthorizedByLite: false,
  paidExecutionAuthorizedByLite: false,
  createdAt: '2026-08-31T17:00:00.000Z'
};

export const alternateVisualOutput: VisualOutputReference = {
  ...visualOutput,
  visualOutputReferenceId: 'visual-output_413-alternate',
  version: 1,
  requestReference: 'delivery://requests/visual-413-alternate',
  outputReference: 'library://visual-output-413-alternate',
  status: 'REUSED_CERTIFIED_ASSET',
  qcStatus: 'PASS',
  createdAt: '2026-08-31T15:30:00.000Z'
};

export function detailFixture(
  options: {
    drafts?: ContentDraft[];
    reviewedDrafts?: ContentDraft[];
    reviews?: ContentReviewDecision[];
    packages?: PublishPackage[];
    feedback?: ProductLoopUseFeedback[];
    visualBriefs?: VisualBriefRecord[];
    visualOutputs?: VisualOutputReference[];
    partial?: boolean;
    warnings?: ContentStudioWorkDetail['warnings'];
  } = {}
): ContentStudioWorkDetail {
  return {
    schemaVersion: 1,
    workspaceId: fixtureWorkspaceId,
    opportunity,
    drafts: options.drafts ?? [draft],
    reviewedDrafts: options.reviewedDrafts ?? (options.reviews?.length === 0 ? [] : [draft]),
    reviews: options.reviews ?? [review],
    publishPackages: options.packages ?? [publishPackage],
    feedback: options.feedback ?? [feedback],
    visualBriefs: options.visualBriefs ?? [visualBriefRecord],
    visualOutputs: options.visualOutputs ?? [visualOutput],
    partial: options.partial ?? true,
    warnings: options.warnings ?? ['VISUAL_HISTORY_NOT_DISCOVERABLE']
  };
}

export function summaryFixture(
  overrides: Partial<ContentStudioWorkSummary> = {}
): ContentStudioWorkSummary {
  const packageSummary: Omit<PublishPackage, 'body'> = {
    schemaVersion: publishPackage.schemaVersion,
    publishPackageId: publishPackage.publishPackageId,
    workspaceId: publishPackage.workspaceId,
    version: publishPackage.version,
    contentDraft: publishPackage.contentDraft,
    contentDraftFingerprintSha256: publishPackage.contentDraftFingerprintSha256,
    reviewDecision: publishPackage.reviewDecision,
    title: publishPackage.title,
    publishPackageFingerprintSha256: publishPackage.publishPackageFingerprintSha256,
    status: publishPackage.status,
    externalPublishExecuted: publishPackage.externalPublishExecuted,
    createdAt: publishPackage.createdAt
  };
  return {
    contentOpportunity: { id: opportunity.contentOpportunityId, version: opportunity.version },
    title: opportunity.title,
    rationale: opportunity.rationale,
    sources: opportunity.sources,
    createdAt: opportunity.createdAt,
    updatedAt: opportunity.updatedAt,
    latestDraft: {
      contentDraftId: draft.contentDraftId,
      version: draft.version,
      status: draft.status,
      title: draft.title,
      updatedAt: draft.updatedAt
    },
    latestDraftReview: review,
    latestPublishPackage: packageSummary,
    latestPackageFeedback: feedback,
    visualBriefCount: 1,
    visualOutputCount: 1,
    ...overrides
  };
}

export function listFixture(
  items: ContentStudioWorkSummary[] = [summaryFixture()],
  nextAfter: string | null = null,
  coverage: Pick<ContentStudioWorkList, 'partial' | 'warnings'> = {
    partial: true,
    warnings: ['VISUAL_HISTORY_NOT_DISCOVERABLE']
  }
): ContentStudioWorkList {
  return {
    schemaVersion: 1,
    workspaceId: fixtureWorkspaceId,
    items,
    nextAfter,
    partial: coverage.partial,
    warnings: coverage.warnings
  };
}

export function fixtureClient(list = listFixture(), detail = detailFixture()): ContentStudioClient {
  return {
    list: () => Promise.resolve(list),
    find: () => Promise.resolve(detail),
    createDraft: (_opportunity, input) =>
      Promise.resolve({ ...draft, version: 1, status: 'DRAFT', ...input }),
    reviseDraft: (target, input) =>
      Promise.resolve({ ...target, version: target.version + 1, status: 'DRAFT', ...input }),
    markReadyForReview: (target) =>
      Promise.resolve({
        ...target,
        version: target.version + 1,
        status: 'READY_FOR_HUMAN_REVIEW'
      }),
    recordReview: (target, input) =>
      Promise.resolve({
        ...review,
        contentDraft: { id: target.contentDraftId, version: target.version },
        expectedContentDraftFingerprintSha256: target.contentDraftFingerprintSha256,
        ...input
      }),
    preparePublishPackage: (target, decision) =>
      Promise.resolve({
        ...publishPackage,
        contentDraft: { id: target.contentDraftId, version: target.version },
        reviewDecision: { id: decision.contentReviewDecisionId, version: decision.version }
      }),
    recordUseFeedback: (_publishPackage, outcome) => Promise.resolve({ ...feedback, outcome })
  };
}
