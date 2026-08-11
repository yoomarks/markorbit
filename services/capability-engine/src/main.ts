import { ManagedDatabase, parseDatabaseConfig } from '@markorbit/persistence';
import { createRuntime, PostgresRuntimeCapabilityRegistry } from './index.js';

const databaseUrl = process.env.CAPABILITY_ENGINE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error(
    'CAPABILITY_ENGINE_DATABASE_URL is required for the durable Capability Engine runtime.'
  );
const internalServiceSecret = process.env.MO_INTERNAL_SERVICE_SECRET;
if (!internalServiceSecret)
  throw new Error('MO_INTERNAL_SERVICE_SECRET is required for the durable Capability Engine runtime.');

const database = new ManagedDatabase(
  parseDatabaseConfig({
    ...process.env,
    DATABASE_URL: databaseUrl,
    DB_MIGRATION_NAMESPACE:
      process.env.CAPABILITY_ENGINE_MIGRATION_NAMESPACE ?? 'capability_engine_runtime_registry'
  })
);
await database.start();
const registry = new PostgresRuntimeCapabilityRegistry(database, database.getPool());
const runtime = createRuntime({ runtimeCapabilityRegistry: registry, internalServiceSecret });

async function shutdown(signal: string) {
  process.stdout.write(`${runtime.manifest.name}: received ${signal}, stopping.\n`);
  await runtime.stop();
  await database.close();
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await runtime.start();
} catch (error) {
  await database.close();
  throw error;
}
process.stdout.write(
  `${runtime.manifest.name}: listening on http://127.0.0.1:${runtime.listeningPort}.\n`
);
