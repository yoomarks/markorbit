import { createRuntime, PostgresProfessionalReviewRepository } from './index.js';

const fixtureRuntime = process.env.MO_MILESTONE_TEST_RUNTIME === '1';
let closeDatabase: () => Promise<void> = () => Promise.resolve();
let runtime: ReturnType<typeof createRuntime>;
if (fixtureRuntime) {
  runtime = createRuntime({ milestoneTestRuntime: true });
} else {
  const databaseUrl = process.env.EXECUTION_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error('EXECUTION_DATABASE_URL is required for the durable Execution runtime.');
  const { ManagedDatabase, parseDatabaseConfig } = await import('@markorbit/persistence');
  const database = new ManagedDatabase(
    parseDatabaseConfig({
      ...process.env,
      DATABASE_URL: databaseUrl,
      DB_MIGRATION_NAMESPACE: process.env.EXECUTION_MIGRATION_NAMESPACE ?? 'execution'
    })
  );
  await database.start();
  closeDatabase = () => database.close();
  runtime = createRuntime({
    reviewRepositoryFactory: (workspaceId) =>
      new PostgresProfessionalReviewRepository(database, database.getPool(), workspaceId),
    ...(process.env.MO_INTERNAL_SERVICE_SECRET
      ? { internalServiceSecret: process.env.MO_INTERNAL_SERVICE_SECRET }
      : {}),
    ...(process.env.MARKREG_URL ? { markRegUrl: process.env.MARKREG_URL } : {})
  });
}

async function shutdown(signal: string) {
  process.stdout.write(`${runtime.manifest.name}: received ${signal}, stopping.\n`);
  await runtime.stop();
  await closeDatabase();
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await runtime.start();
} catch (error) {
  await closeDatabase();
  throw error;
}
process.stdout.write(
  `${runtime.manifest.name}: listening on http://127.0.0.1:${runtime.listeningPort}.\n`
);
