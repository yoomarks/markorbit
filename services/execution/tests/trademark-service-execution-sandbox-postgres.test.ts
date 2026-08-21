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
  createTrademarkServiceExecutionPlan
} from '../src/trademark-service-execution.js';
import { PostgresTrademarkServiceExecutionRepository } from '../src/trademark-service-execution-postgres.js';
import {
  TrademarkServiceSandboxProtectedActionGate,
  createTrademarkServiceExecutionEnvironmentPolicy
} from '../src/trademark-service-execution-sandbox.js';
import { PostgresTrademarkServiceSandboxPolicyRepository } from '../src/trademark-service-execution-sandbox-postgres.js';

const url = process.env.EXECUTION_TEST_DATABASE_URL;
const required = process.env.EXECUTION_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'EXECUTION_TEST_DATABASE_URL is required when EXECUTION_POSTGRES_TEST_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const workspaceId = '11111111-1111-4111-8111-111111111111';

const readiness = (): TrademarkServiceExecutionReadiness => ({
  schemaVersion: 1,
  executionReadinessId: 'trademark-service-execution-readiness_m15',
  workspaceId,
  workPackage: { id: 'trademark-service-work-package_m15', version: 8 },
  readinessState: 'READY_FOR_EXECUTION_PREPARATION',
  reviewedByUserId: 'user_reviewer',
  reviewedAt: '2026-08-22T00:00:00.000Z',
  ownerDomainValidationReferences: ['markreg-validation_m15'],
  evidenceReferences: ['evidence_m15'],
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
    workPackageVersion: 8,
    authorizedByUserId: 'user_authorizer',
    authorizationCapacity: 'AUTHORIZED_REPRESENTATIVE',
    authorizedAt: '2026-08-22T00:05:00.000Z',
    expiresAt: '2026-08-23T00:05:00.000Z',
    allowedActions: ['AUTHORITY_FILING'],
    explicitUserAuthorization: true,
    acknowledgementAuthorizationIsNotSubmission: true,
    acknowledgementOfficialAcceptanceNotGuaranteed: true
  });

const plan = () => {
  const auth = authorization();
  const executionPlan = createTrademarkServiceExecutionPlan({
    workspaceId,
    authorization: auth,
    createdAt: '2026-08-22T00:06:00.000Z',
    steps: [
      {
        action: 'AUTHORITY_FILING',
        owner: 'EXTERNAL_AUTHORITY',
        description: 'Sandbox rehearsal only.'
      }
    ]
  });
  return { auth, executionPlan };
};

const simulatedPolicy = () =>
  createTrademarkServiceExecutionEnvironmentPolicy({
    workspaceId,
    authorization: authorization(),
    environment: 'CI',
    mode: 'SIMULATED',
    connectorClass: 'SIMULATOR',
    endpointClass: 'INTERNAL_TEST',
    credentialClass: 'NONE',
    createdAt: '2026-08-22T00:07:00.000Z'
  });

const sandboxPolicy = () =>
  createTrademarkServiceExecutionEnvironmentPolicy({
    workspaceId,
    authorization: authorization(),
    environment: 'SANDBOX',
    mode: 'TEST_CONNECTOR',
    connectorClass: 'AUTHORITY_TEST',
    endpointClass: 'ALLOWLISTED_SANDBOX',
    credentialClass: 'TEST_ONLY',
    createdAt: '2026-08-22T00:07:00.000Z'
  });

const sandboxRelease = (policy = simulatedPolicy()) => {
  const { auth, executionPlan } = plan();
  return new TrademarkServiceSandboxProtectedActionGate().release({
    workspaceId,
    authorization: auth,
    plan: executionPlan,
    policy,
    stepId: executionPlan.steps[0]!.stepId,
    idempotencyKey: 'm15-sandbox-release-1',
    evidenceReferences: ['professional-review_m15'],
    releasedByUserId: 'user_releaser',
    releasedAt: '2026-08-22T00:10:00.000Z',
    currentWorkPackageVersion: 8
  });
};

const legacyRelease = () => {
  const { auth, executionPlan } = plan();
  return new TrademarkServiceProtectedActionGate().release({
    workspaceId,
    authorization: auth,
    plan: executionPlan,
    stepId: executionPlan.steps[0]!.stepId,
    idempotencyKey: 'm15-legacy-release-1',
    evidenceReferences: ['professional-review_m15'],
    releasedByUserId: 'user_releaser',
    releasedAt: '2026-08-22T00:10:00.000Z',
    currentWorkPackageVersion: 8
  });
};

