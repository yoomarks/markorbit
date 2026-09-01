import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader
} from '@markorbit/ui';
import type { ContentDraftStatus, ContentReviewDecision } from '@markorbit/contracts/product-loop';
import {
  ContentStudioHttpError,
  createContentStudioClient,
  type ContentStudioClient,
  type ContentStudioWorkDetail,
  type ContentStudioWorkList,
  type ContentStudioWorkSummary
} from '../../api/content-studio.js';
import './content-studio.css';

export interface ContentStudioProps {
  workspaceId: string;
  client?: ContentStudioClient;
  initialContentOpportunityId?: string;
}

export function contentWorkStage(work: Readonly<ContentStudioWorkSummary>): string {
  if (!work.latestDraft) return 'Content Opportunity created';
  const labels: Record<ContentDraftStatus, string> = {
    DRAFT: 'Draft in progress',
    READY_FOR_HUMAN_REVIEW: 'Ready for human review',
    REVIEWED_READY_FOR_PACKAGE: 'Reviewed draft ready for package',
    CHANGES_REQUIRED: 'Draft changes required',
    REJECTED: 'Draft rejected',
    SUPERSEDED: 'Draft superseded'
  };
  return labels[work.latestDraft.status];
}

function date(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value)
  );
}

function PartialWarning() {
  return (
    <Alert tone="warning" title="Visual and media history is partially discoverable">
      Historical visual/media lineage is not fully discoverable yet. This does not mean that no
      visual work exists.
    </Alert>
  );
}

function Failure({ error, retry }: { error: ContentStudioHttpError; retry: () => void }) {
  const copy =
    error.status === 401
      ? ['Sign in required', 'An authenticated session is required to open this Content Studio.']
      : error.status === 403
        ? [
            'Content Studio permission required',
            'You do not have permission to read content work in this Workspace.'
          ]
        : error.status === 404
          ? ['Content work not found', 'This work is unavailable in the current Workspace.']
          : error.status === 503
            ? [
                'Content Studio unavailable',
                'Content work could not be loaded from its owner. No empty state has been inferred.'
              ]
            : ['Content Studio request failed', error.message];
  return (
    <ErrorState
      title={copy[0] ?? 'Content Studio request failed'}
      description={copy[1] ?? error.message}
      onRetry={retry}
    />
  );
}

function SourceList({ sources }: { sources: ContentStudioWorkSummary['sources'] }) {
  return (
    <ul className="content-studio__sources">
      {sources.map((source) => (
        <li key={`${source.owner}:${source.sourceId}:${source.sourceVersion}`}>
          <strong>
            {source.owner} · {source.kind}
          </strong>
          <span>
            {source.sourceId} · version {source.sourceVersion}
          </span>
          <span>Observed {date(source.observedAt)}</span>
        </li>
      ))}
    </ul>
  );
}

function WorkList({
  value,
  open,
  loadMore,
  loadingMore
}: {
  value: ContentStudioWorkList;
  open: (id: string) => void;
  loadMore: () => void;
  loadingMore: boolean;
}) {
  return (
    <>
      <PageHeader
        title="Content Studio"
        description="Durable content work in this Workspace"
        actions={<Badge>Read only</Badge>}
      />
      <p className="content-studio__intro">
        Today discovers and coordinates daily work. Content Studio keeps the durable Content
        Opportunity lineage.
      </p>
      {value.partial ? <PartialWarning /> : null}
      {value.items.length === 0 ? (
        <EmptyState
          title="No content work yet"
          description="This Workspace has no durable Content Opportunities to show."
          action={<a href="#today">Open Today</a>}
        />
      ) : (
        <div className="content-studio__list" aria-live="polite">
          {value.items.map((work) => (
            <Card key={`${work.contentOpportunity.id}:${work.contentOpportunity.version}`}>
              <div className="content-studio__row">
                <div>
                  <p className="content-studio__eyebrow">
                    Content Opportunity · version {work.contentOpportunity.version}
                  </p>
                  <h2>{work.title}</h2>
                </div>
                <Badge>{contentWorkStage(work)}</Badge>
              </div>
              <p>{work.rationale}</p>
              <dl className="content-studio__facts">
                <div>
                  <dt>Stable ID</dt>
                  <dd>{work.contentOpportunity.id}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{date(work.updatedAt)}</dd>
                </div>
                <div>
                  <dt>Latest exact Draft</dt>
                  <dd>
                    {work.latestDraft
                      ? `${work.latestDraft.contentDraftId} · v${work.latestDraft.version} · ${work.latestDraft.status}`
                      : 'Not created'}
                  </dd>
                </div>
                <div>
                  <dt>Latest Draft Review</dt>
                  <dd>
                    {work.latestDraftReview
                      ? `${work.latestDraftReview.outcome} · ${work.latestDraftReview.contentReviewDecisionId} v${work.latestDraftReview.version}`
                      : 'No exact Review Decision'}
                  </dd>
                </div>
                <div>
                  <dt>Latest Publish Package · work-level history</dt>
                  <dd>
                    {work.latestPublishPackage
                      ? `${work.latestPublishPackage.publishPackageId} · v${work.latestPublishPackage.version} · ${work.latestPublishPackage.status} · ${date(work.latestPublishPackage.createdAt)}`
                      : 'No Publish Package'}
                  </dd>
                </div>
                <div>
                  <dt>Latest Package Feedback · work-level history</dt>
                  <dd>
                    {work.latestPackageFeedback
                      ? `User-reported · ${work.latestPackageFeedback.outcome} · ${date(work.latestPackageFeedback.recordedAt)}`
                      : 'No user-reported feedback'}
                  </dd>
                </div>
              </dl>
              <details>
                <summary>Sources and provenance</summary>
                <SourceList sources={work.sources} />
              </details>
              <Button onClick={() => open(work.contentOpportunity.id)}>View lineage</Button>
            </Card>
          ))}
          {value.nextAfter ? (
            <Button variant="secondary" disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? 'Loading more…' : 'Load more content work'}
            </Button>
          ) : null}
        </div>
      )}
    </>
  );
}

