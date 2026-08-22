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
  authorizeTrademarkServiceExecution,
  createTrademarkServiceExecutionPlan
} from '../src/trademark-service-execution.js';
import { PostgresTrademarkServiceExecutionRepository } from '../src/trademark-service-execution-postgres.js';
import {
  createTrademarkServiceExecutionCorrelationId,
  classifyTrademarkServiceRecoveryDrill
} from '../src/trademark-service-execution-observability.js';
import { PostgresTrademarkServiceRecoveryDrillRepository } from '../src/trademark-service-execution-observability-postgres.js';
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
  executionReadinessId: 'trademark-service-execution-readiness_m15_wp07',
  workspaceId,
  workPackage: { id: 'trademark-service-work-package_m15_wp07', version: 13 },
  readinessState: 'READY_FOR_EXECUTION_PREPARATION',
  reviewedByUserId: 'user_reviewer',
  reviewedAt: '2026-08-22T15:40:00.000Z',
  ownerDomainValidationReferences: ['markreg-validation_m15_wp07'],
  evidenceReferences: ['evidence_m15_wp07'],
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
    workPackageVersion: 13,
    authorizedByUserId: 'user_authorizer',
    authorizationCapacity: 'AUTHORIZED_REPRESENTATIVE',
    authorizedAt: '2026-08-22T15:41:00.000Z',
    expiresAt: '2026-08-23T15:41:00.000Z',
    allowedActions: ['PROVIDER_INSTRUCTION'],
    explicitUserAuthorization: true,
    acknowledgementAuthorizationIsNotSubmission: true,
    acknowledgementOfficialAcceptanceNotGuaranteed: true
  });

const prepared = () => {
  const auth = authorization();
  const plan = createTrademarkServiceExecutionPlan({
    workspaceId,
    authorization: auth,
    createdAt: '2026-08-22T15:42:00.000Z',
    steps: [
      {
        action: 'PROVIDER_INSTRUCTION',
        owner: 'MGSN',
        description: 'M15 WP07 durable recovery rehearsal.'
      }
    ]
  });
  const policy = createTrademarkServiceExecutionEnvironmentPolicy({
    workspaceId,
    authorization: auth,
    environment: 'CI',
    mode: 'SIMULATED',
    connectorClass: 'SIMULATOR',
    endpointClass: 'INTERNAL_TEST',
    credentialClass: 'NONE',
    createdAt: '2026-08-22T15:43:00.000Z'
  });
  const protectedAction = new TrademarkServiceSandboxProtectedActionGate().release({
    workspaceId,
    authorization: auth,
    plan,
    policy,
    stepId: plan.steps[0]!.stepId,
    idempotencyKey: 'm15-wp07-protected-action',
    evidenceReferences: ['professional-review_m15_wp07'],
    releasedByUserId: 'user_releaser',
    releasedAt: '2026-08-22T15:44:00.000Z',
    currentWorkPackageVersion: 13
  });
  return { auth, plan, policy, protectedAction };
};

