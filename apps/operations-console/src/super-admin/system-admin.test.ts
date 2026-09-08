import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSystemAdministration } from './system-admin.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Super Admin System owner read', () => {
  it('loads the dedicated authenticated System administration projection', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          schemaVersion: 1,
          objectType: 'SYSTEM_ADMINISTRATION_PROJECTION',
          owner: 'CORE_CONTROL_PLANE',
          access: 'READ_ONLY',
          requiredAuthority: 'system-admin:read',
          observedAt: '2026-09-08T10:00:00.000Z',
          portfolio: {
            availability: 'NOT_YET_MODELED',
            reason: 'No canonical durable global System portfolio is modeled.'
          }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    await expect(loadSystemAdministration()).resolves.toMatchObject({
      owner: 'CORE_CONTROL_PLANE',
      access: 'READ_ONLY',
      portfolio: { availability: 'NOT_YET_MODELED' }
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/internal/super-admin/system', {
      credentials: 'include',
      headers: { accept: 'application/json' }
    });
  });

  it('keeps owner unavailability distinct from empty or zero state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'SYSTEM_ADMIN_OWNER_UNAVAILABLE',
          message: 'System unavailable'
        }),
        {
          status: 503,
          headers: { 'content-type': 'application/json' }
        }
      )
    );

    await expect(loadSystemAdministration()).rejects.toThrow('System unavailable');
  });

  it('fails closed on malformed success instead of inventing System state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          schemaVersion: 1,
          owner: 'CORE_CONTROL_PLANE',
          portfolio: { availability: 'AVAILABLE', count: 0 }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    await expect(loadSystemAdministration()).rejects.toThrow('owner contract mismatch');
  });
});
