import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  loadMigrations,
  ManagedDatabase,
  migrate,
  migrationStatus,
  parseDatabaseConfig,
  PersistenceError,
  verifyMigrations,
  type QueryClient
} from '../src/index.js';
import { repositoryContract, type Probe, type ProbeRepository } from './repository-contract.js';
const url = process.env.PERSISTENCE_TEST_DATABASE_URL;
const required = process.env.PERSISTENCE_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error('PERSISTENCE_TEST_REQUIRED=1 requires PERSISTENCE_TEST_DATABASE_URL.');
const integration = url ? describe : describe.skip;
const config = () =>
  parseDatabaseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DB_MIGRATION_NAMESPACE: 'persistence_probe',
    DB_APPLICATION_NAME: 'markorbit-task-017-tests'
  });
class PostgresProbeRepository implements ProbeRepository {
  constructor(private readonly client: QueryClient) {}
  async create(v: Probe) {
    await this.client.query(
      'INSERT INTO persistence_test_probe(id,scope_id,value,version) VALUES($1,$2,$3,$4)',
      [v.id, v.scopeId, v.value, v.version]
    );
  }
  async find(scopeId: string, id: string) {
    const result = await this.client.query<Probe>(
      'SELECT id,scope_id AS "scopeId",value,version FROM persistence_test_probe WHERE scope_id=$1 AND id=$2',
      [scopeId, id]
    );
    return result.rows[0];
  }
  async update(scopeId: string, id: string, expectedVersion: number, value: string) {
    const result = await this.client.query(
      'UPDATE persistence_test_probe SET value=$1,version=version+1 WHERE scope_id=$2 AND id=$3 AND version=$4',
      [value, scopeId, id, expectedVersion]
    );
    if (result.rowCount !== 1) throw new Error('version conflict');
  }
}
integration('real PostgreSQL 16 foundation', () => {
  let database: ManagedDatabase;
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    await database.getPool().query('DROP TABLE IF EXISTS persistence_test_probe');
    await database.getPool().query('DROP SCHEMA IF EXISTS markorbit_persistence CASCADE');
  });
  afterAll(async () => database.close());
  it('bootstraps, orders, skips, verifies checksums and isolates namespaces', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'mo-pg-migrations-'));
    await writeFile(
      path.join(dir, '0001_probe.sql'),
      'CREATE TABLE persistence_test_probe(id text NOT NULL, scope_id text NOT NULL, value text NOT NULL, version integer NOT NULL, PRIMARY KEY(scope_id,id));'
    );
    const migrations = await loadMigrations(dir);
    expect(
      (await migrationStatus(database.getPool(), 'persistence_probe', migrations))[0]?.state
    ).toBe('pending');
    await migrate(database.getPool(), 'persistence_probe', migrations);
    await migrate(database.getPool(), 'persistence_probe', migrations);
    expect(
      (await migrationStatus(database.getPool(), 'persistence_probe', migrations))[0]?.state
    ).toBe('applied');
    await verifyMigrations(database.getPool(), 'persistence_probe', migrations);
    expect(
      (await migrationStatus(database.getPool(), 'independent_service', migrations))[0]?.state
    ).toBe('pending');
    const altered = [{ ...migrations[0]!, checksum: '0'.repeat(64) }];
    await expect(
      verifyMigrations(database.getPool(), 'persistence_probe', altered)
    ).rejects.toMatchObject({ code: 'MIGRATION_CHECKSUM_MISMATCH' });
    await database.getPool().query('CREATE TABLE checksum_later_counter(value integer)');
    await expect(
      migrate(database.getPool(), 'persistence_probe', [
        altered[0]!,
        {
          version: '0002',
          name: 'must_not_run',
          sql: 'INSERT INTO checksum_later_counter VALUES (1)',
          checksum: 'later'
        }
      ])
    ).rejects.toMatchObject({ code: 'MIGRATION_CHECKSUM_MISMATCH' });
    expect((await database.getPool().query('SELECT 1 FROM checksum_later_counter')).rowCount).toBe(
      0
    );
  });
  it('rolls back a failed migration without false history', async () => {
    const migration = {
      version: '0001',
      name: 'broken',
      sql: 'CREATE TABLE should_rollback(id int); SELECT invalid syntax',
      checksum: 'broken'
    };
    await expect(migrate(database.getPool(), 'failure_probe', [migration])).rejects.toMatchObject({
      code: 'MIGRATION_EXECUTION_FAILED'
    });
    const record = await database
      .getPool()
      .query('SELECT 1 FROM markorbit_persistence.migration_history WHERE namespace=$1', [
        'failure_probe'
      ]);
    expect(record.rowCount).toBe(0);
    const table = await database
      .getPool()
      .query<{ value: string | null }>("SELECT to_regclass('should_rollback') AS value");
    expect(table.rows[0]?.value).toBeNull();
  });
  it('serializes concurrent migration processes', async () => {
    await database
      .getPool()
      .query(
        'DROP TABLE IF EXISTS migration_execution_counter; CREATE TABLE migration_execution_counter(value integer)'
      );
    const m = {
      version: '0001',
      name: 'concurrent',
      sql: 'SELECT pg_sleep(0.05); INSERT INTO migration_execution_counter VALUES (1)',
      checksum: 'same'
    };
    await Promise.all([
      migrate(database.getPool(), 'concurrent_probe', [m]),
      migrate(database.getPool(), 'concurrent_probe', [m])
    ]);
    const rows = await database
      .getPool()
      .query('SELECT 1 FROM markorbit_persistence.migration_history WHERE namespace=$1', [
        'concurrent_probe'
      ]);
    expect(rows.rowCount).toBe(1);
    expect(
      (await database.getPool().query('SELECT 1 FROM migration_execution_counter')).rowCount
    ).toBe(1);
  });
  it('commits, rolls back application errors, and closes idempotently', async () => {
    await database.transact(async (c) => {
      await c.query('INSERT INTO persistence_test_probe VALUES($1,$2,$3,$4)', [
        'committed',
        'scope-a',
        'yes',
        1
      ]);
    });
    await expect(
      database.transact(async (c) => {
        await c.query('INSERT INTO persistence_test_probe VALUES($1,$2,$3,$4)', [
          'rollback',
          'scope-a',
          'no',
          1
        ]);
        throw new Error('application');
      })
    ).rejects.toThrow('application');
    expect(
      (await database.getPool().query("SELECT 1 FROM persistence_test_probe WHERE id='rollback'"))
        .rowCount
    ).toBe(0);
  });
  it('persists through reconnect', async () => {
    await database
      .getPool()
      .query('INSERT INTO persistence_test_probe VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING', [
        'durable',
        'scope-a',
        'yes',
        1
      ]);
    await database.close();
    database = new ManagedDatabase(config());
    await database.start();
    expect(
      (await database.getPool().query("SELECT 1 FROM persistence_test_probe WHERE id='durable'"))
        .rowCount
    ).toBe(1);
  });
  it(
    'runs the shared repository contract against PostgreSQL',
    repositoryContract(async () => {
      await database.getPool().query('TRUNCATE persistence_test_probe');
      const repository = new PostgresProbeRepository(database.getPool());
      return {
        repository,
        rollback: async (work) => {
          try {
            await database.transact(async (client) => {
              await work(new PostgresProbeRepository(client));
              throw new Error('rollback sentinel');
            });
          } catch (error) {
            if (!(error instanceof Error) || error.message !== 'rollback sentinel') throw error;
          }
        },
        commit: (work) => database.transact((client) => work(new PostgresProbeRepository(client))),
        reopen: async () => {
          await database.close();
          database = new ManagedDatabase(config());
          await database.start();
          return new PostgresProbeRepository(database.getPool());
        },
        cleanup: async () => {
          await database.getPool().query('TRUNCATE persistence_test_probe');
        },
        close: () => Promise.resolve()
      };
    })
  );
});
describe('unavailable database behavior', () => {
  it('cleans up failed startup and permits idempotent close', async () => {
    const db = new ManagedDatabase(
      parseDatabaseConfig({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/unavailable',
        DB_MIGRATION_NAMESPACE: 'unavailable',
        DB_CONNECTION_TIMEOUT_MS: '100'
      })
    );
    await expect(db.start()).rejects.toBeInstanceOf(PersistenceError);
    await db.close();
    await db.close();
  });
});
