import {
  createDurableExecutionProviderRoutes,
  createRuntime,
  PostgresFilingGovernanceRepository,
  PostgresProfessionalReviewRepository
} from './index.js';
import { PostgresEvidenceReviewRepository } from './evidence-review-postgres.js';
import { PostgresProviderReturnEvidenceRepository } from './provider-return-evidence-postgres.js';
import {
  PostgresReviewedSourceAdmissionRepository,
  ReviewedSourceAdmissionService,
  ReviewedSourceHandoffService
} from './reviewed-source-handoff.js';
import {
  createExecutionReviewedSourceInternalRoutes,
  HttpMarkRegLifecycleProjectionClient
} from './reviewed-source-handoff-http.js';

const fixtureRuntime = process.env.MO_MILESTONE_TEST_RUNTIME === '1';
let closeDatabase: () => Promise<void> = () => Promise.resolve();
let runtime: ReturnType<typeof createRuntime>;
if (fixtureRuntime) {
  runtime = createRuntime({ milestoneTestRuntime: true });
} else {
  const databaseUrl = process.env.EXECUTION_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error('EXECUTION_DATABASE_URL is required for the durable Execution runtime.');
  const internalServiceSecret = process.env.MO_INTERNAL_SERVICE_SECRET;
  if (!internalServiceSecret || Buffer.byteLength(internalServiceSecret) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  const markRegUrl = process.env.MARKREG_URL ?? 'http://127.0.0.1:4105';
  const { ManagedDatabase, parseDatabaseConfig } = await import('@markorbit/persistence');
  const database = new ManagedDatabase(
    parseDatabaseConfig({
      ...process.env,
      DATABASE_URL: databaseUrl,
      DB_MIGRATION_NAMESPACE: process.env.EXECUTION_MIGRATION_NAMESPACE ?? 'execution'
    })
  );
  await database.start();
  const pool = database.getPool();
  closeDatabase = () => database.close();

  const evidenceReviewRepository = new PostgresEvidenceReviewRepository(database, pool);
  const reviewedSourceRepository = new PostgresReviewedSourceAdmissionRepository(database, pool);
  const reviewedSourceAdmissionService = new ReviewedSourceAdmissionService(
    reviewedSourceRepository,
    evidenceReviewRepository
  );
  const reviewedSourceHandoffService = new ReviewedSourceHandoffService(
    reviewedSourceRepository,
    new HttpMarkRegLifecycleProjectionClient(markRegUrl, internalServiceSecret)
  );
  const reviewedSourceRoutes = createExecutionReviewedSourceInternalRoutes({
    internalServiceSecret,
    admissionServiceFor: () => reviewedSourceAdmissionService,
    handoffServiceFor: () => reviewedSourceHandoffService
  });

  runtime = createRuntime({
    reviewRepositoryFactory: (workspaceId) =>
      new PostgresProfessionalReviewRepository(database, pool, workspaceId),
    filingRepositoryFactory: (workspaceId, actorId, correlationId) =>
      new PostgresFilingGovernanceRepository(database, pool, workspaceId, actorId, correlationId),
    providerExecutionRoutes: [
      ...createDurableExecutionProviderRoutes({
        database,
        internalServiceSecret
      }),
      ...reviewedSourceRoutes
    ],
    internalServiceSecret,
    markRegUrl
  });

  // Keep the provider evidence repository initialized through the same owner database.
  // The instance is intentionally not shared with admission writes, which consume only
  // the governed Evidence Review Decision repository rather than raw Provider Return truth.
  void new PostgresProviderReturnEvidenceRepository(database, pool);
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
