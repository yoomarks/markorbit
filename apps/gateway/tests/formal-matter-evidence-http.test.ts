import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthenticationError, type WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import type { CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayMarkRegEarlyFunnelRoutes } from '../src/markreg-early-funnel-http.js';

const workspaceId = '018f0000-0000-7000-8000-000000000472';
const otherWorkspaceId = '018f0000-0000-7000-8000-000000000473';
const formalMatterId = 'formal-matter_472';
const routePath = '/api/markreg/formal-matters/:formalMatterId/evidence';
const browserPath = `/api/markreg/formal-matters/${formalMatterId}/evidence`;
const internalServiceSecret = 'integration-472-internal-secret-012345';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: '018f0000-0000-7000-8000-000000000474',
  sessionId: '018f0000-0000-7000-8000-000000000475',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: '018f0000-0000-7000-8000-000000000476',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'matter:read']
};

function client(overrides: Partial<CoreAuthenticationClient> = {}): CoreAuthenticationClient {
  return {
    issue: () => Promise.reject(new Error('issue is not expected')),
    resolve: () => Promise.reject(new Error('resolve is not expected')),
    resolveWorkspace: () => Promise.resolve(principal),
    revoke: () => Promise.resolve(),
    ...overrides
  };
}

function route(authenticationClient: CoreAuthenticationClient = client()) {
  const value = createGatewayMarkRegEarlyFunnelRoutes({
    markRegUrl: 'http://markreg.test',
    authenticationClient,
    internalServiceSecret,
    csrfSecret: 'integration-472-unused-csrf-secret',
    allowedOrigins: []
  }).find((candidate) => candidate.method === 'GET' && candidate.path === routePath);
  if (!value) throw new Error(`GET ${routePath} route missing`);
  return value;
}

function request(
  headers: Record<string, string> = {},
  query: Record<string, string> = {}
): JsonRequest {
  return {
    method: 'GET',
    path: browserPath,
    body: undefined,
    params: { formalMatterId },
    query,
    headers: {
      cookie: 'mo_session=token-472',
      'x-markorbit-workspace-id': workspaceId,
      'x-correlation-id': 'correlation-472',
      'x-request-id': 'request-472',
      ...headers
    }
  };
}

function response(status: number, body: unknown): Promise<Response> {
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

// prettier-ignore
describe('Gateway governed Formal Matter Evidence read', () => {
  it('forwards exact matter identity, bounded intelligence query and trusted Workspace Principal', async () => {
    const projection = {
      schemaVersion: 1,
      workspaceId,
      formalMatter: { id: formalMatterId, version: 7, snapshotSha256: 'a'.repeat(64) },
      documentPackages: [],
      lifecycle: { officialStatusVerified: false },
      intelligence: { total: 0, items: [] },
      authorityConsequences: {
        filingAuthorized: false,
        paymentAuthorized: false,
        providerContactAuthorized: false,
        officialTruthCreated: false
      }
    };
    const downstream = vi.fn((url: string, init: RequestInit) => {
      expect(url).toBe(
        `http://markreg.test/internal/v1/formal-matters/${formalMatterId}/evidence?page=2&pageSize=10&reviewHistoryLimit=4`
      );
      expect(init.method).toBe('GET');
      expect(init.body).toBeUndefined();
      const headers = init.headers as Record<string, string>;
      expect(headers['x-markorbit-internal-authorization']).toBe(internalServiceSecret);
      expect(headers['x-markorbit-workspace-id']).toBe(workspaceId);
      expect(headers['x-correlation-id']).toBe('correlation-472');
      expect(headers['x-request-id']).toBe('request-472');
      const envelope = JSON.parse(
        Buffer.from(headers['x-markorbit-principal']!, 'base64url').toString('utf8')
      ) as { principal: WorkspacePrincipal };
      expect(envelope.principal).toMatchObject({
        userId: principal.userId,
        workspaceId,
        membershipId: principal.membershipId
      });
      return response(200, projection);
    });
    vi.stubGlobal('fetch', downstream);

    const result = await route().handle(
      request({}, { page: '2', pageSize: '10', reviewHistoryLimit: '4', ignored: 'not-forwarded' })
    );

    expect(result.status).toBe(200);
    expect(result.body).toEqual(projection);
    expect(downstream).toHaveBeenCalledTimes(1);
  });

  it('fails closed when Core denies current Workspace membership', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    const denied = client({
      resolveWorkspace: (_token, requestedWorkspaceId) => {
        expect(requestedWorkspaceId).toBe(otherWorkspaceId);
        return Promise.reject(
          new AuthenticationError('MEMBERSHIP_REQUIRED', 'Workspace membership is required.')
        );
      }
    });
    await expect(
      route(denied).handle(request({ 'x-markorbit-workspace-id': otherWorkspaceId }))
    ).rejects.toMatchObject({ status: 403, code: 'MEMBERSHIP_REQUIRED' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('requires workspace:read before downstream access', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    const denied = client({
      resolveWorkspace: () => Promise.resolve({ ...principal, permissions: ['matter:read'] })
    });
    await expect(route(denied).handle(request())).rejects.toMatchObject({
      status: 403,
      code: 'PERMISSION_DENIED'
    });
    expect(downstream).not.toHaveBeenCalled();
  });

  it.each([
    [200, { schemaVersion: 1, documentPackages: [], intelligence: { total: 0, items: [] } }],
    [400, { code: 'INVALID_REQUEST', message: 'pageSize is invalid.' }],
    [404, { code: 'FORMAL_MATTER_NOT_FOUND' }],
    [503, { code: 'PERSISTENCE_UNAVAILABLE', retryable: true }]
  ] as const)('preserves MarkReg Evidence status/body truth for %s', async (status, body) => {
    vi.stubGlobal('fetch', vi.fn(() => response(status, body)));
    const result = await route().handle(request({}, { pageSize: 'bad' }));
    expect(result.status).toBe(status);
    expect(result.body).toEqual(body);
  });

  it('maps transport failure to explicit 503 without fabricating empty evidence', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('MarkReg offline'))));
    await expect(route().handle(request())).rejects.toMatchObject({
      status: 503,
      code: 'DOWNSTREAM_UNAVAILABLE'
    });
  });
});
