import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { Pool, PoolClient } from 'pg';
import { PersistenceError } from './errors.js';

export interface Migration {
  version: string;
  name: string;
  sql: string;
  checksum: string;
}
export interface MigrationRecord extends Omit<Migration, 'sql'> {
  namespace: string;
  appliedAt?: Date;
  durationMs?: number;
  state: 'pending' | 'applied';
}
const filePattern = /^(\d{4,})_([a-z][a-z0-9_-]*)\.sql$/u;
export async function loadMigrations(directory: string): Promise<Migration[]> {
  const migrations = await Promise.all(
    (await readdir(directory))
      .filter((f) => f.endsWith('.sql'))
      .map(async (file) => {
        const match = filePattern.exec(file);
        if (!match)
          throw new PersistenceError(
            'MIGRATION_EXECUTION_FAILED',
            `Invalid migration filename: ${file}`
          );
        const bytes = await readFile(path.join(directory, file));
        let sql: string;
        try {
          sql = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch (cause) {
          throw new PersistenceError(
            'MIGRATION_EXECUTION_FAILED',
            `Migration ${file} must contain valid UTF-8.`,
            { cause }
          );
        }
        return {
          version: match[1]!,
          name: match[2]!,
          sql,
          checksum: createHash('sha256').update(bytes).digest('hex')
        };
      })
  );
  migrations.sort((a, b) => a.version.localeCompare(b.version));
  const versions = new Set<string>(),
    names = new Set<string>();
  for (const migration of migrations) {
    if (versions.has(migration.version) || names.has(migration.name))
      throw new PersistenceError(
        'MIGRATION_EXECUTION_FAILED',
        'Duplicate migration version or name.'
      );
    versions.add(migration.version);
    names.add(migration.name);
  }
  return migrations;
}
interface MigrationOwnershipRegistry {
  namespaces: Readonly<Record<string, string>>;
  migrations: Readonly<Record<string, string>>;
}
export async function loadMigrationsForOwner(
  directory: string,
  ownershipFile: string,
  owner: string
): Promise<Migration[]> {
  let registry: MigrationOwnershipRegistry;
  try {
    registry = JSON.parse(await readFile(ownershipFile, 'utf8')) as MigrationOwnershipRegistry;
  } catch (cause) {
    throw new PersistenceError(
      'MIGRATION_EXECUTION_FAILED',
      'Migration ownership registry is invalid.',
      { cause }
    );
  }
  if (
    !registry ||
    typeof registry !== 'object' ||
    !registry.migrations ||
    typeof registry.migrations !== 'object'
  )
    throw new PersistenceError(
      'MIGRATION_EXECUTION_FAILED',
      'Migration ownership registry is invalid.'
    );
  const migrations = await loadMigrations(directory);
  for (const migration of migrations) {
    const key = `${migration.version}_${migration.name}`;
    if (typeof registry.migrations[key] !== 'string' || registry.migrations[key].length === 0)
      throw new PersistenceError(
        'MIGRATION_EXECUTION_FAILED',
        `Migration ${key} has no declared owner.`
      );
  }
  return migrations.filter(
    (migration) => registry.migrations[`${migration.version}_${migration.name}`] === owner
  );
}
const setup = async (client: PoolClient) =>
  client.query(`CREATE SCHEMA IF NOT EXISTS markorbit_persistence;
CREATE TABLE IF NOT EXISTS markorbit_persistence.migration_history (
 namespace text NOT NULL, version text NOT NULL, name text NOT NULL, checksum text NOT NULL,
 applied_at timestamptz NOT NULL DEFAULT clock_timestamp(), duration_ms integer NOT NULL,
 PRIMARY KEY(namespace, version), UNIQUE(namespace, name));`);
const bootstrap = async (client: PoolClient): Promise<void> => {
  await client.query('BEGIN');
  try {
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('markorbit:migration-history-bootstrap', 0))"
    );
    await setup(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
};
async function statusWithClient(
  client: PoolClient,
  namespace: string,
  migrations: Migration[]
): Promise<MigrationRecord[]> {
  const result = await client.query<{
    version: string;
    name: string;
    checksum: string;
    applied_at: Date;
    duration_ms: number;
  }>(
    'SELECT version,name,checksum,applied_at,duration_ms FROM markorbit_persistence.migration_history WHERE namespace=$1',
    [namespace]
  );
  const applied = new Map(result.rows.map((r) => [r.version, r]));
  return migrations.map((m) => {
    const row = applied.get(m.version);
    return row
      ? {
          namespace,
          version: m.version,
          name: m.name,
          checksum: m.checksum,
          appliedAt: row.applied_at,
          durationMs: row.duration_ms,
          state: 'applied'
        }
      : { namespace, version: m.version, name: m.name, checksum: m.checksum, state: 'pending' };
  });
}
export async function migrationStatus(
  pool: Pool,
  namespace: string,
  migrations: Migration[]
): Promise<MigrationRecord[]> {
  const client = await pool.connect();
  try {
    await bootstrap(client);
    return await statusWithClient(client, namespace, migrations);
  } finally {
    client.release();
  }
}
async function verifyWithClient(
  client: PoolClient,
  namespace: string,
  migrations: Migration[]
): Promise<void> {
  const rows = await client.query<{ version: string; name: string; checksum: string }>(
    'SELECT version,name,checksum FROM markorbit_persistence.migration_history WHERE namespace=$1',
    [namespace]
  );
  const files = new Map(migrations.map((m) => [m.version, m]));
  for (const row of rows.rows) {
    const file = files.get(row.version);
    if (!file || file.name !== row.name || file.checksum !== row.checksum)
      throw new PersistenceError(
        'MIGRATION_CHECKSUM_MISMATCH',
        `Applied migration ${row.version} does not match its immutable file.`
      );
  }
}
export async function verifyMigrations(
  pool: Pool,
  namespace: string,
  migrations: Migration[]
): Promise<void> {
  const client = await pool.connect();
  try {
    await bootstrap(client);
    await verifyWithClient(client, namespace, migrations);
  } finally {
    client.release();
  }
}
export async function migrate(
  pool: Pool,
  namespace: string,
  migrations: Migration[]
): Promise<MigrationRecord[]> {
  const client = await pool.connect();
  try {
    try {
      await client.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [
        `markorbit:migrate:${namespace}`
      ]);
    } catch (cause) {
      throw new PersistenceError(
        'MIGRATION_LOCK_UNAVAILABLE',
        `Could not acquire the migration lock for namespace ${namespace}.`,
        { cause }
      );
    }
    try {
      // Infrastructure bootstrap and every history read deliberately use the
      // physical session that owns the advisory lock.
      await bootstrap(client);
      await verifyWithClient(client, namespace, migrations);
      for (const migration of migrations) {
        const exists = await client.query(
          'SELECT 1 FROM markorbit_persistence.migration_history WHERE namespace=$1 AND version=$2',
          [namespace, migration.version]
        );
        if (exists.rowCount) continue;
        const started = Date.now();
        try {
          await client.query('BEGIN');
          await client.query(migration.sql);
          await client.query(
            'INSERT INTO markorbit_persistence.migration_history(namespace,version,name,checksum,duration_ms) VALUES($1,$2,$3,$4,$5)',
            [namespace, migration.version, migration.name, migration.checksum, Date.now() - started]
          );
          await client.query('COMMIT');
        } catch (cause) {
          await client.query('ROLLBACK').catch(() => undefined);
          throw new PersistenceError(
            'MIGRATION_EXECUTION_FAILED',
            `Migration ${migration.version}_${migration.name} failed.`,
            { cause }
          );
        }
      }
      return statusWithClient(client, namespace, migrations);
    } finally {
      await client.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [
        `markorbit:migrate:${namespace}`
      ]);
    }
  } finally {
    client.release();
  }
}
