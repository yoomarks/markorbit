import { useEffect, useState } from 'react';
import type { TrademarkAssetAiGuidePreparedResult } from '@markorbit/contracts/trademark-asset-ai-guide';
import type { TrademarkAssetCommerceProfile } from '@markorbit/contracts/trademark-asset-commerce';
import type { TrademarkAssetView } from '@markorbit/contracts/trademark-asset-composition';
import type {
  TrademarkAssetManagementDisposition,
  TrademarkAssetManagementRecommendation,
  TrademarkAssetManagementSignal
} from '@markorbit/contracts/trademark-asset-management';
import type { TrademarkAssetMarketplaceOverlay } from '@markorbit/contracts/trademark-asset-marketplace-reference';
import type { TrademarkAssetAttentionSignal } from '@markorbit/contracts/trademark-asset-workspace';
import { Button } from '@markorbit/ui';
import {
  TrademarkAssetHttpError,
  type BrowserTrademarkAssetManagementDispositionKind,
  type CurrentTrademarkAssetManagementDispositionProjection,
  type PrepareTrademarkAssetAiGuideRequest,
  type RecordTrademarkAssetManagementDispositionInput,
  type SaveTrademarkAssetCommerceProfileInput,
  type TrademarkAssetRefreshSummary
} from '../../api/trademark-assets.js';
import { TrademarkAssetAiGuide } from './TrademarkAssetAiGuide.js';
import { TrademarkAssetCommerceProfileSection } from './TrademarkAssetCommerceProfile.js';
import './trademark-asset-workspace.css';

export interface TrademarkAssetWorkspaceProps {
  view: Readonly<TrademarkAssetView>;
  attention?: readonly Readonly<TrademarkAssetAttentionSignal>[];
  latestRefresh?: Readonly<TrademarkAssetRefreshSummary>;
  managementSignals?: readonly Readonly<TrademarkAssetManagementSignal>[];
  recommendations?: readonly Readonly<TrademarkAssetManagementRecommendation>[];
  managementDispositions?: Readonly<CurrentTrademarkAssetManagementDispositionProjection>;
  managementDispositionReadUnavailable?: boolean;
  onRecordManagementDisposition?: (
    input: Readonly<RecordTrademarkAssetManagementDispositionInput>,
    idempotencyKey: string
  ) => Promise<TrademarkAssetManagementDisposition>;
  onReloadManagementDispositions?: () => Promise<CurrentTrademarkAssetManagementDispositionProjection>;
  onReloadAsset?: () => Promise<void>;
  commerceProfile?: Readonly<TrademarkAssetCommerceProfile>;
  onSaveCommerceProfile?: (
    input: Readonly<SaveTrademarkAssetCommerceProfileInput>
  ) => Promise<TrademarkAssetCommerceProfile>;
  onReloadCommerceProfile?: () => void | Promise<void>;
  marketplaceOverlay?: Readonly<TrademarkAssetMarketplaceOverlay>;
  aiGuide?: Readonly<TrademarkAssetAiGuidePreparedResult>;
  onPrepareAiGuide?: (
    input: Readonly<PrepareTrademarkAssetAiGuideRequest>
  ) => Promise<TrademarkAssetAiGuidePreparedResult>;
}

type MutationPhase = 'submitting' | 'reload-required' | 'stale' | 'unavailable';
interface PendingMutation {
  assetVersion: number;
  signalId: string;
  signalVersion: number;
  recommendationId?: string;
  recommendationVersion?: number;
  kind: BrowserTrademarkAssetManagementDispositionKind;
  idempotencyKey: string;
  phase: MutationPhase;
}

const textValue = (value: string | number | boolean | readonly string[]) =>
  Array.isArray(value) ? value.join(', ') : String(value);

function destinationForRecommendation(
  recommendation: Readonly<TrademarkAssetManagementRecommendation>
): '#today' | '#matters' {
  if (
    recommendation.kind === 'PREPARE_OWNER_WORK_CANDIDATE' ||
    recommendation.kind === 'REVIEW_LIFECYCLE_RECOMMENDATION'
  ) {
    return '#matters';
  }
  return '#today';
}

function dispositionLabel(kind: TrademarkAssetManagementDisposition['kind']): string {
  switch (kind) {
    case 'WATCHED':
      return 'Watched';
    case 'DEFERRED':
      return 'Deferred';
    case 'DISMISSED':
      return 'Dismissed';
    case 'CONTINUED':
      return 'Continued';
    case 'RESOLVED_BY_WORKFLOW_REFERENCE':
      return 'Resolved by owner workflow';
  }
}

