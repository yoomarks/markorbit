import type { Meta, StoryObj } from '@storybook/react';
import type {
  OpportunityCandidate,
  OpportunityQualificationDecision,
  PreparedActionJourney,
  ProductLoopUseFeedback,
  PublishPackage,
  TodayRecommendation
} from '@markorbit/contracts/product-loop';
import {
  TodayHttpError,
  type TodayClient,
  type TodayProductLoopSnapshot
} from '../../api/product-loop.js';
import type { WorkspaceInsightsClient } from '../../api/workspace-insights.js';
import { workspaceInsightsFixture } from '../insights/fixtures.js';
import { TodayWorkspace } from './TodayWorkspace.js';

const workspaceId = '25252525-2525-4252-8252-252525252525';
const source = {
  schemaVersion: 1 as const,
  owner: 'KNOWLEDGE' as const,
  kind: 'KNOWLEDGE_READY_PACKAGE' as const,
  sourceId: 'ready-package_us-renewal',
  sourceVersion: 7,
  sourceFingerprintSha256: 'a'.repeat(64),
  observedAt: '2026-08-11T08:00:00.000Z'
};
const recommendation: TodayRecommendation = {
  schemaVersion: 1,
  todayRecommendationId: 'today-recommendation_story',
  workspaceId,
  version: 1,
  kind: 'CONTENT_PREPARATION',
  title: 'Explain the US renewal window to this client segment',
  explanation:
    'A reviewed Knowledge package changed the recommended timing explanation and is ready for a professional content preparation step.',
  sources: [source],
  status: 'OPEN',
  recommendationFingerprintSha256: 'b'.repeat(64),
  executionAuthorized: false,
  createdAt: '2026-08-11T08:05:00.000Z',
  updatedAt: '2026-08-11T08:05:00.000Z'
};
const prepared: PreparedActionJourney = {
  schemaVersion: 1,
  preparedAction: {
    schemaVersion: 1,
    preparedActionId: 'prepared-action_story',
    workspaceId,
    version: 1,
    recommendation: { id: recommendation.todayRecommendationId, version: 1 },
    recommendationFingerprintSha256: recommendation.recommendationFingerprintSha256,
    kind: 'PREPARE_CONTENT',
    summary:
      'Prepare a bounded Lite content-preparation line for the reviewed renewal explanation.',
    confirmationEffect:
      'Create one Lite Content Opportunity from this exact Recommendation. No external publication, customer contact, Order, Matter or filing will occur.',
    handoffTarget: 'LITE_CONTENT_PREPARATION',
    sources: recommendation.sources,
    preparedActionFingerprintSha256: 'c'.repeat(64),
    confirmationRequired: true,
    executionAuthorized: false,
    createdAt: '2026-08-11T08:10:00.000Z',
    updatedAt: '2026-08-11T08:10:00.000Z'
  },
  handoffState: 'AWAITING_CONFIRMATION'
};
const completed: PreparedActionJourney = {
  ...prepared,
  confirmation: {
    schemaVersion: 1,
    preparedAction: { id: prepared.preparedAction.preparedActionId, version: 1 },
    expectedPreparedActionFingerprintSha256:
      prepared.preparedAction.preparedActionFingerprintSha256,
    confirmedByPrincipalId: '11111111-1111-4111-8111-111111111111',
    confirmedAt: '2026-08-11T08:12:00.000Z',
    acknowledgedEffect: prepared.preparedAction.confirmationEffect,
    protectedActionAuthorized: false
  },
  handoffState: 'HANDOFF_COMPLETED',
  handoffResult: {
    schemaVersion: 1,
    preparedAction: { id: prepared.preparedAction.preparedActionId, version: 1 },
    target: 'LITE_CONTENT_PREPARATION',
    owner: 'LITE',
    ownerRecord: { id: 'content-opportunity_story', version: 1 },
    completedAt: '2026-08-11T08:12:01.000Z',
    consequences: {
      externalPublishExecuted: false,
      customerContactedAutomatically: false,
      formalOpportunityCreatedAutomatically: false,
      orderCreatedAutomatically: false,
      matterCreatedAutomatically: false,
      paymentCreated: false,
      providerAppointed: false,
      filingSubmitted: false,
      officialTruthCreated: false
    }
  }
};
const opportunitySource = {
  schemaVersion: 1 as const,
  owner: 'LITE' as const,
  kind: 'OPPORTUNITY_CANDIDATE' as const,
  sourceId: 'opportunity-candidate_story',
  sourceVersion: 1,
  sourceFingerprintSha256: 'f'.repeat(64),
  observedAt: '2026-08-11T08:20:00.000Z'
};
const opportunityRecommendation: TodayRecommendation = {
  schemaVersion: 1,
  todayRecommendationId: 'today-recommendation_opportunity-story',
  workspaceId,
  version: 1,
  kind: 'OPPORTUNITY_REVIEW',
  title: 'Review qualified Canada filing service need',
  explanation:
    'A human Qualification Decision marked this exact Candidate QUALIFIED_FOR_MARKREG. This is not customer instruction.',
  sources: [opportunitySource],
  status: 'OPEN',
  recommendationFingerprintSha256: '1'.repeat(64),
  executionAuthorized: false,
  createdAt: '2026-08-11T08:21:00.000Z',
  updatedAt: '2026-08-11T08:21:00.000Z'
};
const opportunityCandidate: OpportunityCandidate = {
  schemaVersion: 1,
  opportunityCandidateId: opportunitySource.sourceId,
  workspaceId,
  version: 2,
  kind: 'TRADEMARK_SERVICE',
  title: 'Canada filing service need',
  serviceNeedSummary: 'A reviewed Candidate may warrant a bounded MarkReg service opportunity.',
  sources: [source],
  status: 'DISPOSITIONED',
  opportunityCandidateFingerprintSha256: '2'.repeat(64),
  formalOpportunityCreated: false,
  customerContacted: false,
  createdAt: '2026-08-11T08:00:00.000Z',
  updatedAt: '2026-08-11T08:22:00.000Z'
};
const opportunityQualification: OpportunityQualificationDecision = {
  schemaVersion: 1,
  opportunityQualificationDecisionId: 'opportunity-qualification_story',
  workspaceId,
  version: 1,
  candidate: { id: opportunitySource.sourceId, version: 1 },
  expectedCandidateFingerprintSha256: opportunitySource.sourceFingerprintSha256,
  outcome: 'QUALIFIED_FOR_MARKREG',
  decidedByPrincipalId: 'principal_story-reviewer',
  rationale: 'A human reviewer confirmed this exact Candidate is suitable for MarkReg review.',
  decidedAt: '2026-08-11T08:22:00.000Z',
  formalOpportunityCreated: false,
  customerContacted: false
};
const opportunityPrepared: PreparedActionJourney = {
  schemaVersion: 1,
  preparedAction: {
    schemaVersion: 1,
    preparedActionId: 'prepared-action_opportunity-story',
    workspaceId,
    version: 1,
    recommendation: { id: opportunityRecommendation.todayRecommendationId, version: 1 },
    recommendationFingerprintSha256:
      opportunityRecommendation.recommendationFingerprintSha256,
    kind: 'CREATE_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
    summary: 'Prepare one exact qualified Candidate for explicit MarkReg opportunity creation.',
    confirmationEffect:
      'Create one MarkReg Formal Trademark Service Opportunity from this exact qualified Candidate using the selected relationship model. No Intake, Order, Matter, payment, filing or customer contact will occur.',
    handoffTarget: 'MARKREG_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
    sources: opportunityRecommendation.sources,
    preparedActionFingerprintSha256: '3'.repeat(64),
    confirmationRequired: true,
    executionAuthorized: false,
    createdAt: '2026-08-11T08:23:00.000Z',
    updatedAt: '2026-08-11T08:23:00.000Z'
  },
  handoffState: 'AWAITING_CONFIRMATION'
};

