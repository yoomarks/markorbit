import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { EntitlementGrantV1 } from '@markorbit/contracts/workspace-commercial';
import type { ApplicantDiscoveryEnvelopeV1 } from '@markorbit/contracts/data-engine-applicant-discovery';
import {
  DATA_ENGINE_DISCOVERY_CONTRACT_VERSION,
  noApplicantDiscoveryAuthorityConsequencesV1
} from '@markorbit/contracts/data-engine-discovery';
import { createServiceRuntime, HttpError, json, type ServiceRuntime } from '@markorbit/service-kit';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '../../../packages/persistence/src/index.js';
import {
  AuthenticationService,
  PostgresSessionRepository
} from '../../../services/core/src/auth.js';
import {
  PostgresMembershipRepository,
  PostgresUserRepository,
  PostgresWorkspaceRepository
} from '../../../services/core/src/identity.js';
import { CurrentWorkspaceAuthorityService } from '../../../services/core/src/current-workspace-authority.js';
import { createRuntime as createCoreRuntime } from '../../../services/core/src/index.js';
import { PostgresWorkspaceCommercialRepositoryV1 } from '../../../services/core/src/workspace-commercial-postgres.js';
import { WorkspaceCommercialServiceV1 } from '../../../services/core/src/workspace-commercial.js';
import { createRuntime } from '../src/index.js';
import { csrfToken, HttpCoreAuthenticationClient } from '../src/auth.js';
import type { USApplicantNameAdmission } from '../src/data-engine-applicant-admission.js';

const url = process.env.M20_PROTECTED_HTTP_TEST_DATABASE_URL;
if (process.env.M20_PROTECTED_HTTP_POSTGRES_REQUIRED === '1' && !url)
  throw new Error('Required protected HTTP evidence needs M20_PROTECTED_HTTP_TEST_DATABASE_URL.');
if (url) {
  const parsed = new URL(url);
  if (
    !['localhost', '127.0.0.1', '[::1]', 'postgres'].includes(parsed.hostname) ||
    parsed.pathname !== '/markorbit_m20_protected_http_test'
  )
    throw new Error('Protected HTTP evidence requires its isolated local test database.');
}
const integration = url ? describe : describe.skip;
const secret = 'synthetic-m20-c5-internal-service-secret-only';
const origin = 'https://m20-fixture.example.test';
const workspaceId = randomUUID();
const otherWorkspaceId = randomUUID();
const userId = randomUUID();
const membershipId = randomUUID();
const t0 = new Date(Date.now() - 86_400_000).toISOString();
const admission: USApplicantNameAdmission = {
  revision: 'SYNTHETIC_M20_C5_NOT_PRODUCTION_APPROVAL',
  entitlementKey: 'fixture.us.applicant.search.portfolio',
  datasetVersion: DATA_ENGINE_DISCOVERY_CONTRACT_VERSION,
  sourceVersion: 'us-serving-epoch:' + 'e'.repeat(64),
  licenceReference: 'synthetic-fixture-only-no-source-licence',
  permittedUse: 'SEARCH:PORTFOLIO',
  readiness: 'ACCEPTED',
  coverageThrough: t0,
  maximumCoverageAgeMs: 172_800_000,
  validUntil: new Date(Date.now() + 3_600_000).toISOString()
};
let database: ManagedDatabase;
let repository: PostgresWorkspaceCommercialRepositoryV1;
let memberships: PostgresMembershipRepository;
let authentication: AuthenticationService;
let service: WorkspaceCommercialServiceV1;
let core: ServiceRuntime;
let provider: ServiceRuntime;
let gateway: ServiceRuntime;
let rawToken: string;
let sessionId: string;
let providerCalls = 0;
let requestSequence = 0;
const runtimes: ServiceRuntime[] = [];
const measurements: unknown[] = [];
const acceptance: Record<string, unknown> = {};

