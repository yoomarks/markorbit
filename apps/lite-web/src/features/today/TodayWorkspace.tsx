import { useEffect, useMemo, useState } from 'react';
import type {
  ContentKit,
  ContentPick,
  DailyOrbitItem,
  PlatformVariant,
  VisualOutputKind
} from '@markorbit/contracts/daily-workspace';
import type {
  PreparedActionJourney,
  ProductLoopFeedbackOutcome,
  ProductLoopUseFeedback,
  PublishPackage,
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
  PageHeader,
  Select,
  TextInput
} from '@markorbit/ui';
import {
  createDailyWorkspaceClient,
  DailyWorkspaceHttpError,
  type DailyOrbitSnapshot,
  type DailyWorkspaceClient,
  type VisualBriefRecordResponse
} from '../../api/daily-workspace.js';
import {
  createTodayClient,
  TodayHttpError,
  type TodayClient,
  type TodayProductLoopSnapshot
} from '../../api/product-loop.js';
import { projectDailyWorkspacePrimary } from './daily-workspace-primary.js';
import './today.css';

export interface TodayWorkspaceProps {
  workspaceId: string;
  client?: TodayClient;
  dailyClient?: DailyWorkspaceClient;
}

type BusyState = 'prepare' | 'confirm' | 'visual-brief' | 'visual-request' | '';

type Selection = {
  recommendationId: string;
  preparedActionId: string;
  contentPickId: string;
};

function querySelection(): Selection {
  const query = new URLSearchParams(window.location.search);
  return {
    recommendationId: query.get('todayRecommendationId') ?? '',
    preparedActionId: query.get('preparedActionId') ?? '',
    contentPickId: query.get('contentPickId') ?? ''
  };
}

