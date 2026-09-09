import type { InternalOperatorPrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { describe, expect, it, vi } from 'vitest';
import { createGatewayCoreSuperAdminRoutes } from '../src/core-super-admin-http.js';

const secret = 'core-super-admin-secret';
const coreUrl = 'http://core.test';
const ownerUrl = 'http://core.test';
const principal: InternalOperatorPrincipal = {
  kind: 'INTERNAL_OPERATOR',
  sessionId: 'session-core-admin',
  userId: '018f0000-0000-7000-8000-000000001012',
  capabilities: ['core-admin:read'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
};
const owner = {
  schemaVersion: 1,
  objectType: 'CORE_ADMINISTRATION_PROJECTION',
  owner: 'CORE',
  access: 'READ_ONLY',
  requiredAuthority: 'core-admin:read',
  observedAt: '2026-09-08T09:00:00.000Z',
  portfolio: {
    availability: 'NOT_YET_MODELED',
    reason: 'No canonical cross-owner Core and Audit portfolio.'
  }
};

function request(cookie = 'mo_session=browser-core-admin-session'): JsonRequest {
  return {
    method: 'GET',
    path: '/api/internal/super-admin/core',
    params: {},
    query: {},
    body: undefined,
    headers: {
      cookie,
      'x-markorbit-internal-authorization': 'browser-forged-secret',
      'x-markorbit-internal-principal': 'browser-forged-principal'
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
function route(fetchImpl: typeof fetch) {
  const found = createGatewayCoreSuperAdminRoutes({
    coreUrl,
    internalServiceSecret: secret,
    fetchImpl
  })[0];
  if (!found) throw new Error('Missing Gateway Core Admin route.');
  return found;
}

describe('Gateway Core Super Admin read', () => {
  it('resolves exact authority server-side and forwards only server credentials', async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = vi.fn(
      (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        calls.push(url(input));
        const headers = new Headers(init?.headers);
        expect(headers.get('x-markorbit-internal-authorization')).toBe(secret);
        expect(headers.get('x-markorbit-internal-principal')).not.toBe('browser-forged-principal');
        if (calls.length === 1) {
          expect(url(input)).toBe(
            `${coreUrl}/internal/super-admin/core/operator-principals/resolve`
          );
          expect(body(init)).toEqual({ token: 'browser-core-admin-session' });
          return response(principal);
        }
        expect(url(input)).toBe(`${ownerUrl}/internal/super-admin/core`);
        expect(headers.get('x-markorbit-internal-principal')).toBeTruthy();
        return response(owner);
      }
    );
    const result = await route(fetchImpl).handle(request());
    expect(result.status).toBe(200);
    expect(result.body).toEqual(owner);
    expect(calls).toHaveLength(2);
  });

  it('requires a browser session before any owner call', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(route(fetchImpl).handle(request(''))).rejects.toMatchObject({
      status: 401,
      code: 'AUTHENTICATION_REQUIRED'
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails closed on malformed owner success and preserves owner non-2xx', async () => {
    const malformedFetch: typeof fetch = vi.fn((input: Parameters<typeof fetch>[0]) =>
      url(input).endsWith('/operator-principals/resolve')
        ? response(principal)
        : response({ ...owner, portfolio: { availability: 'AVAILABLE' } })
    );
    await expect(route(malformedFetch).handle(request())).rejects.toMatchObject({
      status: 503,
      code: 'CORE_ADMIN_OWNER_CONTRACT_MISMATCH'
    });

    const deniedFetch: typeof fetch = vi.fn((input: Parameters<typeof fetch>[0]) =>
      url(input).includes('/operator-principals/resolve')
        ? response(principal)
        : response({ code: 'OWNER_DENIED' }, 403)
    );
    const denied = await route(deniedFetch).handle(request());
    expect(denied.status).toBe(403);
    expect(denied.body).toEqual({ code: 'OWNER_DENIED' });
  });
});