function grant(overrides: Partial<EntitlementGrantV1> = {}): EntitlementGrantV1 {
  return {
    schemaVersion: 1,
    grantId: 'fixture-target',
    version: 1,
    subject: { scope: 'WORKSPACE', workspaceId },
    entitlement: {
      key: admission.entitlementKey,
      subjectScope: 'WORKSPACE',
      value: { kind: 'BOOLEAN', enabled: true }
    },
    status: 'ACTIVE',
    sourceType: 'MANUAL',
    sourceRef: 'synthetic:M20-C5',
    effectiveFrom: t0,
    recordedAt: t0,
    ...overrides
  };
}

function providerEnvelope(
  query: Readonly<Record<string, string>>,
  requestId: string
): ApplicantDiscoveryEnvelopeV1 {
  const context = { requester_workspace_id: query.requester_workspace_id!, request_id: requestId };
  const snapshot = { source_version: admission.sourceVersion, observed_at: t0 };
  const boundQuery = {
    contract_version: DATA_ENGINE_DISCOVERY_CONTRACT_VERSION,
    request_context: context,
    jurisdiction: 'US' as const,
    input: { kind: 'NAME' as const, value: query.name! },
    ordering: ['applicant_candidate_id ASC'] as const,
    ranking_authority: 'NONE' as const,
    limits: { page_size: Number(query.page_size), max_results: 100 as const },
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
      query: boundQuery,
      source_snapshot: snapshot,
      results: [],
      next_cursor: null,
      provenance: {
        query_hash: boundQuery.query_hash,
        request_context: context,
        source_snapshot: snapshot,
        engine_version: 'M1.9-fixture',
        result_count: 0,
        has_more: false,
        query: boundQuery
      },
      authority_consequences: noApplicantDiscoveryAuthorityConsequencesV1
    }
  };
}

async function start<T extends ServiceRuntime>(runtime: T): Promise<T> {
  runtimes.push(runtime);
  await runtime.start();
  return runtime;
}

function gatewayRuntime(entitlementCoreUrl = `http://127.0.0.1:${core.listeningPort}`) {
  const coreUrl = `http://127.0.0.1:${core.listeningPort}`;
  return createRuntime({
    port: 0,
    coreUrl,
    internalServiceSecret: secret,
    csrfSecret: secret,
    allowedOrigins: [origin],
    authenticationClient: new HttpCoreAuthenticationClient(coreUrl, secret),
    dataEngineUrl: `http://127.0.0.1:${provider.listeningPort}`,
    dataEngineApiKey: secret,
    usApplicantNameAdmission: {
      core: { coreUrl: entitlementCoreUrl, internalServiceSecret: secret },
      readAdmission: () => Promise.resolve(structuredClone(admission))
    }
  });
}

async function request(runtime = gateway, headers: Record<string, string> = {}) {
  const started = performance.now();
  const response = await fetch(
    `http://127.0.0.1:${runtime.listeningPort}/api/data-engine/applicants/discover`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `mo_session=${rawToken}`,
        origin,
        'x-markorbit-workspace-id': workspaceId,
        'x-markorbit-csrf-token': csrfToken(sessionId, secret),
        'x-request-id': `m20-c5-${++requestSequence}`,
        ...headers
      },
      body: JSON.stringify({
        jurisdiction: 'US',
        input: { kind: 'NAME', value: 'Orbit LLC' },
        pageSize: 10
      }),
      signal: AbortSignal.timeout(15_000)
    }
  );
  const text = await response.text();
  const elapsedMs = performance.now() - started;
  return {
    status: response.status,
    body: JSON.parse(text) as unknown,
    logicalResponseBytes: Buffer.byteLength(text),
    elapsedMs
  };
}

function summary(elapsedMs: readonly number[]) {
  const sorted = [...elapsedMs].sort((a, b) => a - b);
  return {
    elapsedMs,
    p50Ms: sorted[Math.ceil(sorted.length * 0.5) - 1],
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    maxMs: sorted.at(-1)
  };
}

