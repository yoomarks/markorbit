import { describe, expect, it, vi } from 'vitest';
import type { JsonRequest } from '@markorbit/service-kit';

import {
  HttpCoreWorkspaceTrademarkIssueIntelligenceReaderV1,
  WorkspaceTrademarkIssueIntelligenceReaderError,
  type WorkspaceTrademarkIssueIntelligenceReadQueryV1
} from '../src/workspace-trademark-issue-intelligence-http-reader.js';
import { createWorkspaceTrademarkIssueIntelligenceReadinessRoutesV1 } from '../src/workspace-trademark-issue-intelligence-readiness-http.js';
import {
  WorkspaceTrademarkIssueIntelligenceReadinessServiceV1,
  workspaceTrademarkIssueIntelligenceReadinessNoAuthorityV1
} from '../src/workspace-trademark-issue-intelligence-readiness.js';

const SECRET = 'capability-workspace-brain-secret-32-bytes';
const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const OTHER_WORKSPACE = '22222222-2222-4222-8222-222222222222';
const INTELLIGENCE_ID = `brain-intelligence_${'a'.repeat(64)}` as const;
const EVIDENCE_ID = `brain-knowledge-evidence_${'b'.repeat(64)}` as const;
const PRIMITIVE_ID = `brain-intelligence-primitive_${'1'.repeat(64)}` as const;
const QUERY = { workspaceId: WORKSPACE, intelligenceId: INTELLIGENCE_ID } as const;

function intelligence(
  status: 'INTERPRETED' | 'INSUFFICIENT_EVIDENCE' | 'CONFLICTED' = 'INTERPRETED'
) {
  const primitives =
    status === 'INSUFFICIENT_EVIDENCE'
      ? []
      : [
          {
            primitiveId: PRIMITIVE_ID,
            kind: 'REQUIREMENT' as const,
            summary: 'A governed requirement was extracted.',
            jurisdiction: 'US',
            confidence: 0.9,
            uncertainty: 'LOW' as const,
            evidenceRefs: [EVIDENCE_ID]
          }
        ];
  return {
    schemaVersion: 1 as const,
    intelligenceId: INTELLIGENCE_ID,
    workspaceId: WORKSPACE,
    task: 'TRADEMARK_ISSUE_EXTRACTION' as const,
    status,
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
    primitives,
    explanation: 'Bounded explanation.',
    interpreter: {
      profileId: 'workspace-trademark-issue-interpreter',
      version: '1.0.0',
      policyProfileId: 'brain-policy-profile-v1'
    },
    generatedAt: '2026-09-15T00:01:00.000Z'
  };
}

function fetcher(payload: unknown, status = 200, observed?: { url?: string; init?: RequestInit }) {
  return ((input: string | URL | Request, init?: RequestInit) => {
    if (observed) {
      observed.url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (init) observed.init = init;
    }
    return Promise.resolve(
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json' }
      })
    );
  }) as typeof fetch;
}

function reader(payload: unknown, status = 200, observed?: { url?: string; init?: RequestInit }) {
  return new HttpCoreWorkspaceTrademarkIssueIntelligenceReaderV1(
    'http://core.internal/',
    SECRET,
    fetcher(payload, status, observed)
  );
}