const publishPackage: PublishPackage = {
  schemaVersion: 1,
  publishPackageId: 'publish-package_story',
  workspaceId,
  version: 1,
  contentDraft: { id: 'content-draft_story', version: 2 },
  contentDraftFingerprintSha256: 'e'.repeat(64),
  reviewDecision: { id: 'content-review-decision_story', version: 1 },
  title: 'US renewal window explainer',
  body: 'Reviewed content ready for manual external use.',
  publishPackageFingerprintSha256: 'd'.repeat(64),
  status: 'PREPARED',
  externalPublishExecuted: false,
  createdAt: '2026-08-11T08:13:00.000Z'
};
const feedback: ProductLoopUseFeedback = {
  schemaVersion: 1,
  productLoopFeedbackId: 'product-loop-feedback_story',
  workspaceId,
  version: 1,
  publishPackage: { id: 'publish-package_story', version: 1 },
  outcome: 'USER_REPORTED_PUBLISHED',
  externalReference: 'https://example.test/manual-publication/renewal-window',
  recordedByPrincipalId: '11111111-1111-4111-8111-111111111111',
  recordedAt: '2026-08-11T08:14:00.000Z',
  externalActionExecutedByMarkOrbit: false,
  externalOutcomeVerifiedByMarkOrbit: false
};

