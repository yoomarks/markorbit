import type {
  TrademarkAsset,
  TrademarkAssetId,
  TrademarkAssetWorkspaceRelationshipKind
} from './trademark-asset-workspace.js';

export interface TrademarkAssetPortfolioCursor {
  updatedAt: string;
  trademarkAssetId: TrademarkAssetId;
}

export interface TrademarkAssetPortfolioFilter {
  query?: string;
  jurisdictions?: readonly string[];
  relationshipKinds?: readonly TrademarkAssetWorkspaceRelationshipKind[];
  workspaceTags?: readonly string[];
  ownerOrClientReference?: string;
}

export interface TrademarkAssetPortfolioPage {
  schemaVersion: 1;
  workspaceId: string;
  assets: ReadonlyArray<Readonly<TrademarkAsset>>;
  nextCursor?: string;
  hasMore: boolean;
  officialTruthVerifiedByLite: false;
}

export const trademarkAssetBulkImportStatuses = ['CREATED', 'DUPLICATE', 'REJECTED'] as const;
export type TrademarkAssetBulkImportStatus = (typeof trademarkAssetBulkImportStatuses)[number];

export interface TrademarkAssetBulkImportItemResult {
  importIndex: number;
  status: TrademarkAssetBulkImportStatus;
  trademarkAssetId?: TrademarkAssetId;
  reason?: string;
}

export interface TrademarkAssetBulkImportResult {
  schemaVersion: 1;
  workspaceId: string;
  total: number;
  created: number;
  duplicates: number;
  rejected: number;
  items: ReadonlyArray<Readonly<TrademarkAssetBulkImportItemResult>>;
  officialTruthVerifiedByLite: false;
  matterCreatedAutomatically: false;
}

export interface TrademarkAssetBulkTagItemResult {
  trademarkAssetId: TrademarkAssetId;
  status: 'UPDATED' | 'NOT_FOUND' | 'CONFLICT' | 'REJECTED';
  version?: number;
  reason?: string;
}

export interface TrademarkAssetBulkTagResult {
  schemaVersion: 1;
  workspaceId: string;
  requested: number;
  updated: number;
  items: ReadonlyArray<Readonly<TrademarkAssetBulkTagItemResult>>;
  marketplaceSourceMutated: false;
  officialTruthVerifiedByLite: false;
}

/** Portfolio operations govern Lite-owned Asset Anchors and private metadata, never source truth. */
export const trademarkAssetPortfolioAuthority = {
  maySearchWorkspaceAssets: true,
  mayFilterByWorkspaceRelationship: true,
  mayBulkImportWorkspaceAssets: true,
  mayBulkApplyPrivateWorkspaceTags: true,
  mayTagMarketplaceReferencesPrivately: true,
  mayMutateMarketplaceSourceAsset: false,
  mayOverwriteSourceOwnedFacts: false,
  mayCreateMatterAutomatically: false,
  mayVerifyOfficialStatus: false,
  mayCertifyDeadline: false
} as const;
