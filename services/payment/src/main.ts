import { ManagedDatabase, parseDatabaseConfig } from '@markorbit/persistence';
import { createRuntime } from './index.js';
import { PaymentLifecycleService } from './payment-lifecycle.js';
import { PostgresPaymentRepository } from './payment-postgres.js';
import {
  HttpPaymentCheckoutSource,
  UnconfiguredPaymentProviderAdapter
} from './payment-runtime.js';
import { PaymentService } from './payment-service.js';

const databaseUrl = process.env.PAYMENT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error('PAYMENT_DATABASE_URL is required for the durable Payment runtime.');
const internalServiceSecret = process.env.MO_INTERNAL_SERVICE_SECRET;
if (!internalServiceSecret)
  throw new Error('MO_INTERNAL_SERVICE_SECRET is required for the durable Payment runtime.');
const markRegUrl = process.env.MARKREG_URL ?? 'http://127.0.0.1:4105';
const providerCode = process.env.PAYMENT_PROVIDER_CODE ?? 'UNCONFIGURED';

const database = new ManagedDatabase(
  parseDatabaseConfig({
    ...process.env,
    DATABASE_URL: databaseUrl,
    DB_MIGRATION_NAMESPACE: process.env.PAYMENT_MIGRATION_NAMESPACE ?? 'payment'
  })
);
await database.start();
const pool = database.getPool();
const repository = new PostgresPaymentRepository(database, pool);
const provider = new UnconfiguredPaymentProviderAdapter(providerCode);
const service = new PaymentService(
  repository,
  new HttpPaymentCheckoutSource(markRegUrl, internalServiceSecret),
  provider
);
const lifecycleService = new PaymentLifecycleService(repository, provider);
const runtime = createRuntime({
  service,
  lifecycleService,
  providerCode,
  internalServiceSecret
});

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
