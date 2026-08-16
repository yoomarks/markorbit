import { describe, expect, it } from 'vitest';
import type {
  Payment,
  PaymentReconciliationObservation,
  PaymentRefund
} from '../src/payment.js';
import {
  PaymentContractError,
  assertPayment,
  assertPaymentProviderCode,
  assertPaymentReconciliation,
  assertPaymentRefund,
  paymentSucceededAuthorityConsequences
} from '../src/payment.js';

const at = '2026-08-16T06:00:00.000Z';

const payment = (overrides: Partial<Payment> = {}): Payment => ({
  schemaVersion: 1,
  paymentId: 'payment_contract-test',
  workspaceId: 'workspace_contract-test',
  checkoutSessionId: 'checkout_contract-test',
  orderId: 'order_contract-test',
  initiatedByUserId: 'user_contract-test' as Payment['initiatedByUserId'],
  productId: 'product_trademark-filing',
  productVersion: 1,
  priceId: 'price_direct-filing-v1',
  priceVersion: 1,
  amount: { amountMinor: 29900, currency: 'USD' },
  provider: 'TEST_PROVIDER',
  status: 'PENDING',
  version: 1,
  refundedMinor: 0,
  createdAt: at,
  updatedAt: at,
  ...overrides
});

const refund = (overrides: Partial<PaymentRefund> = {}): PaymentRefund => ({
  schemaVersion: 1,
  refundId: 'refund_contract-test',
  paymentId: 'payment_contract-test',
  workspaceId: 'workspace_contract-test',
  requestedByUserId: 'user_contract-test' as PaymentRefund['requestedByUserId'],
  amount: { amountMinor: 5000, currency: 'USD' },
  status: 'PENDING',
  version: 1,
  reason: 'customer request',
  createdAt: at,
  updatedAt: at,
  ...overrides
});

const reconciliation = (
  overrides: Partial<PaymentReconciliationObservation> = {}
): PaymentReconciliationObservation => ({
  schemaVersion: 1,
  reconciliationId: 'reconciliation_contract-test',
  workspaceId: 'workspace_contract-test',
  paymentId: 'payment_contract-test',
  provider: 'TEST_PROVIDER',
  providerPaymentReference: 'provider_payment_contract-test',
  localStatus: 'SUCCEEDED',
  observedProviderStatus: 'SUCCEEDED',
  localAmount: { amountMinor: 29900, currency: 'USD' },
  observedAmount: { amountMinor: 29900, currency: 'USD' },
  classification: 'MATCH',
  disposition: 'OPEN',
  observedAt: at,
  createdAt: at,
  updatedAt: at,
  ...overrides
});

describe('Payment contracts', () => {
  it('accepts integral minor-unit payment snapshots', () => {
    expect(() => assertPayment(payment())).not.toThrow();
  });

  it('rejects malformed money and refund totals beyond the governed payment amount', () => {
    expect(() =>
      assertPayment(payment({ amount: { amountMinor: 29900, currency: 'usd' } }))
    ).toThrow();
    expect(() => assertPayment(payment({ refundedMinor: 29901 }))).toThrow(PaymentContractError);
  });

  it('requires stable uppercase provider identifiers', () => {
    expect(() => assertPaymentProviderCode('STRIPE_TEST')).not.toThrow();
    expect(() => assertPaymentProviderCode('stripe')).toThrow(PaymentContractError);
  });

  it('requires positive refunds with a stated reason', () => {
    expect(() => assertPaymentRefund(refund())).not.toThrow();
    expect(() => assertPaymentRefund(refund({ amount: { amountMinor: 0, currency: 'USD' } }))).toThrow(
      PaymentContractError
    );
    expect(() => assertPaymentRefund(refund({ reason: '   ' }))).toThrow(PaymentContractError);
  });

  it('validates reconciliation money and provider identity without mutating payment truth', () => {
    expect(() => assertPaymentReconciliation(reconciliation())).not.toThrow();
    expect(() =>
      assertPaymentReconciliation(
        reconciliation({ observedAmount: { amountMinor: 29900, currency: 'usd' } })
      )
    ).toThrow();
    expect(() => assertPaymentReconciliation(reconciliation({ provider: 'bad-provider' }))).toThrow(
      PaymentContractError
    );
  });

  it('keeps successful payment authority separate from downstream commercial and filing truth', () => {
    expect(paymentSucceededAuthorityConsequences).toEqual({
      paymentSucceeded: true,
      orderMarkedPaid: false,
      matterCreated: false,
      matterCompleted: false,
      professionalAppointed: false,
      providerAssignedExternally: false,
      filingCreated: false,
      filingSubmitted: false,
      officialApplicationCreated: false,
      trademarkOfficeContacted: false
    });
    expect(Object.isFrozen(paymentSucceededAuthorityConsequences)).toBe(true);
  });
});
