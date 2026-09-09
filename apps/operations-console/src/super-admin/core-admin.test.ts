import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadCoreAdministration } from './core-admin.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Super Admin Core owner read', () => {
  it('loads the dedicated authenticated Core administration projection', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          schemaVersion: 1,
          objectType: 'CORE_ADMINISTRATION_PROJECTION',
          owner: 'CORE',
          access: 'READ_ONLY',
          requiredAuthority: 'core-admin:read',
          observedAt: '2026-09-09T10:00:00.000Z',
          portfolio: {
            availability: 'NOT_YET_MODELED',
            reason: 'No canonical durable global Core administration portfolio is modeled.'
          }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    await expect(loadCoreAdministration()).resolves.toMatchObject({
      owner: 'CORE',
      access: 'READ_ONLY',
      requiredAuthority: 'core-admin:read',
      portfolio: { availability: 'NOT_YET_MODELED' }
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/internal/super-admin/core', {
      credentials: 'include',
      headers: { accept: 'application/json' }
    });
  });

  it('keeps owner unavailability distinct from empty or zero state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'CORE_ADMIN_OWNER_UNAVAILABLE',
          message: 'Core unavailable'
        }),
        {
          status: 503,
          headers: { 'content-type': 'application/json' }
        }
      )
    );

    await expect(loadCoreAdministration()).rejects.toThrow('Core unavailable');
  });

  it('fails closed when another domain authority is presented as Core authority', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          schemaVersion: 1,
          objectType: 'CORE_ADMINISTRATION_PROJECTION',
          owner: 'CORE',
          access: 'READ_ONLY',
          requiredAuthority: 'commercial-admin:read',
          observedAt: '2026-09-09T10:00:00.000Z',
          portfolio: {
            availability: 'NOT_YET_MODELED',
            reason: 'No canonical durable global Core administration portfolio is modeled.'
          }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    await expect(loadCoreAdministration()).rejects.toThrow('owner contract mismatch');
  });
});
