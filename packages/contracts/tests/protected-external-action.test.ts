import { describe, expect, it } from 'vitest';
import {
  assertTradingListingPublicationIntentV1,
  canonicalTradingListingPublicationIntentPayloadV1,
  protectedExternalActionKindsV1,
  type TradingListingPublicationIntentV1
} from '../src/protected-external-action.js';

const intent: TradingListingPublicationIntentV1 = {
  schemaVersion: 1,
  actionKind: 'TRADING_LISTING_PUBLISH',
  workspaceId: '018f0000-0000-7000-8000-000000001176',
  listingDraft: { id: 'trading-listing-draft_1176', version: 3 },
  listingReview: { id: 'trading-listing-review_1176', version: 2 },
  listingAssets: [
    { id: 'listing-asset_b', version: 4 },
    { id: 'listing-asset_a', version: 1 }
  ],
  marketplaceTargetBinding: { id: 'trading-marketplace-target-binding_1176', version: 5 },
  effectFingerprintSha256: 'a'.repeat(64)
};

describe('bounded protected external action contract', () => {
  it('contains exactly Trading Listing Publish in V1', () => {
    expect(protectedExternalActionKindsV1).toEqual(['TRADING_LISTING_PUBLISH']);
  });

  it('canonicalizes the Listing Asset version set deterministically', () => {
    expect(canonicalTradingListingPublicationIntentPayloadV1(intent).listingAssets).toEqual([
      { id: 'listing-asset_a', version: 1 },
      { id: 'listing-asset_b', version: 4 }
    ]);
    expect(() => assertTradingListingPublicationIntentV1(intent)).not.toThrow();
  });

  it('rejects duplicate Listing Asset ids and non-SHA fingerprints', () => {
    expect(() =>
      assertTradingListingPublicationIntentV1({
        ...intent,
        listingAssets: [
          { id: 'listing-asset_a', version: 1 },
          { id: 'listing-asset_a', version: 2 }
        ]
      })
    ).toThrow(/distinct/);
    expect(() =>
      assertTradingListingPublicationIntentV1({ ...intent, effectFingerprintSha256: 'browser' })
    ).toThrow(/SHA-256/);
  });
});
