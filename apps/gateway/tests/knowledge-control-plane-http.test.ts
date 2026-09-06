import {
  AuthenticationError,
  type InternalOperatorPrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayKnowledgeControlPlaneRoutes } from '../src/knowledge-control-plane-http.js';

const coreUrl = 'http://core.test';
const knowledgeUrl = 'http://knowledge.test';
const internalServiceSecret = 'integration-916-internal-secret';
const workspaceId = 'workspace-916';
const token = 'browser-session-token-916';
const correlationId = 'correlation-916';
const requestId = 'request-916';
const now = new Date('2026-09-06T14:20:00.000Z');

const operator: InternalOperatorPrincipal = {
  kind: 'INTERNAL_OPERATOR',
  sessionId: 'session-916',
  userId: 'user-916',
  capabilities: ['control-plane:knowledge:read'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
};
const workspace: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: operator.sessionId,
  userId: operator.userId,
  workspaceId,
  membershipId: 'membership-916',
  role: 'READ_ONLY',
  permissions: [],
  sessionExpiresAt: operator.sessionExpiresAt
};
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
      coverage: {
        state: 'PARTIAL',
        reasons: ['No acquisition evidence'],
        expectedArtifactKinds: ['PDF'],
        observedArtifactKinds: [],
        missingExpectedArtifactKinds: ['PDF']
      },
      freshness: {
        state: 'UNOBSERVED',
        lastSuccessfulAcquisitionAt: null,
        ageHours: null,
        maxAgeHours: 24
      },
      schedule: {
        state: 'UNCONFIGURED',
        planCount: 0,
        activePlanCount: 0,
        expectedCadences: [],
        nextScheduledCheckAt: null,
        schedulerErrorCount: 0,
        latestSchedulerError: null
      },
      currentRun: null,
      reliability: {
        windowDays: 30,
        attempts: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        successRate: null,
        lastCompletedAt: null,
        lastFailedAt: null,
        latestTerminalStatus: null,
        latestTerminalAt: null,
        unrecoveredFailure: false
      },
      latency: {
        windowDays: 30,
        publicationToCapture: { sampleSize: 0, p50Ms: null, p95Ms: null, maxMs: null },
        captureToNormalized: { sampleSize: 0, p50Ms: null, p95Ms: null, maxMs: null },
        normalizedToRetrievalReady: { sampleSize: 0, p50Ms: null, p95Ms: null, maxMs: null },
        basis: {
          publication: 'RETRIEVAL_DOCUMENT_PUBLISHED_AT',
          capture: 'RETRIEVAL_DOCUMENT_CAPTURED_AT',
          normalized: 'STAGING_DOCUMENT_CREATED_AT',
          retrievalReady: 'RETRIEVAL_DOCUMENT_INDEXED_AT'
        }
      },
      changeActivity: { updates7d: 0, updates30d: 0, lastObservedChangeAt: null },
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
  },
  futureAdminDetail: { shouldNotReachBrowser: true }
};

function request(headers: Record<string, string> = {}): JsonRequest {
  return {
    method: 'GET',
    path: '/api/internal/control-plane/knowledge/evidence-supply-health',
    params: {},
    query: {},
    body: undefined,
    headers: {
      cookie: `mo_session=${token}`,
      'x-markorbit-workspace-id': workspaceId,
      'x-correlation-id': correlationId,
      'x-request-id': requestId,
      'x-markorbit-principal': 'browser-invented-workspace-principal',
      'x-markorbit-control-plane-principal': 'browser-invented-owner-principal',
      'x-markorbit-internal-authorization': 'browser-invented-service-secret',
      ...headers
    }
  };
}

function response(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  );
}

function makeAuthenticationClient(resolved: WorkspacePrincipal | Error = workspace) {
  const resolveWorkspace = vi.fn(() =>
    resolved instanceof Error ? Promise.reject(resolved) : Promise.resolve(resolved)
  );
  const client: CoreAuthenticationClient = {
    issue: vi.fn(),
    resolve: vi.fn(),
    resolveWorkspace,
    revoke: vi.fn()
  };
  return { client, resolveWorkspace };
}

