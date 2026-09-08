import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadMgsnProvider, loadMgsnProviders } from './mgsn-admin.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Super Admin MGSN owner reads', () => {
  it('loads the Provider Registry through the existing authenticated commercial-admin boundary', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            providerId: 'provider-1',
            displayName: 'Provider One',
            operationalStatus: 'ACTIVE',
            version: 3
          }
        ]),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    await expect(loadMgsnProviders()).resolves.toMatchObject([{ providerId: 'provider-1' }]);
    expect(fetchMock).toHaveBeenCalledWith('/api/internal/commercial-admin/providers', {
      credentials: 'include',
      headers: { accept: 'application/json' }
    });
  });

  it('loads exact Provider detail without adding browser authority headers', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          schemaVersion: 1,
          source: { domain: 'MGSN', authority: 'PROVIDER_NETWORK' },
          provider: { providerId: 'provider/a', operationalStatus: 'ACTIVE', version: 2 },
          supplyCapabilities: []
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    await expect(loadMgsnProvider('provider/a')).resolves.toMatchObject({
      source: { domain: 'MGSN', authority: 'PROVIDER_NETWORK' }
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/internal/commercial-admin/providers/provider%2Fa',
      {
        credentials: 'include',
        headers: { accept: 'application/json' }
      }
    );
  });

  it('keeps owner failure distinct from a known-empty Provider Registry', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 'MGSN_UNAVAILABLE', message: 'MGSN unavailable' }), {
        status: 503,
        headers: { 'content-type': 'application/json' }
      })
    );

    await expect(loadMgsnProviders()).rejects.toThrow('MGSN unavailable');
  });

  it('fails closed on a malformed list payload instead of treating it as empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ providers: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );

    await expect(loadMgsnProviders()).rejects.toThrow('owner contract mismatch');
  });
});
