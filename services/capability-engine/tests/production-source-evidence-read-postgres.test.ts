import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { compileUsptoOfficialFeeMethodPackageV1 } from '@markorbit/contracts/brain-official-fee-method';
import type { CapabilityRequestV2Command } from '@markorbit/contracts/capability-runtime';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';

import { GovernedCapabilityRuntime } from '../src/capability-runtime.js';
import { PostgresCapabilityRuntimeReplayStoreV1 } from '../src/capability-runtime-replay-store.js';
import { DurableGovernedCapabilityRuntimeV1 } from '../src/durable-governed-capability-runtime.js';
import {
  CapabilityProductionSourceEvidenceReadServiceV1,
  capabilityProductionSourceExecutionReferenceV1
} from '../src/production-source-evidence-read.js';
import {
  USPTO_OFFICIAL_FEE_GOVERNED_COMPILATION_INPUT_V1,
  createApprovedUsptoOfficialFeeResolverCapabilityExecutorV1
} from '../src/uspto-official-fee-production-promotion.js';
import { createUsptoOfficialFeeProductionSourceEvidenceAuthorityV1 } from '../src/uspto-official-fee-production-source-evidence.js';
import {
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_SOURCE_IDENTITY_SHA256,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION,
  USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE,
  USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA,
  USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
  USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA,
  validateUsptoOfficialFeeResolverInputV1,
  validateUsptoOfficialFeeResolverOutputV1
} from '../src/uspto-official-fee-resolver-pilot.js';

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

const EFFECTIVE_FROM = '2025-01-18T00:00:00.000-05:00';
const MATERIALIZED_AT = '2026-08-28T00:00:00.000Z';
const EXECUTED_AT = '2026-09-03T02:45:00.000Z';
const EVALUATED_AT = '2026-09-03T02:46:00.000Z';

function acceptedPackage() {
  const compiled = compileUsptoOfficialFeeMethodPackageV1(
    USPTO_OFFICIAL_FEE_GOVERNED_COMPILATION_INPUT_V1
  );
  if (compiled.status !== 'READY') throw new Error(`unexpected package status ${compiled.status}`);
  return compiled.package;
}

function acceptedReference() {
  const pkg = acceptedPackage();
  return {
    schemaVersion: 1,
    referenceId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID,
    operation: USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
    jurisdiction: 'US',
    authority: 'USPTO',
    currency: 'USD',
    amountMinor: 35000,
    unit: 'PER_CLASS',
    effectiveFrom: EFFECTIVE_FROM,
    status: 'CURRENT',
    packageId: pkg.packageId,
    methodId: pkg.methodId,
    methodVersionId: pkg.methodVersionId,
    knowledgeSources: structuredClone(pkg.lineage.knowledgeSources),
    sourceIdentityFingerprintSha256: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_SOURCE_IDENTITY_SHA256,
    materializationFingerprintSha256: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256,
    materializedAt: MATERIALIZED_AT
  } as const;
}

function command(): CapabilityRequestV2Command {
  return {
    schemaVersion: 2,
    capabilityId: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID,
    capabilityVersion: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION,
    caller: {
      workspaceId: 'workspace_uspto_production_source_read_postgres',
      principalId: 'principal_uspto_production_source_read_postgres',
      callerProduct: 'MARKREG',
      permissionContextRef: 'permission_uspto_production_source_read_postgres'
    },
    purpose: 'Prove restart-safe trusted production source evidence read from PostgreSQL.',
    input: {
      jurisdiction: 'US',
      authority: 'USPTO',
      objectType: 'TRADEMARK_APPLICATION',
      operation: USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
      procedure: 'ELECTRONIC_FILING',
      stage: 'NEW_APPLICATION',
      filingBasis: 'SECTION_1',
      segment: 'BASE_FEE',
      classCount: 2,
      asOf: '2026-08-28T00:00:00.000Z',
      acceptedReferenceId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID
    },
    inputSchemaId: USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA,
    outputSchemaId: USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA,
    riskClass: 'LOW',
    idempotencyKey: 'uspto-production-source-read-postgres-1',
    correlationId: 'correlation_uspto_production_source_read_postgres'
  };
}

