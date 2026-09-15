import { describe, expect, it, vi } from 'vitest';
import type { SiteManagerHttpError } from './site-manager.js';
import { createSiteManagerClient } from './site-manager.js';

const workspaceId = 'workspace_site_manager';
const baseUrl = 'https://gateway.example.com';

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function requestUrl(url: string | URL | Request): string {
  return typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
}

function jsonBody(init?: RequestInit): Record<string, unknown> {
  if (typeof init?.body !== 'string') throw new Error('Expected a JSON string request body.');
  return JSON.parse(init.body) as Record<string, unknown>;
}

describe('Site Manager browser client', () => {
  it('loads Site owner state with exact Workspace context and no CSRF round-trip', async () => {
    const fetchImpl = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const target = requestUrl(url);
      const headers = new Headers(init?.headers);
      expect(headers.get('x-markorbit-workspace-id')).toBe(workspaceId);
      expect(headers.get('x-markorbit-csrf-token')).toBeNull();
      expect(init?.method).toBe('GET');
      if (target.endsWith('/api/sites')) return Promise.resolve(response([{ siteId: 'site_a' }]));
      if (target.endsWith('/configuration'))
        return Promise.resolve(response({ schemaVersion: 1, siteId: 'site_a', version: 4 }));
      return Promise.resolve(response([{ bindingId: 'site_host_a', siteId: 'site_a' }]));
    });
    const client = createSiteManagerClient(workspaceId, {
      baseUrl,
      fetchImpl: fetchImpl
    });
    expect(await client.list()).toEqual([{ siteId: 'site_a' }]);
    expect(await client.configuration('site_a')).toMatchObject({ siteId: 'site_a', version: 4 });
    expect(await client.hostBindings('site_a')).toEqual([
      { bindingId: 'site_host_a', siteId: 'site_a' }
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('revises exact Site configuration through current CSRF without caller authority fields', async () => {
    const fetchImpl = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const target = requestUrl(url);
      if (target.endsWith('/api/auth/session'))
        return Promise.resolve(response({ csrfToken: 'csrf-site-manager' }));
      const headers = new Headers(init?.headers);
      expect(headers.get('x-markorbit-workspace-id')).toBe(workspaceId);
      expect(headers.get('x-markorbit-csrf-token')).toBe('csrf-site-manager');
      expect(headers.get('idempotency-key')).toBe('revise-4');
      const body = jsonBody(init);
      expect(body).not.toHaveProperty('workspaceId');
      expect(body).not.toHaveProperty('actor');
      expect(body).toMatchObject({
        expectedSiteVersion: 4,
        configuration: { sourceRef: 'lite:site-manager' }
      });
      return Promise.resolve(response({ schemaVersion: 1, siteId: 'site_a', version: 5 }));
    });
    const client = createSiteManagerClient(workspaceId, {
      baseUrl,
      fetchImpl: fetchImpl
    });
    await client.reviseConfiguration(
      'site_a',
      4,
      {
        brand: {
          displayName: 'Orbit IP',
          theme: { primaryColor: '#102030', accentColor: '#abcdef', colorMode: 'LIGHT' }
        },
        localization: {
          defaultLocale: 'en-US',
          supportedLocales: ['en-US'],
          defaultMarket: 'US',
          jurisdictions: ['US']
        },
        roles: {
          surfaceOwnerWorkspaceId: workspaceId,
          customerRelationshipWorkspaceId: workspaceId,
          offerOwnerRef: 'markreg:offer',
          merchantOwnerRef: 'markreg:merchant',
          fulfillmentOwnerRef: 'markreg:fulfillment'
        },
        services: [],
        contentSlots: [],
        sourceRef: 'lite:site-manager'
      },
      'revise-4'
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('sends bounded host lifecycle commands with explicit idempotency', async () => {
    const calls: Array<{ url: string; body: unknown; headers: Headers }> = [];
    const fetchImpl = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      if (requestUrl(url).endsWith('/api/auth/session'))
        return Promise.resolve(response({ csrfToken: 'csrf' }));
      calls.push({
        url: requestUrl(url),
        body: jsonBody(init),
        headers: new Headers(init?.headers)
      });
      return Promise.resolve(response({ schemaVersion: 1 }));
    });
    const client = createSiteManagerClient(workspaceId, {
      baseUrl,
      fetchImpl: fetchImpl
    });
    await client.createHostBinding(
      'site_a',
      4,
      { hostname: 'brand.example.com', bindingType: 'PRIMARY', verificationMethod: 'DNS_TXT' },
      'bind-1'
    );
    await client.activate('site_a', 4, 'site_host_a', 2, 'activate-1');
    await client.suspend('site_a', 5, 'operator:pause', 'suspend-1');
    expect(calls.map((call) => call.body)).toEqual([
      {
        expectedSiteVersion: 4,
        hostname: 'brand.example.com',
        bindingType: 'PRIMARY',
        verificationMethod: 'DNS_TXT'
      },
      { expectedSiteVersion: 4, bindingId: 'site_host_a', expectedBindingVersion: 2 },
      { expectedSiteVersion: 5, reasonRef: 'operator:pause' }
    ]);
    expect(calls.map((call) => call.headers.get('idempotency-key'))).toEqual([
      'bind-1',
      'activate-1',
      'suspend-1'
    ]);
  });

  it('preserves owner errors instead of collapsing permission or unavailable states', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        response(
          { code: 'PERMISSION_DENIED', message: 'workspace:manage permission is required.' },
          403
        )
      )
    );
    const client = createSiteManagerClient(workspaceId, {
      baseUrl,
      fetchImpl: fetchImpl
    });
    await expect(client.list()).rejects.toEqual(
      expect.objectContaining<Partial<SiteManagerHttpError>>({
        status: 403,
        code: 'PERMISSION_DENIED'
      })
    );
  });
});
