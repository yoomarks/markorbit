import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import { HttpError, type JsonRequest } from '@markorbit/service-kit';
import { csrfToken, type CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayPaymentRoutes } from '../src/payment-http.js';

const csrfSecret = 'payment-gateway-csrf-secret';
const origin = 'https://markorbit.test';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session_gateway-payment-test',
  userId: 'user_gateway-payment-test',
  workspaceId: 'workspace_gateway-payment-test',
  membershipId: 'membership_gateway-payment-test',
  role: 'WORKSPACE_ADMIN',
  permissions: ['order:read', 'order:update'],
  sessionExpiresAt: '2026-08-17T08:00:00.000Z'
};

const authenticationClient = {
  resolveWorkspace: vi.fn(() => Promise.resolve(principal))
} as unknown as CoreAuthenticationClient;

function request(method: string, path: string, body: unknown = undefined): JsonRequest {
  return {
    method,
    path,
    body,
    params: path.includes('payment_gateway-test') ? { paymentId: 'payment_gateway-test' } : {},
    query: {},
    headers: {
      cookie: 'mo_session=session-token',
      origin,
      'x-markorbit-csrf-token': csrfToken(principal.sessionId, csrfSecret),
      'x-markorbit-workspace-id': principal.workspaceId,
      'idempotency-key': 'payment-gateway-key',
      'x-correlation-id': 'correlation_gateway-payment-test'
    }
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Gateway Payment routes', () => {
  it('enforces authenticated mutation controls and forwards only governed Checkout intent', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ payment: { paymentId: 'payment_gateway-test' } }), {
        status: 201,
        headers: { 'content-type': 'application/json' }
      })
    );
    const routes = createGatewayPaymentRoutes({
      paymentUrl: 'http://payment.test',
      authenticationClient,
      internalServiceSecret: 'internal-secret',
      csrfSecret,
      allowedOrigins: [origin]
    });
    const create = routes.find((route) => route.method === 'POST')!;
    const response = await create.handle(
      request('POST', '/api/payments', { checkoutSessionId: 'checkout_gateway-test' })
    );
    expect(response.status).toBe(201);
    expect(authenticationClient.resolveWorkspace).toHaveBeenCalledWith(
      'session-token',
      principal.workspaceId,
      'correlation_gateway-payment-test'
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://payment.test/v1/payments');
    expect(init).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ checkoutSessionId: 'checkout_gateway-test' })
    });
    expect((init?.headers as Record<string, string>)['idempotency-key']).toBe(
      'payment-gateway-key'
    );
  });

  it('rejects browser monetary spoofing before authentication or provider forwarding', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const routes = createGatewayPaymentRoutes({
      paymentUrl: 'http://payment.test',
      authenticationClient,
      internalServiceSecret: 'internal-secret',
      csrfSecret,
      allowedOrigins: [origin]
    });
    const create = routes.find((route) => route.method === 'POST')!;
    await expect(
      create.handle(
        request('POST', '/api/payments', {
          checkoutSessionId: 'checkout_gateway-test',
          amount: { amountMinor: 1, currency: 'USD' }
        })
      )
    ).rejects.toMatchObject({
      status: 400,
      code: 'MONETARY_OR_ACTOR_SPOOF_REJECTED'
    } satisfies Partial<HttpError>);
    expect(authenticationClient.resolveWorkspace).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects untrusted Origin and missing idempotency on Payment initiation', async () => {
    const routes = createGatewayPaymentRoutes({
      paymentUrl: 'http://payment.test',
      authenticationClient,
      internalServiceSecret: 'internal-secret',
      csrfSecret,
      allowedOrigins: [origin]
    });
    const create = routes.find((route) => route.method === 'POST')!;
    const untrusted = request('POST', '/api/payments', {
      checkoutSessionId: 'checkout_gateway-test'
    });
    untrusted.headers = { ...untrusted.headers, origin: 'https://evil.test' };
    await expect(create.handle(untrusted)).rejects.toMatchObject({
      status: 403,
      code: 'UNTRUSTED_ORIGIN'
    });

    const noIdempotency = request('POST', '/api/payments', {
      checkoutSessionId: 'checkout_gateway-test'
    });
    const { ['idempotency-key']: _removed, ...headers } = noIdempotency.headers;
    noIdempotency.headers = headers;
    await expect(create.handle(noIdempotency)).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_REQUEST'
    });
  });

  it('uses Workspace-scoped authenticated read without CSRF/idempotency requirements', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ paymentId: 'payment_gateway-test' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );
    const routes = createGatewayPaymentRoutes({
      paymentUrl: 'http://payment.test',
      authenticationClient,
      internalServiceSecret: 'internal-secret',
      csrfSecret,
      allowedOrigins: [origin]
    });
    const read = routes.find((route) => route.method === 'GET')!;
    const value = request('GET', '/api/payments/payment_gateway-test');
    value.headers = {
      cookie: value.headers.cookie,
      'x-markorbit-workspace-id': principal.workspaceId
    };
    const response = await read.handle(value);
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://payment.test/v1/payments/payment_gateway-test',
      expect.objectContaining({ method: 'GET' })
    );
  });
});
