import { Pool, type PoolClient, type PoolConfig } from 'pg';
import type { DatabaseConfig } from './config.js';
import { normalizeDatabaseError, PersistenceError } from './errors.js';

export type TransactionIsolation = 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
export interface TransactionOptions {
  isolation?: TransactionIsolation;
  readOnly?: boolean;
  deferrable?: boolean;
}
export interface QueryClient {
  query: PoolClient['query'];
}
export type PoolFactory = (config: PoolConfig) => Pool;

export class ManagedDatabase {
  private pool: Pool | undefined;
  private closePromise: Promise<void> | undefined;
  constructor(
    private readonly config: DatabaseConfig,
    private readonly poolFactory: PoolFactory = (poolConfig) => new Pool(poolConfig)
  ) {}

  async start(): Promise<void> {
    if (this.pool) return;
    const connection: PoolConfig =
      'url' in this.config.connection
        ? { connectionString: this.config.connection.url }
        : this.config.connection;
    const pool = this.poolFactory({
      ...connection,
      max: this.config.poolMaximum,
      connectionTimeoutMillis: this.config.connectionTimeoutMs,
      idleTimeoutMillis: this.config.idleTimeoutMs,
      statement_timeout: this.config.statementTimeoutMs,
      query_timeout: this.config.statementTimeoutMs,
      application_name: this.config.applicationName,
      ssl: this.config.sslMode === 'require' ? { rejectUnauthorized: true } : false
    });
    this.pool = pool;
    try {
      await this.verifyReadiness();
    } catch (error) {
      await pool.end().catch(() => undefined);
      this.pool = undefined;
      throw normalizeDatabaseError(error);
    }
  }
  async verifyReadiness(): Promise<void> {
    if (!this.pool)
      throw new PersistenceError('DATABASE_UNAVAILABLE', 'The database has not been started.');
    try {
      await this.pool.query('SELECT 1');
    } catch (error) {
      throw normalizeDatabaseError(error);
    }
  }
  getPool(): Pool {
    if (!this.pool)
      throw new PersistenceError('DATABASE_UNAVAILABLE', 'The database has not been started.');
    return this.pool;
  }
  async transact<T>(
    callback: (client: QueryClient) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    const client = await this.getPool()
      .connect()
      .catch((error: unknown) => {
        throw normalizeDatabaseError(error);
      });
    let begun = false;
    try {
      const clauses = [
        options.isolation && `ISOLATION LEVEL ${options.isolation}`,
        options.readOnly && 'READ ONLY',
        options.deferrable && 'DEFERRABLE'
      ]
        .filter(Boolean)
        .join(' ');
      try {
        await client.query(`BEGIN${clauses ? ` ${clauses}` : ''}`);
        begun = true;
      } catch (cause) {
        throw new PersistenceError('TRANSACTION_BEGIN_FAILED', 'Could not begin transaction.', {
          cause
        });
      }
      const result = await callback(client);
      try {
        await client.query('COMMIT');
      } catch (cause) {
        throw new PersistenceError('TRANSACTION_COMMIT_FAILED', 'Could not commit transaction.', {
          cause
        });
      }
      return result;
    } catch (original) {
      if (begun) {
        try {
          await client.query('ROLLBACK');
        } catch (cause) {
          throw new PersistenceError(
            'TRANSACTION_ROLLBACK_FAILED',
            'Transaction failed and rollback also failed.',
            { cause: new AggregateError([original, cause]) }
          );
        }
      }
      throw original;
    } finally {
      client.release();
    }
  }
  close(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    const pool = this.pool;
    this.pool = undefined;
    this.closePromise = pool ? pool.end() : Promise.resolve();
    return this.closePromise;
  }
}
