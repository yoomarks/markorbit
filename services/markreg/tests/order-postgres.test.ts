import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  migrationStatus,
  verifyMigrations
} from '@markorbit/persistence';
import { PostgresOrderRepository } from '../src/order-persistence.js';
import {
  ORDER_WORKSPACE_ID,
  createFingerprint,
  orderAudit,
  orderFixture,
  runOrderRepositoryContract
} from './order-repository-contract.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from './support/markreg-test-database.js';

const url = process.env.MARKREG_TEST_DATABASE_URL;
const required = process.env.MARKREG_ORDER_POSTGRES_REQUIRED === '1';
if (required && !url)
  throw new Error('MARKREG_TEST_DATABASE_URL is required when MARKREG_ORDER_POSTGRES_REQUIRED=1.');
const suite = url ? describe : describe.skip;
const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const at = '2026-08-08T05:30:00.000Z';

suite.sequential('PostgreSQL durable Order repository', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'markreg-order-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: MARKREG_TEST_MIGRATION_NAMESPACE
  });
  const migrations = () =>
    loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/markreg-service');
  const truncate = () =>
    database.getPool().query('TRUNCATE order_audit,order_commands,orders RESTART IDENTITY CASCADE');

  beforeAll(async () => {
    await database.start();
    await resetAndMigrateMarkRegTestDatabase({
      pool: database.getPool(),
      migrationsDirectory,
      migrationOwners
    });
  });
  beforeEach(truncate);
  afterAll(() => database.close());

  it('applies owner migration 0026 after the complete Milestone 2 MarkReg schema', async () => {
    const owned = await migrations();
    expect(owned.map((migration) => migration.version)).toEqual([
      '0020',
      '0021',
      '0022',
      '0024',
      '0025',
      '0026'
    ]);
    expect(
      (await migrationStatus(database.getPool(), MARKREG_TEST_MIGRATION_NAMESPACE, owned)).every(
        (record) => record.state === 'applied'
      )
    ).toBe(true);
    await verifyMigrations(database.getPool(), MARKREG_TEST_MIGRATION_NAMESPACE, owned);
    const relations = await database
      .getPool()
      .query(
        "SELECT to_regclass('orders') AS orders,to_regclass('order_commands') AS commands,to_regclass('order_audit') AS audit"
      );
    expect(relations.rows[0]).toEqual({
      orders: 'orders',
      commands: 'order_commands',
      audit: 'order_audit'
    });
  });

  it('upgrades the prior Milestone 2 MarkReg schema without rewriting committed evidence', async () => {
    const owned = await migrations();
    await database
      .getPool()
      .query('DROP TABLE IF EXISTS order_audit,order_commands,orders CASCADE');
    await database
      .getPool()
      .query(
        'DELETE FROM markorbit_persistence.migration_history WHERE namespace=$1 AND version=$2',
        [MARKREG_TEST_MIGRATION_NAMESPACE, '0026']
      );
    await database.getPool().query(
      `INSERT INTO customer_confirmations(
        confirmation_id,workspace_id,source_quote_id,source_quote_version,status,version,
        snapshot_schema_version,source_snapshot,source_snapshot_hash,accepted_at,updated_at,withdrawn_at
      ) VALUES('confirmation_m3-upgrade',$1,'quote_m3-upgrade','quote-v1','CONFIRMED',1,1,'{}',$2,$3,$3,NULL)`,
      [ORDER_WORKSPACE_ID, 'a'.repeat(64), at]
    );
    const before = (
      await database
        .getPool()
        .query(
          "SELECT confirmation_id,source_quote_id,source_quote_version,status,version,source_snapshot_hash FROM customer_confirmations WHERE confirmation_id='confirmation_m3-upgrade'"
        )
    ).rows[0] as Record<string, unknown>;
    await migrate(database.getPool(), MARKREG_TEST_MIGRATION_NAMESPACE, owned);
    expect(
      (
        await database
          .getPool()
          .query(
            "SELECT confirmation_id,source_quote_id,source_quote_version,status,version,source_snapshot_hash FROM customer_confirmations WHERE confirmation_id='confirmation_m3-upgrade'"
          )
      ).rows[0]
    ).toEqual(before);
    const relation = (
      await database.getPool().query("SELECT to_regclass('orders') AS relation")
    ).rows[0] as { relation: string | null };
    expect(relation.relation).toBe('orders');
  });

  runOrderRepositoryContract(
    'PostgreSQL Order repository contract',
    () => new PostgresOrderRepository(database, database.getPool())
  );

  it('rolls back Order, command and audit together when durable audit insertion fails', async () => {
    const repository = new PostgresOrderRepository(database, database.getPool());
    const value = orderFixture('rollback');
    const key = 'rollback-create';
    await expect(
      repository.createAtomically(value, key, createFingerprint(value, key), {
        ...orderAudit(value, 'ORDER_CREATED'),
        actorId: null as never
      })
    ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' });
    const counts = await database
      .getPool()
      .query(
        'SELECT (SELECT count(*) FROM orders) orders,(SELECT count(*) FROM order_commands) commands,(SELECT count(*) FROM order_audit) audits'
      );
    expect(counts.rows[0]).toMatchObject({ orders: '0', commands: '0', audits: '0' });
  });

  it('protects Order audit evidence as append-only', async () => {
    const repository = new PostgresOrderRepository(database, database.getPool());
    const value = orderFixture('append-only');
    const key = 'append-only-create';
    await repository.createAtomically(
      value,
      key,
      createFingerprint(value, key),
      orderAudit(value, 'ORDER_CREATED')
    );
    await expect(
      database
        .getPool()
        .query('DELETE FROM order_audit WHERE workspace_id=$1 AND order_id=$2', [
          ORDER_WORKSPACE_ID,
          value.orderId
        ])
    ).rejects.toMatchObject({ code: '55000' });
    expect(await repository.listAudit(ORDER_WORKSPACE_ID, value.orderId)).toHaveLength(1);
  });

  it('reloads the exact Order and command result through a fresh pool after reconnect', async () => {
    const repository = new PostgresOrderRepository(database, database.getPool());
    const value = orderFixture('reconnect');
    const key = 'reconnect-create';
    const fingerprint = createFingerprint(value, key);
    const created = await repository.createAtomically(
      value,
      key,
      fingerprint,
      orderAudit(value, 'ORDER_CREATED')
    );
    const fresh = new ManagedDatabase({
      connection: { url: url! },
      applicationName: 'markreg-order-reconnect',
      poolMaximum: 2,
      connectionTimeoutMs: 2000,
      idleTimeoutMs: 2000,
      statementTimeoutMs: 5000,
      sslMode: 'disable',
      migrationNamespace: MARKREG_TEST_MIGRATION_NAMESPACE
    });
    await fresh.start();
    try {
      const reconnect = new PostgresOrderRepository(fresh, fresh.getPool());
      expect(await reconnect.findById(ORDER_WORKSPACE_ID, created.orderId)).toEqual(created);
      expect(await reconnect.findByIdempotencyKey(ORDER_WORKSPACE_ID, key)).toEqual({
        fingerprint,
        commandType: 'CREATE',
        order: created
      });
    } finally {
      await fresh.close();
    }
  });

  it('maps unavailable reads to the canonical persistence error', async () => {
    const repository = new PostgresOrderRepository(database, {
      query: () => Promise.reject(new Error('database unavailable'))
    } as never);
    await expect(repository.findById(ORDER_WORKSPACE_ID, 'order_missing')).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE'
    });
    await expect(
      repository.list(ORDER_WORKSPACE_ID, { page: 1, pageSize: 20 })
    ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' });
  });
});