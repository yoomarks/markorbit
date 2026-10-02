import type { Meta, StoryObj } from '@storybook/react';
import { SeedContextualWorkbench } from './SeedContextualWorkbench.js';
import {
  completedClientActionPreview,
  completedOpportunityPreview,
  contextualWorkbenchPreviewContext,
  pendingOpportunityPreview,
  preparedClientActionPreview,
  preparedOpportunityPreview
} from './seed-contextual-workbench-fixture.js';

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
    context: contextualWorkbenchPreviewContext,
    structuredReviewHref: '/seed-review?packageId=fixture-only'
  }
};

export const OpportunityReview: Story = {
  args: {
    task: 'OPPORTUNITY_REVIEW',
    context: contextualWorkbenchPreviewContext,
    onPrepare: () => Promise.resolve(preparedOpportunityPreview),
    onConfirm: () => Promise.resolve(completedOpportunityPreview),
    receiptHref: '#fixture-opportunity-receipt'
  }
};

export const ClientActionDraft: Story = {
  args: {
    task: 'CLIENT_ACTION_DRAFT',
    context: contextualWorkbenchPreviewContext,
    onPrepare: () => Promise.resolve(preparedClientActionPreview),
    onConfirm: () => Promise.resolve(completedClientActionPreview),
    receiptHref: '#fixture-client-action-receipt'
  }
};

export const PreparedAwaitingConfirmation: Story = {
  args: {
    task: 'OPPORTUNITY_REVIEW',
    context: contextualWorkbenchPreviewContext,
    initialJourney: preparedOpportunityPreview,
    onConfirm: () => Promise.resolve(completedOpportunityPreview)
  }
};

export const HandoffPending: Story = {
  args: {
    task: 'OPPORTUNITY_REVIEW',
    context: contextualWorkbenchPreviewContext,
    initialJourney: pendingOpportunityPreview,
    onConfirm: () => Promise.resolve(completedOpportunityPreview)
  }
};

export const CommittedResult: Story = {
  args: {
    task: 'OPPORTUNITY_REVIEW',
    context: contextualWorkbenchPreviewContext,
    initialJourney: completedOpportunityPreview,
    receiptHref: '#fixture-opportunity-receipt'
  }
};

export const Loading: Story = {
  args: { task: 'OPPORTUNITY_REVIEW', context: contextualWorkbenchPreviewContext, state: 'loading' }
};

export const Empty: Story = {
  args: { task: 'OPPORTUNITY_REVIEW', context: contextualWorkbenchPreviewContext, state: 'empty' }
};

export const Error: Story = {
  args: { task: 'OPPORTUNITY_REVIEW', context: contextualWorkbenchPreviewContext, state: 'error' }
};

export const Permission: Story = {
  args: {
    task: 'OPPORTUNITY_REVIEW',
    context: contextualWorkbenchPreviewContext,
    state: 'permission'
  }
};

export const Partial: Story = {
  args: {
    task: 'OPPORTUNITY_REVIEW',
    context: contextualWorkbenchPreviewContext,
    state: 'partial',
    onPrepare: () => Promise.resolve(preparedOpportunityPreview),
    onConfirm: () => Promise.resolve(completedOpportunityPreview)
  }
};

export const Mobile390: Story = {
  args: {
    task: 'CLIENT_ACTION_DRAFT',
    context: contextualWorkbenchPreviewContext,
    onPrepare: () => Promise.resolve(preparedClientActionPreview),
    onConfirm: () => Promise.resolve(completedClientActionPreview)
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
