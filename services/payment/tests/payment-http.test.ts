import { describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { InitiatePaymentResult, Payment } from '@markorbit/contracts/payment';
import type { HttpError} from '@markorbit/service-kit';
import { type JsonRequest } from '@markorbit/service-kit';
import { createPaymentHttpRoutes } from '../src/payment-http.js';

const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session_payment-http-test',
  userId: 'user_payment-http-test',
  workspaceId: 'workspace_payment-http-test',
  membershipId: 'membership_payment-http-test',
  role: 'WORKSPACE_ADMIN',
  permissions: ['order:read', 'order:update'],
  sessionExpiresAt: '2026-08-17T08:00:00.000Z'
};
const payment: Payment = {
  schemaVersion: 1,
  paymentId: 'payment_http-test',
  workspaceId: principal.workspaceId,
  checkoutSessionId: 'checkout_http-test',
  orderId: 'order_http-test',
  initiatedByUserId: principal.userId as Payment['initiatedByUserId'],
  productId: 'product_http-test',
  productVersion: 1,
  priceId: 'price_http-test',
  priceVersion: 1,
  amount: { amountMinor: 29900, currency: 'USD' },
  provider: 'TEST_PROVIDER',
  status: 'REQUIRES_ACTION',
  version: 1,
  refundedMinor: 0,
  createdAt: '2026-08-16T08:00:00.000Z',
  updatedAt: '2026-08-16T08:00:00.000Z'
};
const result: InitiatePaymentResult = {
  payment,
  attempt: {
    schemaVersion: 1,
    paymentAttemptId: 'payment_attempt_http-test',
    paymentId: payment.paymentId,
    provider: payment.provider,
    providerPaymentReference: 'provider_payment_http-test',
    attemptNumber: 1,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt
  },
  providerAction: { kind: 'CLIENT_CONFIRMATION', secret: 'client_test' }
};

function request(method: string, path: string, body: unknown = undefined): JsonRequest {
  return {
    method,
    path,
    body,
    params: path.includes(payment.paymentId) ? { paymentId: payment.paymentId } : {},
    query: {},
    headers: {
      'x-markorbit-internal-authorization': 'internal-secret',
      'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
      'x-markorbit-workspace-id': principal.workspaceId,
      'idempotency-key': 'payment-http-key'
    }
  };
}

describe('Payment internal HTTP boundary', () => {
  it('derives actor/workspace/idempotency while accepting only Checkout identity from Gateway', async () => {
    const initiatePayment = vi.fn(() => Promise.resolve(result));
    const getPayment = vi.fn(() => Promise.resolve(payment));
    const routes = createPaymentHttpRoutes({
      service: { initiatePayment, getPayment },
      internalServiceSecret: 'internal-secret'
    });
    const route = routes.find((candidate) => candidate.method === 'POST')!;
    const response = await route.handle(
      request('POST', '/v1/payments', { checkoutSessionId: payment.checkoutSessionId })
    );
    expect(response).toEqual({ status: 201, body: result });
    expect(initiatePayment).toHaveBeenCalledWith(principal, {
      workspaceId: principal.workspaceId,
      checkoutSessionId: payment.checkoutSessionId,
      idempotencyKey: 'payment-http-key'
    });
  });

  it('rejects monetary and provider-state spoof fields before service invocation', async () => {
    const initiatePayment = vi.fn(() => Promise.resolve(result));
    const routes = createPaymentHttpRoutes({
      service: { initiatePayment, getPayment: () => Promise.resolve(payment) },
      internalServiceSecret: 'internal-secret'
    });
    const route = routes.find((candidate) => candidate.method === 'POST')!;
    await expect(
      Promise.resolve().then(() =>
        route.handle(
          request('POST', '/v1/payments', {
            checkoutSessionId: payment.checkoutSessionId,
            amountMinor: 1
          })
        )
      )
    ).rejects.toMatchObject({
      status: 400,
      code: 'MONETARY_OR_ACTOR_SPOOF_REJECTED'
    } satisfies Partial<HttpError>);
    expect(initiatePayment).not.toHaveBeenCalled();
  });

  it('enforces internal service authentication and Workspace-scoped reads', async () => {
    const getPayment = vi.fn(() => Promise.resolve(payment));
    const routes = createPaymentHttpRoutes({
      service: { initiatePayment: () => Promise.resolve(result), getPayment },
      internalServiceSecret: 'internal-secret'
    });
    const read = routes.find((candidate) => candidate.method === 'GET')!;
    const response = await read.handle(request('GET', `/v1/payments/${payment.paymentId}`));
    expect(response).toEqual({ status: 200, body: payment });
    expect(getPayment).toHaveBeenCalledWith(principal, principal.workspaceId, payment.paymentId);

    const unauthorized = request('GET', `/v1/payments/${payment.paymentId}`);
    unauthorized.headers = {
      ...unauthorized.headers,
      'x-markorbit-internal-authorization': 'wrong'
    };
    await expect(Promise.resolve().then(() => read.handle(unauthorized))).rejects.toMatchObject({
      status: 401,
      code: 'INTERNAL_SERVICE_UNAUTHORIZED'
    });
  });
});
