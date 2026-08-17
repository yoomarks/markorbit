import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthenticationError, type InternalOperatorPrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import type { CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayCommercialAdminMgsnRoutes } from '../src/commercial-admin-mgsn-http.js';

const operator: InternalOperatorPrincipal = {
  kind: 'INTERNAL_OPERATOR',
  sessionId: 'session_mgsn-gateway-test',
  userId: 'user_mgsn-gateway-test',
  capabilities: ['commercial-admin:read'],
  sessionExpiresAt: '2099-01-01T00:00:00.000Z'
};
const resolveInternalOperator = vi.fn(() => Promise.resolve(operator));
const authenticationClient = {
  resolveInternalOperator
} as unknown as CoreAuthenticationClient;

function request(cookie = 'mo_session=opaque-admin-session'): JsonRequest {
  return {
    method: 'GET',
    path: '/api/internal/commercial-admin/providers/provider_admin-test',
    body: undefined,
    params: { providerId: 'provider_admin-test' },
    query: {},
    headers: {
      cookie,
      'x-correlation-id': 'correlation_mgsn-admin-test'
    }
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Gateway MGSN commercial admin boundary', () => {
  it('resolves INTERNAL authority from the real session and forwards only trusted principal context', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          schemaVersion: 1,
          source: { domain: 'MGSN', authority: 'PROVIDER_NETWORK' },
          provider: { providerId: 'provider_admin-test' },
          supplyCapabilities: []
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    const route = createGatewayCommercialAdminMgsnRoutes({
      mgsnUrl: 'http://mgsn.test',
      authenticationClient,
      internalServiceSecret: 'internal-secret'
    }).find((item) => item.path === '/api/internal/commercial-admin/providers/:providerId')!;

    const response = await route.handle(request());
    expect(response.status).toBe(200);
    expect(resolveInternalOperator).toHaveBeenCalledWith(
      'opaque-admin-session',
      'correlation_mgsn-admin-test'
    );
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://mgsn.test/internal/commercial-admin/providers/provider_admin-test');
    const headers = init?.headers as Record<string, string>;
    expect(headers['x-markorbit-internal-authorization']).toBe('internal-secret');
    expect(headers['x-markorbit-principal']).toBeTruthy();
  });

  it('rejects anonymous access before calling Core or MGSN', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const route = createGatewayCommercialAdminMgsnRoutes({
      mgsnUrl: 'http://mgsn.test',
      authenticationClient,
      internalServiceSecret: 'internal-secret'
    }).find((item) => item.path === '/api/internal/commercial-admin/providers/:providerId')!;

    await expect(route.handle(request(''))).rejects.toMatchObject({
      status: 401,
      code: 'AUTHENTICATION_REQUIRED'
    });
    expect(resolveInternalOperator).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores browser role claims when Core denies commercial admin capability', async () => {
    const deniedClient = {
      resolveInternalOperator: () =>
        Promise.reject(
          new AuthenticationError('PERMISSION_DENIED', 'Commercial admin capability is required.')
        )
    } as unknown as CoreAuthenticationClient;
    const route = createGatewayCommercialAdminMgsnRoutes({
      mgsnUrl: 'http://mgsn.test',
      authenticationClient: deniedClient,
      internalServiceSecret: 'internal-secret'
    }).find((item) => item.path === '/api/internal/commercial-admin/providers')!;
    const base = request();
    const spoofed: JsonRequest = {
      ...base,
      params: {},
      headers: {
        ...base.headers,
        'x-markorbit-account-type': 'INTERNAL',
        'x-markorbit-role': 'WORKSPACE_ADMIN'
      }
    };

    await expect(route.handle(spoofed)).rejects.toMatchObject({
      status: 403,
      code: 'PERMISSION_DENIED'
    });
  });
});
