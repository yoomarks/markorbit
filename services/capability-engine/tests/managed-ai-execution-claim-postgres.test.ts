import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MANAGED_AI_EXECUTION_CAPABILITY_ID,
  MANAGED_AI_EXECUTION_CONTRACT_VERSION,
  managedAiNoAuthorityConsequences,
  type ManagedAiExecutionOutcomeV1
} from '@markorbit/contracts/managed-ai-execution';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import {
  PostgresManagedAiExecutionClaimStoreV1,
  type ManagedAiExecutionClaimCommandV1
} from '../src/managed-ai-execution-claim.js';
import {
  createManagedAiExecutionRoutesV1,
  type ManagedAiExecutionAuthorityV1
} from '../src/managed-ai-http.js';

const url = process.env.CAPABILITY_ENGINE_TEST_DATABASE_URL;
const required = process.env.CAPABILITY_ENGINE_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'CAPABILITY_ENGINE_POSTGRES_TEST_REQUIRED=1 requires CAPABILITY_ENGINE_TEST_DATABASE_URL.'
  );
const integration = url ? describe : describe.skip;
const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const capabilityMigrations = () =>
  loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/capability-engine');
const config = () =>
  parseDatabaseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DB_MIGRATION_NAMESPACE: 'capability_engine_managed_ai_claim_test',
    DB_APPLICATION_NAME: 'markorbit-managed-ai-claim-tests'
  });

const secret = 'managed-ai-durable-claim-secret-32-bytes';
const idempotencyKey = 'knowledge_assignment_1:deepseek:attempt:1';
const correlationId = 'knowledge_assignment_1';
const t0 = '2026-08-25T00:00:00.000Z';
const t1 = '2026-08-25T00:00:02.000Z';

const input = (prompt = 'Summarize the grounded source pack.') => ({
  schemaVersion: 1,
  processingClass: 'SOURCE_ACQUISITION',
  dataClassification: 'PUBLIC',
  taskInput: {
    schemaVersion: 1,
    kind: 'TEXT_GENERATION',
    prompt,
    systemInstruction: 'Return Markdown only.',
    outputFormat: 'MARKDOWN'
  },
  requestedOutput: {
    schemaId: 'knowledge.ai-distilled-markdown.v1',
    format: 'MARKDOWN'
  },
  requirements: {
    capabilities: ['text-generation'],
    maxLatencyMs: 45_000,
    exactProviderOutputRequired: true,
    provenanceRequired: true
  },
  promptPolicy: {
    policyId: 'knowledge.ai-distillation',
    policyVersion: '1'
  },
  evidence: {
    exactOutput: 'REQUIRED',
    providerRequestId: 'REQUIRED_WHEN_AVAILABLE'
  }
});

const blockedOutcome: ManagedAiExecutionOutcomeV1 = {
  schemaVersion: 1,
  capabilityId: MANAGED_AI_EXECUTION_CAPABILITY_ID,
  capabilityVersion: MANAGED_AI_EXECUTION_CONTRACT_VERSION,
  status: 'BLOCKED',
  deliveryState: 'NOT_DELIVERED',
  retryDisposition: 'RETRY_FORBIDDEN',
  error: {
    code: 'POLICY_BLOCKED',
    message: 'No trusted implementation profile matched.'
  },
  authority: managedAiNoAuthorityConsequences
};

let database: ManagedDatabase;

function store() {
  return new PostgresManagedAiExecutionClaimStoreV1(database, database.getPool());
}

function request(body: unknown = input()) {
  return {
    method: 'POST' as const,
    path: '/internal/v1/managed-ai-executions',
    params: {},
    query: {},
    headers: {
      'x-markorbit-internal-authorization': secret,
      'idempotency-key': idempotencyKey,
      'x-correlation-id': correlationId
    },
    body
  };
}

function route(
  executor: ManagedAiExecutionAuthorityV1,
  claimStore = store(),
  now: () => string = () => t0,
  ownerToken = 'owner-runtime-1'
) {
  return createManagedAiExecutionRoutesV1({
    internalServiceSecret: secret,
    executor,
    claimStore,
    now,
    ownerTokenFactory: () => ownerToken,
    claimLeaseMs: 1_000
  })[0]!;
}

function directClaim(
  overrides: Partial<ManagedAiExecutionClaimCommandV1> = {}
): ManagedAiExecutionClaimCommandV1 {
  return {
    idempotencyKey,
    fingerprintSha256: 'a'.repeat(64),
    executionId: 'maiexec_' + 'b'.repeat(32),
    correlationId,
    ownerToken: 'owner-runtime-1',
    now: t0,
    leaseExpiresAt: '2026-08-25T00:00:01.000Z',
    ...overrides
  };
}

async function reset() {
  await database.getPool().query('TRUNCATE capability_managed_ai_execution_claims');
}

