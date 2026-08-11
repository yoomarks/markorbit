import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  PreparedActionJourney,
  ProductLoopUseFeedback,
  TodayRecommendation
} from '@markorbit/contracts/product-loop';
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
import {
  createTodayClient,
  TodayHttpError,
  type TodayClient,
  type TodayProductLoopSnapshot
} from '../../api/product-loop.js';
import './today.css';

export interface TodayWorkspaceProps {
  workspaceId: string;
  client?: TodayClient;
}

function querySelection() {
  const query = new URLSearchParams(window.location.search);
  return {
    recommendationId: query.get('todayRecommendationId') ?? '',
    preparedActionId: query.get('preparedActionId') ?? ''
  };
}

function setSelection(recommendationId: string, preparedActionId?: string) {
  const url = new URL(window.location.href);
  url.searchParams.set('todayRecommendationId', recommendationId);
  if (preparedActionId) url.searchParams.set('preparedActionId', preparedActionId);
  else url.searchParams.delete('preparedActionId');
  url.hash = 'today';
  window.history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function kindLabel(kind: TodayRecommendation['kind']) {
  if (kind === 'CONTENT_PREPARATION') return 'Content preparation';
  if (kind === 'OPPORTUNITY_REVIEW') return 'Opportunity review';
  if (kind === 'MARKREG_HANDOFF') return 'MarkReg handoff';
  return 'Work follow-up';
}

function feedbackLabel(outcome: ProductLoopUseFeedback['outcome']) {
  if (outcome === 'USER_REPORTED_PUBLISHED') return 'Reported published';
  if (outcome === 'USER_REPORTED_DELIVERED') return 'Reported delivered';
  if (outcome === 'USER_REPORTED_USED') return 'Reported used';
  return 'Reported not used';
}

function actionStatus(journey: PreparedActionJourney) {
  if (journey.handoffState === 'HANDOFF_COMPLETED') return 'Completed';
  if (journey.handoffState === 'HANDOFF_PENDING') return 'Confirmed · handoff pending';
  return 'Prepared · confirmation required';
}

function RecommendationList({
  snapshot,
  selectedId,
  onSelect
}: {
  snapshot: TodayProductLoopSnapshot;
  selectedId: string;
  onSelect: (recommendationId: string) => void;
}) {
  return (
    <Card>
      <div className="lite-row">
        <div>
          <h2>Needs your attention</h2>
          <p className="today-muted">Real Workspace recommendations, newest first.</p>
        </div>
        <Badge>{snapshot.items.length}</Badge>
      </div>
      <div className="today-recommendation-list" role="list" aria-label="Today recommendations">
        {snapshot.items.map(({ recommendation, preparedActions }) => (
          <button
            type="button"
            role="listitem"
            className={`today-recommendation ${
              selectedId === recommendation.todayRecommendationId
                ? 'today-recommendation--active'
                : ''
            }`}
            key={recommendation.todayRecommendationId}
            onClick={() => onSelect(recommendation.todayRecommendationId)}
            aria-current={selectedId === recommendation.todayRecommendationId ? 'true' : undefined}
          >
            <span className="today-recommendation__meta">
              <span>{kindLabel(recommendation.kind)}</span>
              <span>v{recommendation.version}</span>
            </span>
            <strong>{recommendation.title}</strong>
            <span>{recommendation.explanation}</span>
            <span className="today-recommendation__footer">
              <Badge>{recommendation.status}</Badge>
              {preparedActions[0] ? <small>{actionStatus(preparedActions[0])}</small> : null}
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}

function Provenance({ recommendation }: { recommendation: TodayRecommendation }) {
  return (
    <Card>
      <h2>Why this is here</h2>
      <p>{recommendation.explanation}</p>
      <h3>Exact sources</h3>
      <ul className="today-source-list">
        {recommendation.sources.map((source) => (
          <li
            key={`${source.owner}:${source.kind}:${source.sourceId}:${String(source.sourceVersion)}`}
          >
            <strong>
              {source.owner} · {source.kind}
            </strong>
            <span>{source.sourceId}</span>
            <small>
              version {String(source.sourceVersion)} · observed{' '}
              {new Date(source.observedAt).toLocaleString()}
            </small>
            <code title={source.sourceFingerprintSha256}>
              {source.sourceFingerprintSha256.slice(0, 16)}…
            </code>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function FeedbackEvidence({ feedback }: { feedback: ReadonlyArray<Readonly<ProductLoopUseFeedback>> }) {
  if (!feedback.length) return null;
  return (
    <Card>
      <div className="lite-row">
        <div>
          <h2>Recent Product-loop evidence</h2>
          <p className="today-muted">Returned outcomes from work already recorded in this Workspace.</p>
        </div>
        <Badge>{feedback.length}</Badge>
      </div>
      <Alert tone="info" title="User-reported evidence">
        These records describe what an authenticated user reported after the fact. MarkOrbit did not
        execute or independently verify the external action, and this evidence is not Capability
        verification.
      </Alert>
      <ul className="today-feedback-list">
        {feedback.map((item) => (
          <li key={item.productLoopFeedbackId}>
            <div>
              <strong>{feedbackLabel(item.outcome)}</strong>
              <span>
                {item.publishPackage.id} · v{String(item.publishPackage.version)}
              </span>
            </div>
            <small>{new Date(item.recordedAt).toLocaleString()}</small>
            {item.externalReference ? <code>{item.externalReference}</code> : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PreparedActionPanel({
  recommendation,
  journey,
  busy,
  onPrepare,
  onConfirm
}: {
  recommendation: TodayRecommendation;
  journey?: PreparedActionJourney;
  busy: 'prepare' | 'confirm' | '';
  onPrepare: () => void;
  onConfirm: () => void;
}) {
  if (!journey) {
    return (
      <Card>
        <h2>Prepared Action</h2>
        <p>
          Nothing has been prepared yet. A Recommendation can explain what should happen next, but
          it does not authorize a business mutation by itself.
        </p>
        {recommendation.kind === 'CONTENT_PREPARATION' ? (
          <>
            <Alert title="What Prepare will do">
              Create one Lite-owned Content Opportunity from this exact Recommendation. It will not
              publish externally, contact a customer, create an Order or Matter, or submit a filing.
            </Alert>
            <Button onClick={onPrepare} disabled={busy !== ''}>
              {busy === 'prepare' ? 'Preparing…' : 'Prepare content action'}
            </Button>
          </>
        ) : (
          <Alert tone="info" title="Exact handoff context required">
            This Recommendation needs structured owner context before a Prepared Action can be
            created. Lite will not infer customer intent, relationship model, qualification
            evidence, or a Formal Opportunity from display text.
          </Alert>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <div className="lite-row">
        <div>
          <h2>Prepared Action</h2>
          <p className="today-muted">
            {journey.preparedAction.preparedActionId} · v{journey.preparedAction.version}
          </p>
        </div>
        <Badge>{actionStatus(journey)}</Badge>
      </div>
      <p>{journey.preparedAction.summary}</p>
      <div className="today-confirmation-effect" role="note" aria-label="Confirmation effect">
        <strong>Confirmation effect</strong>
        <p>{journey.preparedAction.confirmationEffect}</p>
      </div>
      <dl className="today-definition-list">
        <div>
          <dt>Target owner</dt>
          <dd>{journey.preparedAction.handoffTarget}</dd>
        </div>
        <div>
          <dt>Source Recommendation</dt>
          <dd>
            {journey.preparedAction.recommendation.id} · v
            {String(journey.preparedAction.recommendation.version)}
          </dd>
        </div>
        <div>
          <dt>Execution authorized</dt>
          <dd>No</dd>
        </div>
      </dl>

      {journey.handoffState === 'AWAITING_CONFIRMATION' ? (
        <>
          <Alert tone="warning" title="Your confirmation is required">
            Review the effect above before confirming. Confirmation records your authenticated Core
            Principal and then attempts the bounded owner handoff.
          </Alert>
          <Button onClick={onConfirm} disabled={busy !== ''}>
            {busy === 'confirm' ? 'Confirming…' : 'Confirm and hand off'}
          </Button>
        </>
      ) : journey.handoffState === 'HANDOFF_PENDING' ? (
        <>
          <Alert tone="warning" title="Confirmed · owner handoff pending">
            Your confirmation is durable. The owner handoff did not complete yet; retrying reuses
            the same confirmation and idempotency boundary.
          </Alert>
          <Button onClick={onConfirm} disabled={busy !== ''}>
            {busy === 'confirm' ? 'Retrying…' : 'Retry owner handoff'}
          </Button>
        </>
      ) : (
        <Alert tone="success" title="Owner handoff completed">
          <p>
            {journey.handoffResult?.owner} owns record{' '}
            <strong>{journey.handoffResult?.ownerRecord.id}</strong> · version{' '}
            {String(journey.handoffResult?.ownerRecord.version)}.
          </p>
          <p>
            No automatic publication, customer outreach, Order, Matter, payment, provider
            appointment, filing or Official Truth was created by this handoff.
          </p>
        </Alert>
      )}
    </Card>
  );
}

export function TodayWorkspace({ workspaceId, client: suppliedClient }: TodayWorkspaceProps) {
  const client = useMemo(
    () => suppliedClient ?? createTodayClient(workspaceId),
    [suppliedClient, workspaceId]
  );
  const [snapshot, setSnapshot] = useState<TodayProductLoopSnapshot>();
  const [error, setError] = useState<TodayHttpError>();
  const [busy, setBusy] = useState<'prepare' | 'confirm' | ''>('');
  const [selection, setCurrentSelection] = useState(querySelection);
  const lastSelectedButton = useRef<string>();

  const reload = async () => {
    setError(undefined);
    try {
      setSnapshot(await client.loadToday());
    } catch (cause) {
      setError(
        cause instanceof TodayHttpError
          ? cause
          : new TodayHttpError(503, 'TODAY_REQUEST_FAILED', 'Lite Today is unavailable.')
      );
    }
  };

  useEffect(() => {
    void reload();
  }, [client]);

  useEffect(() => {
    const followLocation = () => setCurrentSelection(querySelection());
    window.addEventListener('popstate', followLocation);
    return () => window.removeEventListener('popstate', followLocation);
  }, []);

  useEffect(() => {
    if (!snapshot?.items.length) return;
    const requested = snapshot.items.find(
      ({ recommendation }) => recommendation.todayRecommendationId === selection.recommendationId
    );
    if (!requested) {
      const first = snapshot.items[0]!;
      setCurrentSelection({
        recommendationId: first.recommendation.todayRecommendationId,
        preparedActionId: first.preparedActions[0]?.preparedAction.preparedActionId ?? ''
      });
    }
  }, [snapshot, selection.recommendationId]);

  const item = snapshot?.items.find(
    ({ recommendation }) => recommendation.todayRecommendationId === selection.recommendationId
  );
  const journey =
    item?.preparedActions.find(
      ({ preparedAction }) => preparedAction.preparedActionId === selection.preparedActionId
    ) ?? item?.preparedActions[0];

  const selectRecommendation = (recommendationId: string) => {
    lastSelectedButton.current = recommendationId;
    const next = snapshot?.items.find(
      ({ recommendation }) => recommendation.todayRecommendationId === recommendationId
    );
    const preparedActionId = next?.preparedActions[0]?.preparedAction.preparedActionId;
    setSelection(recommendationId, preparedActionId);
    setCurrentSelection({ recommendationId, preparedActionId: preparedActionId ?? '' });
  };

  const prepare = async () => {
    if (!item) return;
    setBusy('prepare');
    setError(undefined);
    try {
      const created = await client.prepareContent(item.recommendation);
      await reload();
      setSelection(
        item.recommendation.todayRecommendationId,
        created.preparedAction.preparedActionId
      );
      setCurrentSelection({
        recommendationId: item.recommendation.todayRecommendationId,
        preparedActionId: created.preparedAction.preparedActionId
      });
    } catch (cause) {
      setError(
        cause instanceof TodayHttpError
          ? cause
          : new TodayHttpError(503, 'PREPARE_FAILED', 'Prepared Action could not be created.')
      );
    } finally {
      setBusy('');
    }
  };

  const confirm = async () => {
    if (!journey) return;
    setBusy('confirm');
    setError(undefined);
    try {
      const result = await client.confirm(journey);
      await reload();
      setSelection(
        item!.recommendation.todayRecommendationId,
        result.preparedAction.preparedActionId
      );
      setCurrentSelection({
        recommendationId: item!.recommendation.todayRecommendationId,
        preparedActionId: result.preparedAction.preparedActionId
      });
    } catch (cause) {
      const mapped =
        cause instanceof TodayHttpError
          ? cause
          : new TodayHttpError(503, 'HANDOFF_FAILED', 'Owner handoff did not complete.');
      setError(mapped);
      if (mapped.status === 503) await reload();
    } finally {
      setBusy('');
    }
  };

  if (!snapshot && !error) return <LoadingState label="Loading real Workspace recommendations" />;
  if (!snapshot && error) {
    const permission = error.status === 401 || error.status === 403;
    return (
      <ErrorState
        title={permission ? 'Today access denied' : 'Lite Today unavailable'}
        description={error.message}
        {...(!permission ? { onRetry: () => void reload() } : {})}
      />
    );
  }
  if (!snapshot) return null;

  return (
    <section aria-labelledby="today-heading">
      <PageHeader
        title="Today"
        description="Understand what needs attention, review what is prepared, then confirm the exact next step."
        actions={<Badge>Authenticated Workspace</Badge>}
      />
      <span id="today-heading" className="sr-only">
        Today
      </span>

      {snapshot.partial ? (
        <Alert tone="warning" title="Partial or stale Today context">
          {snapshot.warnings.length
            ? snapshot.warnings.join(' ')
            : 'Some upstream context could not be refreshed. Review source provenance before acting.'}
        </Alert>
      ) : null}
      {error ? (
        <Alert
          tone="warning"
          title={
            error.code === 'DEPENDENCY_UNAVAILABLE' ? 'Confirmed · handoff pending' : error.code
          }
        >
          {error.message}
        </Alert>
      ) : null}

      {snapshot.items.length === 0 ? (
        <EmptyState
          title="Nothing needs attention"
          description="There are no open durable Today Recommendations in this Workspace."
        />
      ) : (
        <div className="today-layout">
          <RecommendationList
            snapshot={snapshot}
            selectedId={item?.recommendation.todayRecommendationId ?? ''}
            onSelect={selectRecommendation}
          />
          <div className="today-detail" aria-live="polite">
            {item ? (
              <>
                <Card>
                  <div className="lite-row">
                    <div>
                      <p className="today-eyebrow">{kindLabel(item.recommendation.kind)}</p>
                      <h1>{item.recommendation.title}</h1>
                    </div>
                    <Badge>{item.recommendation.status}</Badge>
                  </div>
                  <p>{item.recommendation.explanation}</p>
                  <p className="today-muted">
                    Recommendation {item.recommendation.todayRecommendationId} · v
                    {item.recommendation.version}
                  </p>
                </Card>
                <PreparedActionPanel
                  recommendation={item.recommendation}
                  {...(journey ? { journey } : {})}
                  busy={busy}
                  onPrepare={() => void prepare()}
                  onConfirm={() => void confirm()}
                />
                <Provenance recommendation={item.recommendation} />
              </>
            ) : null}
          </div>
        </div>
      )}

      <FeedbackEvidence feedback={snapshot.recentFeedback} />
    </section>
  );
}
