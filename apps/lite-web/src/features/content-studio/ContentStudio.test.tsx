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
  secondVisualBriefRecord,
  secondVisualOutput,
  summaryFixture,
  visualBriefRecord,
  visualOutput,
  alternateVisualOutput
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
    expect(screen.getByText('Governed preparation')).toBeVisible();
    expect(screen.getByText('Durable Visual Briefs')).toBeVisible();
    expect(screen.getByText('Durable Visual Outputs')).toBeVisible();
    expect(screen.queryByText('Read only')).not.toBeInTheDocument();
  });

  it('distinguishes complete-empty Visual coverage from partial unknown coverage', async () => {
    const emptySummary = summaryFixture({ visualBriefCount: 0, visualOutputCount: 0 });
    render(
      <ContentStudio
        workspaceId={fixtureWorkspaceId}
        client={fixtureClient(
          listFixture([emptySummary], null, { partial: false, warnings: [] }),
          detailFixture({ visualBriefs: [], visualOutputs: [], partial: false, warnings: [] })
        )}
        initialContentOpportunityId={opportunity.contentOpportunityId}
      />
    );

    expect(await screen.findByText('No Visual / Media lineage')).toBeVisible();
    expect(screen.getByText(/Owner coverage is complete/)).toBeVisible();
    expect(screen.queryByText(/Legacy Workspace history may exist/)).not.toBeInTheDocument();
    cleanup();

    render(
      <ContentStudio
        workspaceId={fixtureWorkspaceId}
        client={fixtureClient(
          listFixture([emptySummary]),
          detailFixture({ visualBriefs: [], visualOutputs: [] })
        )}
        initialContentOpportunityId={opportunity.contentOpportunityId}
      />
    );

    expect(await screen.findByText(/Legacy Workspace history may exist/)).toBeVisible();
    expect(screen.queryByText(/Owner coverage is complete/)).not.toBeInTheDocument();
  });

  it('groups multiple outputs only under their exact Visual Brief id and version', async () => {
    render(
      <ContentStudio
        workspaceId={fixtureWorkspaceId}
        client={fixtureClient(
          listFixture(),
          detailFixture({
            visualBriefs: [visualBriefRecord, secondVisualBriefRecord],
            visualOutputs: [secondVisualOutput, alternateVisualOutput, visualOutput]
          })
        )}
        initialContentOpportunityId={opportunity.contentOpportunityId}
      />
    );

    expect(await screen.findByRole('heading', { name: 'Visual / Media lineage' })).toBeVisible();
    const firstOutputs = screen.getByRole('region', {
      name: `Visual Outputs for ${visualBriefRecord.brief.visualBriefId} version ${visualBriefRecord.brief.version}`
    });
    const secondOutputs = screen.getByRole('region', {
      name: `Visual Outputs for ${secondVisualBriefRecord.brief.visualBriefId} version ${secondVisualBriefRecord.brief.version}`
    });
    expect(within(firstOutputs).getByText(visualOutput.visualOutputReferenceId)).toBeVisible();
    expect(
      within(firstOutputs).getByText(alternateVisualOutput.visualOutputReferenceId)
    ).toBeVisible();
    expect(within(firstOutputs).queryByText(secondVisualOutput.visualOutputReferenceId)).toBeNull();
    expect(
      within(secondOutputs).getByText(secondVisualOutput.visualOutputReferenceId)
    ).toBeVisible();
    expect(within(secondOutputs).queryByText(visualOutput.visualOutputReferenceId)).toBeNull();
  });

  it('shows owner output/QC/reference truth without execution, publication, or artifact authority', async () => {
    render(
      <ContentStudio
        workspaceId={fixtureWorkspaceId}
        client={fixtureClient()}
        initialContentOpportunityId={opportunity.contentOpportunityId}
      />
    );

    expect(await screen.findByText(visualOutput.visualOutputReferenceId)).toBeVisible();
    expect(screen.getByText('Visual and media history is partially discoverable')).toBeVisible();
    expect(screen.getByText(visualOutput.status)).toBeVisible();
    expect(screen.getByText(visualOutput.qcStatus!)).toBeVisible();
    expect(screen.getByText(visualOutput.requestReference)).toBeVisible();
    const outputReference = screen.getByText(visualOutput.outputReference!);
    expect(outputReference.closest('a')).toBeNull();
    expect(screen.getByText(visualBriefRecord.visualBriefFingerprintSha256)).toBeVisible();
    expect(screen.getByText('Provider execution authorized by Lite')).toBeVisible();
    expect(screen.getByText('Paid execution authorized by Lite')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /generate|request visual|approve qc|publish/i })
    ).toBeNull();
    expect(screen.queryByRole('link', { name: /download|artifact/i })).toBeNull();
  });

  it('creates a Draft from exact loaded Opportunity truth and renders only reloaded owner detail', async () => {
    const noDraft = detailFixture({
      drafts: [],
      reviewedDrafts: [],
      reviews: [],
      packages: [],
      feedback: []
    });
    const createdDraft = {
      ...draft,
      version: 1,
      status: 'DRAFT' as const,
      title: 'Owner title',
      body: 'Owner body'
    };
    const created = detailFixture({
      drafts: [createdDraft],
      reviewedDrafts: [],
      reviews: [],
      packages: [],
      feedback: []
    });
    const client = fixtureClient();
    const find = vi
      .fn<ContentStudioClient['find']>()
      .mockResolvedValueOnce(noDraft)
      .mockResolvedValueOnce(created);
    const createDraft = vi.fn(() => Promise.resolve(createdDraft));
    client.find = find;
    client.createDraft = createDraft;
    render(
      <ContentStudio
        workspaceId={fixtureWorkspaceId}
        client={client}
        initialContentOpportunityId={opportunity.contentOpportunityId}
      />
    );

    const title = await screen.findByLabelText('Draft title');
    await userEvent.clear(title);
    await userEvent.type(title, 'Browser title');
    await userEvent.type(screen.getByLabelText('Draft body'), 'Browser body');
    await userEvent.click(screen.getByRole('button', { name: 'Create Draft' }));

    expect(await screen.findByRole('heading', { name: 'Revise Draft' })).toBeVisible();
    expect(screen.getByLabelText('Draft body')).toHaveValue('Owner body');
    expect(createDraft).toHaveBeenCalledWith(
      opportunity,
      { title: 'Browser title', body: 'Browser body' },
      expect.stringMatching(/^content-studio:create:/)
    );
    expect(find).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Browser body')).not.toBeInTheDocument();
  });

  it('targets only the exact current Draft for revision and Ready for Human Review', async () => {
    const historical = {
      ...draft,
      version: 1,
      status: 'DRAFT' as const,
      title: 'Historical title'
    };
    const current = {
      ...draft,
      version: 3,
      status: 'DRAFT' as const,
      title: 'Current title',
      body: 'Current body'
    };
    const before = detailFixture({
      drafts: [current],
      reviewedDrafts: [historical],
      reviews: [],
      packages: [],
      feedback: []
    });
    const after = detailFixture({
      drafts: [{ ...current, version: 4, status: 'READY_FOR_HUMAN_REVIEW' }],
      reviewedDrafts: [historical],
      reviews: [],
      packages: [],
      feedback: []
    });
    const client = fixtureClient();
    client.find = vi
      .fn<ContentStudioClient['find']>()
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(after);
    const markReadyForReview = vi.fn(() => Promise.resolve(after.drafts[0]!));
    client.markReadyForReview = markReadyForReview;
    render(
      <ContentStudio
        workspaceId={fixtureWorkspaceId}
        client={client}
        initialContentOpportunityId={opportunity.contentOpportunityId}
      />
    );

    expect(
      await screen.findByText(/targets only current Draft content-draft_413 version 3/)
    ).toBeVisible();
    expect(screen.getByText('Draft · exact version 1')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Ready for Human Review' }));
    expect(markReadyForReview).toHaveBeenCalledWith(
      current,
      expect.stringMatching(/^content-studio:ready:/)
    );
    expect(await screen.findByRole('heading', { name: 'Explicit Human Review' })).toBeVisible();
  });

  it.each(['APPROVED_FOR_PUBLISH_PACKAGE', 'CHANGES_REQUIRED', 'REJECTED'] as const)(
    'records explicit human Review outcome %s without browser reviewer identity',
    async (outcome) => {
      const ready = { ...draft, version: 4, status: 'READY_FOR_HUMAN_REVIEW' as const };
      const before = detailFixture({
        drafts: [ready],
        reviewedDrafts: [],
        reviews: [],
        packages: [],
        feedback: []
      });
      const decision = {
        ...review,
        contentDraft: { id: ready.contentDraftId, version: ready.version },
        outcome,
        rationale: 'Human rationale'
      };
      const after = detailFixture({
        drafts: [ready],
        reviewedDrafts: [ready],
        reviews: [decision],
        packages: [],
        feedback: []
      });
      const client = fixtureClient();
      client.find = vi
        .fn<ContentStudioClient['find']>()
        .mockResolvedValueOnce(before)
        .mockResolvedValueOnce(after);
      const recordReview = vi.fn(() => Promise.resolve(decision));
      client.recordReview = recordReview;
      render(
        <ContentStudio
          workspaceId={fixtureWorkspaceId}
          client={client}
          initialContentOpportunityId={opportunity.contentOpportunityId}
        />
      );

      await screen.findByRole('heading', { name: 'Explicit Human Review' });
      await userEvent.selectOptions(screen.getByLabelText('Review outcome'), outcome);
      await userEvent.type(screen.getByLabelText('Review rationale'), 'Human rationale');
      expect(screen.queryByLabelText(/reviewer/i)).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Record Human Review' }));
      expect(recordReview).toHaveBeenCalledWith(
        ready,
        { outcome, rationale: 'Human rationale' },
        expect.stringMatching(/^content-studio:review:/)
      );
      expect(await screen.findByText(outcome)).toBeVisible();
    }
  );

  it('prepares a PublishPackage only from the exact current approved Review and reloads owner truth', async () => {
    const approved = detailFixture({ packages: [], feedback: [] });
    const packaged = detailFixture({ feedback: [] });
    const client = fixtureClient();
    client.find = vi
      .fn<ContentStudioClient['find']>()
      .mockResolvedValueOnce(approved)
      .mockResolvedValueOnce(packaged);
    const preparePublishPackage = vi.fn(() => Promise.resolve(publishPackage));
    client.preparePublishPackage = preparePublishPackage;
    render(
      <ContentStudio
        workspaceId={fixtureWorkspaceId}
        client={client}
        initialContentOpportunityId={opportunity.contentOpportunityId}
      />
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Prepare PublishPackage' }));
    expect(preparePublishPackage).toHaveBeenCalledWith(
      draft,
      review,
      expect.stringMatching(/^content-studio:package:/)
    );
    expect(
      await screen.findByText(new RegExp(`${publishPackage.publishPackageId}.*version`))
    ).toBeVisible();
    expect(screen.getByText(/External publish executed by MarkOrbit:/)).toHaveTextContent('No');
  });

  it.each([
    ['CHANGES_REQUIRED', true],
    ['REJECTED', false]
  ] as const)('does not expose false package preparation for %s', async (outcome, revisable) => {
    const current = { ...draft, status: outcome };
    const decision = { ...review, outcome };
    render(
      <ContentStudio
        workspaceId={fixtureWorkspaceId}
        client={fixtureClient(
          listFixture(),
          detailFixture({
            drafts: [current],
            reviewedDrafts: [current],
            reviews: [decision],
            packages: [],
            feedback: []
          })
        )}
        initialContentOpportunityId={opportunity.contentOpportunityId}
      />
    );
    if (revisable)
      expect(await screen.findByRole('button', { name: 'Revise Draft' })).toBeVisible();
    else expect(await screen.findByText(/does not invent a reopen or package path/)).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Prepare PublishPackage' })
    ).not.toBeInTheDocument();
  });

  it.each([
    [409, 'Owner truth changed'],
    [422, 'Owner validation failed'],
    [503, 'Preparation owner unavailable']
  ] as const)(
    'preserves loaded lineage and form content when revision fails with %s',
    async (status, errorTitle) => {
      const current = { ...draft, status: 'DRAFT' as const };
      const detail = detailFixture({
        drafts: [current],
        reviewedDrafts: [],
        reviews: [],
        packages: [],
        feedback: []
      });
      const client = fixtureClient(listFixture(), detail);
      client.reviseDraft = vi.fn(() =>
        Promise.reject(new ContentStudioHttpError(status, 'OWNER_FAILURE', 'Exact owner message'))
      );
      render(
        <ContentStudio
          workspaceId={fixtureWorkspaceId}
          client={client}
          initialContentOpportunityId={opportunity.contentOpportunityId}
        />
      );
      const body = await screen.findByLabelText('Draft body');
      await userEvent.clear(body);
      await userEvent.type(body, 'Unsaved retained body');
      expect(screen.getByRole('button', { name: 'Ready for Human Review' })).toBeDisabled();
      await userEvent.click(screen.getByRole('button', { name: 'Revise Draft' }));
      expect(await screen.findByText(errorTitle)).toBeVisible();
      expect(screen.getByLabelText('Draft body')).toHaveValue('Unsaved retained body');
      expect(screen.getByText(`Draft · exact version ${current.version}`)).toBeVisible();
    }
  );

  it('reports a successful write whose durable refresh fails and retains its logical idempotency key for retry', async () => {
    const current = { ...draft, status: 'DRAFT' as const };
    const detail = detailFixture({
      drafts: [current],
      reviewedDrafts: [],
      reviews: [],
      packages: [],
      feedback: []
    });
    const client = fixtureClient(listFixture(), detail);
    client.find = vi
      .fn<ContentStudioClient['find']>()
      .mockResolvedValueOnce(detail)
      .mockRejectedValueOnce(
        new ContentStudioHttpError(503, 'PERSISTENCE_UNAVAILABLE', 'reload failed')
      )
      .mockResolvedValueOnce({
        ...detail,
        drafts: [{ ...current, version: current.version + 1 }]
      });
    const reviseDraft = vi.fn<ContentStudioClient['reviseDraft']>(() =>
      Promise.resolve({ ...current, version: current.version + 1 })
    );
    client.reviseDraft = reviseDraft;
    render(
      <ContentStudio
        workspaceId={fixtureWorkspaceId}
        client={client}
        initialContentOpportunityId={opportunity.contentOpportunityId}
      />
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Revise Draft' }));
    expect(await screen.findByText('Write may have succeeded')).toBeVisible();
    expect(screen.getByText(`Draft · exact version ${current.version}`)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Revise Draft' }));

    expect(await screen.findByText(`Draft · exact version ${current.version + 1}`)).toBeVisible();
    expect(reviseDraft).toHaveBeenCalledTimes(2);
    expect(reviseDraft.mock.calls[0]?.[2]).toBe(reviseDraft.mock.calls[1]?.[2]);
  });

  it('uses a new idempotency key when a failed form payload is materially changed', async () => {
    const current = { ...draft, status: 'DRAFT' as const };
    const detail = detailFixture({
      drafts: [current],
      reviewedDrafts: [],
      reviews: [],
      packages: [],
      feedback: []
    });
    const client = fixtureClient(listFixture(), detail);
    const reviseDraft = vi.fn<ContentStudioClient['reviseDraft']>(() =>
      Promise.reject(new ContentStudioHttpError(409, 'VERSION_CONFLICT', 'conflict'))
    );
    client.reviseDraft = reviseDraft;
    render(
      <ContentStudio
        workspaceId={fixtureWorkspaceId}
        client={client}
        initialContentOpportunityId={opportunity.contentOpportunityId}
      />
    );
    const body = await screen.findByLabelText('Draft body');
    await userEvent.click(screen.getByRole('button', { name: 'Revise Draft' }));
    await screen.findByText('Owner truth changed');
    await userEvent.type(body, ' changed');
    await userEvent.click(screen.getByRole('button', { name: 'Revise Draft' }));
    await screen.findByText('Owner truth changed');

    expect(reviseDraft).toHaveBeenCalledTimes(2);
    expect(reviseDraft.mock.calls[0]?.[2]).not.toBe(reviseDraft.mock.calls[1]?.[2]);
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
        client={{ ...fixtureClient(), list, find: vi.fn(), recordUseFeedback: vi.fn() }}
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
      ...fixtureClient(),
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
        client={{ ...fixtureClient(), list: vi.fn(), find, recordUseFeedback }}
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
      ...fixtureClient(),
      list: () => Promise.reject(new ContentStudioHttpError(status, 'OWNER_ERROR', 'failed')),
      find: () => Promise.reject(new Error('unused')),
      recordUseFeedback: () => Promise.reject(new Error('unused'))
    };
    render(<ContentStudio workspaceId={fixtureWorkspaceId} client={client} />);
    expect(await screen.findByRole('heading', { name: title })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'No content work yet' })).not.toBeInTheDocument();
  });
});
