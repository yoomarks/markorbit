import { describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { EntitlementGrantV1 } from '@markorbit/contracts/workspace-commercial';
import {
  DATA_ENGINE_DISCOVERY_CONTRACT_VERSION,
  noApplicantDiscoveryAuthorityConsequencesV1
} from '@markorbit/contracts/data-engine-discovery';
import { HttpError, type JsonRequest } from '@markorbit/service-kit';
import {
  InMemoryWorkspaceCommercialRepositoryV1,
  WorkspaceCommercialServiceV1
} from '../../../services/core/src/workspace-commercial.js';
import { createWorkspaceCommercialRoutesV1 } from '../../../services/core/src/workspace-commercial-http.js';
import { CurrentWorkspaceAuthorityService } from '../../../services/core/src/current-workspace-authority.js';
import {
  InMemoryUserRepository,
  InMemoryWorkspaceRepository,
  InMemoryMembershipRepository
} from '../../../services/core/src/identity.js';
import { createGatewayProductLoopRoutes } from '../src/product-loop-http.js';
import { createRuntime } from '../src/index.js';
import { csrfToken } from '../src/auth.js';
import type {
  USApplicantNameAdmission,
  USApplicantNameAdmissionOptions
} from '../src/data-engine-applicant-admission.js';

const instant = '2026-10-09T12:00:00.000Z';
const secret = 'm20-fixture-internal-service-secret-012345';
const actor: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: '11111111-1111-4111-8111-111111111111',
  workspaceId: '27272727-2727-4272-8272-272727272727',
  membershipId: '33333333-3333-4333-8333-333333333333',
  sessionId: 'm20-test-session',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read']
};

const admission: USApplicantNameAdmission = {
  revision: 'AUDIT_FIXTURE_ONLY_NOT_PRODUCTION_APPROVAL',
  entitlementKey: 'fixture.us.applicant.search.portfolio',
  datasetVersion: DATA_ENGINE_DISCOVERY_CONTRACT_VERSION,
  sourceVersion: 'us-serving-epoch:' + 'e'.repeat(64),
  licenceReference: 'fixture-only-licence-for-search-portfolio',
  permittedUse: 'SEARCH:PORTFOLIO',
  readiness: 'ACCEPTED',
  coverageThrough: '2026-10-09T00:00:00.000Z',
  maximumCoverageAgeMs: 86_400_000,
  validUntil: '2026-10-10T00:00:00.000Z'
};

function providerEnvelope(url: URL) {
  const context = {
    requester_workspace_id: url.searchParams.get('requester_workspace_id')!,
    request_id: 'm20-hop'
  };
  const snapshot = {
    source_version: admission.sourceVersion,
    observed_at: admission.coverageThrough
  };
  const query = {
    contract_version: DATA_ENGINE_DISCOVERY_CONTRACT_VERSION,
    request_context: context,
    jurisdiction: 'US',
    input: { kind: 'NAME', value: url.searchParams.get('name')! },
    ordering: ['applicant_candidate_id ASC'],
    ranking_authority: 'NONE',
    limits: { page_size: Number(url.searchParams.get('page_size')), max_results: 100 },
    query_hash: 'sha256:' + 'a'.repeat(64)
  };
  return {
    contract_version: 'MARKORBIT_DATA_ENGINE_INTEGRATION_V1',
    engine_version: 'M1.9-fixture',
    source_owner: 'MARKORBIT_DATA_ENGINE',
    jurisdiction: 'US',
    resource_kind: 'APPLICANT_IDENTITY_DISCOVERY',
    authority: 'DATA_ENGINE_FACT_READ_MODEL',
    legal_conclusion: false,
    fact_state: 'observed',
    payload: {
      query,
      source_snapshot: snapshot,
      results: [],
      next_cursor: null,
      provenance: {
        query_hash: query.query_hash,
        request_context: context,
        source_snapshot: snapshot,
        engine_version: 'M1.9-fixture',
        result_count: 0,
        has_more: false,
        query
      },
      authority_consequences: noApplicantDiscoveryAuthorityConsequencesV1
    }
  };
}

