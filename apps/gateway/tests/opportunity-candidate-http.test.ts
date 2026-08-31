import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayProductLoopRoutes } from '../src/product-loop-http.js';

const workspaceId = '36363636-3636-4363-8363-363636363636';
const otherWorkspaceId = '37373737-3737-4373-8373-373737373737';
const candidateId = 'opportunity-candidate_366';
const listPath = '/api/lite/opportunity-candidates';
const detailPath = '/api/lite/opportunity-candidates/:opportunityCandidateId';
const qualificationPath = `${detailPath}/qualification`;
const liteCandidateUrl = `http://lite.test/v1/opportunity-candidates/${candidateId}`;
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 'session_integration_366',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_integration_366',
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
  internalServiceSecret: 'integration-366-internal-key-0123456789',
  csrfSecret: 'integration-366-csrf-key-01234567890123',
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
    cookie: 'mo_session=token-366',
    'x-markorbit-workspace-id': targetWorkspaceId
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Gateway Opportunity Candidate authenticated read boundary', () => {
  it('forwards list pagination, Principal, Workspace, correlation, and request IDs', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe('http://lite.test/v1/opportunity-candidates?limit=25&cursor=next%2Fpage');
      expect(init.method).toBe('GET');
      expect(init.body).toBeUndefined();
      const headers = init.headers as Record<string, string>;
      expect(headers['x-markorbit-internal-authorization']).toBe(
        'integration-366-internal-key-0123456789'
      );
      expect(headers['x-markorbit-workspace-id']).toBe(workspaceId);
      expect(headers['x-correlation-id']).toBe('correlation-366');
      expect(headers['x-request-id']).toBe('request-366');
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
        items: [{ opportunityCandidateId: candidateId }],
        nextCursor: 'next/page'
      });
    });
    vi.stubGlobal('fetch', downstream);
    const headers = {
      ...sessionHeaders(),
      'x-correlation-id': 'correlation-366',
      'x-request-id': 'request-366'
    };
    const result = await route(listPath).handle(
      request(listPath, headers, { limit: '25', cursor: 'next/page' })
    );

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ workspaceId, nextCursor: 'next/page' });
    expect(resolveWorkspace).toHaveBeenCalledWith('token-366', workspaceId, 'correlation-366');
  });

  it('forwards Candidate detail as a pure authenticated read', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe(liteCandidateUrl);
      expect(init.method).toBe('GET');
      expect(init.body).toBeUndefined();
      return jsonResponse(200, {
        schemaVersion: 1,
        workspaceId,
        opportunityCandidateId: candidateId
      });
    });
    vi.stubGlobal('fetch', downstream);
    const result = await route(detailPath).handle(
      request(
        `/api/lite/opportunity-candidates/${candidateId}`,
        sessionHeaders(),
        {},
        { opportunityCandidateId: candidateId }
      )
    );

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ workspaceId, opportunityCandidateId: candidateId });
  });

  it('forwards Candidate Qualification as a pure authenticated read', async () => {
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe(`${liteCandidateUrl}/qualification`);
      expect(init.method).toBe('GET');
      expect(init.body).toBeUndefined();
      return jsonResponse(200, {
        schemaVersion: 1,
        workspaceId,
        opportunityCandidateId: candidateId,
        qualification: { status: 'QUALIFIED' }
      });
    });
    vi.stubGlobal('fetch', downstream);
    const result = await route(qualificationPath).handle(
      request(
        `/api/lite/opportunity-candidates/${candidateId}/qualification`,
        sessionHeaders(),
        {},
        { opportunityCandidateId: candidateId }
      )
    );

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      workspaceId,
      opportunityCandidateId: candidateId,
      qualification: { status: 'QUALIFIED' }
    });
  });

  it('requires a Core session before Candidate downstream access', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    await expect(
      route(listPath).handle(request(listPath, { 'x-markorbit-workspace-id': workspaceId }))
    ).rejects.toMatchObject({ status: 401, code: 'AUTHENTICATION_REQUIRED' });
    expect(resolveWorkspace).not.toHaveBeenCalled();
    expect(downstream).not.toHaveBeenCalled();
  });

  it('requires exact Workspace context before Candidate downstream access', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    await expect(
      route(listPath).handle(request(listPath, { cookie: 'mo_session=token-366' }))
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_WORKSPACE_CONTEXT' });
    expect(resolveWorkspace).not.toHaveBeenCalled();
    expect(downstream).not.toHaveBeenCalled();
  });

  it('requires workspace:read before Candidate downstream access', async () => {
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
          `/api/lite/opportunity-candidates/${candidateId}`,
          sessionHeaders(),
          {},
          { opportunityCandidateId: candidateId }
        )
      );
      expect(result.status).toBe(status);
      expect(result.body).toEqual(body);
    }
  });

  it('preserves owner-service 404 isolation for a Candidate in another Workspace', async () => {
    resolveWorkspace.mockResolvedValueOnce({ ...principal, workspaceId: otherWorkspaceId });
    const downstream = vi.fn((_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      expect(headers['x-markorbit-workspace-id']).toBe(otherWorkspaceId);
      return jsonResponse(404, { code: 'OPPORTUNITY_CANDIDATE_NOT_FOUND' });
    });
    vi.stubGlobal('fetch', downstream);
    const result = await route(detailPath).handle(
      request(
        `/api/lite/opportunity-candidates/${candidateId}`,
        sessionHeaders(otherWorkspaceId),
        {},
        { opportunityCandidateId: candidateId }
      )
    );

    expect(resolveWorkspace).toHaveBeenCalledWith('token-366', otherWorkspaceId, undefined);
    expect(result.status).toBe(404);
    expect(result.body).toEqual({ code: 'OPPORTUNITY_CANDIDATE_NOT_FOUND' });
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

  it('registers only the three requested Opportunity Candidate read routes', () => {
    const candidateRoutes = createGatewayProductLoopRoutes(options)
      .filter((candidate) => candidate.path.startsWith(listPath))
      .map((candidate) => `${candidate.method} ${candidate.path}`);
    expect(candidateRoutes).toEqual([
      `GET ${listPath}`,
      `GET ${detailPath}`,
      `GET ${qualificationPath}`
    ]);
  });
});
