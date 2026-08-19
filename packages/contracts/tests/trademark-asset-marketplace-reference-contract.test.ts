import { describe, expect, it } from 'vitest';
import {
  trademarkAssetMarketplaceReferenceAuthority,
  type TrademarkAssetMarketplaceOverlay
} from '../src/trademark-asset-marketplace-reference.js';

describe('M10 WP06 Marketplace Asset Reference contract', () => {
  it('keeps source listing and registered trademark truth read-only', () => {
    expect(trademarkAssetMarketplaceReferenceAuthority).toMatchObject({
      mayAddMarketplaceAssetToWorkspace: true,
      mayKeepPrivateTagsAndNotes: true,
      mayPrepareLocalHeadlineAndSellingPoints: true,
      mayPrepareCustomerRecommendationList: true,
      mayPreparePermittedShare: true,
      mayOverrideSourcePrice: false,
      mayMutateMarketplaceSourceListing: false,
      mayMutateRegisteredTrademarkRepresentation: false,
      mayClaimOwnershipFromMarketplaceReference: false,
      mayRepublishAsWorkspaceOwnedSourceRecord: false,
      mayCompleteSaleOrTransfer: false
    });
  });

  it('models a workspace-private overlay without changing ownership or source price', () => {
    const overlay: TrademarkAssetMarketplaceOverlay = {
      schemaVersion: 1,
      marketplaceOverlayId: 'trademark-asset-marketplace-overlay_demo',
      workspaceId: '85858585-8585-4858-8858-858585858585',
      trademarkAssetId: 'trademark-asset_demo',
      trademarkAssetVersion: 1,
      version: 1,
      source: {
        sourceAssetId: 'marketplace-asset_1',
        sourceListingId: 'marketplace-listing_1',
        sourceListingVersion: '7',
        sourceReference: {
          owner: 'MARKETPLACE',
          kind: 'MARKETPLACE_LISTING',
          sourceId: 'marketplace-listing_1',
          sourceVersion: '7',
          observedAt: '2026-08-19T12:00:00.000Z',
          freshness: 'CURRENT'
        },
        observedAt: '2026-08-19T12:00:00.000Z'
      },
      privateTags: ['customer-a'],
      privateNotes: ['Recommend to SaaS buyer'],
      favorite: true,
      headline: 'Compact brand candidate',
      sellingPoints: ['Short name'],
      aiTags: ['saas'],
      mediaAssetReferences: ['media_1'],
      customerRecommendationReferences: ['recommendation_1'],
      localPriceOverrideAllowed: false,
      sourceListingMutableByWorkspace: false,
      sourceTrademarkFactsMutableByWorkspace: false,
      ownershipClaimCreatedByLite: false,
      marketplacePublicationCreatedByLite: false,
      transactionAuthorizedByLite: false,
      createdAt: '2026-08-19T12:00:00.000Z',
      updatedAt: '2026-08-19T12:00:00.000Z'
    };
    expect(overlay.localPriceOverrideAllowed).toBe(false);
    expect(overlay.sourceListingMutableByWorkspace).toBe(false);
  });
});
