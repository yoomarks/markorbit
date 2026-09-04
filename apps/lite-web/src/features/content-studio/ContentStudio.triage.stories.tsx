import type { Meta, StoryObj } from '@storybook/react';
import { ContentStudio } from './ContentStudio.js';
import { fixtureClient, fixtureWorkspaceId, listFixture, summaryFixture } from './fixtures.js';

export default {
  title: 'Products/Lite/Content Studio/Triage',
  component: ContentStudio,
  parameters: { layout: 'fullscreen', a11y: { disable: false } }
} satisfies Meta<typeof ContentStudio>;

type Story = StoryObj<typeof ContentStudio>;
type ReviewOutcome = NonNullable<
  ReturnType<typeof summaryFixture>['latestDraftReview']
>['outcome'];
const base = summaryFixture();
const mobile390 = {
  viewport: {
    defaultViewport: 'mobile1',
    viewports: {
      mobile1: { name: '390px mobile', styles: { width: '390px', height: '844px' } }
    }
  }
};

function item(
  version: number,
  title: string,
  status: NonNullable<typeof base.latestDraft>['status'] | null,
  reviewOutcome: ReviewOutcome | null = null,
  packageCurrent = false
) {
  const latestDraft = status
    ? {
        ...base.latestDraft!,
        version,
        status,
        title,
        updatedAt: `2026-09-0${version}T09:00:00.000Z`
      }
    : null;
  const latestDraftReview =
    reviewOutcome && latestDraft
      ? {
          ...base.latestDraftReview!,
          contentDraft: { id: latestDraft.contentDraftId, version: latestDraft.version },
          outcome: reviewOutcome,
          reviewedAt: `2026-09-0${version}T10:00:00.000Z`
        }
      : null;
  const latestPublishPackage =
    packageCurrent && latestDraft && latestDraftReview
      ? {
          ...base.latestPublishPackage!,
          contentDraft: { id: latestDraft.contentDraftId, version: latestDraft.version },
          reviewDecision: {
            id: latestDraftReview.contentReviewDecisionId,
            version: latestDraftReview.version
          },
          createdAt: `2026-09-0${version}T11:00:00.000Z`
        }
      : null;
  return summaryFixture({
    contentOpportunity: { id: `content-opportunity_triage_${version}`, version },
    title,
    rationale: `${title} — bounded professional context for the current owner work.`,
    updatedAt: `2026-08-${20 + version}T09:00:00.000Z`,
    latestDraft,
    latestDraftReview,
    latestPublishPackage,
    latestPackageFeedback: null
  });
}

const mixed = [
  item(1, 'Create the first Draft', null),
  item(2, 'Drafting evidence-first explainer', 'DRAFT'),
  item(3, 'Needs human review', 'READY_FOR_HUMAN_REVIEW'),
  item(
    4,
    'Changes requested by reviewer',
    'READY_FOR_HUMAN_REVIEW',
    'CHANGES_REQUIRED'
  ),
  item(
    5,
    'Ready to prepare package',
    'READY_FOR_HUMAN_REVIEW',
    'APPROVED_FOR_PUBLISH_PACKAGE'
  ),
  item(
    6,
    'Package already prepared',
    'READY_FOR_HUMAN_REVIEW',
    'APPROVED_FOR_PUBLISH_PACKAGE',
    true
  ),
  item(7, 'Rejected historical Draft', 'READY_FOR_HUMAN_REVIEW', 'REJECTED')
];

export const NeedsAttentionDesktop: Story = {
  args: {
    workspaceId: fixtureWorkspaceId,
    client: fixtureClient(listFixture(mixed))
  }
};

export const NoMatchMoreOwnerWork: Story = {
  args: {
    workspaceId: fixtureWorkspaceId,
    client: fixtureClient(
      listFixture([item(2, 'Drafting only on this page', 'DRAFT')], 'content-opportunity_more')
    )
  }
};

export const NoCurrentAction: Story = {
  args: {
    workspaceId: fixtureWorkspaceId,
    client: fixtureClient(
      listFixture([
        item(7, 'Rejected historical Draft', 'READY_FOR_HUMAN_REVIEW', 'REJECTED')
      ])
    )
  },
  play: async ({ canvasElement }) => {
    const select = canvasElement.querySelector('select');
    if (select) {
      select.value = 'NO_CURRENT_ACTION';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
};

export const LongCopyMobile390: Story = {
  args: {
    workspaceId: fixtureWorkspaceId,
    client: fixtureClient(
      listFixture([
        summaryFixture({
          ...item(
            4,
            'Changes requested for a long evidence-led trademark preparation explainer that must remain scannable on a narrow professional workspace',
            'READY_FOR_HUMAN_REVIEW',
            'CHANGES_REQUIRED'
          ),
          rationale:
            'The reviewer requested a targeted revision because the current explanation needs to preserve authority boundaries, exact source provenance, and a clear human-review handoff without turning the card into an audit dump.'
        })
      ])
    )
  },
  parameters: mobile390
};
