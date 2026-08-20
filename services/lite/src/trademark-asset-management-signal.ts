import { createHash } from 'node:crypto';
import type {
  TrademarkAssetObservedFact,
  TrademarkAssetObservedFactValue,
  TrademarkAssetView
} from '@markorbit/contracts/trademark-asset-composition';
import type {
  TrademarkAssetManagementChangeReference,
  TrademarkAssetManagementSignal,
  TrademarkAssetManagementSignalDimension,
  TrademarkAssetManagementSignalId,
  TrademarkAssetManagementSignalSeverity
} from '@markorbit/contracts/trademark-asset-management';
import type { TrademarkAssetSourceReference } from '@markorbit/contracts/trademark-asset-workspace';
import type { TrademarkAssetRefreshRun } from './trademark-asset-refresh.js';

const DAY_MS = 86_400_000;

function stableSignalId(
  view: Readonly<TrademarkAssetView>,
  dimension: TrademarkAssetManagementSignalDimension,
  discriminator: string
): TrademarkAssetManagementSignalId {
  const digest = createHash('sha256')
    .update(`${view.workspaceId}:${view.trademarkAssetId}:${dimension}:${discriminator}`)
    .digest('hex')
    .slice(0, 24);
  return `trademark-asset-management-signal_${digest}`;
}

function sourceKey(source: Readonly<TrademarkAssetSourceReference>): string {
  return `${source.owner}:${source.kind}:${source.sourceId}`;
}

function uniqueEvidence(
  sources: readonly Readonly<TrademarkAssetSourceReference>[]
): TrademarkAssetSourceReference[] {
  const byKey = new Map<string, TrademarkAssetSourceReference>();
  for (const source of sources) {
    const key = `${sourceKey(source)}:${source.sourceVersion}:${source.freshness}`;
    if (!byKey.has(key)) byKey.set(key, structuredClone(source));
  }
  return [...byKey.values()].sort((a, b) => sourceKey(a).localeCompare(sourceKey(b)));
}

function changesForEvidence(
  refresh: Readonly<TrademarkAssetRefreshRun> | undefined,
  evidence: readonly Readonly<TrademarkAssetSourceReference>[]
): TrademarkAssetManagementChangeReference[] {
  if (!refresh) return [];
  const keys = new Set(evidence.map(sourceKey));
  return refresh.changes
    .filter((change) => change.sourceReferences.some((source) => keys.has(sourceKey(source))))
    .map((change) => structuredClone(change));
}

function signal(
  view: Readonly<TrademarkAssetView>,
  dimension: TrademarkAssetManagementSignalDimension,
  severity: TrademarkAssetManagementSignalSeverity,
  reason: string,
  evidenceInput: readonly Readonly<TrademarkAssetSourceReference>[],
  refresh: Readonly<TrademarkAssetRefreshRun> | undefined,
  generatedAt: string,
  discriminator: string
): TrademarkAssetManagementSignal {
  const evidence = uniqueEvidence(evidenceInput);
  return {
    schemaVersion: 1,
    managementSignalId: stableSignalId(view, dimension, discriminator),
    workspaceId: view.workspaceId,
    version: Math.max(view.anchorVersion, refresh ? 1 : 0),
    asset: { id: view.trademarkAssetId, version: view.anchorVersion },
    dimension,
    severity,
    reason,
    changes: changesForEvidence(refresh, evidence),
    evidence,
    freshness: view.freshness,
    generatedAt,
    legalDeadlineCertified: false,
    officialStatusVerifiedByLite: false,
    legalConclusionVerified: false,
    conflictResolvedByLite: false,
    executionAuthorized: false
  };
}

function textValue(value: TrademarkAssetObservedFactValue): string {
  return Array.isArray(value) ? value.join(', ') : String(value);
}

function daysFrom(value: TrademarkAssetObservedFactValue, generatedAt: string): number | undefined {
  if (typeof value !== 'string') return undefined;
  const target = Date.parse(value);
  const now = Date.parse(generatedAt);
  if (!Number.isFinite(target) || !Number.isFinite(now)) return undefined;
  return Math.ceil((target - now) / DAY_MS);
}

function dateSeverity(days: number): TrademarkAssetManagementSignalSeverity | undefined {
  if (days > 180) return undefined;
  if (days <= 30) return 'URGENT';
  if (days <= 90) return 'IMPORTANT';
  return 'NOTICE';
}

