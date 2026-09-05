import {
  createDurableExecutionProviderRoutes,
  createRuntime,
  PostgresFilingGovernanceRepository,
  PostgresProfessionalReviewRepository
} from './index.js';
import { json } from '@markorbit/service-kit';
import { createExecutionCapabilityObservationSourceRoutes } from './capability-observation-source-http.js';
import { EvidenceReviewService } from './evidence-review.js';
import { PostgresEvidenceReviewRepository } from './evidence-review-postgres.js';
import { PostgresEvidenceReviewQueueReader } from './evidence-review-queue-postgres.js';
import { createExecutionEvidenceProvenanceRoutes } from './evidence-provenance-http.js';
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
import { createTrademarkServiceExecutionRoutes } from './trademark-service-execution-http.js';
import { PostgresTrademarkServiceExecutionRepository } from './trademark-service-execution-postgres.js';

const fixtureRuntime = process.env.MO_MILESTONE_TEST_RUNTIME === '1';
const durableMilestoneOwners = process.env.MO_MILESTONE_DURABLE_OWNERS === '1';
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

  const durableMilestoneSnapshotRoutes = durableMilestoneOwners
    ? [
        {
          method: 'GET' as const,
          path: '/__milestone/scenario-records',
          handle: async () => {
            const [reviewResult, authorizationResult, releaseResult, taskResult] =
              await Promise.all([
                pool.query(
                  'SELECT review_case,version,status,completed_at,completed_by FROM professional_review_cases ORDER BY professional_review_case_id'
                ),
                pool.query(
                  'SELECT authorization_record,version,status FROM filing_authorizations ORDER BY filing_authorization_id'
                ),
                pool.query(
                  'SELECT release_record,version,status FROM execution_releases ORDER BY execution_release_id'
                ),
                pool.query(
                  'SELECT task_record,status FROM filing_execution_task_drafts ORDER BY filing_execution_task_draft_id'
                )
              ]);
            const professionalReviewCases = reviewResult.rows.map((raw) => {
              const row = raw as Record<string, unknown>;
              return {
                ...(row.review_case as Record<string, unknown>),
                version: Number(row.version),
                status: String(row.status),
                ...(row.completed_at
                  ? {
                      completedAt: new Date(row.completed_at as string).toISOString(),
                      completedBy: String(row.completed_by)
                    }
                  : {})
              };
            });
            const filingAuthorizations = authorizationResult.rows.map((raw) => {
              const row = raw as Record<string, unknown>;
              return {
                ...(row.authorization_record as Record<string, unknown>),
                version: Number(row.version),
                status: String(row.status)
              };
            });
            const executionReleases = releaseResult.rows.map((raw) => {
              const row = raw as Record<string, unknown>;
              return {
                ...(row.release_record as Record<string, unknown>),
                version: Number(row.version),
                status: String(row.status)
              };
            });
            const filingExecutionTaskDrafts = taskResult.rows.map((raw) => {
              const row = raw as Record<string, unknown>;
              return {
                ...(row.task_record as Record<string, unknown>),
                status: String(row.status)
              };
            });
            return json(200, {
              professionalReviewCases,
              filingAuthorizations,
              executionReleases,
              filingExecutionTaskDrafts
            });
          }
        }
      ]
    : [];

  const evidenceReceiptRepository = new PostgresProviderReturnEvidenceRepository(database, pool);
  const evidenceReviewRepository = new PostgresEvidenceReviewRepository(database, pool);
  const evidenceReviewQueue = new PostgresEvidenceReviewQueueReader(pool);
  const evidenceReviewService = new EvidenceReviewService(
    evidenceReviewRepository,
    evidenceReceiptRepository
  );
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
  const evidenceProvenanceRoutes = createExecutionEvidenceProvenanceRoutes({
    internalServiceSecret,
    admissionServiceFor: () => reviewedSourceAdmissionService,
    handoffServiceFor: () => reviewedSourceHandoffService,
    evidenceReviewServiceFor: () => evidenceReviewService,
    reviewQueueFor: () => evidenceReviewQueue
  });
  const capabilityObservationSourceRoutes = createExecutionCapabilityObservationSourceRoutes({
    internalServiceSecret,
    evidenceReviewReader: evidenceReviewRepository
  });
  const trademarkServiceExecutionRepository = new PostgresTrademarkServiceExecutionRepository(
    database,
    pool
  );
  const trademarkServiceExecutionRoutes = createTrademarkServiceExecutionRoutes({
    internalServiceSecret,
    repository: trademarkServiceExecutionRepository
  });

  runtime = createRuntime({
    milestoneTestRuntime: durableMilestoneOwners,
    reviewRepositoryFactory: (workspaceId) =>
      new PostgresProfessionalReviewRepository(database, pool, workspaceId),
    filingRepositoryFactory: (workspaceId, actorId, correlationId) =>
      new PostgresFilingGovernanceRepository(database, pool, workspaceId, actorId, correlationId),
    providerExecutionRoutes: [
      ...durableMilestoneSnapshotRoutes,
      ...createDurableExecutionProviderRoutes({
        database,
        internalServiceSecret
      }),
      ...reviewedSourceRoutes,
      ...evidenceProvenanceRoutes,
      ...capabilityObservationSourceRoutes,
      ...trademarkServiceExecutionRoutes
    ],
    internalServiceSecret,
    markRegUrl
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
