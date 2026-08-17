import { describe, expect, it } from 'vitest';
import {
  encodeInternalOperatorPrincipal,
  type InternalOperatorPrincipal
} from '@markorbit/contracts';
import type {
  Payment,
  PaymentAttempt,
  PaymentProviderEventReceipt,
  PaymentReconciliationObservation,
  PaymentRefund
} from '@markorbit/contracts/payment';
import type { JsonRequest } from '@markorbit/service-kit';
import { PaymentAdminReadService, type PaymentAdminReadRepository } from '../src/payment-admin.js';
import { createPaymentAdminHttpRoutes } from '../src/payment-admin-http.js';

const secret = 'internal-secret';
const payment: Payment = {
  schemaVersion: 1,
  paymentId: 'payment_admin-test',
  workspaceId: 'workspace_admin-test',
  checkoutSessionId: 'checkout_admin-test',
  orderId: 'order_admin-test',
  initiatedByUserId: 'user_customer-test',
  productId: 'product_trademark-filing',
  productVersion: 2,
  priceId: 'price_direct-v2',
  priceVersion: 2,
  amount: { amountMinor: 29900, currency: 'USD' },
  provider: 'STRIPE',
  status: 'SUCCEEDED',
  version: 3,
  refundedMinor: 29900,
  createdAt: '2026-08-17T08:00:00.000Z',
  updatedAt: '2026-08-17T08:20:00.000Z',
  succeededAt: '2026-08-17T08:10:00.000Z'
};
const attempt: PaymentAttempt = {
  schemaVersion: 1,
  paymentAttemptId: 'payment_attempt_admin-test',
  paymentId: payment.paymentId,
  provider: payment.provider,
  providerPaymentReference: 'pi_admin_test',
  attemptNumber: 1,
  createdAt: payment.createdAt,
  updatedAt: payment.updatedAt
};
const providerEvent: PaymentProviderEventReceipt = {
  schemaVersion: 1,
  receiptId: 'provider_event_admin-test',
  provider: payment.provider,
  providerEventId: 'evt_admin_test',
  providerPaymentReference: attempt.providerPaymentReference,
  rawSha256: 'a'.repeat(64),
  canonicalType: 'PAYMENT_SUCCEEDED',
  paymentId: payment.paymentId,
  occurredAt: '2026-08-17T08:10:00.000Z',
  receivedAt: '2026-08-17T08:10:01.000Z',
  verifiedAt: '2026-08-17T08:10:01.000Z',
  applied: true
};
const refund: PaymentRefund = {
  schemaVersion: 1,
  refundId: 'refund_admin-test',
  paymentId: payment.paymentId,
  workspaceId: payment.workspaceId,
  requestedByUserId: 'user_internal-test',
  amount: { amountMinor: 29900, currency: 'USD' },
  status: 'SUCCEEDED',
  version: 2,
  providerRefundReference: 're_admin_test',
  reason: 'Customer cancellation',
  createdAt: '2026-08-17T08:15:00.000Z',
  updatedAt: '2026-08-17T08:20:00.000Z',
  succeededAt: '2026-08-17T08:20:00.000Z'
};
const reconciliation: PaymentReconciliationObservation = {
  schemaVersion: 1,
  reconciliationId: 'reconciliation_admin-test',
  workspaceId: payment.workspaceId,
  paymentId: payment.paymentId,
  provider: payment.provider,
  providerPaymentReference: attempt.providerPaymentReference,
  localStatus: 'SUCCEEDED',
  observedProviderStatus: 'succeeded',
  localAmount: payment.amount,
  observedAmount: payment.amount,
  classification: 'MATCH',
  disposition: 'OPEN',
  observedAt: '2026-08-17T08:12:00.000Z',
  createdAt: '2026-08-17T08:12:00.000Z',
  updatedAt: '2026-08-17T08:12:00.000Z'
};
const operator: InternalOperatorPrincipal = {
  kind: 'INTERNAL_OPERATOR',
  sessionId: 'session_internal-test',
  userId: 'user_internal-test',
  capabilities: ['commercial-admin:read'],
  sessionExpiresAt: '2026-08-18T00:00:00.000Z'
};

function repository(): PaymentAdminReadRepository {
  return {
    findByPaymentId: (workspaceId, paymentId) =>
      Promise.resolve(
        workspaceId === payment.workspaceId && paymentId === payment.paymentId
          ? { payment, attempt }
          : null
      ),
    listAttempts: () => Promise.resolve([attempt]),
    listProviderEvents: () => Promise.resolve([providerEvent]),
    listRefunds: () => Promise.resolve([refund]),
    listReconciliations: () => Promise.resolve([reconciliation])
  };
}

function request(principal = operator): JsonRequest {
  return {
    method: 'GET',
    path: '',
    body: undefined,
    params: { paymentId: payment.paymentId },
    query: {},
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-principal': encodeInternalOperatorPrincipal(principal),
      'x-markorbit-workspace-id': payment.workspaceId
    }
  };
}

describe('Payment commercial admin owner read', () => {
  it('returns the Payment-owned lifecycle aggregate without provider client secrets', async () => {
    const service = new PaymentAdminReadService(repository());
    const inspection = await service.inspectPayment(
      operator,
      payment.workspaceId,
      payment.paymentId
    );
    expect(inspection).toEqual({
      schemaVersion: 1,
      source: { domain: 'PAYMENT', authority: 'PAYMENT_LIFECYCLE' },
      payment,
      attempts: [attempt],
      providerEvents: [providerEvent],
      refunds: [refund],
      reconciliations: [reconciliation]
    });
    expect(JSON.stringify(inspection)).not.toContain('client_secret');
    expect(JSON.stringify(inspection)).not.toContain('sk_test_');
  });

  it('rejects a principal without commercial-admin:read before querying Payment truth', async () => {
    let queried = false;
    const service = new PaymentAdminReadService({
      ...repository(),
      findByPaymentId: () => {
        queried = true;
        return Promise.resolve({ payment, attempt });
      }
    });
    await expect(
      service.inspectPayment(
        { ...operator, capabilities: [] },
        payment.workspaceId,
        payment.paymentId
      )
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(queried).toBe(false);
  });

  it('requires both internal service authentication and the encoded INTERNAL operator principal', async () => {
    const route = createPaymentAdminHttpRoutes({
      service: new PaymentAdminReadService(repository()),
      internalServiceSecret: secret
    })[0]!;
    await expect(
      route.handle({
        ...request(),
        headers: { ...request().headers, 'x-markorbit-internal-authorization': 'wrong' }
      })
    ).rejects.toMatchObject({ status: 401, code: 'INTERNAL_SERVICE_UNAUTHORIZED' });

    const response = await route.handle(request());
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      source: { domain: 'PAYMENT', authority: 'PAYMENT_LIFECYCLE' },
      payment: { paymentId: payment.paymentId }
    });
  });
});
