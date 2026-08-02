import {
  loadMigrationsForOwner,
  migrate,
  type ManagedDatabase
} from '../../../../packages/persistence/src/index.js';

const MARKREG_RESET_LOCK = 'markorbit:test:markreg-reset';
export const MARKREG_TEST_MIGRATION_NAMESPACE = 'markreg_test';

/**
 * Test-only boundary for suites that deliberately replay every MarkReg-owned migration.
 * This module is only imported by test suites and real-runtime test launchers.
 */
export async function resetAndMigrateMarkRegTestDatabase(input: {
  pool: ReturnType<ManagedDatabase['getPool']>;
  migrationsDirectory: string;
  migrationOwners: string;
}) {
  const client = await input.pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [MARKREG_RESET_LOCK]);
    const migrations = await loadMigrationsForOwner(
      input.migrationsDirectory,
      input.migrationOwners,
      '@markorbit/markreg-service'
    );
    const ownedTables = migrations
      .flatMap((migration) =>
        [...migration.sql.matchAll(/\bCREATE TABLE\s+([a-z][a-z0-9_]*)\s*\(/gi)].map(
          (match) => match[1]!
        )
      )
      .reverse();
    if (ownedTables.length)
      await client.query(
        `DROP TABLE IF EXISTS ${ownedTables.map((table) => `"${table}"`).join(',')} CASCADE`
      );
    const ownedFunctions = migrations.flatMap((migration) =>
      [...migration.sql.matchAll(/\bCREATE FUNCTION\s+([a-z][a-z0-9_]*)\s*\(/gi)].map(
        (match) => match[1]!
      )
    );
    for (const functionName of ownedFunctions)
      await client.query(`DROP FUNCTION IF EXISTS "${functionName}"() CASCADE`);
    const history = await client.query<{ migration_history: string | null }>(
      "SELECT to_regclass('markorbit_persistence.migration_history')::text AS migration_history"
    );
    if (history.rows[0]?.migration_history)
      await client.query(
        'DELETE FROM markorbit_persistence.migration_history WHERE namespace = $1',
        [MARKREG_TEST_MIGRATION_NAMESPACE]
      );
    await migrate(input.pool, MARKREG_TEST_MIGRATION_NAMESPACE, migrations);
    return migrations;
  } finally {
    await client
      .query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [MARKREG_RESET_LOCK])
      .catch(() => undefined);
    client.release();
  }
}
