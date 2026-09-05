import {
  createRuntime,
  InMemoryMatterFlowRepository,
  PostgresCustomerConfirmationRepository,
  PostgresMatterDraftRepository,
  PostgresFormalMatterRepository,
  PostgresDocumentPackageService,
  PostgresMarkRegAuditRepository,
  PostgresOrderRepository,
  DocumentPackageError
} from './index.js';
import {
  encodeInternalWorkspacePrincipal,
  type ProfessionalReviewCase
} from '@markorbit/contracts';
import { json } from '@markorbit/service-kit';
import {
  LifecycleProjectionService,
  PostgresLifecycleProjectionRepository
} from './lifecycle-projection.js';
import {
  createMarkRegLifecycleHandoffRoutes,
  HttpReviewedSourceAdmissionReader
} from './lifecycle-handoff-http.js';
import {
  PostgresRecommendedActionRepository,
  RecommendedActionService
} from './recommended-action.js';
import { createMarkRegLifecycleSurfaceRoutes } from './lifecycle-surface-http.js';
import { PostgresFormalOpportunityStore } from './formal-opportunity.js';
import {
  createMarkRegFormalOpportunityRoutes,
  HttpQualifiedOpportunityAuthority
} from './formal-opportunity-http.js';
import { PostgresKnowledgeCasePromotionRepository } from './knowledge-case-promotion-postgres.js';
import {
  createKnowledgeCasePromotionRoutes,
  HttpKnowledgeCaseIntakeClient
} from './knowledge-case-promotion.js';
import { CommercialCheckoutService } from './commercial-checkout.js';
import { PostgresCommercialCatalogRepository } from './commercial-checkout-postgres.js';
import { createCommercialCheckoutHttpRoutes } from './commercial-checkout-http.js';
import { MarkRegCommercialAdminReadService } from './commercial-admin-read.js';
import { createMarkRegCommercialAdminHttpRoutes } from './commercial-admin-http.js';
import {
  HttpCnDurationBandCapabilityClient,
  MatterIntelligenceService,
  PostgresMatterIntelligenceRepository
} from './matter-intelligence.js';
import { createMatterIntelligenceRoutes } from './matter-intelligence-http.js';
import {
  MatterIntelligenceReadService,
  PostgresMatterIntelligenceReadRepository
} from './matter-intelligence-read.js';
import { createMatterIntelligenceReadRoutes } from './matter-intelligence-read-http.js';
import {
  FormalMatterEvidenceReadService,
  PostgresFormalMatterDocumentPackageReader
} from './formal-matter-evidence-read.js';
import { createFormalMatterEvidenceReadRoutes } from './formal-matter-evidence-read-http.js';
import {
  MatterIntelligenceReviewService,
  PostgresMatterIntelligenceReviewRepository
} from './matter-intelligence-review.js';
import { createMatterIntelligenceReviewRoutes } from './matter-intelligence-review-http.js';
import {
  HttpCoreMethodOutcomeEvidenceAdmissionClientV1,
  MarkRegMethodOutcomeEvidenceEmitterV1,
  PostgresMarkRegMethodOutcomeEvidenceSourceV1
} from './method-outcome-evidence-emission.js';
import { FailClosedPreparationRepository } from './fail-closed-preparation.js';
import { PostgresDurablePreparationLockService } from './durable-preparation-lock.js';
import { createDurablePreparationLockRoutes } from './durable-preparation-lock-http.js';
import { PostgresProductionIntakeService } from './production-intake.js';
import { createProductionIntakeRoutes } from './production-intake-http.js';
import {
  PostgresWorkspaceActionSourceReader,
  WorkspaceActionReadService
} from './workspace-action-read.js';
import { createMarkRegWorkspaceActionReadRoutes } from './workspace-action-read-http.js';

