import type {
  TrademarkAssetFactConflict,
  TrademarkAssetObservedFact,
  TrademarkAssetObservedFactKind,
  TrademarkAssetObservedFactValue,
  TrademarkAssetView
} from '@markorbit/contracts/trademark-asset-composition';
import type {
  TrademarkAsset,
  TrademarkAssetFreshnessState,
  TrademarkAssetSourceOwner,
  TrademarkAssetSourceReference
} from '@markorbit/contracts/trademark-asset-workspace';

export type TrademarkAssetCompositionErrorCode =
  | 'INVALID_INPUT'
  | 'SOURCE_OWNER_KIND_MISMATCH'
  | 'FACT_OWNER_MISMATCH';

export class TrademarkAssetCompositionError extends Error {
  constructor(
    readonly code: TrademarkAssetCompositionErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'TrademarkAssetCompositionError';
  }
}

export interface TrademarkAssetFactContribution {
  kind: TrademarkAssetObservedFactKind;
  value: TrademarkAssetObservedFactValue;
  source: Readonly<TrademarkAssetSourceReference>;
  consequential?: boolean;
}

export interface ComposeTrademarkAssetViewInput {
  anchor: Readonly<TrademarkAsset>;
  facts?: ReadonlyArray<Readonly<TrademarkAssetFactContribution>>;
  composedAt: string;
}

const ownerKinds: Readonly<Record<TrademarkAssetSourceOwner, readonly string[]>> = {
  MARKREG: ['MARKREG_MATTER', 'MARKREG_LIFECYCLE_PROJECTION', 'MARKREG_ORDER'],
  EXECUTION: ['EXECUTION_EVIDENCE'],
  KNOWLEDGE: ['KNOWLEDGE_SOURCE'],
  DATA_ENGINE: ['DATA_ENGINE_TRADEMARK_RECORD'],
  MARKETPLACE: ['MARKETPLACE_LISTING'],
  WORKSPACE_USER: ['WORKSPACE_ADMISSION', 'WORKSPACE_NOTE']
};

const dataEngineFactKinds = new Set<TrademarkAssetObservedFactKind>([
  'APPLICATION_STATUS',
  'APPLICATION_DATE',
  'REGISTRATION_DATE',
  'RENEWAL_DATE',
  'OWNER_NAME',
  'NICE_CLASSES'
]);
const markRegFactKinds = new Set<TrademarkAssetObservedFactKind>([
  'APPLICATION_STATUS',
  'APPLICATION_DATE',
  'REGISTRATION_DATE',
  'RENEWAL_DATE',
  'OWNER_NAME',
  'NICE_CLASSES',
  'LIFECYCLE_STAGE',
  'RECOMMENDED_ACTION'
]);

function assertIsoTimestamp(value: string, label: string): void {
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new TrademarkAssetCompositionError('INVALID_INPUT', `${label} must be an ISO timestamp.`);
  }
}

function assertSourceReference(source: Readonly<TrademarkAssetSourceReference>): void {
  const allowedKinds = ownerKinds[source.owner];
  if (!allowedKinds.includes(source.kind)) {
    throw new TrademarkAssetCompositionError(
      'SOURCE_OWNER_KIND_MISMATCH',
      `Source owner ${source.owner} cannot use source kind ${source.kind}.`
    );
  }
  if (!source.sourceId.trim() || !source.sourceVersion.trim()) {
    throw new TrademarkAssetCompositionError(
      'INVALID_INPUT',
      'Source references require non-empty sourceId and sourceVersion.'
    );
  }
  assertIsoTimestamp(source.observedAt, 'source.observedAt');
}

function assertFactOwner(
  kind: TrademarkAssetObservedFactKind,
  owner: TrademarkAssetSourceOwner
): void {
  if (owner === 'DATA_ENGINE' && dataEngineFactKinds.has(kind)) return;
  if (owner === 'MARKREG' && markRegFactKinds.has(kind)) return;
  if (owner === 'KNOWLEDGE' && kind === 'KNOWLEDGE_RELEVANCE') return;
  if (owner === 'EXECUTION' && kind === 'RECOMMENDED_ACTION') return;

  throw new TrademarkAssetCompositionError(
    'FACT_OWNER_MISMATCH',
    `Source owner ${owner} cannot contribute fact ${kind}.`
  );
}

