import { describe, expect, it, vi } from 'vitest';
import {
  KNOWLEDGE_PLATFORM_BOUNDARY_TEXT,
  KNOWLEDGE_PLATFORM_UNAVAILABLE_TEXT,
  loadKnowledgeOwnerHealth,
  parseKnowledgeOwnerHealth
} from './knowledge-platform.js';

const workspaceId = 'workspace-916';
const owner = {
  protocolVersion: '1.0',
  objectType: 'CONTROL_PLANE_EVIDENCE_SUPPLY_HEALTH_OWNER_RESULT',
  owner: 'KNOWLEDGE',
  access: 'READ_ONLY',
  requiredUpstreamAuthority: 'control-plane:knowledge:read',
  sourceReadModel: 'evidence-supply-health.v1',
  workspaceId,
  observedAt: '2026-09-06T14:19:00.000Z',
  items: [
    {
      targetId: 'target-uspto',
      jurisdiction: 'US',
      authorityName: 'USPTO',
      authorityLevel: 'PRIMARY',
      family: 'TRADEMARK',
      displayName: 'USPTO trademark evidence',
      sourceIds: [],
      state: 'UNKNOWN',
      reasonCodes: ['NO_ACQUISITION_EVIDENCE'],
      coverage: { state: 'PARTIAL', reasons: ['No acquisition evidence'] },
      freshness: { state: 'UNOBSERVED', lastSuccessfulAcquisitionAt: null },
      schedule: { state: 'UNCONFIGURED' },
      reliability: { attempts: 0, failed: 0, unrecoveredFailure: false },
      latency: { windowDays: 30 },
      changeActivity: { updates30d: 0, lastObservedChangeAt: null },
      observedAt: '2026-09-06T14:19:00.000Z'
    }
  ],
  summary: {
    total: 1,
    byState: { HEALTHY: 0, DEGRADED: 0, STALE: 0, BLOCKED: 0, PARTIAL: 0, UNKNOWN: 1 },
    coverage: { COMPLETE: 0, PARTIAL: 1, UNKNOWN: 0 },
    requiringAttention: 1,
    stale: 0,
    blocked: 0,
    recentChanges30d: 0
  }
};

function response(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' }
    })
  );
}

describe('Knowledge Control Center owner-health presentation', () => {
  it('preserves UNKNOWN/PARTIAL owner semantics without synthetic health', () => {
    const parsed = parseKnowledgeOwnerHealth(owner);
    expect(parsed?.items[0]?.state).toBe('UNKNOWN');
    expect(parsed?.items[0]?.coverage.state).toBe('PARTIAL');
    expect(parsed?.items[0]?.reasonCodes).toEqual(['NO_ACQUISITION_EVIDENCE']);
  });

  it('fails closed on malformed authority, workspace, and forbidden detail', () => {
    expect(
      parseKnowledgeOwnerHealth({ ...owner, requiredUpstreamAuthority: 'matter:read' })
    ).toBeUndefined();
    expect(parseKnowledgeOwnerHealth({ ...owner, access: 'WRITE' })).toBeUndefined();
    expect(
      parseKnowledgeOwnerHealth({ ...owner, documentBody: 'must-not-cross-boundary' })
    ).toBeUndefined();
  });

  it('loads only the dedicated governed Knowledge route with explicit Workspace context', async () => {
    const fetchImpl: typeof fetch = vi.fn(() => response(owner));
    await expect(loadKnowledgeOwnerHealth(fetchImpl, workspaceId)).resolves.toMatchObject({
      owner: 'KNOWLEDGE',
      workspaceId
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/internal/control-plane/knowledge/evidence-supply-health',
      {
        method: 'GET',
        credentials: 'include',
        headers: { accept: 'application/json', 'X-MarkOrbit-Workspace-Id': workspaceId }
      }
    );
  });

  it('rejects non-2xx, malformed success, and cross-workspace success', async () => {
    await expect(
      loadKnowledgeOwnerHealth(
        vi.fn(() => response({ code: 'PERMISSION_DENIED' }, 403)),
        workspaceId
      )
    ).rejects.toThrow('Knowledge owner health unavailable (403 | PERMISSION_DENIED).');
    await expect(
      loadKnowledgeOwnerHealth(
        vi.fn(() => response({ ...owner, access: 'WRITE' })),
        workspaceId
      )
    ).rejects.toThrow('Knowledge owner health is malformed and cannot be trusted.');
    await expect(
      loadKnowledgeOwnerHealth(
        vi.fn(() => response({ ...owner, workspaceId: 'workspace-other' })),
        workspaceId
      )
    ).rejects.toThrow('Knowledge owner health is malformed and cannot be trusted.');
  });

  it('keeps boundary copy explicitly non-synthetic and owner-scoped', () => {
    const unavailable = KNOWLEDGE_PLATFORM_UNAVAILABLE_TEXT.toLowerCase();
    expect(unavailable).toContain('not the same as healthy');
    expect(unavailable).toContain('empty');
    expect(unavailable).toContain('zero');
    expect(unavailable).toContain('no fallback state is inferred');

    const boundary = KNOWLEDGE_PLATFORM_BOUNDARY_TEXT.toLowerCase();
    expect(boundary).toContain('owner-local evidence-supply operational truth');
    expect(boundary).toContain('not legal sufficiency');
    expect(boundary).toContain('recommendation');
    expect(boundary).toContain('official truth');
    expect(boundary).toContain('knowledge admin');
    expect(boundary).not.toContain('approve');
    expect(boundary).not.toContain('repair');
  });
});
