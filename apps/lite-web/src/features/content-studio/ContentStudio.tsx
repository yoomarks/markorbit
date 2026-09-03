import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Select,
  TextInput
} from '@markorbit/ui';
import type {
  ContentDraft,
  ContentDraftStatus,
  ContentReviewDecision,
  ContentReviewOutcome,
  PublishPackage
} from '@markorbit/contracts/product-loop';
import {
  ContentStudioHttpError,
  createContentStudioClient,
  type ContentStudioClient,
  type ContentStudioFeedbackOutcome,
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

export function contentWorkStage(
  work: Readonly<Pick<ContentStudioWorkSummary, 'latestDraft'>>
): string {
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

export type ContentTriageFilter =
  | 'ALL'
  | 'NEEDS_ACTION'
  | 'DRAFTING'
  | 'READY_FOR_REVIEW'
  | 'CHANGES_REQUIRED'
  | 'PACKAGE_READY'
  | 'PACKAGE_PRESENT';

function exactCurrentPackage(work: Readonly<ContentStudioWorkSummary>) {
  const draft = work.latestDraft;
  const publishPackage = work.latestPublishPackage;
  return Boolean(
    draft &&
      publishPackage &&
      publishPackage.contentDraft.id === draft.contentDraftId &&
      Number(publishPackage.contentDraft.version) === draft.version
  );
}

export function contentWorkTriage(
  work: Readonly<ContentStudioWorkSummary>
): ContentTriageFilter {
  if (!work.latestDraft) return 'NEEDS_ACTION';
  switch (work.latestDraft.status) {
    case 'DRAFT':
      return 'DRAFTING';
    case 'READY_FOR_HUMAN_REVIEW':
      return 'READY_FOR_REVIEW';
    case 'CHANGES_REQUIRED':
      return 'CHANGES_REQUIRED';
    case 'REVIEWED_READY_FOR_PACKAGE':
      return exactCurrentPackage(work) ? 'PACKAGE_PRESENT' : 'PACKAGE_READY';
    default:
      return 'ALL';
  }
}

export function contentWorkNextFocus(work: Readonly<ContentStudioWorkSummary>): string {
  if (!work.latestDraft) return 'Create the first Draft';
  switch (work.latestDraft.status) {
    case 'DRAFT':
      return 'Continue drafting or mark ready for human review';
    case 'READY_FOR_HUMAN_REVIEW':
      return 'Human review required';
    case 'CHANGES_REQUIRED':
      return 'Revise the current Draft';
    case 'REVIEWED_READY_FOR_PACKAGE':
      return exactCurrentPackage(work) ? 'PublishPackage prepared' : 'Prepare PublishPackage';
    case 'REJECTED':
      return 'No preparation action available';
    case 'SUPERSEDED':
      return 'Read-only historical state';
  }
}

function date(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value)
  );
}