async function fixture() {
  const users = new InMemoryUserRepository();
  const workspaces = new InMemoryWorkspaceRepository();
  const memberships = new InMemoryMembershipRepository(users, workspaces);
  await users.create({
    userId: actor.userId,
    email: 'fixture@example.test',
    displayName: 'Fixture'
  });
  await workspaces.create({ workspaceId: actor.workspaceId, name: 'Fixture', slug: 'm20-fixture' });
  await memberships.create({
    membershipId: actor.membershipId,
    userId: actor.userId,
    workspaceId: actor.workspaceId,
    role: actor.role
  });
  const repository = new InMemoryWorkspaceCommercialRepositoryV1();
  const service = new WorkspaceCommercialServiceV1(repository, () => Promise.resolve(undefined));
  const grant: EntitlementGrantV1 = {
    schemaVersion: 1,
    grantId: 'm20-fixture-grant',
    version: 1,
    subject: { scope: 'WORKSPACE', workspaceId: actor.workspaceId },
    entitlement: {
      key: admission.entitlementKey,
      subjectScope: 'WORKSPACE',
      value: { kind: 'BOOLEAN', enabled: true }
    },
    status: 'ACTIVE',
    sourceType: 'MANUAL',
    sourceRef: 'fixture-only',
    effectiveFrom: '2026-09-01T00:00:00.000Z',
    recordedAt: '2026-09-01T00:00:00.000Z'
  };
  await repository.appendGrant(grant);
  const coreRoute = createWorkspaceCommercialRoutesV1({
    service,
    currentWorkspaceAuthority: new CurrentWorkspaceAuthorityService({
      users,
      workspaces,
      memberships
    }),
    internalServiceSecret: secret
  }).find((route) => route.path.endsWith('/entitlements/resolve'))!;
  const coreFetch = vi.fn<typeof fetch>(async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    try {
      const response = await coreRoute.handle({
        method: 'POST',
        path: url.pathname,
        params: { workspaceId: url.pathname.split('/')[3]! },
        query: {},
        headers: Object.fromEntries(request.headers),
        body: (await request.json()) as unknown
      });
      return new Response(JSON.stringify(response.body), { status: response.status });
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
      return new Response(JSON.stringify({ code: error.code }), { status: error.status });
    }
  });
  const providerFetch = vi.fn<typeof fetch>((input) =>
    Promise.resolve(
      new Response(JSON.stringify(providerEnvelope(new URL(new Request(input).url))), {
        status: 200,
        headers: {
          'x-request-id': 'm20-hop',
          'x-correlation-id': 'm20-hop',
          'x-markorbit-contract-version': 'MARKORBIT_DATA_ENGINE_INTEGRATION_V1',
          'x-markorbit-source-owner': 'MARKORBIT_DATA_ENGINE'
        }
      })
    )
  );
  const readAdmission = vi.fn<USApplicantNameAdmissionOptions['readAdmission']>(() =>
    Promise.resolve(structuredClone(admission))
  );
  const options = {
    liteUrl: 'https://lite.test',
    csrfSecret: secret,
    allowedOrigins: ['https://lite.test'],
    internalServiceSecret: secret,
    authenticationClient: {
      resolveWorkspace: vi.fn(() => Promise.resolve(actor)),
      issue: () => Promise.reject(new Error('Unused')),
      resolve: () => Promise.reject(new Error('Unused')),
      revoke: () => Promise.resolve()
    },
    dataEngineUrl: 'https://data.test',
    dataEngineApiKey: secret,
    dataEngineFetchImpl: providerFetch,
    usApplicantNameAdmission: {
      core: { coreUrl: 'https://core.test', internalServiceSecret: secret, fetchImpl: coreFetch },
      readAdmission,
      now: () => new Date(instant)
    }
  };
  const route = createGatewayProductLoopRoutes(options).find(
    (route) => route.path === '/api/data-engine/applicants/discover'
  )!;
  const request: JsonRequest = {
    method: 'POST',
    path: route.path,
    params: {},
    query: {},
    headers: {
      cookie: 'mo_session=m20-test-session',
      origin: 'https://lite.test',
      'x-markorbit-workspace-id': actor.workspaceId,
      'x-markorbit-csrf-token': csrfToken(actor.sessionId, secret),
      'x-request-id': 'm20-hop'
    },
    body: { jurisdiction: 'US', input: { kind: 'NAME', value: 'Orbit LLC' }, pageSize: 10 }
  };
  return {
    route,
    request,
    repository,
    grant,
    options,
    coreFetch,
    providerFetch,
    readAdmission,
    memberships
  };
}

