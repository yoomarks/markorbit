import type { TrademarkAssetId } from './trademark-asset-workspace.js';

export type TrademarkAssetCommerceProfileId = `trademark-asset-commerce_${string}`;

export const trademarkAssetSaleIntents = ['NOT_FOR_SALE', 'FOR_SALE'] as const;
export type TrademarkAssetSaleIntent = (typeof trademarkAssetSaleIntents)[number];

export const trademarkAssetSellerRoles = ['OWNER', 'AUTHORIZED_REPRESENTATIVE'] as const;
export type TrademarkAssetSellerRole = (typeof trademarkAssetSellerRoles)[number];

export interface TrademarkAssetAskingPrice {
  amountMinor: number;
  currency: string;
}

export interface TrademarkAssetCommerceProfile {
  schemaVersion: 1;
  commerceProfileId: TrademarkAssetCommerceProfileId;
  workspaceId: string;
  trademarkAssetId: TrademarkAssetId;
  trademarkAssetVersion: number;
  version: number;
  saleIntent: TrademarkAssetSaleIntent;
  askingPrice?: Readonly<TrademarkAssetAskingPrice>;
  negotiable: boolean;
  saleTerritories: readonly string[];
  sellerRole: TrademarkAssetSellerRole;
  headline?: string;
  sellingPoints: readonly string[];
  aiTags: readonly string[];
  showcaseTemplateReference?: string;
  mediaAssetReferences: readonly string[];
  marketplaceListingReference?: string;
  marketplaceListingCreatedByLite: false;
  sourceTrademarkFactsMutatedByLite: false;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertTrademarkAssetCommerceProfileInput {
  workspaceId: string;
  trademarkAssetId: TrademarkAssetId;
  expectedTrademarkAssetVersion: number;
  expectedCommerceProfileVersion?: number;
  saleIntent: TrademarkAssetSaleIntent;
  askingPrice?: Readonly<TrademarkAssetAskingPrice>;
  negotiable?: boolean;
  saleTerritories?: readonly string[];
  sellerRole: TrademarkAssetSellerRole;
  headline?: string;
  sellingPoints?: readonly string[];
  aiTags?: readonly string[];
  showcaseTemplateReference?: string;
  mediaAssetReferences?: readonly string[];
  idempotencyKey: string;
}

/**
 * A Commerce Profile describes how a workspace intends to market an Asset.
 * It is not a Marketplace Listing, does not mutate the registered mark, and does not prove
 * ownership, representation authority, price acceptance, or transaction completion.
 */
export const trademarkAssetCommerceAuthority = {
  mayConfigureSaleIntent: true,
  mayConfigureWorkspaceAskingPrice: true,
  mayConfigureNegotiability: true,
  mayConfigureSaleTerritories: true,
  mayPrepareMarketingHeadlineAndSellingPoints: true,
  mayApplyCommerceAiTags: true,
  mayReferenceShowcaseTemplate: true,
  mayReferenceMediaAssets: true,
  mayCreateMarketplaceListingAutomatically: false,
  mayPublishMarketplaceListingAutomatically: false,
  mayMutateMarketplaceSourceListing: false,
  mayMutateRegisteredTrademarkRepresentation: false,
  mayVerifyOwnershipOrRepresentationAuthority: false,
  mayVerifyOfficialTrademarkFacts: false,
  mayCompleteSaleOrTransfer: false,
  mayCreatePaidTransaction: false
} as const;
