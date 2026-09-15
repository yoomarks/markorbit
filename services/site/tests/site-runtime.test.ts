import { describe, expect, it, vi } from 'vitest';
import { HttpCoreSiteCommercialAuthorityV1 } from '../src/site-runtime.js';

const input = {
  workspaceId: 'workspace_site',
  installationId: 'installation_site',
  installationVersion: 3,
  entitlementKeys: ['SITE_RUNTIME'],
  asOf: '2026-09-15T00:00:00.000Z'
};

function proof(currentAt = input.asOf) {
  return {
    schemaVersion: 1,
    workspaceId: input.workspaceId,
    installationRef: {
      installationId: input.installationId,
      version: input.installationVersion
    },
    entitlementRefs: [
      {
        key: 'SITE_RUNTIME',
        contributingGrantRefs: [{ grantId: 'grant_site', version: 1 }],
        resolvedAt: currentAt
      }
    ],
    currentAt
  };
}

describe('Core Site commercial authority client', () => {
  it('accepts only an exact current proof for the requested installation', async () => {
    const fetchImpl = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const actualUrl = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
      expect(actualUrl).toBe(
        'http://core.test/internal/workspaces/workspace_site/site-runtime/access/resolve'
      );
      expect(init?.method).toBe('POST');
      expect(new Headers(init?.headers).get('x-markorbit-internal-authorization')).toBe('secret');
      return Promise.resolve(
        new Response(JSON.stringify(proof()), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      );
    });
    const client = new HttpCoreSiteCommercialAuthorityV1('http://core.test', 'secret', fetchImpl);
    await expect(client.assertCurrentAccess(input)).resolves.toEqual(proof());
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('fails closed when Core returns a proof for a different currentness instant', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(proof('2026-09-15T00:01:00.000Z')), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      )
    );
    const client = new HttpCoreSiteCommercialAuthorityV1('http://core.test', 'secret', fetchImpl);
    await expect(client.assertCurrentAccess(input)).rejects.toMatchObject({
      code: 'COMMERCIAL_AUTHORITY_UNAVAILABLE',
      retryable: true
    });
  });
});
