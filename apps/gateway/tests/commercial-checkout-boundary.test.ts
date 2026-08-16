import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { CoreAuthenticationClient } from '../src/auth.js';
import { csrfToken } from '../src/auth.js';
import { createGatewayOrderRoutes } from '../src/order-http.js';

const workspaceId = '45454545-4545-4454-8545-454545454545';
const origin = 'https://commercial.markorbit.test';
const csrfSecret = 'c'.repeat(40);
const internalServiceSecret = 'i'.repeat(40);
const sessionId = 'session_commercial';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId,
  userId: 'user_commercial',
  workspaceId,
  membershipId: 'membership_commercial',
  role: 'MATTER_MANAGER',
  permissions: ['order:read', 'order:update'],
  sessionExpiresAt: '2026-08-17T00:00:00.000Z'
};

const authenticationClient = (value: WorkspacePrincipal = principal) =>
  ({
    resolveWorkspace: vi.fn(async () => value)
  }) as unknown as CoreAuthenticationClient;

const routesFor = (value: WorkspacePrincipal = principal) =>
  createGatewayOrderRoutes({
    markRegUrl: 'http://markreg.test',
    authenticationClient: authenticationClient(value),
    internalServiceSecret,
    csrfSecret,
    allowedOrigins: [origin]
  });

const route = (
  routes: ReturnType<typeof routesFor>,
  method: 'GET' | 'POST',
  path: string
) => {
  const found = routes.find((candidate) => candidate.method === method && candidate.path === path);
  if (!found) throw new Error(`Missing route ${method} ${path}`);
  return found;
};

const request = (
  method: 'GET' | 'POST',
  path: string,
  options: {
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    params?: Record<string, string>;
  } = {}
) =>
  ({
    method,
    path,
    headers: {
      cookie: 'mo_session=browser-token',
      'x-markorbit-workspace-id': workspaceId,
      ...(method === 'POST'
        ? {
            origin,
            'x-markorbit-csrf-token': csrfToken(sessionId, csrfSecret),
            'idempotency-key': 'checkout-key-1'
          }
        : {}),
      ...options.headers
    },
    query: options.query ?? {},
    params: options.params ?? {},
    body: options.body
  }) as never;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('M8-WP03 Gateway commercial checkout boundary', () => {
  it('forces the direct customer catalog scope and forwards trusted Principal truth', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify([{ product: { productId: 'product_filing' }, prices: [] }]), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const routes = routesFor();

    const response = await route(
      routes,
      'GET',
      '/api/markreg/commercial/catalog'
    ).handle(
      request('GET', '/api/markreg/commercial/catalog', {
        query: { channel: 'MARKREG_WHITE_LABEL', relationshipModel: 'WHITE_LABEL' }
      })
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(
      'http://markreg.test/v1/commercial/catalog?channel=MARKREG_DIRECT&relationshipModel=DIRECT'
    );
    expect(init?.headers).toMatchObject({
      'x-markorbit-internal-authorization': internalServiceSecret,
      'x-markorbit-workspace-id': workspaceId
    });
    const encodedPrincipal = (init?.headers as Record<string, string>)['x-markorbit-principal'];
    expect(JSON.parse(Buffer.from(encodedPrincipal, 'base64url').toString('utf8'))).toMatchObject({
      schemaVersion: 1,
      principal: { userId: principal.userId, workspaceId }
    });
  });

  it('forwards checkout initiation and lookup without accepting browser monetary truth', async () => {
    const checkout = {
      checkoutSessionId: 'checkout_direct-1',
      workspaceId,
      orderId: 'order_direct-1',
      amount: { amountMinor: 29900, currency: 'USD' },
      status: 'INITIATED'
    };
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) =>
      new Response(JSON.stringify(checkout), {
        status: init?.method === 'POST' ? 201 : 200,
        headers: { 'content-type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const routes = routesFor();
    const body = {
      workspaceId,
      orderId: 'order_direct-1',
      productId: 'product_filing',
      expectedProductVersion: 1,
      priceId: 'price_direct-v1',
      expectedPriceVersion: 1
    };

    const created = await route(routes, 'POST', '/api/markreg/checkouts').handle(
      request('POST', '/api/markreg/checkouts', { body })
    );
    expect(created.status).toBe(201);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://markreg.test/v1/checkouts');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });
    expect((fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>)['idempotency-key']).toBe(
      'checkout-key-1'
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual(body);

    const read = await route(
      routes,
      'GET',
      '/api/markreg/checkouts/:checkoutSessionId'
    ).handle(
      request('GET', '/api/markreg/checkouts/checkout_direct-1', {
        params: { checkoutSessionId: 'checkout_direct-1' }
      })
    );
    expect(read.status).toBe(200);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'http://markreg.test/v1/checkouts/checkout_direct-1'
    );
  });

  it('requires Session, trusted Origin, CSRF, idempotency and order:update authority', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
      )
    );
    const body = {
      workspaceId,
      orderId: 'order_direct-1',
      productId: 'product_filing',
      expectedProductVersion: 1,
      priceId: 'price_direct-v1',
      expectedPriceVersion: 1
    };
    const mutation = route(routesFor(), 'POST', '/api/markreg/checkouts');

    await expect(
      mutation.handle(
        request('POST', '/api/markreg/checkouts', {
          body,
          headers: { cookie: '' }
        })
      )
    ).rejects.toMatchObject({ status: 401, code: 'AUTHENTICATION_REQUIRED' });
    await expect(
      mutation.handle(
        request('POST', '/api/markreg/checkouts', {
          body,
          headers: { origin: 'https://evil.example' }
        })
      )
    ).rejects.toMatchObject({ status: 403, code: 'UNTRUSTED_ORIGIN' });
    await expect(
      mutation.handle(
        request('POST', '/api/markreg/checkouts', {
          body,
          headers: { 'x-markorbit-csrf-token': 'invalid' }
        })
      )
    ).rejects.toMatchObject({ status: 403, code: 'INVALID_CSRF_TOKEN' });
    await expect(
      mutation.handle(
        request('POST', '/api/markreg/checkouts', {
          body,
          headers: { 'idempotency-key': '' }
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });

    const noUpdate = route(
      routesFor({ ...principal, permissions: ['order:read'] }),
      'POST',
      '/api/markreg/checkouts'
    );
    await expect(
      noUpdate.handle(request('POST', '/api/markreg/checkouts', { body }))
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
  });

  it('rejects browser attempts to author amount, currency or initiated user', async () => {
    const mutation = route(routesFor(), 'POST', '/api/markreg/checkouts');
    for (const spoofed of [
      { amountMinor: 1 },
      { amount: { amountMinor: 1, currency: 'USD' } },
      { currency: 'EUR' },
      { initiatedByUserId: 'forged-user' }
    ])
      await expect(
        mutation.handle(
          request('POST', '/api/markreg/checkouts', {
            body: {
              workspaceId,
              orderId: 'order_direct-1',
              productId: 'product_filing',
              expectedProductVersion: 1,
              priceId: 'price_direct-v1',
              expectedPriceVersion: 1,
              ...spoofed
            }
          })
        )
      ).rejects.toMatchObject({ status: 400, code: 'ACTOR_SPOOF_REJECTED' });
  });
});