function consequentialEvidence(
  view: Readonly<TrademarkAssetView>
): TrademarkAssetSourceReference[] {
  return uniqueEvidence(
    view.observedFacts.filter((fact) => fact.consequential).map((fact) => fact.source)
  );
}

function staleConsequentialFacts(
  view: Readonly<TrademarkAssetView>
): ReadonlyArray<Readonly<TrademarkAssetObservedFact>> {
  return view.observedFacts.filter((fact) => fact.consequential && fact.freshness !== 'CURRENT');
}

/**
 * Derive proactive Product management signals from current source-owned context plus an optional
 * exact refresh run. Signals explain management relevance; they never certify official truth,
 * legal deadlines, legal outcomes, conflict winners, or execution authority.
 */
export function deriveTrademarkAssetManagementSignals(
  view: Readonly<TrademarkAssetView>,
  refresh?: Readonly<TrademarkAssetRefreshRun>,
  generatedAt = new Date().toISOString()
): readonly TrademarkAssetManagementSignal[] {
  if (
    refresh &&
    (refresh.workspaceId !== view.workspaceId || refresh.trademarkAssetId !== view.trademarkAssetId)
  ) {
    throw new Error('Refresh run must belong to the same Workspace Trademark Asset view.');
  }
  if (!Number.isFinite(Date.parse(generatedAt))) {
    throw new Error('generatedAt must be a valid timestamp.');
  }

  const result: TrademarkAssetManagementSignal[] = [];
  const consequential = consequentialEvidence(view);
  const staleFacts = staleConsequentialFacts(view);

  if (view.observedFacts.filter((fact) => fact.consequential).length === 0) {
    result.push(
      signal(
        view,
        'MISSING_CONSEQUENTIAL_CONTEXT',
        'NOTICE',
        'No consequential source-owned facts are currently available for this Asset; gather or refresh source context before relying on management recommendations.',
        view.sourceReferences,
        refresh,
        generatedAt,
        'no-consequential-facts'
      )
    );
  }

  if (view.freshness !== 'CURRENT' || staleFacts.length > 0) {
    const staleEvidence =
      staleFacts.length > 0 ? staleFacts.map((fact) => fact.source) : consequential;
    result.push(
      signal(
        view,
        'SOURCE_FRESHNESS',
        view.freshness === 'CONFLICTING' ? 'IMPORTANT' : 'NOTICE',
        `Consequential Asset context is ${view.freshness.toLowerCase()} or contains non-current observations; verify source freshness before acting.`,
        staleEvidence.length > 0 ? staleEvidence : view.sourceReferences,
        refresh,
        generatedAt,
        `freshness:${view.freshness}:${staleFacts
          .map((fact) => fact.kind)
          .sort()
          .join(',')}`
      )
    );
  }

  for (const conflict of view.conflicts) {
    result.push(
      signal(
        view,
        'SOURCE_CONFLICT',
        'IMPORTANT',
        `${conflict.kind} has conflicting source observations (${conflict.values.map(textValue).join(' ↔ ')}). Lite keeps the conflict unresolved and requires source/owner review.`,
        conflict.evidence,
        refresh,
        generatedAt,
        `conflict:${conflict.kind}:${conflict.values.map(textValue).join('|')}`
      )
    );
  }

  for (const fact of view.observedFacts.filter((candidate) => candidate.kind === 'RENEWAL_DATE')) {
    const days = daysFrom(fact.value, generatedAt);
    if (days === undefined) continue;
    const severity = dateSeverity(days);
    if (!severity) continue;
    const timing = days < 0 ? `${Math.abs(days)} days after` : `${days} days before`;
    result.push(
      signal(
        view,
        'OBSERVED_DATE_PROXIMITY',
        severity,
        `A source reports renewal date ${textValue(fact.value)}; today is ${timing} that observed date. This is a management signal only—verify the source and legal deadline before acting.`,
        [fact.source],
        refresh,
        generatedAt,
        `renewal:${sourceKey(fact.source)}:${fact.source.sourceVersion}:${textValue(fact.value)}`
      )
    );
  }

  for (const context of view.contextSignals) {
    if (context.kind === 'RECOMMENDED_ACTION') {
      result.push(
        signal(
          view,
          'LIFECYCLE_RELEVANCE',
          context.freshness === 'CURRENT' ? 'IMPORTANT' : 'NOTICE',
          `Owner-domain lifecycle recommendation is available: ${context.value}`,
          [context.source],
          refresh,
          generatedAt,
          `lifecycle:${sourceKey(context.source)}:${context.source.sourceVersion}:${context.value}`
        )
      );
    }
    if (context.kind === 'KNOWLEDGE_RELEVANCE') {
      result.push(
        signal(
          view,
          'KNOWLEDGE_CHANGE_RELEVANCE',
          context.freshness === 'CURRENT' ? 'NOTICE' : 'INFO',
          `Relevant Knowledge/rule material may affect management review: ${context.value}`,
          [context.source],
          refresh,
          generatedAt,
          `knowledge:${sourceKey(context.source)}:${context.source.sourceVersion}:${context.value}`
        )
      );
    }
  }

  const priority = view.anchor.workspacePriority?.trim();
  if (priority) {
    const normalized = priority.toLowerCase();
    result.push(
      signal(
        view,
        'USER_PRIORITY',
        normalized.includes('urgent')
          ? 'URGENT'
          : normalized.includes('high')
            ? 'IMPORTANT'
            : 'NOTICE',
        `Workspace user priority: ${priority}`,
        view.anchor.sourceReferences,
        refresh,
        generatedAt,
        `priority:${priority}`
      )
    );
  }

  return result.sort((a, b) => {
    const rank: Record<TrademarkAssetManagementSignalSeverity, number> = {
      URGENT: 4,
      IMPORTANT: 3,
      NOTICE: 2,
      INFO: 1
    };
    return (
      rank[b.severity] - rank[a.severity] ||
      a.managementSignalId.localeCompare(b.managementSignalId)
    );
  });
}

