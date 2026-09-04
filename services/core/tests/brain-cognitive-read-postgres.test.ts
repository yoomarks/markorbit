import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { BrainAssetVersion } from '@markorbit/contracts/brain';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import { PostgresBrainAssetRegistry } from '../src/brain-asset-registry-postgres.js';
import { BrainAssetRegistryError } from '../src/brain-asset-registry.js';
import { PostgresBrainAssetCurrentReadAuthority } from '../src/brain-cognitive-read-postgres.js';

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
    DB_MIGRATION_NAMESPACE: 'core_brain_registry',
    DB_APPLICATION_NAME: 'markorbit-core-cognitive-read-tests'
  });

let database: ManagedDatabase;
let registry: PostgresBrainAssetRegistry;
let reader: PostgresBrainAssetCurrentReadAuthority;

function asset(
  id: string,
  version: number,
  status: BrainAssetVersion['status']
): BrainAssetVersion {
  return {
    schemaVersion: 1,
    brainAssetId: `brain-asset_${id}`,
    brainAssetVersionId: `brain-asset-version_${id}-v${version}`,
    version,
    assetType: 'STATISTICAL_ESTIMATE',
    status,
    scope: {
      domain: 'TRADEMARK',
      jurisdiction: 'US',
      concept: `control-center.postgres.${id}`,
      inputSchemaId: 'brain-input.control-center-postgres.v1',
      outputSchemaId: 'brain-output.control-center-postgres.v1',
      effectiveFrom: '2026-01-01T00:00:00.000Z'
    },
    evidenceRefs: [],
    derivedFromBrainAssetVersionIds: [],
    confidence: {
      score: 0.5,
      band: 'MEDIUM',
      factors: {
        authority: 0.5,
        freshness: 0.5,
        agreement: 0.5,
        coverage: 0.5,
        validation: 0.5,
        methodQuality: 0.5
      }
    },
    payload: { secretInternalPayload: `${id}:${version}` },
    createdAt: `2026-09-0${version}T00:00:00.000Z`
  };
}

integration('PostgreSQL Brain cognitive current read authority', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    const existing = await database
      .getPool()
      .query<{ brain_asset_versions: string | null }>(
        "SELECT to_regclass('public.brain_asset_versions')::text AS brain_asset_versions"
      );
    if (!existing.rows[0]?.brain_asset_versions)
      await migrate(database.getPool(), 'core_brain_registry', await coreMigrations());
    registry = new PostgresBrainAssetRegistry(database);
    reader = new PostgresBrainAssetCurrentReadAuthority(database);
  });

  beforeEach(async () => {
    await database.getPool().query('TRUNCATE brain_build_admissions,brain_asset_versions CASCADE');
  });

  afterAll(async () => {
    await database?.close();
  });

  it('returns exactly the latest persisted version per Brain Asset in deterministic identity order', async () => {
    await registry.register(asset('z', 1, 'DRAFT'));
    await registry.register(asset('z', 2, 'CANDIDATE'));
    await registry.register(asset('a', 1, 'DRAFT'));

    const current = await reader.listCurrent();

    expect(current.map((item) => [item.brainAssetId, item.version, item.status])).toEqual([
      ['brain-asset_a', 1, 'DRAFT'],
      ['brain-asset_z', 2, 'CANDIDATE']
    ]);
  });

  it('fails closed when a persisted current Brain Asset document is malformed', async () => {
    const stored = await registry.register(asset('a', 1, 'DRAFT'));
    await database
      .getPool()
      .query(
        'UPDATE brain_asset_versions SET asset_json=$1::jsonb WHERE brain_asset_version_id=$2',
        [JSON.stringify({ schemaVersion: 1, corrupted: true }), stored.brainAssetVersionId]
      );

    try {
      await reader.listCurrent();
      throw new Error('Expected the malformed persisted document to fail closed.');
    } catch (error) {
      expect(error).toBeInstanceOf(BrainAssetRegistryError);
      expect((error as BrainAssetRegistryError).code).toBe('PERSISTENCE_UNAVAILABLE');
    }
  });
});
