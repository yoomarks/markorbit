import { loadMigrationsForOwner, migrate, type ManagedDatabase } from '@markorbit/persistence';

const MGSN_RESET_LOCK = 'markorbit:test:mgsn-reset';

export async function resetAndMigrateMgsnTestDatabase(input: {
  pool: ReturnType<ManagedDatabase['getPool']>;
  namespace: string;
  migrationsDirectory: string;
  migrationOwners: string;
}) {
  const client = await input.pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [MGSN_RESET_LOCK]);
    const migrations = await loadMigrationsForOwner(
      input.migrationsDirectory,
      input.migrationOwners,
      '@markorbit/mgsn-service'
    );
    const ownedTables = [
      ...new Set(
        migrations.flatMap((migration) =>
          [
            ...migration.sql.matchAll(
              /\bCREATE TABLE\s+(?:IF NOT EXISTS\s+)?([a-z][a-z0-9_]*)\s*\(/giu
            )
          ].map((match) => match[1]!)
        )
      )
    ].reverse();
    if (ownedTables.length)
      await client.query(
        `DROP TABLE IF EXISTS ${ownedTables.map((table) => `"${table}"`).join(',')} CASCADE`
      );

    const ownedFunctions = [
      ...new Set(
        migrations.flatMap((migration) =>
          [
            ...migration.sql.matchAll(
              /\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-z][a-z0-9_]*)\s*\(/giu
            )
          ].map((match) => match[1]!)
        )
      )
    ];
    if (ownedFunctions.length) {
      const functions = await client.query<{ signature: string }>(
        `SELECT pg_proc.oid::regprocedure::text AS signature
           FROM pg_proc
           JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
          WHERE pg_namespace.nspname = current_schema()
            AND pg_proc.proname = ANY($1::text[])`,
        [ownedFunctions]
      );
      for (const { signature } of functions.rows)
        await client.query(`DROP FUNCTION IF EXISTS ${signature} CASCADE`);
    }

    const history = await client.query<{ migration_history: string | null }>(
      "SELECT to_regclass('markorbit_persistence.migration_history')::text AS migration_history"
    );
    if (history.rows[0]?.migration_history)
      await client.query(
        'DELETE FROM markorbit_persistence.migration_history WHERE namespace = $1',
        [input.namespace]
      );
    await migrate(input.pool, input.namespace, migrations);
    return migrations;
  } finally {
    await client
      .query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [MGSN_RESET_LOCK])
      .catch(() => undefined);
    client.release();
  }
}
