import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TrademarkServiceExecutionReadiness } from '@markorbit/contracts/trademark-service-workbench';
import {
  ManagedDatabase,
  loadMigrationsForOwner,
  migrate,
  migrationStatus,
  verifyMigrations
} from '@markorbit/persistence';
import {
  TrademarkServiceProtectedActionGate,
  authorizeTrademarkServiceExecution,
  createTrademarkServiceExecutionPlan,
  recordTrademarkServiceExecutionEvidence
} from '../src/trademark-service-execution.js';
import { PostgresTrademarkServiceExecutionRepository } from '../src/trademark-service-execution-postgres.js';

const url = process.env.EXECUTION_TEST_DATABASE_URL;
const required = process.env.EXECUTION_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'EXECUTION_TEST_DATABASE_URL is required when EXECUTION_POSTGRES_TEST_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const workspaceId = '11111111-1111-4111-8111-111111111111';
const otherWorkspaceId = '22222222-2222-4222-8222-222222222222';

const readiness = (): TrademarkServiceExecutionReadiness => ({
  schemaVersion: 1,
  executionReadinessId: 'trademark-service-execution-readiness_m14',
  workspaceId,
  workPackage: { id: 'trademark-service-work-package_m14', version: 7 },
  readinessState: 'READY_FOR_EXECUTION_PREPARATION',
  reviewedByUserId: 'user_reviewer',
  reviewedAt: '2026-08-21T02:00:00.000Z',
  ownerDomainValidationReferences: ['markreg-validation_m14'],
  evidenceReferences: ['evidence_m14'],
  executionAuthorized: false,
  filingAuthorized: false,
  externalContactAuthorized: false,
  paymentAuthorized: false,
  publicationAuthorized: false,
  providerEngagementAuthorized: false
});

const authorization = () =>
  authorizeTrademarkServiceExecution({
    workspaceId,
    readiness: readiness(),
    workPackageVersion: 7,
    authorizedByUserId: 'user_authorizer',
    authorizationCapacity: 'AUTHORIZED_REPRESENTATIVE',
    authorizedAt: '2026-08-21T03:00:00.000Z',
    expiresAt: '2026-08-22T03:00:00.000Z',
    allowedActions: ['AUTHORITY_FILING'],
    conditions: ['Use reviewed evidence only.'],
    explicitUserAuthorization: true,
    acknowledgementAuthorizationIsNotSubmission: true,
    acknowledgementOfficialAcceptanceNotGuaranteed: true
  });

const plan = () =>
  createTrademarkServiceExecutionPlan({
    workspaceId,
    authorization: authorization(),
    createdAt: '2026-08-21T03:05:00.000Z',
    steps: [
      {
        action: 'AUTHORITY_FILING',
        owner: 'EXTERNAL_AUTHORITY',
        description: 'Release only through the protected action gate.'
      }
    ]
  });

const release = () => {
  const auth = authorization();
  const executionPlan = createTrademarkServiceExecutionPlan({
    workspaceId,
    authorization: auth,
    createdAt: '2026-08-21T03:05:00.000Z',
    steps: [
      {
        action: 'AUTHORITY_FILING',
        owner: 'EXTERNAL_AUTHORITY',
        description: 'Release only through the protected action gate.'
      }
    ]
  });
  return new TrademarkServiceProtectedActionGate().release({
    workspaceId,
    authorization: auth,
    plan: executionPlan,
    stepId: executionPlan.steps[0]!.stepId,
    idempotencyKey: 'm14-release-1',
    evidenceReferences: ['professional-review_m14'],
    releasedByUserId: 'user_releaser',
    releasedAt: '2026-08-21T03:10:00.000Z',
    currentWorkPackageVersion: 7
  });
};

