import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadLiteAdministration } from './lite-admin.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Super Admin Lite owner read', () => {
  it('loads the dedicated authenticated Lite administration projection', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          schemaVersion: 1,
          objectType: 'LITE_ADMINISTRATION_PROJECTION',
          owner: 'LITE',
          access: 'READ_ONLY',
          requiredAuthority: 'lite-admin:read',
          observedAt: '2026-09-08T10:00:00.000Z',
          portfolio: {
            availability: 'NOT_YET_MODELED',
            reason: 'No canonical durable global Lite portfolio is modeled.'
          }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    await expect(loadLiteAdministration()).resolves.toMatchObject({
      owner: 'LITE',
      access: 'READ_ONLY',
      portfolio: { availability: 'NOT_YET_MODELED' }
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/internal/super-admin/lite', {
      credentials: 'include',
      headers: { accept: 'application/json' }
    });
  });

  it('keeps owner unavailability distinct from empty or zero state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ code: 'LITE_ADMIN_OWNER_UNAVAILABLE', message: 'Lite unavailable' }),
        {
          status: 503,
          headers: { 'content-type': 'application/json' }
        }
      )
    );

    await expect(loadLiteAdministration()).rejects.toThrow('Lite unavailable');
  });

  it('fails closed on malformed success instead of inventing Lite state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          schemaVersion: 1,
          owner: 'LITE',
          portfolio: { availability: 'AVAILABLE', count: 0 }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    await expect(loadLiteAdministration()).rejects.toThrow('owner contract mismatch');
  });
});