describe('US NAME data-use admission through real Core authority and grant resolution', () => {
  it('wires the admission and provider configuration through the real Gateway HTTP runtime', async () => {
    const f = await fixture();
    const gateway = createRuntime({ ...f.options, port: 0 });
    await gateway.start();
    try {
      const response = await fetch(`http://127.0.0.1:${gateway.listeningPort}${f.request.path}`, {
        method: 'POST',
        headers: {
          ...(f.request.headers as Record<string, string>),
          'content-type': 'application/json'
        },
        body: JSON.stringify(f.request.body)
      });
      expect(response.status).toBe(200);
      expect(
        ((await response.json()) as ReturnType<typeof providerEnvelope>).payload.results
      ).toEqual([]);
      expect(f.coreFetch).toHaveBeenCalledOnce();
      expect(f.providerFetch).toHaveBeenCalledOnce();
    } finally {
      await gateway.stop();
    }
  });
  it('allows a source-pinned empty page and binds server Workspace/key/current time before provider read', async () => {
    const f = await fixture();
    const result = await f.route.handle(f.request);
    expect(result.status).toBe(200);
    expect((result.body as ReturnType<typeof providerEnvelope>).payload.results).toEqual([]);
    expect(result.headers?.['x-data-engine-source-owner']).toBe('MARKORBIT_DATA_ENGINE');
    expect(f.coreFetch).toHaveBeenCalledOnce();
    const [url, init] = f.coreFetch.mock.calls[0]!;
    expect(new Request(url, init).url).toContain(
      `/internal/workspaces/${actor.workspaceId}/commercial/entitlements/resolve`
    );
    expect((await new Request(url, init).json()) as unknown).toEqual({
      userId: actor.userId,
      membershipId: actor.membershipId,
      subjectScope: 'WORKSPACE',
      entitlementKey: admission.entitlementKey,
      asOf: instant
    });
    expect(f.coreFetch.mock.invocationCallOrder[0]).toBeLessThan(
      f.providerFetch.mock.invocationCallOrder[0]!
    );
    expect(f.providerFetch.mock.calls[0]?.[0]).toContain(
      `requester_workspace_id=${actor.workspaceId}`
    );
  });

  it('checks the current grant again for a continuation after revocation, without reusing earlier data/decision', async () => {
    const f = await fixture();
    await f.route.handle(f.request);
    await f.repository.appendGrant({
      ...f.grant,
      version: 2,
      status: 'REVOKED',
      recordedAt: '2026-10-09T11:00:00.000Z'
    });
    await expect(
      f.route.handle({
        ...f.request,
        body: { ...(f.request.body as object), cursor: 'old-cursor' }
      })
    ).rejects.toMatchObject({ status: 403, code: 'DATA_ENGINE_DATA_USE_DENIED' });
    expect(f.coreFetch).toHaveBeenCalledTimes(2);
    expect(f.readAdmission).toHaveBeenCalledTimes(2);
    expect(f.providerFetch).toHaveBeenCalledOnce();
  });

  it.each(['REVOKED', 'EXPIRED', 'SUSPENDED'] as const)(
    'rejects a current %s grant despite an active historical version',
    async (status) => {
      const f = await fixture();
      await f.repository.appendGrant({
        ...f.grant,
        version: 2,
        status,
        recordedAt: '2026-10-05T00:00:00.000Z'
      });
      await expect(f.route.handle(f.request)).rejects.toMatchObject({ status: 403 });
      expect(f.providerFetch).not.toHaveBeenCalled();
    }
  );

  it.each(['missing', 'wrong-workspace', 'false', 'effective-to'] as const)(
    'does not fetch facts for %s entitlement',
    async (kind) => {
      const f = await fixture();
      const updated = { ...f.grant, version: 2, recordedAt: '2026-10-05T00:00:00.000Z' };
      if (kind === 'missing') updated.entitlement = { ...updated.entitlement, key: 'another.key' };
      if (kind === 'wrong-workspace')
        updated.subject = { scope: 'WORKSPACE', workspaceId: 'other-workspace' };
      if (kind === 'false')
        updated.entitlement = {
          ...updated.entitlement,
          value: { kind: 'BOOLEAN', enabled: false }
        };
      if (kind === 'effective-to') updated.effectiveTo = instant;
      await f.repository.appendGrant(updated);
      await expect(f.route.handle(f.request)).rejects.toMatchObject({ status: 403 });
      expect(f.providerFetch).not.toHaveBeenCalled();
    }
  );

  it('rechecks current membership even when the authenticated principal was previously allowed', async () => {
    const f = await fixture();
    await f.memberships.suspend(actor.workspaceId, actor.userId, 1);
    await expect(f.route.handle(f.request)).rejects.toMatchObject({ status: 409 });
    expect(f.providerFetch).not.toHaveBeenCalled();
  });

  it('does not deliver a previous Workspace response when another Workspace reuses the consumer credential', async () => {
    const f = await fixture();
    await f.route.handle(f.request);
    f.options.authenticationClient.resolveWorkspace.mockResolvedValue({
      ...actor,
      workspaceId: '44444444-4444-4444-8444-444444444444'
    });
    await expect(
      f.route.handle({
        ...f.request,
        headers: {
          ...f.request.headers,
          'x-markorbit-workspace-id': '44444444-4444-4444-8444-444444444444'
        }
      })
    ).rejects.toMatchObject({ status: 403 });
    expect(f.coreFetch).toHaveBeenCalledTimes(2);
    expect(f.providerFetch).toHaveBeenCalledOnce();
  });

  it('rejects a historical instant in query parameters without owner calls', async () => {
    const f = await fixture();
    await expect(
      f.route.handle({ ...f.request, query: { asOf: '2026-10-01T00:00:00.000Z' } })
    ).rejects.toMatchObject({ status: 400 });
    expect(f.coreFetch).not.toHaveBeenCalled();
    expect(f.providerFetch).not.toHaveBeenCalled();
  });

  it.each([
    'requestContext',
    'subject',
    'subjectScope',
    'entitlementKey',
    'grant',
    'asOf',
    'evaluatedAt',
    'action',
    'purpose',
    'sourceVersion',
    'admission'
  ])('rejects caller %s claims before either owner call', async (field) => {
    const f = await fixture();
    await expect(
      f.route.handle({ ...f.request, body: { ...(f.request.body as object), [field]: 'forged' } })
    ).rejects.toMatchObject({ status: 400, code: 'ACTOR_SPOOF_REJECTED' });
    expect(f.coreFetch).not.toHaveBeenCalled();
    expect(f.providerFetch).not.toHaveBeenCalled();
  });

  it.each([
    { licenceReference: '' },
    { readiness: 'UNKNOWN' },
    { datasetVersion: 'incompatible' },
    { coverageThrough: '2026-10-01T00:00:00Z' },
    { coverageThrough: 'unknown' },
    { coverageThrough: '2026-10-10T00:00:00Z' },
    { maximumCoverageAgeMs: -1 },
    { validUntil: instant },
    { revision: '' },
    { sourceVersion: '' }
  ])('fails closed for unavailable source/admission evidence %j', async (override) => {
    const f = await fixture();
    f.readAdmission.mockResolvedValue({ ...admission, ...override } as USApplicantNameAdmission);
    await expect(f.route.handle(f.request)).rejects.toMatchObject({
      status: 503,
      code: 'DATA_ENGINE_DATA_USE_UNAVAILABLE'
    });
    expect(f.providerFetch).not.toHaveBeenCalled();
    expect(f.coreFetch).not.toHaveBeenCalled();
  });

  it('rejects other permitted uses instead of treating SEARCH as marketing or Creator permission', async () => {
    const f = await fixture();
    f.readAdmission.mockResolvedValue({
      ...admission,
      permittedUse: 'CAPABILITY_USE:CREATOR'
    } as never);
    await expect(f.route.handle(f.request)).rejects.toMatchObject({ status: 403 });
    expect(f.providerFetch).not.toHaveBeenCalled();
  });

  it.each(['subject', 'key', 'time', 'lineage', 'version'] as const)(
    'rejects an unbound Core %s response',
    async (kind) => {
      const f = await fixture();
      const result = await new WorkspaceCommercialServiceV1(f.repository, () =>
        Promise.resolve(undefined)
      ).resolveEntitlement(f.grant.subject, admission.entitlementKey, instant);
      if (kind === 'subject')
        result.subject = { scope: 'WORKSPACE', workspaceId: 'other-workspace' };
      if (kind === 'key') result.key = 'another-key';
      if (kind === 'time') result.resolvedAt = '2026-10-01T00:00:00.000Z';
      if (kind === 'lineage') result.contributingGrantRefs = [];
      if (kind === 'version') result.contributingGrantRefs = [{ grantId: 'grant', version: 0 }];
      f.coreFetch.mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }));
      await expect(f.route.handle(f.request)).rejects.toMatchObject({
        status: 503,
        code: 'DATA_ENGINE_DATA_USE_EVALUATION_INVALID'
      });
      expect(f.providerFetch).not.toHaveBeenCalled();
    }
  );

  it('preserves Core outage as unavailable without querying or falling back to previous facts', async () => {
    const f = await fixture();
    f.coreFetch.mockRejectedValue(new Error('offline'));
    await expect(f.route.handle(f.request)).rejects.toMatchObject({ status: 503 });
    expect(f.providerFetch).not.toHaveBeenCalled();
  });

  it('preserves the bounded provider rate limit instead of returning an empty fallback', async () => {
    const f = await fixture();
    f.providerFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'DATA_ENGINE_RATE_LIMITED',
          message: 'Budget exhausted',
          retryable: true
        }),
        {
          status: 429,
          headers: {
            'x-request-id': 'm20-hop',
            'x-correlation-id': 'm20-hop',
            'retry-after': '15',
            'x-markorbit-contract-version': 'MARKORBIT_DATA_ENGINE_INTEGRATION_V1',
            'x-markorbit-source-owner': 'MARKORBIT_DATA_ENGINE'
          }
        }
      )
    );
    await expect(f.route.handle(f.request)).rejects.toMatchObject({
      status: 429,
      details: { retryAfterSeconds: 15 }
    });
  });

  it('does not deliver a page after its source admission expires during the fact query', async () => {
    const f = await fixture();
    f.options.usApplicantNameAdmission.now = vi
      .fn<() => Date>()
      .mockReturnValueOnce(new Date(instant))
      .mockReturnValue(new Date(admission.validUntil));
    await expect(f.route.handle(f.request)).rejects.toMatchObject({ status: 503 });
    expect(f.providerFetch).toHaveBeenCalledOnce();
  });

  it('bounds an admission-reader timeout and aborts its source call', async () => {
    const f = await fixture();
    f.options.usApplicantNameAdmission.core = {
      ...f.options.usApplicantNameAdmission.core,
      timeoutMs: 10
    } as typeof f.options.usApplicantNameAdmission.core;
    const seen: AbortSignal[] = [];
    f.readAdmission.mockImplementation((signal) => {
      seen.push(signal);
      return new Promise(() => {});
    });
    const route = createGatewayProductLoopRoutes(f.options).find((r) => r.path === f.route.path)!;
    await expect(route.handle(f.request)).rejects.toMatchObject({ status: 503 });
    expect(seen[0]?.aborted).toBe(true);
    expect(f.coreFetch).not.toHaveBeenCalled();
    expect(f.providerFetch).not.toHaveBeenCalled();
  });

  it('rejects a mismatched snapshot after provider parsing and before delivering any cached facts', async () => {
    const f = await fixture();
    f.readAdmission.mockResolvedValue({ ...admission, sourceVersion: 'other-source-version' });
    await expect(f.route.handle(f.request)).rejects.toMatchObject({
      status: 409,
      code: 'DATA_ENGINE_DATA_USE_SOURCE_CONFLICT'
    });
  });

  it('keeps a legacy null not_found without snapshot unavailable instead of claiming verified empty coverage', async () => {
    const f = await fixture();
    f.providerFetch.mockImplementation((input) => {
      const body = {
        ...providerEnvelope(new URL(new Request(input).url)),
        fact_state: 'not_found',
        payload: null
      };
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: {
            'x-request-id': 'm20-hop',
            'x-correlation-id': 'm20-hop',
            'x-markorbit-contract-version': 'MARKORBIT_DATA_ENGINE_INTEGRATION_V1',
            'x-markorbit-source-owner': 'MARKORBIT_DATA_ENGINE'
          }
        })
      );
    });
    await expect(f.route.handle(f.request)).rejects.toMatchObject({
      status: 503,
      code: 'DATA_ENGINE_DATA_USE_SOURCE_EVIDENCE_MISSING'
    });
  });
});