integration('M20 authenticated protected HTTP PostgreSQL evidence', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(
      parseDatabaseConfig({
        NODE_ENV: 'test',
        DATABASE_URL: url,
        DB_MIGRATION_NAMESPACE: 'm20_protected_http',
        DB_APPLICATION_NAME: 'markorbit-m20-c5-http-evidence'
      })
    );
    await database.start();
    await migrate(
      database.getPool(),
      'm20_protected_http',
      await loadMigrationsForOwner(
        path.resolve('../../infrastructure/persistence/migrations'),
        path.resolve('../../infrastructure/persistence/migration-owners.json'),
        '@markorbit/core-service'
      )
    );
    const users = new PostgresUserRepository(database.getPool());
    const workspaces = new PostgresWorkspaceRepository(database.getPool());
    memberships = new PostgresMembershipRepository(database.getPool());
    await users.create({
      userId,
      email: `${userId}@example.test`,
      displayName: 'Synthetic fixture'
    });
    for (const id of [workspaceId, otherWorkspaceId])
      await workspaces.create({ workspaceId: id, name: 'Synthetic fixture', slug: `m20-${id}` });
    await memberships.create({ membershipId, workspaceId, userId, role: 'WORKSPACE_ADMIN' });
    authentication = new AuthenticationService({
      sessions: new PostgresSessionRepository(database.getPool()),
      users,
      workspaces,
      memberships
    });
    repository = new PostgresWorkspaceCommercialRepositoryV1(database);
    service = new WorkspaceCommercialServiceV1(repository, () => Promise.resolve(undefined));
    core = await start(
      createCoreRuntime({
        port: 0,
        authentication,
        workspaceCommercial: service,
        currentWorkspaceAuthority: new CurrentWorkspaceAuthorityService({
          users,
          workspaces,
          memberships
        }),
        internalServiceSecret: secret
      })
    );
    const issued = await new HttpCoreAuthenticationClient(
      `http://127.0.0.1:${core.listeningPort}`,
      secret
    ).issue(userId);
    rawToken = issued.rawToken;
    sessionId = issued.session.sessionId;
    provider = await start(
      createServiceRuntime(
        { name: 'synthetic-m20-c5-provider', port: 0, version: 'fixture-only' },
        {
          routes: [
            {
              method: 'GET',
              path: '/api/v1/us/applicants/by-name',
              handle(req) {
                if (req.headers.authorization !== `Bearer ${secret}`)
                  throw new HttpError(
                    401,
                    'FIXTURE_UNAUTHORIZED',
                    'Fixture requires its test credential.'
                  );
                providerCalls++;
                return json(200, providerEnvelope(req.query, req.headers['x-request-id']!), {
                  'x-request-id': req.headers['x-request-id']!,
                  'x-correlation-id': req.headers['x-correlation-id']!,
                  'x-markorbit-contract-version': 'MARKORBIT_DATA_ENGINE_INTEGRATION_V1',
                  'x-markorbit-source-owner': 'MARKORBIT_DATA_ENGINE'
                });
              }
            }
          ]
        }
      )
    );
    gateway = await start(gatewayRuntime());
  }, 60_000);

  afterAll(async () => {
    const failures: unknown[] = [];
    try {
      if (database && measurements.length) {
        const environment = await database
          .getPool()
          .query<Record<string, unknown>>(
            `SELECT version() AS postgres_version, current_setting('statement_timeout') AS statement_timeout, current_setting('shared_buffers') AS shared_buffers, current_setting('work_mem') AS work_mem`
          );
        const report = {
          schemaVersion: 1,
          fixture:
            'synthetic:M20-C5; real Gateway/Core HTTP and PostgreSQL session/authority/grants; empty local provider; no production admission',
          commit: process.env.M20_PROTECTED_HTTP_COMMIT_SHA ?? 'local-unrecorded',
          node: process.version,
          platform: `${os.platform()} ${os.release()} ${os.arch()}`,
          cpu: os.cpus()[0]?.model,
          cpuCount: os.cpus().length,
          totalMemoryBytes: os.totalmem(),
          database: environment.rows[0],
          configuredBudgets: {
            poolMaximum: 10,
            coreAuthenticationTimeoutMs: 3_000,
            coreEntitlementTimeoutMs: 3_000,
            providerTimeoutMs: 5_000,
            outerFixtureTimeoutMs: 15_000
          },
          measurements,
          acceptance
        };
        console.info(`M20_C5_PROTECTED_HTTP_EVIDENCE ${JSON.stringify(report)}`);
        if (process.env.M20_PROTECTED_HTTP_EVIDENCE_PATH)
          await writeFile(
            process.env.M20_PROTECTED_HTTP_EVIDENCE_PATH,
            `${JSON.stringify(report, null, 2)}\n`
          );
      }
    } catch (error) {
      failures.push(error);
    }
    const stopped = await Promise.allSettled(runtimes.map((runtime) => runtime.stop()));
    for (const item of stopped) if (item.status === 'rejected') failures.push(item.reason);
    try {
      if (database) await database.close();
    } catch (error) {
      failures.push(error);
    }
    vi.restoreAllMocks();
    if (failures.length) throw new AggregateError(failures, 'Fixture report/cleanup failed.');
  });

  for (const rows of [1_000, 10_000, 100_000])
    it(`measures real authenticated serial/concurrent HTTP with ${rows} grant versions`, async () => {
      await database.getPool().query('TRUNCATE core_workspace_commercial_records');
      await repository.appendGrant(grant());
      await database.getPool().query(
        `INSERT INTO core_workspace_commercial_records (record_type,aggregate_id,version,workspace_id,commercial_kind,effective_from,record_json,recorded_at)
      SELECT 'ENTITLEMENT_GRANT', 'noise-' || ((i-1)/2)::text, (i-1)%2+1, $2::uuid, $3, $4::timestamptz,
        $1::jsonb || jsonb_build_object('grantId','noise-' || ((i-1)/2)::text,'version',(i-1)%2+1,'status',CASE WHEN i%2=0 THEN 'REVOKED' ELSE 'ACTIVE' END), $4::timestamptz FROM generate_series(1,$5::integer) AS i`,
        [
          JSON.stringify(grant({ subject: { scope: 'WORKSPACE', workspaceId: otherWorkspaceId } })),
          otherWorkspaceId,
          admission.entitlementKey,
          t0,
          rows - 1
        ]
      );
      await database.getPool().query('ANALYZE core_workspace_commercial_records');
      const count = await database
        .getPool()
        .query<{ count: string }>(
          "SELECT count(*) FROM core_workspace_commercial_records WHERE record_type='ENTITLEMENT_GRANT'"
        );
      expect(Number(count.rows[0]!.count)).toBe(rows);
      const authSpy = vi.spyOn(authentication, 'resolveWorkspacePrincipal');
      const decisionSpy = vi.spyOn(service, 'resolveEntitlement');
      const beforeProvider = providerCalls;
      try {
        const first = await request();
        expect(first.status).toBe(200);
        expect(first.body).toMatchObject({
          fact_state: 'observed',
          payload: { results: [], source_snapshot: { source_version: admission.sourceVersion } }
        });
        for (let i = 0; i < 3; i++) expect((await request()).status).toBe(200);
        const serial: number[] = [];
        for (let i = 0; i < 30; i++) {
          const result = await request();
          expect(result.status).toBe(200);
          expect(result.body).toMatchObject({ payload: { results: [] } });
          serial.push(result.elapsedMs);
        }
        const concurrent: number[] = [];
        const started = performance.now();
        // Fixed batches bound outstanding requests without a new load-test dependency.
        for (let batch = 0; batch < 5; batch++) {
          const results = await Promise.all(Array.from({ length: 8 }, () => request()));
          for (const result of results) {
            expect(result.status).toBe(200);
            expect(result.body).toMatchObject({ payload: { results: [] } });
            concurrent.push(result.elapsedMs);
          }
        }
        const batchDurationMs = performance.now() - started;
        expect(authSpy).toHaveBeenCalledTimes(74);
        expect(decisionSpy).toHaveBeenCalledTimes(74);
        expect(providerCalls - beforeProvider).toBe(74);
        measurements.push({
          grantVersionRows: rows,
          firstRequest: {
            elapsedMs: first.elapsedMs,
            logicalResponseBytes: first.logicalResponseBytes,
            status: first.status
          },
          warmups: 3,
          serial: { samples: 30, ...summary(serial) },
          concurrent: {
            samples: 40,
            concurrency: 8,
            batches: 5,
            batchDurationMs,
            observedRequestsPerSecond: 40_000 / batchDurationMs,
            ...summary(concurrent)
          },
          currentSessionChecks: authSpy.mock.calls.length,
          currentEntitlementDecisions: decisionSpy.mock.calls.length,
          providerRequests: providerCalls - beforeProvider
        });
      } finally {
        authSpy.mockRestore();
        decisionSpy.mockRestore();
      }
    }, 120_000);

  it('fails closed for a stalled protected Core HTTP response at the default 3s budget', async () => {
    let stalledRequests = 0;
    let closedResponses = 0;
    const stalledCore = createServer((req, res) => {
      if (req.headers['x-markorbit-internal-authorization'] !== secret) {
        res.writeHead(401).end();
        return;
      }
      stalledRequests++;
      req.resume();
      res.once('close', () => closedResponses++);
      // Intentionally no headers/body: exercise native fetch cancellation over TCP.
    });
    await new Promise<void>((resolve, reject) => {
      stalledCore.once('error', reject);
      stalledCore.listen(0, '127.0.0.1', resolve);
    });
    const beforeProvider = providerCalls;
    try {
      const address = stalledCore.address();
      if (!address || typeof address === 'string')
        throw new Error('Stalled Core fixture has no TCP port.');
      const stalledGateway = await start(gatewayRuntime(`http://127.0.0.1:${address.port}`));
      const result = await request(stalledGateway);
      expect(result.status).toBe(503);
      expect(result.body).toMatchObject({
        code: 'WORKSPACE_COMMERCIAL_UNAVAILABLE',
        retryable: true
      });
      expect(stalledRequests).toBe(1);
      await vi.waitFor(() => expect(closedResponses).toBe(1));
      expect(providerCalls).toBe(beforeProvider);
      acceptance.coreTimeout = {
        defaultBudgetMs: 3_000,
        elapsedMs: result.elapsedMs,
        status: result.status,
        stalledRequests,
        abortedConnections: closedResponses,
        providerRequests: 0
      };
    } finally {
      stalledCore.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        stalledCore.close((error) => (error ? reject(error) : resolve()))
      );
    }
  }, 15_000);

  it('uses current grants, membership and sessions on subsequent authenticated HTTP requests', async () => {
    await repository.appendGrant(
      grant({ version: 2, status: 'REVOKED', recordedAt: new Date().toISOString() })
    );
    const beforeProvider = providerCalls;
    const revoked = await request();
    expect(revoked.status).toBe(403);
    expect(revoked.body).toMatchObject({ code: 'DATA_ENGINE_DATA_USE_DENIED' });
    expect(providerCalls).toBe(beforeProvider);
    await repository.appendGrant(grant({ version: 3, recordedAt: new Date().toISOString() }));
    expect((await request()).status).toBe(200);
    const beforeSuspended = providerCalls;
    await memberships.suspend(workspaceId, userId, 1);
    const suspended = await request();
    expect(suspended.status).toBe(403);
    expect(suspended.body).toMatchObject({ code: 'MEMBERSHIP_SUSPENDED' });
    const invalid = await request(gateway, { cookie: 'mo_session=not-a-real-session' });
    expect(invalid.status).toBe(401);
    expect(invalid.body).toMatchObject({ code: 'INVALID_SESSION' });
    expect(providerCalls).toBe(beforeSuspended);
    acceptance.currentAuthority = {
      grantRevokedStatus: revoked.status,
      membershipSuspendedStatus: suspended.status,
      invalidSessionStatus: invalid.status,
      providerRequestsAfterDenial: 0
    };
  });
});
