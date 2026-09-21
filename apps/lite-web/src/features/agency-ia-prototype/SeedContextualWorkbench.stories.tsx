import type { Meta, StoryObj } from '@storybook/react';
import type { PreparedActionJourney } from '@markorbit/contracts/product-loop';
import {
  SeedContextualWorkbench,
  type SeedWorkbenchContextBrief
} from './SeedContextualWorkbench.js';

const workspaceId = '30303030-3030-4030-8030-303030303030';
const now = '2026-09-21T12:00:00.000Z';

const context: SeedWorkbenchContextBrief = {
  contextId: 'seed-context_northstar',
  title: 'Northstar Robotics Ltd.',
  subtitle: 'Seed / Agency contextual workbench prototype',
  currentness: 'Prepared seed context refreshed 18 minutes ago.',
  evidence: [
    '18 historically represented trademarks',
    '46 related source records discovered',
    'One maintenance item worth professional review'
  ],
  authorityNote:
    'Historical representation, discovered records and conversation text do not establish a current Customer Relationship, managed asset or customer instruction.'
};

const preparedOpportunity = {
  schemaVersion: 1,
  preparedAction: {
    schemaVersion: 1,
    preparedActionId: 'prepared-action_workbench-opportunity',
    workspaceId,
    version: 1,
    recommendation: { id: 'today-recommendation_workbench-opportunity', version: 1 },
    recommendationFingerprintSha256: 'a'.repeat(64),
    kind: 'CREATE_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
    summary: 'Review one qualified trademark-service opportunity in MarkReg.',
    confirmationEffect:
      'Create one Formal Trademark Service Opportunity from the exact reviewed Candidate. No customer contact, order, matter, payment or filing will occur.',
    handoffTarget: 'MARKREG_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
    sources: [],
    preparedActionFingerprintSha256: 'b'.repeat(64),
    confirmationRequired: true,
    executionAuthorized: false,
    createdAt: now,
    updatedAt: now
  },
  handoffState: 'AWAITING_CONFIRMATION'
} as unknown as PreparedActionJourney;

