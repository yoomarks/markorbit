import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import { csrfToken, type CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayProductLoopRoutes } from '../src/product-loop-http.js';

const workspaceId = '51515151-5151-4515-8515-515151515151';
const trademarkAssetId = 'trademark-asset_651';
const routePath = '/api/lite/trademark-assets/:trademarkAssetId/management-dispositions';
const requestPath = `/api/lite/trademark-assets/${trademarkAssetId}/management-dispositions`;
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 'session_integration_651',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_integration_651',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'matter:manage']
};
const resolveWorkspace = vi.fn(() => Promise.resolve(principal));
const auth: CoreAuthenticationClient = {
  issue: () => Promise.reject(new Error('issue is not expected')),
  resolve: () => Promise.reject(new Error('resolve is not expected')),
  resolveWorkspace,
  revoke: () => Promise.resolve()
};
const options = {
  liteUrl: 'http://lite.test',
  authenticationClient: auth,
  internalServiceSecret: 'integration-651-internal-key-0123456789',
  csrfSecret: 'integration-651-csrf-key-01234567890123',
  allowedOrigins: ['https://test.markorbit.local']
};
const dispositionBody = {
  expectedTrademarkAssetVersion: 7,
  managementSignal: { id: 'trademark-asset-management-signal_651', version: 3 },
  recommendation: { id: 'trademark-asset-management-recommendation_651', version: 2 },
  kind: 'DISMISSED',
  note: 'Not actionable now.'
};

function routes() {
  return createGatewayProductLoopRoutes(options).filter((route) => route.path === routePath);
}

function route(method: 'GET' | 'POST') {
  const match = routes().find((candidate) => candidate.method === method);
  if (!match) throw new Error(`${method} ${routePath} route missing`);
  return match;
}

function headers(): Record<string, string> {
  return {
    cookie: 'mo_session=token-651',
    origin: 'https://test.markorbit.local',
    'x-markorbit-workspace-id': workspaceId,
    'x-markorbit-csrf-token': csrfToken(principal.sessionId, options.csrfSecret),
    'idempotency-key': 'disposition-651',
    'x-correlation-id': 'correlation-651',
    'x-request-id': 'request-651'
  };
}

function request(
  method: 'GET' | 'POST',
  requestHeaders: Record<string, string> = headers(),
  body: unknown = dispositionBody
) {
  return {
    method,
    path: requestPath,
    params: { trademarkAssetId },
    query: {},
    headers: requestHeaders,
    body: method === 'POST' ? body : undefined
  };
}

function jsonResponse(status: number, body: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' }
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Gateway Trademark Asset management disposition boundary', () => {
  it('registers exactly one GET and one POST route', () => {
    expect(
      routes()
        .map((candidate) => candidate.method)
        .sort()
    ).toEqual(['GET', 'POST']);
  });

  it('forwards GET as an authenticated read without CSRF or idempotency requirements', async () => {
    const projection = {
      schemaVersion: 1,
      workspaceId,
      asset: { id: trademarkAssetId, version: 7 },
      items: [
        {
          signal: { id: 'trademark-asset-management-signal_651', version: 3 },
          disposition: { ...dispositionBody, kind: 'RESOLVED_BY_WORKFLOW_REFERENCE' }
        }
      ]
    };
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe(
        `http://lite.test/v1/trademark-assets/${trademarkAssetId}/management-dispositions`
      );
      expect(init.method).toBe('GET');
      expect(init.body).toBeUndefined();
      const forwarded = init.headers as Record<string, string>;
      expect(forwarded['x-markorbit-workspace-id']).toBe(workspaceId);
      expect(forwarded['x-markorbit-internal-authorization']).toBe(options.internalServiceSecret);
      expect(forwarded['idempotency-key']).toBeUndefined();
      return jsonResponse(200, projection);
    });
    vi.stubGlobal('fetch', downstream);
    const readHeaders = headers();
    delete readHeaders.origin;
    delete readHeaders['x-markorbit-csrf-token'];
    delete readHeaders['idempotency-key'];

    const result = await route('GET').handle(request('GET', readHeaders));
    expect(result).toEqual({ status: 200, body: projection });
  });

  it('forwards POST through durable mutation security with exact body and idempotency', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe(
        `http://lite.test/v1/trademark-assets/${trademarkAssetId}/management-dispositions`
      );
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual(dispositionBody);
      const forwarded = init.headers as Record<string, string>;
      expect(forwarded['idempotency-key']).toBe('disposition-651');
      expect(forwarded['x-correlation-id']).toBe('correlation-651');
      expect(forwarded['x-request-id']).toBe('request-651');
      return jsonResponse(200, {
        dispositionId: 'trademark-asset-management-disposition_651'
      });
    });
    vi.stubGlobal('fetch', downstream);

    expect(await route('POST').handle(request('POST'))).toMatchObject({ status: 200 });
  });

  it('requires session, trusted origin, CSRF, idempotency and matter:manage before POST reaches Lite', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);

    const noSession = headers();
    delete noSession.cookie;
    await expect(route('POST').handle(request('POST', noSession))).rejects.toMatchObject({
      status: 401,
      code: 'AUTHENTICATION_REQUIRED'
    });

    const noOrigin = headers();
    delete noOrigin.origin;
    await expect(route('POST').handle(request('POST', noOrigin))).rejects.toMatchObject({
      status: 403,
      code: 'UNTRUSTED_ORIGIN'
    });

    const noCsrf = headers();
    delete noCsrf['x-markorbit-csrf-token'];
    await expect(route('POST').handle(request('POST', noCsrf))).rejects.toMatchObject({
      status: 403,
      code: 'INVALID_CSRF_TOKEN'
    });

    const noIdempotency = headers();
    delete noIdempotency['idempotency-key'];
    await expect(route('POST').handle(request('POST', noIdempotency))).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_REQUEST'
    });

    resolveWorkspace.mockResolvedValueOnce({ ...principal, permissions: ['workspace:read'] });
    await expect(route('POST').handle(request('POST'))).rejects.toMatchObject({
      status: 403,
      code: 'PERMISSION_DENIED'
    });
    expect(downstream).not.toHaveBeenCalled();
  });

  it.each([
    ['workspaceId', workspaceId],
    ['subjectUserId', principal.userId],
    ['workflowReference', { kind: 'ORDER', owner: 'MARKREG', referenceId: 'order_1' }],
    ['source', { owner: 'browser' }],
    ['authority', { filingAuthorized: true }]
  ])('rejects caller-supplied %s authority before Lite', async (field, value) => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    await expect(
      route('POST').handle(request('POST', headers(), { ...dispositionBody, [field]: value }))
    ).rejects.toMatchObject({ status: 400, code: 'ACTOR_SPOOF_REJECTED' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('preserves owner error status/body and converts transport failure to retryable 503', async () => {
    const ownerFailure = { code: 'VERSION_CONFLICT', message: 'Signal version is stale.' };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => jsonResponse(409, ownerFailure))
    );
    expect(await route('POST').handle(request('POST'))).toEqual({
      status: 409,
      body: ownerFailure
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('Lite offline')))
    );
    await expect(route('GET').handle(request('GET'))).rejects.toMatchObject({
      status: 503,
      code: 'DOWNSTREAM_UNAVAILABLE',
      retryable: true
    });
  });
});