export function TrademarkAssetWorkspace({
  view,
  attention = [],
  latestRefresh,
  managementSignals = [],
  recommendations = [],
  managementDispositions,
  managementDispositionReadUnavailable = false,
  onRecordManagementDisposition,
  onReloadManagementDispositions,
  onReloadAsset,
  commerceProfile,
  onSaveCommerceProfile,
  onReloadCommerceProfile,
  marketplaceOverlay,
  aiGuide,
  onPrepareAiGuide
}: TrademarkAssetWorkspaceProps) {
  const relationships = view.anchor.workspaceRelationships.map((relationship) => relationship.kind);
  const isMarketplaceReference = relationships.includes('MARKETPLACE_ADDED');
  const commerceProfileEditable = view.anchor.workspaceRelationships.some(
    (relationship) =>
      relationship.kind === 'OWNED' ||
      relationship.kind === 'MANAGED' ||
      relationship.kind === 'REPRESENTED'
  );
  const [pendingMutation, setPendingMutation] = useState<PendingMutation>();
  const [confirmingRecommendationId, setConfirmingRecommendationId] = useState<string>();

  const recommendationForSignal = (signal: Readonly<TrademarkAssetManagementSignal>) =>
    recommendations.find((recommendation) =>
      recommendation.signalReferences.some(
        (reference) =>
          reference.id === signal.managementSignalId && reference.version === signal.version
      )
    );

  const dispositionForSignal = (signal: Readonly<TrademarkAssetManagementSignal>) =>
    managementDispositions?.items.find(
      (item) =>
        item.signal.id === signal.managementSignalId && item.signal.version === signal.version
    )?.disposition ?? null;

  useEffect(() => {
    if (!pendingMutation) return;
    const stillCurrent =
      view.anchor.version === pendingMutation.assetVersion &&
      managementSignals.some(
        (signal) =>
          signal.managementSignalId === pendingMutation.signalId &&
          signal.version === pendingMutation.signalVersion
      );
    if (!stillCurrent) {
      setPendingMutation(undefined);
      setConfirmingRecommendationId(undefined);
    }
  }, [managementSignals, pendingMutation, view.anchor.version]);

  const captureDisposition = async (
    signal: Readonly<TrademarkAssetManagementSignal>,
    recommendation: Readonly<TrademarkAssetManagementRecommendation> | undefined,
    kind: BrowserTrademarkAssetManagementDispositionKind
  ) => {
    if (!onRecordManagementDisposition || !onReloadManagementDispositions || pendingMutation) {
      return;
    }
    const idempotencyKey = `trademark-disposition-${view.trademarkAssetId}-${signal.managementSignalId}-${signal.version}-${kind}-${crypto.randomUUID()}`;
    const context: PendingMutation = {
      assetVersion: view.anchor.version,
      signalId: signal.managementSignalId,
      signalVersion: signal.version,
      ...(recommendation
        ? {
            recommendationId: recommendation.recommendationId,
            recommendationVersion: recommendation.version
          }
        : {}),
      kind,
      idempotencyKey,
      phase: 'submitting'
    };
    setPendingMutation(context);
    try {
      await onRecordManagementDisposition(
        {
          expectedTrademarkAssetVersion: view.anchor.version,
          managementSignal: { id: signal.managementSignalId, version: signal.version },
          ...(recommendation
            ? {
                recommendation: {
                  id: recommendation.recommendationId,
                  version: recommendation.version
                }
              }
            : {}),
          kind
        },
        idempotencyKey
      );
      try {
        const projection = await onReloadManagementDispositions();
        const confirmed = projection.items.find(
          (item) =>
            item.signal.id === signal.managementSignalId && item.signal.version === signal.version
        )?.disposition;
        if (!confirmed || (kind === 'CONTINUED' && confirmed.kind !== 'CONTINUED')) {
          setPendingMutation({ ...context, phase: 'reload-required' });
          return;
        }
        setPendingMutation(undefined);
        setConfirmingRecommendationId(undefined);
        if (kind === 'CONTINUED' && recommendation) {
          window.location.hash = destinationForRecommendation(recommendation);
        }
      } catch {
        setPendingMutation({ ...context, phase: 'reload-required' });
      }
    } catch (error) {
      if (error instanceof TrademarkAssetHttpError && error.status === 409) {
        setPendingMutation({ ...context, phase: 'stale' });
        try {
          await onReloadAsset?.();
        } catch {
          // Keep the stale lock visible; a second logical POST must not be created.
        }
        return;
      }
      setPendingMutation({ ...context, phase: 'unavailable' });
    }
  };

  const retryDurableReload = async () => {
    if (!pendingMutation || !onReloadManagementDispositions) return;
    try {
      const projection = await onReloadManagementDispositions();
      const confirmed = projection.items.find(
        (item) =>
          item.signal.id === pendingMutation.signalId &&
          item.signal.version === pendingMutation.signalVersion
      )?.disposition;
      const continuedConfirmed =
        pendingMutation.kind !== 'CONTINUED' || confirmed?.kind === 'CONTINUED';
      if (confirmed && continuedConfirmed) {
        const recommendation = recommendations.find(
          (candidate) =>
            candidate.recommendationId === pendingMutation.recommendationId &&
            candidate.version === pendingMutation.recommendationVersion
        );
        const continued = pendingMutation.kind === 'CONTINUED';
        setPendingMutation(undefined);
        setConfirmingRecommendationId(undefined);
        if (continued && recommendation) {
          window.location.hash = destinationForRecommendation(recommendation);
        }
      } else {
        setPendingMutation({ ...pendingMutation, phase: 'reload-required' });
      }
    } catch {
      setPendingMutation({ ...pendingMutation, phase: 'reload-required' });
    }
  };

  return (
    <main className="trademark-asset-workspace" data-testid="trademark-asset-workspace">
      <header className="trademark-asset-workspace__header">
        <div>
          <p className="trademark-asset-workspace__eyebrow">Trademark Asset Workspace</p>
          <h1>{view.anchor.identity.markText || 'Untitled trademark asset'}</h1>
          <p>
            {view.anchor.identity.jurisdiction} · Asset {view.trademarkAssetId}
          </p>
        </div>
        <div
          className="trademark-asset-workspace__badges"
          aria-label="Asset authority and freshness"
        >
          <span>{relationships.join(' · ')}</span>
          <span>{view.freshness}</span>
          {isMarketplaceReference && !commerceProfileEditable ? (
            <span>Marketplace source · read-only</span>
          ) : null}
        </div>
      </header>

      <section aria-labelledby="asset-management-heading">
        <div className="trademark-asset-workspace__section-heading">
          <div>
            <p>Product-derived management layer</p>
            <h2 id="asset-management-heading">What needs attention now</h2>
          </div>
          <span>Observed fact ≠ Product signal ≠ recommendation ≠ governed work</span>
        </div>
        {managementDispositionReadUnavailable ? (
          <p role="status">
            Durable management disposition truth is unavailable. The loaded Trademark workspace is
            preserved; no local fallback is being used.
          </p>
        ) : null}
        {managementSignals.length ? (
          <div className="trademark-asset-workspace__guide-grid">
            {managementSignals.map((signal) => {
              const recommendation = recommendationForSignal(signal);
              const disposition = dispositionForSignal(signal);
              const resolvedByOwner = disposition?.kind === 'RESOLVED_BY_WORKFLOW_REFERENCE';
              const mutationForSignal =
                pendingMutation?.signalId === signal.managementSignalId &&
                pendingMutation.signalVersion === signal.version
                  ? pendingMutation
                  : undefined;
              const confirming = recommendation?.recommendationId === confirmingRecommendationId;
              const controlsDisabled =
                Boolean(mutationForSignal) ||
                resolvedByOwner ||
                managementDispositionReadUnavailable ||
                !onRecordManagementDisposition ||
                !onReloadManagementDispositions;
              return (
                <article key={`${signal.managementSignalId}@${signal.version}`}>
                  <p className="trademark-asset-workspace__eyebrow">Product signal</p>
                  <h3>
                    {signal.severity} · {signal.dimension}
                  </h3>
                  <p>{signal.reason}</p>
                  <small>
                    Freshness: {signal.freshness} · {signal.evidence.length} evidence reference
                    {signal.evidence.length === 1 ? '' : 's'} · no legal-deadline certification
                  </small>
                  {disposition ? (
                    <p role="status">
                      Durable disposition: <strong>{dispositionLabel(disposition.kind)}</strong>
                      {disposition.note ? ` · ${disposition.note}` : ''}
                      {resolvedByOwner
                        ? ' · owner-governed read truth; browser changes are disabled.'
                        : ' · private Product management truth; source truth is unchanged.'}
                    </p>
                  ) : !managementDispositionReadUnavailable ? (
                    <p role="status">
                      No durable disposition for this exact current Signal version.
                    </p>
                  ) : null}
                  {recommendation ? (
                    <div className="trademark-asset-workspace__recommendation">
                      <p className="trademark-asset-workspace__eyebrow">
                        Reviewable recommendation
                      </p>
                      <strong>{recommendation.title}</strong>
                      <p>{recommendation.explanation}</p>
                      <small>
                        User confirmation required · filing, contact, payment and publication remain
                        unauthorized
                      </small>
                      <div className="trademark-asset-portfolio__actions">
                        {(
                          [
                            ['WATCHED', 'Watch'],
                            ['DEFERRED', 'Defer'],
                            ['DISMISSED', 'Dismiss']
                          ] as const
                        ).map(([kind, label]) => (
                          <Button
                            key={kind}
                            variant="secondary"
                            disabled={controlsDisabled}
                            onClick={() => void captureDisposition(signal, recommendation, kind)}
                          >
                            {label}
                          </Button>
                        ))}
                        {confirming ? (
                          <Button
                            disabled={controlsDisabled}
                            onClick={() =>
                              void captureDisposition(signal, recommendation, 'CONTINUED')
                            }
                          >
                            Confirm & continue
                          </Button>
                        ) : (
                          <Button
                            disabled={controlsDisabled}
                            onClick={() =>
                              setConfirmingRecommendationId(recommendation.recommendationId)
                            }
                          >
                            Continue
                          </Button>
                        )}
                      </div>
                      {confirming && !mutationForSignal ? (
                        <p role="status">
                          Confirming records Product continuation before opening the governed
                          surface. It does not authorize a filing or other protected action.
                        </p>
                      ) : null}
                      {mutationForSignal?.phase === 'submitting' ? (
                        <p role="status">Saving private Product disposition…</p>
                      ) : null}
                      {mutationForSignal?.phase === 'reload-required' ? (
                        <div role="status">
                          <p>
                            The write may have succeeded, but durable owner truth is not confirmed.
                            This action remains locked and will not be posted again.
                          </p>
                          <Button variant="secondary" onClick={() => void retryDurableReload()}>
                            Reload durable truth
                          </Button>
                        </div>
                      ) : null}
                      {mutationForSignal?.phase === 'stale' ? (
                        <p role="status">
                          The Asset or Signal changed. Current owner truth is being reloaded; choose
                          an action again only against the new exact Signal version.
                        </p>
                      ) : null}
                      {mutationForSignal?.phase === 'unavailable' ? (
                        <p role="status">
                          The disposition service is unavailable. No local success was created and
                          this logical action remains locked.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p>No current M11 management signal.</p>
        )}
      </section>

      <section aria-labelledby="asset-change-heading">
        <div className="trademark-asset-workspace__section-heading">
          <div>
            <p>Refresh ledger</p>
            <h2 id="asset-change-heading">What changed since the last comparable refresh</h2>
          </div>
          <span>
            {latestRefresh ? `Observed ${latestRefresh.refreshedAt}` : 'No refresh recorded'}
          </span>
        </div>
        {latestRefresh?.changes.length ? (
          <ul className="trademark-asset-workspace__change-list">
            {latestRefresh.changes.map((change, index) => (
              <li key={`${change.kind}-${change.observedAt}-${index}`}>
                <strong>{change.kind}</strong>
                <span>
                  {change.previousSourceVersion ? `from ${change.previousSourceVersion} ` : ''}
                  {change.currentSourceVersion ? `to ${change.currentSourceVersion}` : ''}
                </span>
                <small>
                  {change.sourceReferences
                    .map((source) => `${source.owner}:${source.kind}`)
                    .join(' · ')}
                  {' · '}
                  {change.freshness}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {latestRefresh
              ? 'The latest comparable refresh recorded no material or freshness change.'
              : 'No durable refresh comparison is available yet.'}
          </p>
        )}
      </section>

      <section aria-labelledby="asset-attention-heading">
        <div className="trademark-asset-workspace__section-heading">
          <div>
            <p>Legacy explainable attention</p>
            <h2 id="asset-attention-heading">M10 attention context</h2>
          </div>
          <span>No deadline or official-status certification</span>
        </div>
        {attention.length ? (
          <div className="trademark-asset-workspace__guide-grid">
            {attention.map((item) => (
              <article key={item.attentionSignalId}>
                <h3>
                  {item.severity} · {item.dimension}
                </h3>
                <p>{item.reason}</p>
                <small>
                  {item.evidence.length} source reference{item.evidence.length === 1 ? '' : 's'}
                </small>
              </article>
            ))}
          </div>
        ) : (
          <p>No current M10 attention signal.</p>
        )}
      </section>

      <section aria-labelledby="asset-facts-heading">
        <div className="trademark-asset-workspace__section-heading">
          <div>
            <p>Source-owned evidence</p>
            <h2 id="asset-facts-heading">Observed facts</h2>
          </div>
          <span>Lite does not verify official truth</span>
        </div>
        {view.observedFacts.length ? (
          <dl className="trademark-asset-workspace__fact-grid">
            {view.observedFacts.map((fact, index) => (
              <div key={`${fact.kind}-${index}`}>
                <dt>{fact.kind}</dt>
                <dd>{textValue(fact.value)}</dd>
                <small>
                  {fact.source.owner} · {fact.source.kind} · {fact.freshness}
                </small>
              </div>
            ))}
          </dl>
        ) : (
          <p>No source-owned facts are currently available.</p>
        )}
      </section>

      <section aria-labelledby="asset-conflicts-heading">
        <div className="trademark-asset-workspace__section-heading">
          <div>
            <p>Audit surface</p>
            <h2 id="asset-conflicts-heading">Conflicts & source references</h2>
          </div>
        </div>
        {view.conflicts.length ? (
          <ul>
            {view.conflicts.map((conflict, index) => (
              <li key={`${conflict.kind}-${index}`}>
                <strong>{conflict.kind}</strong>: {conflict.values.map(textValue).join(' ↔ ')} ·
                unresolved
              </li>
            ))}
          </ul>
        ) : (
          <p>No unresolved composed-view conflicts.</p>
        )}
        <ul className="trademark-asset-workspace__sources">
          {view.sourceReferences.map((source) => (
            <li key={`${source.owner}-${source.kind}-${source.sourceId}-${source.sourceVersion}`}>
              {source.owner} / {source.kind} / {source.sourceId}@{source.sourceVersion} ·{' '}
              {source.freshness}
            </li>
          ))}
        </ul>
      </section>

      <TrademarkAssetCommerceProfileSection
        assetVersion={view.anchor.version}
        {...(commerceProfile ? { profile: commerceProfile } : {})}
        readOnly={!commerceProfileEditable}
        {...(onSaveCommerceProfile ? { onSave: onSaveCommerceProfile } : {})}
        {...(onReloadCommerceProfile ? { onReload: onReloadCommerceProfile } : {})}
      />

      {marketplaceOverlay ? (
        <section aria-labelledby="marketplace-overlay-heading">
          <div className="trademark-asset-workspace__section-heading">
            <div>
              <p>Workspace-private overlay</p>
              <h2 id="marketplace-overlay-heading">Marketplace reference</h2>
            </div>
            <span>Source price and listing remain read-only</span>
          </div>
          <p>{marketplaceOverlay.headline || 'No private reseller headline.'}</p>
          <p>
            Source listing: {marketplaceOverlay.source.sourceListingId}@
            {marketplaceOverlay.source.sourceListingVersion}
          </p>
        </section>
      ) : null}

      {onPrepareAiGuide ? (
        <TrademarkAssetAiGuide
          assetId={view.trademarkAssetId}
          assetVersion={view.anchorVersion}
          {...(aiGuide ? { initialResult: aiGuide } : {})}
          onPrepare={onPrepareAiGuide}
        />
      ) : null}

      <aside className="trademark-asset-workspace__authority" aria-label="Lite authority boundary">
        <strong>Authority boundary</strong>
        <span>Source facts are read-only in this workspace.</span>
        <span>
          Management Signals and recommendations are Product inference, not official truth.
        </span>
        <span>AI output is advisory and never becomes an official fact.</span>
        <span>
          Filing, provider contact, Marketplace publication, transfer and payment stay outside Lite.
        </span>
      </aside>
    </main>
  );
}
