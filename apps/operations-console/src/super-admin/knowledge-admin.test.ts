import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  KNOWLEDGE_ADMIN_BOUNDARY_TEXT,
  loadKnowledgeAdministration,
  parseKnowledgeAdministration
} from './knowledge-admin.js';

const owner = {
  schemaVersion: 1,
  objectType: 'KNOWLEDGE_PLATFORM_ADMINISTRATION_OWNER_RESULT',
  owner: 'KNOWLEDGE',
  access: 'READ_ONLY',
  requiredUpstreamAuthority: 'control-plane:knowledge:read',
  observedAt: '2026-09-08T11:00:00.000Z',
  portfolio: {
    availability: 'NOT_YET_MODELED',
    reason: 'Canonical Evidence Supply Health is currently Workspace-scoped.'
  }
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Super Admin Knowledge platform owner read', () => {
  it('loads the dedicated authenticated platform administration projection', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(owner), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );
    await expect(loadKnowledgeAdministration()).resolves.toMatchObject({
      owner: 'KNOWLEDGE',
      access: 'READ_ONLY',
      portfolio: { availability: 'NOT_YET_MODELED' }
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/internal/super-admin/knowledge', {
      credentials: 'include',
      headers: { accept: 'application/json' }
    });
  });

  it('keeps owner unavailability distinct from empty or zero state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'KNOWLEDGE_ADMIN_OWNER_UNAVAILABLE',
          message: 'Knowledge unavailable'
        }),
        { status: 503, headers: { 'content-type': 'application/json' } }
      )
    );
    await expect(loadKnowledgeAdministration()).rejects.toThrow('Knowledge unavailable');
  });

  it('fails closed on malformed success and strips unknown owner detail', () => {
    expect(() =>
      parseKnowledgeAdministration({
        ...owner,
        portfolio: { availability: 'AVAILABLE', reason: 'wrong' }
      })
    ).toThrow('owner contract mismatch');

    const parsed = parseKnowledgeAdministration({ ...owner, futureAdminDetail: { count: 99 } });
    expect(JSON.stringify(parsed)).not.toContain('futureAdminDetail');
  });
  it('locks platform semantics away from Workspace and legal truth', () => {
    const boundary = KNOWLEDGE_ADMIN_BOUNDARY_TEXT.toLowerCase();
    expect(boundary).toContain('platform availability');
    expect(boundary).toContain('not legal sufficiency');
    expect(boundary).toContain('recommendation');
    expect(boundary).toContain('workspace evidence-supply health');
    expect(boundary).toContain('official truth');
  });
});
