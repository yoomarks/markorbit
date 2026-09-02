import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthenticationError, type WorkspacePrincipal } from '@markorbit/contracts';
import type { CoreAuthenticationClient } from '../src/auth.js';
import { csrfToken } from '../src/auth.js';
import {
  createGatewayProductLoopRoutes,
  type GatewayProductLoopOptions
} from '../src/product-loop-http.js';

const workspaceId = '29292929-2929-4292-8292-292929292929';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 'session_ai_guide_gateway',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_ai_guide_gateway',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'matter:manage']
};

function auth(
  resolveWorkspace: CoreAuthenticationClient['resolveWorkspace'] = () => Promise.resolve(principal)
): CoreAuthenticationClient {
  return {
    issue: () => Promise.reject(new Error('issue is not expected in this test')),
    resolve: () => Promise.reject(new Error('resolve is not expected in this test')),
    resolveWorkspace,
    revoke: () => Promise.resolve()
  };
}

function options(
  authenticationClient: CoreAuthenticationClient = auth()
): GatewayProductLoopOptions {
  return {
    liteUrl: 'http://lite.test',
    authenticationClient,
    internalServiceSecret: 'ai-guide-gateway-internal-key-0123456789',
    csrfSecret: 'ai-guide-gateway-csrf-key-01234567890123',
    allowedOrigins: ['https://test.markorbit.local']
  };
}

