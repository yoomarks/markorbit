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
  'LIFECYCLE_STAGE',
  'RECOMMENDED_ACTION',
  'KNOWLEDGE_RELEVANCE'
] as const;
export type TrademarkAssetObservedFactKind = (typeof trademarkAssetObservedFactKinds)[number];

export type TrademarkAssetObservedFactValue = string | number | boolean | readonly string[];

/**
 * Source-owned observation included in a Lite Asset View. Lite may render and compare the
 * observation but does not promote it into official truth or overwrite its source owner.
 */
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

/**
 * Current read model assembled from a durable Lite Asset Anchor and source-owned facts.
 * Conflicting owner observations remain visible; composition never silently chooses a winner.
 */
export interface TrademarkAssetView {
  schemaVersion: 1;
  trademarkAssetId: TrademarkAssetId;
  workspaceId: string;
  anchorVersion: number;
  anchor: Readonly<TrademarkAsset>;
  observedFacts: ReadonlyArray<Readonly<TrademarkAssetObservedFact>>;
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
  maySelectOfficialWinnerAcrossConflicts: false,
  mayWriteBackToSourceOwner: false,
  mayUseCrossServiceSql: false,
  mayCreateOfficialStatus: false,
  mayCertifyLegalDeadline: false,
  mayAuthorizeProtectedAction: false
} as const;
