import { createHash } from 'node:crypto';
import type {
  TrademarkAssetObservedFactValue,
  TrademarkAssetView
} from '@markorbit/contracts/trademark-asset-composition';
import type {
  TrademarkAssetAttentionDimension,
  TrademarkAssetAttentionSeverity,
  TrademarkAssetAttentionSignal,
  TrademarkAssetAttentionSignalId,
  TrademarkAssetSourceReference
} from '@markorbit/contracts/trademark-asset-workspace';

function attentionId(
  view: Readonly<TrademarkAssetView>,
  dimension: TrademarkAssetAttentionDimension,
  discriminator: string
): TrademarkAssetAttentionSignalId {
  const digest = createHash('sha256')
    .update(
      `${view.workspaceId}:${view.trademarkAssetId}:${view.anchorVersion}:${dimension}:${discriminator}`
    )
    .digest('hex')
    .slice(0, 24);
  return `trademark-asset-attention_${digest}`;
}

function signal(
  view: Readonly<TrademarkAssetView>,
  dimension: TrademarkAssetAttentionDimension,
  severity: TrademarkAssetAttentionSeverity,
  reason: string,
  evidence: readonly Readonly<TrademarkAssetSourceReference>[],
  generatedAt: string,
  discriminator: string
): TrademarkAssetAttentionSignal {
  return {
    schemaVersion: 1,
    attentionSignalId: attentionId(view, dimension, discriminator),
    workspaceId: view.workspaceId,
    version: view.anchorVersion,
    asset: { id: view.trademarkAssetId, version: view.anchorVersion },
    dimension,
    severity,
    reason,
    evidence,
    generatedAt,
    legalDeadlineCertified: false,
    officialStatusVerifiedByLite: false,
    executionAuthorized: false
  };
}

function textValue(value: TrademarkAssetObservedFactValue): string {
  return Array.isArray(value) ? value.join(', ') : String(value);
}

function daysUntil(value: TrademarkAssetObservedFactValue, generatedAt: string): number | undefined {
  if (typeof value !== 'string') return undefined;
  const target = Date.parse(value);
  const now = Date.parse(generatedAt);
  if (!Number.isFinite(target) || !Number.isFinite(now)) return undefined;
  return Math.ceil((target - now) / 86_400_000);
}

/**
 * Deterministic, read-only attention projection over the current composed Asset view.
 * It explains why the Product should surface an Asset; it never verifies official truth,
 * certifies a legal deadline, chooses a winner across conflicts, or authorizes execution.
 */
export function deriveTrademarkAssetAttention(
  view: Readonly<TrademarkAssetView>,
  generatedAt = new Date().toISOString()
): readonly TrademarkAssetAttentionSignal[] {
  const result: TrademarkAssetAttentionSignal[] = [];

  if (view.freshness !== 'CURRENT') {
    result.push(
      signal(
        view,
        'SOURCE_FRESHNESS',
        view.freshness === 'CONFLICTING' ? 'IMPORTANT' : 'NOTICE',
        `Asset source context is ${view.freshness.toLowerCase()}; review provenance before relying on consequential suggestions.`,
        view.sourceReferences,
        generatedAt,
        view.freshness
      )
    );
  }

  if (view.observedFacts.length === 0 || view.sourceReferences.length === 0) {
    result.push(
      signal(
        view,
        'MISSING_CONTEXT',
        'NOTICE',
        'The Asset does not yet have enough source-owned context for a complete working view.',
        view.sourceReferences,
        generatedAt,
        'missing-source-context'
      )
    );
  }

  for (const conflict of view.conflicts) {
    result.push(
      signal(
        view,
        'SOURCE_FRESHNESS',
        'IMPORTANT',
        `${conflict.kind} has conflicting source observations (${conflict.values.map(textValue).join(' ↔ ')}); Lite keeps the conflict unresolved.`,
        conflict.evidence,
        generatedAt,
        `conflict:${conflict.kind}`
      )
    );
  }

  for (const context of view.contextSignals) {
    if (context.kind === 'RECOMMENDED_ACTION') {
      result.push(
        signal(
          view,
          'LIFECYCLE_RECOMMENDATION',
          'IMPORTANT',
          `Owner-domain recommendation available: ${context.value}`,
          [context.source],
          generatedAt,
          `${context.kind}:${context.source.sourceId}:${context.source.sourceVersion}`
        )
      );
    } else if (context.kind === 'KNOWLEDGE_RELEVANCE') {
      result.push(
        signal(
          view,
          'KNOWLEDGE_CHANGE_RELEVANCE',
          'NOTICE',
          `Relevant source/rule material is available: ${context.value}`,
          [context.source],
          generatedAt,
          `${context.kind}:${context.source.sourceId}:${context.source.sourceVersion}`
        )
      );
    }
  }

  const renewalFacts = view.observedFacts.filter((fact) => fact.kind === 'RENEWAL_DATE');
  for (const fact of renewalFacts) {
    const days = daysUntil(fact.value, generatedAt);
    if (days === undefined || days > 90) continue;
    const severity: TrademarkAssetAttentionSeverity =
      days <= 30 ? 'URGENT' : days <= 60 ? 'IMPORTANT' : 'NOTICE';
    const timing =
      days < 0
        ? `${Math.abs(days)} days past the observed date`
        : `${days} days from the observed date`;
    result.push(
      signal(
        view,
        'TIME_SENSITIVITY',
        severity,
        `A source reports renewal date ${textValue(fact.value)} (${timing}). Verify the source and legal deadline before acting.`,
        [fact.source],
        generatedAt,
        `renewal:${fact.source.sourceId}:${fact.source.sourceVersion}:${textValue(fact.value)}`
      )
    );
  }

  if (view.anchor.workspacePriority?.trim()) {
    const priority = view.anchor.workspacePriority.trim();
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
        `Workspace priority: ${priority}`,
        view.anchor.sourceReferences,
        generatedAt,
        `priority:${priority}`
      )
    );
  }

  return result;
}

export const trademarkAssetAttentionAuthority = {
  readOnlyProjection: true,
  mayExplainSourceFreshness: true,
  maySurfaceMissingContext: true,
  maySurfaceOwnerRecommendation: true,
  maySurfaceKnowledgeRelevance: true,
  maySurfaceUserPriority: true,
  mayHighlightObservedDateProximity: true,
  mayCertifyLegalDeadline: false,
  mayVerifyOfficialStatus: false,
  mayResolveConflictingFacts: false,
  mayAuthorizeExecution: false,
  mayMutateOwnerDomain: false
} as const;
