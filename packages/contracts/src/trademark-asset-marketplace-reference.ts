import type { TrademarkAssetId, TrademarkAssetSourceReference } from './trademark-asset-workspace.js';

export type TrademarkAssetMarketplaceOverlayId = `trademark-asset-marketplace-overlay_${string}`;

export interface TrademarkAssetMarketplaceSourceSnapshot {
  sourceAssetId: string;
  sourceListingId: string;
  sourceListingVersion: string;
  sourceListingFingerprintSha256?: string;
  sourceReference: Readonly<TrademarkAssetSourceReference>;
  observedAt: string;
}

export interface TrademarkAssetMarketplaceOverlay {
  schemaVersion: 1;
  marketplaceOverlayId: TrademarkAssetMarketplaceOverlayId;
  workspaceId: string;
  trademarkAssetId: TrademarkAssetId;
  trademarkAssetVersion: number;
  version: number;
  source: Readonly<TrademarkAssetMarketplaceSourceSnapshot>;
  privateTags: readonly string[];
  privateNotes: readonly string[];
  favorite: boolean;
  headline?: string;
  sellingPoints: readonly string[];
  aiTags: readonly string[];
  showcaseTemplateReference?: string;
  mediaAssetReferences: readonly string[];
  customerRecommendationReferences: readonly string[];
  sharePreparationReference?: string;
  localPriceOverrideAllowed: false;
  sourceListingMutableByWorkspace: false;
  sourceTrademarkFactsMutableByWorkspace: false;
  ownershipClaimCreatedByLite: false;
  marketplacePublicationCreatedByLite: false;
  transactionAuthorizedByLite: false;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertTrademarkAssetMarketplaceOverlayInput {
  workspaceId: string;
  trademarkAssetId: TrademarkAssetId;
  expectedTrademarkAssetVersion: number;
  expectedOverlayVersion?: number;
  source: Readonly<TrademarkAssetMarketplaceSourceSnapshot>;
  privateTags?: readonly string[];
  privateNotes?: readonly string[];
  favorite?: boolean;
  headline?: string;
  sellingPoints?: readonly string[];
  aiTags?: readonly string[];
  showcaseTemplateReference?: string;
  mediaAssetReferences?: readonly string[];
  customerRecommendationReferences?: readonly string[];
  sharePreparationReference?: string;
  idempotencyKey: string;
}

/**
 * Marketplace-added Assets are references to Marketplace-owned source truth.
 * Lite may attach workspace-private selling context, but may not copy the source into
 * user ownership, change the source listing, override price, or publish/complete a sale.
 */
export const trademarkAssetMarketplaceReferenceAuthority = {
  mayAddMarketplaceAssetToWorkspace: true,
  mayKeepPrivateTagsAndNotes: true,
  mayFavorite: true,
  mayPrepareLocalHeadlineAndSellingPoints: true,
  mayApplyPrivateAiTags: true,
  mayReferenceShowcaseTemplate: true,
  mayReferenceMediaAssets: true,
  mayPrepareCustomerRecommendationList: true,
  mayPreparePermittedShare: true,
  mayOverrideSourcePrice: false,
  mayMutateMarketplaceSourceListing: false,
  mayMutateRegisteredTrademarkRepresentation: false,
  mayClaimOwnershipFromMarketplaceReference: false,
  mayRepublishAsWorkspaceOwnedSourceRecord: false,
  mayCreateMarketplacePublicationAutomatically: false,
  mayCompleteSaleOrTransfer: false,
  mayCreatePaidTransaction: false
} as const;