const fixtureRuntime = process.env.MO_MILESTONE_TEST_RUNTIME === '1';
const durableMilestoneOwners = process.env.MO_MILESTONE_DURABLE_OWNERS === '1';
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
  const pool = database.getPool();
  closeDatabase = () => database.close();
  const internalServiceSecret = process.env.MO_INTERNAL_SERVICE_SECRET;
  const executionUrl = process.env.EXECUTION_URL ?? 'http://127.0.0.1:4104';
  const liteUrl = process.env.LITE_URL ?? 'http://127.0.0.1:4107';
  const capabilityUrl = process.env.CAPABILITY_ENGINE_URL ?? 'http://127.0.0.1:4103';
  const coreUrl = process.env.CORE_URL ?? 'http://127.0.0.1:4101';
  if (!internalServiceSecret)
    throw new Error('MO_INTERNAL_SERVICE_SECRET is required for the durable MarkReg runtime.');
  const durableMilestoneSnapshotRoutes = durableMilestoneOwners
    ? [
        {
          method: 'GET' as const,
          path: '/__milestone/scenario-records',
          handle: async () => {
            const [draftResult, lockResult] = await Promise.all([
              pool.query(
                'SELECT matter_draft_id,customer_confirmation_id,preparation,status,version,updated_at FROM matter_drafts ORDER BY matter_draft_id'
              ),
              pool.query(
                'SELECT lock_record FROM markreg_preparation_locks ORDER BY preparation_lock_id'
              )
            ]);
            const matterDrafts = draftResult.rows.map((raw) => {
              const row = raw as Record<string, unknown>;
              return {
                matterDraftId: String(row.matter_draft_id),
                confirmationId: String(row.customer_confirmation_id),
                preparation: row.preparation,
                status: String(row.status),
                version: Number(row.version),
                updatedAt: new Date(row.updated_at as string).toISOString()
              };
            });
            const preparationLocks = lockResult.rows.map((raw) => {
              const row = raw as Record<string, unknown>;
              const lock = row.lock_record as Record<string, unknown>;
              const source = (lock.source ?? {}) as Record<string, unknown>;
              const instructionLedgerVersion =
                typeof source.instructionSetHash === 'string'
                  ? source.instructionSetHash
                  : typeof lock.version === 'string' || typeof lock.version === 'number'
                    ? String(lock.version)
                    : '1';
              return {
                ...lock,
                documentPackageVersion: Number(source.documentPackageVersion),
                instructionLedgerVersion,
                snapshot: {
                  documentPackage: {
                    professionalReviewCaseId: String(source.professionalReviewCaseId)
                  },
                  sourceReviewDecisionVersion: Number(source.reviewVersion)
                }
              };
            });
            return json(200, { matterDrafts, preparationLocks });
          }
        }
      ]
    : [];
  const formalMatterRepository = new PostgresFormalMatterRepository(database, pool);
  const matterIntelligenceRepository = new PostgresMatterIntelligenceRepository(database, pool);
  const matterIntelligenceService = new MatterIntelligenceService(
    matterIntelligenceRepository,
    formalMatterRepository,
    new HttpCnDurationBandCapabilityClient(capabilityUrl, internalServiceSecret)
  );
  const matterIntelligenceRoutes = createMatterIntelligenceRoutes({
    internalServiceSecret,
    service: matterIntelligenceService
  });
  const matterIntelligenceReadService = new MatterIntelligenceReadService(
    new PostgresMatterIntelligenceReadRepository(database)
  );
  const matterIntelligenceReadRoutes = createMatterIntelligenceReadRoutes({
    internalServiceSecret,
    service: matterIntelligenceReadService
  });
  const matterIntelligenceReviewService = new MatterIntelligenceReviewService(
    new PostgresMatterIntelligenceReviewRepository(database)
  );
  const methodOutcomeEvidenceEmitter = new MarkRegMethodOutcomeEvidenceEmitterV1(
    new PostgresMarkRegMethodOutcomeEvidenceSourceV1(pool),
    new HttpCoreMethodOutcomeEvidenceAdmissionClientV1(coreUrl, internalServiceSecret)
  );
  const matterIntelligenceReviewRoutes = createMatterIntelligenceReviewRoutes({
    internalServiceSecret,
    service: matterIntelligenceReviewService,
    evidenceEmitter: methodOutcomeEvidenceEmitter
  });
  const orderRepository = new PostgresOrderRepository(database, pool);
  const commercialRepository = new PostgresCommercialCatalogRepository(database, pool);
  const commercialCheckoutService = new CommercialCheckoutService(
    commercialRepository,
    orderRepository
  );
  const commercialCheckoutRoutes = createCommercialCheckoutHttpRoutes({
    internalServiceSecret,
    service: commercialCheckoutService
  });
  const commercialAdminReadService = new MarkRegCommercialAdminReadService(
    commercialRepository,
    orderRepository,
    formalMatterRepository
  );
  const commercialAdminRoutes = createMarkRegCommercialAdminHttpRoutes({
    internalServiceSecret,
    service: commercialAdminReadService
  });
  const documentPackageService = new PostgresDocumentPackageService(database, pool, {
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
  const productionIntakeService = new PostgresProductionIntakeService(database, pool);
  const productionIntakeRoutes = createProductionIntakeRoutes({
    internalServiceSecret,
    service: productionIntakeService
  });
  const durablePreparationLockService = new PostgresDurablePreparationLockService(database, pool);
  const durablePreparationLockRoutes = createDurablePreparationLockRoutes({
    internalServiceSecret,
    service: durablePreparationLockService
  });
  const lifecycleRepository = new PostgresLifecycleProjectionRepository(database, pool);
  const formalMatterEvidenceReadService = new FormalMatterEvidenceReadService({
    formalMatters: formalMatterRepository,
    documentPackages: new PostgresFormalMatterDocumentPackageReader(pool, documentPackageService),
    lifecycle: lifecycleRepository,
    intelligence: matterIntelligenceReadService
  });
  const formalMatterEvidenceReadRoutes = createFormalMatterEvidenceReadRoutes({
    internalServiceSecret,
    service: formalMatterEvidenceReadService
  });
  const recommendedActionRepository = new PostgresRecommendedActionRepository(database, pool);
  const workspaceActionReadService = new WorkspaceActionReadService(
    new PostgresWorkspaceActionSourceReader(pool)
  );
  const workspaceActionReadRoutes = createMarkRegWorkspaceActionReadRoutes({
    internalServiceSecret,
    service: workspaceActionReadService
  });
  const lifecycleServiceFor = (workspaceId: string) =>
    new LifecycleProjectionService(
      lifecycleRepository,
      formalMatterRepository,
      new HttpReviewedSourceAdmissionReader(executionUrl, internalServiceSecret, workspaceId)
    );
  const recommendedActionServiceFor = () =>
    new RecommendedActionService(recommendedActionRepository, lifecycleRepository);
  const lifecycleRoutes = createMarkRegLifecycleHandoffRoutes({
    internalServiceSecret,
    lifecycleServiceFor,
    recommendedActionServiceFor
  });
  const lifecycleSurfaceRoutes = createMarkRegLifecycleSurfaceRoutes({
    internalServiceSecret,
    formalMatterRepository,
    lifecycleServiceFor,
    recommendedActionServiceFor
  });
  const formalOpportunityStore = new PostgresFormalOpportunityStore(
    database,
    pool,
    new HttpQualifiedOpportunityAuthority(liteUrl, internalServiceSecret)
  );
  const formalOpportunityRoutes = createMarkRegFormalOpportunityRoutes({
    internalServiceSecret,
    store: formalOpportunityStore
  });
  const knowledgeCaseRoutes = (() => {
    if (process.env.MO_KNOWLEDGE_CASE_PROMOTION_ENABLED !== '1') return [];
    const knowledgeUrl = process.env.KNOWLEDGE_URL;
    if (!knowledgeUrl)
      throw new Error('KNOWLEDGE_URL is required when MO_KNOWLEDGE_CASE_PROMOTION_ENABLED=1.');
    return createKnowledgeCasePromotionRoutes({
      internalServiceSecret,
      formalMatterRepository,
      promotionRepository: new PostgresKnowledgeCasePromotionRepository(database, pool),
      intakeClient: new HttpKnowledgeCaseIntakeClient(knowledgeUrl, internalServiceSecret)
    });
  })();
  runtime = createRuntime({
    milestoneTestRuntime: durableMilestoneOwners,
    customerConfirmationRepository: new PostgresCustomerConfirmationRepository(pool),
    matterDraftRepository: new PostgresMatterDraftRepository(pool),
    formalMatterRepository,
    documentPackageService,
    preparationRepository: new FailClosedPreparationRepository(),
    auditRepository: new PostgresMarkRegAuditRepository(pool),
    internalServiceSecret,
    executionUrl,
    extraRoutes: [
      ...durableMilestoneSnapshotRoutes,
      ...productionIntakeRoutes,
      ...durablePreparationLockRoutes,
      ...commercialCheckoutRoutes,
      ...commercialAdminRoutes,
      ...workspaceActionReadRoutes,
      ...lifecycleRoutes,
      ...lifecycleSurfaceRoutes,
      ...formalOpportunityRoutes,
      ...matterIntelligenceRoutes,
      ...matterIntelligenceReadRoutes,
      ...formalMatterEvidenceReadRoutes,
      ...matterIntelligenceReviewRoutes,
      ...knowledgeCaseRoutes
    ]
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
