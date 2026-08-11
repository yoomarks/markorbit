import type { Meta, StoryObj } from '@storybook/react';
import type {
  PreparedActionJourney,
  ProductLoopUseFeedback,
  TodayRecommendation
} from '@markorbit/contracts/product-loop';
import {
  TodayHttpError,
  type TodayClient,
  type TodayProductLoopSnapshot
} from '../../api/product-loop.js';
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
  recentFeedback: ProductLoopUseFeedback[] = []
): TodayProductLoopSnapshot {
  return {
    schemaVersion: 1,
    workspaceId,
    generatedAt: '2026-08-11T08:15:00.000Z',
    items: [{ recommendation, preparedActions: actions }],
    partial,
    warnings: partial ? ['Knowledge refresh is delayed; exact stored provenance is shown.'] : [],
    recentFeedback
  };
}

function clientFor(value: TodayProductLoopSnapshot): TodayClient {
  return {
    loadToday: () => Promise.resolve(value),
    loadPreparedAction: () => Promise.resolve(prepared),
    prepareContent: () => Promise.resolve(prepared),
    confirm: () => Promise.resolve(completed)
  };
}

export default {
  title: 'Products/Lite/Today real runtime',
  component: TodayWorkspace,
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
export const FeedbackReturnedToToday: Story = {
  args: { workspaceId, client: clientFor(snapshot([completed], false, [feedback])) }
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
  args: { workspaceId, client: clientFor(snapshot([prepared], false, [feedback])) },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
      viewports: { mobile1: { name: '390px mobile', styles: { width: '390px', height: '844px' } } }
    }
  }
};
