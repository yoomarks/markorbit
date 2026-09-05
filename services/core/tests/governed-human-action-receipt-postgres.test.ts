import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import { PostgresGovernedHumanActionReceiptStore } from '../src/governed-human-action-receipt-postgres.js';
import type { GovernedHumanActionReceipt } from '../src/governed-human-action-receipt.js';

const url = process.env.AUTH_TEST_DATABASE_URL;
const required = process.env.AUTH_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error('AUTH_POSTGRES_TEST_REQUIRED=1 requires AUTH_TEST_DATABASE_URL.');
const integration = url ? describe : describe.skip;
let database: ManagedDatabase;
const migrations = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const config = () =>
  parseDatabaseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DB_MIGRATION_NAMESPACE: 'core_governed_human_action_receipts',
    DB_APPLICATION_NAME: 'markorbit-core-governed-human-action-receipt-tests'
  });
const coreMigrations = () =>
  loadMigrationsForOwner(migrations, migrationOwners, '@markorbit/core-service');

const ids = {
  workspace: '018f0000-0000-7000-8000-000000000101',
  user: '018f0000-0000-7000-8000-000000000102',
  membership: '018f0000-0000-7000-8000-000000000103',
  receipt: '018f0000-0000-7000-8000-000000000104'
};

const receipt = (
  overrides: Partial<GovernedHumanActionReceipt> = {}
): GovernedHumanActionReceipt => ({
  schemaVersion: 1,
  receiptId: ids.receipt,
  receiptVersion: 1,
  authorityReference: `core-governed-human-action-receipt:${ids.receipt}`,
  authorityVersion: 1,
  affirmativeHumanActionEvidenceReference: `core-governed-human-action-evidence:${ids.receipt}`,
  source: 'CORE',
  actorKind: 'HUMAN_USER',
  workspaceId: ids.workspace,
  userId: ids.user,
  membershipId: ids.membership,
  principalReference: 'core-workspace-principal:durable-lineage',
  kind: 'PROVIDER_SELECTION',
  mutationRoute: '/api/mgsn/governed-network/selections',
  reviewedActionDigest: 'a'.repeat(64),
  idempotencyKey: 'durable-selection-1',
  authenticatedAt: '2026-09-05T09:00:00.000Z',
  workspaceVersion: 4,
  userVersion: 2,
  membershipVersion: 3,
  createdAt: '2026-09-05T09:01:00.000Z',
  ...overrides
});

async function cleanup() {
  await database.getPool().query('TRUNCATE core_governed_human_action_receipts');
}

integration('PostgreSQL governed human-action receipt authority', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    await database
      .getPool()
      .query(
        'DROP TABLE IF EXISTS core_governed_human_action_receipts,knowledge_v2_deliveries,knowledge_intake_contents,knowledge_intakes,password_credentials,account_profiles,sessions,workspace_memberships,workspaces,users CASCADE; DROP SCHEMA IF EXISTS markorbit_persistence CASCADE'
      );
    await migrate(database.getPool(), 'core_governed_human_action_receipts', await coreMigrations());
  });

  afterAll(async () => database.close());

  it('persists an immutable receipt across reconnect and resolves the same exact receipt', async () => {
    await cleanup();
    const firstStore = new PostgresGovernedHumanActionReceiptStore(database);
    const created = await firstStore.materializeOrResolve(receipt());

    await database.close();
    database = new ManagedDatabase(config());
    await database.start();

    const restartedStore = new PostgresGovernedHumanActionReceiptStore(database);
    await expect(restartedStore.findById(created.receiptId)).resolves.toEqual(created);
    await expect(restartedStore.materializeOrResolve(receipt())).resolves.toEqual(created);
  });

  it('binds one Workspace idempotency key to one exact reviewed human action', async () => {
    await cleanup();
    const store = new PostgresGovernedHumanActionReceiptStore(database);
    await store.materializeOrResolve(receipt());

    await expect(
      store.materializeOrResolve(
        receipt({
          receiptId: '018f0000-0000-7000-8000-000000000105',
          authorityReference:
            'core-governed-human-action-receipt:018f0000-0000-7000-8000-000000000105',
          affirmativeHumanActionEvidenceReference:
            'core-governed-human-action-evidence:018f0000-0000-7000-8000-000000000105',
          reviewedActionDigest: 'b'.repeat(64)
        })
      )
    ).rejects.toMatchObject({
      code: 'GOVERNED_HUMAN_ACTION_REPLAY_CONFLICT',
      status: 409
    });
  });

  it('does not persist raw action payload or private handoff fields', async () => {
    await cleanup();
    const store = new PostgresGovernedHumanActionReceiptStore(database);
    await store.materializeOrResolve(receipt());
    const columns = await database.getPool().query<{ column_name: string }>(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema='public' AND table_name='core_governed_human_action_receipts'
        ORDER BY column_name`
    );
    const names = columns.rows.map((row) => row.column_name);
    expect(names).toContain('reviewed_action_digest');
    expect(names).not.toContain('payload');
    expect(names).not.toContain('contact');
    expect(names).not.toContain('handoff_fields');
  });
});
