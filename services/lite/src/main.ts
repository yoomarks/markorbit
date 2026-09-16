import type { WorkspacePrincipal } from '@markorbit/contracts';
import type {
  FormalTrademarkServiceOpportunity,
  MarkRegIntakeHandoff,
  PreparedAction,
  PreparedActionConfirmation,
  PreparedActionHandoffResult
} from '@markorbit/contracts/product-loop';
import { createServiceRuntime } from '@markorbit/service-kit';
import { PostgresLiteCandidateQualificationStore } from './candidate-qualification.js';
import { AgencyLineageProjectionService } from './agency-lineage.js';
import { createAgencyLineageRoutes } from './agency-lineage-http.js';
import { createLiteAdminRoutesV1 } from './admin-http.js';
import { ContentKitService, PostgresContentKitLifecycleReader } from './content-kit.js';
import { createContentKitRoutes } from './content-kit-http.js';
import {
  PostgresLiteContentPreparationStore,
  type ProductLoopSourceAuthority
} from './content-preparation.js';
import { PostgresProductConversionAnalyticsStore } from './conversion-analytics.js';
import {
  DailyOrbitService,
  PostgresDailyOrbitVisibilityProvider,
  PostgresDailySignalReader
} from './daily-orbit.js';
import { createDailyWorkspaceRoutes } from './daily-workspace-http.js';
import { HttpDataEngineApplicantOwnerReader } from './data-engine-applicant-owner-reader.js';
import { DiscoveredTrademarkAdmissionService } from './discovered-trademark-admission.js';
import { createDiscoveredTrademarkAdmissionRoutes } from './discovered-trademark-admission-http.js';
import { DataProspectingService } from './data-prospecting.js';
import { createDataProspectingRoutes } from './data-prospecting-http.js';
import { createProtectionMonitoringRoutes } from './protection-monitoring-http.js';
import {
  PostgresProtectionMonitoringRepository,
  ProtectionMonitoringService
} from './protection-monitoring.js';
import { createLiteWorkItemRoutes } from './lite-work-item-http.js';
import { PostgresLiteWorkItemStore } from './lite-work-item.js';
import { createWorkspaceWatchRoutes } from './workspace-watch-http.js';
import { PostgresWorkspaceWatchStore } from './workspace-watch.js';
import { createWorkspaceDirectoryRoutes } from './workspace-directory-http.js';
import { PostgresWorkspaceDirectoryStore } from './workspace-directory.js';
import { PostgresOutboundContactPolicyStore } from './outbound-contact-policy.js';
import { createOutboundContactPolicyRoutes } from './outbound-contact-policy-http.js';
import { PostgresBusinessAttributionStore } from './business-attribution.js';
import { createBusinessAttributionRoutes } from './business-attribution-http.js';
import {
  ContentLedDemandAttributionService,
  PostgresContentLedDemandLineageReader
} from './content-led-demand.js';
import {
  HttpCorePartnerKnowledgeSourceReader,
  PartnerIntelligenceService
} from './partner-intelligence.js';
import { createPartnerIntelligenceRoutes } from './partner-intelligence-http.js';
import { PostgresPartnerIntelligenceStore } from './partner-intelligence-store.js';
import { createPartnerReferralRoutes } from './partner-referral-http.js';
import {
  HttpCorePartnerReferralRatePolicyReader,
  PartnerReferralService,
  PostgresPartnerReferralStore
} from './partner-referral.js';
import { createEducationCommunityRoutes } from './education-community-http.js';
import {
  EducationCommunityService,
  HttpCoreEducationCommunityWorkspaceReader,
  PostgresEducationCommunityWorkItemReader
} from './education-community.js';
import { createCommunicationLinkRoutes } from './communication-link-http.js';
import { CommunicationLinkService, PostgresCommunicationLinkStore } from './communication-link.js';
import {
  ClientNotificationPreparedActionHandoff,
  HttpManagedCommunicationClientNotificationSender,
  ProductionClientNotificationBusinessReferenceValidator
} from './client-notification-handoff.js';
import { createClientNotificationFollowupRoutes } from './client-notification-followup-http.js';
import { ClientNotificationFollowupService } from './client-notification-followup.js';
import { createLiteIntakeStagingRoutes } from './lite-intake-staging-http.js';
import { HttpLiteIntakeProductionIntakeClient } from './lite-intake-staging-markreg.js';
import { LiteIntakeStagingService, PostgresLiteIntakeStagingStore } from './lite-intake-staging.js';
import {
  HttpManagedCommunicationLinkSourceReader,
  HttpMarkRegCommunicationLinkTargetReader,
  ProductionCommunicationLinkOwnerValidator
} from './communication-link-owner-validation.js';
import { DailyWorkspaceSnapshotService } from './daily-workspace-snapshot.js';
import {
  HttpCoreDailyKnowledgeSourceAuthority,
  PostgresLiteDailySignalStore
} from './daily-signal.js';
import { PostgresProductLoopFeedbackStore } from './feedback.js';
import { createContentStudioRoutes, createLiteProductLoopRoutes } from './http.js';
import { PostgresContentStudioReader } from './content-studio.js';
import {
  handoffResult,
  PostgresPreparedActionStore,
  PreparedActionJourneyService,
  type PreparedActionHandoffAuthority,
  type PreparedActionPlan
} from './prepared-action.js';
import { PostgresProductPreferenceStore } from './preference-feedback.js';
import { createProductPreferenceRoutes } from './preference-http.js';
import {
  DailyWorkspacePreferenceTargetResolver,
  ProductPreferenceService
} from './preference-target.js';
import { createTrademarkAssetReadRoutes } from './trademark-asset-http.js';
import { createTrademarkAssetMigrationRoutes } from './trademark-asset-migration-http.js';
import { TrademarkAssetMigrationOrchestrator } from './trademark-asset-migration.js';
import { PostgresTrademarkAssetMigrationRunStore } from './trademark-asset-migration-postgres.js';
import { createTradingStudioReadRoutes } from './trading-studio-http.js';
import { PostgresTradingStudioRunStore } from './trading-studio-run.js';
import { PostgresTradingDirectionSetStore } from './trading-direction-set.js';
import { PostgresTradingDirectionSelectionStore } from './trading-direction-selection.js';
import { PostgresTradingAiProfileStore } from './trading-ai-profile.js';
import { TradingAiProfileCheckpointService } from './trading-ai-profile-checkpoint.js';
import {
  HttpTradingManagedAiClient,
  TradingAiProfileGenerator
} from './trading-ai-profile-generation.js';
import { PostgresTradingBrandDnaStore } from './trading-brand-dna.js';
import { PostgresTradingListingStore } from './trading-listing.js';
import { PostgresTradingListingAssetStore } from './trading-listing-asset.js';
import { PostgresTradingMarketplaceTargetBindingStore } from './trading-marketplace-target-binding.js';
import { TradingListingPublicationCurrentnessResolver } from './trading-listing-publication-currentness.js';
import { createTradingListingPublicationCurrentnessRoutes } from './trading-listing-publication-currentness-http.js';
import { TrademarkAssetAiGuidePreparer } from './trademark-asset-ai-guide.js';
import { PostgresTrademarkAssetCommerceStore } from './trademark-asset-commerce.js';
import { PostgresTrademarkAssetManagementDispositionStore } from './trademark-asset-management-disposition.js';
import { PostgresTrademarkServiceWorkPackageStore } from './trademark-service-work-package.js';
import { createTrademarkServiceWorkbenchRoutes } from './trademark-service-workbench-http.js';
import { TrademarkAssetPortfolioService } from './trademark-asset-portfolio.js';
import { PostgresTrademarkAssetRefreshLedger } from './trademark-asset-refresh.js';
import { PostgresLiteTrademarkAssetStore } from './trademark-asset.js';
import {
  PostgresVisualBridgeStore,
  UnavailableVisualEngineConsumer,
  VisualBridgeService
} from './visual-bridge.js';
import { createVisualBridgeRoutes } from './visual-bridge-http.js';