suite('M14 PostgreSQL trademark service execution repository', () => {
  const namespace = 'execution_trademark_service_test';
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: namespace,
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: namespace
  });
  const migrations = () =>
    loadMigrationsForOwner(
      path.resolve('../../infrastructure/persistence/migrations'),
      path.resolve('../../infrastructure/persistence/migration-owners.json'),
      '@markorbit/execution-service'
    );
  const repository = () =>
    new PostgresTrademarkServiceExecutionRepository(database, database.getPool());

  beforeAll(async () => {
    await database.start();
    const pool = database.getPool();
    await pool.query(
      `DROP TABLE IF EXISTS
         execution_trademark_service_artifacts,
         execution_trademark_service_protected_action_replays,
         execution_trademark_service_sessions
       CASCADE`
    );
    const history = await pool.query<{ migration_history: string | null }>(
      "SELECT to_regclass('markorbit_persistence.migration_history')::text AS migration_history"
    );
    if (history.rows[0]?.migration_history)
      await pool.query('DELETE FROM markorbit_persistence.migration_history WHERE namespace=$1', [
        namespace
      ]);
    await migrate(pool, namespace, await migrations());
  });

  beforeEach(() =>
    database
      .getPool()
      .query(
        'TRUNCATE execution_trademark_service_artifacts, execution_trademark_service_protected_action_replays, execution_trademark_service_sessions'
      )
  );
  afterAll(() => database.close());

  it('loads and verifies the Execution-owned durable session migration', async () => {
    const owned = await migrations();
    expect(owned.map((migration) => `${migration.version}_${migration.name}`)).toContain(
      '0061_execution_trademark_service_sessions'
    );
    expect(
      (await migrationStatus(database.getPool(), namespace, owned)).every(
        (migration) => migration.state === 'applied'
      )
    ).toBe(true);
    await verifyMigrations(database.getPool(), namespace, owned);
  });

  it('replays identical authorization and rejects conflicting reuse of its durable ID', async () => {
    const repo = repository();
    const auth = authorization();
    await expect(repo.createAuthorization(auth)).resolves.toEqual(auth);
    await expect(repo.createAuthorization(structuredClone(auth))).resolves.toEqual(auth);
    await expect(
      repo.createAuthorization({ ...auth, authorizedByUserId: 'user_different' })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('makes the execution plan immutable while allowing an identical replay', async () => {
    const repo = repository();
    const auth = authorization();
    const executionPlan = plan();
    await repo.createAuthorization(auth);
    await expect(repo.savePlan(workspaceId, executionPlan)).resolves.toEqual(executionPlan);
    await expect(repo.savePlan(workspaceId, structuredClone(executionPlan))).resolves.toEqual(
      executionPlan
    );
    await expect(
      repo.savePlan(workspaceId, {
        ...executionPlan,
        createdAt: '2026-08-21T03:06:00.000Z'
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('persists one protected-action replay and rejects changed request fingerprints', async () => {
    const repo = repository();
    const auth = authorization();
    const protectedRelease = release();
    await repo.createAuthorization(auth);
    await expect(repo.saveProtectedActionRelease(protectedRelease)).resolves.toEqual(
      protectedRelease
    );
    await expect(
      repo.saveProtectedActionRelease(structuredClone(protectedRelease))
    ).resolves.toEqual(protectedRelease);
    await expect(
      repo.saveProtectedActionRelease({
        ...protectedRelease,
        requestFingerprintSha256: 'f'.repeat(64)
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('rejects a protected action when the durable Work Package version is stale', async () => {
    const repo = repository();
    await repo.createAuthorization(authorization());
    await expect(
      repo.saveProtectedActionRelease({
        ...release(),
        workPackage: { id: 'trademark-service-work-package_m14', version: 8 }
      })
    ).rejects.toMatchObject({ code: 'READINESS_REQUIRED' });
  });

  it('isolates Workspaces and keeps persisted evidence outside Official Truth', async () => {
    const repo = repository();
    const auth = authorization();
    const protectedRelease = release();
    const evidence = recordTrademarkServiceExecutionEvidence({
      workspaceId,
      release: protectedRelease,
      attemptState: 'OWNER_ACCEPTED',
      receiptReferences: ['receipt_m14'],
      providerReturnReferences: ['provider-return_m14'],
      ownerValidationReferences: ['owner-validation_m14'],
      recordedAt: '2026-08-21T03:20:00.000Z'
    });
    await repo.createAuthorization(auth);
    await repo.appendEvidence(auth.executionAuthorizationId, evidence);

    await expect(
      repo.getSnapshot(otherWorkspaceId, auth.executionAuthorizationId)
    ).resolves.toBeUndefined();
    const snapshot = await repo.getSnapshot(workspaceId, auth.executionAuthorizationId);
    expect(snapshot?.evidence).toEqual([evidence]);
    const stored = await database.getPool().query<{ official_truth_created: boolean }>(
      `SELECT official_truth_created FROM execution_trademark_service_artifacts
        WHERE workspace_id=$1 AND artifact_id=$2`,
      [workspaceId, evidence.executionEvidenceId]
    );
    expect(stored.rows[0]?.official_truth_created).toBe(false);

    await expect(
      repo.appendEvidence(auth.executionAuthorizationId, {
        ...evidence,
        attemptState: 'FAILED'
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });
});
