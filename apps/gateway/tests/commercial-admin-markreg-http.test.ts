import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthenticationError, type InternalOperatorPrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import type { CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayCommercialAdminMarkRegRoutes } from '../src/commercial-admin-markreg-http.js';

const operator: InternalOperatorPrincipal = {
  kind: 'INTERNAL_OPERATOR',
  sessionId: 'session_markreg-gateway-test',
  userId: 'user_markreg-gateway-test',
  capabilities: ['commercial-admin:read'],
  sessionExpiresAt: '2099-01-01T00:00:00.000Z'
};
const resolveInternalOperator = vi.fn(() => Promise.resolve(operator));
const authenticationClient = {
  resolveInternalOperator
} as unknown as CoreAuthenticationClient;

function request(
  path: string,
  params: Record<string, string>,
  query: Record<string, string> = {},
  cookie = 'mo_session=opaque-admin-session'
): JsonRequest {
  return {
    method: 'GET',
    path,
    body: undefined,
    params,
    query,
    headers: {
      cookie,
      'x-correlation-id': 'correlation_markreg-admin-test'
    }
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Gateway MarkReg commercial admin boundary', () => {
  it('resolves INTERNAL authority from the real session then forwards a trusted principal', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ items: [], page: 1, pageSize: 20, total: 0 }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );
    const route = createGatewayCommercialAdminMarkRegRoutes({
      markRegUrl: 'http://markreg.test',
      authenticationClient,
      internalServiceSecret: 'internal-secret'
    }).find((item) => item.path === '/api/internal/commercial-admin/workspaces/:workspaceId/orders')!;

    const response = await route.handle(
      request(
        '/api/internal/commercial-admin/workspaces/workspace_admin-test/orders',
        { workspaceId: 'workspace_admin-test' },
        { page: '1', pageSize: '20', customerId: 'customer_admin-test' }
      )
    );
    expect(response.status).toBe(200);
    expect(resolveInternalOperator).toHaveBeenCalledWith(
      'opaque-admin-session',
      'correlation_markreg-admin-test'
    );
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      'http://markreg.test/internal/commercial-admin/workspaces/workspace_admin-test/orders?page=1&pageSize=20&customerId=customer_admin-test'
    );
    const headers = init?.headers as Record<string, string>;
    expect(headers['x-markorbit-internal-authorization']).toBe('internal-secret');
    expect(headers['x-markorbit-principal']).toBeTruthy();
  });

  it('rejects anonymous access before calling Core or MarkReg', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const route = createGatewayCommercialAdminMarkRegRoutes({
      markRegUrl: 'http://markreg.test',
      authenticationClient,
      internalServiceSecret: 'internal-secret'
    }).find(
      (item) => item.path === '/api/internal/commercial-admin/workspaces/:workspaceId/orders/:orderId'
    )!;

    await expect(
      route.handle(
        request(
          '/api/internal/commercial-admin/workspaces/workspace_admin-test/orders/order_admin-test',
          { workspaceId: 'workspace_admin-test', orderId: 'order_admin-test' },
          {},
          ''
        )
      )
    ).rejects.toMatchObject({ status: 401, code: 'AUTHENTICATION_REQUIRED' });
    expect(resolveInternalOperator).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not accept browser-provided account type or Workspace role as admin authority', async () => {
    const deniedClient = {
      resolveInternalOperator: () =>
        Promise.reject(
          new AuthenticationError('PERMISSION_DENIED', 'Commercial admin capability is required.')
        )
    } as unknown as CoreAuthenticationClient;
    const route = createGatewayCommercialAdminMarkRegRoutes({
      markRegUrl: 'http://markreg.test',
      authenticationClient: deniedClient,
      internalServiceSecret: 'internal-secret'
    }).find((item) => item.path === '/api/internal/commercial-admin/catalog')!;
    const base = request('/api/internal/commercial-admin/catalog', {}, {
      channel: 'MARKREG_DIRECT',
      relationshipModel: 'DIRECT'
    });
    const spoofed: JsonRequest = {
      ...base,
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