export const serviceManifest = Object.freeze({
  name: 'lite',
  port: Number(process.env.PORT ?? '4107'),
  version: '0.1.0'
});

const databaseUrl = process.env.LITE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('LITE_DATABASE_URL is required for the durable Lite runtime.');
const configuredInternalServiceSecret = process.env.MO_INTERNAL_SERVICE_SECRET;
if (!configuredInternalServiceSecret)
  throw new Error('MO_INTERNAL_SERVICE_SECRET is required for the durable Lite runtime.');
const internalServiceSecret: string = configuredInternalServiceSecret;
const markRegUrl = process.env.MARKREG_URL ?? 'http://127.0.0.1:4105';
const dataEngineUrl = process.env.DATA_ENGINE_URL;
const dataEngineApiKey = process.env.DATA_ENGINE_API_KEY;
const coreUrl = process.env.CORE_URL ?? 'http://127.0.0.1:4101';
const capabilityEngineUrl = process.env.CAPABILITY_ENGINE_URL ?? 'http://127.0.0.1:4103';
const liteVisualStyleId = process.env.MOKI_LITE_STYLE_ID ?? 'markorbit-lite-editorial-v1';

const { ManagedDatabase, parseDatabaseConfig } = await import('@markorbit/persistence');
const database = new ManagedDatabase(
  parseDatabaseConfig({
    ...process.env,
    DATABASE_URL: databaseUrl,
    DB_MIGRATION_NAMESPACE: process.env.LITE_MIGRATION_NAMESPACE ?? 'lite'
  })
);
await database.start();
const pool = database.getPool();
const feedbackStore = new PostgresProductLoopFeedbackStore(database, pool);
const analyticsStore = new PostgresProductConversionAnalyticsStore(pool);
const dailySignalStore = new PostgresLiteDailySignalStore(
  database,
  pool,
  new HttpCoreDailyKnowledgeSourceAuthority(coreUrl, internalServiceSecret)
);
const trademarkAssetStore = new PostgresLiteTrademarkAssetStore(database, pool);
const tradingStudioRunStore = new PostgresTradingStudioRunStore(database, pool);
const tradingAiProfileStore = new PostgresTradingAiProfileStore(database, pool);
const trademarkAssetCommerceStore = new PostgresTrademarkAssetCommerceStore(
  database,
  pool,
  trademarkAssetStore
);
const trademarkAssetPortfolio = new TrademarkAssetPortfolioService(pool, trademarkAssetStore);
const trademarkAssetMigration = new TrademarkAssetMigrationOrchestrator(
  trademarkAssetPortfolio,
  new PostgresTrademarkAssetMigrationRunStore(pool)
);
const trademarkAssetRefreshLedger = new PostgresTrademarkAssetRefreshLedger(database, pool);
const trademarkAssetAiGuide = new TrademarkAssetAiGuidePreparer();
const trademarkAssetManagementDispositions = new PostgresTrademarkAssetManagementDispositionStore(
  database,
  pool
);
const trademarkServiceWorkPackages = new PostgresTrademarkServiceWorkPackageStore(database, pool);
const liteWorkItemStore = new PostgresLiteWorkItemStore(database, pool);
const workspaceWatchStore = new PostgresWorkspaceWatchStore(database, pool);
const workspaceDirectoryStore = new PostgresWorkspaceDirectoryStore(database, pool);
const outboundContactPolicyStore = new PostgresOutboundContactPolicyStore(database, pool);
const businessAttributionStore = new PostgresBusinessAttributionStore(database, pool);
const educationCommunityService = new EducationCommunityService(
  database,
  pool,
  outboundContactPolicyStore,
  new PostgresEducationCommunityWorkItemReader(pool),
  new HttpCoreEducationCommunityWorkspaceReader(coreUrl, internalServiceSecret),
  businessAttributionStore
);
const partnerReferralStore = new PostgresPartnerReferralStore(database, pool);
const partnerReferralService = new PartnerReferralService(
  workspaceDirectoryStore,
  businessAttributionStore,
  new HttpCorePartnerReferralRatePolicyReader(coreUrl, internalServiceSecret),
  partnerReferralStore
);
const contentLedDemandService = new ContentLedDemandAttributionService(
  new PostgresContentLedDemandLineageReader(pool),
  feedbackStore,
  businessAttributionStore
);
const partnerIntelligenceStore = new PostgresPartnerIntelligenceStore(database, pool);
const communicationLinkStore = new PostgresCommunicationLinkStore(database, pool);
const liteIntakeStagingStore = new PostgresLiteIntakeStagingStore(database, pool);
const agencyLineage = new AgencyLineageProjectionService({
  assets: trademarkAssetStore,
  directory: workspaceDirectoryStore,
  intake: liteIntakeStagingStore,
  links: communicationLinkStore,
  work: liteWorkItemStore,
  refresh: trademarkAssetRefreshLedger
});
const discoveredTrademarkAdmission = new DiscoveredTrademarkAdmissionService(
  workspaceDirectoryStore,
  new HttpDataEngineApplicantOwnerReader({
    ...(dataEngineUrl ? { dataEngineUrl } : {}),
    ...(dataEngineApiKey ? { apiKey: dataEngineApiKey } : {})
  }),
  trademarkAssetStore
);
const liteIntakeStagingService = new LiteIntakeStagingService(
  liteIntakeStagingStore,
  new HttpLiteIntakeProductionIntakeClient(markRegUrl, internalServiceSecret)
);
const markRegCommunicationLinkTargetReader = new HttpMarkRegCommunicationLinkTargetReader(
  markRegUrl,
  internalServiceSecret
);
const communicationLinkService = new CommunicationLinkService(
  communicationLinkStore,
  new ProductionCommunicationLinkOwnerValidator(
    new HttpManagedCommunicationLinkSourceReader(capabilityEngineUrl, internalServiceSecret),
    trademarkAssetStore,
    workspaceDirectoryStore,
    markRegCommunicationLinkTargetReader
  )
);
const managedCommunicationClientNotificationSender =
  new HttpManagedCommunicationClientNotificationSender(capabilityEngineUrl, internalServiceSecret);
