import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadGovernanceAdministration } from './governance-admin.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Super Admin Governance owner read', () => {
  it('loads the dedicated authenticated Governance administration projection', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          schemaVersion: 1,
          objectType: 'GOVERNANCE_ADMINISTRATION_PROJECTION',
          owner: 'CORE_CONTROL_PLANE',
          access: 'READ_ONLY',
          requiredAuthority: 'governance-admin:read',
          observedAt: '2026-09-08T10:00:00.000Z',
          portfolio: {
            availability: 'NOT_YET_MODELED',
            reason: 'No canonical durable cross-owner Governance and Audit portfolio is modeled.'
          }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    await expect(loadGovernanceAdministration()).resolves.toMatchObject({
      owner: 'CORE_CONTROL_PLANE',
      access: 'READ_ONLY',
      portfolio: { availability: 'NOT_YET_MODELED' }
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/internal/super-admin/governance', {
      credentials: 'include',
      headers: { accept: 'application/json' }
    });
  });

  it('keeps owner unavailability distinct from empty or zero state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'GOVERNANCE_ADMIN_OWNER_UNAVAILABLE',
          message: 'Governance unavailable'
        }),
        {
          status: 503,
          headers: { 'content-type': 'application/json' }
        }
      )
    );

    await expect(loadGovernanceAdministration()).rejects.toThrow('Governance unavailable');
  });

  it('fails closed on malformed success instead of inventing Governance state', async () => {
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

    await expect(loadGovernanceAdministration()).rejects.toThrow('owner contract mismatch');
  });
});
