import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import {
  GovernedHumanActionReceiptError,
  PostgresGovernedHumanActionReceiptStore,
  type GovernedHumanActionReceiptMaterializationV1
} from '../src/governed-human-action-receipt.js';

const url = process.env.AUTH_TEST_DATABASE_URL;
const required = process.env.AUTH_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error('AUTH_POSTGRES_TEST_REQUIRED=1 requires AUTH_TEST_DATABASE_URL.');
const integration = url ? describe : describe.skip;
let database: ManagedDatabase;
const config = () =>
  parseDatabaseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DB_MIGRATION_NAMESPACE: 'core_governed_human_action_receipt_test',
    DB_APPLICATION_NAME: 'markorbit-governed-human-action-receipt-tests'
  });
const migrations = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');

function input(
  kind: GovernedHumanActionReceiptMaterializationV1['kind'] = 'PROVIDER_SELECTION',
  requestFingerprintSha256 = 'b'.repeat(64)
): GovernedHumanActionReceiptMaterializationV1 {
  return {
    schemaVersion: 1,
    kind,
    workspaceId: '11111111-1111-4111-8111-111111111111',
    userId: 'user_governed',
    membershipId: 'membership-governed',
    principalReference: `core-workspace-principal:${'a'.repeat(64)}`,
    authorityReference: `gateway-governed-action:${kind.toLowerCase()}:${'c'.repeat(64)}`,
    idempotencyKeySha256: 'd'.repeat(64),
    requestFingerprintSha256,
    authenticatedAt: '2026-09-05T08:00:00.000Z'
  };
}

integration('PostgreSQL governed human-action receipts', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    await database
      .getPool()
      .query(
        'DROP TABLE IF EXISTS governed_human_action_receipts CASCADE; DROP SCHEMA IF EXISTS markorbit_persistence CASCADE'
      );
    const coreMigrations = await loadMigrationsForOwner(
      migrations,
      migrationOwners,
      '@markorbit/core-service'
    );
    const receiptMigration = coreMigrations.filter((migration) => migration.version === '0095');
    expect(receiptMigration).toHaveLength(1);
    await migrate(database.getPool(), 'core_governed_human_action_receipt_test', receiptMigration);
  });

  afterAll(async () => database.close());

  it('materializes one stable receipt for an exact replay and resolves it after reopen', async () => {
    let store = new PostgresGovernedHumanActionReceiptStore(database);
    const first = await store.materialize(input());
    const replay = await store.materialize(input());
    expect(replay.receiptId).toBe(first.receiptId);
    expect(replay.receiptReference).toBe(first.receiptReference);
    expect(first.receiptReference).toBe(`core-governed-human-action-receipt:${first.receiptId}`);

    await database.close();
    database = new ManagedDatabase(config());
    await database.start();
    store = new PostgresGovernedHumanActionReceiptStore(database);
    await expect(store.get(first.receiptId)).resolves.toEqual(first);
  });

  it('fails closed when the same replay identity carries different action evidence', async () => {
    const store = new PostgresGovernedHumanActionReceiptStore(database);
    await store.materialize(input('PROVIDER_SELECTION', 'e'.repeat(64)));
    await expect(
      store.materialize(input('PROVIDER_SELECTION', 'f'.repeat(64)))
    ).rejects.toMatchObject<Partial<GovernedHumanActionReceiptError>>({ code: 'CONFLICT' });
  });

  it('keeps Selection and Controlled Handoff receipt domains distinct', async () => {
    const store = new PostgresGovernedHumanActionReceiptStore(database);
    const selection = await store.materialize(input('PROVIDER_SELECTION', '1'.repeat(64)));
    const handoff = await store.materialize(input('CONTROLLED_HANDOFF', '2'.repeat(64)));
    expect(selection.receiptId).not.toBe(handoff.receiptId);
    expect(selection.receiptReference).not.toBe(handoff.receiptReference);
  });
});