const partnerIntelligenceService = new PartnerIntelligenceService(
  new HttpCorePartnerKnowledgeSourceReader(coreUrl, internalServiceSecret),
  partnerIntelligenceStore,
  outboundContactPolicyStore,
  managedCommunicationClientNotificationSender,
  workspaceDirectoryStore,
  communicationLinkStore,
  businessAttributionStore
);
const clientNotificationHandoff = new ClientNotificationPreparedActionHandoff(
  trademarkServiceWorkPackages,
  workspaceDirectoryStore,
  liteWorkItemStore,
  new ProductionClientNotificationBusinessReferenceValidator(
    workspaceDirectoryStore,
    trademarkAssetStore,
    markRegCommunicationLinkTargetReader
  ),
  managedCommunicationClientNotificationSender
);

const productLoopSourceAuthority: ProductLoopSourceAuthority = {
  async resolve(workspaceId, locator) {
    if (locator.owner === 'LITE' && locator.kind === 'CONTENT_USE_FEEDBACK') {
      const source = await feedbackStore.sourceReference(
        workspaceId,
        locator.sourceId as `product-loop-feedback_${string}`
      );
      if (source) return source;
      throw new Error('Requested Product-loop use feedback was not found in this Workspace.');
    }
    throw new Error(
      'This Lite runtime exposes only durable CONTENT_USE_FEEDBACK as a Product-loop source.'
    );
  }
};

