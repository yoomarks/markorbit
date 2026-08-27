import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ExecutableMethodPackageV1 } from '@markorbit/contracts/brain-method';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import { PostgresOfficialFeeReferenceStore } from '../src/official-fee-reference-store-postgres.js';
import {
  OFFICIAL_FEE_PILOT_OPERATION,
  type OfficialFeeMaterializationInputV1
} from '../src/official-fee-reference-store.js';

const url = process.env.BRAIN_REGISTRY_TEST_DATABASE_URL;
const required = process.env.BRAIN_REGISTRY_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'BRAIN_REGISTRY_POSTGRES_TEST_REQUIRED=1 requires BRAIN_REGISTRY_TEST_DATABASE_URL.'
  );
const integration = url ? describe : describe.skip;
const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const coreMigrations = () =>
  loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/core-service');
const config = () =>
  parseDatabaseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DB_MIGRATION_NAMESPACE: 'core_official_fee_reference',
    DB_APPLICATION_NAME: 'markorbit-phase2-fee-reference-tests'
  });

let database: ManagedDatabase;
const sha = (character: string) => character.repeat(64);

function methodPackage(sourceSha = sha('a')): ExecutableMethodPackageV1 {
  return {
    schemaVersion: 1,
    packageId: 'executable-method-package_official-fee-pg-v1',
    packageVersion: 1,
    methodId: 'brain-method_official-fee-resolution-pg',
    methodVersionId: 'brain-method-version_official-fee-resolution-pg-v1',
    methodFamily: 'SOURCE_RESOLUTION',
    lifecycle: 'ACTIVE',
    selectionPriority: 100,
    applicability: {
      jurisdictions: ['US'],
      authorities: ['USPTO'],
      objectTypes: ['TRADEMARK_APPLICATION'],
      operations: [OFFICIAL_FEE_PILOT_OPERATION],
      procedures: ['ELECTRONIC_FILING'],
      stages: ['NEW_APPLICATION'],
      filingBases: ['SECTION_1', 'SECTION_44'],
      segments: ['BASE_FEE'],
      requiredData: ['FILING_BASIS', 'CLASS_COUNT'],
      effectiveFrom: '2026-01-01T00:00:00.000Z'
    },
    inputSchemaId: 'brain-input.official-fee.pg.v1',
    outputSchemaId: 'brain-output.official-fee.pg.v1',
    executable: { strategy: 'authoritative-current-source' },
    requiredData: ['FILING_BASIS', 'CLASS_COUNT'],
    referenceDependencies: [],
    reasonCodes: { RESOLVED: 'Current official source resolved.' },
    fallback: { behavior: 'NOT_APPLICABLE' },
    evaluation: {
      evaluationId: 'evaluation_official-fee-pg-v1',
      evaluatedAt: '2026-08-27T00:00:00.000Z',
      status: 'PASSED',
      baseline: 'official-primary-source',
      metrics: { precision: 1 },
      evidenceSummary: 'Synthetic persistence fixture only.'
    },
    lineage: {
      knowledgeSources: [
        {
          schemaVersion: 1,
          sourceSystem: 'MARKORBIT_KNOWLEDGE',
          content: {
            protocolVersion: '1.0',
            objectType: 'CONTENT_OBJECT_REF',
            objectId: 'knowledge-content_uspto-fee-pg',
            objectKind: 'OFFICIAL_FEE_SCHEDULE',
            workspaceId: 'workspace_phase2-pilot'
          },
          chunkId: 'chunk_official-fee-pg',
          contentSha256: sourceSha,
          indexedAt: '2026-08-27T00:00:00.000Z',
          indexMode: 'EXACT_CHUNK',
          headingPath: ['Trademark fees'],
          retrievalRationale: 'Exact synthetic persistence lineage fixture.'
        }
      ],
      researchDatasets: []
    },
    limitations: ['Frozen pilot fixture.'],
    createdAt: '2026-08-27T00:00:00.000Z',
    activatedAt: '2026-08-27T00:00:00.000Z'
  };
}

function input(
  sourceSha = sha('a'),
  amountMinor = 12345,
  materializedAt = '2026-08-27T01:00:00.000Z'
): OfficialFeeMaterializationInputV1 {
  return {
    package: methodPackage(sourceSha),
    currency: 'USD',
    amountMinor,
    unit: 'PER_CLASS',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    materializedAt
  };
}

const query = {
  operation: OFFICIAL_FEE_PILOT_OPERATION,
  jurisdiction: 'US' as const,
  authority: 'USPTO' as const,
  asOf: '2026-08-28T00:00:00.000Z'
};

async function reopen(): Promise<PostgresOfficialFeeReferenceStore> {
  await database.close();
  database = new ManagedDatabase(config());
  await database.start();
  return new PostgresOfficialFeeReferenceStore(database);
}

async function cleanup(): Promise<void> {
  await database.getPool().query('TRUNCATE official_fee_references');
}

async function ensureCoreMigrations(): Promise<void> {
  const result = await database
    .getPool()
    .query<{ exists: boolean }>(
      "SELECT to_regclass('public.official_fee_references') IS NOT NULL AS exists"
    );
  if (!result.rows[0]?.exists)
    await migrate(database.getPool(), 'core_official_fee_reference', await coreMigrations());
}

integration('PostgreSQL Official Fee Reference durability', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    await ensureCoreMigrations();
  });

  afterAll(async () => database.close());

  it('replays idempotently and resolves from stored state after client restart', async () => {
    await cleanup();
    const firstStore = new PostgresOfficialFeeReferenceStore(database);
    const first = await firstStore.materialize(input());

    const restarted = await reopen();
    const replay = await restarted.materialize(input());
    const resolved = await restarted.resolveCurrent(query);

    expect(replay).toEqual(first);
    expect(resolved).toEqual(first);
    expect((await database.getPool().query('SELECT 1 FROM official_fee_references')).rowCount).toBe(
      1
    );
  });

  it('stales prior lineage atomically when a newer source is materialized', async () => {
    await cleanup();
    const store = new PostgresOfficialFeeReferenceStore(database);
    const oldReference = await store.materialize(input(sha('a'), 12345));
    const current = await store.materialize(input(sha('b'), 23456, '2026-08-28T01:00:00.000Z'));

    expect((await store.get(oldReference.referenceId))?.status).toBe('STALE');
    expect((await store.resolveCurrent(query)).referenceId).toBe(current.referenceId);
    const rows = await database
      .getPool()
      .query<{ status: string }>(
        'SELECT status FROM official_fee_references ORDER BY materialized_at'
      );
    expect(rows.rows.map((row) => row.status)).toEqual(['STALE', 'CURRENT']);
  });

  it('fails closed on conflicting replay identity', async () => {
    await cleanup();
    const store = new PostgresOfficialFeeReferenceStore(database);
    await store.materialize(input(sha('a'), 12345));
    await expect(store.materialize(input(sha('a'), 54321))).rejects.toMatchObject({
      code: 'CONFLICT'
    });
    expect((await database.getPool().query('SELECT 1 FROM official_fee_references')).rowCount).toBe(
      1
    );
  });
});
