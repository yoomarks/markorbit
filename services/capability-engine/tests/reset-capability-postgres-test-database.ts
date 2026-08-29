import { ManagedDatabase, parseDatabaseConfig } from '@markorbit/persistence';

const url = process.env.CAPABILITY_ENGINE_TEST_DATABASE_URL;
const required = process.env.CAPABILITY_ENGINE_POSTGRES_TEST_REQUIRED === '1';

if (!url && required)
  throw new Error(
    'CAPABILITY_ENGINE_POSTGRES_TEST_REQUIRED=1 requires CAPABILITY_ENGINE_TEST_DATABASE_URL.'
  );

if (url) {
  const config = parseDatabaseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DB_MIGRATION_NAMESPACE: 'capability_engine_test_reset',
    DB_APPLICATION_NAME: 'markorbit-capability-engine-test-reset'
  });
  const database = new ManagedDatabase(config);
  await database.start();
  try {
    const identity = await database
      .getPool()
      .query<{ database_name: string }>('SELECT current_database() database_name');
    const databaseName = identity.rows[0]?.database_name;
    const systemDatabases = new Set(['postgres', 'template0', 'template1']);
    if (!databaseName || systemDatabases.has(databaseName))
      throw new Error('Capability PostgreSQL test reset requires a dedicated non-system database.');

    await database.getPool().query(
      `DO $reset$
       DECLARE capability_table text;
       BEGIN
         FOR capability_table IN
           SELECT tablename
             FROM pg_tables
            WHERE schemaname = current_schema()
              AND tablename LIKE 'capability\\_%' ESCAPE '\\'
         LOOP
           EXECUTE format(
             'DROP TABLE IF EXISTS %I.%I CASCADE',
             current_schema(),
             capability_table
           );
         END LOOP;
       END
       $reset$;
       DROP SCHEMA IF EXISTS markorbit_persistence CASCADE`
    );
  } finally {
    await database.close();
  }
}