function newIdempotencyKey(action: string) {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `content-studio:${action}:${id}`;
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

function FeedbackFailure({ error }: { error: ContentStudioHttpError }) {
  const copy =
    error.status === 401
      ? ['Sign in required', 'An authenticated session is required to record package feedback.']
      : error.status === 403
        ? [
            'Feedback permission required',
            'Permission or CSRF validation denied this feedback request.'
          ]
        : error.status === 404
          ? [
              'Publish Package unavailable',
              'This exact Publish Package is unavailable in the current Workspace.'
            ]
          : error.status === 409
            ? [
                'Package truth may have changed',
                'The package version, fingerprint, or prior idempotent request conflicts with current owner truth. Reload the durable detail before trying again.'
              ]
            : error.status === 503
              ? [
                  'Feedback service unavailable',
                  'The owner could not record or reload durable feedback. The loaded lineage remains unchanged.'
                ]
              : ['Feedback could not be saved', error.message];
  return (
    <Alert tone="danger" title={copy[0] ?? 'Feedback could not be saved'}>
      {copy[1] ?? error.message}
    </Alert>
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
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ContentTriageFilter>('ALL');
  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...value.items]
      .filter((work) => {
        if (filter !== 'ALL' && contentWorkTriage(work) !== filter) return false;
        if (!normalizedQuery) return true;
        return `${work.title} ${work.rationale}`.toLowerCase().includes(normalizedQuery);
      })
      .sort(
        (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
      );
  }, [filter, query, value.items]);

  return (
    <>
      <PageHeader
        title="Content Studio"
        description="Durable content work in this Workspace"
        actions={<Badge>Governed preparation</Badge>}
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
        <>
          <div
            className="content-studio__triage"
            role="search"
            aria-label="Content work triage"
          >
            <TextInput
              label="Search loaded content work"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Select
              label="Current work state"
              value={filter}
              onChange={(event) => setFilter(event.target.value as ContentTriageFilter)}
            >
              <option value="ALL">All loaded work</option>
              <option value="NEEDS_ACTION">Needs first Draft</option>
              <option value="DRAFTING">Drafting</option>
              <option value="READY_FOR_REVIEW">Ready for review</option>
              <option value="CHANGES_REQUIRED">Changes required</option>
              <option value="PACKAGE_READY">Package ready</option>
              <option value="PACKAGE_PRESENT">Package present</option>
            </Select>
          </div>
          <p className="content-studio__loaded-count" role="status">
            Showing {visible.length} of {value.items.length} loaded work items.
          </p>
          {visible.length ? (
            <div className="content-studio__list" aria-live="polite">
              {visible.map((work) => (
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
                  <dl className="content-studio__facts content-studio__facts--scan">
                    <div>
                      <dt>Next focus</dt>
                      <dd>{contentWorkNextFocus(work)}</dd>
                    </div>
                    <div>
                      <dt>Updated</dt>
                      <dd>{date(work.updatedAt)}</dd>
                    </div>
                  </dl>
                  <details>
                    <summary>Owner lineage and provenance</summary>
                    <dl className="content-studio__facts">
                      <div>
                        <dt>Stable ID</dt>
                        <dd>{work.contentOpportunity.id}</dd>
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
                      <div>
                        <dt>Durable Visual Briefs</dt>
                        <dd>{work.visualBriefCount}</dd>
                      </div>
                      <div>
                        <dt>Durable Visual Outputs</dt>
                        <dd>{work.visualOutputCount}</dd>
                      </div>
                    </dl>
                    <SourceList sources={work.sources} />
                  </details>
                  <Button onClick={() => open(work.contentOpportunity.id)}>
                    Open current work
                  </Button>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No loaded content work matches these filters"
              description="Search and state filters only narrow owner work already loaded in this browser."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery('');
                    setFilter('ALL');
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          )}
          {value.nextAfter ? (
            <Button variant="secondary" disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? 'Loading more…' : 'Load more content work'}
            </Button>
          ) : null}
        </>
      )}
    </>
  );
}

