import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type {
  CapabilityRequestV2,
  ImplementationProfile
} from '@markorbit/contracts/capability-runtime';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import {
  PostgresGovernedImplementationProfileSelectorV1,
  PostgresImplementationProfileRegistryV1
} from '../src/implementation-profile-registry-postgres.js';

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
    DB_MIGRATION_NAMESPACE: 'capability_engine_implementation_profile_registry_test',
    DB_APPLICATION_NAME: 'markorbit-implementation-profile-registry-tests'
  });

const definition: RuntimeCapabilityDefinition = {
  schemaVersion: 1,
  runtimeCapabilityDefinitionId: 'runtime-capability_managed-ai',
  version: 4,
  capabilityId: 'managed-ai-execution',
  capabilityVersion: '1.0.0',
  title: 'Managed AI Execution',
  description: 'Governed provider-neutral AI execution.',
  lineage: { capabilityId: 'managed-ai-execution' },
  canonReference: {
    canonId: 'capability-foundation',
    canonVersion: '2026-08-25',
    sourceFingerprintSha256: 'a'.repeat(64)
  },
  acceptedCanonProjection: true,
  createdFromWorkEvidence: false,
  createdFromAiOutput: false,
  createdAt: '2026-08-25T01:00:00.000Z'
};

const request: CapabilityRequestV2 = {
  schemaVersion: 2,
  capabilityRequestId: 'capreq_postgres_test',
  capabilityId: 'managed-ai-execution',
  capabilityVersion: '1.0.0',
  caller: {
    workspaceId: 'workspace_test',
    principalId: 'principal_test',
    callerProduct: 'KNOWLEDGE',
    permissionContextRef: 'permission_test'
  },
  purpose: 'Acquire one governed AI result.',
  input: { question: 'What changed?' },
  inputSchemaId: 'managed-ai-input.v1',
  outputSchemaId: 'managed-ai-output.v1',
  riskClass: 'MODERATE',
  idempotencyKey: 'managed-ai-postgres-1',
  correlationId: 'corr_postgres_test',
  receivedAt: '2026-08-25T01:01:00.000Z'
};

function profile(overrides: Partial<ImplementationProfile> = {}): ImplementationProfile {
  return {
    schemaVersion: 1,
    implementationProfileId: 'implementation-profile_deepseek',
    version: 1,
    capabilityId: 'managed-ai-execution',
    capabilityVersion: '1.0.0',
    kind: 'AI_ASSISTED_SERVICE',
    status: 'APPROVED',
    implementationKey: 'ai:deepseek:managed-v1',
    inputSchemaId: 'managed-ai-input.v1',
    outputSchemaId: 'managed-ai-output.v1',
    allowedCallerProducts: ['KNOWLEDGE'],
    maximumRiskClass: 'MODERATE',
    timeoutMs: 45_000,
    maxAttempts: 1,
    approvalPolicyVersion: 'implementation-admission.v1',
    createdAt: '2026-08-25T01:00:00.000Z',
    ...overrides
  };
}

let database: ManagedDatabase;

function registry() {
  return new PostgresImplementationProfileRegistryV1(database, database.getPool());
}

async function reset() {
  await database
    .getPool()
    .query(
      'TRUNCATE capability_implementation_profile_versions, capability_implementation_profile_identities CASCADE'
    );
}

integration('durable Implementation Profile registry', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    await database.getPool().query(
      `DROP TABLE IF EXISTS
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
      'capability_engine_implementation_profile_registry_test',
      await capabilityMigrations()
    );
  });

  beforeEach(reset);
  afterAll(async () => database.close());

  it('survives registry restart with exact-version replay and current-version reads', async () => {
    const first = registry();
    const v1 = profile();
    const v2 = profile({
      version: 2,
      timeoutMs: 60_000,
      approvalPolicyVersion: 'implementation-admission.v2',
      createdAt: '2026-08-25T02:00:00.000Z'
    });

    await expect(first.register(v1)).resolves.toEqual(v1);
    await expect(first.register(v2)).resolves.toEqual(v2);

    const restarted = registry();
    await expect(restarted.findVersion(v1.implementationProfileId, 1)).resolves.toEqual(v1);
    await expect(restarted.findCurrent(v1.implementationProfileId)).resolves.toEqual(v2);
    await expect(restarted.listCurrent('managed-ai-execution')).resolves.toEqual([v2]);
  });

  it('keeps exact versions immutable and preserves profile lineage', async () => {
    const store = registry();
    const v1 = profile();
    await store.register(v1);
    await expect(store.register(v1)).resolves.toEqual(v1);

    await expect(store.register(profile({ timeoutMs: 30_000 }))).rejects.toMatchObject({
      code: 'PROFILE_VERSION_CONFLICT'
    });
    await expect(
      store.register(
        profile({
          version: 2,
          implementationKey: 'ai:other:managed-v1',
          createdAt: '2026-08-25T02:00:00.000Z'
        })
      )
    ).rejects.toMatchObject({ code: 'PROFILE_LINEAGE_CONFLICT' });
  });

  it('persists retirement without falling back to an older approved version', async () => {
    const store = registry();
    const approved = profile();
    const retired = profile({
      version: 2,
      status: 'RETIRED',
      approvalPolicyVersion: 'implementation-admission.v2',
      createdAt: '2026-08-25T02:00:00.000Z'
    });
    await store.register(approved);
    await store.register(retired);

    const restarted = registry();
    const selector = new PostgresGovernedImplementationProfileSelectorV1(restarted, {
      policyVersion: 'selection.v1',
      admittedImplementationKinds: ['AI_ASSISTED_SERVICE']
    });

    await expect(restarted.findVersion(approved.implementationProfileId, 1)).resolves.toEqual(
      approved
    );
    await expect(restarted.findCurrent(approved.implementationProfileId)).resolves.toEqual(retired);
    await expect(selector.select(request, definition)).resolves.toBeUndefined();
  });

  it('allows only one profile lineage to own an implementation key under concurrent registration', async () => {
    const left = registry();
    const right = registry();
    const results = await Promise.allSettled([
      left.register(profile({ implementationProfileId: 'implementation-profile_left' })),
      right.register(
        profile({
          implementationProfileId: 'implementation-profile_right',
          createdAt: '2026-08-25T01:00:01.000Z'
        })
      )
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected).toMatchObject({
      status: 'rejected',
      reason: { code: 'IMPLEMENTATION_KEY_CONFLICT' }
    });
    await expect(registry().listCurrent('managed-ai-execution')).resolves.toHaveLength(1);
  });

  it('selects through the existing governed selector interface using durable current profiles', async () => {
    const store = registry();
    await store.register(profile());
    const selector = new PostgresGovernedImplementationProfileSelectorV1(store, {
      policyVersion: 'selection.v1',
      admittedImplementationKinds: ['AI_ASSISTED_SERVICE']
    });

    await expect(selector.select(request, definition)).resolves.toEqual({
      profile: profile(),
      policyVersion: 'selection.v1'
    });
  });
});
