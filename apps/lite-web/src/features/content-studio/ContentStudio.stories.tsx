import type { Meta, StoryObj } from '@storybook/react';
import { ContentStudio } from './ContentStudio.js';
import { ContentStudioHttpError } from '../../api/content-studio.js';
import {
  detailFixture,
  fixtureClient,
  fixtureWorkspaceId,
  listFixture,
  summaryFixture
} from './fixtures.js';

export default {
  title: 'Products/Lite/Content Studio',
  component: ContentStudio,
  parameters: { layout: 'fullscreen', a11y: { disable: false } }
} satisfies Meta<typeof ContentStudio>;
type Story = StoryObj<typeof ContentStudio>;
const args = { workspaceId: fixtureWorkspaceId, client: fixtureClient() };
export const SuccessList: Story = { args };
export const EmptyWorkspace: Story = { args: { ...args, client: fixtureClient(listFixture([])) } };
export const SuccessDetail: Story = {
  args: { ...args, initialContentOpportunityId: 'content-opportunity_413' }
};
export const AcceptedWithoutDraft: Story = {
  args: {
    ...args,
    client: fixtureClient(
      listFixture([
        summaryFixture({
          latestDraft: null,
          latestDraftReview: null,
          latestPublishPackage: null,
          latestPackageFeedback: null
        })
      ]),
      detailFixture({ drafts: [], reviews: [], packages: [], feedback: [] })
    ),
    initialContentOpportunityId: 'content-opportunity_413'
  }
};
export const DraftWithoutReview: Story = {
  args: {
    ...args,
    client: fixtureClient(
      listFixture(),
      detailFixture({ reviews: [], packages: [], feedback: [] })
    ),
    initialContentOpportunityId: 'content-opportunity_413'
  }
};
export const ExactReview: Story = {
  args: {
    ...args,
    client: fixtureClient(listFixture(), detailFixture({ packages: [], feedback: [] })),
    initialContentOpportunityId: 'content-opportunity_413'
  }
};
export const PackageWithoutFeedback: Story = {
  args: {
    ...args,
    client: fixtureClient(listFixture(), detailFixture({ feedback: [] })),
    initialContentOpportunityId: 'content-opportunity_413'
  }
};
export const UserReportedFeedback: Story = {
  args: { ...args, initialContentOpportunityId: 'content-opportunity_413' }
};
export const Pagination: Story = {
  args: { ...args, client: fixtureClient(listFixture([summaryFixture()], 'next-page')) }
};
export const PermissionDenied: Story = {
  args: {
    ...args,
    client: {
      list: () => Promise.reject(new ContentStudioHttpError(403, 'PERMISSION_DENIED', 'denied')),
      find: () => Promise.reject(new Error('unused'))
    }
  }
};
export const PersistenceUnavailable: Story = {
  args: {
    ...args,
    client: {
      list: () =>
        Promise.reject(new ContentStudioHttpError(503, 'PERSISTENCE_UNAVAILABLE', 'offline')),
      find: () => Promise.reject(new Error('unused'))
    }
  }
};
export const Mobile390: Story = {
  args,
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
      viewports: { mobile1: { name: '390px mobile', styles: { width: '390px', height: '844px' } } }
    }
  }
};
