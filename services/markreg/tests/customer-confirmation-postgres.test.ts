import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase } from '@markorbit/persistence';
import {
  loadMigrationsForOwner,
  migrate,
  migrationStatus,
  verifyMigrations
} from '@markorbit/persistence';
import path from 'node:path';
import {
  CustomerConfirmationError,
  PostgresCustomerConfirmationRepository
} from '../src/customer-confirmation.js';
import {
  contractRecord,
  contractWorkspace,
  runCustomerConfirmationRepositoryContract
} from './customer-confirmation-repository-contract.js';
const url = process.env.MARKREG_TEST_DATABASE_URL,
  required = process.env.MARKREG_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error('MARKREG_TEST_DATABASE_URL is required when MARKREG_POSTGRES_TEST_REQUIRED=1.');
const suite = url ? describe : describe.skip;
suite('PostgreSQL Customer Confirmation persistence', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'markreg-confirmation-test',
    poolMaximum: 6,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'markreg_customer_confirmation_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  const markregMigrations = () =>
    loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/markreg-service');
  beforeAll(async () => {
    await database.start();
    await database
      .getPool()
      .query(
        'DROP TABLE IF EXISTS customer_confirmations CASCADE; DROP SCHEMA IF EXISTS markorbit_persistence CASCADE'
      );
    await migrate(
      database.getPool(),
      'markreg_customer_confirmation_test',
      await markregMigrations()
    );
  });
  beforeEach(() => database.getPool().query('TRUNCATE customer_confirmations'));
  afterAll(() => database.close());
  runCustomerConfirmationRepositoryContract('PostgreSQL', async () => {
    await database.getPool().query('TRUNCATE customer_confirmations');
    return new PostgresCustomerConfirmationRepository(database.getPool());
  });
  it('loads, reports and verifies only the MarkReg-owned migration', async () => {
    const migrations = await markregMigrations();
    expect(migrations.map((x) => x.version)).toEqual(['0020']);
    expect(
      (
        await migrationStatus(database.getPool(), 'markreg_customer_confirmation_test', migrations)
      ).every((x) => x.state === 'applied')
    ).toBe(true);
    await verifyMigrations(database.getPool(), 'markreg_customer_confirmation_test', migrations);
  });
  it('allows exactly one of two concurrent duplicate creates', async () => {
    const r = new PostgresCustomerConfirmationRepository(database.getPool()),
      v = contractRecord('concurrent-create');
    const results = await Promise.allSettled([
      r.create(v),
      r.create({ ...v, confirmationId: 'confirmation_concurrent-create-2' })
    ]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((x) => x.status === 'rejected');
    expect(rejected).toBeDefined();
    if (!rejected || rejected.status !== 'rejected')
      throw new Error('Expected rejected duplicate.');
    expect(rejected.reason as unknown).toMatchObject({ code: 'CUSTOMER_CONFIRMATION_DUPLICATE' });
  });
  it('allows exactly one expected-version withdrawal winner', async () => {
    const r = new PostgresCustomerConfirmationRepository(database.getPool()),
      v = await r.create(contractRecord('concurrent-withdraw'));
    const results = await Promise.allSettled([
      r.withdraw(contractWorkspace, v.confirmationId, 1, '2026-07-31T13:00:00.000Z'),
      r.withdraw(contractWorkspace, v.confirmationId, 1, '2026-07-31T13:00:01.000Z')
    ]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((x) => x.status === 'rejected')).toHaveLength(1);
    expect((await r.findById(contractWorkspace, v.confirmationId))!.version).toBe(2);
  });
  it('maps unavailable database without leaking driver details', async () => {
    const broken = new ManagedDatabase({
      connection: { url: 'postgresql://127.0.0.1:1/unavailable' },
      applicationName: 'unavailable',
      poolMaximum: 1,
      connectionTimeoutMs: 50,
      idleTimeoutMs: 50,
      statementTimeoutMs: 50,
      sslMode: 'disable',
      migrationNamespace: 'markreg_test'
    });
    const r = new PostgresCustomerConfirmationRepository({
      query: (...args: Parameters<ReturnType<typeof database.getPool>['query']>) =>
        broken.getPool().query(...args)
    } as never);
    await expect(r.findById(contractWorkspace, 'confirmation_missing')).rejects.toBeInstanceOf(
      CustomerConfirmationError
    );
  });
});
