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
  const pool = database.getPool();
  closeDatabase = () => database.close();
  const internalServiceSecret = process.env.MO_INTERNAL_SERVICE_SECRET;
  const executionUrl = process.env.EXECUTION_URL ?? 'http://127.0.0.1:4104';
  const liteUrl = process.env.LITE_URL ?? 'http://127.0.0.1:4107';
  const capabilityUrl = process.env.CAPABILITY_ENGINE_URL ?? 'http://127.0.0.1:4103';
  const coreUrl = process.env.CORE_URL ?? 'http://127.0.0.1:4101';
  if (!internalServiceSecret)
    throw new Error('MO_INTERNAL_SERVICE_SECRET is required for the durable MarkReg runtime.');
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
    customerConfirmationRepository: new PostgresCustomerConfirmationRepository(pool),
    matterDraftRepository: new PostgresMatterDraftRepository(pool),
    formalMatterRepository,
    documentPackageService,
    preparationRepository: new FailClosedPreparationRepository(),
    auditRepository: new PostgresMarkRegAuditRepository(pool),
    internalServiceSecret,
    executionUrl,
    extraRoutes: [
      ...commercialCheckoutRoutes,
      ...commercialAdminRoutes,
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
