import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BrainAssetVersion } from '@markorbit/contracts/brain';
import type { BrainBuildRequest, BrainBuildResult } from '@markorbit/contracts/brain-build';
import type { BrainEvidenceAssertion } from '@markorbit/contracts/brain-evidence';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import { PostgresBrainAssetRegistry } from '../src/brain-asset-registry-postgres.js';
import { runBrainBuild } from '../src/brain-build-runtime.js';

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
    DB_APPLICATION_NAME: 'markorbit-brn-007-tests'
  });

let database: ManagedDatabase;
const sourceSha = 'c'.repeat(64);

function assertion(id: string, value: unknown): BrainEvidenceAssertion {
  return {
    schemaVersion: 1,
    evidenceRef: {
      sourceOwner: 'KNOWLEDGE',
      sourceObjectId: id,
      sourceVersion: '2026-08',
      sourceFingerprintSha256: sourceSha,
      observedAt: '2026-08-26T00:00:00.000Z'
    },
    authorityClass: 'CURRENT_OFFICIAL_PRIMARY',
    scope: {
      domain: 'TRADEMARK',
      jurisdiction: 'US',
      concept: 'brain.registry.postgres.test',
      effectiveFrom: '2026-01-01T00:00:00.000Z'
    },
    valueKind: 'EXACT',
    value,
    assertedAt: '2026-08-26T00:00:00.000Z'
  };
}

function request(
  id: string,
  value: unknown,
  validation = 0.2,
  builtAt = '2026-08-27T00:00:00.000Z'
): BrainBuildRequest {
  return {
    assertions: [assertion(id, value)],
    query: {
      domain: 'TRADEMARK',
      jurisdiction: 'US',
      concept: 'brain.registry.postgres.test',
      asOf: '2026-08-27T00:00:00.000Z'
    },
    qualityEvidence: {
      coverage: 1,
      validation,
      methodQuality: 1,
      coverageReason: 'Complete registry durability fixture coverage.',
      validationReason: 'Deterministic registry durability fixture validation.',
      methodQualityReason: 'Direct deterministic evidence resolution.'
    },
    assetScope: {
      inputSchemaId: 'brain-input.registry-postgres.v1',
      outputSchemaId: 'brain-output.registry-postgres.v1',
      effectiveFrom: '2026-01-01T00:00:00.000Z'
    },
    builtAt
  };
}

function lifecycleAsset(
  version: number,
  status: BrainAssetVersion['status'],
  overrides: Partial<BrainAssetVersion> = {}
): BrainAssetVersion {
  const grounded = ['VALIDATED', 'ACTIVE', 'DEGRADED'].includes(status);
  return {
    schemaVersion: 1,
    brainAssetId: 'brain-asset_pg-lifecycle',
    brainAssetVersionId: `brain-asset-version_pg-lifecycle-v${version}`,
    version,
    assetType: 'STATISTICAL_ESTIMATE',
    status,
    scope: {
      domain: 'TRADEMARK',
      jurisdiction: 'US',
      concept: 'brain.registry.lifecycle',
      inputSchemaId: 'brain-input.registry-postgres.v1',
      outputSchemaId: 'brain-output.registry-postgres.v1',
      effectiveFrom: '2026-01-01T00:00:00.000Z'
    },
    evidenceRefs: grounded
      ? [
          {
            sourceOwner: 'KNOWLEDGE',
            sourceObjectId: 'official-lifecycle-evidence',
            sourceVersion: '2026-08',
            sourceFingerprintSha256: sourceSha
          }
        ]
      : [],
    derivedFromBrainAssetVersionIds: [],
    confidence: {
      score: grounded ? 0.92 : 0.4,
      band: grounded ? 'VERY_HIGH' : 'LOW',
      factors: {
        authority: grounded ? 1 : 0.4,
        freshness: grounded ? 1 : 0.4,
        agreement: grounded ? 1 : 0.4,
        coverage: grounded ? 1 : 0.4,
        validation: grounded ? 0.9 : 0,
        methodQuality: grounded ? 1 : 0.4
      }
    },
    payload: { medianMonths: 6.5 + version / 10 },
    createdAt: `2026-08-${String(version).padStart(2, '0')}T00:00:00.000Z`,
    ...(grounded ? { validatedAt: '2026-08-20T00:00:00.000Z' } : {}),
    ...overrides
  };
}

async function reopen(): Promise<PostgresBrainAssetRegistry> {
  await database.close();
  database = new ManagedDatabase(config());
  await database.start();
  return new PostgresBrainAssetRegistry(database);
}

async function cleanup(): Promise<void> {
  await database.getPool().query('TRUNCATE brain_build_admissions,brain_asset_versions CASCADE');
}

