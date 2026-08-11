import type {
  FormalTrademarkServiceOpportunity,
  MarkRegIntakeHandoff,
  PreparedAction,
  PreparedActionConfirmation,
  PreparedActionHandoffResult
} from '@markorbit/contracts/product-loop';
import { createServiceRuntime } from '@markorbit/service-kit';
import { PostgresLiteCandidateQualificationStore } from './candidate-qualification.js';
import {
  PostgresLiteContentPreparationStore,
  type ProductLoopSourceAuthority
} from './content-preparation.js';
import { createLiteProductLoopRoutes } from './http.js';
import {
  handoffResult,
  PostgresPreparedActionStore,
  PreparedActionJourneyService,
  type PreparedActionHandoffAuthority,
  type PreparedActionPlan
} from './prepared-action.js';

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

const unavailableSourceAuthority: ProductLoopSourceAuthority = {
  async resolve() {
    throw new Error(
      'Upstream Product-loop source creation is not exposed through the WP-05 browser runtime.'
    );
  }
};

const contentStore = new PostgresLiteContentPreparationStore(
  database,
  pool,
  unavailableSourceAuthority
);
const candidateStore = new PostgresLiteCandidateQualificationStore(
  database,
  pool,
  unavailableSourceAuthority,
  {
    async isAccessible() {
      throw new Error(
        'Customer relationship mutation is not exposed through the WP-05 browser runtime.'
      );
    }
  }
);
const preparedActionStore = new PostgresPreparedActionStore(database, pool);

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
        expectedFormalOpportunityFingerprintSha256:
          plan.expectedFormalOpportunityFingerprintSha256,
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
const runtime = createServiceRuntime(serviceManifest, {
  routes: createLiteProductLoopRoutes({
    internalServiceSecret,
    journeyService,
    candidateStore
  })
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
