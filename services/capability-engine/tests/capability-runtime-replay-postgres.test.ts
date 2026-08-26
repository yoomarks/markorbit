import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type { ImplementationProfile } from '@markorbit/contracts/capability-runtime';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import {
  GovernedCapabilityRuntime,
  type CapabilityRuntimeExecution
} from '../src/capability-runtime.js';
import { PostgresCapabilityRuntimeReplayStoreV1 } from '../src/capability-runtime-replay-store.js';
import { DurableGovernedCapabilityRuntimeV1 } from '../src/durable-governed-capability-runtime.js';

const url = process.env.CAPABILITY_ENGINE_REPLAY_TEST_DATABASE_URL;
const required = process.env.CAPABILITY_ENGINE_REPLAY_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'CAPABILITY_ENGINE_REPLAY_POSTGRES_TEST_REQUIRED=1 requires CAPABILITY_ENGINE_REPLAY_TEST_DATABASE_URL.'
  );
const integration = url ? describe : describe.skip;
const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const capabilityMigrations = () =>
  loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/capability-engine');

const definition: RuntimeCapabilityDefinition = {
  schemaVersion: 1,
  runtimeCapabilityDefinitionId: 'runtime-capability_replay-postgres',
  version: 1,
  capabilityId: 'replay-capability',
  capabilityVersion: '1.0.0',
  title: 'Replay Capability',
  description: 'Test-only governed Capability for PostgreSQL replay acceptance.',
  lineage: { capabilityId: 'replay-capability' },
  canonReference: {
    canonId: 'capability-replay-postgres',
    canonVersion: '1',
    sourceFingerprintSha256: 'b'.repeat(64)
  },
  acceptedCanonProjection: true,
  createdFromWorkEvidence: false,
  createdFromAiOutput: false,
  createdAt: '2026-08-26T01:00:00.000Z'
};

const profile: ImplementationProfile = {
  schemaVersion: 1,
  implementationProfileId: 'implementation-profile_replay-postgres',
  version: 1,
  capabilityId: 'replay-capability',
  capabilityVersion: '1.0.0',
  kind: 'DETERMINISTIC_SERVICE',
  status: 'APPROVED',
  implementationKey: 'capability-engine:test:postgres-replay',
  inputSchemaId: 'replay-input.v1',
  outputSchemaId: 'replay-output.v1',
  allowedCallerProducts: ['LITE'],
  maximumRiskClass: 'MODERATE',
  timeoutMs: 2_000,
  maxAttempts: 1,
  approvalPolicyVersion: 'replay-policy.v1',
  createdAt: '2026-08-26T01:00:00.000Z'
};

function command(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 2,
    capabilityId: 'replay-capability',
    capabilityVersion: '1.0.0',
    caller: {
      workspaceId: 'workspace_replay_postgres',
      principalId: 'principal_replay_postgres',
      callerProduct: 'LITE',
      permissionContextRef: 'permission_replay_postgres'
    },
    purpose: 'Exercise restart-safe PostgreSQL governed replay.',
    input: { question: 'What changed?' },
    inputSchemaId: 'replay-input.v1',
    outputSchemaId: 'replay-output.v1',
    riskClass: 'MODERATE',
    idempotencyKey: 'durable-replay-postgres-1',
    correlationId: 'correlation_durable_replay_postgres',
    ...overrides
  };
}

function governedIds(execution: CapabilityRuntimeExecution) {
  return {
    capabilityRequestId: execution.request.capabilityRequestId,
    implementationBindingId: execution.binding.implementationBindingId,
    capabilityInvocationId: execution.invocation.capabilityInvocationId,
    capabilityOutcomeId: execution.outcome.capabilityOutcomeId,
    capabilityReturnId: execution.returnValue.capabilityReturnId,
    sessionReceiptId: execution.receipt.sessionReceiptId
  };
}

let database: ManagedDatabase;

function durableStore() {
  return new PostgresCapabilityRuntimeReplayStoreV1(database, database.getPool());
}

function runtime(execute: ReturnType<typeof vi.fn>) {
  const base = new GovernedCapabilityRuntime({
    definitions: { findCurrent: () => Promise.resolve(definition) },
    implementations: {
      select: () => Promise.resolve({ profile, policyVersion: 'replay-policy.v1' })
    },
    inputContracts: { validate: () => true },
    outputContracts: { validate: () => true },
    executor: { execute },
    now: () => '2026-08-26T01:01:00.000Z'
  });
  return new DurableGovernedCapabilityRuntimeV1({
    runtime: base,
    replayStore: durableStore(),
    now: () => '2026-08-26T01:01:00.000Z',
    waitTimeoutMs: 2_000
  });
}

