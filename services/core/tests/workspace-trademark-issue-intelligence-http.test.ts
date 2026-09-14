import { describe, expect, it, vi } from 'vitest';
import type { JsonRequest } from '@markorbit/service-kit';

import { createWorkspaceTrademarkIssueIntelligenceRoutesV1 } from '../src/workspace-trademark-issue-intelligence-http.js';
import { WorkspaceTrademarkIssueIntelligenceStoreError } from '../src/workspace-trademark-issue-intelligence-store.js';

const SECRET = 'core-workspace-brain-intelligence-secret-32-bytes';
const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const OTHER_WORKSPACE = '22222222-2222-4222-8222-222222222222';
const INTELLIGENCE_ID = `brain-intelligence_${'a'.repeat(64)}` as const;
const EVIDENCE_ID = `brain-knowledge-evidence_${'b'.repeat(64)}` as const;

function intelligence(workspaceId = WORKSPACE) {
  return {
    schemaVersion: 1 as const,
    intelligenceId: INTELLIGENCE_ID,
    workspaceId,
    task: 'TRADEMARK_ISSUE_EXTRACTION' as const,
    status: 'INTERPRETED' as const,
    evidence: [
      {
        schemaVersion: 1 as const,
        evidenceId: EVIDENCE_ID,
        intakeId: 'intake-1',
        knowledgeWorkspaceId: 'global-public',
        readyPackageId: 'ready-package-1',
        readyPackageDigest: 'c'.repeat(64),
        exportSha256: 'd'.repeat(64),
        sourceId: 'source-1',
        rawArtifactId: 'raw-1',
        rawArtifactSha256: 'e'.repeat(64),
        stagingDocumentId: 'staging-1',
        contentSha256: 'f'.repeat(64),
        capturedAt: '2026-09-15T00:00:00.000Z'
      }
    ],
    primitives: [
      {
        primitiveId: `brain-intelligence-primitive_${'1'.repeat(64)}` as const,
        kind: 'REQUIREMENT' as const,
        summary: 'A governed requirement was extracted.',
        jurisdiction: 'US',
        confidence: 0.9,
        uncertainty: 'LOW' as const,
        evidenceRefs: [EVIDENCE_ID]
      }
    ],
    explanation: 'Bounded explanation.',
    interpreter: {
      profileId: 'workspace-trademark-issue-interpreter',
      version: '1.0.0',
      policyProfileId: 'brain-policy-profile-v1'
    },
    generatedAt: '2026-09-15T00:01:00.000Z'
  };
}

function request(body: unknown, authorization: string | undefined = SECRET): JsonRequest {
  return {
    method: 'POST',
    path: '/internal/v1/brain-intelligence/workspace-trademark-issues/read',
    params: {},
    query: {},
    headers: { 'x-markorbit-internal-authorization': authorization },
    body
  };
}

function route(
  find: (
    workspaceId: string,
    intelligenceId: typeof INTELLIGENCE_ID
  ) => Promise<ReturnType<typeof intelligence> | undefined>
) {
  return createWorkspaceTrademarkIssueIntelligenceRoutesV1({
    internalServiceSecret: SECRET,
    intelligence: { find }
  })[0]!;
}
describe('Workspace trademark issue intelligence internal HTTP read', () => {
  it('returns only the exact Workspace-owned durable intelligence', async () => {
    const find = vi.fn(() => Promise.resolve(intelligence()));
    const response = await route(find).handle(
      request({ workspaceId: WORKSPACE, intelligenceId: INTELLIGENCE_ID })
    );

    expect(response).toEqual({ status: 200, body: intelligence() });
    expect(find).toHaveBeenCalledWith(WORKSPACE, INTELLIGENCE_ID);
    expect(find).toHaveBeenCalledOnce();
  });

  it('rejects an untrusted caller before touching persistence', async () => {
    const find = vi.fn(() => Promise.resolve(intelligence()));
    await expect(
      route(find).handle(
        request(
          { workspaceId: WORKSPACE, intelligenceId: INTELLIGENCE_ID },
          'not-the-configured-secret'
        )
      )
    ).rejects.toMatchObject({ status: 401, code: 'INTERNAL_SERVICE_UNAUTHORIZED' });
    expect(find).not.toHaveBeenCalled();
  });

  it('does not disclose another Workspace when the exact scoped read misses', async () => {
    const find = vi.fn(() => Promise.resolve(undefined));
    await expect(
      route(find).handle(request({ workspaceId: OTHER_WORKSPACE, intelligenceId: INTELLIGENCE_ID }))
    ).rejects.toMatchObject({ status: 404, code: 'BRAIN_INTELLIGENCE_NOT_FOUND' });
    expect(find).toHaveBeenCalledWith(OTHER_WORKSPACE, INTELLIGENCE_ID);
  });

  it('rejects caller-expanded request shape before touching persistence', async () => {
    const find = vi.fn(() => Promise.resolve(intelligence()));
    await expect(
      route(find).handle(
        request({
          workspaceId: WORKSPACE,
          intelligenceId: INTELLIGENCE_ID,
          includeOtherWorkspaces: true
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    expect(find).not.toHaveBeenCalled();
  });

  it.each([
    ['PERSISTENCE_INTEGRITY_FAILURE', 409, false],
    ['PERSISTENCE_UNAVAILABLE', 503, true]
  ] as const)('maps %s fail-closed without fallback', async (code, status, retryable) => {
    const find = vi.fn(() =>
      Promise.reject(new WorkspaceTrademarkIssueIntelligenceStoreError(code, `forced ${code}`))
    );
    await expect(
      route(find).handle(request({ workspaceId: WORKSPACE, intelligenceId: INTELLIGENCE_ID }))
    ).rejects.toMatchObject({ status, code, retryable });
    expect(find).toHaveBeenCalledOnce();
  });
});