function request(body: unknown, authorization: string | undefined = SECRET): JsonRequest {
  return {
    method: 'POST',
    path: '/internal/v1/brain-intelligence/workspace-trademark-issues/readiness',
    params: {},
    query: {},
    headers: { 'x-markorbit-internal-authorization': authorization },
    body
  };
}
describe('Workspace Brain intelligence Capability readiness', () => {
  it('reads the exact durable Workspace intelligence from Core', async () => {
    const observed: { url?: string; init?: RequestInit } = {};
    const value = intelligence();
    await expect(reader(value, 200, observed).read(QUERY)).resolves.toEqual(value);
    expect(observed.url).toBe(
      'http://core.internal/internal/v1/brain-intelligence/workspace-trademark-issues/read'
    );
    expect(observed.init?.method).toBe('POST');
    expect(observed.init?.headers).toMatchObject({
      'content-type': 'application/json',
      'x-markorbit-internal-authorization': SECRET
    });
    expect(JSON.parse(observed.init?.body as string)).toEqual(QUERY);
  });

  it('preserves not-found isolation and fails closed on owner identity drift', async () => {
    await expect(
      reader({ code: 'BRAIN_INTELLIGENCE_NOT_FOUND' }, 404).read(QUERY)
    ).resolves.toBeUndefined();

    await expect(
      reader({ ...intelligence(), workspaceId: OTHER_WORKSPACE }).read(QUERY)
    ).rejects.toMatchObject({ code: 'IDENTITY_MISMATCH', retryable: false });
  });

  it('rejects expanded or malformed references before contacting Core', async () => {
    const observed = vi.fn();
    const never = ((input: string | URL | Request, init?: RequestInit) => {
      observed(input, init);
      return Promise.reject(new Error('unexpected Core request'));
    }) as typeof fetch;
    const instance = new HttpCoreWorkspaceTrademarkIssueIntelligenceReaderV1(
      'http://core.internal',
      SECRET,
      never
    );
    await expect(
      instance.read({
        ...QUERY,
        includeOtherWorkspaces: true
      } as unknown as WorkspaceTrademarkIssueIntelligenceReadQueryV1)
    ).rejects.toMatchObject({ code: 'INVALID_QUERY' });
    await expect(
      instance.read({ workspaceId: 'bad', intelligenceId: INTELLIGENCE_ID })
    ).rejects.toMatchObject({ code: 'INVALID_QUERY' });
    expect(observed).not.toHaveBeenCalled();
  });

  it('maps Core dependency outage without fallback', async () => {
    const outage: typeof fetch = () => Promise.reject(new Error('connection refused'));
    await expect(
      new HttpCoreWorkspaceTrademarkIssueIntelligenceReaderV1(
        'http://core.internal',
        SECRET,
        outage
      ).read(QUERY)
    ).rejects.toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE', retryable: true });
  });

  it('projects only compact lineage for interpreted intelligence and defers freshness to WIF-08', async () => {
    const service = new WorkspaceTrademarkIssueIntelligenceReadinessServiceV1({
      read: () => Promise.resolve(intelligence())
    });
    const result = await service.evaluate(QUERY);

    expect(result).toMatchObject({
      status: 'READY_FOR_CAPABILITY_BINDING',
      ready: true,
      reference: QUERY,
      intelligence: {
        intelligenceId: INTELLIGENCE_ID,
        workspaceId: WORKSPACE,
        evidenceRefs: [EVIDENCE_ID],
        primitiveRefs: [PRIMITIVE_ID]
      },
      freshness: { status: 'NOT_EVALUATED', plannedStage: 'WIF-08' },
      retryable: false,
      authority: workspaceTrademarkIssueIntelligenceReadinessNoAuthorityV1
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('Bounded explanation.');
    expect(serialized).not.toContain('A governed requirement was extracted.');
    expect(Object.values(result.authority).every((value) => value === false)).toBe(true);
  });

  it.each(['INSUFFICIENT_EVIDENCE', 'CONFLICTED'] as const)(
    'blocks %s intelligence before Capability binding',
    async (status) => {
      const service = new WorkspaceTrademarkIssueIntelligenceReadinessServiceV1({
        read: () => Promise.resolve(intelligence(status))
      });
      await expect(service.evaluate(QUERY)).resolves.toMatchObject({
        status: 'BLOCKED_BY_INTELLIGENCE_STATUS',
        ready: false,
        freshness: { status: 'NOT_EVALUATED', plannedStage: 'WIF-08' }
      });
    }
  );

  it('preserves not-found and fail-closed reader errors in readiness semantics', async () => {
    const missing = new WorkspaceTrademarkIssueIntelligenceReadinessServiceV1({
      read: () => Promise.resolve(undefined)
    });
    await expect(missing.evaluate(QUERY)).resolves.toMatchObject({
      status: 'NOT_FOUND',
      ready: false,
      retryable: false
    });

    const integrity = new WorkspaceTrademarkIssueIntelligenceReadinessServiceV1({
      read: () =>
        Promise.reject(
          new WorkspaceTrademarkIssueIntelligenceReaderError('IDENTITY_MISMATCH', 'forced')
        )
    });
    await expect(integrity.evaluate(QUERY)).resolves.toMatchObject({
      status: 'BRAIN_INTELLIGENCE_INTEGRITY_FAILURE',
      ready: false,
      retryable: false
    });

    const unavailable = new WorkspaceTrademarkIssueIntelligenceReadinessServiceV1({
      read: () =>
        Promise.reject(
          new WorkspaceTrademarkIssueIntelligenceReaderError(
            'DEPENDENCY_UNAVAILABLE',
            'forced',
            true
          )
        )
    });
    await expect(unavailable.evaluate(QUERY)).resolves.toMatchObject({
      status: 'DEPENDENCY_UNAVAILABLE',
      ready: false,
      retryable: true
    });
  });

  it('exposes readiness through authenticated internal HTTP without creating authority', async () => {
    const service = new WorkspaceTrademarkIssueIntelligenceReadinessServiceV1({
      read: () => Promise.resolve(intelligence())
    });
    const route = createWorkspaceTrademarkIssueIntelligenceReadinessRoutesV1({
      internalServiceSecret: SECRET,
      readiness: service
    })[0]!;

    const response = await route.handle(request(QUERY));
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'READY_FOR_CAPABILITY_BINDING',
      ready: true,
      freshness: { status: 'NOT_EVALUATED', plannedStage: 'WIF-08' },
      authority: workspaceTrademarkIssueIntelligenceReadinessNoAuthorityV1
    });
  });

  it('rejects an unauthenticated readiness caller before touching Brain', async () => {
    const read = vi.fn(() => Promise.resolve(intelligence()));
    const route = createWorkspaceTrademarkIssueIntelligenceReadinessRoutesV1({
      internalServiceSecret: SECRET,
      readiness: new WorkspaceTrademarkIssueIntelligenceReadinessServiceV1({ read })
    })[0]!;

    const unauthorized = request(QUERY);
    unauthorized.headers = {};
    await expect(route.handle(unauthorized)).rejects.toMatchObject({
      status: 401,
      code: 'INTERNAL_SERVICE_UNAUTHORIZED'
    });
    expect(read).not.toHaveBeenCalled();
  });

  it('maps fail-closed readiness outcomes to bounded HTTP statuses', async () => {
    const outcomes = [
      ['NOT_FOUND', 404],
      ['BLOCKED_BY_INTELLIGENCE_STATUS', 409],
      ['BRAIN_INTELLIGENCE_INTEGRITY_FAILURE', 409],
      ['DEPENDENCY_UNAVAILABLE', 503]
    ] as const;

    for (const [status, httpStatus] of outcomes) {
      const readiness = {
        evaluate: () =>
          Promise.resolve({
            schemaVersion: 1 as const,
            status,
            ready: false,
            reference: QUERY,
            reason: 'forced',
            freshness: { status: 'NOT_EVALUATED' as const, plannedStage: 'WIF-08' as const },
            retryable: status === 'DEPENDENCY_UNAVAILABLE',
            authority: workspaceTrademarkIssueIntelligenceReadinessNoAuthorityV1
          })
      };
      const route = createWorkspaceTrademarkIssueIntelligenceReadinessRoutesV1({
        internalServiceSecret: SECRET,
        readiness
      })[0]!;
      const response = await route.handle(request(QUERY));
      expect(response.status).toBe(httpStatus);
      expect(response.body).toMatchObject({ status, ready: false });
    }
  });

  it('rejects expanded readiness queries before contacting Core', async () => {
    const observed = vi.fn();
    const never = ((input: string | URL | Request, init?: RequestInit) => {
      observed(input, init);
      return Promise.reject(new Error('unexpected Core request'));
    }) as typeof fetch;
    const readiness = new WorkspaceTrademarkIssueIntelligenceReadinessServiceV1(
      new HttpCoreWorkspaceTrademarkIssueIntelligenceReaderV1('http://core.internal', SECRET, never)
    );
    const route = createWorkspaceTrademarkIssueIntelligenceReadinessRoutesV1({
      internalServiceSecret: SECRET,
      readiness
    })[0]!;

    const response = await route.handle(request({ ...QUERY, includeOtherWorkspaces: true }));
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      status: 'BLOCKED_BY_INVALID_REFERENCE',
      ready: false
    });
    expect(observed).not.toHaveBeenCalled();
  });
});
