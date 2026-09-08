import type { InternalOperatorPrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { describe, expect, it, vi } from 'vitest';
import { csrfToken } from '../src/auth.js';
import { createGatewayWorkspaceSuperAdminRoutes } from '../src/workspace-super-admin-http.js';

const coreUrl = 'http://core.test';
const secret = 'workspace-super-admin-internal-secret';
const principal: InternalOperatorPrincipal = {
  kind: 'INTERNAL_OPERATOR',
  sessionId: 'session-workspace-admin',
  userId: 'user-workspace-admin',
  capabilities: ['workspace-admin:read'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
};

const ownerResult = {
  schemaVersion: 1,
  objectType: 'WORKSPACE_ADMIN_PORTFOLIO_RESULT',
  owner: 'CORE',
  access: 'READ_ONLY',
  requiredAuthority: 'workspace-admin:read',
  observedAt: '2026-09-08T00:00:00.000Z',
  page: 1,
  pageSize: 50,
  sort: 'UPDATED_AT',
  direction: 'DESC',
  total: 1,
  summary: { total: 3, byStatus: { ACTIVE: 2, ARCHIVED: 1 } },
  items: [] as unknown[]
};
ownerResult.items = [
  {
    workspaceId: '11111111-1111-4111-8111-111111111111',
    name: 'Alpha Workspace',
    slug: 'alpha-workspace',
    status: 'ACTIVE',
    version: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-09-07T00:00:00.000Z',
    membershipCount: 4,
    activeMembershipCount: 3,
    ownerOnlyField: 'must-not-leak'
  }
];

function request(
  query: Record<string, string> = {},
  headers: Record<string, string> = {}
): JsonRequest {
  return {
    method: 'GET',
    path: '/api/internal/super-admin/workspaces',
    params: {},
    query,
    body: undefined,
    headers: {
      cookie: 'mo_session=browser-workspace-admin-session',
      'x-correlation-id': 'correlation-workspace-admin',
      'x-request-id': 'request-workspace-admin',
      'x-markorbit-principal': 'browser-forged-principal',
      'x-markorbit-internal-authorization': 'browser-forged-secret',
      ...headers
    }
  };
}
function url(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function response(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' }
    })
  );
}

function route(fetchImpl: typeof fetch, internalServiceSecret = secret) {
  const found = createGatewayWorkspaceSuperAdminRoutes({
    coreUrl,
    internalServiceSecret,
    fetchImpl
  }).find(
    (candidate) =>
      candidate.method === 'GET' && candidate.path === '/api/internal/super-admin/workspaces'
  );
  if (!found) throw new Error('Missing Workspace Super Admin route.');
  return found;
}

