import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest, JsonRoute } from '@markorbit/service-kit';
import { describe, expect, it, vi } from 'vitest';
import { csrfToken, type CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayWorkspacePrivateCaseEvidenceRoutes } from '../src/workspace-private-case-evidence-http.js';

const workspaceId = '018f0000-0000-7000-8000-000000001450';
const userId = '018f0000-0000-7000-8000-000000001451';
const membershipId = '018f0000-0000-7000-8000-000000001453';
const bindingId = '018f0000-0000-7000-8000-000000001452';
const formalMatterId = 'formal-matter_oa-1452';
const origin = 'https://lite.example.test';
const secret = 'workspace-private-gateway-secret-32-bytes';
const csrfSecret = 'workspace-private-csrf-secret-32-bytes';
const sha = (digit: string) => digit.repeat(64);

const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session_private_evidence_1452',
  userId,
  workspaceId,
  membershipId,
  role: 'WORKSPACE_ADMIN',
  permissions: ['matter:read'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
};

const referenceList = {
  protocolVersion: '1.0',
  objectType: 'WORKSPACE_PRIVATE_CASE_EVIDENCE_REFERENCE_LIST',
  workspaceId,
  caseId: formalMatterId,
  caseVersion: 1,
  caseSnapshotSha256: sha('1'),
  items: [
    {
      bindingId,
      bindingVersion: 2,
      knowledgeWorkspaceId: 'wsp_private_1452',
      readyPackageId: 'rdp_private_1452',
      caseId: formalMatterId,
      caseVersion: 1,
      caseSnapshotSha256: sha('1'),
      sourceLocators: ['chunk:private:1'],
      methodProvenanceRefs: ['method://oa/private-v1'],
      status: 'ACCEPTED',
      acceptedAt: '2026-10-03T00:00:00.000Z',
      currentness: { formalMatter: 'CURRENT', coreKnowledgeEvidence: 'CURRENT' },
      consequences: {
        officialTruthCreated: false,
        filingAuthorized: false,
        externalActionAuthorized: false
      }
    }
  ],
  materializedAt: '2026-10-03T00:01:00.000Z'
};

const readResult = {
  protocolVersion: '1.0',
  objectType: 'WORKSPACE_PRIVATE_CASE_EVIDENCE_READ_RESULT',
  binding: {
    bindingId,
    bindingVersion: 2,
    caseId: formalMatterId,
    caseVersion: 1,
    caseSnapshotSha256: sha('1')
  },
  authority: {
    coreWorkspaceId: workspaceId,
    knowledgeWorkspaceId: 'wsp_private_1452',
    userId,
    membershipId,
    verifiedAt: '2026-10-03T00:01:00.000Z',
    expiresAt: '2026-10-03T00:02:00.000Z'
  },
  lineage: {
    readyPackageId: 'rdp_private_1452',
    readyPackageDigest: sha('2'),
    coreIntakeId: 'intake_private_1452',
    contentExportSha256: sha('3'),
    rawArtifactId: 'artifact_private_1452',
    rawArtifactSha256: sha('4')
  },
  document: {
    documentId: 'document_private_1452',
    artifactVersion: 1,
    stagingDocumentId: 'staging_private_1452',
    canonicalSha256: sha('5'),
    stagingSha256: sha('5'),
    documentSha256: sha('6'),
    indexedAt: '2026-10-03T00:00:30.000Z'
  },
  currentness: {
    workspaceAuthority: 'CURRENT',
    formalMatter: 'CURRENT',
    coreKnowledgeEvidence: 'CURRENT',
    knowledgeRetrieval: 'CURRENT',
    documentVersion: 'CURRENT'
  },
  locatorSemantics: {
    basis: 'RETRIEVAL_CHUNK',
    pageNumbers: 'UNAVAILABLE',
    textOffsets: 'UNAVAILABLE'
  },
  chunks: [
    {
      locator: 'chunk:private:1',
      chunkId: 'chunk:private:1',
      ordinal: 0,
      headingPath: ['Office action', 'Refusal basis'],
      text: 'Exact private source text.',
      contentSha256: sha('7'),
      contentKind: 'CANONICAL_MARKDOWN_CHUNK',
      pageNumber: null,
      textStartOffset: null,
      textEndOffset: null
    }
  ],
  consequences: {
    officialTruthCreated: false,
    filingAuthorized: false,
    externalActionAuthorized: false
  }
};

function authenticationClient(): CoreAuthenticationClient {
  return {
    issue: vi.fn() as never,
    resolve: vi.fn() as never,
    revoke: vi.fn() as never,
    resolveWorkspace: vi.fn(() => Promise.resolve(principal))
  };
}

