import type {
  FormalTrademarkServiceOpportunity,
  MarkRegIntakeHandoff,
  PreparedAction,
  PreparedActionConfirmation,
  PreparedActionHandoffResult
} from '@markorbit/contracts/product-loop';
import { createServiceRuntime } from '@markorbit/service-kit';
import { PostgresLiteCandidateQualificationStore } from './candidate-qualification.js';
import { ContentKitService, PostgresContentKitLifecycleReader } from './content-kit.js';
import { createContentKitRoutes } from './content-kit-http.js';
import {
  PostgresLiteContentPreparationStore,
  type ProductLoopSourceAuthority
} from './content-preparation.js';
import { PostgresProductConversionAnalyticsStore } from './conversion-analytics.js';
import { DailyOrbitService, PostgresDailySignalReader } from './daily-orbit.js';
import {
  HttpCoreDailyKnowledgeSourceAuthority,
  PostgresLiteDailySignalStore
} from './daily-signal.js';
import { PostgresProductLoopFeedbackStore } from './feedback.js';
import { createLiteProductLoopRoutes } from './http.js';
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
const coreUrl = process.env.CORE_URL ?? 'http://127.0.0.1:4101';
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
const trademarkAssetPortfolio = new TrademarkAssetPortfolioService(pool, trademarkAssetStore);
const trademarkAssetRefreshLedger = new PostgresTrademarkAssetRefreshLedger(database, pool);

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
    idempotencyKey: string
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
const dailySignalReader = new PostgresDailySignalReader(pool);
const dailyOrbitService = new DailyOrbitService(
  dailySignalReader,
  journeyService,
  creatorPreferences
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
const runtime = createServiceRuntime(serviceManifest, {
  routes: [
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
    ...createTrademarkAssetReadRoutes({
      internalServiceSecret,
      assets: trademarkAssetStore,
      portfolio: trademarkAssetPortfolio,
      refreshLedger: trademarkAssetRefreshLedger
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
