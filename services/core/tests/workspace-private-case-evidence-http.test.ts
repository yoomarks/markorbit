import { describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { createWorkspacePrivateCaseEvidenceRoutes } from '../src/workspace-private-case-evidence-http.js';
import {
  WorkspacePrivateCaseEvidenceError,
  type WorkspacePrivateCaseEvidenceService
} from '../src/workspace-private-case-evidence.js';

const secret = 'workspace-private-case-evidence-secret-32-bytes';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session_case_http',
  userId: '018f0000-0000-7000-8000-000000000701',
  workspaceId: '018f0000-0000-7000-8000-000000000702',
  membershipId: '018f0000-0000-7000-8000-000000000703',
  role: 'WORKSPACE_ADMIN',
  permissions: ['matter:read', 'matter:manage'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
};
const bindingId = '018f0000-0000-7000-8000-000000000704';
const sha = 'a'.repeat(64);

const suggestion = {
  idempotencyKey: 'http-suggestion-701',
  formalMatterId: 'formal-matter_http-701',
  expectedFormalMatterVersion: 1,
  expectedFormalMatterSnapshotSha256: sha,
  readyPackageId: 'rdp_http_701',
  expectedKnowledgeWorkspaceId: 'wsp_http_701',
  expectedReadyPackageDigest: sha,
  expectedCoreIntakeId: 'intake_http_701',
  expectedContentExportSha256: sha,
  expectedStagingDocumentId: 'std_http_701',
  expectedStagingSha256: sha,
  expectedRawArtifactId: 'art_http_701',
  expectedRawArtifactSha256: sha,
  sourceLocators: ['knowledge://http/private/case-701'],
  methodProvenanceRefs: ['method://oa-p2a/http-v1']
};

function request(
  path: string,
  body: unknown,
  overrides: Partial<JsonRequest['headers']> = {}
): JsonRequest {
  return {
    method: 'POST',
    path,
    params: path.includes(bindingId) ? { bindingId } : {},
    query: {},
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
      'x-markorbit-workspace-id': principal.workspaceId,
      ...overrides
    },
    body
  };
}

function routes(
  service: Pick<
    WorkspacePrivateCaseEvidenceService,
    'suggest' | 'decide' | 'readGrant' | 'listAccepted'
  >
) {
  return createWorkspacePrivateCaseEvidenceRoutes({
    internalServiceSecret: secret,
    service
  });
}

function service() {
  return {
    suggest: vi.fn(() => Promise.resolve({ status: 'SUGGESTED' })),
    decide: vi.fn(() => Promise.resolve({ status: 'ACCEPTED' })),
    readGrant: vi.fn(() =>
      Promise.resolve({
        protocolVersion: '1.0',
        objectType: 'WORKSPACE_PRIVATE_CASE_EVIDENCE_READ_GRANT'
      })
    ),
    listAccepted: vi.fn(() =>
      Promise.resolve({
        protocolVersion: '1.0',
        objectType: 'WORKSPACE_PRIVATE_CASE_EVIDENCE_REFERENCE_LIST',
        items: []
      })
    )
  } as unknown as Pick<
    WorkspacePrivateCaseEvidenceService,
    'suggest' | 'decide' | 'readGrant' | 'listAccepted'
  >;
}

