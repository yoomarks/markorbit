import type { InternalOperatorPrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { describe, expect, it, vi } from 'vitest';
import { createGatewayKnowledgeSuperAdminRoutes } from '../src/knowledge-super-admin-http.js';

const secret = 'knowledge-super-admin-secret';
const coreUrl = 'http://core.test';
const knowledgeUrl = 'http://knowledge.test';
const now = new Date('2026-09-08T10:30:00.000Z');
const principal: InternalOperatorPrincipal = {
  kind: 'INTERNAL_OPERATOR',
  sessionId: 'session-knowledge-admin',
  userId: 'user-knowledge-admin',
  capabilities: ['control-plane:knowledge:read'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
};
const owner = {
  schemaVersion: 1,
  objectType: 'KNOWLEDGE_PLATFORM_ADMINISTRATION_OWNER_RESULT',
  owner: 'KNOWLEDGE',
  access: 'READ_ONLY',
  requiredUpstreamAuthority: 'control-plane:knowledge:read',
  observedAt: '2026-09-08T10:29:00.000Z',
  portfolio: { availability: 'NOT_YET_MODELED', reason: 'Workspace-scoped truth only.' }
};
function request(cookie = 'mo_session=browser-knowledge-admin-session'): JsonRequest {
  return {
    method: 'GET',
    path: '/api/internal/super-admin/knowledge',
    params: {},
    query: {},
    body: undefined,
    headers: {
      cookie,
      'x-markorbit-workspace-id': 'browser-forged-workspace',
      'x-markorbit-control-plane-principal': 'browser-forged-owner-principal',
      'x-markorbit-internal-authorization': 'browser-forged-secret',
      'x-correlation-id': 'correlation-knowledge-admin'
    }
  };
}

function response(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  );
}

function url(input: Parameters<typeof fetch>[0]) {
  return typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
}
function body(init?: RequestInit): unknown {
  if (typeof init?.body !== 'string') throw new Error('Expected JSON body.');
  return JSON.parse(init.body) as unknown;
}

function decodeOwnerPrincipal(value: string | null): unknown {
  if (!value) throw new Error('Missing owner principal.');
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
}

function route(fetchImpl: typeof fetch) {
  const found = createGatewayKnowledgeSuperAdminRoutes({
    coreUrl,
    knowledgeUrl,
    internalServiceSecret: secret,
    fetchImpl,
    now: () => now
  })[0];
  if (!found) throw new Error('Missing Gateway Knowledge Admin route.');
  return found;
}

describe('Gateway Knowledge Super Admin read', () => {
  it('resolves exact authority and forwards a platform principal without Workspace semantics', async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = vi.fn(
      (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        calls.push(url(input));
        const headers = new Headers(init?.headers);
        expect(headers.get('x-markorbit-internal-authorization')).toBe(secret);
        if (calls.length === 1) {
          expect(url(input)).toBe(`${coreUrl}/internal/control-plane/operator-principals/resolve`);
          expect(body(init)).toEqual({
            token: 'browser-knowledge-admin-session',
            requiredCapability: 'control-plane:knowledge:read'
          });
          expect(headers.get('x-markorbit-control-plane-principal')).toBeNull();
          return response(principal);
        }
        expect(url(input)).toBe(
          `${knowledgeUrl}/api/internal/control-plane/platform-administration`
        );
        const encoded = headers.get('x-markorbit-control-plane-principal');
        expect(encoded).not.toBe('browser-forged-owner-principal');
        expect(decodeOwnerPrincipal(encoded)).toEqual({
          schemaVersion: 1,
          principal: {
            kind: 'CONTROL_PLANE_KNOWLEDGE_PLATFORM_READ',
            caller: 'MARKORBIT_GATEWAY',
            authority: 'control-plane:knowledge:read',
            expiresAt: '2026-09-08T10:31:00.000Z'
          }
        });
        return response({ ...owner, futureAdminDetail: { shouldNotReachBrowser: true } });
      }
    );
    const result = await route(fetchImpl).handle(request());
    expect(result.status).toBe(200);
    expect(result.body).toEqual(owner);
    expect(JSON.stringify(result.body)).not.toContain('futureAdminDetail');
    expect(calls).toHaveLength(2);
  });

  it('requires a browser session before any authority or owner read', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(route(fetchImpl).handle(request(''))).rejects.toMatchObject({
      status: 401,
      code: 'AUTHENTICATION_REQUIRED'
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('requires exactly one Knowledge read authority', async () => {
    const broad = {
      ...principal,
      capabilities: ['control-plane:knowledge:read', 'control-plane:data:read']
    };
    const fetchImpl: typeof fetch = vi.fn((input: Parameters<typeof fetch>[0]) =>
      url(input).startsWith(coreUrl) ? response(broad) : response(owner)
    );
    const denied = await route(fetchImpl).handle(request());
    expect(denied.status).toBe(403);
    expect(denied.body).toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('fails closed on malformed owner success and preserves owner non-2xx', async () => {
    const malformedFetch: typeof fetch = vi.fn((input: Parameters<typeof fetch>[0]) =>
      url(input).startsWith(coreUrl)
        ? response(principal)
        : response({ ...owner, portfolio: { availability: 'AVAILABLE' } })
    );
    await expect(route(malformedFetch).handle(request())).rejects.toMatchObject({
      status: 503,
      code: 'KNOWLEDGE_ADMIN_OWNER_CONTRACT_MISMATCH'
    });

    const deniedFetch: typeof fetch = vi.fn((input: Parameters<typeof fetch>[0]) =>
      url(input).startsWith(coreUrl) ? response(principal) : response({ code: 'OWNER_DENIED' }, 403)
    );
    const denied = await route(deniedFetch).handle(request());
    expect(denied.status).toBe(403);
    expect(denied.body).toEqual({ code: 'OWNER_DENIED' });
  });

  it('exposes one typed route and no generic Knowledge Super Admin proxy', () => {
    const routes = createGatewayKnowledgeSuperAdminRoutes({
      coreUrl,
      knowledgeUrl,
      internalServiceSecret: secret,
      fetchImpl: vi.fn<typeof fetch>()
    });
    expect(routes.map((item) => `${item.method} ${item.path}`)).toEqual([
      'GET /api/internal/super-admin/knowledge'
    ]);
    expect(routes.some((item) => item.path.includes('*') || item.path.includes(':path'))).toBe(
      false
    );
  });
});
