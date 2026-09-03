import type { Meta, StoryObj } from '@storybook/react';
import { ContentStudio } from './ContentStudio.js';
import { ContentStudioHttpError } from '../../api/content-studio.js';
import {
  alternateVisualOutput,
  detailFixture,
  draft,
  fixtureClient,
  fixtureWorkspaceId,
  listFixture,
  review,
  secondVisualBriefRecord,
  secondVisualOutput,
  summaryFixture,
  visualBriefRecord,
  visualOutput
} from './fixtures.js';

export default {
  title: 'Products/Lite/Content Studio',
  component: ContentStudio,
  parameters: { layout: 'fullscreen', a11y: { disable: false } }
} satisfies Meta<typeof ContentStudio>;
type Story = StoryObj<typeof ContentStudio>;
const args = { workspaceId: fixtureWorkspaceId, client: fixtureClient() };
const mobile390 = {
  viewport: {
    defaultViewport: 'mobile1',
    viewports: { mobile1: { name: '390px mobile', styles: { width: '390px', height: '844px' } } }
  }
};
const baseSummary = summaryFixture();
const triageItems = [
  summaryFixture({
    contentOpportunity: { ...baseSummary.contentOpportunity, version: 1 },
    title: 'Create the first Draft',
    updatedAt: '2026-09-01T09:00:00.000Z',
    latestDraft: null,
    latestDraftReview: null,
    latestPublishPackage: null,
    latestPackageFeedback: null
  }),
  summaryFixture({
    contentOpportunity: { ...baseSummary.contentOpportunity, version: 2 },
    title: 'Drafting evidence-first explainer',
    updatedAt: '2026-09-02T09:00:00.000Z',
    latestDraft: { ...baseSummary.latestDraft!, status: 'DRAFT' },
    latestDraftReview: null,
    latestPublishPackage: null,
    latestPackageFeedback: null
  }),
  summaryFixture({
    contentOpportunity: { ...baseSummary.contentOpportunity, version: 3 },
    title: 'Needs human review',
    updatedAt: '2026-09-03T09:00:00.000Z',
    latestDraft: { ...baseSummary.latestDraft!, status: 'READY_FOR_HUMAN_REVIEW' },
    latestDraftReview: null,
    latestPublishPackage: null,
    latestPackageFeedback: null
  }),
  summaryFixture({
    contentOpportunity: { ...baseSummary.contentOpportunity, version: 4 },
    title: 'Changes requested by reviewer',
    updatedAt: '2026-09-04T09:00:00.000Z',
    latestDraft: { ...baseSummary.latestDraft!, status: 'CHANGES_REQUIRED' },
    latestDraftReview: { ...baseSummary.latestDraftReview!, outcome: 'CHANGES_REQUIRED' },
    latestPublishPackage: null,
    latestPackageFeedback: null
  }),
  summaryFixture({
    contentOpportunity: { ...baseSummary.contentOpportunity, version: 5 },
    title: 'Ready to prepare package',
    updatedAt: '2026-09-05T09:00:00.000Z',
    latestPublishPackage: null,
    latestPackageFeedback: null
  }),
  summaryFixture({
    contentOpportunity: { ...baseSummary.contentOpportunity, version: 6 },
    title: 'Package already prepared',
    updatedAt: '2026-09-06T09:00:00.000Z'
  })
];
export const CompleteEmpty: Story = {
  args: {
    ...args,
    client: fixtureClient(
      listFixture([summaryFixture({ visualBriefCount: 0, visualOutputCount: 0 })], null, {
        partial: false,
        warnings: []
      }),
      detailFixture({ visualBriefs: [], visualOutputs: [], partial: false, warnings: [] })
    ),
    initialContentOpportunityId: 'content-opportunity_413'
  }
};
export const CompleteHistory: Story = {
  args: {
    ...args,
    client: fixtureClient(
      listFixture([summaryFixture()], null, { partial: false, warnings: [] }),
      detailFixture({ partial: false, warnings: [] })
    ),
    initialContentOpportunityId: 'content-opportunity_413'
  }
};
export const PartialEmptyUnknown: Story = {
  args: {
    ...args,
    client: fixtureClient(
      listFixture([summaryFixture({ visualBriefCount: 0, visualOutputCount: 0 })], null, {
        partial: true,
        warnings: ['VISUAL_HISTORY_NOT_DISCOVERABLE']
      }),
      detailFixture({ visualBriefs: [], visualOutputs: [] })
    ),
    initialContentOpportunityId: 'content-opportunity_413'
  }
};
export const PartialMixed: Story = {
  args: { ...args, initialContentOpportunityId: 'content-opportunity_413' }
};
export const MultipleOutput: Story = {
  args: {
    ...args,
    client: fixtureClient(
      listFixture([summaryFixture({ visualBriefCount: 2, visualOutputCount: 3 })], null, {
        partial: false,
        warnings: []
      }),
      detailFixture({
        visualBriefs: [visualBriefRecord, secondVisualBriefRecord],
        visualOutputs: [visualOutput, secondVisualOutput, alternateVisualOutput],
        partial: false,
        warnings: []
      })
    ),
    initialContentOpportunityId: 'content-opportunity_413'
  }
};
export const CompleteEmptyMobile390: Story = { ...CompleteEmpty, parameters: mobile390 };
export const CompleteHistoryMobile390: Story = { ...CompleteHistory, parameters: mobile390 };
export const PartialEmptyUnknownMobile390: Story = {
  ...PartialEmptyUnknown,
  parameters: mobile390
};
export const PartialMixedMobile390: Story = { ...PartialMixed, parameters: mobile390 };
export const MultipleOutputMobile390: Story = { ...MultipleOutput, parameters: mobile390 };
export const SuccessList: Story = { args };
export const MixedTriage: Story = {
  args: { ...args, client: fixtureClient(listFixture(triageItems)) }
};
export const FilteredTriage: Story = {
  ...MixedTriage,
  play: async ({ canvasElement }) => {
    const select = canvasElement.querySelector('select');
    if (select) {
      select.value = 'READY_FOR_REVIEW';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};
export const MixedTriageMobile390: Story = {
  ...MixedTriage,
  parameters: mobile390
};
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
  parameters: mobile390
};