integration('Managed AI durable execution claims', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    await database.getPool().query(
      `DROP TABLE IF EXISTS
         capability_managed_ai_execution_claims,
         capability_reflection_disposition_profile_revisions,
         capability_reflection_disposition_profiles,
         capability_private_reflection_candidate_events,
         capability_private_reflection_candidates,
         capability_observation_events,
         capability_observations,
         capability_runtime_definition_imports,
         capability_runtime_definitions,
         capability_runtime_identities
       CASCADE;
       DROP SCHEMA IF EXISTS markorbit_persistence CASCADE`
    );
    await migrate(
      database.getPool(),
      'capability_engine_managed_ai_claim_test',
      await capabilityMigrations()
    );
  });

  beforeEach(reset);
  afterAll(async () => database.close());

  it('replays the governed outcome after a service restart without executing again', async () => {
    const firstExecute = vi.fn(() => Promise.resolve(blockedOutcome));
    const firstRuntime = route({ execute: firstExecute }, store(), () => t0, 'owner-runtime-1');

    await expect(firstRuntime.handle(request())).resolves.toEqual({
      status: 200,
      body: blockedOutcome
    });
    expect(firstExecute).toHaveBeenCalledTimes(1);

    const restartedExecute = vi.fn(() => Promise.reject(new Error('must not execute')));
    const restartedRuntime = route(
      { execute: restartedExecute },
      store(),
      () => t1,
      'owner-runtime-2'
    );
    await expect(restartedRuntime.handle(request())).resolves.toEqual({
      status: 200,
      body: blockedOutcome
    });
    expect(restartedExecute).not.toHaveBeenCalled();
  });

  it('rejects conflicting idempotency reuse across service restarts', async () => {
    const firstExecute = vi.fn(() => Promise.resolve(blockedOutcome));
    await route({ execute: firstExecute }, store(), () => t0, 'owner-runtime-1').handle(request());

    const restartedExecute = vi.fn(() => Promise.resolve(blockedOutcome));
    await expect(
      route({ execute: restartedExecute }, store(), () => t1, 'owner-runtime-2').handle(
        request(input('Different grounded prompt.'))
      )
    ).rejects.toMatchObject({ status: 409, code: 'IDEMPOTENCY_CONFLICT' });
    expect(restartedExecute).not.toHaveBeenCalled();
  });

  it('prevents a second runtime from executing the same active dispatch', async () => {
    let release: ((value: ManagedAiExecutionOutcomeV1) => void) | undefined;
    const pending = new Promise<ManagedAiExecutionOutcomeV1>((resolve) => {
      release = resolve;
    });
    const firstExecute = vi.fn(() => pending);
    const first = route({ execute: firstExecute }, store(), () => t0, 'owner-runtime-1');
    const secondExecute = vi.fn(() => Promise.resolve(blockedOutcome));
    const second = route(
      { execute: secondExecute },
      store(),
      () => '2026-08-25T00:00:00.500Z',
      'owner-runtime-2'
    );

    const running = first.handle(request());
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const result = await database
        .getPool()
        .query<{ state: string }>(
          `SELECT state FROM capability_managed_ai_execution_claims WHERE idempotency_key=$1`,
          [idempotencyKey]
        );
      if (result.rows[0]?.state === 'DISPATCHING') break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    await expect(second.handle(request())).rejects.toMatchObject({
      status: 409,
      code: 'MANAGED_AI_EXECUTION_IN_PROGRESS',
      retryable: true
    });
    expect(secondExecute).not.toHaveBeenCalled();
    release!(blockedOutcome);
    await expect(running).resolves.toEqual({ status: 200, body: blockedOutcome });
    expect(firstExecute).toHaveBeenCalledTimes(1);
  });

  it('reclaims an expired claim only when provider dispatch never began', async () => {
    const durable = store();
    await expect(durable.claim(directClaim())).resolves.toEqual({ kind: 'ACQUIRED' });
    await expect(
      durable.claim(
        directClaim({
          ownerToken: 'owner-runtime-2',
          now: t1,
          leaseExpiresAt: '2026-08-25T00:00:03.000Z'
        })
      )
    ).resolves.toEqual({ kind: 'ACQUIRED' });

    const row = await database
      .getPool()
      .query(
        `SELECT state,owner_token FROM capability_managed_ai_execution_claims WHERE idempotency_key=$1`,
        [idempotencyKey]
      );
    expect(row.rows[0]).toMatchObject({ state: 'CLAIMED', owner_token: 'owner-runtime-2' });
  });

  it('quarantines an expired dispatch instead of allowing automatic re-execution', async () => {
    const durable = store();
    const first = directClaim();
    await durable.claim(first);
    await durable.markDispatching({
      idempotencyKey: first.idempotencyKey,
      fingerprintSha256: first.fingerprintSha256,
      ownerToken: first.ownerToken,
      now: t0
    });

    await expect(
      durable.claim(
        directClaim({
          ownerToken: 'owner-runtime-2',
          now: t1,
          leaseExpiresAt: '2026-08-25T00:00:03.000Z'
        })
      )
    ).resolves.toEqual({ kind: 'RECONCILIATION_REQUIRED' });

    const row = await database
      .getPool()
      .query(
        `SELECT state,reconciliation_reason FROM capability_managed_ai_execution_claims WHERE idempotency_key=$1`,
        [idempotencyKey]
      );
    expect(row.rows[0]).toMatchObject({
      state: 'RECONCILIATION_REQUIRED',
      reconciliation_reason: 'DISPATCH_LEASE_EXPIRED'
    });
  });

  it('persists reconciliation after an executor failure and blocks the same key after restart', async () => {
    const firstExecute = vi.fn(() => Promise.reject(new Error('network state unknown')));
    const firstRuntime = route({ execute: firstExecute }, store(), () => t0, 'owner-runtime-1');

    await expect(firstRuntime.handle(request())).rejects.toMatchObject({
      status: 503,
      code: 'MANAGED_AI_EXECUTION_RECONCILIATION_REQUIRED',
      retryable: false
    });
    expect(firstExecute).toHaveBeenCalledTimes(1);

    const restartedExecute = vi.fn(() => Promise.resolve(blockedOutcome));
    const restartedRuntime = route(
      { execute: restartedExecute },
      store(),
      () => t1,
      'owner-runtime-2'
    );
    await expect(restartedRuntime.handle(request())).rejects.toMatchObject({
      status: 409,
      code: 'MANAGED_AI_EXECUTION_RECONCILIATION_REQUIRED',
      retryable: false
    });
    expect(restartedExecute).not.toHaveBeenCalled();
  });
});
