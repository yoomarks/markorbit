import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayProductLoopRoutes } from '../src/product-loop-http.js';

const workspaceId = '38383838-3838-4383-8383-383838383838';
const otherWorkspaceId = '39393939-3939-4393-8393-393939393939';
const contentOpportunityId = 'content-opportunity_373';
const listPath = '/api/lite/content-studio/works';
const detailPath = `${listPath}/:contentOpportunityId`;
const liteWorkUrl = `http://lite.test/v1/content-studio/works/${contentOpportunityId}`;
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 'session_integration_373',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_integration_373',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read']
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
  internalServiceSecret: 'integration-373-internal-key-0123456789',
  csrfSecret: 'integration-373-csrf-key-01234567890123',
  allowedOrigins: ['https://test.markorbit.local']
};

function route(path: string) {
  const value = createGatewayProductLoopRoutes(options).find(
    (candidate) => candidate.method === 'GET' && candidate.path === path
  );
  if (!value) throw new Error(`GET ${path} route missing`);
  return value;
}

function request(
  path: string,
  headers: Record<string, string>,
  query: Record<string, string> = {},
  params: Record<string, string> = {}
) {
  return { method: 'GET' as const, path, params, query, headers, body: undefined };
}

function jsonResponse(status: number, body: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' }
    })
  );
}

