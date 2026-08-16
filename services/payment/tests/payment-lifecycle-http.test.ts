import { describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type {
  PaymentEventApplyResult,
  PaymentReconciliationObservation,
  PaymentRefund
} from '@markorbit/contracts/payment';
import { HttpError, type JsonRequest } from '@markorbit/service-kit';
import { createPaymentLifecycleHttpRoutes } from '../src/payment-lifecycle-http.js';

const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session_payment-lifecycle-http',
  userId: 'user_payment-lifecycle-http',
  workspaceId: 'workspace_payment-lifecycle-http',
  membershipId: 'membership_payment-lifecycle-http',
  role: 'WORKSPACE_ADMIN',
  permissions: ['order:read', 'order:update'],
  sessionExpiresAt: '2026-08-17T08:00:00.000Z'
};

function request(
  path: string,
  body: unknown,
  params: Record<string, string>,
  rawBody?: Uint8Array
): JsonRequest {
  return {
    method: 'POST',
    path,
    body,
    params,
    query: {},
    ...(rawBody ? { rawBody } : {}),
    headers: {
      'content-type': 'application/json',
      'x-markorbit-internal-authorization': 'internal-secret',
      'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
      'x-markorbit-workspace-id': principal.workspaceId,
      'idempotency-key': 'refund-http-key',
      'x-provider-signature': 'signed-test-value'
    }
  };
}

const receipt: PaymentEventApplyResult = {
  receipt: {
    schemaVersion: 1,
    receiptId: 'provider_event_http-test',
    provider: 'TEST_PROVIDER',
    providerEventId: 'evt_http-test',
    rawSha256: 'a'.repeat(64),
    canonicalType: 'PAYMENT_PROCESSING',
    occurredAt: '2026-08-16T08:00:00.000Z',
    receivedAt: '2026-08-16T08:00:01.000Z',
    verifiedAt: '2026-08-16T08:00:01.000Z',
    applied: false,
    ignoredReason: 'PROVIDER_PAYMENT_REFERENCE_NOT_FOUND'
  }
};

const refund: PaymentRefund = {
  schemaVersion: 1,
  refundId: 'refund_http-test',
  paymentId: 'payment_http-test',
  workspaceId: principal.workspaceId,
  requestedByUserId: principal.userId as PaymentRefund['requestedByUserId'],
  amount: { amountMinor: 500, currency: 'USD' },
  status: 'PENDING',
  version: 1,
  providerRefundReference: 'provider_refund_http-test',
  reason: 'duplicate order',
  createdAt: '2026-08-16T08:10:00.000Z',
  updatedAt: '2026-08-16T08:10:00.000Z'
};

const reconciliation: PaymentReconciliationObservation = {
  schemaVersion: 1,
  reconciliationId: 'reconciliation_http-test',
  workspaceId: principal.workspaceId,
  paymentId: 'payment_http-test',
  provider: 'TEST_PROVIDER',
  providerPaymentReference: 'provider_payment_http-test',
  localStatus: 'SUCCEEDED',
  observedProviderStatus: 'SUCCEEDED',
  localAmount: { amountMinor: 29900, currency: 'USD' },
  observedAmount: { amountMinor: 29900, currency: 'USD' },
  classification: 'MATCH',
  disposition: 'OPEN',
  observedAt: '2026-08-16T08:20:00.000Z',
  createdAt: '2026-08-16T08:20:01.000Z',
  updatedAt: '2026-08-16T08:20:01.000Z'
};

