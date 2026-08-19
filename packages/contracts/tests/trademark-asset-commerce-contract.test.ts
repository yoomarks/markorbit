import { describe, expect, it } from 'vitest';
import {
  trademarkAssetCommerceAuthority,
  trademarkAssetSaleIntents,
  trademarkAssetSellerRoles,
  type TrademarkAssetCommerceProfile
} from '../src/trademark-asset-commerce.js';

describe('M10 WP05 Trademark Asset Commerce Profile contract', () => {
  it('keeps sale configuration separate from Marketplace publication and official trademark truth', () => {
    expect(trademarkAssetSaleIntents).toEqual(['NOT_FOR_SALE', 'FOR_SALE']);
    expect(trademarkAssetSellerRoles).toEqual(['OWNER', 'AUTHORIZED_REPRESENTATIVE']);
    expect(trademarkAssetCommerceAuthority).toMatchObject({
      mayConfigureSaleIntent: true,
      mayConfigureWorkspaceAskingPrice: true,
      mayApplyCommerceAiTags: true,
      mayCreateMarketplaceListingAutomatically: false,
      mayPublishMarketplaceListingAutomatically: false,
      mayMutateMarketplaceSourceListing: false,
      mayMutateRegisteredTrademarkRepresentation: false,
      mayVerifyOwnershipOrRepresentationAuthority: false,
      mayVerifyOfficialTrademarkFacts: false,
      mayCompleteSaleOrTransfer: false
    });
  });

  it('represents display and sales metadata without claiming Marketplace publication', () => {
    const profile: TrademarkAssetCommerceProfile = {
      schemaVersion: 1,
      commerceProfileId: 'trademark-asset-commerce_demo',
      workspaceId: '85858585-8585-4858-8858-858585858585',
      trademarkAssetId: 'trademark-asset_demo',
      trademarkAssetVersion: 2,
      version: 1,
      saleIntent: 'FOR_SALE',
      askingPrice: { amountMinor: 250000, currency: 'USD' },
      negotiable: true,
      saleTerritories: ['US'],
      sellerRole: 'AUTHORIZED_REPRESENTATIVE',
      headline: 'Short technology brand',
      sellingPoints: ['Five letters', 'Easy to pronounce'],
      aiTags: ['technology', 'short-name'],
      showcaseTemplateReference: 'showcase_clean_1',
      mediaAssetReferences: ['media_mockup_1'],
      marketplaceListingCreatedByLite: false,
      sourceTrademarkFactsMutatedByLite: false,
      createdAt: '2026-08-19T06:40:00.000Z',
      updatedAt: '2026-08-19T06:40:00.000Z'
    };

    expect(profile.marketplaceListingCreatedByLite).toBe(false);
    expect(profile.sourceTrademarkFactsMutatedByLite).toBe(false);
  });
});
