import type { Pool, PoolClient, QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { ManagedDatabase, parseDatabaseConfig, PersistenceError } from '../src/index.js';

const config = () =>
  parseDatabaseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@localhost/test',
    DB_MIGRATION_NAMESPACE: 'test'
  });
const result = { rows: [], rowCount: 0, command: '', oid: 0, fields: [] } satisfies QueryResult;

function fakePool(
  clientQueries: (sql: string) => Promise<QueryResult> = () => Promise.resolve(result)
) {
  const release = vi.fn();
  const clientQuery = vi.fn((sql: string) => clientQueries(sql));
  const client = {
    query: clientQuery,
    release
  } as unknown as PoolClient;
  const query = vi.fn(() => Promise.resolve(result));
  const end = vi.fn(() => Promise.resolve());
  const pool = { query, connect: vi.fn(() => Promise.resolve(client)), end } as unknown as Pool;
  return { pool, clientQuery, query, end, release };
}

describe('managed database lifecycle and transactions', () => {
  it('closes failed readiness and supports close after failed startup', async () => {
    const fake = fakePool();
    fake.query.mockRejectedValueOnce(
      Object.assign(new Error('secret URL suppressed'), { code: 'ECONNREFUSED' })
    );
    const database = new ManagedDatabase(config(), () => fake.pool);
    await expect(database.start()).rejects.toMatchObject({ code: 'DATABASE_UNAVAILABLE' });
    expect(fake.end).toHaveBeenCalledOnce();
    await database.close();
  });
  it('closes idempotently', async () => {
    const fake = fakePool(),
      database = new ManagedDatabase(config(), () => fake.pool);
    await database.start();
    await database.close();
    await database.close();
    expect(fake.end).toHaveBeenCalledOnce();
  });
  it('commits and releases exactly once', async () => {
    const fake = fakePool(),
      database = new ManagedDatabase(config(), () => fake.pool);
    await database.start();
    await expect(database.transact(() => Promise.resolve('value'))).resolves.toBe('value');
    expect(fake.clientQuery).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(fake.clientQuery).toHaveBeenNthCalledWith(2, 'COMMIT');
    expect(fake.release).toHaveBeenCalledOnce();
  });
  it('rolls back, preserves the callback error, and releases exactly once', async () => {
    const fake = fakePool(),
      database = new ManagedDatabase(config(), () => fake.pool);
    await database.start();
    const applicationError = new Error('application');
    await expect(database.transact(() => Promise.reject(applicationError))).rejects.toBe(
      applicationError
    );
    expect(fake.clientQuery).toHaveBeenNthCalledWith(2, 'ROLLBACK');
    expect(fake.release).toHaveBeenCalledOnce();
  });
  it('types commit and rollback failures', async () => {
    const commitFake = fakePool((sql) =>
      sql === 'COMMIT' ? Promise.reject(new Error('commit')) : Promise.resolve(result)
    );
    const commitDb = new ManagedDatabase(config(), () => commitFake.pool);
    await commitDb.start();
    await expect(commitDb.transact(() => Promise.resolve(undefined))).rejects.toMatchObject({
      code: 'TRANSACTION_COMMIT_FAILED'
    });
    const rollbackFake = fakePool((sql) =>
      sql === 'ROLLBACK' ? Promise.reject(new Error('rollback')) : Promise.resolve(result)
    );
    const rollbackDb = new ManagedDatabase(config(), () => rollbackFake.pool);
    await rollbackDb.start();
    await expect(
      rollbackDb.transact(() => Promise.reject(new Error('application')))
    ).rejects.toMatchObject({ code: 'TRANSACTION_ROLLBACK_FAILED' });
  });
  it('normalizes bounded readiness timeout without leaking the raw message', async () => {
    const fake = fakePool();
    fake.query.mockRejectedValueOnce(
      Object.assign(new Error('postgresql://user:secret@host/db'), { code: '57014' })
    );
    const database = new ManagedDatabase(config(), () => fake.pool);
    const error = await database.start().catch((value: unknown) => value);
    expect(error).toBeInstanceOf(PersistenceError);
    expect(error).toMatchObject({
      code: 'DATABASE_TIMEOUT',
      message: 'The database operation timed out.'
    });
  });
});
