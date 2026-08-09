import { ManagedDatabase, parseDatabaseConfig } from '@markorbit/persistence';
import { createDurableMgsnServices } from './durable-runtime.js';
import { createRuntime } from './index.js';

const internalServiceSecret = process.env.MO_INTERNAL_SERVICE_SECRET;
if (!internalServiceSecret || Buffer.byteLength(internalServiceSecret) < 32)
  throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
const databaseUrl = process.env.MGSN_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('MGSN_DATABASE_URL is required for the durable MGSN runtime.');

const database = new ManagedDatabase(
  parseDatabaseConfig({
    ...process.env,
    DATABASE_URL: databaseUrl,
    DB_MIGRATION_NAMESPACE: process.env.MGSN_MIGRATION_NAMESPACE ?? 'mgsn'
  })
);
await database.start();
const services = createDurableMgsnServices({
  database,
  coreUrl: process.env.CORE_URL ?? 'http://127.0.0.1:4101',
  executionUrl: process.env.EXECUTION_URL ?? 'http://127.0.0.1:4104',
  internalServiceSecret
});
const runtime = createRuntime({ internalServiceSecret, services });

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