describe('Workspace-private Case evidence HTTP boundary', () => {
  it('derives user and Workspace authority only from the trusted Principal headers', async () => {
    const owner = service();
    const response = await routes(owner)[1]!.handle(
      request('/internal/v1/workspace-private-case-evidence/suggestions', suggestion)
    );
    expect(response.status).toBe(200);
    expect(owner.suggest).toHaveBeenCalledWith(principal, suggestion);
  });

  it('rejects caller-supplied authority fields instead of accepting body spoofing', async () => {
    const owner = service();
    await expect(
      routes(owner)[1]!.handle(
        request('/internal/v1/workspace-private-case-evidence/suggestions', {
          ...suggestion,
          workspaceId: '018f0000-0000-7000-8000-000000000799'
        })
      )
    ).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_WORKSPACE_PRIVATE_CASE_EVIDENCE_REQUEST'
    });
    expect(owner.suggest).not.toHaveBeenCalled();
  });

  it('fails privacy-safely when the asserted Workspace does not match the Principal', async () => {
    const owner = service();
    await expect(
      routes(owner)[3]!.handle(
        request(
          `/internal/v1/workspace-private-case-evidence/${bindingId}/read-grants`,
          { expectedVersion: 2 },
          { 'x-markorbit-workspace-id': '018f0000-0000-7000-8000-000000000799' }
        )
      )
    ).rejects.toMatchObject({ status: 404, code: 'WORKSPACE_MISMATCH' });
    expect(owner.readGrant).not.toHaveBeenCalled();
  });

  it('rejects untrusted internal callers before consulting the owner', async () => {
    const owner = service();
    await expect(
      routes(owner)[2]!.handle(
        request(
          `/internal/v1/workspace-private-case-evidence/${bindingId}/decisions`,
          { expectedVersion: 1, idempotencyKey: 'http-decision-701', decision: 'ACCEPT' },
          { 'x-markorbit-internal-authorization': 'wrong-secret-value-xxxxxxxxxxxxxxx' }
        )
      )
    ).rejects.toMatchObject({ status: 401, code: 'INTERNAL_SERVICE_UNAUTHORIZED' });
    expect(owner.decide).not.toHaveBeenCalled();
  });

  it('forwards only the path binding identity and bounded decision body', async () => {
    const owner = service();
    await routes(owner)[2]!.handle(
      request(`/internal/v1/workspace-private-case-evidence/${bindingId}/decisions`, {
        expectedVersion: 1,
        idempotencyKey: 'http-decision-701',
        decision: 'ACCEPT'
      })
    );
    expect(owner.decide).toHaveBeenCalledWith(principal, {
      bindingId,
      expectedVersion: 1,
      idempotencyKey: 'http-decision-701',
      decision: 'ACCEPT'
    });
  });

  it('forwards exact accepted binding version to the read-grant owner', async () => {
    const owner = service();
    await routes(owner)[3]!.handle(
      request(`/internal/v1/workspace-private-case-evidence/${bindingId}/read-grants`, {
        expectedVersion: 2
      })
    );
    expect(owner.readGrant).toHaveBeenCalledWith(principal, {
      bindingId,
      expectedVersion: 2
    });
  });

  it('preserves fail-closed owner status and retryability', async () => {
    const owner = service();
    vi.mocked(owner.readGrant).mockRejectedValue(
      new WorkspacePrivateCaseEvidenceError(
        'WORKSPACE_PRIVATE_CASE_EVIDENCE_SOURCE_UNAVAILABLE',
        'forced unavailable',
        503,
        true
      )
    );
    await expect(
      routes(owner)[3]!.handle(
        request(`/internal/v1/workspace-private-case-evidence/${bindingId}/read-grants`, {
          expectedVersion: 2
        })
      )
    ).rejects.toMatchObject({
      status: 503,
      code: 'WORKSPACE_PRIVATE_CASE_EVIDENCE_SOURCE_UNAVAILABLE',
      retryable: true
    });
  });

  it('lists accepted references for the exact path-bound Formal Matter', async () => {
    const owner = service();
    const formalMatterId = 'formal-matter_http-701';
    const value = request(
      `/internal/v1/workspace-private-case-evidence/cases/${formalMatterId}`,
      undefined
    );
    value.method = 'GET';
    value.params = { formalMatterId };
    const response = await routes(owner)[0]!.handle(value);
    expect(response.status).toBe(200);
    expect(owner.listAccepted).toHaveBeenCalledWith(principal, formalMatterId);
  });
});
