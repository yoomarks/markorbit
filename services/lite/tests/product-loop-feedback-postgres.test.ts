import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import type {
  ContentOpportunityId,
  ProductLoopFeedbackId,
  ProductLoopSourceReference,
  PublishPackageId,
  TodayRecommendationId
} from '@markorbit/contracts/product-loop';
import {
  PostgresLiteContentPreparationStore,
  type ProductLoopSourceAuthority
} from '../src/content-preparation.js';
import { PostgresProductLoopFeedbackStore, ProductLoopFeedbackError } from '../src/feedback.js';

const url = process.env.LITE_FEEDBACK_TEST_DATABASE_URL;
const required = process.env.LITE_FEEDBACK_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'LITE_FEEDBACK_TEST_DATABASE_URL is required when LITE_FEEDBACK_POSTGRES_TEST_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const workspaceId = '27272727-2727-4272-8272-272727272727';
const otherWorkspaceId = '28282828-2828-4282-8282-282828282828';
const principalId = '11111111-1111-4111-8111-111111111111';
const sourceFingerprint = 'c'.repeat(64);

function sequence<T extends string>(prefix: string) {
  let value = 0;
  return () => `${prefix}_${++value}` as T;
}

suite('PostgreSQL Lite Product-loop feedback', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-product-loop-feedback-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_feedback_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  const source: ProductLoopSourceReference = {
    schemaVersion: 1,
    owner: 'KNOWLEDGE',
    kind: 'KNOWLEDGE_READY_PACKAGE',
    sourceId: 'rdp_wp06-feedback',
    sourceVersion: 'accepted-v1',
    sourceFingerprintSha256: sourceFingerprint,
    observedAt: '2026-08-11T14:00:00.000Z',
    correlationId: 'correlation_wp06-feedback'
  };
  const sourceAuthority: ProductLoopSourceAuthority = {
    resolve(requestWorkspaceId, locator) {
      if (![workspaceId, otherWorkspaceId].includes(requestWorkspaceId))
        throw new Error('unexpected workspace');
      if (
        locator.owner !== source.owner ||
        locator.kind !== source.kind ||
        locator.sourceId !== source.sourceId
      )
        throw new Error('unexpected source locator');
      return Promise.resolve(structuredClone(source));
    }
  };
  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 7, 11, 14, 1, tick++)).toISOString();
  const contentIds = {
    recommendation: sequence<TodayRecommendationId>('today-recommendation'),
    opportunity: sequence<ContentOpportunityId>('content-opportunity'),
    draft: sequence<`content-draft_${string}`>('content-draft'),
    review: sequence<`content-review-decision_${string}`>('content-review-decision'),
    publishPackage: sequence<PublishPackageId>('publish-package')
  };
  const feedbackId = sequence<ProductLoopFeedbackId>('product-loop-feedback');

  const contentStore = () =>
    new PostgresLiteContentPreparationStore(
      database,
      database.getPool(),
      sourceAuthority,
      now,
      contentIds
    );
  const feedbackStore = () =>
    new PostgresProductLoopFeedbackStore(database, database.getPool(), now, feedbackId);

  beforeAll(async () => {
    await database.start();
    await database
      .getPool()
      .query(
        'CREATE TABLE IF NOT EXISTS workspaces (workspace_id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE)'
      );
    const liteMigrations = await loadMigrationsForOwner(
      migrationsDirectory,
      migrationOwners,
      '@markorbit/lite-service'
    );
    await migrate(database.getPool(), 'lite_feedback_test', liteMigrations);
    await database.getPool().query(
      `INSERT INTO workspaces (workspace_id,name,slug) VALUES
       ($1,'WP06 Feedback','wp06-feedback'),
       ($2,'WP06 Other','wp06-other')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceId, otherWorkspaceId]
    );
  });

  beforeEach(async () => {
    tick = 0;
    await database.getPool().query(
      `TRUNCATE
        lite_product_loop_feedback_commands,
        lite_product_loop_use_feedback,
        lite_content_preparation_commands,
        lite_publish_packages,
        lite_content_review_decisions,
        lite_content_drafts,
        lite_content_opportunities,
        lite_today_recommendations
       CASCADE`
    );
  });

  afterAll(() => database.close());

  async function preparedPackage(requestWorkspaceId = workspaceId) {
    const store = contentStore();
    const recommendation = await store.createRecommendation({
      workspaceId: requestWorkspaceId,
      title: 'Explain a reviewed maintenance change',
      explanation: 'Prepare one bounded professional content package.',
      sources: [{ owner: source.owner, kind: source.kind, sourceId: source.sourceId }],
      idempotencyKey: `${requestWorkspaceId}:recommendation`
    });
    const opportunity = await store.acceptContentOpportunity({
      workspaceId: requestWorkspaceId,
      recommendation: { id: recommendation.todayRecommendationId, version: recommendation.version },
      expectedRecommendationFingerprintSha256: recommendation.recommendationFingerprintSha256,
      title: recommendation.title,
      rationale: recommendation.explanation,
      idempotencyKey: `${requestWorkspaceId}:opportunity`
    });
    const draft = await store.createDraft({
      workspaceId: requestWorkspaceId,
      contentOpportunity: { id: opportunity.contentOpportunityId, version: opportunity.version },
      expectedContentOpportunityFingerprintSha256: opportunity.contentOpportunityFingerprintSha256,
      title: 'Maintenance change explainer',
      body: 'Reviewed professional content body.',
      idempotencyKey: `${requestWorkspaceId}:draft`
    });
    const ready = await store.markDraftReadyForReview({
      workspaceId: requestWorkspaceId,
      contentDraftId: draft.contentDraftId,
      expectedVersion: draft.version,
      expectedContentDraftFingerprintSha256: draft.contentDraftFingerprintSha256,
      idempotencyKey: `${requestWorkspaceId}:ready`
    });
    const review = await store.recordReview({
      workspaceId: requestWorkspaceId,
      contentDraft: { id: ready.contentDraftId, version: ready.version },
      expectedContentDraftFingerprintSha256: ready.contentDraftFingerprintSha256,
      outcome: 'APPROVED_FOR_PUBLISH_PACKAGE',
      reviewerPrincipalId: principalId,
      rationale: 'Exact draft reviewed and approved for package preparation only.',
      idempotencyKey: `${requestWorkspaceId}:review`
    });
    return store.preparePublishPackage({
      workspaceId: requestWorkspaceId,
      contentDraft: { id: ready.contentDraftId, version: ready.version },
      expectedContentDraftFingerprintSha256: ready.contentDraftFingerprintSha256,
      reviewDecision: { id: review.contentReviewDecisionId, version: review.version },
      idempotencyKey: `${requestWorkspaceId}:package`
    });
  }

  it('persists one manual use report, replays exactly and exposes stable CONTENT_USE_FEEDBACK provenance', async () => {
    const publishPackage = await preparedPackage();
    const store = feedbackStore();
    expect(await store.listPendingPackages(workspaceId)).toEqual([publishPackage]);
    const command = {
      workspaceId,
      publishPackage: { id: publishPackage.publishPackageId, version: publishPackage.version },
      expectedPublishPackageFingerprintSha256: publishPackage.publishPackageFingerprintSha256,
      outcome: 'USER_REPORTED_PUBLISHED' as const,
      externalReference: 'https://example.test/manual-publication/42',
      recordedByPrincipalId: principalId,
      idempotencyKey: 'wp06-feedback-record'
    };

    const feedback = await store.recordUseFeedback(command);
    expect(feedback).toMatchObject({
      workspaceId,
      version: 1,
      outcome: 'USER_REPORTED_PUBLISHED',
      recordedByPrincipalId: principalId,
      externalActionExecutedByMarkOrbit: false,
      externalOutcomeVerifiedByMarkOrbit: false
    });
    expect(await store.recordUseFeedback(command)).toEqual(feedback);

    const afterRestart = feedbackStore();
    expect(await afterRestart.findByPackage(workspaceId, publishPackage.publishPackageId)).toEqual(
      feedback
    );
    expect(await afterRestart.listRecent(workspaceId)).toEqual([feedback]);
    expect(await afterRestart.listPendingPackages(workspaceId)).toEqual([]);
    expect(
      await afterRestart.sourceReference(workspaceId, feedback.productLoopFeedbackId)
    ).toMatchObject({
      owner: 'LITE',
      kind: 'CONTENT_USE_FEEDBACK',
      sourceId: feedback.productLoopFeedbackId,
      sourceVersion: 1,
      observedAt: feedback.recordedAt
    });
  });

  it('fails closed on stale package fingerprint, conflicting replay and a second report for the same package', async () => {
    const publishPackage = await preparedPackage();
    const store = feedbackStore();
    await expect(
      store.recordUseFeedback({
        workspaceId,
        publishPackage: { id: publishPackage.publishPackageId, version: 1 },
        expectedPublishPackageFingerprintSha256: 'd'.repeat(64),
        outcome: 'USER_REPORTED_USED',
        recordedByPrincipalId: principalId,
        idempotencyKey: 'wp06-stale'
      })
    ).rejects.toMatchObject({ code: 'SOURCE_FINGERPRINT_MISMATCH' });

    const first = await store.recordUseFeedback({
      workspaceId,
      publishPackage: { id: publishPackage.publishPackageId, version: 1 },
      expectedPublishPackageFingerprintSha256: publishPackage.publishPackageFingerprintSha256,
      outcome: 'USER_REPORTED_USED',
      recordedByPrincipalId: principalId,
      idempotencyKey: 'wp06-first'
    });
    expect(first.outcome).toBe('USER_REPORTED_USED');

    await expect(
      store.recordUseFeedback({
        workspaceId,
        publishPackage: { id: publishPackage.publishPackageId, version: 1 },
        expectedPublishPackageFingerprintSha256: publishPackage.publishPackageFingerprintSha256,
        outcome: 'NOT_USED',
        recordedByPrincipalId: principalId,
        idempotencyKey: 'wp06-second'
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });

    await expect(
      store.recordUseFeedback({
        workspaceId,
        publishPackage: { id: publishPackage.publishPackageId, version: 1 },
        expectedPublishPackageFingerprintSha256: publishPackage.publishPackageFingerprintSha256,
        outcome: 'NOT_USED',
        recordedByPrincipalId: principalId,
        idempotencyKey: 'wp06-first'
      })
    ).rejects.toBeInstanceOf(ProductLoopFeedbackError);
  });

  it('isolates package and feedback evidence by Workspace', async () => {
    const publishPackage = await preparedPackage();
    const store = feedbackStore();
    await store.recordUseFeedback({
      workspaceId,
      publishPackage: { id: publishPackage.publishPackageId, version: 1 },
      expectedPublishPackageFingerprintSha256: publishPackage.publishPackageFingerprintSha256,
      outcome: 'USER_REPORTED_DELIVERED',
      recordedByPrincipalId: principalId,
      idempotencyKey: 'wp06-isolation'
    });

    expect(await store.listRecent(otherWorkspaceId)).toEqual([]);
    expect(await store.listPendingPackages(otherWorkspaceId)).toEqual([]);
    expect(
      await store.findByPackage(otherWorkspaceId, publishPackage.publishPackageId)
    ).toBeUndefined();
    await expect(
      store.recordUseFeedback({
        workspaceId: otherWorkspaceId,
        publishPackage: { id: publishPackage.publishPackageId, version: 1 },
        expectedPublishPackageFingerprintSha256: publishPackage.publishPackageFingerprintSha256,
        outcome: 'USER_REPORTED_DELIVERED',
        recordedByPrincipalId: principalId,
        idempotencyKey: 'wp06-other-workspace'
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });
});