function snapshot(
  actions: PreparedActionJourney[] = [],
  partial = false,
  recentFeedback: ProductLoopUseFeedback[] = [],
  feedbackPendingPackages: PublishPackage[] = []
): TodayProductLoopSnapshot {
  return {
    schemaVersion: 1,
    workspaceId,
    generatedAt: '2026-08-11T08:15:00.000Z',
    items: [{ recommendation, preparedActions: actions }],
    partial,
    warnings: partial ? ['Knowledge refresh is delayed; exact stored provenance is shown.'] : [],
    recentFeedback,
    feedbackPendingPackages
  };
}

function opportunitySnapshot(
  actions: PreparedActionJourney[] = []
): TodayProductLoopSnapshot {
  return {
    schemaVersion: 1,
    workspaceId,
    generatedAt: '2026-08-11T08:24:00.000Z',
    items: [{ recommendation: opportunityRecommendation, preparedActions: actions }],
    partial: false,
    warnings: [],
    recentFeedback: [],
    feedbackPendingPackages: []
  };
}

function clientFor(
  value: TodayProductLoopSnapshot,
  opportunityEvidence = {
    source: opportunitySource,
    candidate: opportunityCandidate,
    qualificationDecision: opportunityQualification
  }
): TodayClient {
  return {
    loadToday: () => Promise.resolve(value),
    loadPreparedAction: () => Promise.resolve(prepared),
    loadQualifiedOpportunityReview: () => Promise.resolve(opportunityEvidence),
    prepareContent: () => Promise.resolve(prepared),
    prepareQualifiedOpportunity: () => Promise.resolve(opportunityPrepared),
    confirm: () => Promise.resolve(completed),
    recordUseFeedback: (_publishPackage, outcome) => Promise.resolve({ ...feedback, outcome })
  };
}

const insightsClient: WorkspaceInsightsClient = {
  load: () => Promise.resolve(workspaceInsightsFixture(workspaceId))
};

export default {
  title: 'Products/Lite/Today real runtime',
  component: TodayWorkspace,
  args: { insightsClient },
  parameters: { layout: 'fullscreen', a11y: { disable: false } }
} satisfies Meta<typeof TodayWorkspace>;

type Story = StoryObj<typeof TodayWorkspace>;

export const RecommendationDetail: Story = {
  args: { workspaceId, client: clientFor(snapshot()) }
};
export const PreparedActionReview: Story = {
  args: { workspaceId, client: clientFor(snapshot([prepared])) }
};
export const HandoffSuccess: Story = {
  args: { workspaceId, client: clientFor(snapshot([completed])) }
};
export const FeedbackNeeded: Story = {
  args: { workspaceId, client: clientFor(snapshot([completed], false, [], [publishPackage])) }
};
export const FeedbackReturnedToToday: Story = {
  args: { workspaceId, client: clientFor(snapshot([completed], false, [feedback])) }
};
export const QualifiedOpportunityReview: Story = {
  args: { workspaceId, client: clientFor(opportunitySnapshot()) }
};
export const QualifiedOpportunityEvidenceUnavailable: Story = {
  args: {
    workspaceId,
    client: {
      ...clientFor(opportunitySnapshot()),
      loadQualifiedOpportunityReview: () =>
        Promise.reject(
          new TodayHttpError(
            409,
            'STALE_OPPORTUNITY_REVIEW',
            'The current Candidate or Qualification Decision no longer matches this Opportunity Review.'
          )
        )
    }
  }
};
export const QualifiedOpportunityPrepared: Story = {
  args: { workspaceId, client: clientFor(opportunitySnapshot([opportunityPrepared])) }
};
export const QualifiedOpportunityMobile390: Story = {
  args: { workspaceId, client: clientFor(opportunitySnapshot()) },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
      viewports: { mobile1: { name: '390px mobile', styles: { width: '390px', height: '844px' } } }
    }
  }
};

export const PartialContext: Story = {
  args: { workspaceId, client: clientFor(snapshot([], true)) }
};
export const Empty: Story = {
  args: {
    workspaceId,
    client: clientFor({ ...snapshot(), items: [] })
  }
};
export const PermissionDenied: Story = {
  args: {
    workspaceId,
    client: {
      ...clientFor(snapshot()),
      loadToday: () =>
        Promise.reject(
          new TodayHttpError(403, 'PERMISSION_DENIED', 'workspace:read permission is required.')
        )
    }
  }
};
export const DependencyError: Story = {
  args: {
    workspaceId,
    client: {
      ...clientFor(snapshot()),
      loadToday: () =>
        Promise.reject(
          new TodayHttpError(
            503,
            'DOWNSTREAM_UNAVAILABLE',
            'Lite Today is temporarily unavailable.'
          )
        )
    }
  }
};
export const Mobile390: Story = {
  args: {
    workspaceId,
    client: clientFor(snapshot([prepared], false, [feedback], [publishPackage]))
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
      viewports: { mobile1: { name: '390px mobile', styles: { width: '390px', height: '844px' } } }
    }
  }
};
