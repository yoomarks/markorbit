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
  PublishPackage,
  TodayRecommendation
} from '@markorbit/contracts/product-loop';
import { Alert, Badge, ErrorState, LoadingState, PageHeader } from '@markorbit/ui';
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
import { updateLiteLocation } from '../../routing/workspace-navigation.js';
import { projectDailyWorkspacePrimary } from './daily-workspace-primary.js';
import { TodayCommandCenter } from './TodayCommandCenter.js';
import { TodayCreateSections } from './TodayCreateSections.js';
import { TodayMoveSection } from './TodayMoveSection.js';
import { TodaySeeSections } from './TodaySeeSections.js';
import type { TodayBusyState, TodaySelection } from './today-types.js';
import './today.css';

export interface TodayWorkspaceProps {
  workspaceId: string;
  client?: TodayClient;
  dailyClient?: DailyWorkspaceClient;
}

function querySelection(): TodaySelection {
  const query = new URLSearchParams(window.location.search);
  return {
    recommendationId: query.get('todayRecommendationId') ?? '',
    preparedActionId: query.get('preparedActionId') ?? '',
    contentPickId: query.get('contentPickId') ?? ''
  };
}

function setSelection(workspaceId: string, next: Partial<TodaySelection>) {
  const current = querySelection();
  const selection = { ...current, ...next };
  updateLiteLocation(
    {
      surface: 'today',
      workspaceId,
      params: {
        todayRecommendationId: selection.recommendationId || undefined,
        preparedActionId: selection.preparedActionId || undefined,
        contentPickId: selection.contentPickId || undefined
      }
    },
    { preserveSearch: true }
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
  const [selection, setCurrentSelection] = useState<TodaySelection>(querySelection);
  const [kit, setKit] = useState<ContentKit>();
  const [kitLoading, setKitLoading] = useState(false);
  const [kitError, setKitError] = useState<DailyWorkspaceHttpError>();
  const [busy, setBusy] = useState<TodayBusyState>('');
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

  useEffect(() => {
    if (!kit) {
      setVisualRecord(undefined);
      return;
    }
    const latestVisualBrief = kit.visualBriefReferences.at(-1);
    if (!latestVisualBrief) {
      setVisualRecord(undefined);
      return;
    }
    let active = true;
    setVisualError(undefined);
    dailyClient
      .loadVisualBrief(latestVisualBrief)
      .then((record) => {
        if (active) setVisualRecord(record);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setVisualRecord(undefined);
        setVisualError(
          cause instanceof DailyWorkspaceHttpError
            ? cause
            : new DailyWorkspaceHttpError(
                503,
                'VISUAL_BRIEF_UNAVAILABLE',
                'Saved Visual Brief could not be restored.',
                true
              )
        );
      });
    return () => {
      active = false;
    };
  }, [dailyClient, kit]);

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
    setSelection(workspaceId, {
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
      setSelection(workspaceId, {
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
      setSelection(workspaceId, {
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
        description="Start with what needs you, continue exact work, then explore current signals and creation options."
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

      <TodayCommandCenter today={today} orbit={orbit} explicitSelection={querySelection()} />

      <details className="daily-section-index">
        <summary>Browse all Today sections</summary>
        <nav className="daily-jump-nav" aria-label="Daily Workspace sections">
          <a href="#today-actions">MOVE · Today Actions</a>
          <a href="#daily-orbit">SEE · Today's Orbit</a>
          <a href="#worth-revisiting">SEE · Worth Revisiting</a>
          <a href="#content-picks">CREATE · Content Picks</a>
          <a href="#quick-create">CREATE · Quick Create</a>
        </nav>
      </details>

      <TodayMoveSection
        workspaceId={workspaceId}
        today={today}
        selectionRecommendationId={selection.recommendationId}
        {...(selectedJourney ? { selectedJourney } : {})}
        busy={busy}
        feedbackBusyPackageId={feedbackBusyPackageId}
        onPrepare={(recommendation) => {
          setSelection(workspaceId, { recommendationId: recommendation.todayRecommendationId });
          setCurrentSelection((current) => ({
            ...current,
            recommendationId: recommendation.todayRecommendationId
          }));
          void prepare(recommendation);
        }}
        onConfirm={(journey) => void confirm(journey)}
        onRecordFeedback={(publishPackage, outcome) => void recordFeedback(publishPackage, outcome)}
      />

      <TodaySeeSections
        mainOrbit={mainOrbit}
        revisiting={revisiting}
        today={today}
        orbit={orbit}
        savedOrbitItemIds={savedOrbitItemIds}
        onPreference={(kind, item) => void recordOrbitPreference(kind, item)}
      />

      <TodayCreateSections
        contentPicks={contentPicks}
        {...(selectedPick ? { selectedPick } : {})}
        {...(kit ? { kit } : {})}
        kitLoading={kitLoading}
        {...(kitError ? { kitError } : {})}
        {...(visualRecord ? { visualRecord } : {})}
        {...(visualError ? { visualError } : {})}
        busy={busy}
        onSelectPick={selectContentPick}
        onCreateVisualBrief={(input) => void createVisualBrief(input)}
        onStartVisualRequest={() => void startVisualRequest()}
        onSelectAngle={selectContentAngle}
        onCopyVariant={copyPlatformVariant}
        onExportVariant={exportPlatformVariant}
      />
    </section>
  );
}
