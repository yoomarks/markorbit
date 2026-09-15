import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import { PostgresWorkspaceCommercialRepositoryV1 } from '../src/workspace-commercial-postgres.js';

const url = process.env.CORE_COMMERCIAL_TEST_DATABASE_URL;
const required = process.env.CORE_COMMERCIAL_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'CORE_COMMERCIAL_POSTGRES_TEST_REQUIRED=1 requires CORE_COMMERCIAL_TEST_DATABASE_URL.'
  );
const integration = url ? describe : describe.skip;
const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
let database: ManagedDatabase;

integration('PostgreSQL Workspace commercial persistence', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(
      parseDatabaseConfig({
        NODE_ENV: 'test',
        DATABASE_URL: url,
        DB_MIGRATION_NAMESPACE: 'core_auth',
        DB_APPLICATION_NAME: 'markorbit-workspace-commercial-tests'
      })
    );
    await database.start();
    const migrations = await loadMigrationsForOwner(
      migrationsDirectory,
      migrationOwners,
      '@markorbit/core-service'
    );
    await migrate(database.getPool(), 'core_auth', migrations);
    await database.getPool().query('TRUNCATE core_workspace_commercial_records');
  });
  afterAll(async () => database.close());

  it('persists append-only offer lineage across repository restart', async () => {
    const first = new PostgresWorkspaceCommercialRepositoryV1(database);
    const base = {
      schemaVersion: 1 as const,
      offerId: 'offer_pg',
      sku: 'LITE_PG',
      displayName: 'Lite',
      subjectScope: 'USER' as const,
      productKey: 'LITE' as const,
      amountMinor: 0,
      currency: 'CNY',
      billingInterval: 'NONE' as const,
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      lifecycle: 'PUBLISHED' as const,
      entitlements: [],
      assignableBenefits: [],
      publishedAt: '2026-01-01T00:00:00.000Z',
      recordedAt: '2026-01-01T00:00:00.000Z'
    };
    await first.appendOffer({ ...base, version: 1 });
    await first.appendOffer({ ...base, version: 2, amountMinor: 9900 });
    const restarted = new PostgresWorkspaceCommercialRepositoryV1(database);
    expect((await restarted.getOffer('offer_pg', 1))?.amountMinor).toBe(0);
    expect((await restarted.getOffer('offer_pg', 2))?.amountMinor).toBe(9900);
    await expect(restarted.appendOffer({ ...base, version: 2 })).rejects.toMatchObject({
      code: 'CONFLICT'
    });
  });
});