function canonicalValue(value: TrademarkAssetObservedFactValue): string {
  if (Array.isArray(value)) {
    const items = value as readonly string[];
    return JSON.stringify([...items].sort());
  }
  return JSON.stringify(value) ?? String(value);
}

function sourceKey(source: Readonly<TrademarkAssetSourceReference>): string {
  return [
    source.owner,
    source.kind,
    source.sourceId,
    source.sourceVersion,
    source.sourceFingerprintSha256 ?? '',
    source.observedAt,
    source.freshness
  ].join('|');
}

function composeConflicts(
  facts: ReadonlyArray<Readonly<TrademarkAssetObservedFact>>
): TrademarkAssetFactConflict[] {
  const byKind = new Map<TrademarkAssetObservedFactKind, TrademarkAssetObservedFact[]>();
  for (const fact of facts) {
    const bucket = byKind.get(fact.kind) ?? [];
    bucket.push(fact);
    byKind.set(fact.kind, bucket);
  }

  const conflicts: TrademarkAssetFactConflict[] = [];
  for (const [kind, candidates] of byKind) {
    const distinct = new Map<string, TrademarkAssetObservedFactValue>();
    for (const candidate of candidates) {
      distinct.set(canonicalValue(candidate.value), candidate.value);
    }
    if (distinct.size < 2) continue;

    conflicts.push({
      kind,
      values: [...distinct.values()],
      evidence: candidates.map((candidate) => candidate.source),
      unresolved: true
    });
  }
  return conflicts.sort((a, b) => a.kind.localeCompare(b.kind));
}

function composeFreshness(
  facts: ReadonlyArray<Readonly<TrademarkAssetObservedFact>>,
  conflicts: ReadonlyArray<Readonly<TrademarkAssetFactConflict>>
): TrademarkAssetFreshnessState {
  if (conflicts.length > 0) return 'CONFLICTING';
  if (facts.some((fact) => fact.freshness === 'STALE')) return 'STALE';
  if (facts.length === 0 || facts.some((fact) => fact.freshness === 'UNKNOWN')) return 'UNKNOWN';
  return 'CURRENT';
}

export function composeTrademarkAssetView(
  input: Readonly<ComposeTrademarkAssetViewInput>
): TrademarkAssetView {
  assertIsoTimestamp(input.composedAt, 'composedAt');
  if (!input.anchor.workspaceId.trim() || !input.anchor.trademarkAssetId.trim()) {
    throw new TrademarkAssetCompositionError(
      'INVALID_INPUT',
      'Asset Anchor requires workspaceId and trademarkAssetId.'
    );
  }

  const facts = (input.facts ?? []).map<TrademarkAssetObservedFact>((contribution) => {
    assertSourceReference(contribution.source);
    assertFactOwner(contribution.kind, contribution.source.owner);
    return {
      kind: contribution.kind,
      value: contribution.value,
      source: contribution.source,
      freshness: contribution.source.freshness,
      consequential: contribution.consequential ?? false,
      officialTruthVerifiedByLite: false
    };
  });

  const conflicts = composeConflicts(facts);
  const sources = new Map<string, Readonly<TrademarkAssetSourceReference>>();
  for (const source of input.anchor.sourceReferences) sources.set(sourceKey(source), source);
  for (const fact of facts) sources.set(sourceKey(fact.source), fact.source);

  return {
    schemaVersion: 1,
    trademarkAssetId: input.anchor.trademarkAssetId,
    workspaceId: input.anchor.workspaceId,
    anchorVersion: input.anchor.version,
    anchor: input.anchor,
    observedFacts: facts,
    conflicts,
    sourceReferences: [...sources.values()],
    freshness: composeFreshness(facts, conflicts),
    composedAt: input.composedAt,
    officialTruthVerifiedByLite: false,
    legalDeadlineCertified: false,
    protectedActionAuthorized: false
  };
}
