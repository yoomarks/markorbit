// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ContentStudio, contentWorkNextFocus, contentWorkTriage } from './ContentStudio.js';
import { fixtureClient, fixtureWorkspaceId, listFixture, summaryFixture } from './fixtures.js';

afterEach(cleanup);

function work(
  version: number,
  title: string,
  status: NonNullable<ReturnType<typeof summaryFixture>['latestDraft']>['status'] | null,
  packageCurrent = false
) {
  const base = summaryFixture();
  const latestDraft = status
    ? {
        ...base.latestDraft!,
        version,
        status,
        title,
        updatedAt: `2026-09-0${version}T09:00:00.000Z`
      }
    : null;
  return summaryFixture({
    contentOpportunity: { ...base.contentOpportunity, version },
    title,
    rationale: `${title} rationale`,
    updatedAt: `2026-09-0${version}T09:00:00.000Z`,
    latestDraft,
    latestDraftReview: status === 'REVIEWED_READY_FOR_PACKAGE' ? base.latestDraftReview : null,
    latestPublishPackage:
      status === 'REVIEWED_READY_FOR_PACKAGE' && packageCurrent && latestDraft
        ? {
            ...base.latestPublishPackage!,
            contentDraft: { id: latestDraft.contentDraftId, version: latestDraft.version }
          }
        : null,
    latestPackageFeedback: null
  });
}

describe('Content Studio action-first triage', () => {
  it('derives triage only from current exact Draft and Package lineage', () => {
    expect(contentWorkTriage(work(1, 'Needs draft', null))).toBe('NEEDS_ACTION');
    expect(contentWorkTriage(work(2, 'Drafting', 'DRAFT'))).toBe('DRAFTING');
    expect(contentWorkTriage(work(3, 'Review', 'READY_FOR_HUMAN_REVIEW'))).toBe('READY_FOR_REVIEW');
    expect(contentWorkTriage(work(4, 'Changes', 'CHANGES_REQUIRED'))).toBe('CHANGES_REQUIRED');
    expect(contentWorkTriage(work(5, 'Package ready', 'REVIEWED_READY_FOR_PACKAGE'))).toBe(
      'PACKAGE_READY'
    );
    expect(contentWorkTriage(work(6, 'Package present', 'REVIEWED_READY_FOR_PACKAGE', true))).toBe(
      'PACKAGE_PRESENT'
    );

    const currentDraftWithHistoricalPackage = summaryFixture({
      latestDraft: { ...summaryFixture().latestDraft!, version: 9, status: 'DRAFT' }
    });
    expect(contentWorkTriage(currentDraftWithHistoricalPackage)).toBe('DRAFTING');
    expect(contentWorkNextFocus(currentDraftWithHistoricalPackage)).toBe(
      'Continue drafting or mark ready for human review'
    );
  });

  it('filters and searches only the loaded owner work while keeping next-focus guidance', async () => {
    const items = [
      work(1, 'Needs draft', null),
      work(2, 'Drafting work', 'DRAFT'),
      work(3, 'Review me', 'READY_FOR_HUMAN_REVIEW'),
      work(4, 'Revise me', 'CHANGES_REQUIRED'),
      work(5, 'Package this', 'REVIEWED_READY_FOR_PACKAGE'),
      work(6, 'Packaged work', 'REVIEWED_READY_FOR_PACKAGE', true)
    ];
    render(
      <ContentStudio workspaceId={fixtureWorkspaceId} client={fixtureClient(listFixture(items))} />
    );

    expect(await screen.findByText('Showing 6 of 6 loaded work items.')).toBeVisible();
    expect(screen.getByText('Human review required')).toBeVisible();
    expect(screen.getByText('Prepare PublishPackage')).toBeVisible();

    await userEvent.selectOptions(screen.getByLabelText('Current work state'), 'READY_FOR_REVIEW');
    expect(screen.getByText('Review me')).toBeVisible();
    expect(screen.queryByText('Drafting work')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1 of 6 loaded work items.')).toBeVisible();

    await userEvent.selectOptions(screen.getByLabelText('Current work state'), 'ALL');
    await userEvent.type(screen.getByLabelText('Search loaded content work'), 'revise');
    expect(screen.getByText('Revise me')).toBeVisible();
    expect(screen.queryByText('Review me')).not.toBeInTheDocument();
    expect(screen.getByText('Revise the current Draft')).toBeVisible();
  });
});
