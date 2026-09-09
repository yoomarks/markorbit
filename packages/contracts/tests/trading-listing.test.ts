import { describe, expect, it } from 'vitest';
import {
  assertTradingListingDraftV1,
  assertTradingPublishedListingV1,
  type TradingListingDraftV1,
  type TradingPublishedListingV1
} from '../src/trading-listing.js';

const draft = (): TradingListingDraftV1 => ({
  schemaVersion: 1,
  listingDraftId: 'trading-listing-draft_contract-1',
  workspaceId: 'workspace-contract-1',
  version: 1,
  trademarkAsset: { id: 'trademark-asset_contract-1', version: 3 },
  commerceProfile: { id: 'trademark-asset-commerce_contract-1', version: 2 },
  commercialDirection: {
    id: 'trading-ai-derived_commercial-direction_contract-1',
    version: 2
  },
  aiProfile: { id: 'trading-ai-derived_ai-profile_contract-1', version: 3 },
  showcase: { id: 'trading-showcase_contract-1', version: 4 },
  listingAssets: [{ id: 'listing-asset_contract-1', version: 1 }],
  opportunityStory: {
    bestForBuyerPersonaRefs: ['trading-commercial-persona_buyer-1'],
    whyThisMarkSellingPointRefs: ['trading-selling-point_short-name-1'],
    buyingPointRefs: ['trading-buying-point_fast-launch-1'],
    businessOpportunitySummary: 'A compact identity for a focused direct-to-consumer launch.',
    endConsumerRefs: ['trading-commercial-persona_consumer-1'],
    operatorPersonaRefs: ['trading-commercial-persona_operator-1'],
    scenarioRefs: ['trading-commercial-scenario_dtc-launch-1'],
    assumptionRefs: ['trading-commercial-assumption_channel-fit-1']
  },
  listingMethod: 'MAKE_OFFER',
  sellerRelationshipVerified: false,
  status: 'DRAFT',
  createdAt: '2026-09-09T00:00:00.000Z'
});

const published = (): TradingPublishedListingV1 => ({
  schemaVersion: 1,
  listingId: 'trading-listing_contract-1',
  version: 1,
  draft: { id: draft().listingDraftId, version: 1 },
  publishedDraftSnapshot: draft(),
  publishReview: {
    reviewedTrademarkAsset: draft().trademarkAsset,
    reviewedCommercialDirection: draft().commercialDirection,
    reviewedShowcase: draft().showcase,
    reviewState: 'CURRENT',
    reviewedAt: '2026-09-09T00:05:00.000Z',
    humanApprovalReference: 'listing-publish-approval_contract-1'
  },
  status: 'PUBLISHED',
  publishedAt: '2026-09-09T00:06:00.000Z'
});

describe('Lite Trading Listing opportunity story contract', () => {
  it('keeps a structured Opportunity Story private in a versioned Listing Draft', () => {
    expect(() => assertTradingListingDraftV1(draft())).not.toThrow();
    expect(draft().status).toBe('DRAFT');
    expect(draft().sellerRelationshipVerified).toBe(false);
    expect(draft().showcase).toEqual({ id: 'trading-showcase_contract-1', version: 4 });
  });

  it('fails closed on a missing or invalid exact Showcase reference', () => {
    expect(() =>
      assertTradingListingDraftV1({
        ...draft(),
        showcase: undefined
      } as unknown as TradingListingDraftV1)
    ).toThrow(/Showcase/u);
    expect(() =>
      assertTradingListingDraftV1({
        ...draft(),
        showcase: { id: 'listing-showcase_contract-1', version: 4 }
      } as unknown as TradingListingDraftV1)
    ).toThrow(/Showcase/u);
    expect(() =>
      assertTradingListingDraftV1({ ...draft(), showcase: { ...draft().showcase, version: 0 } })
    ).toThrow(/exact version/u);
  });

  it.each(['FIXED_PRICE', 'MAKE_OFFER', 'INQUIRY'] as const)(
    'preserves the distinct %s transaction method',
    (listingMethod) => {
      expect(() => assertTradingListingDraftV1({ ...draft(), listingMethod })).not.toThrow();
    }
  );

  it('publishes only a frozen exact draft after CURRENT explicit human review', () => {
    expect(() => assertTradingPublishedListingV1(published())).not.toThrow();
    for (const reviewState of ['STALE', 'CONFLICT'] as const) {
      expect(() =>
        assertTradingPublishedListingV1({
          ...published(),
          publishReview: { ...published().publishReview, reviewState }
        })
      ).toThrow(/CURRENT review/u);
    }
    expect(() =>
      assertTradingPublishedListingV1({
        ...published(),
        draft: { id: draft().listingDraftId, version: 2 }
      })
    ).toThrow(/exact reviewed draft/u);
  });

  it('fails closed when publish review does not bind the draft exact Showcase', () => {
    expect(() =>
      assertTradingPublishedListingV1({
        ...published(),
        publishReview: {
          ...published().publishReview,
          reviewedShowcase: { id: 'trading-showcase_other', version: draft().showcase.version }
        }
      })
    ).toThrow(/Showcase versions/u);
    expect(() =>
      assertTradingPublishedListingV1({
        ...published(),
        publishReview: {
          ...published().publishReview,
          reviewedShowcase: { ...draft().showcase, version: 5 }
        }
      })
    ).toThrow(/Showcase versions/u);
  });

  it('cannot convert seller declaration into verified ownership', () => {
    expect(() =>
      assertTradingListingDraftV1({
        ...draft(),
        sellerRelationshipVerified: true
      } as unknown as TradingListingDraftV1)
    ).toThrow(/cannot claim verified ownership/u);
  });
});