integration('MO-CAP-001 WP07B PostgreSQL governed replay', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(
      parseDatabaseConfig({
        NODE_ENV: 'test',
        DATABASE_URL: url,
        DB_MIGRATION_NAMESPACE: 'capability_engine_governed_runtime_replay_test',
        DB_APPLICATION_NAME: 'markorbit-governed-runtime-replay-tests'
      })
    );
    await database.start();
    await database.getPool().query(
      `DROP TABLE IF EXISTS
         capability_governed_runtime_replays,
         capability_implementation_profile_versions,
         capability_implementation_profile_identities,
         capability_managed_ai_exact_outputs,
         capability_managed_ai_execution_claims,
         capability_reflection_disposition_profile_revisions,
         capability_reflection_disposition_profiles,
         capability_private_reflection_candidate_events,
         capability_private_reflection_candidates,
         capability_observation_events,
         capability_observation_admission_audit,
         capability_observation_admission_commands,
         capability_ledger_entries,
         capability_observations,
         capability_runtime_definition_imports,
         capability_runtime_definitions,
         capability_runtime_identities
       CASCADE;
       DROP SCHEMA IF EXISTS markorbit_persistence CASCADE`
    );
    await migrate(
      database.getPool(),
      'capability_engine_governed_runtime_replay_test',
      await capabilityMigrations()
    );
  });

  beforeEach(async () => {
    await database.getPool().query('TRUNCATE capability_governed_runtime_replays');
  });

  afterAll(async () => database.close());

  it('survives process reconstruction with exact governed identifiers and no second implementation execution', async () => {
    const execute = vi.fn(() => Promise.resolve({ output: { answer: 'postgres durable result' } }));

    const first = await runtime(execute).invoke(command());
    const persisted = await database
      .getPool()
      .query<{ execution_json: unknown }>(
        'SELECT execution_json FROM capability_governed_runtime_replays'
      );
    const persistedExecution = JSON.stringify(persisted.rows[0]?.execution_json);
    expect(persistedExecution).not.toContain('durable-replay-postgres-1');
    expect(persistedExecution).toContain('__MARKORBIT_REPLAY_KEY_REDACTED__');

    const restartedReplay = await runtime(execute).invoke(command());

    expect(first.replayed).toBe(false);
    expect(restartedReplay.request.idempotencyKey).toBe('durable-replay-postgres-1');
    expect(restartedReplay.replayed).toBe(true);
    expect(governedIds(restartedReplay)).toEqual(governedIds(first));
    expect(restartedReplay.outcome).toEqual(first.outcome);
    expect(restartedReplay.returnValue).toEqual(first.returnValue);
    expect(restartedReplay.receipt).toEqual(first.receipt);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('fails closed for a conflicting command after restart', async () => {
    const execute = vi.fn(() => Promise.resolve({ output: { answer: 'postgres durable result' } }));
    await runtime(execute).invoke(command());

    await expect(
      runtime(execute).invoke(command({ input: { question: 'conflicting restart request' } }))
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('coordinates concurrent independent runtimes through one durable claim', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const execute = vi.fn(async () => {
      await gate;
      return { output: { answer: 'postgres concurrent result' } };
    });

    const firstPromise = runtime(execute).invoke(command());
    while (execute.mock.calls.length === 0) await new Promise((resolve) => setTimeout(resolve, 5));
    const replayPromise = runtime(execute).invoke(command());
    release();

    const [first, replayed] = await Promise.all([firstPromise, replayPromise]);
    expect(first.replayed).toBe(false);
    expect(replayed.replayed).toBe(true);
    expect(governedIds(replayed)).toEqual(governedIds(first));
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('detects persisted execution tampering instead of replaying corrupted governed identifiers', async () => {
    const execute = vi.fn(() =>
      Promise.resolve({ output: { answer: 'postgres immutable result' } })
    );
    await runtime(execute).invoke(command());

    await database.getPool().query(
      `UPDATE capability_governed_runtime_replays
          SET execution_json=jsonb_set(
            execution_json,
            '{receipt,sessionReceiptId}',
            '"session-receipt_tampered"'::jsonb,
            false
          )`
    );

    await expect(runtime(execute).invoke(command())).rejects.toMatchObject({
      code: 'INVALID_PERSISTED_REPLAY'
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