function setSelection(next: Partial<Selection>) {
  const url = new URL(window.location.href);
  const current = querySelection();
  const selection = { ...current, ...next };
  const entries = [
    ['todayRecommendationId', selection.recommendationId],
    ['preparedActionId', selection.preparedActionId],
    ['contentPickId', selection.contentPickId]
  ] as const;
  for (const [key, value] of entries) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  url.hash = 'today';
  window.history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function kindLabel(kind: TodayRecommendation['kind']) {
  if (kind === 'CONTENT_PREPARATION') return 'Create';
  if (kind === 'OPPORTUNITY_REVIEW') return 'Review';
  if (kind === 'MARKREG_HANDOFF') return 'Move to MarkReg';
  return 'Follow up';
}

function actionStatus(journey: PreparedActionJourney) {
  if (journey.handoffState === 'HANDOFF_COMPLETED') return 'Completed';
  if (journey.handoffState === 'HANDOFF_PENDING') return 'Handoff pending';
  return 'Confirmation required';
}

function orbitTitle(
  item: Readonly<DailyOrbitItem>,
  today: Readonly<TodayProductLoopSnapshot> | undefined
): string {
  const recommendation = item.recommendation
    ? today?.items.find(
        (candidate) =>
          candidate.recommendation.todayRecommendationId === item.recommendation?.id &&
          candidate.recommendation.version === item.recommendation.version
      )?.recommendation
    : undefined;
  return recommendation?.title ?? `${item.source.kind} · ${item.source.sourceId}`;
}

function sourceLabel(item: Readonly<DailyOrbitItem>) {
  return `${item.source.owner}/${item.source.kind} · ${item.source.sourceId} · v${String(
    item.source.sourceVersion
  )}`;
}

function OrbitCard({
  item,
  title,
  saved,
  onSave,
  onDismiss
}: {
  item: Readonly<DailyOrbitItem>;
  title: string;
  saved: boolean;
  onSave: () => void;
  onDismiss: () => void;
}) {
  return (
    <Card>
      <div className="daily-card-heading">
        <div>
          <p className="daily-kicker">{item.section.replaceAll('_', ' ')}</p>
          <h3>{title}</h3>
        </div>
        <span className="daily-score" aria-label={`Orbit score ${item.score.total}`}>
          {item.score.total}
        </span>
      </div>
      <p>{item.whyThisMatters}</p>
      <div className="daily-score-grid" aria-label="Explainable Orbit score">
        <span title={item.score.importance.reason}>Importance {item.score.importance.score}</span>
        <span title={item.score.personalRelevance.reason}>
          Relevance {item.score.personalRelevance.score}
        </span>
        <span title={item.score.timeSensitivity.reason}>
          Timing {item.score.timeSensitivity.score}
        </span>
        <span title={item.score.contentPotential.reason}>
          Content {item.score.contentPotential.score}
        </span>
      </div>
      <div className="daily-chip-row" aria-label="Orbit preference actions">
        <Button variant={saved ? 'secondary' : 'primary'} onClick={onSave} disabled={saved}>
          {saved ? 'Saved' : 'Save'}
        </Button>
        <Button variant="secondary" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
      <details className="daily-provenance">
        <summary>Source & ranking reasons</summary>
        <p>{sourceLabel(item)}</p>
        <p>{item.score.importance.reason}</p>
        <p>{item.score.personalRelevance.reason}</p>
        <p>{item.score.timeSensitivity.reason}</p>
        <p>{item.score.contentPotential.reason}</p>
        <code title={item.source.sourceFingerprintSha256}>
          {item.source.sourceFingerprintSha256.slice(0, 20)}…
        </code>
      </details>
    </Card>
  );
}

function ContentPickCard({
  pick,
  selected,
  onSelect
}: {
  pick: Readonly<ContentPick>;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card>
      <div className="daily-card-heading">
        <div>
          <p className="daily-kicker">CONTENT PICK</p>
          <h3>{pick.title}</h3>
        </div>
        {selected ? <Badge>In Quick Create</Badge> : null}
      </div>
      <p>{pick.whyPublish}</p>
      {pick.suggestedAngles.length ? (
        <ul className="daily-angle-list">
          {pick.suggestedAngles.slice(0, 3).map((angle) => (
            <li key={angle}>{angle}</li>
          ))}
        </ul>
      ) : null}
      <div className="daily-chip-row">
        {pick.recommendedPlatforms.map((platform) => (
          <span key={platform}>{platform.replaceAll('_', ' ')}</span>
        ))}
      </div>
      <Button variant={selected ? 'secondary' : 'primary'} onClick={onSelect}>
        {selected ? 'Selected for Quick Create' : 'Open in Quick Create'}
      </Button>
    </Card>
  );
}

function PreparedActionCard({
  recommendation,
  journey,
  busy,
  onPrepare,
  onConfirm
}: {
  recommendation: Readonly<TodayRecommendation>;
  journey?: Readonly<PreparedActionJourney>;
  busy: BusyState;
  onPrepare: () => void;
  onConfirm: () => void;
}) {
  if (!journey) {
    return (
      <Card>
        <div className="daily-card-heading">
          <div>
            <p className="daily-kicker">{kindLabel(recommendation.kind)}</p>
            <h3>{recommendation.title}</h3>
          </div>
          <Badge>{recommendation.status}</Badge>
        </div>
        <p>{recommendation.explanation}</p>
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
          <Alert tone="info" title="Structured owner context required">
            Lite will not infer customer intent, qualification evidence or a formal instruction from
            display text.
          </Alert>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <div className="daily-card-heading">
        <div>
          <p className="daily-kicker">Prepared Action</p>
          <h3>{recommendation.title}</h3>
        </div>
        <Badge>{actionStatus(journey)}</Badge>
      </div>
      <p>{journey.preparedAction.summary}</p>
      <div className="today-confirmation-effect" role="note" aria-label="Confirmation effect">
        <strong>Confirmation effect</strong>
        <p>{journey.preparedAction.confirmationEffect}</p>
      </div>
      {journey.handoffState === 'AWAITING_CONFIRMATION' ? (
        <>
          <Alert tone="warning" title="Your confirmation is required">
            Review the effect above. Confirmation records your authenticated Core Principal and then
            attempts only the bounded owner handoff.
          </Alert>
          <Button onClick={onConfirm} disabled={busy !== ''}>
            {busy === 'confirm' ? 'Confirming…' : 'Confirm and hand off'}
          </Button>
        </>
      ) : journey.handoffState === 'HANDOFF_PENDING' ? (
        <>
          <Alert tone="warning" title="Confirmed · handoff pending">
            Confirmation is durable. Retrying reuses the existing confirmation and idempotency
            boundary.
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

function ContentKitPanel({
  pick,
  kit,
  loading,
  error,
  visualRecord,
  visualError,
  busy,
  onCreateVisualBrief,
  onStartVisualRequest,
  onSelectAngle,
  onCopyVariant,
  onExportVariant
}: {
  pick: Readonly<ContentPick>;
  kit?: Readonly<ContentKit>;
  loading: boolean;
  error?: Readonly<DailyWorkspaceHttpError>;
  visualRecord?: Readonly<VisualBriefRecordResponse>;
  visualError?: Readonly<DailyWorkspaceHttpError>;
  busy: BusyState;
  onCreateVisualBrief: (input: {
    requestedIpPackage: string;
    outputKind: VisualOutputKind;
    sceneIntent: string;
  }) => void;
  onStartVisualRequest: () => void;
  onSelectAngle: (angleId: string) => void;
  onCopyVariant: (variant: Readonly<PlatformVariant>) => Promise<void>;
  onExportVariant: (variant: Readonly<PlatformVariant>) => void;
}) {
  const [ipPackage, setIpPackage] = useState('');
  const [outputKind, setOutputKind] = useState<VisualOutputKind>('XIAOHONGSHU_COVER');
  const [sceneIntent, setSceneIntent] = useState('');
  const [selectedAngleId, setSelectedAngleId] = useState('');
  const [copiedVariantId, setCopiedVariantId] = useState('');
  const [exportedVariantId, setExportedVariantId] = useState('');
  const [copyError, setCopyError] = useState('');
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    setSceneIntent(pick.suggestedAngles[0] ?? pick.whyPublish);
  }, [pick.contentPickId, pick.suggestedAngles, pick.whyPublish]);

  useEffect(() => {
    setSelectedAngleId('');
    setCopiedVariantId('');
    setExportedVariantId('');
    setCopyError('');
    setExportError('');
  }, [kit?.contentKitId, kit?.version]);

  const copyVariant = async (variant: Readonly<PlatformVariant>) => {
    setCopyError('');
    try {
      await onCopyVariant(variant);
      setCopiedVariantId(variant.variantId);
    } catch {
      setCopyError('This browser could not copy the platform variant.');
    }
  };

  const exportVariant = (variant: Readonly<PlatformVariant>) => {
    setExportError('');
    try {
      onExportVariant(variant);
      setExportedVariantId(variant.variantId);
    } catch {
      setExportError('This browser could not export the platform variant.');
    }
  };

  if (loading) return <LoadingState label="Opening Content Kit" />;
  if (error?.code === 'CONTENT_OPPORTUNITY_REQUIRED') {
    return (
      <Alert tone="info" title="Prepare the content line first">
        This Content Pick is editorial guidance only. Use Today Actions to prepare and explicitly
        confirm the existing Content Recommendation before a Content Kit can exist.
      </Alert>
    );
  }
  if (error)
    return (
      <Alert tone="warning" title="Content Kit unavailable">
        {error.message}
      </Alert>
    );
  if (!kit) return null;

  return (
    <div className="daily-create-stack">
      <Card>
        <div className="daily-card-heading">
          <div>
            <p className="daily-kicker">CONTENT KIT</p>
            <h3>{pick.title}</h3>
          </div>
          <Badge>v{kit.version}</Badge>
        </div>
        <p>{kit.whyItMatters}</p>
        <p>
          <strong>Why publish:</strong> {kit.whyPublish}
        </p>
        <p>
          <strong>Audience:</strong> {kit.audience}
        </p>
        <div className="daily-create-columns">
          <div>
            <h4>Angles</h4>
            <ul className="daily-angle-list">
              {kit.angles.map((angle) => {
                const selected = selectedAngleId === angle.angleId;
                return (
                  <li key={angle.angleId}>
                    <strong>{angle.title}</strong>
                    <span>{angle.thesis}</span>
                    <Button
                      variant={selected ? 'secondary' : 'primary'}
                      disabled={selected}
                      onClick={() => {
                        setSelectedAngleId(angle.angleId);
                        onSelectAngle(angle.angleId);
                      }}
                    >
                      {selected ? 'Selected angle' : 'Use this angle'}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <h4>Native variants</h4>
            <ul className="daily-variant-list">
              {kit.platformVariants.map((variant) => (
                <li key={variant.variantId}>
                  <Badge>{variant.kind.replaceAll('_', ' ')}</Badge>
                  <strong>{variant.title}</strong>
                  <p>{variant.body}</p>
                  <small>Human review required · external publish executed: No</small>
                  <Button
                    variant="secondary"
                    disabled={copiedVariantId === variant.variantId}
                    onClick={() => void copyVariant(variant)}
                  >
                    {copiedVariantId === variant.variantId ? 'Copied' : 'Copy'}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={exportedVariantId === variant.variantId}
                    onClick={() => exportVariant(variant)}
                  >
                    {exportedVariantId === variant.variantId ? 'Exported' : 'Export'}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {copyError ? (
          <Alert tone="warning" title="Copy unavailable">
            {copyError}
          </Alert>
        ) : null}
        {exportError ? (
          <Alert tone="warning" title="Export unavailable">
            {exportError}
          </Alert>
        ) : null}
      </Card>

      <Card>
        <div className="daily-card-heading">
          <div>
            <p className="daily-kicker">VISUAL</p>
            <h3>Reuse-first visual brief</h3>
          </div>
          <Badge>{kit.visualBriefReferences.length} brief(s)</Badge>
        </div>
        <Alert tone="info" title="Visual production remains governed">
          Lite can prepare a Visual Brief, but it cannot choose provider/model, authorize paid
          execution or override Visual QC.
        </Alert>
        {kit.visualBriefReferences.length ? (
          <ul className="daily-reference-list">
            {kit.visualBriefReferences.map((reference) => (
              <li key={`${reference.id}:${reference.version}`}>
                {reference.id} · v{reference.version}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="daily-visual-form">
          <TextInput
            label="Governed IP package"
            value={ipPackage}
            onChange={(event) => setIpPackage(event.target.value)}
            placeholder="e.g. MOKI"
          />
          <Select
            label="Output format"
            value={outputKind}
            onChange={(event) => setOutputKind(event.target.value as VisualOutputKind)}
          >
            <option value="XIAOHONGSHU_COVER">Xiaohongshu cover</option>
            <option value="WECHAT_OFFICIAL_ACCOUNT_COVER">WeChat article cover</option>
            <option value="MOMENTS_SOCIAL_CARD">Moments / social card</option>
            <option value="VIDEO_COVER">Video cover</option>
          </Select>
          <TextInput
            label="Scene intent"
            value={sceneIntent}
            onChange={(event) => setSceneIntent(event.target.value)}
          />
        </div>
        <Button
          onClick={() =>
            onCreateVisualBrief({ requestedIpPackage: ipPackage, outputKind, sceneIntent })
          }
          disabled={busy !== '' || !ipPackage.trim() || !sceneIntent.trim()}
        >
          {busy === 'visual-brief' ? 'Saving Visual Brief…' : 'Create Visual Brief'}
        </Button>
        {visualRecord ? (
          <div className="daily-visual-result">
            <strong>{visualRecord.brief.visualBriefId}</strong>
            <span>
              Reuse first: Yes · Paid execution authorized by Lite: No ·{' '}
              {visualRecord.brief.outputKind}
            </span>
            <Button variant="secondary" onClick={onStartVisualRequest} disabled={busy !== ''}>
              {busy === 'visual-request' ? 'Requesting…' : 'Request reuse-first visual'}
            </Button>
          </div>
        ) : null}
        {visualError ? (
          <Alert
            tone={visualError.code === 'VISUAL_CONSUMER_UNAVAILABLE' ? 'info' : 'warning'}
            title={
              visualError.code === 'VISUAL_CONSUMER_UNAVAILABLE'
                ? 'Visual Engine connection not configured'
                : 'Visual request unavailable'
            }
          >
            {visualError.message} No provider or paid execution is assumed from this state.
          </Alert>
        ) : null}
      </Card>
    </div>
  );
}

function FeedbackSummary({
  pending,
  recent,
  busyPackageId,
  onRecord
}: {
  pending: ReadonlyArray<Readonly<PublishPackage>>;
  recent: ReadonlyArray<Readonly<ProductLoopUseFeedback>>;
  busyPackageId: string;
  onRecord: (publishPackage: Readonly<PublishPackage>, outcome: ProductLoopFeedbackOutcome) => void;
}) {
  if (!pending.length && !recent.length) return null;
  return (
    <Card>
      <div className="daily-card-heading">
        <div>
          <p className="daily-kicker">FEEDBACK</p>
          <h3>What happened after preparation?</h3>
        </div>
        <Badge>{pending.length + recent.length}</Badge>
      </div>
      <Alert tone="info" title="Reporting is not publication">
        These controls only record what a user says already happened outside MarkOrbit. They do not
        publish or independently verify the result.
      </Alert>
      {pending.map((publishPackage) => (
        <div className="daily-feedback-row" key={publishPackage.publishPackageId}>
          <div>
            <strong>{publishPackage.title}</strong>
            <span>{publishPackage.publishPackageId}</span>
          </div>
          <div className="daily-feedback-actions">
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
                disabled={Boolean(busyPackageId)}
                onClick={() => onRecord(publishPackage, outcome)}
              >
                {busyPackageId === publishPackage.publishPackageId ? 'Saving…' : label}
              </Button>
            ))}
          </div>
        </div>
      ))}
      {recent.length ? (
        <details className="daily-provenance">
          <summary>Recent user-reported outcomes ({recent.length})</summary>
          <ul className="daily-reference-list">
            {recent.map((item) => (
              <li key={item.productLoopFeedbackId}>
                {item.outcome.replaceAll('_', ' ')} · {item.publishPackage.id}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}

export function TodayWorkspace({
  workspaceId,
  client: suppliedTodayClient,
  dailyClient: suppliedDailyClient
}: TodayWorkspaceProps) {
  const todayClient = useMemo(
    () => suppliedTodayClient ?? createTodayClient(workspaceId),
    [suppliedTodayClient, workspaceId]
  );
  const dailyClient = useMemo(
    () => suppliedDailyClient ?? createDailyWorkspaceClient(workspaceId),
    [suppliedDailyClient, workspaceId]
  );
  const [today, setToday] = useState<TodayProductLoopSnapshot>();
  const [orbit, setOrbit] = useState<DailyOrbitSnapshot>();
  const [todayError, setTodayError] = useState<TodayHttpError>();
  const [dailyError, setDailyError] = useState<DailyWorkspaceHttpError>();
  const [selection, setCurrentSelection] = useState<Selection>(querySelection);
  const [kit, setKit] = useState<ContentKit>();
  const [kitLoading, setKitLoading] = useState(false);
  const [kitError, setKitError] = useState<DailyWorkspaceHttpError>();
  const [busy, setBusy] = useState<BusyState>('');
  const [feedbackBusyPackageId, setFeedbackBusyPackageId] = useState('');
  const [visualRecord, setVisualRecord] = useState<VisualBriefRecordResponse>();
  const [visualError, setVisualError] = useState<DailyWorkspaceHttpError>();
  const [savedOrbitItemIds, setSavedOrbitItemIds] = useState<ReadonlySet<string>>(new Set());
  const [dismissedOrbitItemIds, setDismissedOrbitItemIds] = useState<ReadonlySet<string>>(
    new Set()
  );

  const reload = async () => {
    setTodayError(undefined);
    setDailyError(undefined);

    if (suppliedTodayClient && !suppliedDailyClient) {
      const [todayResult, orbitResult] = await Promise.allSettled([
        todayClient.loadToday(),
        dailyClient.loadOrbit()
      ]);
      if (todayResult.status === 'fulfilled') setToday(todayResult.value);
      else
        setTodayError(
          todayResult.reason instanceof TodayHttpError
            ? todayResult.reason
            : new TodayHttpError(503, 'TODAY_REQUEST_FAILED', 'Lite Today is unavailable.')
        );
      if (orbitResult.status === 'fulfilled') setOrbit(orbitResult.value);
      else
        setDailyError(
          orbitResult.reason instanceof DailyWorkspaceHttpError
            ? orbitResult.reason
            : new DailyWorkspaceHttpError(
                503,
                'DAILY_ORBIT_UNAVAILABLE',
                'Daily Orbit is unavailable.',
                true
              )
        );
      return;
    }

    try {
      const workspace = await dailyClient.loadWorkspace();
      const projection = projectDailyWorkspacePrimary(workspace);
      setToday(projection.today);
      setOrbit(projection.orbit);
    } catch (cause) {
      const error =
        cause instanceof DailyWorkspaceHttpError
          ? cause
          : new DailyWorkspaceHttpError(
              503,
              'DAILY_WORKSPACE_UNAVAILABLE',
              'Daily Workspace is unavailable.',
              true
            );
      setDailyError(error);
      setTodayError(new TodayHttpError(error.status, error.code, error.message));
    }
  };

  useEffect(() => {
    void reload();
  }, [todayClient, dailyClient]);

  useEffect(() => {
    const followLocation = () => setCurrentSelection(querySelection());
    window.addEventListener('popstate', followLocation);
    return () => window.removeEventListener('popstate', followLocation);
  }, []);

  useEffect(() => {
    if (!today?.items.length || selection.recommendationId) return;
    const first = today.items[0]!;
    setCurrentSelection((current) => ({
      ...current,
      recommendationId: first.recommendation.todayRecommendationId,
      preparedActionId: first.preparedActions[0]?.preparedAction.preparedActionId ?? ''
    }));
  }, [today, selection.recommendationId]);

  useEffect(() => {
    if (!orbit?.contentPicks.length || selection.contentPickId) return;
    setCurrentSelection((current) => ({
      ...current,
      contentPickId: orbit.contentPicks[0]!.contentPickId
    }));
  }, [orbit, selection.contentPickId]);

  const selectedPick = orbit?.contentPicks.find(
    (candidate) => candidate.contentPickId === selection.contentPickId
  );

  useEffect(() => {
    setKit(undefined);
    setKitError(undefined);
    setVisualRecord(undefined);
    setVisualError(undefined);
    if (!selectedPick) return;
    let active = true;
    setKitLoading(true);
    dailyClient
      .loadContentKit(selectedPick.contentPickId)
      .then((value) => {
        if (active) setKit(value);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setKitError(
          cause instanceof DailyWorkspaceHttpError
            ? cause
            : new DailyWorkspaceHttpError(
                503,
                'CONTENT_KIT_UNAVAILABLE',
                'Content Kit is unavailable.'
              )
        );
      })
      .finally(() => {
        if (active) setKitLoading(false);
      });
    return () => {
      active = false;
    };
  }, [dailyClient, selectedPick]);

  const selectContentPick = (pick: Readonly<ContentPick>) => {
    void dailyClient
      .recordPreferenceEvent(
        'OPENED',
        {
          targetType: 'CONTENT_PICK',
          targetId: pick.contentPickId,
          targetVersion: pick.version
        },
        `preference:opened:${pick.contentPickId}:${pick.version}`
      )
      .catch(() => {
        // Product preference evidence must never block the primary Product navigation.
      });
    setSelection({
      contentPickId: pick.contentPickId,
      recommendationId: pick.recommendation.id,
      preparedActionId: ''
    });
    setCurrentSelection((current) => ({
      ...current,
      contentPickId: pick.contentPickId,
      recommendationId: pick.recommendation.id,
      preparedActionId: ''
    }));
  };

  const selectedToday = today?.items.find(
    (candidate) => candidate.recommendation.todayRecommendationId === selection.recommendationId
  );
  const selectedJourney =
    selectedToday?.preparedActions.find(
      (candidate) => candidate.preparedAction.preparedActionId === selection.preparedActionId
    ) ?? selectedToday?.preparedActions[0];

  const prepare = async (recommendation: Readonly<TodayRecommendation>) => {
    setBusy('prepare');
    setTodayError(undefined);
    try {
      const created = await todayClient.prepareContent(recommendation);
      await reload();
      setSelection({
        recommendationId: recommendation.todayRecommendationId,
        preparedActionId: created.preparedAction.preparedActionId
      });
      setCurrentSelection((current) => ({
        ...current,
        recommendationId: recommendation.todayRecommendationId,
        preparedActionId: created.preparedAction.preparedActionId
      }));
    } catch (cause) {
      setTodayError(
        cause instanceof TodayHttpError
          ? cause
          : new TodayHttpError(503, 'PREPARE_FAILED', 'Prepared Action could not be created.')
      );
    } finally {
      setBusy('');
    }
  };

  const confirm = async (journey: Readonly<PreparedActionJourney>) => {
    setBusy('confirm');
    setTodayError(undefined);
    try {
      const result = await todayClient.confirm(journey);
      await reload();
      setSelection({
        recommendationId: journey.preparedAction.recommendation.id,
        preparedActionId: result.preparedAction.preparedActionId
      });
      setCurrentSelection((current) => ({
        ...current,
        recommendationId: journey.preparedAction.recommendation.id,
        preparedActionId: result.preparedAction.preparedActionId
      }));
      if (selectedPick) {
        try {
          setKit(await dailyClient.loadContentKit(selectedPick.contentPickId));
          setKitError(undefined);
        } catch {
          // The Today mutation is authoritative; a read refresh can recover independently.
        }
      }
    } catch (cause) {
      const mapped =
        cause instanceof TodayHttpError
          ? cause
          : new TodayHttpError(503, 'HANDOFF_FAILED', 'Owner handoff did not complete.');
      setTodayError(mapped);
      if (mapped.status === 503) await reload();
    } finally {
      setBusy('');
    }
  };

  const recordFeedback = async (
    publishPackage: Readonly<PublishPackage>,
    outcome: ProductLoopFeedbackOutcome
  ) => {
    setFeedbackBusyPackageId(publishPackage.publishPackageId);
    setTodayError(undefined);
    try {
      await todayClient.recordUseFeedback(publishPackage, outcome);
      await reload();
    } catch (cause) {
      setTodayError(
        cause instanceof TodayHttpError
          ? cause
          : new TodayHttpError(503, 'FEEDBACK_RECORD_FAILED', 'Feedback could not be saved.')
      );
    } finally {
      setFeedbackBusyPackageId('');
    }
  };

  const createVisualBrief = async (input: {
    requestedIpPackage: string;
    outputKind: VisualOutputKind;
    sceneIntent: string;
  }) => {
    if (!selectedPick || !kit) return;
    setBusy('visual-brief');
    setVisualError(undefined);
    try {
      const record = await dailyClient.createVisualBrief(selectedPick.contentPickId, kit, input);
      setVisualRecord(record);
      setKit(await dailyClient.loadContentKit(selectedPick.contentPickId));
    } catch (cause) {
      setVisualError(
        cause instanceof DailyWorkspaceHttpError
          ? cause
          : new DailyWorkspaceHttpError(
              503,
              'VISUAL_BRIEF_FAILED',
              'Visual Brief could not be saved.'
            )
      );
    } finally {
      setBusy('');
    }
  };

  const startVisualRequest = async () => {
    if (!visualRecord) return;
    setBusy('visual-request');
    setVisualError(undefined);
    try {
      const result = await dailyClient.startVisualRequest(visualRecord);
      if (result.output.status === 'FAILED')
        setVisualError(
          new DailyWorkspaceHttpError(
            502,
            'VISUAL_REQUEST_FAILED',
            'Visual Engine reported failure.'
          )
        );
    } catch (cause) {
      setVisualError(
        cause instanceof DailyWorkspaceHttpError
          ? cause
          : new DailyWorkspaceHttpError(
              503,
              'VISUAL_REQUEST_FAILED',
              'Visual request failed.',
              true
            )
      );
    } finally {
      setBusy('');
    }
  };

  const selectContentAngle = (angleId: string) => {
    if (!kit) return;
    void dailyClient
      .recordPreferenceEvent(
        'ANGLE_SELECTED',
        {
          targetType: 'CONTENT_KIT',
          targetId: kit.contentKitId,
          targetVersion: kit.version
        },
        `preference:angle-selected:${kit.contentKitId}:${kit.version}:${angleId}`
      )
      .catch(() => {
        // Angle selection is the primary local action; preference evidence is best-effort.
      });
  };

  const copyPlatformVariant = async (variant: Readonly<PlatformVariant>) => {
    if (!kit) throw new Error('Content Kit is required before copying a platform variant.');
    if (!navigator.clipboard?.writeText)
      throw new Error('Clipboard write is unavailable in this browser.');
    await navigator.clipboard.writeText(`${variant.title}\n\n${variant.body}`);
    void dailyClient
      .recordPreferenceEvent(
        'COPIED',
        {
          targetType: 'PLATFORM_VARIANT',
          targetId: variant.variantId,
          targetVersion: kit.version
        },
        `preference:copied:${kit.contentKitId}:${kit.version}:${variant.variantId}`
      )
      .catch(() => {
        // A successful clipboard write remains successful even if preference evidence cannot persist.
      });
  };

  const exportPlatformVariant = (variant: Readonly<PlatformVariant>) => {
    if (!kit) throw new Error('Content Kit is required before exporting a platform variant.');
    const blob = new Blob([`${variant.title}\n\n${variant.body}\n`], {
      type: 'text/plain;charset=utf-8'
    });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `markorbit-${variant.kind.toLowerCase().replaceAll('_', '-')}.txt`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 0);
    void dailyClient
      .recordPreferenceEvent(
        'EXPORTED',
        {
          targetType: 'PLATFORM_VARIANT',
          targetId: variant.variantId,
          targetVersion: kit.version
        },
        `preference:exported:${kit.contentKitId}:${kit.version}:${variant.variantId}`
      )
      .catch(() => {
        // A local download remains valid even when preference evidence cannot persist.
      });
  };

  const recordOrbitPreference = async (
    kind: 'SAVED' | 'DISMISSED',
    item: Readonly<DailyOrbitItem>
  ) => {
    setDailyError(undefined);
    try {
      await dailyClient.recordPreferenceEvent(
        kind,
        {
          targetType: 'DAILY_ORBIT_ITEM',
          targetId: item.dailyOrbitItemId,
          targetVersion: item.version
        },
        `preference:${kind.toLowerCase()}:${item.dailyOrbitItemId}:${item.version}`
      );
      if (kind === 'SAVED')
        setSavedOrbitItemIds((current) => new Set([...current, item.dailyOrbitItemId]));
      else setDismissedOrbitItemIds((current) => new Set([...current, item.dailyOrbitItemId]));
    } catch (cause) {
      setDailyError(
        cause instanceof DailyWorkspaceHttpError
          ? cause
          : new DailyWorkspaceHttpError(
              503,
              'PREFERENCE_RECORD_FAILED',
              'Orbit preference could not be saved.',
              true
            )
      );
    }
  };

  if (!today && !orbit && !todayError && !dailyError)
    return <LoadingState label="Loading your Daily Workspace" />;
  if (!today && !orbit && (todayError || dailyError)) {
    const error = todayError ?? dailyError!;
    const permission = error.status === 401 || error.status === 403;
    return (
      <ErrorState
        title={permission ? 'Daily Workspace access denied' : 'Daily Workspace unavailable'}
        description={error.message}
        {...(!permission ? { onRetry: () => void reload() } : {})}
      />
    );
  }

  const mainOrbit =
    orbit?.items.filter(
      (item) =>
        item.section !== 'WORTH_REVISITING' && !dismissedOrbitItemIds.has(item.dailyOrbitItemId)
    ) ?? [];
  const revisiting =
    orbit?.items.filter(
      (item) =>
        item.section === 'WORTH_REVISITING' && !dismissedOrbitItemIds.has(item.dailyOrbitItemId)
    ) ?? [];
  const contentPicks = orbit?.contentPicks ?? [];

  return (
    <section aria-labelledby="today-heading" className="daily-workspace">
      <PageHeader
        title="Good morning"
        description="See what matters, create what is worth expressing, and move the right work forward."
        actions={<Badge>Authenticated Workspace</Badge>}
      />
      <span id="today-heading" className="sr-only">
        Today
      </span>

      {(orbit?.partial || today?.partial) && (
        <Alert tone="warning" title="Partial or stale context">
          {[...(orbit?.warnings ?? []), ...(today?.warnings ?? [])].join(' ') ||
            'Some upstream context could not be refreshed. Exact stored provenance remains visible.'}
        </Alert>
      )}
      {dailyError ? (
        <Alert tone="warning" title="SEE is partially unavailable">
          {dailyError.message} Existing Today Actions remain available where their durable state was
          loaded.
        </Alert>
      ) : null}
      {todayError ? (
        <Alert tone="warning" title="MOVE is partially unavailable">
          {todayError.message}
        </Alert>
      ) : null}

      <nav className="daily-jump-nav" aria-label="Daily Workspace sections">
        <a href="#daily-orbit">SEE · Today's Orbit</a>
        <a href="#content-picks">CREATE · Content Picks</a>
        <a href="#quick-create">Quick Create</a>
        <a href="#worth-revisiting">Worth Revisiting</a>
        <a href="#today-actions">MOVE · Today Actions</a>
      </nav>

      <section id="daily-orbit" className="daily-section" aria-labelledby="daily-orbit-heading">
        <div className="daily-section-heading">
          <div>
            <p className="daily-kicker">SEE</p>
            <h2 id="daily-orbit-heading">Today's Orbit</h2>
            <p>Explainable priorities from governed Workspace sources.</p>
          </div>
          <Badge>{mainOrbit.length}</Badge>
        </div>
        {mainOrbit.length ? (
          <div className="daily-card-grid">
            {mainOrbit.map((item) => (
              <OrbitCard
                key={item.dailyOrbitItemId}
                item={item}
                title={orbitTitle(item, today)}
                saved={
                  savedOrbitItemIds.has(item.dailyOrbitItemId) ||
                  Boolean(orbit?.savedOrbitItemIds.includes(item.dailyOrbitItemId))
                }
                onSave={() => void recordOrbitPreference('SAVED', item)}
                onDismiss={() => void recordOrbitPreference('DISMISSED', item)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Your Orbit is clear"
            description="No current Daily Signals are ranked for this Workspace yet."
          />
        )}
      </section>

      <section id="content-picks" className="daily-section" aria-labelledby="content-picks-heading">
        <div className="daily-section-heading">
          <div>
            <p className="daily-kicker">CREATE</p>
            <h2 id="content-picks-heading">Content Picks</h2>
            <p>Worth expressing today. A pick is not a Draft or a publication.</p>
          </div>
          <Badge>{contentPicks.length}</Badge>
        </div>
        {contentPicks.length ? (
          <div className="daily-card-grid">
            {contentPicks.map((pick) => (
              <ContentPickCard
                key={pick.contentPickId}
                pick={pick}
                selected={selectedPick?.contentPickId === pick.contentPickId}
                onSelect={() => selectContentPick(pick)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No Content Picks yet"
            description="Content Picks appear only when a ranked signal has an exact content Recommendation."
          />
        )}
      </section>

      <section id="quick-create" className="daily-section" aria-labelledby="quick-create-heading">
        <div className="daily-section-heading">
          <div>
            <p className="daily-kicker">CREATE</p>
            <h2 id="quick-create-heading">Quick Create</h2>
            <p>Work from the existing Content lifecycle; no second draft or publication truth.</p>
          </div>
        </div>
        {selectedPick ? (
          <ContentKitPanel
            pick={selectedPick}
            {...(kit ? { kit } : {})}
            loading={kitLoading}
            {...(kitError ? { error: kitError } : {})}
            {...(visualRecord ? { visualRecord } : {})}
            {...(visualError ? { visualError } : {})}
            busy={busy}
            onCreateVisualBrief={(input) => void createVisualBrief(input)}
            onStartVisualRequest={() => void startVisualRequest()}
            onSelectAngle={selectContentAngle}
            onCopyVariant={copyPlatformVariant}
            onExportVariant={exportPlatformVariant}
          />
        ) : (
          <EmptyState
            title="Choose a Content Pick"
            description="Select a Content Pick above to open its governed Content Kit."
          />
        )}
      </section>

      <section
        id="worth-revisiting"
        className="daily-section"
        aria-labelledby="worth-revisiting-heading"
      >
        <div className="daily-section-heading">
          <div>
            <p className="daily-kicker">SEE</p>
            <h2 id="worth-revisiting-heading">Worth Revisiting</h2>
            <p>Lower-urgency context that may still be useful today.</p>
          </div>
          <Badge>{revisiting.length}</Badge>
        </div>
        {revisiting.length ? (
          <div className="daily-card-grid">
            {revisiting.map((item) => (
              <OrbitCard
                key={item.dailyOrbitItemId}
                item={item}
                title={orbitTitle(item, today)}
                saved={
                  savedOrbitItemIds.has(item.dailyOrbitItemId) ||
                  Boolean(orbit?.savedOrbitItemIds.includes(item.dailyOrbitItemId))
                }
                onSave={() => void recordOrbitPreference('SAVED', item)}
                onDismiss={() => void recordOrbitPreference('DISMISSED', item)}
              />
            ))}
          </div>
        ) : (
          <p className="daily-muted-block">Nothing has been intentionally carried forward.</p>
        )}
      </section>

      <section id="today-actions" className="daily-section" aria-labelledby="today-actions-heading">
        <div className="daily-section-heading">
          <div>
            <p className="daily-kicker">MOVE</p>
            <h2 id="today-actions-heading">Today Actions</h2>
            <p>Review the exact effect, then explicitly confirm the owner handoff.</p>
          </div>
          <Badge>{today?.items.length ?? 0}</Badge>
        </div>
        {today?.items.length ? (
          <div className="daily-action-stack">
            {today.items.map(({ recommendation, preparedActions }) => {
              const journey =
                recommendation.todayRecommendationId === selection.recommendationId
                  ? selectedJourney
                  : preparedActions[0];
              return (
                <PreparedActionCard
                  key={recommendation.todayRecommendationId}
                  recommendation={recommendation}
                  {...(journey ? { journey } : {})}
                  busy={busy}
                  onPrepare={() => {
                    setSelection({ recommendationId: recommendation.todayRecommendationId });
                    setCurrentSelection((current) => ({
                      ...current,
                      recommendationId: recommendation.todayRecommendationId
                    }));
                    void prepare(recommendation);
                  }}
                  onConfirm={() => {
                    if (journey) void confirm(journey);
                  }}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No Today Actions"
            description="There are no open durable Today Recommendations in this Workspace."
          />
        )}
        {today ? (
          <FeedbackSummary
            pending={today.feedbackPendingPackages}
            recent={today.recentFeedback}
            busyPackageId={feedbackBusyPackageId}
            onRecord={(publishPackage, outcome) => void recordFeedback(publishPackage, outcome)}
          />
        ) : null}
      </section>
    </section>
  );
}
