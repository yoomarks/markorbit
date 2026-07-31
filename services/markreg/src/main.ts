import {
  createRuntime,
  InMemoryMatterFlowRepository,
  PostgresCustomerConfirmationRepository,
  PostgresMatterDraftRepository,
  PostgresFormalMatterRepository
} from './index.js';

const fixtureRuntime = process.env.MO_MILESTONE_TEST_RUNTIME === '1';
let closeDatabase: () => Promise<void> = () => Promise.resolve();
let runtime: ReturnType<typeof createRuntime>;
if (fixtureRuntime) {
  runtime = createRuntime({
    milestoneTestRuntime: true,
    matterFlowRepository: new InMemoryMatterFlowRepository()
  });
} else {
  const databaseUrl = process.env.MARKREG_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error('MARKREG_DATABASE_URL is required for the durable MarkReg runtime.');
  const { ManagedDatabase, parseDatabaseConfig } = await import('@markorbit/persistence');
  const database = new ManagedDatabase(
    parseDatabaseConfig({
      ...process.env,
      DATABASE_URL: databaseUrl,
      DB_MIGRATION_NAMESPACE: process.env.MARKREG_MIGRATION_NAMESPACE ?? 'markreg'
    })
  );
  await database.start();
  closeDatabase = () => database.close();
  runtime = createRuntime({
    customerConfirmationRepository: new PostgresCustomerConfirmationRepository(database.getPool()),
    matterDraftRepository: new PostgresMatterDraftRepository(database.getPool()),
    formalMatterRepository: new PostgresFormalMatterRepository(database, database.getPool())
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
