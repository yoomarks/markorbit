import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type {
  FormalTrademarkServiceOpportunity,
  MarkRegIntakeHandoff,
  ProductLoopFeedbackId,
  ProductLoopSourceReference,
  ProductLoopUseFeedback
} from '@markorbit/contracts/product-loop';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import { createServiceRuntime } from '@markorbit/service-kit';
import {
  PostgresLiteCandidateQualificationStore,
  type ProductLoopCustomerRelationshipAuthority
} from '../services/lite/src/candidate-qualification.js';
import {
  PostgresLiteContentPreparationStore,
  type ProductLoopSourceAuthority
} from '../services/lite/src/content-preparation.js';
import { PostgresProductLoopFeedbackStore } from '../services/lite/src/feedback.js';
import { createLiteProductLoopRoutes } from '../services/lite/src/http.js';
import {
  PostgresPreparedActionStore,
  PreparedActionJourneyService,
  type PreparedActionHandoffAuthority
} from '../services/lite/src/prepared-action.js';
import {
  createMarkRegFormalOpportunityRoutes,
  HttpQualifiedOpportunityAuthority
} from '../services/markreg/src/formal-opportunity-http.js';
import { PostgresFormalOpportunityStore } from '../services/markreg/src/formal-opportunity.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from '../services/markreg/tests/support/markreg-test-database.js';

const liteUrl = process.env.LITE_PRODUCT_LOOP_CLOSURE_TEST_DATABASE_URL;
const markregUrl = process.env.MARKREG_PRODUCT_LOOP_CLOSURE_TEST_DATABASE_URL;
const required = process.env.PRODUCT_LOOP_CLOSURE_RELIABILITY_REQUIRED === '1';
if (required && (!liteUrl || !markregUrl))
  throw new Error(
    'LITE_PRODUCT_LOOP_CLOSURE_TEST_DATABASE_URL and MARKREG_PRODUCT_LOOP_CLOSURE_TEST_DATABASE_URL are required when PRODUCT_LOOP_CLOSURE_RELIABILITY_REQUIRED=1.'
  );
const suite = liteUrl && markregUrl ? describe : describe.skip;

const workspaceId = '41414141-4141-4414-8414-414141414141';
const otherWorkspaceId = '42424242-4242-4424-8424-424242424242';
const customerId = 'customer_wp07-acme' as const;
const otherCustomerId = 'customer_wp07-other' as const;
const internalSecret = 'plc-wp07-internal-service-secret-32-bytes';
const litePort = 4481;
const markregPort = 4482;
const liteRuntimeUrl = `http://127.0.0.1:${litePort}`;
const markregRuntimeUrl = `http://127.0.0.1:${markregPort}`;
const migrationsDirectory = path.resolve('infrastructure/persistence/migrations');
const migrationOwners = path.resolve('infrastructure/persistence/migration-owners.json');
const knowledgeSource: ProductLoopSourceReference = {
  schemaVersion: 1,
  owner: 'KNOWLEDGE',
  kind: 'KNOWLEDGE_READY_PACKAGE',
  sourceId: 'rdp_wp07-accepted-knowledge',
  sourceVersion: 'accepted-v7',
  sourceFingerprintSha256: '7'.repeat(64),
  observedAt: '2026-08-11T15:00:00.000Z',
  correlationId: 'correlation_wp07-product-loop'
};