describe('Payment lifecycle internal HTTP boundary', () => {
  it('passes exact raw webhook bytes to signature verification without Session authentication', async () => {
    const handleWebhook = vi.fn(() => Promise.resolve(receipt));
    const routes = createPaymentLifecycleHttpRoutes({
      providerCode: 'TEST_PROVIDER',
      service: {
        handleWebhook,
        requestRefund: () => Promise.resolve(refund),
        reconcile: () => Promise.resolve(reconciliation)
      },
      internalServiceSecret: 'internal-secret'
    });
    const rawBody = new TextEncoder().encode('{"provider":"wire-shape"}');
    const webhook = routes.find((route) => route.path.includes('provider-webhooks'))!;
    const req = request(
      '/internal/payment/provider-webhooks/TEST_PROVIDER',
      { provider: 'parsed-shape' },
      { provider: 'TEST_PROVIDER' },
      rawBody
    );
    req.headers = {
      'content-type': 'application/json',
      'x-provider-signature': 'signed-test-value'
    };
    const response = await webhook.handle(req);
    expect(response).toEqual({ status: 200, body: receipt });
    expect(handleWebhook).toHaveBeenCalledTimes(1);
    const input = handleWebhook.mock.calls[0]![0];
    expect(Array.from(input.rawBody)).toEqual(Array.from(rawBody));
    expect(input.headers['x-provider-signature']).toBe('signed-test-value');
  });

  it('rejects webhook provider mismatches before service invocation', async () => {
    const handleWebhook = vi.fn(() => Promise.resolve(receipt));
    const routes = createPaymentLifecycleHttpRoutes({
      providerCode: 'TEST_PROVIDER',
      service: {
        handleWebhook,
        requestRefund: () => Promise.resolve(refund),
        reconcile: () => Promise.resolve(reconciliation)
      },
      internalServiceSecret: 'internal-secret'
    });
    const webhook = routes.find((route) => route.path.includes('provider-webhooks'))!;
    await expect(
      webhook.handle(
        request(
          '/internal/payment/provider-webhooks/OTHER_PROVIDER',
          {},
          { provider: 'OTHER_PROVIDER' },
          new Uint8Array([123, 125])
        )
      )
    ).rejects.toMatchObject({
      status: 404,
      code: 'PAYMENT_PROVIDER_NOT_FOUND'
    } satisfies Partial<HttpError>);
    expect(handleWebhook).not.toHaveBeenCalled();
  });

  it('derives refund actor/workspace/idempotency from internal Principal and headers', async () => {
    const requestRefund = vi.fn(() => Promise.resolve(refund));
    const routes = createPaymentLifecycleHttpRoutes({
      providerCode: 'TEST_PROVIDER',
      service: {
        handleWebhook: () => Promise.resolve(receipt),
        requestRefund,
        reconcile: () => Promise.resolve(reconciliation)
      },
      internalServiceSecret: 'internal-secret'
    });
    const route = routes.find((candidate) => candidate.path.endsWith('/refunds'))!;
    const response = await route.handle(
      request(
        '/internal/payment/refunds',
        { paymentId: refund.paymentId, amountMinor: 500, reason: 'duplicate order' },
        {}
      )
    );
    expect(response).toEqual({ status: 201, body: refund });
    expect(requestRefund).toHaveBeenCalledWith(principal, {
      workspaceId: principal.workspaceId,
      paymentId: refund.paymentId,
      amountMinor: 500,
      reason: 'duplicate order',
      idempotencyKey: 'refund-http-key'
    });
  });

  it('rejects refund identity spoofing before lifecycle invocation', async () => {
    const requestRefund = vi.fn(() => Promise.resolve(refund));
    const routes = createPaymentLifecycleHttpRoutes({
      providerCode: 'TEST_PROVIDER',
      service: {
        handleWebhook: () => Promise.resolve(receipt),
        requestRefund,
        reconcile: () => Promise.resolve(reconciliation)
      },
      internalServiceSecret: 'internal-secret'
    });
    const route = routes.find((candidate) => candidate.path.endsWith('/refunds'))!;
    await expect(
      route.handle(
        request(
          '/internal/payment/refunds',
          {
            paymentId: refund.paymentId,
            amountMinor: 500,
            reason: 'duplicate order',
            workspaceId: 'workspace_spoof'
          },
          {}
        )
      )
    ).rejects.toMatchObject({ status: 400, code: 'ACTOR_SPOOF_REJECTED' });
    expect(requestRefund).not.toHaveBeenCalled();
  });

  it('requires internal authentication for reconciliation and derives Workspace scope', async () => {
    const reconcile = vi.fn(() => Promise.resolve(reconciliation));
    const routes = createPaymentLifecycleHttpRoutes({
      providerCode: 'TEST_PROVIDER',
      service: {
        handleWebhook: () => Promise.resolve(receipt),
        requestRefund: () => Promise.resolve(refund),
        reconcile
      },
      internalServiceSecret: 'internal-secret'
    });
    const route = routes.find((candidate) => candidate.path.includes('/reconcile'))!;
    const req = request(
      `/internal/payment/payments/${reconciliation.paymentId}/reconcile`,
      {},
      { paymentId: reconciliation.paymentId }
    );
    const response = await route.handle(req);
    expect(response).toEqual({ status: 201, body: reconciliation });
    expect(reconcile).toHaveBeenCalledWith(
      principal,
      principal.workspaceId,
      reconciliation.paymentId
    );

    req.headers = {
      ...req.headers,
      'x-markorbit-internal-authorization': 'wrong-secret'
    };
    await expect(route.handle(req)).rejects.toMatchObject({
      status: 401,
      code: 'INTERNAL_SERVICE_UNAUTHORIZED'
    });
  });
});