const contentStore = new PostgresLiteContentPreparationStore(
  database,
  pool,
  productLoopSourceAuthority
);
const candidateStore = new PostgresLiteCandidateQualificationStore(
  database,
  pool,
  productLoopSourceAuthority,
  {
    isAccessible() {
      return Promise.reject(
        new Error(
          'Customer relationship mutation is not exposed through the WP-06 feedback runtime.'
        )
      );
    }
  }
);
const dataProspectingService = new DataProspectingService(
  new HttpDataEngineApplicantOwnerReader({
    ...(dataEngineUrl ? { dataEngineUrl } : {}),
    ...(dataEngineApiKey ? { apiKey: dataEngineApiKey } : {})
  }),
  candidateStore,
  outboundContactPolicyStore,
  managedCommunicationClientNotificationSender
);
const protectionMonitoringRepository = new PostgresProtectionMonitoringRepository(database, pool);
const protectionMonitoringService = new ProtectionMonitoringService(
  trademarkAssetStore,
  workspaceWatchStore,
  new HttpDataEngineApplicantOwnerReader({
    ...(dataEngineUrl ? { dataEngineUrl } : {}),
    ...(dataEngineApiKey ? { apiKey: dataEngineApiKey } : {})
  }),
  protectionMonitoringRepository,
  candidateStore
);
const preparedActionStore = new PostgresPreparedActionStore(database, pool);
const creatorPreferences = new PostgresProductPreferenceStore(database, pool);

