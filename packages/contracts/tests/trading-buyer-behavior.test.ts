import { describe, expect, it } from 'vitest';
import {
  buyerBehaviorEventTypes,
  noBuyerBehaviorAuthorityConsequencesV1,
  parseBuyerBehaviorEventV1,
  type BuyerBehaviorEventV1
} from '../src/trading-buyer-behavior.js';

function event(overrides: Partial<BuyerBehaviorEventV1> = {}): BuyerBehaviorEventV1 {
  return {
    schemaVersion: 1,
    buyerBehaviorEventId: 'buyer-behavior_contract-1',
    eventType: 'DETAIL_VIEW',
    listing: {
      listingId: 'listing_contract-1',
      listingVersion: 2,
      trademarkAssetId: 'trademark-asset_contract-1'
    },
    subject: { kind: 'ANONYMOUS', sessionId: 'session-contract-1' },
    surface: 'MARKETPLACE_DETAIL',
    occurredAt: '2026-09-07T12:00:00.000Z',
    correlationId: 'correlation-contract-1',
    authorityConsequences: noBuyerBehaviorAuthorityConsequencesV1,
    ...overrides
  };
}

describe('Lite Trading Buyer Behavior V1 contract', () => {
  it('covers every frozen V1 buyer behavior event without pricing conclusions', () => {
    expect(buyerBehaviorEventTypes).toEqual([
      'IMPRESSION',
      'CLICK',
      'DETAIL_VIEW',
      'DWELL',
      'FAVORITE',
      'SHARE',
      'INQUIRY_CREATED',
      'OFFER_CREATED',
      'TRANSACTION_STARTED',
      'TRANSACTION_COMPLETED',
      'REPEAT_VISIT'
    ]);
    expect(noBuyerBehaviorAuthorityConsequencesV1.pricingConclusionCreated).toBe(false);
  });

  it('accepts anonymous observation and authenticated canonical-action events', () => {
    expect(parseBuyerBehaviorEventV1(event())).toEqual(event());
    const offer = event({
      eventType: 'OFFER_CREATED',
      subject: {
        kind: 'AUTHENTICATED',
        sessionId: 'session-contract-2',
        userId: 'user-contract-2'
      },
      canonicalActionReference: 'offer_contract-2'
    });
    expect(parseBuyerBehaviorEventV1(offer)).toEqual(offer);
  });

  it('requires canonical owner evidence for consequential observations', () => {
    expect(() => parseBuyerBehaviorEventV1(event({ eventType: 'OFFER_CREATED' }))).toThrow(
      /canonical owner action reference/u
    );
    expect(() =>
      parseBuyerBehaviorEventV1(
        event({ eventType: 'DETAIL_VIEW', canonicalActionReference: 'view_contract-1' })
      )
    ).toThrow(/canonical owner action reference/u);
    expect(() => parseBuyerBehaviorEventV1(event({ eventType: 'FAVORITE' }))).toThrow(
      /canonical owner action reference/u
    );
  });

  it('keeps dwell duration scoped to dwell events', () => {
    expect(
      parseBuyerBehaviorEventV1(event({ eventType: 'DWELL', dwellDurationMs: 12_000 }))
    ).toMatchObject({ eventType: 'DWELL', dwellDurationMs: 12_000 });
    expect(() => parseBuyerBehaviorEventV1(event({ eventType: 'DWELL' }))).toThrow(
      /dwellDurationMs/u
    );
    expect(() => parseBuyerBehaviorEventV1(event({ dwellDurationMs: 1_000 }))).toThrow(
      /dwellDurationMs/u
    );
  });

  it('rejects browser or analytics claims of canonical consequences', () => {
    expect(() =>
      parseBuyerBehaviorEventV1(
        event({
          authorityConsequences: {
            ...noBuyerBehaviorAuthorityConsequencesV1,
            offerAccepted: true
          } as unknown as BuyerBehaviorEventV1['authorityConsequences']
        })
      )
    ).toThrow(/offerAccepted/u);
  });

  it('does not let anonymous sessions claim an authenticated user', () => {
    expect(() =>
      parseBuyerBehaviorEventV1({
        ...event(),
        subject: { kind: 'ANONYMOUS', sessionId: 'session-contract-1', userId: 'user-contract-1' }
      })
    ).toThrow(/Anonymous buyer behavior/u);
  });
});