function reviewFor(detail: ContentStudioWorkDetail, draftId: string, version: number) {
  return detail.reviews.find(
    (review) =>
      review.contentDraft.id === draftId && Number(review.contentDraft.version) === version
  );
}

function packageReviews(detail: ContentStudioWorkDetail, review: ContentReviewDecision) {
  return detail.publishPackages.filter(
    (pkg) =>
      pkg.reviewDecision.id === review.contentReviewDecisionId &&
      Number(pkg.reviewDecision.version) === review.version
  );
}

function WorkDetail({ value, back }: { value: ContentStudioWorkDetail; back: () => void }) {
  const { opportunity } = value;
  const drafts = [...value.drafts, ...value.reviewedDrafts].filter(
    (draft, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.contentDraftId === draft.contentDraftId && candidate.version === draft.version
      ) === index
  );
  return (
    <>
      <Button variant="secondary" onClick={back}>
        ← Back to Content Studio
      </Button>
      <PageHeader
        title={opportunity.title}
        description={`Content Opportunity · ${opportunity.contentOpportunityId} · version ${opportunity.version}`}
        actions={<Badge>{opportunity.status}</Badge>}
      />
      {value.partial ? <PartialWarning /> : null}
      <Alert title="Authority boundary">
        Human review is required. MarkOrbit does not publish externally here, and user-reported
        publication or use is not independently verified.
      </Alert>
      <Card>
        <h2>Content Opportunity</h2>
        <p>{opportunity.rationale}</p>
        <dl className="content-studio__facts">
          <div>
            <dt>Created</dt>
            <dd>{date(opportunity.createdAt)}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{date(opportunity.updatedAt)}</dd>
          </div>
          <div>
            <dt>Publish authorized</dt>
            <dd>No</dd>
          </div>
        </dl>
        <SourceList sources={opportunity.sources} />
      </Card>
      <section aria-labelledby="lineage-heading">
        <h2 id="lineage-heading">Version lineage</h2>
        {drafts.length === 0 ? (
          <EmptyState
            title="No draft yet"
            description="This Content Opportunity has no discoverable Draft."
          />
        ) : (
          <ol className="content-studio__lineage">
            {drafts.map((draft) => {
              const review = reviewFor(value, draft.contentDraftId, draft.version);
              const packages = review ? packageReviews(value, review) : [];
              return (
                <li key={`${draft.contentDraftId}:${draft.version}`}>
                  <Card>
                    <p className="content-studio__eyebrow">Draft · exact version {draft.version}</p>
                    <h3>{draft.title}</h3>
                    <p className="content-studio__body">{draft.body}</p>
                    <dl className="content-studio__facts">
                      <div>
                        <dt>Draft ID</dt>
                        <dd>{draft.contentDraftId}</dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>{draft.status}</dd>
                      </div>
                      <div>
                        <dt>Fingerprint</dt>
                        <dd>{draft.contentDraftFingerprintSha256}</dd>
                      </div>
                      <div>
                        <dt>Human review required</dt>
                        <dd>{draft.humanReviewRequired ? 'Yes' : 'No'}</dd>
                      </div>
                      <div>
                        <dt>Published in this lifecycle</dt>
                        <dd>{draft.published ? 'Yes' : 'No authority fact'}</dd>
                      </div>
                    </dl>
                    {review ? (
                      <section
                        className="content-studio__nested"
                        aria-label={`Review for ${draft.contentDraftId} version ${draft.version}`}
                      >
                        <h4>Exact human Review Decision</h4>
                        <p>
                          <strong>{review.outcome}</strong> · {review.rationale}
                        </p>
                        <p>
                          Review {review.contentReviewDecisionId} v{review.version} binds Draft v
                          {review.contentDraft.version} and fingerprint{' '}
                          <code>{review.expectedContentDraftFingerprintSha256}</code>.
                        </p>
                        {packages.map((pkg) => {
                          const feedback = value.feedback.filter(
                            (item) =>
                              item.publishPackage.id === pkg.publishPackageId &&
                              Number(item.publishPackage.version) === pkg.version
                          );
                          return (
                            <section
                              className="content-studio__nested"
                              key={`${pkg.publishPackageId}:${pkg.version}`}
                            >
                              <h5>Publish Package</h5>
                              <p>
                                {pkg.publishPackageId} · version {pkg.version}
                              </p>
                              <p>
                                Binds Draft {pkg.contentDraft.id} v{pkg.contentDraft.version} and
                                approving Review {pkg.reviewDecision.id} v
                                {pkg.reviewDecision.version}.
                              </p>
                              <p>
                                External publish executed by MarkOrbit:{' '}
                                <strong>{pkg.externalPublishExecuted ? 'Yes' : 'No'}</strong>
                              </p>
                              {feedback.length ? (
                                <ul>
                                  {feedback.map((item) => (
                                    <li key={`${item.productLoopFeedbackId}:${item.version}`}>
                                      <strong>{item.outcome}</strong> · reported{' '}
                                      {date(item.recordedAt)}
                                      <br />
                                      User-reported after-the-fact feedback; independently verified
                                      by MarkOrbit:{' '}
                                      {item.externalOutcomeVerifiedByMarkOrbit ? 'Yes' : 'No'}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p>No user-reported package feedback.</p>
                              )}
                            </section>
                          );
                        })}
                      </section>
                    ) : (
                      <p className="content-studio__pending">
                        No exact Review Decision for this Draft version.
                      </p>
                    )}
                  </Card>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </>
  );
}

export function ContentStudio({
  workspaceId,
  client: suppliedClient,
  initialContentOpportunityId
}: ContentStudioProps) {
  const client = useMemo(
    () => suppliedClient ?? createContentStudioClient(workspaceId),
    [suppliedClient, workspaceId]
  );
  const [list, setList] = useState<ContentStudioWorkList>();
  const [detail, setDetail] = useState<ContentStudioWorkDetail>();
  const [selected, setSelected] = useState(initialContentOpportunityId);
  const [error, setError] = useState<ContentStudioHttpError>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const origin = useRef<HTMLButtonElement | null>(null);

  const loadList = () => {
    setError(undefined);
    setList(undefined);
    client
      .list()
      .then(setList)
      .catch((cause) =>
        setError(
          cause instanceof ContentStudioHttpError
            ? cause
            : new ContentStudioHttpError(
                503,
                'DOWNSTREAM_UNAVAILABLE',
                'Content Studio is unavailable.'
              )
        )
      );
  };
  useEffect(() => {
    if (!selected) loadList();
  }, [client, selected]);
  useEffect(() => {
    if (!selected) {
      setDetail(undefined);
      return;
    }
    setError(undefined);
    setDetail(undefined);
    client
      .find(selected)
      .then(setDetail)
      .catch((cause) =>
        setError(
          cause instanceof ContentStudioHttpError
            ? cause
            : new ContentStudioHttpError(
                503,
                'DOWNSTREAM_UNAVAILABLE',
                'Content Studio is unavailable.'
              )
        )
      );
  }, [client, selected, retryVersion]);

  if (error)
    return (
      <Failure
        error={error}
        retry={selected ? () => setRetryVersion((value) => value + 1) : loadList}
      />
    );
  if (selected)
    return detail ? (
      <WorkDetail
        value={detail}
        back={() => {
          setSelected(undefined);
          setTimeout(() => origin.current?.focus());
        }}
      />
    ) : (
      <LoadingState label="Loading content work lineage" />
    );
  if (!list) return <LoadingState label="Loading Content Studio" />;
  return (
    <WorkList
      value={list}
      loadingMore={loadingMore}
      open={(id) => {
        origin.current = document.activeElement as HTMLButtonElement;
        setSelected(id);
      }}
      loadMore={() => {
        if (!list.nextAfter) return;
        setLoadingMore(true);
        client
          .list(list.nextAfter)
          .then((next) => setList({ ...next, items: [...list.items, ...next.items] }))
          .catch((cause) =>
            setError(
              cause instanceof ContentStudioHttpError
                ? cause
                : new ContentStudioHttpError(
                    503,
                    'DOWNSTREAM_UNAVAILABLE',
                    'Content Studio is unavailable.'
                  )
            )
          )
          .finally(() => setLoadingMore(false));
      }}
    />
  );
}