function routes(ownerFetch: typeof fetch, auth = makeAuthenticationClient().client) {
  return createGatewayKnowledgeControlPlaneRoutes({
    coreUrl,
    knowledgeUrl,
    internalServiceSecret,
    authenticationClient: auth,
    fetchImpl: ownerFetch,
    now: () => now
  });
}

function route(ownerFetch: typeof fetch, auth = makeAuthenticationClient().client) {
  const found = routes(ownerFetch, auth).find(
    (candidate) =>
      candidate.method === 'GET' &&
      candidate.path === '/api/internal/control-plane/knowledge/evidence-supply-health'
  );
  if (!found) throw new Error('Missing Knowledge Control Plane route.');
  return found;
}

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function operatorResponse(principal: InternalOperatorPrincipal = operator, status = 200) {
  return response(principal, status);
}

function requestBody(init?: RequestInit): string {
  const body = init?.body;
  if (typeof body !== 'string') throw new Error('Expected string request body.');
  return body;
}

function decodeOwnerPrincipal(value: string | null) {
  if (!value) throw new Error('Missing owner principal.');
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Gateway Knowledge Control Plane', () => {
  it('requires exact Knowledge authority and an independent Workspace Principal', async () => {
    const coreFetch = vi.fn((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      expect(requestUrl(input)).toBe(
        `${coreUrl}/internal/control-plane/operator-principals/resolve`
      );
      expect(JSON.parse(requestBody(init))).toEqual({
        token,
        requiredCapability: 'control-plane:knowledge:read'
      });
      const headers = new Headers(init?.headers);
      expect(headers.get('x-markorbit-internal-authorization')).toBe(internalServiceSecret);
      expect(headers.get('x-markorbit-principal')).toBeNull();
      return operatorResponse();
    });
    vi.stubGlobal('fetch', coreFetch);
    const auth = makeAuthenticationClient();
    const ownerFetch: typeof fetch = vi.fn<typeof fetch>((input, init) => {
      expect(requestUrl(input)).toBe(
        `${knowledgeUrl}/api/internal/control-plane/evidence-supply-health?workspaceId=${workspaceId}`
      );
      const headers = new Headers(init?.headers);
      expect(headers.get('x-markorbit-internal-authorization')).toBe(internalServiceSecret);
      expect(headers.get('x-markorbit-principal')).toBeNull();
      const encoded = headers.get('x-markorbit-control-plane-principal');
      expect(encoded).not.toBe('browser-invented-owner-principal');
      expect(decodeOwnerPrincipal(encoded)).toEqual({
        schemaVersion: 1,
        principal: {
          kind: 'CONTROL_PLANE_KNOWLEDGE_READ',
          caller: 'MARKORBIT_GATEWAY',
          workspaceId,
          authority: 'control-plane:knowledge:read',
          expiresAt: '2026-09-06T14:21:00.000Z'
        }
      });
      return response(owner);
    });

    const result = await route(ownerFetch, auth.client).handle(request());

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ owner: 'KNOWLEDGE', workspaceId, summary: { total: 1 } });
    expect(JSON.stringify(result.body)).not.toContain('futureAdminDetail');
    expect(auth.resolveWorkspace).toHaveBeenCalledWith(token, workspaceId, correlationId);
    expect(workspace.permissions).toEqual([]);
    expect(ownerFetch).toHaveBeenCalledTimes(1);
  });

  it('denies non-Knowledge operator authority before Workspace or owner reads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => operatorResponse({ ...operator, capabilities: ['control-plane:data:read'] }))
    );
    const auth = makeAuthenticationClient();
    const ownerFetch = vi.fn<typeof fetch>();

    const result = await route(ownerFetch, auth.client).handle(request());

    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(auth.resolveWorkspace).not.toHaveBeenCalled();
    expect(ownerFetch).not.toHaveBeenCalled();
  });

  it('requires workspace context before any authority read', async () => {
    const coreFetch = vi.fn();
    vi.stubGlobal('fetch', coreFetch);
    const auth = makeAuthenticationClient();
    const ownerFetch = vi.fn<typeof fetch>();

    await expect(
      route(ownerFetch, auth.client).handle(request({ 'x-markorbit-workspace-id': '' }))
    ).rejects.toMatchObject({
      status: 400,
      code: 'WORKSPACE_CONTEXT_REQUIRED'
    });
    expect(coreFetch).not.toHaveBeenCalled();
    expect(auth.resolveWorkspace).not.toHaveBeenCalled();
    expect(ownerFetch).not.toHaveBeenCalled();
  });

  it('fails closed on Workspace membership denial and never contacts Knowledge', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => operatorResponse())
    );
    const auth = makeAuthenticationClient(
      new AuthenticationError('MEMBERSHIP_REQUIRED', 'Workspace membership is required.')
    );
    const ownerFetch = vi.fn<typeof fetch>();

    await expect(route(ownerFetch, auth.client).handle(request())).rejects.toMatchObject({
      status: 403,
      code: 'MEMBERSHIP_REQUIRED'
    });
    expect(ownerFetch).not.toHaveBeenCalled();
  });

  it('rejects inconsistent operator and Workspace identities before owner read', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => operatorResponse())
    );
    const auth = makeAuthenticationClient({ ...workspace, userId: 'other-user' });
    const ownerFetch = vi.fn<typeof fetch>();

    await expect(route(ownerFetch, auth.client).handle(request())).rejects.toMatchObject({
      status: 503,
      code: 'KNOWLEDGE_PRINCIPAL_MISMATCH'
    });
    expect(ownerFetch).not.toHaveBeenCalled();
  });

  it('fails closed on malformed or cross-workspace successful owner payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => operatorResponse())
    );

    await expect(
      route(vi.fn(() => response({ ...owner, access: 'WRITE' }))).handle(request())
    ).rejects.toMatchObject({ status: 503, code: 'KNOWLEDGE_OWNER_CONTRACT_MISMATCH' });
    await expect(
      route(vi.fn(() => response({ ...owner, workspaceId: 'workspace-other' }))).handle(request())
    ).rejects.toMatchObject({ status: 503, code: 'KNOWLEDGE_OWNER_CONTRACT_MISMATCH' });
  });

  it('keeps owner non-2xx and transport unavailability explicit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => operatorResponse())
    );
    const ownerFailure = vi.fn<typeof fetch>(() =>
      response({ code: 'CONTROL_PLANE_OWNER_AUTH_NOT_CONFIGURED' }, 503)
    );
    const failed = await route(ownerFailure).handle(request());
    expect(failed.status).toBe(503);
    expect(failed.body).toEqual({ code: 'CONTROL_PLANE_OWNER_AUTH_NOT_CONFIGURED' });

    await expect(
      route(vi.fn<typeof fetch>(() => Promise.reject(new Error('offline')))).handle(request())
    ).rejects.toMatchObject({ status: 503, code: 'KNOWLEDGE_OWNER_UNAVAILABLE' });
  });

  it('exposes exactly one Knowledge Control Plane GET route and no generic proxy', () => {
    const controlPlaneRoutes = routes(vi.fn<typeof fetch>())
      .filter((candidate) => candidate.path.includes('/control-plane/knowledge'))
      .map((candidate) => `${candidate.method} ${candidate.path}`);
    expect(controlPlaneRoutes).toEqual([
      'GET /api/internal/control-plane/knowledge/evidence-supply-health'
    ]);
    expect(controlPlaneRoutes.some((value) => value.includes('*'))).toBe(false);
    expect(controlPlaneRoutes.some((value) => value.includes(':path'))).toBe(false);
  });
});
