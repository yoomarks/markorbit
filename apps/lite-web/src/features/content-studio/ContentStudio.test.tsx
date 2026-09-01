// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContentStudio, contentWorkStage } from './ContentStudio.js';
import { ContentStudioHttpError, type ContentStudioClient } from '../../api/content-studio.js';
import {
  detailFixture,
  draft,
  feedback,
  fixtureClient,
  fixtureWorkspaceId,
  listFixture,
  opportunity,
  publishPackage,
  review,
  summaryFixture
} from './fixtures.js';

afterEach(cleanup);

describe('Content Studio workspace', () => {
  it('maps only the latest exact Draft owner status to presentation copy', () => {
    expect(
      contentWorkStage(
        summaryFixture({
          latestDraft: null,
          latestDraftReview: null,
          latestPublishPackage: null,
          latestPackageFeedback: null
        })
      )
    ).toBe('Content Opportunity created');
    expect(contentWorkStage(summaryFixture())).toBe('Reviewed draft ready for package');
    expect(
      contentWorkStage(
        summaryFixture({ latestDraft: { ...summaryFixture().latestDraft!, status: 'DRAFT' } })
      )
    ).toBe('Draft in progress');
    expect(
      contentWorkStage(
        summaryFixture({
          latestDraft: {
            ...summaryFixture().latestDraft!,
            status: 'READY_FOR_HUMAN_REVIEW'
          }
        })
      )
    ).toBe('Ready for human review');
  });

  it('keeps old Package and feedback as work facts without overriding the current Draft lineage', async () => {
    const current = summaryFixture();
    const oldPackage = {
      ...current.latestPublishPackage!,
      contentDraft: { id: draft.contentDraftId, version: 1 }
    };
    const crossLineage = summaryFixture({
      latestDraft: { ...current.latestDraft!, version: 2, status: 'DRAFT' },
      latestDraftReview: null,
      latestPublishPackage: oldPackage,
      latestPackageFeedback: {
        ...feedback,
        publishPackage: { id: oldPackage.publishPackageId, version: oldPackage.version }
      }
    });
    render(
      <ContentStudio
        workspaceId={fixtureWorkspaceId}
        client={fixtureClient(listFixture([crossLineage]))}
      />
    );

    expect(await screen.findByText('Draft in progress')).toBeVisible();
    expect(screen.getByText(`${draft.contentDraftId} · v2 · DRAFT`)).toBeVisible();
    expect(screen.getByText('No exact Review Decision')).toBeVisible();
    expect(screen.getByText(new RegExp(oldPackage.publishPackageId))).toBeVisible();
    expect(screen.getByText(/User-reported · USER_REPORTED_PUBLISHED/)).toBeVisible();
    expect(screen.queryByText('Draft awaiting review')).not.toBeInTheDocument();
    expect(screen.queryByText('Human review completed')).not.toBeInTheDocument();
    expect(screen.queryByText('Publish package prepared')).not.toBeInTheDocument();
    expect(screen.queryByText('User feedback recorded')).not.toBeInTheDocument();
  });

  it('does not describe a DRAFT without an exact Review as awaiting review', () => {
    const work = summaryFixture({
      latestDraft: { ...summaryFixture().latestDraft!, status: 'DRAFT' },
      latestDraftReview: null,
      latestPublishPackage: null,
      latestPackageFeedback: null
    });
    expect(contentWorkStage(work)).toBe('Draft in progress');
    expect(contentWorkStage(work)).not.toBe('Draft awaiting review');
  });

  it('renders Workspace-backed list, stable ContentOpportunity identity and partial Visual warning', async () => {
    render(<ContentStudio workspaceId={fixtureWorkspaceId} client={fixtureClient()} />);
    expect(screen.getByText('Loading Content Studio')).toBeVisible();
    expect(await screen.findByRole('heading', { name: 'Content Studio' })).toBeVisible();
    expect(screen.getByText('content-opportunity_413')).toBeVisible();
    expect(
      screen.getByText(/Historical visual\/media lineage is not fully discoverable/)
    ).toBeVisible();
    expect(screen.queryByText(/No visual work exists/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Content Pick|Daily Orbit/)).not.toBeInTheDocument();
  });

  it('shows a truthful empty Workspace', async () => {
    render(
      <ContentStudio workspaceId={fixtureWorkspaceId} client={fixtureClient(listFixture([]))} />
    );
    expect(await screen.findByRole('heading', { name: 'No content work yet' })).toBeVisible();
  });

  it('paginates owner results without replacing durable work', async () => {
    const first = summaryFixture();
    const second = summaryFixture({
      contentOpportunity: { id: 'content-opportunity_second', version: 1 },
      title: 'Second work'
    });
    const list = vi.fn((after?: string) =>
      Promise.resolve(after ? listFixture([second]) : listFixture([first], 'page-2'))
    );
    render(
      <ContentStudio
        workspaceId={fixtureWorkspaceId}
        client={{ list, find: vi.fn(), recordUseFeedback: vi.fn() }}
      />
    );
    await screen.findByText(first.title);
    await userEvent.click(screen.getByRole('button', { name: 'Load more content work' }));
    expect(await screen.findByText('Second work')).toBeVisible();
    expect(screen.getByText(first.title)).toBeVisible();
    expect(list).toHaveBeenNthCalledWith(2, 'page-2');
  });

  it('renders exact Draft, Review, Package and feedback lineage without authority inflation', async () => {
    render(
      <ContentStudio
        workspaceId={fixtureWorkspaceId}
        client={fixtureClient()}
        initialContentOpportunityId="content-opportunity_413"
      />
    );
    const heading = await screen.findByRole('heading', { level: 1, name: draft.title });
    const detail = heading.closest('main') ?? document.body;
    expect(
      within(detail).getByText(
        new RegExp(`Review ${review.contentReviewDecisionId} v1 binds Draft v2`)
      )
    ).toBeVisible();
    expect(
      screen.getByText(
        new RegExp(
          `Binds Draft ${draft.contentDraftId} v2 and approving Review ${review.contentReviewDecisionId} v1`
        )
      )
    ).toBeVisible();
    expect(screen.getByText(feedback.outcome)).toBeVisible();
    expect(
      screen.getByText(
        /User-reported after-the-fact feedback; independently verified by MarkOrbit: No/
      )
    ).toBeVisible();
    expect(screen.getByText(/External publish executed by MarkOrbit:/)).toHaveTextContent('No');
    expect(screen.getByText(/Human review is required/)).toBeVisible();
  });

  it('opens durable work directly when current Orbit or Pick context is absent', async () => {
    const client = {
      list: vi.fn(() => Promise.reject(new Error('list discovery is not required'))),
      find: vi.fn(() => Promise.resolve(detailFixture())),
      recordUseFeedback: vi.fn()
    };
    render(
      <ContentStudio
        workspaceId={fixtureWorkspaceId}
        client={client}
        initialContentOpportunityId="content-opportunity_413"
      />
    );
    expect(await screen.findByRole('heading', { name: 'Version lineage' })).toBeVisible();
    expect(client.find).toHaveBeenCalledWith('content-opportunity_413');
    expect(client.list).not.toHaveBeenCalled();
  });

  it('does not infer a Review Decision from a reviewed-looking Draft status', async () => {
    render(
      <ContentStudio
        workspaceId={fixtureWorkspaceId}
        client={fixtureClient(
          listFixture(),
          detailFixture({ reviews: [], packages: [], feedback: [] })
        )}
        initialContentOpportunityId="content-opportunity_413"
      />
    );
    expect(
      await screen.findByText('No exact Review Decision for this Draft version.')
    ).toBeVisible();
    expect(screen.queryByText('Exact human Review Decision')).not.toBeInTheDocument();
  });

  it('keeps a reviewed historical Draft version visible beside the current Draft', async () => {
    const historicalDraft = { ...draft, version: 1, contentDraftFingerprintSha256: 'b'.repeat(64) };
    const historicalReview = {
      ...review,
      contentDraft: { id: historicalDraft.contentDraftId, version: historicalDraft.version },
      expectedContentDraftFingerprintSha256: historicalDraft.contentDraftFingerprintSha256
    };
    render(
      <ContentStudio
        workspaceId={fixtureWorkspaceId}
        client={fixtureClient(
          listFixture(),
          detailFixture({
            drafts: [draft],
            reviewedDrafts: [historicalDraft],
            reviews: [historicalReview],
            packages: [],
            feedback: []
          })
        )}
        initialContentOpportunityId="content-opportunity_413"
      />
    );
    expect(await screen.findByText('Draft · exact version 1')).toBeVisible();
    expect(screen.getByText('Draft · exact version 2')).toBeVisible();
    expect(screen.getByText(/binds Draft v1 and fingerprint/)).toBeVisible();
  });

  it('shows accepted Opportunity without Draft and Package without feedback', async () => {
    const { rerender } = render(
      <ContentStudio
        workspaceId={fixtureWorkspaceId}
        client={fixtureClient(
          listFixture(),
          detailFixture({ drafts: [], reviews: [], packages: [], feedback: [] })
        )}
        initialContentOpportunityId="content-opportunity_413"
      />
    );
    expect(await screen.findByRole('heading', { name: 'No draft yet' })).toBeVisible();
    rerender(
      <ContentStudio
        workspaceId={fixtureWorkspaceId}
        client={fixtureClient(listFixture(), detailFixture({ feedback: [] }))}
        initialContentOpportunityId="content-opportunity_413"
      />
    );
    expect(await screen.findByText(/No user-reported package feedback\./)).toBeVisible();
  });

  it('shows exact feedback actions only for a Package without durable feedback', async () => {
    render(
      <ContentStudio
        workspaceId={fixtureWorkspaceId}
        client={fixtureClient(listFixture(), detailFixture({ feedback: [] }))}
        initialContentOpportunityId="content-opportunity_413"
      />
    );
    expect(await screen.findByRole('button', { name: 'Published' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Used' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Not used' })).toBeVisible();
    expect(screen.getByText(/Recording feedback does not publish externally/)).toBeVisible();
  });

  it('reloads durable detail after feedback succeeds without creating local success', async () => {
    const noFeedback = detailFixture({ feedback: [] });
    const recorded = detailFixture({ feedback: [{ ...feedback, outcome: 'USER_REPORTED_USED' }] });
    const find = vi
      .fn<ContentStudioClient['find']>()
      .mockResolvedValueOnce(noFeedback)
      .mockResolvedValueOnce(recorded);
    const recordUseFeedback = vi.fn<ContentStudioClient['recordUseFeedback']>(() =>
      Promise.resolve({ ...feedback, outcome: 'USER_REPORTED_USED' })
    );
    render(
      <ContentStudio
        workspaceId={fixtureWorkspaceId}
        client={{ list: vi.fn(), find, recordUseFeedback }}
        initialContentOpportunityId="content-opportunity_413"
      />
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Used' }));

    expect(await screen.findByText('USER_REPORTED_USED')).toBeVisible();
    expect(recordUseFeedback).toHaveBeenCalledWith(publishPackage, 'USER_REPORTED_USED');
    expect(find).toHaveBeenNthCalledWith(2, opportunity.contentOpportunityId);
    expect(screen.queryByRole('button', { name: 'Published' })).not.toBeInTheDocument();
  });

  it('suppresses duplicate actions when exact-package durable feedback exists', async () => {
    render(
      <ContentStudio
        workspaceId={fixtureWorkspaceId}
        client={fixtureClient()}
        initialContentOpportunityId="content-opportunity_413"
      />
    );
    expect(await screen.findByText('USER_REPORTED_PUBLISHED')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Published' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Used' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Not used' })).not.toBeInTheDocument();
  });

  it.each([
    [409, 'Package truth may have changed'],
    [503, 'Feedback service unavailable']
  ] as const)('preserves loaded lineage when feedback fails with %s', async (status, title) => {
    const client = fixtureClient(listFixture(), detailFixture({ feedback: [] }));
    client.recordUseFeedback = vi.fn(() =>
      Promise.reject(new ContentStudioHttpError(status, 'FEEDBACK_FAILED', 'failed'))
    );
    render(
      <ContentStudio
        workspaceId={fixtureWorkspaceId}
        client={client}
        initialContentOpportunityId="content-opportunity_413"
      />
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Published' }));
    expect(await screen.findByText(title)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Version lineage' })).toBeVisible();
    expect(screen.getByText(`Draft · exact version ${draft.version}`)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Published' })).toBeVisible();
    expect(screen.queryByText('USER_REPORTED_PUBLISHED')).not.toBeInTheDocument();
  });

  it.each([
    [401, 'Sign in required'],
    [403, 'Content Studio permission required'],
    [404, 'Content work not found'],
    [503, 'Content Studio unavailable']
  ] as const)('keeps %s distinct from empty', async (status, title) => {
    const client: ContentStudioClient = {
      list: () => Promise.reject(new ContentStudioHttpError(status, 'OWNER_ERROR', 'failed')),
      find: () => Promise.reject(new Error('unused')),
      recordUseFeedback: () => Promise.reject(new Error('unused'))
    };
    render(<ContentStudio workspaceId={fixtureWorkspaceId} client={client} />);
    expect(await screen.findByRole('heading', { name: title })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'No content work yet' })).not.toBeInTheDocument();
  });
});
