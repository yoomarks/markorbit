import { createHash } from 'node:crypto';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MANAGED_AI_EXECUTION_CAPABILITY_ID,
  MANAGED_AI_EXECUTION_CONTRACT_VERSION,
  managedAiNoAuthorityConsequences,
  type ManagedAiExecutionOutcomeV1,
  type ManagedAiExactOutputInlineV1
} from '@markorbit/contracts/managed-ai-execution';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import { PostgresManagedAiExecutionClaimStoreV1 } from '../src/managed-ai-execution-claim.js';
import {
  ManagedAiExactOutputStoreError,
  PostgresManagedAiExactOutputStoreV1
} from '../src/managed-ai-exact-output.js';
import { createManagedAiExecutionRoutesV1 } from '../src/managed-ai-http.js';

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
    DB_MIGRATION_NAMESPACE: 'capability_engine_managed_ai_exact_output_test',
    DB_APPLICATION_NAME: 'markorbit-managed-ai-exact-output-tests'
  });

const secret = 'managed-ai-exact-output-postgres-secret-32-bytes';
const idempotencyKey = 'knowledge_exact_output_postgres:attempt:1';
const correlationId = 'knowledge_exact_output_postgres';
const now = '2026-08-25T00:00:02.000Z';
const bytes = Buffer.from('# Durable exact output\n\nProvider bytes survive restart.\n', 'utf8');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const executionId = `maiexec_${createHash('sha256')
  .update(idempotencyKey)
  .digest('hex')
  .slice(0, 32)}`;
const durableRef = `managed-ai-output:v1:${executionId}`;

const input = {
  schemaVersion: 1,
  processingClass: 'SOURCE_ACQUISITION',
  dataClassification: 'PUBLIC',
  taskInput: { prompt: 'Ground the source pack.' },
  requestedOutput: { schemaId: 'knowledge.ai-distilled-markdown.v1', format: 'MARKDOWN' },
  requirements: {
    capabilities: ['text-generation'],
    exactProviderOutputRequired: true,
    provenanceRequired: true
  },
  promptPolicy: { policyId: 'knowledge.ai-distillation', policyVersion: '1' },
  evidence: { exactOutput: 'REQUIRED', providerRequestId: 'REQUIRED_WHEN_AVAILABLE' }
};

const inlineOutput: ManagedAiExactOutputInlineV1 = {
  kind: 'INLINE_BASE64',
  mediaType: 'text/markdown; charset=utf-8',
  sha256,
  sizeBytes: bytes.byteLength,
  dataBase64: bytes.toString('base64')
};

const completedOutcome: ManagedAiExecutionOutcomeV1 = {
  schemaVersion: 1,
  capabilityId: MANAGED_AI_EXECUTION_CAPABILITY_ID,
  capabilityVersion: MANAGED_AI_EXECUTION_CONTRACT_VERSION,
  status: 'COMPLETED',
  deliveryState: 'PROVIDER_COMPLETED',
  retryDisposition: 'RETRY_FORBIDDEN',
  provenance: {
    implementationProfileId: 'knowledge-deepseek-source-acquisition',
    implementationProfileVersion: 1,
    implementationKey: 'ai:deepseek:chat-completions:v1',
    provider: 'DEEPSEEK',
    model: 'deepseek-v4-flash',
    promptPolicyId: 'knowledge.ai-distillation',
    promptPolicyVersion: '1',
    outputSchemaId: 'knowledge.ai-distilled-markdown.v1',
    inputSha256: 'b'.repeat(64),
    providerRequestId: 'provider-request-postgres-1',
    startedAt: '2026-08-25T00:00:00.000Z',
    completedAt: '2026-08-25T00:00:01.000Z'
  },
  exactOutput: inlineOutput,
  structuredOutput: '# Durable exact output\n\nProvider bytes survive restart.\n',
  authority: managedAiNoAuthorityConsequences
};

let database: ManagedDatabase;

function executionRequest() {
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
    body: input
  };
}

