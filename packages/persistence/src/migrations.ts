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
        const sql = await readFile(path.join(directory, file), 'utf8');
        return {
          version: match[1]!,
          name: match[2]!,
          sql,
          checksum: createHash('sha256').update(sql).digest('hex')
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
const setup = async (client: PoolClient) =>
  client.query(`CREATE SCHEMA IF NOT EXISTS markorbit_persistence;
CREATE TABLE IF NOT EXISTS markorbit_persistence.migration_history (
 namespace text NOT NULL, version text NOT NULL, name text NOT NULL, checksum text NOT NULL,
 applied_at timestamptz NOT NULL DEFAULT clock_timestamp(), duration_ms integer NOT NULL,
 PRIMARY KEY(namespace, version), UNIQUE(namespace, name));`);
export async function migrationStatus(
  pool: Pool,
  namespace: string,
  migrations: Migration[]
): Promise<MigrationRecord[]> {
  const client = await pool.connect();
  try {
    await setup(client);
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
  } finally {
    client.release();
  }
}
export async function verifyMigrations(
  pool: Pool,
  namespace: string,
  migrations: Migration[]
): Promise<void> {
  const statuses = await migrationStatus(pool, namespace, migrations);
  const rows = await pool.query<{ version: string; name: string; checksum: string }>(
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
  void statuses;
}
export async function migrate(
  pool: Pool,
  namespace: string,
  migrations: Migration[]
): Promise<MigrationRecord[]> {
  const client = await pool.connect();
  try {
    await setup(client);
    await client.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [
      `markorbit:migrate:${namespace}`
    ]);
    try {
      await verifyMigrations(pool, namespace, migrations);
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
      return migrationStatus(pool, namespace, migrations);
    } finally {
      await client.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [
        `markorbit:migrate:${namespace}`
      ]);
    }
  } finally {
    client.release();
  }
}
