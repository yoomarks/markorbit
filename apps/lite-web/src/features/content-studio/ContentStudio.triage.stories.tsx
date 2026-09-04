import type { Meta, StoryObj } from '@storybook/react';
import { ContentStudio } from './ContentStudio.js';
import { fixtureClient, fixtureWorkspaceId, listFixture, summaryFixture } from './fixtures.js';

export default {
  title: 'Products/Lite/Content Studio/Triage',
  component: ContentStudio,
  parameters: { layout: 'fullscreen', a11y: { disable: false } }
} satisfies Meta<typeof ContentStudio>;

type Story = StoryObj<typeof ContentStudio>;
const base = summaryFixture();
const mobile390 = {
  viewport: {
    defaultViewport: 'mobile1',
    viewports: { mobile1: { name: '390px mobile', styles: { width: '390px', height: '844px' } } }
  }
};

function item(
  version: number,
  title: string,
  status: NonNullable<typeof base.latestDraft>['status'] | null
) {
  return summaryFixture({
    contentOpportunity: { ...base.contentOpportunity, version },
    title,
    rationale: `${title} — bounded professional context for the current owner work.`,
    updatedAt: `2026-08-${20 + version}T09:00:00.000Z`,
    latestDraft: status
      ? {
          ...base.latestDraft!,
          version,
          status,
          title,
          updatedAt: `2026-09-0${version}T09:00:00.000Z`
        }
      : null,
    latestDraftReview:
      status === 'REVIEWED_READY_FOR_PACKAGE'
        ? {
            ...base.latestDraftReview!,
            contentDraft: { id: base.latestDraft!.contentDraftId, version },
            reviewedAt: `2026-09-0${version}T10:00:00.000Z`
          }
        : null,
    latestPublishPackage: null,
    latestPackageFeedback: null
  });
}

const mixed = [
  item(1, 'Create the first Draft', null),
  item(2, 'Drafting evidence-first explainer', 'DRAFT'),
  item(3, 'Needs human review', 'READY_FOR_HUMAN_REVIEW'),
  item(4, 'Changes requested by reviewer', 'CHANGES_REQUIRED'),
  item(5, 'Ready to prepare package', 'REVIEWED_READY_FOR_PACKAGE'),
  item(6, 'Rejected historical Draft', 'REJECTED')
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
    client: fixtureClient(listFixture([item(2, 'Drafting only on this page', 'DRAFT')], 'content-opportunity_more'))
  }
};

export const NoCurrentAction: Story = {
  args: {
    workspaceId: fixtureWorkspaceId,
    client: fixtureClient(listFixture([item(6, 'Rejected historical Draft', 'REJECTED')]))
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
          ...item(4, 'Changes requested for a long evidence-led trademark preparation explainer that must remain scannable on a narrow professional workspace', 'CHANGES_REQUIRED'),
          rationale:
            'The reviewer requested a targeted revision because the current explanation needs to preserve authority boundaries, exact source provenance, and a clear human-review handoff without turning the card into an audit dump.'
        })
      ])
    )
  },
  parameters: mobile390
};