function baseRuntime() {
  return new GovernedCapabilityRuntime({
    definitions: {
      findCurrent: () => Promise.resolve(USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION)
    },
    implementations: {
      select: () =>
        Promise.resolve({
          profile: USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE,
          policyVersion: 'phase4-uspto-official-fee-method-selection.v1'
        })
    },
    inputContracts: {
      validate: (schemaId, value) =>
        schemaId === USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA &&
        validateUsptoOfficialFeeResolverInputV1(value)
    },
    outputContracts: {
      validate: (schemaId, value) =>
        schemaId === USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA &&
        validateUsptoOfficialFeeResolverOutputV1(value)
    },
    executor: createApprovedUsptoOfficialFeeResolverCapabilityExecutorV1({
      resolveCurrent: () => acceptedReference()
    }),
    now: () => EXECUTED_AT
  });
}

let database: ManagedDatabase;

function replayStore() {
  return new PostgresCapabilityRuntimeReplayStoreV1(database, database.getPool());
}

function evidenceAuthority() {
  return createUsptoOfficialFeeProductionSourceEvidenceAuthorityV1({
    capabilities: {
      findCurrent: () => Promise.resolve(USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION)
    },
    implementations: {
      findCurrent: () => USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE
    },
    references: {
      resolveCurrent: () => acceptedReference()
    },
    now: () => EVALUATED_AT
  });
}

integration('trusted production source evidence PostgreSQL read', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(
      parseDatabaseConfig({
        NODE_ENV: 'test',
        DATABASE_URL: url,
        DB_MIGRATION_NAMESPACE: 'capability_engine_production_source_read_test',
        DB_APPLICATION_NAME: 'markorbit-production-source-read-tests'
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
      'capability_engine_production_source_read_test',
      await capabilityMigrations()
    );
  });

  beforeEach(async () => {
    await database.getPool().query('TRUNCATE capability_governed_runtime_replays');
  });

  afterAll(async () => database.close());

  it('survives runtime/read-service reconstruction and re-materializes current USPTO V5 truth', async () => {
    const runtime = new DurableGovernedCapabilityRuntimeV1({
      runtime: baseRuntime(),
      replayStore: replayStore(),
      now: () => EXECUTED_AT,
      ownerTokenFactory: () => 'owner_uspto_production_source_read_postgres'
    });
    const execution = await runtime.invoke(command());
    const reference = capabilityProductionSourceExecutionReferenceV1(execution);

    const restartedReadService = new CapabilityProductionSourceEvidenceReadServiceV1({
      replayStore: replayStore(),
      evidence: evidenceAuthority()
    });
    const result = await restartedReadService.read(reference);

    expect(result).toMatchObject({
      status: 'PRODUCTION_ADMISSIBLE',
      historical: {
        capabilityRequestId: execution.request.capabilityRequestId,
        sessionReceiptId: execution.receipt.sessionReceiptId
      },
      source: {
        admission: 'PRODUCTION_ADMISSIBLE',
        evidence: { evidenceVersion: 5 },
        admissionPolicy: {
          policyId: 'source-admission-policy.uspto-official-fee-resolver.v2',
          policyVersion: 2
        }
      }
    });
    const persisted = await database
      .getPool()
      .query<{ execution_json: unknown }>(
        'SELECT execution_json FROM capability_governed_runtime_replays'
      );
    const persistedExecution = JSON.stringify(persisted.rows[0]?.execution_json);
    expect(persistedExecution).not.toContain(command().idempotencyKey);
    expect(persistedExecution).toContain('__MARKORBIT_REPLAY_KEY_REDACTED__');
  });

  it('fails closed before admission when the persisted immutable execution is corrupted', async () => {
    const runtime = new DurableGovernedCapabilityRuntimeV1({
      runtime: baseRuntime(),
      replayStore: replayStore(),
      now: () => EXECUTED_AT,
      ownerTokenFactory: () => 'owner_uspto_production_source_read_postgres_tamper'
    });
    const execution = await runtime.invoke(command());
    const reference = capabilityProductionSourceExecutionReferenceV1(execution);

    await database.getPool().query(
      `UPDATE capability_governed_runtime_replays
          SET execution_json=jsonb_set(
            execution_json,
            '{receipt,sessionReceiptId}',
            '"session-receipt_tampered-production-source"'::jsonb,
            false
          )`
    );

    const result = await new CapabilityProductionSourceEvidenceReadServiceV1({
      replayStore: replayStore(),
      evidence: evidenceAuthority()
    }).read(reference);
    expect(result).toMatchObject({
      status: 'UNAVAILABLE',
      retryable: false,
      denial: { code: 'INVALID_PERSISTED_REPLAY' }
    });
  });
});