function VisualLineage({ value }: { value: ContentStudioWorkDetail }) {
  const hasKnownHistory = value.visualBriefs.length > 0 || value.visualOutputs.length > 0;
  return (
    <section className="content-studio__visual-lineage" aria-labelledby="visual-lineage-heading">
      <div>
        <p className="content-studio__eyebrow">Read-only owner history</p>
        <h2 id="visual-lineage-heading">Visual / Media lineage</h2>
        <p>
          Exact Visual Brief versions and their known Visual Outputs. Opaque references are shown as
          provenance identifiers, not artifact downloads.
        </p>
      </div>
      {!hasKnownHistory && !value.partial ? (
        <EmptyState
          title="No Visual / Media lineage"
          description="Owner coverage is complete and no Visual Briefs or Visual Outputs are linked to this exact Content Opportunity."
        />
      ) : null}
      {!hasKnownHistory && value.partial ? (
        <p className="content-studio__pending" role="status">
          No exactly linked Visual history is currently discoverable. Legacy Workspace history may
          exist, so this is unknown coverage rather than confirmation that no Visual work exists.
        </p>
      ) : null}
      {value.visualBriefs.length > 0 ? (
        <ol className="content-studio__visual-briefs">
          {value.visualBriefs.map((record) => {
            const brief = record.brief;
            const outputs = value.visualOutputs.filter(
              (output) =>
                output.visualBrief.id === brief.visualBriefId &&
                output.visualBrief.version === brief.version
            );
            return (
              <li key={`${brief.visualBriefId}:${brief.version}`}>
                <Card>
                  <p className="content-studio__eyebrow">
                    Visual Brief · exact version {brief.version}
                  </p>
                  <h3>{brief.title}</h3>
                  <dl className="content-studio__facts">
                    <div>
                      <dt>Visual Brief ID</dt>
                      <dd>{brief.visualBriefId}</dd>
                    </div>
                    <div>
                      <dt>Output kind</dt>
                      <dd>{brief.outputKind}</dd>
                    </div>
                    <div>
                      <dt>Aspect ratio</dt>
                      <dd>{brief.aspectRatio}</dd>
                    </div>
                    {brief.sceneIntent ? (
                      <div>
                        <dt>Scene intent</dt>
                        <dd>{brief.sceneIntent}</dd>
                      </div>
                    ) : null}
                    {brief.styleIntent ? (
                      <div>
                        <dt>Style intent</dt>
                        <dd>{brief.styleIntent}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Created</dt>
                      <dd>{date(brief.createdAt)}</dd>
                    </div>
                    <div>
                      <dt>Consumer identity</dt>
                      <dd>
                        IP {record.consumerIdentity.ipId} · style {record.consumerIdentity.styleId}
                      </dd>
                    </div>
                    <div>
                      <dt>Exact fingerprint</dt>
                      <dd>
                        <code>{record.visualBriefFingerprintSha256}</code>
                      </dd>
                    </div>
                  </dl>
                  <section
                    className="content-studio__nested"
                    aria-label={`Visual Outputs for ${brief.visualBriefId} version ${brief.version}`}
                  >
                    <h4>Visual Outputs for this exact Brief version</h4>
                    {outputs.length > 0 ? (
                      <ol className="content-studio__visual-outputs">
                        {outputs.map((output) => (
                          <li key={`${output.visualOutputReferenceId}:${output.version}`}>
                            <p className="content-studio__eyebrow">
                              Visual Output · exact version {output.version}
                            </p>
                            <dl className="content-studio__facts">
                              <div>
                                <dt>Visual Output ID</dt>
                                <dd>{output.visualOutputReferenceId}</dd>
                              </div>
                              <div>
                                <dt>Status</dt>
                                <dd>{output.status}</dd>
                              </div>
                              <div>
                                <dt>Request reference</dt>
                                <dd>{output.requestReference}</dd>
                              </div>
                              {output.outputReference ? (
                                <div>
                                  <dt>Output reference</dt>
                                  <dd>{output.outputReference}</dd>
                                </div>
                              ) : null}
                              {output.qcStatus ? (
                                <div>
                                  <dt>QC status</dt>
                                  <dd>{output.qcStatus}</dd>
                                </div>
                              ) : null}
                              <div>
                                <dt>Created</dt>
                                <dd>{date(output.createdAt)}</dd>
                              </div>
                              <div>
                                <dt>Provider execution authorized by Lite</dt>
                                <dd>{output.providerExecutionAuthorizedByLite ? 'Yes' : 'No'}</dd>
                              </div>
                              <div>
                                <dt>Paid execution authorized by Lite</dt>
                                <dd>{output.paidExecutionAuthorizedByLite ? 'Yes' : 'No'}</dd>
                              </div>
                            </dl>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="content-studio__pending">
                        No Visual Output is linked to this exact Visual Brief version.
                      </p>
                    )}
                  </section>
                </Card>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
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

export function currentDraft(detail: Readonly<ContentStudioWorkDetail>) {
  return [...detail.drafts, ...detail.reviewedDrafts].reduce<ContentDraft | undefined>(
    (latest, draft) => (!latest || draft.version > latest.version ? draft : latest),
    undefined
  );
}

function MutationFailure({ error }: { error: ContentStudioHttpError }) {
  const copy =
    error.code === 'DURABLE_RELOAD_FAILED'
      ? [
          'Write may have succeeded',
          'The owner accepted the write, but current durable truth could not be reloaded. Reload before taking another action.'
        ]
      : error.status === 401
        ? ['Sign in required', 'An authenticated session is required for this preparation action.']
        : error.status === 403
          ? [
              'Preparation permission required',
              'Permission, Origin, or CSRF validation denied this preparation action.'
            ]
          : error.status === 404
            ? [
                'Exact work unavailable',
                'This exact work or Draft is unavailable in the current Workspace.'
              ]
            : error.status === 409
              ? [
                  'Owner truth changed',
                  'The version, fingerprint, transition, prior decision, package, or idempotency state conflicts with current owner truth. Reload durable detail before trying again.'
                ]
              : error.status === 422
                ? ['Owner validation failed', error.message]
                : error.status === 503
                  ? [
                      'Preparation owner unavailable',
                      'The owner or persistence boundary is unavailable. Loaded lineage and form input remain unchanged.'
                    ]
                  : ['Preparation action failed', error.message];
  return (
    <Alert tone="danger" title={copy[0] ?? 'Preparation action failed'}>
      {copy[1] ?? error.message}
    </Alert>
  );
}

type PreparationInput = Readonly<{ title: string; body: string }>;
type ReviewInput = Readonly<{ outcome: ContentReviewOutcome; rationale: string }>;

function PreparationWorkspace({
  value,
  busyAction,
  mutationError,
  createDraft,
  reviseDraft,
  markReady,
  recordReview,
  preparePackage
}: {
  value: ContentStudioWorkDetail;
  busyAction: string;
  mutationError: { action: string; error: ContentStudioHttpError } | undefined;
  createDraft: (input: PreparationInput) => void;
  reviseDraft: (draft: ContentDraft, input: PreparationInput) => void;
  markReady: (draft: ContentDraft) => void;
  recordReview: (draft: ContentDraft, input: ReviewInput) => void;
  preparePackage: (draft: ContentDraft, review: ContentReviewDecision) => void;
}) {
  const draft = currentDraft(value);
  const review = draft ? reviewFor(value, draft.contentDraftId, draft.version) : undefined;
  const packages = review ? packageReviews(value, review) : [];
  const [title, setTitle] = useState(draft?.title ?? value.opportunity.title);
  const [body, setBody] = useState(draft?.body ?? '');
  const [outcome, setOutcome] = useState<ContentReviewOutcome>('APPROVED_FOR_PUBLISH_PACKAGE');
  const [rationale, setRationale] = useState('');
  useEffect(() => {
    setTitle(draft?.title ?? value.opportunity.title);
    setBody(draft?.body ?? '');
    setOutcome('APPROVED_FOR_PUBLISH_PACKAGE');
    setRationale('');
  }, [draft?.contentDraftId, draft?.version, value.opportunity.title]);
  const editable =
    draft?.status === 'DRAFT' ||
    draft?.status === 'CHANGES_REQUIRED' ||
    review?.outcome === 'CHANGES_REQUIRED';
  const canReview = draft?.status === 'READY_FOR_HUMAN_REVIEW' && !review;
  const canPackage = review?.outcome === 'APPROVED_FOR_PUBLISH_PACKAGE' && packages.length === 0;
  const busy = busyAction !== '';
  const hasUnsavedRevision = Boolean(draft && (title !== draft.title || body !== draft.body));

  return (
    <section className="content-studio__preparation" aria-labelledby="preparation-heading">
      <div className="content-studio__row">
        <div>
          <p className="content-studio__eyebrow">Governed preparation workspace</p>
          <h2 id="preparation-heading">Current owner-permitted action</h2>
        </div>
        {draft ? <Badge>{contentWorkStage({ latestDraft: draft })}</Badge> : null}
      </div>
      {!draft && value.opportunity.status === 'ACCEPTED_FOR_PREPARATION' ? (
        <Card>
          <h3>Create Draft</h3>
          <p>
            Create the first Draft against this exact accepted Content Opportunity version and
            fingerprint.
          </p>
          <form
            className="content-studio__form"
            onSubmit={(event) => {
              event.preventDefault();
              createDraft({ title, body });
            }}
          >
            <label>
              Draft title
              <input
                value={title}
                maxLength={500}
                required
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label>
              Draft body
              <textarea
                value={body}
                maxLength={100000}
                required
                rows={10}
                onChange={(event) => setBody(event.target.value)}
              />
            </label>
            <Button type="submit" disabled={busy}>
              {busyAction === 'create' ? 'Creating and reloading…' : 'Create Draft'}
            </Button>
          </form>
          {mutationError?.action === 'create' ? (
            <MutationFailure error={mutationError.error} />
          ) : null}
        </Card>
      ) : draft && editable ? (
        <Card>
          <h3>
            {review?.outcome === 'CHANGES_REQUIRED' || draft.status === 'CHANGES_REQUIRED'
              ? 'Revise changes-required Draft'
              : 'Revise Draft'}
          </h3>
          <p>
            This form targets only current Draft {draft.contentDraftId} version {draft.version}.
            Historical versions remain read-only lineage.
          </p>
          <form
            className="content-studio__form"
            onSubmit={(event) => {
              event.preventDefault();
              reviseDraft(draft, { title, body });
            }}
          >
            <label>
              Draft title
              <input
                value={title}
                maxLength={500}
                required
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label>
              Draft body
              <textarea
                value={body}
                maxLength={100000}
                required
                rows={10}
                onChange={(event) => setBody(event.target.value)}
              />
            </label>
            <div className="content-studio__form-actions">
              <Button type="submit" disabled={busy}>
                {busyAction === 'revise' ? 'Revising and reloading…' : 'Revise Draft'}
              </Button>
              {draft.status === 'DRAFT' && !review ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busyAction !== '' || hasUnsavedRevision}
                  onClick={() => markReady(draft)}
                >
                  {busyAction === 'ready'
                    ? 'Marking ready and reloading…'
                    : 'Ready for Human Review'}
                </Button>
              ) : null}
            </div>
            {draft.status === 'DRAFT' && hasUnsavedRevision ? (
              <p className="content-studio__pending" role="status">
                Save this revision before marking the durable Draft ready for Human Review.
              </p>
            ) : null}
          </form>
          {mutationError?.action === 'revise' || mutationError?.action === 'ready' ? (
            <MutationFailure error={mutationError.error} />
          ) : null}
        </Card>
      ) : draft && canReview ? (
        <Card>
          <h3>Explicit Human Review</h3>
          <p>
            Review the exact current Draft. Reviewer identity comes only from the authenticated
            Principal and is never supplied by this browser form.
          </p>
          <form
            className="content-studio__form"
            onSubmit={(event) => {
              event.preventDefault();
              recordReview(draft, { outcome, rationale });
            }}
          >
            <label>
              Review outcome
              <select
                value={outcome}
                onChange={(event) => setOutcome(event.target.value as ContentReviewOutcome)}
              >
                <option value="APPROVED_FOR_PUBLISH_PACKAGE">
                  Approved for PublishPackage preparation
                </option>
                <option value="CHANGES_REQUIRED">Changes required</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </label>
            <label>
              Review rationale
              <textarea
                value={rationale}
                maxLength={4000}
                required
                rows={5}
                onChange={(event) => setRationale(event.target.value)}
              />
            </label>
            <Button type="submit" disabled={busy}>
              {busyAction === 'review' ? 'Recording review and reloading…' : 'Record Human Review'}
            </Button>
          </form>
          {mutationError?.action === 'review' ? (
            <MutationFailure error={mutationError.error} />
          ) : null}
        </Card>
      ) : draft && canPackage && review ? (
        <Card>
          <h3>Prepare PublishPackage</h3>
          <p>
            The exact approved Human Review Decision permits package preparation. This does not
            publish externally.
          </p>
          <Button disabled={busy} onClick={() => preparePackage(draft, review)}>
            {busyAction === 'package'
              ? 'Preparing package and reloading…'
              : 'Prepare PublishPackage'}
          </Button>
          {mutationError?.action === 'package' ? (
            <MutationFailure error={mutationError.error} />
          ) : null}
        </Card>
      ) : (
        <Card>
          <h3>No preparation action available</h3>
          <p>
            {draft?.status === 'REJECTED' || review?.outcome === 'REJECTED'
              ? 'This exact Draft was rejected. Content Studio does not invent a reopen or package path.'
              : packages.length
                ? 'A PublishPackage is already prepared. It remains distinct from external publication.'
                : 'Current owner truth does not permit another preparation action.'}
          </p>
        </Card>
      )}
    </section>
  );
}

function WorkDetail({
  value,
  back,
  busyAction,
  mutationError,
  createDraft,
  reviseDraft,
  markReady,
  recordReview,
  preparePackage,
  recordFeedback,
  feedbackBusyPackage,
  feedbackError
}: {
  value: ContentStudioWorkDetail;
  back: () => void;
  busyAction: string;
  mutationError: { action: string; error: ContentStudioHttpError } | undefined;
  createDraft: (input: PreparationInput) => void;
  reviseDraft: (draft: ContentDraft, input: PreparationInput) => void;
  markReady: (draft: ContentDraft) => void;
  recordReview: (draft: ContentDraft, input: ReviewInput) => void;
  preparePackage: (draft: ContentDraft, review: ContentReviewDecision) => void;
  recordFeedback: (
    publishPackage: Readonly<PublishPackage>,
    outcome: ContentStudioFeedbackOutcome
  ) => void;
  feedbackBusyPackage: string;
  feedbackError: { packageKey: string; error: ContentStudioHttpError } | undefined;
}) {
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
      <PreparationWorkspace
        value={value}
        busyAction={busyAction || (feedbackBusyPackage ? 'feedback' : '')}
        mutationError={mutationError}
        createDraft={createDraft}
        reviseDraft={reviseDraft}
        markReady={markReady}
        recordReview={recordReview}
        preparePackage={preparePackage}
      />
      <VisualLineage value={value} />
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
                          const packageKey = `${pkg.publishPackageId}:${pkg.version}`;
                          const feedback = value.feedback.filter(
                            (item) =>
                              item.publishPackage.id === pkg.publishPackageId &&
                              Number(item.publishPackage.version) === pkg.version
                          );
                          return (
                            <section className="content-studio__nested" key={packageKey}>
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
                                <div className="content-studio__feedback">
                                  <p>
                                    No user-reported package feedback. Recording feedback does not
                                    publish externally or independently verify publication or use.
                                  </p>
                                  <div
                                    className="content-studio__feedback-actions"
                                    role="group"
                                    aria-label={`Record feedback for ${pkg.publishPackageId} version ${pkg.version}`}
                                  >
                                    {(
                                      [
                                        ['Published', 'USER_REPORTED_PUBLISHED'],
                                        ['Used', 'USER_REPORTED_USED'],
                                        ['Not used', 'NOT_USED']
                                      ] as const
                                    ).map(([label, outcome]) => (
                                      <Button
                                        key={outcome}
                                        variant="secondary"
                                        disabled={
                                          feedbackBusyPackage === packageKey || busyAction !== ''
                                        }
                                        onClick={() => recordFeedback(pkg, outcome)}
                                      >
                                        {label}
                                      </Button>
                                    ))}
                                  </div>
                                  {feedbackBusyPackage === packageKey ? (
                                    <p role="status">
                                      Recording feedback and reloading durable detail…
                                    </p>
                                  ) : null}
                                  {feedbackError?.packageKey === packageKey ? (
                                    <FeedbackFailure error={feedbackError.error} />
                                  ) : null}
                                </div>
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
  const [feedbackBusyPackage, setFeedbackBusyPackage] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [mutationError, setMutationError] = useState<{
    action: string;
    error: ContentStudioHttpError;
  }>();
  const [feedbackError, setFeedbackError] = useState<{
    packageKey: string;
    error: ContentStudioHttpError;
  }>();
  const [retryVersion, setRetryVersion] = useState(0);
  const origin = useRef<HTMLButtonElement | null>(null);
  const preparationKeys = useRef(new Map<string, string>());

  const runPreparation = (
    action: string,
    payload: unknown,
    write: (idempotencyKey: string) => Promise<unknown>
  ) => {
    if (!detail || busyAction) return;
    const signature = `${action}:${JSON.stringify(payload)}`;
    const key = preparationKeys.current.get(signature) ?? newIdempotencyKey(action);
    preparationKeys.current.set(signature, key);
    setBusyAction(action);
    setMutationError(undefined);
    let writeSucceeded = false;
    write(key)
      .then(() => {
        writeSucceeded = true;
        return client.find(detail.opportunity.contentOpportunityId);
      })
      .then((next) => {
        setDetail(next);
        preparationKeys.current.delete(signature);
      })
      .catch((cause) => {
        const error =
          cause instanceof ContentStudioHttpError
            ? cause
            : new ContentStudioHttpError(
                503,
                writeSucceeded ? 'DURABLE_RELOAD_FAILED' : 'PREPARATION_MUTATION_FAILED',
                cause instanceof Error ? cause.message : 'Preparation action failed.'
              );
        setMutationError({
          action,
          error: writeSucceeded
            ? new ContentStudioHttpError(503, 'DURABLE_RELOAD_FAILED', error.message)
            : error
        });
      })
      .finally(() => setBusyAction(''));
  };

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
    setFeedbackError(undefined);
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
        busyAction={busyAction}
        mutationError={mutationError}
        createDraft={(input) =>
          runPreparation('create', input, (key) =>
            client.createDraft(detail.opportunity, input, key)
          )
        }
        reviseDraft={(draft, input) =>
          runPreparation(
            'revise',
            { draftId: draft.contentDraftId, version: draft.version, ...input },
            (key) => client.reviseDraft(draft, input, key)
          )
        }
        markReady={(draft) =>
          runPreparation(
            'ready',
            { draftId: draft.contentDraftId, version: draft.version },
            (key) => client.markReadyForReview(draft, key)
          )
        }
        recordReview={(draft, input) =>
          runPreparation(
            'review',
            { draftId: draft.contentDraftId, version: draft.version, ...input },
            (key) => client.recordReview(draft, input, key)
          )
        }
        preparePackage={(draft, review) =>
          runPreparation(
            'package',
            {
              draftId: draft.contentDraftId,
              draftVersion: draft.version,
              reviewId: review.contentReviewDecisionId,
              reviewVersion: review.version
            },
            (key) => client.preparePublishPackage(draft, review, key)
          )
        }
        feedbackBusyPackage={feedbackBusyPackage}
        feedbackError={feedbackError}
        recordFeedback={(publishPackage, outcome) => {
          const packageKey = `${publishPackage.publishPackageId}:${publishPackage.version}`;
          setFeedbackBusyPackage(packageKey);
          setFeedbackError(undefined);
          client
            .recordUseFeedback(publishPackage, outcome)
            .then(() => client.find(detail.opportunity.contentOpportunityId))
            .then(setDetail)
            .catch((cause) =>
              setFeedbackError({
                packageKey,
                error:
                  cause instanceof ContentStudioHttpError
                    ? cause
                    : new ContentStudioHttpError(
                        503,
                        'FEEDBACK_RECORD_FAILED',
                        'Feedback could not be saved.'
                      )
              })
            )
            .finally(() => setFeedbackBusyPackage(''));
        }}
        back={() => {
          setMutationError(undefined);
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