suite('M15 PostgreSQL durable sandbox execution policy', () => {
  const namespace = 'execution_trademark_service_sandbox_test';
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
  const baseRepository = () =>
    new PostgresTrademarkServiceExecutionRepository(database, database.getPool());
  const sandboxRepository = () =>
    new PostgresTrademarkServiceSandboxPolicyRepository(database, database.getPool());

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

  it('loads and verifies the Execution-owned sandbox policy migration', async () => {
    const owned = await migrations();
    expect(owned.map((migration) => `${migration.version}_${migration.name}`)).toContain(
      '0062_execution_trademark_service_sandbox_policy'
    );
    expect(
      (await migrationStatus(database.getPool(), namespace, owned)).every(
        (migration) => migration.state === 'applied'
      )
    ).toBe(true);
    await verifyMigrations(database.getPool(), namespace, owned);
  });

  it('persists an immutable environment policy and replays identical content', async () => {
    const base = baseRepository();
    const sandbox = sandboxRepository();
    const auth = authorization();
    const policy = simulatedPolicy();
    await base.createAuthorization(auth);

    await expect(sandbox.saveEnvironmentPolicy(policy)).resolves.toEqual(policy);
    await expect(sandbox.saveEnvironmentPolicy(structuredClone(policy))).resolves.toEqual(policy);
    await expect(
      sandbox.getEnvironmentPolicy(workspaceId, auth.executionAuthorizationId)
    ).resolves.toEqual(policy);

    await expect(
      sandbox.saveEnvironmentPolicy({ ...policy, environment: 'SANDBOX' })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('persists release binding and identical durable replay', async () => {
    const base = baseRepository();
    const sandbox = sandboxRepository();
    const auth = authorization();
    const policy = simulatedPolicy();
    const protectedAction = sandboxRelease(policy);
    await base.createAuthorization(auth);
    await sandbox.saveEnvironmentPolicy(policy);

    await expect(
      sandbox.saveProtectedActionRelease(protectedAction.release, protectedAction.binding)
    ).resolves.toEqual(protectedAction);
    await expect(
      sandbox.saveProtectedActionRelease(
        structuredClone(protectedAction.release),
        structuredClone(protectedAction.binding)
      )
    ).resolves.toEqual(protectedAction);
    await expect(
      sandbox.getEnvironmentBindings(workspaceId, auth.executionAuthorizationId)
    ).resolves.toEqual([protectedAction.binding]);
  });

  it('rejects a cross-environment replay after process-local replay state is gone', async () => {
    const base = baseRepository();
    const sandbox = sandboxRepository();
    const auth = authorization();
    const durablePolicy = simulatedPolicy();
    const original = sandboxRelease(durablePolicy);
    await base.createAuthorization(auth);
    await sandbox.saveEnvironmentPolicy(durablePolicy);
    await sandbox.saveProtectedActionRelease(original.release, original.binding);

    const differentEnvironment = sandboxRelease(sandboxPolicy());
    expect(differentEnvironment.release.idempotencyKey).toBe(original.release.idempotencyKey);
    expect(differentEnvironment.release.requestFingerprintSha256).not.toBe(
      original.release.requestFingerprintSha256
    );
    await expect(
      sandbox.saveProtectedActionRelease(differentEnvironment.release, differentEnvironment.binding)
    ).rejects.toMatchObject({ code: 'AUTHORITY_BOUNDARY_VIOLATION' });
  });

  it('rejects a release whose SHA-256 replay fingerprint omits or changes environment identity', async () => {
    const base = baseRepository();
    const sandbox = sandboxRepository();
    const auth = authorization();
    const policy = simulatedPolicy();
    const protectedAction = sandboxRelease(policy);
    await base.createAuthorization(auth);
    await sandbox.saveEnvironmentPolicy(policy);

    await expect(
      sandbox.saveProtectedActionRelease(
        { ...protectedAction.release, requestFingerprintSha256: 'f'.repeat(64) },
        protectedAction.binding
      )
    ).rejects.toMatchObject({ code: 'AUTHORITY_BOUNDARY_VIOLATION' });
  });

  it('fails closed when the legacy M14 repository attempts an unbound release after policy activation', async () => {
    const base = baseRepository();
    const sandbox = sandboxRepository();
    const auth = authorization();
    await base.createAuthorization(auth);
    await sandbox.saveEnvironmentPolicy(simulatedPolicy());

    await expect(base.saveProtectedActionRelease(legacyRelease())).rejects.toMatchObject({
      code: 'OWNER_MISMATCH',
      status: 503
    });
    const persisted = await database
      .getPool()
      .query(
        'SELECT 1 FROM execution_trademark_service_protected_action_replays WHERE workspace_id=$1',
        [workspaceId]
      );
    expect(persisted.rowCount).toBe(0);
  });
});
