import { ManagedDatabase, parseDatabaseConfig } from '@markorbit/persistence';
import { createRuntime } from './index.js';
import { PostgresSiteRepositoryV1 } from './site-postgres.js';
import { HttpCoreSiteCommercialAuthorityV1 } from './site-runtime.js';
import { SiteServiceV1 } from './site-service.js';

const databaseUrl = process.env.SITE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('SITE_DATABASE_URL is required for the durable Site runtime.');
const internalServiceSecret = process.env.MO_INTERNAL_SERVICE_SECRET;
if (!internalServiceSecret || Buffer.byteLength(internalServiceSecret, 'utf8') < 32)
  throw new Error(
    'MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes for the durable Site runtime.'
  );

const database = new ManagedDatabase(
  parseDatabaseConfig({
    ...process.env,
    DATABASE_URL: databaseUrl,
    DB_MIGRATION_NAMESPACE: process.env.SITE_MIGRATION_NAMESPACE ?? 'site'
  })
);
await database.start();
const service = new SiteServiceV1(
  new PostgresSiteRepositoryV1(database),
  new HttpCoreSiteCommercialAuthorityV1(
    process.env.CORE_URL ?? 'http://127.0.0.1:4101',
    internalServiceSecret
  )
);
const runtime = createRuntime({ service, internalServiceSecret });

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