suite('PLC-WP-07 Product-loop closure reliability', () => {
  const liteDatabase = new ManagedDatabase({
    connection: { url: liteUrl! },
    applicationName: 'plc-wp07-lite',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'plc_wp07_lite'
  });
  const markregDatabase = new ManagedDatabase({
    connection: { url: markregUrl! },
    applicationName: 'plc-wp07-markreg',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: MARKREG_TEST_MIGRATION_NAMESPACE
  });

  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 7, 11, 15, 1, tick++)).toISOString();
  let liteRuntime: ReturnType<typeof createServiceRuntime> | undefined;
  let markregRuntime: ReturnType<typeof createServiceRuntime> | undefined;

  const customerAuthority: ProductLoopCustomerRelationshipAuthority = {
    isAccessible(requestWorkspaceId, requestedCustomerId) {
      return Promise.resolve(
        requestWorkspaceId === workspaceId && requestedCustomerId === customerId
      );
    }
  };

  function createLiteStores() {
    let feedbackStore!: PostgresProductLoopFeedbackStore;
    const sourceAuthority: ProductLoopSourceAuthority = {
      async resolve(requestWorkspaceId, locator) {
        if (![workspaceId, otherWorkspaceId].includes(requestWorkspaceId))
          throw new Error('Unexpected Workspace in WP-07 source resolution.');
        if (
          locator.owner === 'KNOWLEDGE' &&
          locator.kind === 'KNOWLEDGE_READY_PACKAGE' &&
          locator.sourceId === knowledgeSource.sourceId
        )
          return structuredClone(knowledgeSource);
        if (locator.owner === 'LITE' && locator.kind === 'CONTENT_USE_FEEDBACK') {
          const resolved = await feedbackStore.sourceReference(
            requestWorkspaceId,
            locator.sourceId as ProductLoopFeedbackId
          );
          if (resolved) return resolved;
        }
        throw new Error('Exact Product-loop source was not found in its owning Lite boundary.');
      }
    };
    const contentStore = new PostgresLiteContentPreparationStore(
      liteDatabase,
      liteDatabase.getPool(),
      sourceAuthority,
      now
    );
    feedbackStore = new PostgresProductLoopFeedbackStore(liteDatabase, liteDatabase.getPool(), now);
    const candidateStore = new PostgresLiteCandidateQualificationStore(
      liteDatabase,
      liteDatabase.getPool(),
      sourceAuthority,
      customerAuthority,
      now
    );
    const preparedStore = new PostgresPreparedActionStore(
      liteDatabase,
      liteDatabase.getPool(),
      now
    );
    const unusedHandoffAuthority: PreparedActionHandoffAuthority = {
      perform() {
        return Promise.reject(
          new Error('WP-07 owner-resolution runtime does not execute Prepared Action handoffs.')
        );
      }
    };
    return {
      contentStore,
      feedbackStore,
      candidateStore,
      journeyService: new PreparedActionJourneyService(preparedStore, unusedHandoffAuthority)
    };
  }

  function createMarkRegStore() {
    return new PostgresFormalOpportunityStore(
      markregDatabase,
      markregDatabase.getPool(),
      new HttpQualifiedOpportunityAuthority(liteRuntimeUrl, internalSecret),
      now
    );
  }

  async function startRuntimes(liteStores: ReturnType<typeof createLiteStores>) {
    liteRuntime = createServiceRuntime(
      { name: 'plc-wp07-lite', port: litePort, version: '0.1.0' },
      {
        routes: createLiteProductLoopRoutes({
          internalServiceSecret: internalSecret,
          journeyService: liteStores.journeyService,
          candidateStore: liteStores.candidateStore,
          feedbackStore: liteStores.feedbackStore
        })
      }
    );
    await liteRuntime.start();
    const markregStore = createMarkRegStore();
    markregRuntime = createServiceRuntime(
      { name: 'plc-wp07-markreg', port: markregPort, version: '0.1.0' },
      {
        routes: createMarkRegFormalOpportunityRoutes({
          internalServiceSecret: internalSecret,
          store: markregStore
        })
      }
    );
    await markregRuntime.start();
    return markregStore;
  }

  async function stopRuntimes() {
    await markregRuntime?.stop();
    markregRuntime = undefined;
    await liteRuntime?.stop();
    liteRuntime = undefined;
  }

  async function internalPost(
    url: string,
    body: Readonly<Record<string, unknown>>,
    idempotencyKey: string,
    requestWorkspaceId = workspaceId
  ) {
    return fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-markorbit-internal-authorization': internalSecret,
        'x-markorbit-workspace-id': requestWorkspaceId,
        'idempotency-key': idempotencyKey
      },
      body: JSON.stringify(body)
    });
  }

  beforeAll(async () => {
    await liteDatabase.start();
    await markregDatabase.start();
    await liteDatabase
      .getPool()
      .query(
        'CREATE TABLE IF NOT EXISTS workspaces (workspace_id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE)'
      );
    await migrate(
      liteDatabase.getPool(),
      'plc_wp07_lite',
      await loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/lite-service')
    );
    await liteDatabase.getPool().query(
      `INSERT INTO workspaces(workspace_id,name,slug) VALUES
       ($1,'PLC WP07','plc-wp07'),
       ($2,'PLC WP07 Other','plc-wp07-other')
       ON CONFLICT(workspace_id) DO NOTHING`,
      [workspaceId, otherWorkspaceId]
    );
    await resetAndMigrateMarkRegTestDatabase({
      pool: markregDatabase.getPool(),
      migrationsDirectory,
      migrationOwners
    });
  });

  beforeEach(async () => {
    tick = 0;
    await stopRuntimes();
    await liteDatabase.getPool().query(
      `TRUNCATE
       lite_product_loop_feedback_commands,
       lite_product_loop_use_feedback,
       lite_candidate_qualification_commands,
       lite_opportunity_qualification_decisions,
       lite_opportunity_candidates,
       lite_prepared_action_commands,
       lite_prepared_action_handoff_results,
       lite_prepared_action_confirmations,
       lite_prepared_actions,
       lite_content_preparation_commands,
       lite_publish_packages,
       lite_content_review_decisions,
       lite_content_drafts,
       lite_content_opportunities,
       lite_today_recommendations
       CASCADE`
    );
    await markregDatabase
      .getPool()
      .query(
        'TRUNCATE markreg_formal_opportunity_commands,markreg_intake_handoffs,markreg_formal_trademark_service_opportunities CASCADE'
      );
  });

  afterAll(async () => {
    await stopRuntimes();
    await Promise.all([liteDatabase.close(), markregDatabase.close()]);
  });

  it('preserves exact Content -> feedback -> Candidate -> MarkReg handoff provenance across owner runtime restart', async () => {
    const firstLite = createLiteStores();
    const recommendation = await firstLite.contentStore.createRecommendation({
      workspaceId,
      title: 'Explain the reviewed Canada filing signal',
      explanation: 'Accepted Knowledge supports one bounded client-facing explanation.',
      sources: [
        {
          owner: 'KNOWLEDGE',
          kind: 'KNOWLEDGE_READY_PACKAGE',
          sourceId: knowledgeSource.sourceId
        }
      ],
      idempotencyKey: 'wp07-recommendation'
    });
    expect(recommendation.sources).toEqual([knowledgeSource]);

    const contentOpportunity = await firstLite.contentStore.acceptContentOpportunity({
      workspaceId,
      recommendation: {
        id: recommendation.todayRecommendationId,
        version: recommendation.version
      },
      expectedRecommendationFingerprintSha256: recommendation.recommendationFingerprintSha256,
      title: 'Prepare a Canada filing explainer',
      rationale: 'Use only the exact accepted Knowledge source.',
      idempotencyKey: 'wp07-content-opportunity'
    });
    const draft = await firstLite.contentStore.createDraft({
      workspaceId,
      contentOpportunity: {
        id: contentOpportunity.contentOpportunityId,
        version: contentOpportunity.version
      },
      expectedContentOpportunityFingerprintSha256:
        contentOpportunity.contentOpportunityFingerprintSha256,
      title: 'Canada trademark filing: reviewed next step',
      body: 'A reviewed explanation prepared from the accepted source.',
      idempotencyKey: 'wp07-draft'
    });
    const ready = await firstLite.contentStore.markDraftReadyForReview({
      workspaceId,
      contentDraftId: draft.contentDraftId,
      expectedVersion: draft.version,
      expectedContentDraftFingerprintSha256: draft.contentDraftFingerprintSha256,
      idempotencyKey: 'wp07-ready'
    });
    const review = await firstLite.contentStore.recordReview({
      workspaceId,
      contentDraft: { id: ready.contentDraftId, version: ready.version },
      expectedContentDraftFingerprintSha256: ready.contentDraftFingerprintSha256,
      outcome: 'APPROVED_FOR_PUBLISH_PACKAGE',
      reviewerPrincipalId: 'user_wp07-reviewer',
      rationale: 'Human review approved a manual-use package only.',
      idempotencyKey: 'wp07-review'
    });
    const publishPackage = await firstLite.contentStore.preparePublishPackage({
      workspaceId,
      contentDraft: { id: ready.contentDraftId, version: ready.version },
      expectedContentDraftFingerprintSha256: ready.contentDraftFingerprintSha256,
      reviewDecision: { id: review.contentReviewDecisionId, version: review.version },
      idempotencyKey: 'wp07-publish-package'
    });
    expect(publishPackage.externalPublishExecuted).toBe(false);

    const feedback = await firstLite.feedbackStore.recordUseFeedback({
      workspaceId,
      publishPackage: { id: publishPackage.publishPackageId, version: publishPackage.version },
      expectedPublishPackageFingerprintSha256: publishPackage.publishPackageFingerprintSha256,
      outcome: 'USER_REPORTED_USED',
      externalReference: 'manual-client-follow-up-001',
      recordedByPrincipalId: 'user_wp07-feedback',
      idempotencyKey: 'wp07-feedback'
    });
    expect(feedback.externalActionExecutedByMarkOrbit).toBe(false);
    expect(feedback.externalOutcomeVerifiedByMarkOrbit).toBe(false);
    const feedbackSource = await firstLite.feedbackStore.sourceReference(
      workspaceId,
      feedback.productLoopFeedbackId
    );
    expect(feedbackSource).toMatchObject({
      owner: 'LITE',
      kind: 'CONTENT_USE_FEEDBACK',
      sourceId: feedback.productLoopFeedbackId,
      sourceVersion: 1
    });

    const candidate = await firstLite.candidateStore.createCandidate({
      workspaceId,
      customerId,
      title: 'Possible Canada filing need',
      serviceNeedSummary:
        'The manually reported use of reviewed content exposed a specific Canada filing need.',
      sources: [
        {
          owner: 'LITE',
          kind: 'CONTENT_USE_FEEDBACK',
          sourceId: feedback.productLoopFeedbackId
        }
      ],
      idempotencyKey: 'wp07-candidate'
    });
    expect(candidate.sources).toEqual([feedbackSource]);
    expect(candidate.formalOpportunityCreated).toBe(false);

    const qualification = await firstLite.candidateStore.recordQualification({
      workspaceId,
      candidate: { id: candidate.opportunityCandidateId, version: candidate.version },
      expectedCandidateFingerprintSha256: candidate.opportunityCandidateFingerprintSha256,
      outcome: 'QUALIFIED_FOR_MARKREG',
      decidedByPrincipalId: 'user_wp07-qualifier',
      rationale: 'Human review confirmed a concrete MarkReg service need.',
      idempotencyKey: 'wp07-qualification'
    });
    expect(qualification.decision.formalOpportunityCreated).toBe(false);

    let markregStore = await startRuntimes(firstLite);
    const formalBody = {
      candidate: { id: candidate.opportunityCandidateId, version: candidate.version },
      expectedCandidateFingerprintSha256: candidate.opportunityCandidateFingerprintSha256,
      qualificationDecision: {
        id: qualification.decision.opportunityQualificationDecisionId,
        version: qualification.decision.version
      },
      relationshipModel: 'CO_DELIVERY',
      proposedCustomerIntent: {
        brandName: 'ORBIT',
        applicantCountry: 'CN',
        targetJurisdictions: ['CA'],
        goodsServicesDescription: 'Downloadable software and SaaS services.'
      },
      promotedByPrincipalId: 'user_wp07-promoter'
    } as const;
    const formalResponse = await internalPost(
      `${markregRuntimeUrl}/internal/v1/formal-opportunities`,
      formalBody,
      'wp07-formal-opportunity'
    );
    expect(formalResponse.status).toBe(201);
    const formalPayload = (await formalResponse.json()) as {
      formalOpportunity: FormalTrademarkServiceOpportunity;
    };
    const formalOpportunity = formalPayload.formalOpportunity;
    expect(formalOpportunity.sourceCandidate).toEqual({
      id: candidate.opportunityCandidateId,
      version: candidate.version
    });
    expect(formalOpportunity.sourceQualificationDecision).toEqual({
      id: qualification.decision.opportunityQualificationDecisionId,
      version: qualification.decision.version
    });
    expect(formalOpportunity.orderCreated).toBe(false);
    expect(formalOpportunity.matterCreated).toBe(false);
    expect(formalOpportunity.paymentCreated).toBe(false);
    expect(formalOpportunity.filingSubmitted).toBe(false);

    const intakeBody = {
      formalOpportunityVersion: formalOpportunity.version,
      expectedFormalOpportunityFingerprintSha256:
        formalOpportunity.formalOpportunityFingerprintSha256,
      relationshipModel: formalOpportunity.relationshipModel,
      customerIntent: formalBody.proposedCustomerIntent,
      confirmedByPrincipalId: 'user_wp07-handoff'
    } as const;
    const intakeResponse = await internalPost(
      `${markregRuntimeUrl}/internal/v1/formal-opportunities/${formalOpportunity.formalTrademarkServiceOpportunityId}/intake-handoff`,
      intakeBody,
      'wp07-intake-handoff'
    );
    expect(intakeResponse.status).toBe(200);
    const intakePayload = (await intakeResponse.json()) as {
      handoff: MarkRegIntakeHandoff;
      currentFormalOpportunity: FormalTrademarkServiceOpportunity;
    };
    expect(intakePayload.handoff.intakeCreated).toBe(false);
    expect(intakePayload.handoff.orderCreated).toBe(false);
    expect(intakePayload.handoff.matterCreated).toBe(false);
    expect(intakePayload.currentFormalOpportunity.status).toBe('HANDED_OFF_TO_INTAKE');

    await stopRuntimes();

    const restartedLite = createLiteStores();
    markregStore = await startRuntimes(restartedLite);
    expect(
      await restartedLite.feedbackStore.findByPackage(
        workspaceId,
        publishPackage.publishPackageId,
        publishPackage.version
      )
    ).toEqual(feedback);
    expect(
      await restartedLite.candidateStore.findQualificationDecision(
        workspaceId,
        candidate.opportunityCandidateId
      )
    ).toEqual(qualification.decision);
    expect(
      await markregStore.findLatestFormalOpportunity(
        workspaceId,
        formalOpportunity.formalTrademarkServiceOpportunityId
      )
    ).toEqual(intakePayload.currentFormalOpportunity);

    const replayFormal = await internalPost(
      `${markregRuntimeUrl}/internal/v1/formal-opportunities`,
      formalBody,
      'wp07-formal-opportunity'
    );
    expect(replayFormal.status).toBe(201);
    expect(
      (await replayFormal.json()) as { formalOpportunity: FormalTrademarkServiceOpportunity }
    ).toEqual({ formalOpportunity });

    const replayHandoff = await internalPost(
      `${markregRuntimeUrl}/internal/v1/formal-opportunities/${formalOpportunity.formalTrademarkServiceOpportunityId}/intake-handoff`,
      intakeBody,
      'wp07-intake-handoff'
    );
    expect(replayHandoff.status).toBe(200);
    expect(
      (await replayHandoff.json()) as {
        handoff: MarkRegIntakeHandoff;
        currentFormalOpportunity: FormalTrademarkServiceOpportunity;
      }
    ).toEqual(intakePayload);

    expect(
      await restartedLite.feedbackStore.findByPackage(
        otherWorkspaceId,
        publishPackage.publishPackageId,
        publishPackage.version
      )
    ).toBeUndefined();
    expect(
      await restartedLite.candidateStore.findLatestCandidate(
        otherWorkspaceId,
        candidate.opportunityCandidateId
      )
    ).toBeUndefined();
    expect(
      await markregStore.findLatestFormalOpportunity(
        otherWorkspaceId,
        formalOpportunity.formalTrademarkServiceOpportunityId
      )
    ).toBeUndefined();

    await expect(
      restartedLite.candidateStore.createCandidate({
        workspaceId,
        customerId: otherCustomerId,
        title: 'Cross-customer candidate',
        serviceNeedSummary: 'This must remain blocked by the relationship authority.',
        sources: [
          {
            owner: 'LITE',
            kind: 'CONTENT_USE_FEEDBACK',
            sourceId: feedback.productLoopFeedbackId
          }
        ],
        idempotencyKey: 'wp07-cross-customer'
      })
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });

    const crossWorkspaceFormal = await internalPost(
      `${markregRuntimeUrl}/internal/v1/formal-opportunities`,
      formalBody,
      'wp07-cross-workspace-formal',
      otherWorkspaceId
    );
    expect(crossWorkspaceFormal.status).not.toBe(201);
  });
});