suite('M15-WP-07 durable sandbox recovery observability', () => {
  const namespace = 'execution_trademark_service_observability_test';
  const config = (applicationName: string) => ({
    connection: { url: url! },
    applicationName,
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable' as const,
    migrationNamespace: namespace
  });
  const database = new ManagedDatabase(config(namespace));
  const migrations = () =>
    loadMigrationsForOwner(
      path.resolve('../../infrastructure/persistence/migrations'),
      path.resolve('../../infrastructure/persistence/migration-owners.json'),
      '@markorbit/execution-service'
    ).then((owned) => owned.filter((migration) => Number(migration.version) >= 61));
  const baseRepository = () =>
    new PostgresTrademarkServiceExecutionRepository(database, database.getPool());
  const sandboxRepository = () =>
    new PostgresTrademarkServiceSandboxPolicyRepository(database, database.getPool());
  const recoveryRepository = () =>
    new PostgresTrademarkServiceRecoveryDrillRepository(database, database.getPool());

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

  const persistPrepared = async () => {
    const source = prepared();
    await baseRepository().createAuthorization(source.auth);
    await sandboxRepository().saveEnvironmentPolicy(source.policy);
    await sandboxRepository().saveProtectedActionRelease(
      source.protectedAction.release,
      source.protectedAction.binding
    );
    return source;
  };

  const commandFor = (
    source: ReturnType<typeof prepared>,
    outcome: 'SUCCESS' | 'TRANSIENT_FAILURE' | 'AMBIGUOUS_EXTERNAL_OUTCOME' | 'PERMANENT_FAILURE',
    idempotencyKey: string,
    recordedAt = '2026-08-22T15:45:00.000Z'
  ) => ({
    workspaceId,
    executionAuthorizationId: source.auth.executionAuthorizationId,
    release: source.protectedAction.release,
    binding: source.protectedAction.binding,
    correlationId: createTrademarkServiceExecutionCorrelationId(
      source.protectedAction.release,
      source.protectedAction.binding
    ),
    idempotencyKey,
    outcome,
    reasonCode: `WP07_${outcome}`,
    recordedAt
  });

  it('reuses the existing Execution migration set without adding a new persistence table', async () => {
    const owned = await migrations();
    expect(owned.map((migration) => `${migration.version}_${migration.name}`)).toEqual(
      expect.arrayContaining([
        '0061_execution_trademark_service_sessions',
        '0062_execution_trademark_service_sandbox_policy'
      ])
    );
    expect(owned.some((migration) => Number(migration.version) > 62)).toBe(false);
    expect(
      (await migrationStatus(database.getPool(), namespace, owned)).every(
        (migration) => migration.state === 'applied'
      )
    ).toBe(true);
    await verifyMigrations(database.getPool(), namespace, owned);
  });

  it('persists a correlation trail and replays the same observation after a fresh database client starts', async () => {
    const source = await persistPrepared();
    const command = commandFor(source, 'SUCCESS', 'wp07-recovery-success');
    const first = await recoveryRepository().record(command);

    const restartedDatabase = new ManagedDatabase(config(`${namespace}_restarted_client`));
    await restartedDatabase.start();
    try {
      const restarted = new PostgresTrademarkServiceRecoveryDrillRepository(
        restartedDatabase,
        restartedDatabase.getPool()
      );
      const replayed = await restarted.record({
        ...command,
        recordedAt: '2026-08-22T16:45:00.000Z'
      });
      expect(replayed).toEqual(first);
      await expect(
        restarted.getCorrelationTrail(
          workspaceId,
          source.auth.executionAuthorizationId,
          command.correlationId
        )
      ).resolves.toEqual([first]);
    } finally {
      await restartedDatabase.close();
    }

    const artifacts = await database.getPool().query(
      `SELECT artifact_kind,official_truth_created
         FROM execution_trademark_service_artifacts
        WHERE workspace_id=$1 AND artifact_id=$2`,
      [workspaceId, first.recoveryDrillId]
    );
    expect(artifacts.rows[0]).toMatchObject({
      artifact_kind: 'RECOVERY',
      official_truth_created: false
    });
  });

  it('chains transient recovery observations and permits only human-approved same-identity replay', async () => {
    const source = await persistPrepared();
    const correlationId = createTrademarkServiceExecutionCorrelationId(
      source.protectedAction.release,
      source.protectedAction.binding
    );
    const first = await recoveryRepository().record(
      commandFor(source, 'SUCCESS', 'wp07-recovery-sequence-1')
    );
    const second = await recoveryRepository().record(
      commandFor(
        source,
        'TRANSIENT_FAILURE',
        'wp07-recovery-sequence-2',
        '2026-08-22T15:46:00.000Z'
      )
    );

    expect(second.auditSequence).toBe(2);
    expect(second.previousRecoveryDrillId).toBe(first.recoveryDrillId);
    expect(second.previousAuditFingerprintSha256).toBe(first.auditFingerprintSha256);
    expect(second.recovery.state).toBe('RETRY_ALLOWED');
    expect(second.recovery.retryable).toBe(true);
    expect(second.replayRule).toBe('HUMAN_APPROVAL_SAME_IDENTITY_ONLY');
    expect(second.deadLetterState).toBe('HELD_FOR_HUMAN_REVIEW');
    expect(second.humanApprovalRequiredForRetry).toBe(true);
    expect(second.sameEnvironmentReplayRequired).toBe(true);
    expect(second.sameModeReplayRequired).toBe(true);
    expect(second.automaticExternalRetryPerformed).toBe(false);
    await expect(
      recoveryRepository().getCorrelationTrail(
        workspaceId,
        source.auth.executionAuthorizationId,
        correlationId
      )
    ).resolves.toEqual([first, second]);
    await expect(
      recoveryRepository().getPendingHumanReview(
        workspaceId,
        source.auth.executionAuthorizationId
      )
    ).resolves.toEqual([second]);
  });

  it('dead-letters ambiguous outcomes until external state is verified and forbids permanent-failure replay', async () => {
    const source = await persistPrepared();
    const ambiguous = await recoveryRepository().record(
      commandFor(source, 'AMBIGUOUS_EXTERNAL_OUTCOME', 'wp07-recovery-ambiguous')
    );
    const terminal = await recoveryRepository().record(
      commandFor(
        source,
        'PERMANENT_FAILURE',
        'wp07-recovery-terminal',
        '2026-08-22T15:46:00.000Z'
      )
    );

    expect(ambiguous.recovery.state).toBe('MANUAL_REVIEW_REQUIRED');
    expect(ambiguous.replayRule).toBe('VERIFY_EXTERNAL_OUTCOME_BEFORE_REPLAY');
    expect(ambiguous.deadLetterState).toBe('HELD_FOR_HUMAN_REVIEW');
    expect(ambiguous.automaticExternalRetryPerformed).toBe(false);
    expect(terminal.recovery.state).toBe('TERMINAL_FAILURE');
    expect(terminal.replayRule).toBe('REPLAY_FORBIDDEN');
    expect(terminal.deadLetterState).toBe('TERMINAL');
  });

  it('rejects correlation spoofing, environment drift, and conflicting idempotency after restart', async () => {
    const source = await persistPrepared();
    const original = commandFor(source, 'TRANSIENT_FAILURE', 'wp07-recovery-conflict');
    await recoveryRepository().record(original);

    await expect(
      recoveryRepository().record({
        ...original,
        correlationId: 'trademark-service-execution-correlation_spoofed'
      })
    ).rejects.toMatchObject({ code: 'AUTHORITY_BOUNDARY_VIOLATION' });

    const driftedBinding = { ...source.protectedAction.binding, environment: 'SANDBOX' as const };
    await expect(
      recoveryRepository().record({
        ...original,
        idempotencyKey: 'wp07-recovery-drift',
        binding: driftedBinding,
        correlationId: createTrademarkServiceExecutionCorrelationId(
          source.protectedAction.release,
          driftedBinding
        )
      })
    ).rejects.toMatchObject({ code: 'AUTHORITY_BOUNDARY_VIOLATION' });

    const restartedDatabase = new ManagedDatabase(config(`${namespace}_conflict_restart`));
    await restartedDatabase.start();
    try {
      const restarted = new PostgresTrademarkServiceRecoveryDrillRepository(
        restartedDatabase,
        restartedDatabase.getPool()
      );
      await expect(
        restarted.record({
          ...original,
          outcome: 'PERMANENT_FAILURE',
          reasonCode: 'WP07_PERMANENT_FAILURE'
        })
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    } finally {
      await restartedDatabase.close();
    }
  });

  it('keeps recovery classification itself fail-closed for automatic external retries', () => {
    for (const outcome of [
      'SUCCESS',
      'TRANSIENT_FAILURE',
      'AMBIGUOUS_EXTERNAL_OUTCOME',
      'PERMANENT_FAILURE'
    ] as const) {
      const result = classifyTrademarkServiceRecoveryDrill(outcome, `WP07_${outcome}`);
      expect(result.recovery.automaticExternalRetryPerformed).toBe(false);
      if (outcome === 'TRANSIENT_FAILURE' || outcome === 'AMBIGUOUS_EXTERNAL_OUTCOME')
        expect(result.humanApprovalRequiredForRetry).toBe(true);
    }
  });
});
