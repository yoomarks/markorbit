import {
  createRuntime,
  InMemoryMatterFlowRepository,
  PostgresCustomerConfirmationRepository,
  PostgresMatterDraftRepository,
  PostgresFormalMatterRepository,
  PostgresDocumentPackageService,
  PostgresMarkRegAuditRepository,
  DocumentPackageError
} from './index.js';
import {
  encodeInternalWorkspacePrincipal,
  type ProfessionalReviewCase
} from '@markorbit/contracts';

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
  const internalServiceSecret = process.env.MO_INTERNAL_SERVICE_SECRET;
  const executionUrl = process.env.EXECUTION_URL ?? 'http://127.0.0.1:4104';
  if (!internalServiceSecret)
    throw new Error('MO_INTERNAL_SERVICE_SECRET is required for the durable MarkReg runtime.');
  const documentPackageService = new PostgresDocumentPackageService(database, database.getPool(), {
    async get(principal, reviewCaseId, correlationId) {
      let response: Response;
      try {
        response = await fetch(
          `${executionUrl}/v1/professional-review-cases/${encodeURIComponent(reviewCaseId)}`,
          {
            headers: {
              'x-markorbit-internal-authorization': internalServiceSecret,
              'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
              'x-markorbit-workspace-id': principal.workspaceId,
              ...(correlationId ? { 'x-correlation-id': correlationId } : {})
            }
          }
        );
      } catch (cause) {
        throw new DocumentPackageError(
          'REVIEW_SOURCE_UNAVAILABLE',
          'Professional Review validation is unavailable.',
          503,
          true,
          { cause: cause instanceof Error ? cause : undefined }
        );
      }
      if (response.status === 404)
        throw new DocumentPackageError(
          'SOURCE_REVIEW_NOT_FOUND',
          'Professional Review was not found.',
          404
        );
      if (!response.ok)
        throw new DocumentPackageError(
          'REVIEW_SOURCE_UNAVAILABLE',
          'Professional Review validation is unavailable.',
          503,
          true
        );
      return ((await response.json()) as { reviewCase: ProfessionalReviewCase }).reviewCase;
    }
  });
  runtime = createRuntime({
    customerConfirmationRepository: new PostgresCustomerConfirmationRepository(database.getPool()),
    matterDraftRepository: new PostgresMatterDraftRepository(database.getPool()),
    formalMatterRepository: new PostgresFormalMatterRepository(database, database.getPool()),
    documentPackageService,
    auditRepository: new PostgresMarkRegAuditRepository(database.getPool()),
    internalServiceSecret,
    executionUrl
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
