import type { Meta, StoryObj } from '@storybook/react';
import { LiteApp } from './App.js';
import { fixtureClient, fixtureWorkspaceId } from './features/content-studio/fixtures.js';
export default {
  title: 'Products/Lite workspace',
  component: LiteApp,
  parameters: { layout: 'fullscreen', a11y: { disable: false } }
} satisfies Meta<typeof LiteApp>;
type Story = StoryObj<typeof LiteApp>;
export const ContentEntry: Story = {
  args: {
    initialSurface: 'content',
    workspaceId: fixtureWorkspaceId,
    contentStudioClient: fixtureClient()
  }
};
export const GuideEntry: Story = {
  args: { initialSurface: 'guide', workspaceId: 'workspace-story' }
};
export const WorkspaceRequired: Story = { args: { initialSurface: 'today' } };
export const CustomerList: Story = { args: { initialSurface: 'customers' } };
export const CustomerDetail: Story = {
  args: { initialSurface: 'customers', initialCustomerId: 'cus-northwind' }
};
export const OpportunityList: Story = { args: { initialSurface: 'opportunities' } };
export const OpportunityDetail: Story = {
  args: { initialSurface: 'opportunities', initialOpportunityId: 'opp-repair' }
};
export const Empty: Story = { args: { initialSurface: 'customers', initialState: 'empty' } };
export const Stale: Story = { args: { initialSurface: 'opportunities', initialState: 'stale' } };
export const Error: Story = { args: { initialSurface: 'customers', initialState: 'error' } };
export const Loading: Story = {
  args: { initialSurface: 'opportunities', initialState: 'loading' }
};
export const LongText: Story = {
  args: { initialSurface: 'opportunities', initialOpportunityId: 'opp-renewal' }
};
export const Mobile390: Story = {
  args: { initialSurface: 'opportunities' },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
      viewports: { mobile1: { name: '390px mobile', styles: { width: '390px', height: '844px' } } }
    }
  }
};
export const ContentMobile390: Story = {
  ...ContentEntry,
  parameters: { ...Mobile390.parameters }
};
export const GuideMobile390: Story = {
  ...GuideEntry,
  parameters: { ...Mobile390.parameters }
};
export const ReviewQueueLoading: Story = {
  args: { initialSurface: 'professional-review', initialState: 'loading' }
};
export const ReviewQueueEmpty: Story = {
  args: { initialSurface: 'professional-review', initialState: 'empty' }
};
export const UnassignedReviewQueue: Story = { args: { initialSurface: 'professional-review' } };
export const AssignedReviewQueue: Story = { args: { initialSurface: 'professional-review' } };
export const StaleReviewCase: Story = {
  args: { initialSurface: 'professional-review', initialState: 'stale' }
};
export const ReviewDetail: Story = {
  args: { initialSurface: 'professional-review', initialReviewCaseId: 'professional-review_01001' }
};
export const ChecklistBlockingFail: Story = {
  args: { initialSurface: 'professional-review', initialReviewCaseId: 'professional-review_01001' }
};
export const ChecklistBlockingUnknown: Story = {
  args: { initialSurface: 'professional-review', initialReviewCaseId: 'professional-review_01001' }
};
export const InformationRequestPrepared: Story = {
  args: { initialSurface: 'professional-review', initialReviewCaseId: 'professional-review_01001' }
};
export const ReviewedReadyForNextStep: Story = { args: { initialSurface: 'professional-review' } };
export const WithdrawnReview: Story = { args: { initialSurface: 'professional-review' } };
export const ReviewRecoverableError: Story = {
  args: { initialSurface: 'professional-review', initialState: 'error' }
};
export const LongGoodsServices: Story = {
  args: { initialSurface: 'professional-review', initialReviewCaseId: 'professional-review_01001' }
};
export const ReviewMobile390: Story = {
  args: { initialSurface: 'professional-review' },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
      viewports: { mobile1: { name: '390px mobile', styles: { width: '390px', height: '844px' } } }
    }
  }
};
