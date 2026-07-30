import process from 'node:process';
import { ManagedDatabase } from './database.js';
import { parseDatabaseConfig } from './config.js';
import { loadMigrations, migrate, migrationStatus, verifyMigrations } from './migrations.js';
import { redactSecrets } from './errors.js';

const [command, directory] = process.argv.slice(2);
if (!command || !directory)
  throw new Error('Usage: cli.ts <migrate|status|verify|bootstrap-test> <migration-directory>');
const config = parseDatabaseConfig(process.env);
const database = new ManagedDatabase(config);
try {
  await database.start();
  const migrations = await loadMigrations(directory);
  if (command === 'migrate')
    await migrate(database.getPool(), config.migrationNamespace, migrations);
  else if (command === 'status')
    console.table(await migrationStatus(database.getPool(), config.migrationNamespace, migrations));
  else if (command === 'verify')
    await verifyMigrations(database.getPool(), config.migrationNamespace, migrations);
  else if (command === 'bootstrap-test') {
    if (!config.testDatabaseIdentifier || !config.testDatabaseIdentifier.includes('test'))
      throw new Error('bootstrap-test requires DB_TEST_DATABASE containing "test".');
    await migrate(database.getPool(), config.migrationNamespace, migrations);
  } else throw new Error(`Unknown persistence command: ${command}`);
  console.log(`Persistence ${command} completed for namespace ${config.migrationNamespace}.`);
} catch (error) {
  console.error(
    redactSecrets(error instanceof Error ? `${error.name}: ${error.message}` : String(error))
  );
  process.exitCode = 1;
} finally {
  await database.close();
}