integration('PostgreSQL Brain Asset Registry durability', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    await database
      .getPool()
      .query(
        'DROP TABLE IF EXISTS brain_build_admissions,brain_asset_versions CASCADE; DROP SCHEMA IF EXISTS markorbit_persistence CASCADE'
      );
    await migrate(database.getPool(), 'core_brain_registry', await coreMigrations());
  });

  afterAll(async () => database.close());

  it('persists BuildRun admission and replays idempotently after database client restart', async () => {
    await cleanup();
    const result = runBrainBuild(request('restart-a', { amountMinor: 35000, currency: 'USD' }));
    const firstRegistry = new PostgresBrainAssetRegistry(database);
    const first = await firstRegistry.admitBuildResult(result);

    const restarted = await reopen();
    const replay = await restarted.admitBuildResult(result);
    const versions = await restarted.listVersions(first.brainAssetId);

    expect(replay).toEqual(first);
    expect(versions).toHaveLength(1);
    expect(versions[0]?.version).toBe(1);
    expect(versions[0]?.status).toBe('CANDIDATE');
  });

  it('serializes concurrent same-asset BuildRuns into distinct contiguous versions', async () => {
    await cleanup();
    const registry = new PostgresBrainAssetRegistry(database);
    const firstRun = runBrainBuild(
      request('race-a', { amountMinor: 35000, currency: 'USD' }, 0.2, '2026-08-27T01:00:00.000Z')
    );
    const secondRun = runBrainBuild(
      request('race-b', { amountMinor: 36000, currency: 'USD' }, 0.2, '2026-08-27T02:00:00.000Z')
    );
    expect(firstRun.run.brainBuildRunId).not.toBe(secondRun.run.brainBuildRunId);
    expect(firstRun.run.producedAssetVersion?.brainAssetId).toBe(
      secondRun.run.producedAssetVersion?.brainAssetId
    );

    const admitted = await Promise.all([
      registry.admitBuildResult(firstRun),
      registry.admitBuildResult(secondRun)
    ]);
    const versions = await registry.listVersions(admitted[0].brainAssetId);

    expect(versions.map((asset) => asset.version)).toEqual([1, 2]);
    expect(new Set(versions.map((asset) => asset.brainAssetVersionId)).size).toBe(2);
    expect(versions.every((asset) => asset.status === 'CANDIDATE')).toBe(true);
  });

  it('keeps generic lifecycle governance and ACTIVE resolution durable across restart', async () => {
    await cleanup();
    const registry = new PostgresBrainAssetRegistry(database);
    await registry.register(lifecycleAsset(1, 'DRAFT'));
    await registry.register(lifecycleAsset(2, 'CANDIDATE'));
    await registry.register(lifecycleAsset(3, 'VALIDATED'));
    const active = await registry.register(lifecycleAsset(4, 'ACTIVE'));

    const restarted = await reopen();
    const resolved = await restarted.resolveActive({
      domain: 'TRADEMARK',
      jurisdiction: 'us',
      concept: 'brain.registry.lifecycle',
      asOf: '2026-08-27T00:00:00.000Z'
    });

    expect(resolved).toEqual(active);
    expect(
      (await restarted.listVersions(active.brainAssetId)).map((asset) => asset.status)
    ).toEqual(['DRAFT', 'CANDIDATE', 'VALIDATED', 'ACTIVE']);
  });

  it('never persists blocked BuildRuns and never auto-promotes admitted builds to ACTIVE', async () => {
    await cleanup();
    const registry = new PostgresBrainAssetRegistry(database);
    const blocked = runBrainBuild({
      ...request('blocked-a', { answer: 1 }, 0, '2026-08-27T03:00:00.000Z'),
      assertions: []
    });
    expect(blocked.run.status).toBe('BLOCKED');
    await expect(registry.admitBuildResult(blocked)).rejects.toMatchObject({
      code: 'BUILD_NOT_ADMISSIBLE'
    });
    expect((await database.getPool().query('SELECT 1 FROM brain_asset_versions')).rowCount).toBe(0);
    expect((await database.getPool().query('SELECT 1 FROM brain_build_admissions')).rowCount).toBe(
      0
    );

    const candidate = await registry.admitBuildResult(
      runBrainBuild(request('candidate-a', { answer: 2 }, 0.2, '2026-08-27T04:00:00.000Z'))
    );
    expect(candidate.status).toBe('CANDIDATE');
    expect(candidate.status).not.toBe('ACTIVE');
  });

  it('fails closed on BuildRun identity conflict and maps persistence failure safely', async () => {
    await cleanup();
    const registry = new PostgresBrainAssetRegistry(database);
    const original = runBrainBuild(request('identity-a', { answer: 1 }, 0.2));
    await registry.admitBuildResult(original);
    const produced = original.run.producedAssetVersion;
    if (!produced) throw new Error('expected produced asset');
    const conflicting: BrainBuildResult = {
      run: {
        ...original.run,
        producedAssetVersion: {
          ...produced,
          brainAssetVersionId: 'brain-asset-version_conflicting-produced-id'
        }
      }
    };
    await expect(registry.admitBuildResult(conflicting)).rejects.toMatchObject({
      code: 'BUILD_IDENTITY_CONFLICT'
    });

    await database.close();
    await expect(registry.listVersions('brain-asset_unavailable')).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
      message: 'Brain registry persistence is unavailable.'
    });
    database = new ManagedDatabase(config());
    await database.start();
  });
});
