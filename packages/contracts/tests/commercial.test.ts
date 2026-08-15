import { describe, expect, it } from 'vitest';
import {
  CommercialContractError,
  assertCommercialMoney,
  assertCommercialPrice,
  checkoutInitiatedAuthorityConsequences,
  isCommercialPriceActive,
  type CommercialPrice
} from '../src/commercial.js';

const price = (overrides: Partial<CommercialPrice> = {}): CommercialPrice => ({
  schemaVersion: 1,
  priceId: 'price_direct-us-filing',
  productId: 'product_trademark-filing',
  priceVersion: 1,
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  amount: { amountMinor: 29900, currency: 'USD' },
  status: 'ACTIVE',
  validFrom: '2026-08-01T00:00:00.000Z',
  createdAt: '2026-08-01T00:00:00.000Z',
  ...overrides
});

describe('commercial contracts', () => {
  it('accepts integral minor-unit money and rejects decimal or malformed currency values', () => {
    expect(() => assertCommercialMoney({ amountMinor: 29900, currency: 'USD' })).not.toThrow();
    expect(() => assertCommercialMoney({ amountMinor: 299.5, currency: 'USD' })).toThrow(
      CommercialContractError
    );
    expect(() => assertCommercialMoney({ amountMinor: 29900, currency: 'usd' })).toThrow(
      CommercialContractError
    );
  });

  it('requires positive price versions and bounded validity windows', () => {
    expect(() => assertCommercialPrice(price())).not.toThrow();
    expect(() => assertCommercialPrice(price({ priceVersion: 0 }))).toThrow(
      CommercialContractError
    );
    expect(() => assertCommercialPrice(price({ validUntil: '2026-07-31T23:59:59.000Z' }))).toThrow(
      CommercialContractError
    );
  });

  it('selects a price only while its governed version is active', () => {
    expect(isCommercialPriceActive(price(), '2026-08-15T00:00:00.000Z')).toBe(true);
    expect(isCommercialPriceActive(price({ status: 'INACTIVE' }), '2026-08-15T00:00:00.000Z')).toBe(
      false
    );
    expect(
      isCommercialPriceActive(
        price({ validUntil: '2026-08-10T00:00:00.000Z' }),
        '2026-08-15T00:00:00.000Z'
      )
    ).toBe(false);
  });

  it('makes checkout initiation explicitly non-financial and non-filing authority', () => {
    expect(checkoutInitiatedAuthorityConsequences).toEqual(
      expect.objectContaining({
        checkoutInitiated: true,
        paymentCreated: false,
        paymentSucceeded: false,
        orderMarkedPaid: false,
        matterCreated: false,
        filingCreated: false,
        filingSubmitted: false
      })
    );
  });
});