/**
 * Optional portfolio-level repeated-condition overlay. A pattern is emitted only when at least
 * three accessible Assets already carry the same evidence-backed dimension. It does not create
 * new factual or legal assertions; each Asset receives a Product-only concentration signal using
 * its own underlying evidence.
 */
export function deriveRepeatedPortfolioConditionSignals(
  entries: ReadonlyArray<{
    view: Readonly<TrademarkAssetView>;
    signals: readonly Readonly<TrademarkAssetManagementSignal>[];
  }>,
  dimension: Exclude<TrademarkAssetManagementSignalDimension, 'PORTFOLIO_PATTERN'>,
  generatedAt = new Date().toISOString()
): readonly TrademarkAssetManagementSignal[] {
  const matching = entries.filter((entry) =>
    entry.signals.some((item) => item.dimension === dimension)
  );
  if (matching.length < 3) return [];

  return matching.map((entry) => {
    const underlying = entry.signals.filter((item) => item.dimension === dimension);
    const evidence = uniqueEvidence(underlying.flatMap((item) => item.evidence));
    return signal(
      entry.view,
      'PORTFOLIO_PATTERN',
      'NOTICE',
      `${matching.length} accessible portfolio Assets currently share the ${dimension.toLowerCase().replaceAll('_', ' ')} condition. Review concentration as a Product management pattern, not a legal conclusion.`,
      evidence,
      undefined,
      generatedAt,
      `portfolio:${dimension}:${matching
        .map((item) => item.view.trademarkAssetId)
        .sort()
        .join(',')}`
    );
  });
}

export const trademarkAssetManagementSignalAuthority = {
  readOnlyProductDerivation: true,
  mayUseCurrentSourceOwnedFacts: true,
  mayUseExactRefreshChanges: true,
  mayHighlightObservedDateProximity: true,
  maySurfaceStaleOrMissingConsequentialContext: true,
  maySurfaceUnresolvedSourceConflict: true,
  maySurfaceLifecycleRecommendationRelevance: true,
  maySurfaceKnowledgeChangeRelevance: true,
  maySurfaceUserPriority: true,
  maySurfaceEvidenceBackedPortfolioPattern: true,
  mayCertifyLegalDeadline: false,
  mayVerifyOfficialStatus: false,
  mayFormLegalConclusion: false,
  mayResolveSourceConflict: false,
  mayAuthorizeExecution: false,
  mayMutateOwnerDomain: false
} as const;
