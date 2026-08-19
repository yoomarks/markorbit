import type {
  TrademarkAsset,
  TrademarkAssetFreshnessState,
  TrademarkAssetId,
  TrademarkAssetSourceReference
} from './trademark-asset-workspace.js';

export const trademarkAssetObservedFactKinds = [
  'APPLICATION_STATUS',
  'APPLICATION_DATE',
  'REGISTRATION_DATE',
  'RENEWAL_DATE',
  'OWNER_NAME',
  'NICE_CLASSES',
  'LIFECYCLE_STAGE'
] as const;
export type TrademarkAssetObservedFactKind = (typeof trademarkAssetObservedFactKinds)[number];

export type TrademarkAssetObservedFactValue = string | number | boolean | readonly string[];

/** Source-owned factual observation. Lite never promotes it into official truth. */
export interface TrademarkAssetObservedFact {
  kind: TrademarkAssetObservedFactKind;
  value: TrademarkAssetObservedFactValue;
  source: Readonly<TrademarkAssetSourceReference>;
  freshness: TrademarkAssetFreshnessState;
  consequential: boolean;
  officialTruthVerifiedByLite: false;
}

export interface TrademarkAssetFactConflict {
  kind: TrademarkAssetObservedFactKind;
  values: ReadonlyArray<TrademarkAssetObservedFactValue>;
  evidence: ReadonlyArray<Readonly<TrademarkAssetSourceReference>>;
  unresolved: true;
}

export const trademarkAssetContextSignalKinds = [
  'RECOMMENDED_ACTION',
  'KNOWLEDGE_RELEVANCE'
] as const;
export type TrademarkAssetContextSignalKind = (typeof trademarkAssetContextSignalKinds)[number];

/**
 * Source-owned contextual signal, deliberately separate from factual observations.
 * Signals may inform later Attention or AI Guide reasoning but are not facts or execution authority.
 */
export interface TrademarkAssetContextSignal {
  kind: TrademarkAssetContextSignalKind;
  value: string;
  source: Readonly<TrademarkAssetSourceReference>;
  freshness: TrademarkAssetFreshnessState;
  advisory: true;
  executionAuthorized: false;
}

/**
 * Current read model assembled from a durable Lite Asset Anchor plus source-owned facts and signals.
 * Conflicting facts remain visible; contextual signals remain distinct from factual claims.
 */
export interface TrademarkAssetView {
  schemaVersion: 1;
  trademarkAssetId: TrademarkAssetId;
  workspaceId: string;
  anchorVersion: number;
  anchor: Readonly<TrademarkAsset>;
  observedFacts: ReadonlyArray<Readonly<TrademarkAssetObservedFact>>;
  contextSignals: ReadonlyArray<Readonly<TrademarkAssetContextSignal>>;
  conflicts: ReadonlyArray<Readonly<TrademarkAssetFactConflict>>;
  sourceReferences: ReadonlyArray<Readonly<TrademarkAssetSourceReference>>;
  freshness: TrademarkAssetFreshnessState;
  composedAt: string;
  officialTruthVerifiedByLite: false;
  legalDeadlineCertified: false;
  protectedActionAuthorized: false;
}

export const trademarkAssetCompositionAuthority = {
  mayComposeWorkspaceAnchor: true,
  mayReadMarkRegProjection: true,
  mayReadDataEngineFacts: true,
  mayReadKnowledgeRelevance: true,
  mayPreserveConflictingObservations: true,
  factsAndSignalsRemainDistinct: true,
  maySelectOfficialWinnerAcrossConflicts: false,
  mayWriteBackToSourceOwner: false,
  mayUseCrossServiceSql: false,
  mayCreateOfficialStatus: false,
  mayCertifyLegalDeadline: false,
  mayAuthorizeProtectedAction: false
} as const;
