import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase } from '@markorbit/persistence';
import {
  loadMigrationsForOwner,
  migrate,
  migrationStatus,
  verifyMigrations
} from '@markorbit/persistence';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import {
  CustomerConfirmationError,
  PostgresCustomerConfirmationRepository
} from '../src/customer-confirmation.js';
import {
  contractRecord,
  contractWorkspace,
  runCustomerConfirmationRepositoryContract
} from './customer-confirmation-repository-contract.js';
import { PostgresMatterDraftRepository } from '../src/matter-draft.js';
import {
  matterDraftContractRecord,
  runMatterDraftRepositoryContract
} from './matter-draft-repository-contract.js';
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
  const declaredMarkRegVersions = async () => {
    const registry = JSON.parse(await readFile(migrationOwners, 'utf8')) as {
      migrations: Readonly<Record<string, string>>;
    };
    return Object.entries(registry.migrations)
      .filter(([, owner]) => owner === '@markorbit/markreg-service')
      .map(([name]) => name.split('_', 1)[0]!)
      .sort((a, b) => a.localeCompare(b));
  };
  const resetMarkRegTestState = async () => {
    const pool = database.getPool();
    await pool.query('DROP TABLE IF EXISTS formal_matter_audit CASCADE');
    await pool.query('DROP TABLE IF EXISTS formal_matter_commands CASCADE');
    await pool.query('DROP TABLE IF EXISTS formal_matters CASCADE');
    await pool.query('DROP TABLE IF EXISTS matter_drafts CASCADE');
    await pool.query('DROP TABLE IF EXISTS customer_confirmations CASCADE');
    const history = await pool.query<{ migration_history: string | null }>(
      "SELECT to_regclass('markorbit_persistence.migration_history')::text AS migration_history"
    );
    if (history.rows[0]?.migration_history)
      await pool.query('DELETE FROM markorbit_persistence.migration_history WHERE namespace = $1', [
        'markreg_customer_confirmation_test'
      ]);
  };
  beforeAll(async () => {
    await database.start();
    await resetMarkRegTestState();
    await migrate(
      database.getPool(),
      'markreg_customer_confirmation_test',
      await markregMigrations()
    );
  });
  beforeEach(() => database.getPool().query('TRUNCATE matter_drafts, customer_confirmations'));
  afterAll(() => database.close());
  runCustomerConfirmationRepositoryContract('PostgreSQL', async () => {
    await database.getPool().query('TRUNCATE matter_drafts, customer_confirmations');
    return new PostgresCustomerConfirmationRepository(database.getPool());
  });
  it('loads, reports and verifies every migration declared as MarkReg-owned', async () => {
    const migrations = await markregMigrations();
    const loadedVersions = migrations.map((x) => x.version);
    const expectedVersions = await declaredMarkRegVersions();
    expect(loadedVersions).toEqual(expectedVersions);
    expect(loadedVersions).toEqual([...loadedVersions].sort((a, b) => a.localeCompare(b)));
    expect(loadedVersions).toEqual(expect.arrayContaining(['0020', '0021', '0022']));
    const registry = JSON.parse(await readFile(migrationOwners, 'utf8')) as {
      migrations: Readonly<Record<string, string>>;
    };
    const nonMarkRegVersions = Object.entries(registry.migrations)
      .filter(([, owner]) => owner !== '@markorbit/markreg-service')
      .map(([name]) => name.split('_', 1)[0]!);
    expect(loadedVersions.filter((version) => nonMarkRegVersions.includes(version))).toEqual([]);
    expect(
      (
        await migrationStatus(database.getPool(), 'markreg_customer_confirmation_test', migrations)
      ).every((x) => x.state === 'applied')
    ).toBe(true);
    await verifyMigrations(database.getPool(), 'markreg_customer_confirmation_test', migrations);
  });
  runMatterDraftRepositoryContract('PostgreSQL', async () => {
    await database.getPool().query('TRUNCATE matter_drafts, customer_confirmations');
    await new PostgresCustomerConfirmationRepository(database.getPool()).create(
      contractRecord('contract')
    );
    return new PostgresMatterDraftRepository(database.getPool());
  });
  it('allows exactly one concurrent expected-version Matter Draft update winner', async () => {
    const confirmations = new PostgresCustomerConfirmationRepository(database.getPool());
    await confirmations.create(contractRecord('contract'));
    const repository = new PostgresMatterDraftRepository(database.getPool());
    const value = await repository.create(matterDraftContractRecord());
    const results = await Promise.allSettled([
      repository.update(contractWorkspace, value.matterDraftId, 1, {
        ...value,
        preparation: { ...value.preparation, applicantName: 'Winner A' }
      }),
      repository.update(contractWorkspace, value.matterDraftId, 1, {
        ...value,
        preparation: { ...value.preparation, applicantName: 'Winner B' }
      })
    ]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((x) => x.status === 'rejected')).toHaveLength(1);
    expect((await repository.findById(contractWorkspace, value.matterDraftId))?.version).toBe(2);
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
