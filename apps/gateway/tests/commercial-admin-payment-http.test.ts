import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InternalOperatorPrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import type { CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayCommercialAdminPaymentRoutes } from '../src/commercial-admin-payment-http.js';

const operator: InternalOperatorPrincipal = {
  kind: 'INTERNAL_OPERATOR',
  sessionId: 'session_admin-payment-test',
  userId: 'user_admin-payment-test',
  capabilities: ['commercial-admin:read'],
  sessionExpiresAt: '2026-08-18T00:00:00.000Z'
};
const resolveInternalOperator = vi.fn(() => Promise.resolve(operator));
const authenticationClient = {
  resolveInternalOperator
} as unknown as CoreAuthenticationClient;

function request(cookie = 'mo_session=opaque-session'): JsonRequest {
  return {
    method: 'GET',
    path: '/api/internal/commercial-admin/payments/payment_admin-gateway-test',
    body: undefined,
    params: { paymentId: 'payment_admin-gateway-test' },
    query: {},
    headers: {
      cookie,
      'x-markorbit-workspace-id': 'workspace_admin-gateway-test',
      'x-correlation-id': 'correlation_admin-payment-test'
    }
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Gateway Payment commercial admin boundary', () => {
  it('resolves INTERNAL authority from the real session then forwards trusted owner-read context', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          schemaVersion: 1,
          source: { domain: 'PAYMENT', authority: 'PAYMENT_LIFECYCLE' },
          payment: { paymentId: 'payment_admin-gateway-test' },
          attempts: [],
          providerEvents: [],
          refunds: [],
          reconciliations: []
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    const route = createGatewayCommercialAdminPaymentRoutes({
      paymentUrl: 'http://payment.test',
      authenticationClient,
      internalServiceSecret: 'internal-secret'
    })[0]!;

    const response = await route.handle(request());
    expect(response.status).toBe(200);
    expect(resolveInternalOperator).toHaveBeenCalledWith(
      'opaque-session',
      'correlation_admin-payment-test'
    );
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      'http://payment.test/internal/commercial-admin/payments/payment_admin-gateway-test'
    );
    const headers = init?.headers as Record<string, string>;
    expect(headers['x-markorbit-internal-authorization']).toBe('internal-secret');
    expect(headers['x-markorbit-workspace-id']).toBe('workspace_admin-gateway-test');
    expect(headers['x-markorbit-principal']).toBeTruthy();
  });

  it('rejects anonymous access before calling Core or Payment', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const route = createGatewayCommercialAdminPaymentRoutes({
      paymentUrl: 'http://payment.test',
      authenticationClient,
      internalServiceSecret: 'internal-secret'
    })[0]!;

    await expect(route.handle(request(''))).rejects.toMatchObject({
      status: 401,
      code: 'AUTHENTICATION_REQUIRED'
    });
    expect(resolveInternalOperator).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires explicit workspace context and never accepts workspace identity from a request body', async () => {
    const route = createGatewayCommercialAdminPaymentRoutes({
      paymentUrl: 'http://payment.test',
      authenticationClient,
      internalServiceSecret: 'internal-secret'
    })[0]!;
    const value = request();
    value.headers = { cookie: value.headers.cookie };
    value.body = { workspaceId: 'workspace_spoofed' };

    await expect(route.handle(value)).rejects.toMatchObject({
      status: 400,
      code: 'WORKSPACE_CONTEXT_REQUIRED'
    });
    expect(resolveInternalOperator).not.toHaveBeenCalled();
  });
});
