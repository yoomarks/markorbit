import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import {
  PostgresRuntimeCapabilityRegistry,
  RuntimeCapabilityRegistryError
} from '../src/runtime-capability-registry.js';

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
    DB_MIGRATION_NAMESPACE: 'capability_engine_runtime_registry_test',
    DB_APPLICATION_NAME: 'markorbit-m6-wp-02-tests'
  });

let database: ManagedDatabase;

function accepted(canonVersion = '2026.08.12', capabilityVersion = '1.0.0') {
  return {
    sourceAuthority: 'ACCEPTED_CAPABILITY_CANON',
    capabilityId: 'trademark-application-recommendation',
    capabilityVersion,
    title: 'Trademark application recommendation',
    description: 'Builds a governed trademark application recommendation.',
    lineage: {
      domainId: 'trademark-services',
      capabilityId: 'trademark-application-recommendation',
      skillId: 'application-planning',
      actionId: 'recommend-application-plan'
    },
    canonReference: {
      canonId: 'capability-canon',
      canonVersion,
      sourceFingerprintSha256: canonVersion === '2026.08.12' ? 'a'.repeat(64) : 'b'.repeat(64)
    }
  };
}

function registry() {
  return new PostgresRuntimeCapabilityRegistry(database, database.getPool());
}

async function reset() {
  await database
    .getPool()
    .query(
      'TRUNCATE capability_runtime_definition_imports, capability_runtime_definitions, capability_runtime_identities CASCADE'
    );
}

integration('M6-WP-02 PostgreSQL runtime Capability Registry', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    await database
      .getPool()
      .query(
        'DROP TABLE IF EXISTS capability_runtime_definition_imports, capability_runtime_definitions, capability_runtime_identities CASCADE; DROP SCHEMA IF EXISTS markorbit_persistence CASCADE'
      );
    await migrate(
      database.getPool(),
      'capability_engine_runtime_registry_test',
      await capabilityMigrations()
    );
  });

  beforeEach(reset);
  afterAll(async () => database.close());

  it('imports accepted Canon as version 1 and keeps authority flags false', async () => {
    const result = await registry().importAccepted({
      definition: accepted(),
      idempotencyKey: 'canon-import-1'
    });
    expect(result.replayed).toBe(false);
    expect(result.definition).toMatchObject({
      version: 1,
      capabilityId: 'trademark-application-recommendation',
      capabilityVersion: '1.0.0',
      acceptedCanonProjection: true,
      createdFromWorkEvidence: false,
      createdFromAiOutput: false
    });
    expect(await registry().findCurrent(result.definition.capabilityId)).toEqual(result.definition);
  });

  it('replays the same idempotency key and same Canon version without duplicate business state', async () => {
    const store = registry();
    const first = await store.importAccepted({
      definition: accepted(),
      idempotencyKey: 'canon-import-1'
    });
    const sameKey = await store.importAccepted({
      definition: accepted(),
      idempotencyKey: 'canon-import-1'
    });
    const newKey = await store.importAccepted({
      definition: accepted(),
      idempotencyKey: 'canon-import-2'
    });
    expect(sameKey.replayed).toBe(true);
    expect(newKey.replayed).toBe(true);
    expect(sameKey.definition).toEqual(first.definition);
    expect(newKey.definition).toEqual(first.definition);
    expect(await store.listVersions(first.definition.capabilityId)).toHaveLength(1);
  });

  it('fails closed when the same Canon identity/version changes payload', async () => {
    const store = registry();
    await store.importAccepted({ definition: accepted(), idempotencyKey: 'canon-import-1' });
    await expect(
      store.importAccepted({
        definition: { ...accepted(), description: 'Conflicting accepted payload.' },
        idempotencyKey: 'canon-import-2'
      })
    ).rejects.toMatchObject({ code: 'CANON_VERSION_CONFLICT' });
  });

  it('keeps one stable runtime identity while accepted Canon versions advance', async () => {
    const store = registry();
    const first = await store.importAccepted({
      definition: accepted(),
      idempotencyKey: 'canon-import-1'
    });
    const second = await store.importAccepted({
      definition: accepted('2026.09.01', '1.1.0'),
      idempotencyKey: 'canon-import-2'
    });
    expect(second.definition.runtimeCapabilityDefinitionId).toBe(
      first.definition.runtimeCapabilityDefinitionId
    );
    expect(second.definition.version).toBe(2);
    expect(
      (await store.listVersions(first.definition.capabilityId)).map((item) => item.version)
    ).toEqual([1, 2]);
  });

  it('survives database reopen with exact version lineage intact', async () => {
    const first = await registry().importAccepted({
      definition: accepted(),
      idempotencyKey: 'canon-import-1'
    });
    await database.close();
    database = new ManagedDatabase(config());
    await database.start();
    const reopened = registry();
    expect(await reopened.findVersion(first.definition.runtimeCapabilityDefinitionId, 1)).toEqual(
      first.definition
    );
    expect(
      (
        await reopened.importAccepted({
          definition: accepted(),
          idempotencyKey: 'canon-import-1'
        })
      ).replayed
    ).toBe(true);
  });

  it('serializes conflicting concurrent imports so only one Canon payload wins', async () => {
    const store = registry();
    const results = await Promise.allSettled([
      store.importAccepted({ definition: accepted(), idempotencyKey: 'concurrent-a' }),
      store.importAccepted({
        definition: { ...accepted(), description: 'Conflicting concurrent payload.' },
        idempotencyKey: 'concurrent-b'
      })
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected?.status === 'rejected' ? rejected.reason : undefined).toMatchObject({
      code: 'CANON_VERSION_CONFLICT'
    });
    expect(await store.listVersions('trademark-application-recommendation')).toHaveLength(1);
  });

  it('has no Workspace column in global accepted runtime definition truth', async () => {
    const columns = await database
      .getPool()
      .query<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name='capability_runtime_definitions'"
      );
    expect(columns.rows.map((row) => row.column_name)).not.toContain('workspace_id');
  });

  it('reports idempotency drift as a typed conflict', async () => {
    const store = registry();
    await store.importAccepted({ definition: accepted(), idempotencyKey: 'same-key' });
    await expect(
      store.importAccepted({
        definition: accepted('2026.09.01', '1.1.0'),
        idempotencyKey: 'same-key'
      })
    ).rejects.toBeInstanceOf(RuntimeCapabilityRegistryError);
    await expect(
      store.importAccepted({
        definition: accepted('2026.09.01', '1.1.0'),
        idempotencyKey: 'same-key'
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });
});
