import path from 'node:path';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig,
  verifyMigrations
} from '../packages/persistence/dist/index.js';

const migrationDirectory = path.resolve('infrastructure/persistence/migrations');
const ownershipFile = path.resolve('infrastructure/persistence/migration-owners.json');
const owners = [
  {
    name: 'MarkReg',
    packageName: '@markorbit/markreg-service',
    namespace: 'markreg',
    databaseUrl: process.env.MARKREG_DATABASE_URL
  },
  {
    name: 'Execution',
    packageName: '@markorbit/execution-service',
    namespace: 'execution',
    databaseUrl: process.env.EXECUTION_DATABASE_URL
  }
];

for (const owner of owners) {
  if (!owner.databaseUrl)
    throw new Error(`${owner.name} durable milestone database URL is required.`);
  const database = new ManagedDatabase(
    parseDatabaseConfig({
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: owner.databaseUrl,
      DB_MIGRATION_NAMESPACE: owner.namespace,
      DB_APPLICATION_NAME: `milestone-real-runtime-${owner.namespace}`
    })
  );
  try {
    await database.start();
    const migrations = await loadMigrationsForOwner(
      migrationDirectory,
      ownershipFile,
      owner.packageName
    );
    await migrate(database.getPool(), owner.namespace, migrations);
    await verifyMigrations(database.getPool(), owner.namespace, migrations);
    process.stdout.write(
      `${owner.name} durable milestone migrations verified (${migrations.length} owned).\n`
    );
  } finally {
    await database.close();
  }
}