async function postMarkReg<T>(
  path: string,
  workspaceId: string,
  idempotencyKey: string,
  body: unknown
): Promise<T> {
  const response = await fetch(`${markRegUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-markorbit-internal-authorization': internalServiceSecret,
      'x-markorbit-workspace-id': workspaceId,
      'idempotency-key': idempotencyKey
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      code?: string;
      message?: string;
    };
    throw new Error(
      `${payload.code ?? 'MARKREG_HANDOFF_FAILED'}: ${payload.message ?? 'MarkReg owner handoff failed.'}`
    );
  }
  return (await response.json()) as T;
}

const handoffAuthority: PreparedActionHandoffAuthority = {
  async perform(
    action: Readonly<PreparedAction>,
    plan: Readonly<PreparedActionPlan>,
    confirmation: Readonly<PreparedActionConfirmation>,
    idempotencyKey: string,
    principal?: Readonly<WorkspacePrincipal>
  ): Promise<Readonly<PreparedActionHandoffResult>> {
    if (plan.kind === 'PREPARE_CONTENT') {
      const opportunity = await contentStore.acceptContentOpportunity({
        workspaceId: action.workspaceId,
        recommendation: {
          id: action.recommendation.id,
          version: Number(action.recommendation.version)
        },
        expectedRecommendationFingerprintSha256: action.recommendationFingerprintSha256,
        title: plan.title,
        rationale: plan.rationale,
        idempotencyKey
      });
      return handoffResult({
        preparedAction: action,
        owner: 'LITE',
        ownerRecord: { id: opportunity.contentOpportunityId, version: opportunity.version },
        completedAt: opportunity.updatedAt
      });
    }
    if (plan.kind === 'PREPARE_CLIENT_NOTIFICATION')
      return clientNotificationHandoff.perform(
        action,
        plan,
        confirmation,
        idempotencyKey,
        principal
      );
    if (plan.kind === 'CREATE_FORMAL_TRADEMARK_SERVICE_OPPORTUNITY') {
      const response = await postMarkReg<{ formalOpportunity: FormalTrademarkServiceOpportunity }>(
        '/internal/v1/formal-opportunities',
        action.workspaceId,
        idempotencyKey,
        {
          candidate: plan.candidate,
          expectedCandidateFingerprintSha256: plan.expectedCandidateFingerprintSha256,
          qualificationDecision: plan.qualificationDecision,
          relationshipModel: plan.relationshipModel,
          ...(plan.proposedCustomerIntent
            ? { proposedCustomerIntent: plan.proposedCustomerIntent }
            : {}),
          promotedByPrincipalId: confirmation.confirmedByPrincipalId
        }
      );
      return handoffResult({
        preparedAction: action,
        owner: 'MARKREG',
        ownerRecord: {
          id: response.formalOpportunity.formalTrademarkServiceOpportunityId,
          version: response.formalOpportunity.version
        },
        completedAt: response.formalOpportunity.updatedAt
      });
    }
    const response = await postMarkReg<{
      handoff: MarkRegIntakeHandoff;
      currentFormalOpportunity: FormalTrademarkServiceOpportunity;
    }>(
      `/internal/v1/formal-opportunities/${encodeURIComponent(plan.formalOpportunity.id)}/intake-handoff`,
      action.workspaceId,
      idempotencyKey,
      {
        formalOpportunityVersion: plan.formalOpportunity.version,
        expectedFormalOpportunityFingerprintSha256: plan.expectedFormalOpportunityFingerprintSha256,
        relationshipModel: plan.relationshipModel,
        customerIntent: plan.customerIntent,
        confirmedByPrincipalId: confirmation.confirmedByPrincipalId
      }
    );
    return handoffResult({
      preparedAction: action,
      owner: 'MARKREG',
      ownerRecord: {
        id: response.currentFormalOpportunity.formalTrademarkServiceOpportunityId,
        version: response.currentFormalOpportunity.version
      },
      completedAt: response.handoff.confirmedAt
    });
  }
};

const journeyService = new PreparedActionJourneyService(preparedActionStore, handoffAuthority);
const clientNotificationFollowupService = new ClientNotificationFollowupService(
  preparedActionStore,
  managedCommunicationClientNotificationSender,
  communicationLinkService,
  liteWorkItemStore
);
const dailySignalReader = new PostgresDailySignalReader(pool);

const dailyOrbitService = new DailyOrbitService(
  dailySignalReader,
  journeyService,
  creatorPreferences,
  undefined,
  new PostgresDailyOrbitVisibilityProvider(pool)
);
const dailyWorkspaceSnapshotService = new DailyWorkspaceSnapshotService(
  dailyOrbitService,
  {
    async listToday(workspaceId) {
      const [snapshot, recentFeedback, feedbackPendingPackages] = await Promise.all([
        journeyService.listToday(workspaceId),
        feedbackStore.listRecent(workspaceId),
        feedbackStore.listPendingPackages(workspaceId)
      ]);
      return { ...snapshot, recentFeedback, feedbackPendingPackages };
    }
  },
  undefined,
  liteWorkItemStore
);
const visualBridgeStore = new PostgresVisualBridgeStore(database, pool);
const contentKitService = new ContentKitService(
  dailyOrbitService,
  new PostgresContentKitLifecycleReader(pool),
  creatorPreferences,
  visualBridgeStore
);
const preferenceService = new ProductPreferenceService(
  creatorPreferences,
  new DailyWorkspacePreferenceTargetResolver(
    dailyOrbitService,
    dailySignalReader,
    contentKitService,
    visualBridgeStore
  )
);
const visualBridgeService = new VisualBridgeService(
  contentKitService,
  visualBridgeStore,
  new UnavailableVisualEngineConsumer(),
  liteVisualStyleId
);
const tradingListingPublicationCurrentness = new TradingListingPublicationCurrentnessResolver(
  new PostgresTradingListingStore(database, pool),
  new PostgresTradingListingAssetStore(database, pool),
  new PostgresTradingMarketplaceTargetBindingStore(database, pool)
);
const runtime = createServiceRuntime(serviceManifest, {
  routes: [
    ...createLiteAdminRoutesV1({ internalServiceSecret }),
    ...createTradingListingPublicationCurrentnessRoutes({
      internalServiceSecret,
      resolver: tradingListingPublicationCurrentness
    }),
    ...createTradingStudioReadRoutes({
      internalServiceSecret,
      runs: tradingStudioRunStore,
      profiles: tradingAiProfileStore,
      brandDnas: new PostgresTradingBrandDnaStore(database, pool),
      directionSets: new PostgresTradingDirectionSetStore(database, pool),
      selections: new PostgresTradingDirectionSelectionStore(database, pool),
      aiProfileCheckpointFor: (principal) =>
        new TradingAiProfileCheckpointService(
          tradingStudioRunStore,
          trademarkAssetStore,
          tradingAiProfileStore,
          new TradingAiProfileGenerator(
            new HttpTradingManagedAiClient(capabilityEngineUrl, internalServiceSecret, principal)
          )
        )
    }),
    ...createContentStudioRoutes({
      internalServiceSecret,
      reader: new PostgresContentStudioReader(database),
      contentStore
    }),
    ...createDailyWorkspaceRoutes({
      internalServiceSecret,
      service: dailyWorkspaceSnapshotService
    }),
    ...createLiteWorkItemRoutes({
      internalServiceSecret,
      store: liteWorkItemStore
    }),
    ...createWorkspaceWatchRoutes({
      internalServiceSecret,
      store: workspaceWatchStore
    }),
    ...createWorkspaceDirectoryRoutes({
      internalServiceSecret,
      store: workspaceDirectoryStore
    }),
    ...createOutboundContactPolicyRoutes({
      internalServiceSecret,
      store: outboundContactPolicyStore
    }),
    ...createBusinessAttributionRoutes({
      internalServiceSecret,
      store: businessAttributionStore,
      contentLedDemandService
    }),
    ...createPartnerIntelligenceRoutes({
      internalServiceSecret,
      service: partnerIntelligenceService,
      store: partnerIntelligenceStore
    }),
    ...createPartnerReferralRoutes({
      internalServiceSecret,
      service: partnerReferralService
    }),
    ...createEducationCommunityRoutes({
      internalServiceSecret,
      service: educationCommunityService
    }),
    ...createAgencyLineageRoutes({ internalServiceSecret, service: agencyLineage }),
    ...createDiscoveredTrademarkAdmissionRoutes({
      internalServiceSecret,
      service: discoveredTrademarkAdmission
    }),
    ...createDataProspectingRoutes({
      internalServiceSecret,
      service: dataProspectingService
    }),
    ...createProtectionMonitoringRoutes({
      internalServiceSecret,
      service: protectionMonitoringService
    }),
    ...createCommunicationLinkRoutes({
      internalServiceSecret,
      service: communicationLinkService
    }),
    ...createClientNotificationFollowupRoutes({
      internalServiceSecret,
      service: clientNotificationFollowupService
    }),
    ...createLiteIntakeStagingRoutes({
      internalServiceSecret,
      service: liteIntakeStagingService
    }),
    ...createLiteProductLoopRoutes({
      internalServiceSecret,
      journeyService,
      candidateStore,
      feedbackStore,
      analyticsStore,
      dailySignalStore,
      dailyOrbitService,
      useFeedbackPreferenceRecorder: preferenceService
    }),
    ...createTrademarkAssetMigrationRoutes({
      internalServiceSecret,
      service: trademarkAssetMigration
    }),
    ...createTrademarkAssetReadRoutes({
      internalServiceSecret,
      assets: trademarkAssetStore,
      aiGuide: trademarkAssetAiGuide,
      commerce: trademarkAssetCommerceStore,
      dispositions: trademarkAssetManagementDispositions,
      portfolio: trademarkAssetPortfolio,
      refreshLedger: trademarkAssetRefreshLedger
    }),
    ...createTrademarkServiceWorkbenchRoutes({
      internalServiceSecret,
      workPackages: trademarkServiceWorkPackages,
      query: pool
    }),
    ...createContentKitRoutes({ internalServiceSecret, contentKitService }),
    ...createProductPreferenceRoutes({ internalServiceSecret, service: preferenceService }),
    ...createVisualBridgeRoutes({
      internalServiceSecret,
      visualBridgeService,
      visualBridgeStore
    })
  ]
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
