import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import { csrfToken, type CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayProductLoopRoutes } from '../src/product-loop-http.js';

const workspaceId = '38383838-3838-4383-8383-383838383838';
const otherWorkspaceId = '39393939-3939-4393-8393-393939393939';
const trademarkAssetId = 'trademark-asset_363';
const routePath = '/api/lite/trademark-assets/:trademarkAssetId/commerce-profile';
const requestPath = `/api/lite/trademark-assets/${trademarkAssetId}/commerce-profile`;
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 'session_integration_363',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_integration_363',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'matter:manage']
};
const resolveWorkspace = vi.fn(() => Promise.resolve(principal));
const auth: CoreAuthenticationClient = {
  issue: () => Promise.reject(new Error('issue is not expected in this test')),
  resolve: () => Promise.reject(new Error('resolve is not expected in this test')),
  resolveWorkspace,
  revoke: () => Promise.resolve()
};
const options = {
  liteUrl: 'http://lite.test',
  authenticationClient: auth,
  internalServiceSecret: 'integration-363-internal-key-0123456789',
  csrfSecret: 'integration-363-csrf-key-01234567890123',
  allowedOrigins: ['https://test.markorbit.local']
};
const commerceBody = {
  expectedTrademarkAssetVersion: 3,
  expectedCommerceProfileVersion: 2,
  headline: 'Available for licensing'
};

function commerceRoute() {
  const value = createGatewayProductLoopRoutes(options).find(
    (candidate) => candidate.method === 'POST' && candidate.path === routePath
  );
  if (!value) throw new Error(`POST ${routePath} route missing`);
  return value;
}

function validHeaders(): Record<string, string> {
  return {
    cookie: 'mo_session=token-363',
    origin: 'https://test.markorbit.local',
    'x-markorbit-workspace-id': workspaceId,
    'x-markorbit-csrf-token': csrfToken(principal.sessionId, options.csrfSecret),
    'idempotency-key': 'commerce-363'
  };
}

function request(headers: Record<string, string>, body: Record<string, unknown> = commerceBody) {
  return {
    method: 'POST' as const,
    path: requestPath,
    params: { trademarkAssetId },
    query: {},
    headers,
    body
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

describe('Gateway Trademark Asset Commerce mutation boundary', () => {
  it('forwards the authenticated mutation with trusted Principal, tracing and idempotency', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe(`http://lite.test/v1/trademark-assets/${trademarkAssetId}/commerce-profile`);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual(commerceBody);
      const headers = init.headers as Record<string, string>;
      expect(headers['x-markorbit-internal-authorization']).toBe(
        'integration-363-internal-key-0123456789'
      );
      expect(headers['x-markorbit-workspace-id']).toBe(workspaceId);
      expect(headers['x-correlation-id']).toBe('correlation-363');
      expect(headers['x-request-id']).toBe('request-363');
      expect(headers['idempotency-key']).toBe('commerce-363');
      const envelope = JSON.parse(
        Buffer.from(headers['x-markorbit-principal']!, 'base64url').toString('utf8')
      ) as { principal: WorkspacePrincipal };
      expect(envelope.principal).toMatchObject({
        userId: principal.userId,
        workspaceId,
        membershipId: principal.membershipId
      });
      return jsonResponse(200, {
        commerceProfile: {
          trademarkAssetId,
          workspaceId,
          version: 3
        }
      });
    });
    vi.stubGlobal('fetch', downstream);
    const headers = {
      ...validHeaders(),
      'x-correlation-id': 'correlation-363',
      'x-request-id': 'request-363'
    };
    const result = await commerceRoute().handle(request(headers));

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ commerceProfile: { trademarkAssetId, workspaceId } });
    expect(resolveWorkspace).toHaveBeenCalledWith('token-363', workspaceId, 'correlation-363');
  });

  it('requires a Core session before any Commerce mutation', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    const headers = validHeaders();
    delete headers.cookie;

    await expect(commerceRoute().handle(request(headers))).rejects.toMatchObject({
      status: 401,
      code: 'AUTHENTICATION_REQUIRED'
    });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('rejects a conflicting body Workspace before downstream access', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);

    await expect(
      commerceRoute().handle(
        request(validHeaders(), { ...commerceBody, workspaceId: otherWorkspaceId })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_WORKSPACE_CONTEXT' });
    expect(resolveWorkspace).not.toHaveBeenCalled();
    expect(downstream).not.toHaveBeenCalled();
  });

  it('rejects a missing or untrusted mutation origin', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    for (const origin of [undefined, 'https://attacker.example']) {
      const headers = validHeaders();
      if (origin === undefined) delete headers.origin;
      else headers.origin = origin;
      await expect(commerceRoute().handle(request(headers))).rejects.toMatchObject({
        status: 403,
        code: 'UNTRUSTED_ORIGIN'
      });
    }
    expect(downstream).not.toHaveBeenCalled();
  });

  it('rejects a missing or invalid CSRF token', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    for (const supplied of [undefined, 'invalid-csrf-token']) {
      const headers = validHeaders();
      if (supplied === undefined) delete headers['x-markorbit-csrf-token'];
      else headers['x-markorbit-csrf-token'] = supplied;
      await expect(commerceRoute().handle(request(headers))).rejects.toMatchObject({
        status: 403,
        code: 'INVALID_CSRF_TOKEN'
      });
    }
    expect(downstream).not.toHaveBeenCalled();
  });

  it('requires Idempotency-Key before downstream access', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    const headers = validHeaders();
    delete headers['idempotency-key'];

    await expect(commerceRoute().handle(request(headers))).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_REQUEST'
    });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('requires matter:manage before downstream access', async () => {
    resolveWorkspace.mockResolvedValueOnce({ ...principal, permissions: ['workspace:read'] });
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);

    await expect(commerceRoute().handle(request(validHeaders()))).rejects.toMatchObject({
      status: 403,
      code: 'PERMISSION_DENIED'
    });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('rejects client actor spoof fields before resolving the Workspace Principal', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);

    await expect(
      commerceRoute().handle(request(validHeaders(), { ...commerceBody, actorId: 'attacker' }))
    ).rejects.toMatchObject({ status: 400, code: 'ACTOR_SPOOF_REJECTED' });
    expect(resolveWorkspace).not.toHaveBeenCalled();
    expect(downstream).not.toHaveBeenCalled();
  });

  it('preserves downstream Commerce version or read-only conflict semantics', async () => {
    const body = {
      code: 'TRADEMARK_ASSET_COMMERCE_CONFLICT',
      message: 'Commerce Profile version is stale.'
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => jsonResponse(409, body))
    );

    const result = await commerceRoute().handle(request(validHeaders()));
    expect(result.status).toBe(409);
    expect(result.body).toEqual(body);
  });

  it('turns Lite transport failure into 503 without retry or overwrite', async () => {
    const downstream = vi.fn(() => Promise.reject(new Error('Lite offline')));
    vi.stubGlobal('fetch', downstream);

    await expect(commerceRoute().handle(request(validHeaders()))).rejects.toMatchObject({
      status: 503,
      code: 'DOWNSTREAM_UNAVAILABLE'
    });
    expect(downstream).toHaveBeenCalledTimes(1);
  });
});