function resolutionRequest(ref = durableRef) {
  return {
    method: 'POST' as const,
    path: '/internal/v1/managed-ai-exact-output-resolutions',
    params: {},
    query: {},
    headers: { 'x-markorbit-internal-authorization': secret },
    body: { ref }
  };
}

function routes(execute: () => Promise<unknown>, ownerToken: string) {
  const pool = database.getPool();
  return createManagedAiExecutionRoutesV1({
    internalServiceSecret: secret,
    executor: { execute },
    claimStore: new PostgresManagedAiExecutionClaimStoreV1(database, pool),
    exactOutputStore: new PostgresManagedAiExactOutputStoreV1(pool),
    now: () => now,
    ownerTokenFactory: () => ownerToken,
    claimLeaseMs: 60_000
  });
}

async function reset() {
  await database
    .getPool()
    .query('TRUNCATE capability_managed_ai_exact_outputs, capability_managed_ai_execution_claims');
}

integration('Managed AI durable exact outputs', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    await database.getPool().query(
      `DROP TABLE IF EXISTS
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
      'capability_engine_managed_ai_exact_output_test',
      await capabilityMigrations()
    );
  });

  beforeEach(reset);
  afterAll(async () => database.close());

  it('replays a durable reference and resolves exact bytes after runtime restart', async () => {
    const firstExecute = vi.fn(() => Promise.resolve(completedOutcome));
    const firstRuntime = routes(firstExecute, 'exact-output-owner-1');

    const first = await firstRuntime[0]!.handle(executionRequest());
    expect(first).toMatchObject({
      status: 200,
      body: {
        status: 'COMPLETED',
        exactOutput: {
          kind: 'DURABLE_REF',
          ref: durableRef,
          sha256,
          sizeBytes: bytes.byteLength
        }
      }
    });
    expect(firstExecute).toHaveBeenCalledTimes(1);

    const restartedExecute = vi.fn(() => Promise.reject(new Error('must not re-dispatch')));
    const restartedRuntime = routes(restartedExecute, 'exact-output-owner-2');
    await expect(restartedRuntime[0]!.handle(executionRequest())).resolves.toEqual(first);
    expect(restartedExecute).not.toHaveBeenCalled();

    await expect(restartedRuntime[1]!.handle(resolutionRequest())).resolves.toEqual({
      status: 200,
      body: inlineOutput
    });
  });

  it('keeps the execution-addressed reference immutable across repeated persistence', async () => {
    const store = new PostgresManagedAiExactOutputStoreV1(database.getPool());
    const first = await store.persist({ executionId, output: inlineOutput, now });
    await expect(store.persist({ executionId, output: inlineOutput, now })).resolves.toEqual(first);

    const otherBytes = Buffer.from('x'.repeat(bytes.byteLength), 'utf8');
    const conflictingOutput: ManagedAiExactOutputInlineV1 = {
      ...inlineOutput,
      sha256: createHash('sha256').update(otherBytes).digest('hex'),
      dataBase64: otherBytes.toString('base64')
    };
    await expect(
      store.persist({ executionId, output: conflictingOutput, now })
    ).rejects.toMatchObject({
      code: 'REFERENCE_CONFLICT'
    });
  });

  it('fails closed when persisted bytes are tampered without changing their stored length', async () => {
    const store = new PostgresManagedAiExactOutputStoreV1(database.getPool());
    await store.persist({ executionId, output: inlineOutput, now });
    const tampered = Buffer.from('z'.repeat(bytes.byteLength), 'utf8');
    await database
      .getPool()
      .query('UPDATE capability_managed_ai_exact_outputs SET exact_bytes=$2 WHERE output_ref=$1', [
        durableRef,
        tampered
      ]);

    await expect(store.resolve(durableRef)).rejects.toBeInstanceOf(ManagedAiExactOutputStoreError);
    await expect(store.resolve(durableRef)).rejects.toMatchObject({
      code: 'INVALID_PERSISTED_OUTPUT'
    });
  });
});
