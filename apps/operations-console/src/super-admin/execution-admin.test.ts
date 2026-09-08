import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadExecutionAdministration } from './execution-admin.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Super Admin Execution owner read', () => {
  it('loads the dedicated authenticated Execution administration projection', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          schemaVersion: 1,
          objectType: 'EXECUTION_ADMINISTRATION_PROJECTION',
          owner: 'EXECUTION',
          access: 'READ_ONLY',
          requiredAuthority: 'execution-admin:read',
          observedAt: '2026-09-08T10:00:00.000Z',
          portfolio: {
            availability: 'NOT_YET_MODELED',
            reason: 'No canonical durable global Execution portfolio is modeled.'
          }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    await expect(loadExecutionAdministration()).resolves.toMatchObject({
      owner: 'EXECUTION',
      access: 'READ_ONLY',
      portfolio: { availability: 'NOT_YET_MODELED' }
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/internal/super-admin/execution', {
      credentials: 'include',
      headers: { accept: 'application/json' }
    });
  });

  it('keeps owner unavailability distinct from empty or zero state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'EXECUTION_ADMIN_OWNER_UNAVAILABLE',
          message: 'Execution unavailable'
        }),
        {
          status: 503,
          headers: { 'content-type': 'application/json' }
        }
      )
    );

    await expect(loadExecutionAdministration()).rejects.toThrow('Execution unavailable');
  });

  it('fails closed on malformed success instead of inventing Execution state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          schemaVersion: 1,
          owner: 'EXECUTION',
          portfolio: { availability: 'AVAILABLE', count: 0 }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    await expect(loadExecutionAdministration()).rejects.toThrow('owner contract mismatch');
  });
});
