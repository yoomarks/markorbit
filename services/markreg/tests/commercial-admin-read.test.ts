import { describe, expect, it, vi } from 'vitest';
import {
  encodeInternalOperatorPrincipal,
  type InternalOperatorPrincipal
} from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import {
  MarkRegCommercialAdminReadService,
  type MarkRegAdminOrderInspection
} from '../src/commercial-admin-read.js';
import { createMarkRegCommercialAdminHttpRoutes } from '../src/commercial-admin-http.js';

const secret = 'internal-secret';
const operator: InternalOperatorPrincipal = {
  kind: 'INTERNAL_OPERATOR',
  sessionId: 'session_markreg-admin-test',
  userId: 'user_markreg-admin-test',
  capabilities: ['commercial-admin:read'],
  sessionExpiresAt: '2099-01-01T00:00:00.000Z'
};

function request(path: string, params: Record<string, string>, query: Record<string, string> = {}): JsonRequest {
  return {
    method: 'GET',
    path,
    body: undefined,
    params,
    query,
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-principal': encodeInternalOperatorPrincipal(operator)
    }
  };
}

describe('MarkReg commercial admin owner reads', () => {
  it('rejects missing commercial-admin:read before touching owner repositories', async () => {
    const touched = vi.fn();
    const service = new MarkRegCommercialAdminReadService(
      { listCatalog: touched } as never,
      { list: touched } as never,
      { list: touched } as never
    );

    await expect(
      service.listOrders(
        { ...operator, capabilities: [] },
        'workspace_admin-test',
        { page: 1, pageSize: 20 }
      )
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(touched).not.toHaveBeenCalled();
  });

  it('requires internal service authentication and a server-encoded INTERNAL operator principal', async () => {
    const listOrders = vi.fn(() =>
      Promise.resolve({ items: [], page: 1, pageSize: 20, total: 0 })
    );
    const service = { listOrders } as unknown as MarkRegCommercialAdminReadService;
    const route = createMarkRegCommercialAdminHttpRoutes({
      service,
      internalServiceSecret: secret
    }).find(
      (item) => item.path === '/internal/commercial-admin/workspaces/:workspaceId/orders'
    )!;

    const valid = request(
      '/internal/commercial-admin/workspaces/workspace_admin-test/orders',
      { workspaceId: 'workspace_admin-test' },
      { page: '1', pageSize: '20', customerId: 'customer_admin-test' }
    );
    await expect(
      route.handle({
        ...valid,
        headers: { ...valid.headers, 'x-markorbit-internal-authorization': 'wrong' }
      })
    ).rejects.toMatchObject({ status: 401, code: 'INTERNAL_SERVICE_UNAUTHORIZED' });

    const response = await route.handle(valid);
    expect(response.status).toBe(200);
    expect(listOrders).toHaveBeenCalledWith(operator, 'workspace_admin-test', {
      page: 1,
      pageSize: 20,
      customerId: 'customer_admin-test'
    });
  });

  it('returns MarkReg owner identity with Order inspection instead of a Gateway-authored status', async () => {
    const inspection: MarkRegAdminOrderInspection = {
      schemaVersion: 1,
      source: { domain: 'MARKREG', authority: 'ORDER' },
      order: { orderId: 'order_admin-test' } as MarkRegAdminOrderInspection['order'],
      audit: []
    };
    const inspectOrder = vi.fn(() => Promise.resolve(inspection));
    const service = { inspectOrder } as unknown as MarkRegCommercialAdminReadService;
    const route = createMarkRegCommercialAdminHttpRoutes({
      service,
      internalServiceSecret: secret
    }).find(
      (item) => item.path === '/internal/commercial-admin/workspaces/:workspaceId/orders/:orderId'
    )!;

    const response = await route.handle(
      request('/internal/commercial-admin/workspaces/workspace_admin-test/orders/order_admin-test', {
        workspaceId: 'workspace_admin-test',
        orderId: 'order_admin-test'
      })
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual(inspection);
    expect(inspectOrder).toHaveBeenCalledWith(
      operator,
      'workspace_admin-test',
      'order_admin-test'
    );
  });
});