function body(init?: RequestInit): unknown {
  if (typeof init?.body !== 'string') throw new Error('Expected JSON request body.');
  return JSON.parse(init.body) as unknown;
}
describe('Gateway Workspace Super Admin portfolio', () => {
  it('uses the dedicated resolver, forwards only server authority and normalizes owner output', async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = vi.fn(
      (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        calls.push(url(input));
        const headers = new Headers(init?.headers);
        expect(headers.get('x-markorbit-internal-authorization')).toBe(secret);
        expect(headers.get('x-correlation-id')).toBe('correlation-workspace-admin');
        expect(headers.get('x-request-id')).toBe('request-workspace-admin');
        if (calls.length === 1) {
          expect(url(input)).toBe(
            `${coreUrl}/internal/super-admin/workspace/operator-principals/resolve`
          );
          expect(init?.method).toBe('POST');
          expect(body(init)).toEqual({ token: 'browser-workspace-admin-session' });
          expect(headers.get('x-markorbit-principal')).toBeNull();
          return response(principal);
        }
        expect(url(input)).toBe(
          `${coreUrl}/internal/super-admin/workspaces?page=1&pageSize=50&status=ACTIVE&search=Alpha+Workspace&sort=UPDATED_AT&direction=DESC`
        );
        expect(init?.method).toBe('GET');
        expect(headers.get('x-markorbit-principal')).not.toBe('browser-forged-principal');
        return response({ ...ownerResult, futureOwnerField: 'must-not-leak' });
      }
    );
    const result = await route(fetchImpl).handle(
      request({
        page: '1',
        pageSize: '50',
        status: 'ACTIVE',
        search: 'Alpha Workspace',
        sort: 'UPDATED_AT',
        direction: 'DESC'
      })
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      schemaVersion: 1,
      objectType: 'WORKSPACE_ADMIN_PORTFOLIO_RESULT',
      owner: 'CORE',
      access: 'READ_ONLY',
      requiredAuthority: 'workspace-admin:read',
      observedAt: '2026-09-08T00:00:00.000Z',
      page: 1,
      pageSize: 50,
      sort: 'UPDATED_AT',
      direction: 'DESC',
      total: 1,
      summary: { total: 3, byStatus: { ACTIVE: 2, ARCHIVED: 1 } },
      items: [
        {
          workspaceId: '11111111-1111-4111-8111-111111111111',
          name: 'Alpha Workspace',
          slug: 'alpha-workspace',
          status: 'ACTIVE',
          version: 3,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-09-07T00:00:00.000Z',
          membershipCount: 4,
          activeMembershipCount: 3
        }
      ]
    });
    expect(calls).toHaveLength(2);
  });
  it('requires the browser HttpOnly session before any owner call', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(route(fetchImpl).handle(request({}, { cookie: '' }))).rejects.toMatchObject({
      status: 401,
      code: 'AUTHENTICATION_REQUIRED'
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects unknown query fields instead of becoming a generic Core proxy', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(route(fetchImpl).handle(request({ arbitrary: 'true' }))).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_REQUEST'
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails closed when server-side internal configuration is absent', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(route(fetchImpl, '').handle(request())).rejects.toMatchObject({
      status: 503,
      code: 'WORKSPACE_ADMIN_CONFIGURATION_UNAVAILABLE'
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('preserves explicit resolver denial and never calls the owner read', async () => {
    const fetchImpl: typeof fetch = vi.fn(() =>
      response({ code: 'PERMISSION_DENIED', message: 'Explicit grant is required.' }, 403)
    );
    const result = await route(fetchImpl).handle(request());
    expect(result).toEqual({
      status: 403,
      body: { code: 'PERMISSION_DENIED', message: 'Explicit grant is required.' }
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects a valid principal that does not contain the exact Workspace Admin authority', async () => {
    const fetchImpl: typeof fetch = vi.fn(() =>
      response({ ...principal, capabilities: ['control-plane:data:read'] })
    );
    const result = await route(fetchImpl).handle(request());
    expect(result.status).toBe(403);
    expect(result.body).toEqual({
      code: 'PERMISSION_DENIED',
      message: 'Exact workspace-admin:read authority is required.'
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('fails closed on malformed resolver output', async () => {
    const fetchImpl: typeof fetch = vi.fn(() =>
      response({ capabilities: ['workspace-admin:read'] })
    );
    await expect(route(fetchImpl).handle(request())).rejects.toMatchObject({
      status: 503,
      code: 'WORKSPACE_ADMIN_OPERATOR_RESPONSE_INVALID'
    });
  });
  it('fails closed when the Core owner read is unavailable', async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = vi.fn(() => {
      calls += 1;
      if (calls === 1) return response(principal);
      return Promise.reject(new Error('owner offline'));
    });
    await expect(route(fetchImpl).handle(request())).rejects.toMatchObject({
      status: 503,
      code: 'WORKSPACE_ADMIN_OWNER_UNAVAILABLE'
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('fails closed on malformed Core owner truth instead of rendering an empty portfolio', async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = vi.fn(() => {
      calls += 1;
      return calls === 1
        ? response(principal)
        : response({ ...ownerResult, requiredAuthority: 'workspace:read', items: [] });
    });
    await expect(route(fetchImpl).handle(request())).rejects.toMatchObject({
      status: 503,
      code: 'WORKSPACE_ADMIN_OWNER_CONTRACT_MISMATCH'
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

const managePrincipal: InternalOperatorPrincipal = {
  kind: 'INTERNAL_OPERATOR',
  sessionId: 'session-workspace-admin-manage',
  userId: 'user-workspace-admin-manage',
  capabilities: ['workspace-admin:manage'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
};
const csrfSecret = 'workspace-super-admin-csrf-secret';
const adminOrigin = 'https://admin.example';

function manageRequest(headers: Record<string, string> = {}): JsonRequest {
  return {
    method: 'PATCH',
    path: '/api/internal/super-admin/workspaces/11111111-1111-4111-8111-111111111111/display-name',
    params: { workspaceId: '11111111-1111-4111-8111-111111111111' },
    query: {},
    body: { expectedVersion: 3, displayName: 'Renamed Workspace', reason: 'Correct display name.' },
    headers: {
      cookie: 'mo_session=browser-workspace-admin-session',
      origin: adminOrigin,
      'x-markorbit-csrf-token': csrfToken(managePrincipal.sessionId, csrfSecret),
      'idempotency-key': 'workspace-rename-test-1',
      'x-correlation-id': 'correlation-workspace-admin-manage',
      'x-markorbit-principal': 'browser-forged-principal',
      'x-markorbit-internal-authorization': 'browser-forged-secret',
      ...headers
    }
  };
}

function manageRoute(fetchImpl: typeof fetch) {
  const found = createGatewayWorkspaceSuperAdminRoutes({
    coreUrl,
    internalServiceSecret: secret,
    fetchImpl,
    csrfSecret,
    allowedOrigins: [adminOrigin]
  }).find(
    (candidate) =>
      candidate.method === 'PATCH' &&
      candidate.path === '/api/internal/super-admin/workspaces/:workspaceId/display-name'
  );
  if (!found) throw new Error('Missing Workspace Super Admin manage route.');
  return found;
}

const managedWorkspace = {
  workspaceId: '11111111-1111-4111-8111-111111111111',
  name: 'Renamed Workspace',
  slug: 'alpha-workspace',
  status: 'ACTIVE',
  version: 4,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-09-08T00:30:00.000Z'
};

describe('Gateway Workspace Super Admin management', () => {
  it('uses exact manage authority and forwards only trusted server headers', async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = vi.fn(
      (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        calls += 1;
        const headers = new Headers(init?.headers);
        expect(headers.get('x-markorbit-internal-authorization')).toBe(secret);
        if (calls === 1) {
          expect(url(input)).toBe(
            `${coreUrl}/internal/super-admin/workspace/manage/operator-principals/resolve`
          );
          expect(headers.get('x-markorbit-principal')).toBeNull();
          return response(managePrincipal);
        }
        expect(url(input)).toBe(
          `${coreUrl}/internal/super-admin/workspaces/11111111-1111-4111-8111-111111111111/display-name`
        );
        expect(headers.get('x-markorbit-principal')).not.toBe('browser-forged-principal');
        expect(headers.get('idempotency-key')).toBe('workspace-rename-test-1');
        expect(body(init)).toEqual(manageRequest().body);
        return response({ ...managedWorkspace, unknownOwnerField: 'must-not-leak' });
      }
    );
    const result = await manageRoute(fetchImpl).handle(manageRequest());
    expect(result).toEqual({ status: 200, body: managedWorkspace });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not let read authority substitute for manage', async () => {
    const fetchImpl: typeof fetch = vi.fn(() => response(principal));
    const result = await manageRoute(fetchImpl).handle(manageRequest());
    expect(result).toEqual({
      status: 403,
      body: {
        code: 'PERMISSION_DENIED',
        message: 'Exact workspace-admin:manage authority is required.'
      }
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('fails closed before the owner mutation on invalid CSRF', async () => {
    const fetchImpl: typeof fetch = vi.fn(() => response(managePrincipal));
    await expect(
      manageRoute(fetchImpl).handle(manageRequest({ 'x-markorbit-csrf-token': 'invalid' }))
    ).rejects.toMatchObject({ code: 'INVALID_CSRF_TOKEN' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('fails closed on malformed successful owner response', async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = vi.fn(() => {
      calls += 1;
      return calls === 1
        ? response(managePrincipal)
        : response({ ...managedWorkspace, version: 0 });
    });
    await expect(manageRoute(fetchImpl).handle(manageRequest())).rejects.toMatchObject({
      status: 503,
      code: 'WORKSPACE_ADMIN_OWNER_CONTRACT_MISMATCH'
    });
  });
});
