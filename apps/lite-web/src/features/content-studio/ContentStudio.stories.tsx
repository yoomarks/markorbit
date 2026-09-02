import type { Meta, StoryObj } from '@storybook/react';
import { ContentStudio } from './ContentStudio.js';
import { ContentStudioHttpError } from '../../api/content-studio.js';
import {
  detailFixture,
  draft,
  fixtureClient,
  fixtureWorkspaceId,
  listFixture,
  review,
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
      detailFixture({
        drafts: [{ ...draft, status: 'DRAFT' }],
        reviewedDrafts: [],
        reviews: [],
        packages: [],
        feedback: []
      })
    ),
    initialContentOpportunityId: 'content-opportunity_413'
  }
};
export const ReadyForReview: Story = {
  args: {
    ...args,
    client: fixtureClient(
      listFixture(),
      detailFixture({
        drafts: [{ ...draft, status: 'READY_FOR_HUMAN_REVIEW' }],
        reviewedDrafts: [],
        reviews: [],
        packages: [],
        feedback: []
      })
    ),
    initialContentOpportunityId: 'content-opportunity_413'
  }
};
export const ChangesRequired: Story = {
  args: {
    ...args,
    client: fixtureClient(
      listFixture(),
      detailFixture({
        drafts: [{ ...draft, status: 'CHANGES_REQUIRED' }],
        reviewedDrafts: [draft],
        reviews: [{ ...review, outcome: 'CHANGES_REQUIRED' }],
        packages: [],
        feedback: []
      })
    ),
    initialContentOpportunityId: 'content-opportunity_413'
  }
};
export const Rejected: Story = {
  args: {
    ...args,
    client: fixtureClient(
      listFixture(),
      detailFixture({
        drafts: [{ ...draft, status: 'REJECTED' }],
        reviewedDrafts: [draft],
        reviews: [{ ...review, outcome: 'REJECTED' }],
        packages: [],
        feedback: []
      })
    ),
    initialContentOpportunityId: 'content-opportunity_413'
  }
};
export const ApprovedPackageReady: Story = {
  args: {
    ...args,
    client: fixtureClient(listFixture(), detailFixture({ packages: [], feedback: [] })),
    initialContentOpportunityId: 'content-opportunity_413'
  }
};
export const PackagePresent: Story = {
  args: { ...args, initialContentOpportunityId: 'content-opportunity_413' }
};
export const FeedbackAvailable: Story = {
  args: {
    ...args,
    client: fixtureClient(listFixture(), detailFixture({ feedback: [] })),
    initialContentOpportunityId: 'content-opportunity_413'
  }
};
export const FeedbackRecorded: Story = {
  args: { ...args, initialContentOpportunityId: 'content-opportunity_413' }
};
export const FeedbackMutationError: Story = {
  args: {
    ...args,
    client: {
      ...fixtureClient(listFixture(), detailFixture({ feedback: [] })),
      recordUseFeedback: () =>
        Promise.reject(
          new ContentStudioHttpError(409, 'PACKAGE_VERSION_CONFLICT', 'owner truth changed')
        )
    },
    initialContentOpportunityId: 'content-opportunity_413'
  },
  play: async ({ canvasElement }) => {
    const action = Array.from(canvasElement.querySelectorAll('button')).find(
      (button) => button.textContent === 'Published'
    );
    action?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};
export const PreparationMutationError: Story = {
  args: {
    ...args,
    client: {
      ...fixtureClient(
        listFixture(),
        detailFixture({
          drafts: [{ ...draft, status: 'DRAFT' }],
          reviewedDrafts: [],
          reviews: [],
          packages: [],
          feedback: []
        })
      ),
      reviseDraft: () =>
        Promise.reject(new ContentStudioHttpError(409, 'VERSION_CONFLICT', 'owner truth changed'))
    },
    initialContentOpportunityId: 'content-opportunity_413'
  },
  play: async ({ canvasElement }) => {
    const action = Array.from(canvasElement.querySelectorAll('button')).find(
      (button) => button.textContent === 'Revise Draft'
    );
    action?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};
export const PreparationBusy: Story = {
  args: {
    ...args,
    client: {
      ...fixtureClient(
        listFixture(),
        detailFixture({
          drafts: [{ ...draft, status: 'DRAFT' }],
          reviewedDrafts: [],
          reviews: [],
          packages: [],
          feedback: []
        })
      ),
      reviseDraft: () => new Promise(() => undefined)
    },
    initialContentOpportunityId: 'content-opportunity_413'
  },
  play: async ({ canvasElement }) => {
    const action = Array.from(canvasElement.querySelectorAll('button')).find(
      (button) => button.textContent === 'Revise Draft'
    );
    action?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};
export const Pagination: Story = {
  args: { ...args, client: fixtureClient(listFixture([summaryFixture()], 'next-page')) }
};
export const PermissionDenied: Story = {
  args: {
    ...args,
    client: {
      ...fixtureClient(),
      list: () => Promise.reject(new ContentStudioHttpError(403, 'PERMISSION_DENIED', 'denied')),
      find: () => Promise.reject(new Error('unused')),
      recordUseFeedback: () => Promise.reject(new Error('unused'))
    }
  }
};
export const PersistenceUnavailable: Story = {
  args: {
    ...args,
    client: {
      ...fixtureClient(),
      list: () =>
        Promise.reject(new ContentStudioHttpError(503, 'PERSISTENCE_UNAVAILABLE', 'offline')),
      find: () => Promise.reject(new Error('unused')),
      recordUseFeedback: () => Promise.reject(new Error('unused'))
    }
  }
};
export const Mobile390: Story = {
  args: {
    ...args,
    client: fixtureClient(listFixture(), detailFixture({ feedback: [] })),
    initialContentOpportunityId: 'content-opportunity_413'
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
      viewports: { mobile1: { name: '390px mobile', styles: { width: '390px', height: '844px' } } }
    }
  }
};