function request(method: 'GET' | 'POST', body?: unknown): JsonRequest {
  return {
    method,
    path: '',
    params: { formalMatterId, ...(method === 'POST' ? { bindingId } : {}) },
    query: {},
    body,
    headers: {
      cookie: 'mo_session=opaque-session',
      origin,
      'x-markorbit-workspace-id': workspaceId,
      ...(method === 'POST'
        ? { 'x-markorbit-csrf-token': csrfToken(principal.sessionId, csrfSecret) }
        : {})
    }
  };
}

function route(routes: readonly JsonRoute[], method: 'GET' | 'POST') {
  const found = routes.find((candidate) => candidate.method === method);
  if (!found) throw new Error(`Missing ${method} private evidence route.`);
  return found;
}

function options(fetchImpl: typeof fetch) {
  return {
    coreUrl: 'http://core.test',
    knowledgeUrl: 'http://knowledge.test',
    authenticationClient: authenticationClient(),
    internalServiceSecret: secret,
    csrfSecret,
    allowedOrigins: [origin],
    fetchImpl
  };
}

describe('Gateway Workspace-private Case evidence boundary', () => {
  it('lists only the Core-owned exact Case references for the authenticated Workspace', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(referenceList), { status: 200 }))
    ) as unknown as typeof fetch;
    const response = await route(
      createGatewayWorkspacePrivateCaseEvidenceRoutes(options(fetchImpl)),
      'GET'
    ).handle(request('GET'));
    expect(response.status).toBe(200);
    expect(response.body).toEqual(referenceList);
    expect(response.headers).toMatchObject({ 'cache-control': 'private, no-store' });
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0]!;
    expect(url).toBe(
      `http://core.test/internal/v1/workspace-private-case-evidence/cases/${encodeURIComponent(formalMatterId)}`
    );
    expect(init?.method).toBe('GET');
    expect(new Headers(init?.headers).get('x-markorbit-workspace-id')).toBe(workspaceId);
  });

  it('requires CSRF for the protected exact read and forwards only binding identity and version', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(readResult), { status: 200 }))
    ) as unknown as typeof fetch;
    const routes = createGatewayWorkspacePrivateCaseEvidenceRoutes(options(fetchImpl));
    await expect(
      route(routes, 'POST').handle({
        ...request('POST', { expectedVersion: 2 }),
        headers: {
          cookie: 'mo_session=opaque-session',
          origin,
          'x-markorbit-workspace-id': workspaceId
        }
      })
    ).rejects.toMatchObject({ status: 403 });
    expect(fetchImpl).not.toHaveBeenCalled();

    const response = await route(routes, 'POST').handle(request('POST', { expectedVersion: 2 }));
    expect(response.status).toBe(200);
    expect(response.body).toEqual(readResult);
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0]!;
    expect(url).toBe('http://knowledge.test/api/internal/workspace-private-case-evidence/read');
    expect(init?.body).toBe(JSON.stringify({ bindingId, expectedVersion: 2 }));
  });

  it('fails closed for malformed or cross-authority owner responses', async () => {
    const malformedFetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ ...readResult, chunks: [] }), { status: 200 }))
    ) as unknown as typeof fetch;
    await expect(
      route(
        createGatewayWorkspacePrivateCaseEvidenceRoutes(options(malformedFetch)),
        'POST'
      ).handle(request('POST', { expectedVersion: 2 }))
    ).rejects.toMatchObject({
      status: 503,
      code: 'WORKSPACE_PRIVATE_CASE_EVIDENCE_INVALID_RESPONSE'
    });

    const wrongCaseFetch = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            ...readResult,
            binding: { ...readResult.binding, caseId: 'formal-matter_other' }
          }),
          { status: 200 }
        )
      )
    ) as unknown as typeof fetch;
    await expect(
      route(
        createGatewayWorkspacePrivateCaseEvidenceRoutes(options(wrongCaseFetch)),
        'POST'
      ).handle(request('POST', { expectedVersion: 2 }))
    ).rejects.toMatchObject({ status: 503 });
  });

  it('preserves actionable 403, 404, 409 and 503 owner statuses without treating them as empty', async () => {
    for (const status of [403, 404, 409, 503]) {
      const fetchImpl = vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ code: `OWNER_${status}`, message: 'owner failure' }), {
            status
          })
        )
      ) as unknown as typeof fetch;
      const response = await route(
        createGatewayWorkspacePrivateCaseEvidenceRoutes(options(fetchImpl)),
        'POST'
      ).handle(request('POST', { expectedVersion: 2 }));
      expect(response).toMatchObject({ status, body: { code: `OWNER_${status}` } });
    }
  });
});
