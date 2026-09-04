// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ContentStudio } from './ContentStudio.js';
import {
  deriveContentWorkTriage,
  matchesContentTriageFilter
} from './content-triage.js';
import {
  detailFixture,
  fixtureClient,
  fixtureWorkspaceId,
  listFixture,
  summaryFixture
} from './fixtures.js';

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
  const latestPublishPackage =
    status === 'REVIEWED_READY_FOR_PACKAGE' && packageCurrent && latestDraft
      ? {
          ...base.latestPublishPackage!,
          contentDraft: { id: latestDraft.contentDraftId, version: latestDraft.version },
          createdAt: `2026-09-0${version}T11:00:00.000Z`
        }
      : null;
  return summaryFixture({
    contentOpportunity: { ...base.contentOpportunity, version },
    title,
    rationale: `${title} rationale`,
    updatedAt: `2026-08-${20 + version}T09:00:00.000Z`,
    latestDraft,
    latestDraftReview:
      status === 'REVIEWED_READY_FOR_PACKAGE' && latestDraft
        ? {
            ...base.latestDraftReview!,
            contentDraft: { id: latestDraft.contentDraftId, version: latestDraft.version },
            reviewedAt: `2026-09-0${version}T10:00:00.000Z`
          }
        : null,
    latestPublishPackage,
    latestPackageFeedback: latestPublishPackage
      ? {
          ...base.latestPackageFeedback!,
          publishPackage: {
            id: latestPublishPackage.publishPackageId,
            version: latestPublishPackage.version
          },
          recordedAt: `2026-09-0${version}T12:00:00.000Z`
        }
      : null
  });
}

const items = [
  work(1, 'Needs draft', null),
  work(2, 'Drafting work', 'DRAFT'),
  work(3, 'Review me', 'READY_FOR_HUMAN_REVIEW'),
  work(4, 'Revise me', 'CHANGES_REQUIRED'),
  work(5, 'Package this', 'REVIEWED_READY_FOR_PACKAGE'),
  work(6, 'Packaged work', 'REVIEWED_READY_FOR_PACKAGE', true)
];

describe('Content Studio action-first triage', () => {
  it('derives one current work state and never treats ALL as owner state', () => {
    expect(deriveContentWorkTriage(items[0]!).state).toBe('NEEDS_FIRST_DRAFT');
    expect(deriveContentWorkTriage(items[1]!).state).toBe('DRAFTING');
    expect(deriveContentWorkTriage(items[2]!).state).toBe('READY_FOR_REVIEW');
    expect(deriveContentWorkTriage(items[3]!).state).toBe('CHANGES_REQUIRED');
    expect(deriveContentWorkTriage(items[4]!).state).toBe('READY_FOR_PACKAGE');
    expect(deriveContentWorkTriage(items[5]!).state).toBe('PACKAGE_PREPARED');

    expect(matchesContentTriageFilter(deriveContentWorkTriage(items[0]!), 'NEEDS_ATTENTION')).toBe(
      true
    );
    expect(matchesContentTriageFilter(deriveContentWorkTriage(items[1]!), 'NEEDS_ATTENTION')).toBe(
      false
    );
  });

  it('uses exact current lineage activity instead of stale opportunity updatedAt', () => {
    expect(deriveContentWorkTriage(items[2]!).activityAt).toBe('2026-09-03T09:00:00.000Z');
    expect(deriveContentWorkTriage(items[5]!).activityAt).toBe('2026-09-06T12:00:00.000Z');

    const historicalPackage = summaryFixture({
      updatedAt: '2026-08-01T09:00:00.000Z',
      latestDraft: {
        ...summaryFixture().latestDraft!,
        version: 9,
        status: 'DRAFT',
        updatedAt: '2026-09-02T09:00:00.000Z'
      },
      latestPublishPackage: {
        ...summaryFixture().latestPublishPackage!,
        createdAt: '2026-09-10T09:00:00.000Z'
      },
      latestPackageFeedback: {
        ...summaryFixture().latestPackageFeedback!,
        recordedAt: '2026-09-11T09:00:00.000Z'
      }
    });
    const triage = deriveContentWorkTriage(historicalPackage);
    expect(triage.state).toBe('DRAFTING');
    expect(triage.activityAt).toBe('2026-09-02T09:00:00.000Z');
    expect(triage.nextFocus).toBe('Continue drafting or mark ready for human review');
  });

  it('defaults to needs-attention work, then supports bounded loaded-work filters and search', async () => {
    render(
      <ContentStudio workspaceId={fixtureWorkspaceId} client={fixtureClient(listFixture(items))} />
    );

    expect(await screen.findByText('Showing 4 of 6 loaded work items.')).toBeVisible();
    expect(screen.getByText('Human review required')).toBeVisible();
    expect(screen.getByText('Prepare PublishPackage')).toBeVisible();
    expect(screen.queryByText('Drafting work')).not.toBeInTheDocument();
    expect(screen.queryByText('Packaged work')).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Work view'), 'ALL');
    expect(screen.getByText('Showing 6 of 6 loaded work items.')).toBeVisible();
    expect(screen.getByText('Package prepared')).toBeVisible();

    await userEvent.type(screen.getByLabelText('Search loaded content work'), 'revise');
    expect(screen.getByText('Revise me')).toBeVisible();
    expect(screen.queryByText('Review me')).not.toBeInTheDocument();
    expect(screen.getByText('Revise the current Draft')).toBeVisible();

    const provenance = screen.getByText('Owner lineage and provenance').closest('details');
    expect(provenance).not.toHaveAttribute('open');
  });

  it('keeps triage context and restores focus after opening current work and returning', async () => {
    render(
      <ContentStudio
        workspaceId={fixtureWorkspaceId}
        client={fixtureClient(listFixture(items), detailFixture())}
      />
    );

    await screen.findByText('Showing 4 of 6 loaded work items.');
    await userEvent.selectOptions(screen.getByLabelText('Work view'), 'READY_FOR_REVIEW');
    const openButton = screen.getByRole('button', { name: 'Open current work' });
    await userEvent.click(openButton);
    expect(await screen.findByRole('button', { name: '← Back to Content Studio' })).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: '← Back to Content Studio' }));
    expect(await screen.findByText('Showing 1 of 6 loaded work items.')).toBeVisible();
    expect(screen.getByLabelText('Work view')).toHaveValue('READY_FOR_REVIEW');
    expect(screen.getByText('Review me')).toBeVisible();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open current work' })).toHaveFocus());
  });

  it('does not imply a complete search result when more owner work is not loaded', async () => {
    render(
      <ContentStudio
        workspaceId={fixtureWorkspaceId}
        client={fixtureClient(
          listFixture([work(2, 'Drafting only', 'DRAFT')], 'content-opportunity_more')
        )}
      />
    );

    expect(await screen.findByText('No loaded content work matches this view')).toBeVisible();
    expect(
      screen.getByText('More owner work is available and has not been searched yet.')
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Load more content work' })).toBeVisible();
  });
});
