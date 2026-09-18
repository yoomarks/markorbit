import { describe, expect, it } from 'vitest';
import {
  assertEmailCampaignSendIntentV1,
  assertTradingListingPublicationIntentV1,
  canonicalEmailCampaignSendIntentPayloadV1,
  canonicalTradingListingPublicationIntentPayloadV1,
  protectedExternalActionKindsV1,
  type EmailCampaignSendIntentV1,
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
  it('contains only the two closed governed action kinds', () => {
    expect(protectedExternalActionKindsV1).toEqual([
      'TRADING_LISTING_PUBLISH',
      'EMAIL_CAMPAIGN_SEND'
    ]);
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

  it('canonicalizes Email Campaign send without raw endpoints or provider fields', () => {
    const emailIntent: EmailCampaignSendIntentV1 = {
      schemaVersion: 1,
      actionKind: 'EMAIL_CAMPAIGN_SEND',
      workspaceId: intent.workspaceId,
      campaign: { id: 'email-campaign_test', version: 2, fingerprintSha256: 'a'.repeat(64) },
      campaignReview: { id: 'campaign-review_test', version: 1 },
      senderProfile: {
        id: 'email-sender-profile_primary',
        version: 3,
        fingerprintSha256: 'b'.repeat(64)
      },
      audience: {
        id: 'campaign-audience_test',
        version: 1,
        fingerprintSha256: 'c'.repeat(64)
      },
      content: {
        id: 'campaign-content_test',
        version: 1,
        fingerprintSha256: 'd'.repeat(64)
      },
      brand: {
        id: 'campaign-brand_test',
        version: 1,
        fingerprintSha256: 'e'.repeat(64)
      },
      recipientCount: 2,
      deliveryPlanFingerprintSha256: 'f'.repeat(64),
      effectFingerprintSha256: '0'.repeat(64)
    };
    expect(() => assertEmailCampaignSendIntentV1(emailIntent)).not.toThrow();
    const canonical = canonicalEmailCampaignSendIntentPayloadV1(emailIntent);
    expect(canonical).not.toHaveProperty('rawEmail');
    expect(canonical).not.toHaveProperty('provider');
    expect(canonical).not.toHaveProperty('credential');
    expect(canonical.recipientCount).toBe(2);
  });

  it('rejects malformed Email Campaign send fingerprints and unbounded recipient counts', () => {
    const emailIntent: EmailCampaignSendIntentV1 = {
      schemaVersion: 1,
      actionKind: 'EMAIL_CAMPAIGN_SEND',
      workspaceId: intent.workspaceId,
      campaign: { id: 'email-campaign_test', version: 1, fingerprintSha256: 'a'.repeat(64) },
      campaignReview: { id: 'campaign-review_test', version: 1 },
      senderProfile: {
        id: 'email-sender-profile_primary',
        version: 1,
        fingerprintSha256: 'b'.repeat(64)
      },
      audience: { id: 'campaign-audience_test', version: 1, fingerprintSha256: 'c'.repeat(64) },
      content: { id: 'campaign-content_test', version: 1, fingerprintSha256: 'd'.repeat(64) },
      brand: { id: 'campaign-brand_test', version: 1, fingerprintSha256: 'e'.repeat(64) },
      recipientCount: 1,
      deliveryPlanFingerprintSha256: 'f'.repeat(64),
      effectFingerprintSha256: '0'.repeat(64)
    };
    expect(() =>
      assertEmailCampaignSendIntentV1({ ...emailIntent, recipientCount: 10_001 })
    ).toThrow(/bounded maximum/);
    expect(() =>
      assertEmailCampaignSendIntentV1({
        ...emailIntent,
        senderProfile: { ...emailIntent.senderProfile, fingerprintSha256: 'secret@example.com' }
      })
    ).toThrow(/SHA-256/);
    expect(() =>
      assertEmailCampaignSendIntentV1({
        ...emailIntent,
        rawEmail: 'person@example.com'
      } as unknown as EmailCampaignSendIntentV1)
    ).toThrow(/not allowed|raw email/);
  });
});