function guideRoute(value = options()) {
  const routes = createGatewayProductLoopRoutes(value);
  const matches = routes.filter(
    (candidate) =>
      candidate.method === 'POST' &&
      candidate.path === '/api/lite/trademark-assets/:trademarkAssetId/ai-guide'
  );
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function headers(value = options(), extras: Record<string, string> = {}): Record<string, string> {
  return {
    cookie: 'mo_session=token',
    origin: 'https://test.markorbit.local',
    'x-markorbit-workspace-id': workspaceId,
    'x-markorbit-csrf-token': csrfToken(principal.sessionId, value.csrfSecret),
    ...extras
  };
}

function body() {
  return {
    expectedTrademarkAssetVersion: 7,
    requestedKinds: ['EXPLAIN_ASSET', 'PREPARE_OWNER_ACTION_CANDIDATE']
  };
}

function ownerResponse(
  status = 200,
  responseBody: unknown = { schemaVersion: 1, suggestions: [] }
) {
  return Promise.resolve(
    new Response(JSON.stringify(responseBody), {
      status,
      headers: { 'content-type': 'application/json' }
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Gateway Trademark Asset AI Guide advisory POST boundary', () => {
  it('registers once and forwards the exact bounded body and trusted context without replay authority', async () => {
    const value = options();
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://lite.test/v1/trademark-assets/trademark-asset_1/ai-guide');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual(body());
      const forwarded = init.headers as Record<string, string>;
      expect(forwarded['x-markorbit-internal-authorization']).toBe(value.internalServiceSecret);
      expect(forwarded['x-markorbit-workspace-id']).toBe(workspaceId);
      expect(forwarded['x-correlation-id']).toBe('correlation-ai-guide');
      expect(forwarded['x-request-id']).toBe('request-ai-guide');
      expect(forwarded).not.toHaveProperty('idempotency-key');
      expect(forwarded).not.toHaveProperty('cookie');
      const envelope = JSON.parse(
        Buffer.from(forwarded['x-markorbit-principal']!, 'base64url').toString('utf8')
      ) as { principal: WorkspacePrincipal };
      expect(envelope.principal).toMatchObject({
        userId: principal.userId,
        workspaceId: principal.workspaceId,
        membershipId: principal.membershipId
      });
      return ownerResponse(200, {
        schemaVersion: 1,
        workspaceId,
        trademarkAssetId: 'trademark-asset_1',
        suggestions: [],
        officialTruthCreatedByGuide: false,
        externalActionAuthorizedByGuide: false
      });
    });
    vi.stubGlobal('fetch', downstream);

    const result = await guideRoute(value).handle({
      method: 'POST',
      path: '/api/lite/trademark-assets/trademark-asset_1/ai-guide',
      params: { trademarkAssetId: 'trademark-asset_1' },
      query: {},
      headers: headers(value, {
        'x-correlation-id': 'correlation-ai-guide',
        'x-request-id': 'request-ai-guide',
        'idempotency-key': 'browser-key-must-not-forward'
      }),
      body: body()
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      officialTruthCreatedByGuide: false,
      externalActionAuthorizedByGuide: false
    });
    expect(downstream).toHaveBeenCalledTimes(1);
  });

  it('does not require an Idempotency-Key for the advisory POST', async () => {
    const value = options();
    const downstream = vi.fn(() => ownerResponse());
    vi.stubGlobal('fetch', downstream);

    const result = await guideRoute(value).handle({
      method: 'POST',
      path: '/api/lite/trademark-assets/trademark-asset_1/ai-guide',
      params: { trademarkAssetId: 'trademark-asset_1' },
      query: {},
      headers: headers(value),
      body: body()
    });

    expect(result.status).toBe(200);
    expect(downstream).toHaveBeenCalledTimes(1);
  });

  it('rejects missing browser session before Lite', async () => {
    const value = options();
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);

    await expect(
      guideRoute(value).handle({
        method: 'POST',
        path: '/api/lite/trademark-assets/trademark-asset_1/ai-guide',
        params: { trademarkAssetId: 'trademark-asset_1' },
        query: {},
        headers: {
          origin: 'https://test.markorbit.local',
          'x-markorbit-workspace-id': workspaceId,
          'x-markorbit-csrf-token': csrfToken(principal.sessionId, value.csrfSecret)
        },
        body: body()
      })
    ).rejects.toMatchObject({ status: 401, code: 'AUTHENTICATION_REQUIRED' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('rejects missing Workspace context and Core membership denial before Lite', async () => {
    const value = options();
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);

    await expect(
      guideRoute(value).handle({
        method: 'POST',
        path: '/api/lite/trademark-assets/trademark-asset_1/ai-guide',
        params: { trademarkAssetId: 'trademark-asset_1' },
        query: {},
        headers: {
          cookie: 'mo_session=token',
          origin: 'https://test.markorbit.local',
          'x-markorbit-csrf-token': csrfToken(principal.sessionId, value.csrfSecret)
        },
        body: body()
      })
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_WORKSPACE_CONTEXT' });

    const denied = options(
      auth(() =>
        Promise.reject(new AuthenticationError('MEMBERSHIP_REQUIRED', 'Membership is required.'))
      )
    );
    await expect(
      guideRoute(denied).handle({
        method: 'POST',
        path: '/api/lite/trademark-assets/trademark-asset_1/ai-guide',
        params: { trademarkAssetId: 'trademark-asset_1' },
        query: {},
        headers: headers(denied),
        body: body()
      })
    ).rejects.toMatchObject({ status: 403, code: 'MEMBERSHIP_REQUIRED' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('requires workspace:read before Lite', async () => {
    const restrictedPrincipal: WorkspacePrincipal = {
      ...principal,
      permissions: ['matter:manage']
    };
    const value = options(auth(() => Promise.resolve(restrictedPrincipal)));
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);

    await expect(
      guideRoute(value).handle({
        method: 'POST',
        path: '/api/lite/trademark-assets/trademark-asset_1/ai-guide',
        params: { trademarkAssetId: 'trademark-asset_1' },
        query: {},
        headers: headers(value),
        body: body()
      })
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('requires trusted Origin before Lite', async () => {
    const value = options();
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);

    for (const origin of [undefined, 'https://attacker.example']) {
      const requestHeaders = headers(value);
      if (origin) requestHeaders.origin = origin;
      else delete requestHeaders.origin;
      await expect(
        guideRoute(value).handle({
          method: 'POST',
          path: '/api/lite/trademark-assets/trademark-asset_1/ai-guide',
          params: { trademarkAssetId: 'trademark-asset_1' },
          query: {},
          headers: requestHeaders,
          body: body()
        })
      ).rejects.toMatchObject({ status: 403 });
    }
    expect(downstream).not.toHaveBeenCalled();
  });

  it('requires a valid CSRF token before Lite', async () => {
    const value = options();
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);

    for (const csrf of [undefined, 'invalid-csrf']) {
      const requestHeaders = headers(value);
      if (csrf) requestHeaders['x-markorbit-csrf-token'] = csrf;
      else delete requestHeaders['x-markorbit-csrf-token'];
      await expect(
        guideRoute(value).handle({
          method: 'POST',
          path: '/api/lite/trademark-assets/trademark-asset_1/ai-guide',
          params: { trademarkAssetId: 'trademark-asset_1' },
          query: {},
          headers: requestHeaders,
          body: body()
        })
      ).rejects.toMatchObject({ status: 403, code: 'INVALID_CSRF_TOKEN' });
    }
    expect(downstream).not.toHaveBeenCalled();
  });

  it('rejects browser actor identity and unsupported context fields before Lite', async () => {
    const value = options();
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);

    await expect(
      guideRoute(value).handle({
        method: 'POST',
        path: '/api/lite/trademark-assets/trademark-asset_1/ai-guide',
        params: { trademarkAssetId: 'trademark-asset_1' },
        query: {},
        headers: headers(value),
        body: { ...body(), subjectUserId: 'attacker' }
      })
    ).rejects.toMatchObject({ status: 400, code: 'ACTOR_SPOOF_REJECTED' });

    await expect(
      guideRoute(value).handle({
        method: 'POST',
        path: '/api/lite/trademark-assets/trademark-asset_1/ai-guide',
        params: { trademarkAssetId: 'trademark-asset_1' },
        query: {},
        headers: headers(value),
        body: { ...body(), workspaceId }
      })
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it.each([400, 404, 409, 503])('preserves owner %s status and body', async (status) => {
    const value = options();
    const responseBody = {
      code: `OWNER_${status}`,
      detail: 'owner result must remain visible'
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ownerResponse(status, responseBody))
    );

    const result = await guideRoute(value).handle({
      method: 'POST',
      path: '/api/lite/trademark-assets/trademark-asset_1/ai-guide',
      params: { trademarkAssetId: 'trademark-asset_1' },
      query: {},
      headers: headers(value),
      body: body()
    });

    expect(result.status).toBe(status);
    expect(result.body).toEqual(responseBody);
  });

  it('maps Lite transport failure to retryable DOWNSTREAM_UNAVAILABLE 503', async () => {
    const value = options();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network unavailable')))
    );

    await expect(
      guideRoute(value).handle({
        method: 'POST',
        path: '/api/lite/trademark-assets/trademark-asset_1/ai-guide',
        params: { trademarkAssetId: 'trademark-asset_1' },
        query: {},
        headers: headers(value),
        body: body()
      })
    ).rejects.toMatchObject({
      status: 503,
      code: 'DOWNSTREAM_UNAVAILABLE',
      retryable: true
    });
  });

  it('keeps durable Product Loop POST idempotency requirements unchanged', async () => {
    const value = options();
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    const durable = createGatewayProductLoopRoutes(value).find(
      (candidate) =>
        candidate.method === 'POST' &&
        candidate.path === '/api/lite/trademark-assets/:trademarkAssetId/commerce-profile'
    );
    expect(durable).toBeDefined();

    await expect(
      durable!.handle({
        method: 'POST',
        path: '/api/lite/trademark-assets/trademark-asset_1/commerce-profile',
        params: { trademarkAssetId: 'trademark-asset_1' },
        query: {},
        headers: headers(value),
        body: { expectedTrademarkAssetVersion: 7 }
      })
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('keeps GET routes free of Origin, CSRF and idempotency requirements', async () => {
    const value = options();
    const downstream = vi.fn(() => ownerResponse(200, { schemaVersion: 1, items: [] }));
    vi.stubGlobal('fetch', downstream);
    const read = createGatewayProductLoopRoutes(value).find(
      (candidate) => candidate.method === 'GET' && candidate.path === '/api/lite/today'
    );
    expect(read).toBeDefined();

    const result = await read!.handle({
      method: 'GET',
      path: '/api/lite/today',
      params: {},
      query: {},
      headers: {
        cookie: 'mo_session=token',
        'x-markorbit-workspace-id': workspaceId
      },
      body: undefined
    });

    expect(result.status).toBe(200);
    expect(downstream).toHaveBeenCalledTimes(1);
  });
});