function sessionHeaders(targetWorkspaceId = workspaceId): Record<string, string> {
  return {
    cookie: 'mo_session=token-373',
    'x-markorbit-workspace-id': targetWorkspaceId
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Gateway Content Studio authenticated read boundary', () => {
  it('forwards list pagination, Principal, Workspace, correlation, and request IDs', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://lite.test/v1/content-studio/works?limit=25&after=next%2Fpage');
      expect(init.method).toBe('GET');
      expect(init.body).toBeUndefined();
      const headers = init.headers as Record<string, string>;
      expect(headers['x-markorbit-internal-authorization']).toBe(
        'integration-373-internal-key-0123456789'
      );
      expect(headers['x-markorbit-workspace-id']).toBe(workspaceId);
      expect(headers['x-correlation-id']).toBe('correlation-373');
      expect(headers['x-request-id']).toBe('request-373');
      const encodedPrincipal = headers['x-markorbit-principal'];
      const envelope = JSON.parse(Buffer.from(encodedPrincipal!, 'base64url').toString('utf8')) as {
        principal: WorkspacePrincipal;
      };
      expect(envelope.principal).toMatchObject({
        userId: principal.userId,
        workspaceId,
        membershipId: principal.membershipId
      });
      return jsonResponse(200, {
        schemaVersion: 1,
        workspaceId,
        items: [{ contentOpportunity: { id: contentOpportunityId, version: 1 } }],
        nextAfter: 'next/page',
        partial: true,
        warnings: ['VISUAL_HISTORY_NOT_DISCOVERABLE']
      });
    });
    vi.stubGlobal('fetch', downstream);
    const headers = {
      ...sessionHeaders(),
      'x-correlation-id': 'correlation-373',
      'x-request-id': 'request-373'
    };
    const result = await route(listPath).handle(
      request(listPath, headers, { limit: '25', after: 'next/page' })
    );

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      workspaceId,
      nextAfter: 'next/page',
      partial: true,
      warnings: ['VISUAL_HISTORY_NOT_DISCOVERABLE']
    });
    expect(resolveWorkspace).toHaveBeenCalledWith('token-373', workspaceId, 'correlation-373');
  });

  it('forwards Content Studio detail as a pure authenticated read', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe(liteWorkUrl);
      expect(init.method).toBe('GET');
      expect(init.body).toBeUndefined();
      return jsonResponse(200, {
        schemaVersion: 1,
        workspaceId,
        opportunity: { contentOpportunityId },
        drafts: [],
        reviewedDrafts: [],
        reviews: [],
        publishPackages: [],
        feedback: [],
        partial: true,
        warnings: ['VISUAL_HISTORY_NOT_DISCOVERABLE']
      });
    });
    vi.stubGlobal('fetch', downstream);
    const result = await route(detailPath).handle(
      request(
        `/api/lite/content-studio/works/${contentOpportunityId}`,
        sessionHeaders(),
        {},
        { contentOpportunityId }
      )
    );

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      workspaceId,
      opportunity: { contentOpportunityId },
      partial: true
    });
  });

  it('requires a Core session before Content Studio downstream access', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    await expect(
      route(listPath).handle(request(listPath, { 'x-markorbit-workspace-id': workspaceId }))
    ).rejects.toMatchObject({ status: 401, code: 'AUTHENTICATION_REQUIRED' });
    expect(resolveWorkspace).not.toHaveBeenCalled();
    expect(downstream).not.toHaveBeenCalled();
  });

  it('requires exact Workspace context before Content Studio downstream access', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    await expect(
      route(listPath).handle(request(listPath, { cookie: 'mo_session=token-373' }))
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_WORKSPACE_CONTEXT' });
    expect(resolveWorkspace).not.toHaveBeenCalled();
    expect(downstream).not.toHaveBeenCalled();
  });

  it('requires workspace:read before Content Studio downstream access', async () => {
    resolveWorkspace.mockResolvedValueOnce({ ...principal, permissions: [] });
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    await expect(route(listPath).handle(request(listPath, sessionHeaders()))).rejects.toMatchObject(
      {
        status: 403,
        code: 'PERMISSION_DENIED'
      }
    );
    expect(downstream).not.toHaveBeenCalled();
  });

  it('preserves owner-service 400, 403, 404, and 503 status/body semantics', async () => {
    for (const status of [400, 403, 404, 503]) {
      const body = { code: `LITE_${status}`, marker: `status-${status}` };
      vi.stubGlobal(
        'fetch',
        vi.fn(() => jsonResponse(status, body))
      );
      const result = await route(detailPath).handle(
        request(
          `/api/lite/content-studio/works/${contentOpportunityId}`,
          sessionHeaders(),
          {},
          { contentOpportunityId }
        )
      );
      expect(result.status).toBe(status);
      expect(result.body).toEqual(body);
    }
  });

  it('preserves owner-service 404 isolation for work in another Workspace', async () => {
    resolveWorkspace.mockResolvedValueOnce({ ...principal, workspaceId: otherWorkspaceId });
    const downstream = vi.fn((_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      expect(headers['x-markorbit-workspace-id']).toBe(otherWorkspaceId);
      return jsonResponse(404, { code: 'CONTENT_WORK_NOT_FOUND' });
    });
    vi.stubGlobal('fetch', downstream);
    const result = await route(detailPath).handle(
      request(
        `/api/lite/content-studio/works/${contentOpportunityId}`,
        sessionHeaders(otherWorkspaceId),
        {},
        { contentOpportunityId }
      )
    );

    expect(resolveWorkspace).toHaveBeenCalledWith('token-373', otherWorkspaceId, undefined);
    expect(result.status).toBe(404);
    expect(result.body).toEqual({ code: 'CONTENT_WORK_NOT_FOUND' });
  });

  it('turns Lite transport failure into 503 without fabricating an empty result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('Lite offline')))
    );
    await expect(route(listPath).handle(request(listPath, sessionHeaders()))).rejects.toMatchObject(
      {
        status: 503,
        code: 'DOWNSTREAM_UNAVAILABLE'
      }
    );
  });

  it('registers only the two requested Content Studio read routes', () => {
    const studioRoutes = createGatewayProductLoopRoutes(options)
      .filter((candidate) => candidate.path.startsWith(listPath))
      .map((candidate) => `${candidate.method} ${candidate.path}`);
    expect(studioRoutes).toEqual([`GET ${listPath}`, `GET ${detailPath}`]);
  });
});