const completedOpportunity = {
  ...preparedOpportunity,
  confirmation: {
    schemaVersion: 1,
    preparedAction: { id: preparedOpportunity.preparedAction.preparedActionId, version: 1 },
    expectedPreparedActionFingerprintSha256:
      preparedOpportunity.preparedAction.preparedActionFingerprintSha256,
    confirmedByPrincipalId: '11111111-1111-4111-8111-111111111111',
    confirmedAt: '2026-09-21T12:03:00.000Z',
    acknowledgedEffect: preparedOpportunity.preparedAction.confirmationEffect,
    protectedActionAuthorized: false
  },
  handoffState: 'HANDOFF_COMPLETED',
  handoffResult: {
    schemaVersion: 1,
    preparedAction: { id: preparedOpportunity.preparedAction.preparedActionId, version: 1 },
    target: 'MARKREG_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
    owner: 'MARKREG',
    ownerRecord: { id: 'trademark-service-opportunity_workbench', version: 1 },
    completedAt: '2026-09-21T12:03:01.000Z',
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
} as unknown as PreparedActionJourney;

const preparedClientAction = {
  schemaVersion: 1,
  preparedAction: {
    schemaVersion: 1,
    preparedActionId: 'prepared-action_workbench-client-update',
    workspaceId,
    version: 1,
    recommendation: { id: 'today-recommendation_workbench-client-update', version: 1 },
    recommendationFingerprintSha256: 'c'.repeat(64),
    kind: 'PREPARE_CONTENT',
    summary: 'Prepare a concise client update for human review.',
    confirmationEffect:
      'Create one reviewable content work package. Nothing will be sent, published or filed.',
    handoffTarget: 'LITE_CONTENT_PREPARATION',
    sources: [],
    preparedActionFingerprintSha256: 'd'.repeat(64),
    confirmationRequired: true,
    executionAuthorized: false,
    createdAt: now,
    updatedAt: now
  },
  handoffState: 'AWAITING_CONFIRMATION'
} as unknown as PreparedActionJourney;

const completedClientAction = {
  ...preparedClientAction,
  confirmation: {
    schemaVersion: 1,
    preparedAction: { id: preparedClientAction.preparedAction.preparedActionId, version: 1 },
    expectedPreparedActionFingerprintSha256:
      preparedClientAction.preparedAction.preparedActionFingerprintSha256,
    confirmedByPrincipalId: '11111111-1111-4111-8111-111111111111',
    confirmedAt: '2026-09-21T12:05:00.000Z',
    acknowledgedEffect: preparedClientAction.preparedAction.confirmationEffect,
    protectedActionAuthorized: false
  },
  handoffState: 'HANDOFF_COMPLETED',
  handoffResult: {
    schemaVersion: 1,
    preparedAction: { id: preparedClientAction.preparedAction.preparedActionId, version: 1 },
    target: 'LITE_CONTENT_PREPARATION',
    owner: 'LITE',
    ownerRecord: { id: 'content-opportunity_workbench', version: 1 },
    completedAt: '2026-09-21T12:05:01.000Z',
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
} as unknown as PreparedActionJourney;

const meta = {
  title: 'Lite/Agency IA Prototype/Seed Contextual Workbench',
  component: SeedContextualWorkbench,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ padding: 24 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof SeedContextualWorkbench>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SeedCustomerReview: Story = {
  args: {
    task: 'SEED_CUSTOMER_REVIEW',
    context,
    structuredReviewHref: '/seed-review?packageId=fixture-only'
  }
};

export const OpportunityReview: Story = {
  args: {
    task: 'OPPORTUNITY_REVIEW',
    context,
    onPrepare: () => Promise.resolve(preparedOpportunity),
    onConfirm: () => Promise.resolve(completedOpportunity),
    receiptHref: '#fixture-opportunity-receipt'
  }
};

export const ClientActionDraft: Story = {
  args: {
    task: 'CLIENT_ACTION_DRAFT',
    context,
    onPrepare: () => Promise.resolve(preparedClientAction),
    onConfirm: () => Promise.resolve(completedClientAction),
    receiptHref: '#fixture-client-action-receipt'
  }
};

export const PreparedAwaitingConfirmation: Story = {
  args: {
    task: 'OPPORTUNITY_REVIEW',
    context,
    initialJourney: preparedOpportunity,
    onConfirm: () => Promise.resolve(completedOpportunity)
  }
};

export const CommittedResult: Story = {
  args: {
    task: 'OPPORTUNITY_REVIEW',
    context,
    initialJourney: completedOpportunity,
    receiptHref: '#fixture-opportunity-receipt'
  }
};

export const Loading: Story = {
  args: { task: 'OPPORTUNITY_REVIEW', context, state: 'loading' }
};

export const Empty: Story = {
  args: { task: 'OPPORTUNITY_REVIEW', context, state: 'empty' }
};

export const Error: Story = {
  args: { task: 'OPPORTUNITY_REVIEW', context, state: 'error' }
};

export const Permission: Story = {
  args: { task: 'OPPORTUNITY_REVIEW', context, state: 'permission' }
};

export const Partial: Story = {
  args: {
    task: 'OPPORTUNITY_REVIEW',
    context,
    state: 'partial',
    onPrepare: () => Promise.resolve(preparedOpportunity),
    onConfirm: () => Promise.resolve(completedOpportunity)
  }
};

export const Mobile390: Story = {
  args: {
    task: 'CLIENT_ACTION_DRAFT',
    context,
    onPrepare: () => Promise.resolve(preparedClientAction),
    onConfirm: () => Promise.resolve(completedClientAction)
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile390',
      viewports: {
        mobile390: {
          name: '390px mobile',
          styles: { width: '390px', height: '844px' }
        }
      }
    }
  }
};
