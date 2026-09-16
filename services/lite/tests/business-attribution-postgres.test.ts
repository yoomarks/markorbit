import path from 'node:path';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import type {
  ContentDraftId,
  ContentOpportunityId,
  ContentReviewDecisionId,
  ProductLoopSourceReference,
  PublishPackageId,
  TodayRecommendationId
} from '@markorbit/contracts/product-loop';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgresBusinessAttributionStore } from '../src/business-attribution.js';
import {
  ContentLedDemandAttributionService,
  PostgresContentLedDemandLineageReader
} from '../src/content-led-demand.js';
import {
  PostgresLiteContentPreparationStore,
  type ProductLoopSourceAuthority
} from '../src/content-preparation.js';
import { PostgresProductLoopFeedbackStore } from '../src/feedback.js';

const url = process.env.LITE_BUSINESS_ATTRIBUTION_TEST_DATABASE_URL;
const required = process.env.LITE_BUSINESS_ATTRIBUTION_POSTGRES_REQUIRED === '1';
if (required && !url) throw new Error('LITE_BUSINESS_ATTRIBUTION_TEST_DATABASE_URL is required.');
const suite = url ? describe : describe.skip;
const workspaceId = '11111111-1111-4111-8111-111111111111';
const otherWorkspaceId = '22222222-2222-4222-8222-222222222222';
const evaluatedAt = '2026-09-16T08:00:00.000Z';
const contentSource: ProductLoopSourceReference = {
  schemaVersion: 1,
  owner: 'KNOWLEDGE',
  kind: 'KNOWLEDGE_READY_PACKAGE',
  sourceId: 'ready-package_content-demand',
  sourceVersion: 1,
  sourceFingerprintSha256: '9'.repeat(64),
  observedAt: evaluatedAt
};
const exactRef = (owner: string, kind: string, id: string, sha: string) => ({
  owner,
  kind,
  id,
  version: 1,
  fingerprintSha256: sha.repeat(64),
  observedAt: evaluatedAt
});

suite('PostgreSQL Business Attribution owner', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'business-attribution-test',
    poolMaximum: 5,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_business_attribution_test'
  });
  let sequence = 0;
  const store = () =>
    new PostgresBusinessAttributionStore(
      database,
      database.getPool(),
      () => evaluatedAt,
      () => `postgres${++sequence}`
    );
  beforeAll(async () => {
    await database.start();
    await database
      .getPool()
      .query(
        'CREATE TABLE IF NOT EXISTS workspaces (workspace_id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE)'
      );
    const migrations = await loadMigrationsForOwner(
      path.resolve('../../infrastructure/persistence/migrations'),
      path.resolve('../../infrastructure/persistence/migration-owners.json'),
      '@markorbit/lite-service'
    );
    await migrate(database.getPool(), 'lite_business_attribution_test', migrations);
    await database
      .getPool()
      .query(
        `INSERT INTO workspaces(workspace_id,name,slug) VALUES($1,'Attribution A','attribution-a'),($2,'Attribution B','attribution-b') ON CONFLICT(workspace_id) DO NOTHING`,
        [workspaceId, otherWorkspaceId]
      );
  }, 30_000);
  beforeEach(async () => {
    sequence = 0;
    await database
      .getPool()
      .query(
        'TRUNCATE lite_business_attribution_commands,lite_business_attribution_links,lite_product_loop_feedback_commands,lite_product_loop_use_feedback,lite_content_preparation_commands,lite_publish_packages,lite_content_review_decisions,lite_content_drafts,lite_content_opportunities,lite_today_recommendations CASCADE'
      );
  });
  afterAll(async () => database.close());

  it('persists exact portfolio lineage, replays after restart and isolates Workspace reads', async () => {
    const command = {
      workspaceId,
      actorPrincipalId: 'user_professional',
      idempotencyKey: 'portfolio-growth-accepted-1',
      motionKind: 'PORTFOLIO_GROWTH' as const,
      sourceRefs: [
        exactRef('LITE', 'TRADEMARK_ASSET', 'asset_1', 'a'),
        exactRef('LITE', 'TRADEMARK_ASSET_MANAGEMENT_SIGNAL', 'signal_1', 'b'),
        exactRef('MARKREG', 'CUSTOMER_RELATIONSHIP', 'relationship_1', 'c')
      ],
      touchpointRefs: [
        exactRef('LITE', 'OPPORTUNITY_QUALIFICATION_DECISION', 'qualification_1', 'd'),
        exactRef('CAPABILITY_ENGINE', 'MANAGED_COMMUNICATION_MESSAGE', 'message_1', 'e')
      ],
      downstreamRef: exactRef(
        'MARKREG',
        'FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
        'opportunity_1',
        'f'
      ),
      attributionState: 'ATTRIBUTED' as const,
      evidenceBasis: 'EXACT_LINEAGE' as const,
      evaluatedAt
    };
    const created = await store().create(command);
    await expect(store().create(command)).resolves.toEqual(created);
    await expect(store().find(workspaceId, created.businessAttributionLinkId)).resolves.toEqual(
      created
    );
    await expect(
      store().find(otherWorkspaceId, created.businessAttributionLinkId)
    ).resolves.toBeUndefined();
    expect(created.downstreamRef).toMatchObject({ owner: 'MARKREG' });
    expect(created.authorityConsequences.conversionCreated).toBe(false);
  });

  it('replays exact content package to manual use to Site inbound to MarkReg lineage after restart', async () => {
    let contentId = 0;
    const next =
      <T extends string>(prefix: string) =>
      () =>
        `${prefix}_${++contentId}` as T;
    const sourceAuthority: ProductLoopSourceAuthority = {
      resolve(requestWorkspaceId, locator) {
        expect(requestWorkspaceId).toBe(workspaceId);
        expect(locator).toMatchObject({
          owner: contentSource.owner,
          kind: contentSource.kind,
          sourceId: contentSource.sourceId
        });
        return Promise.resolve(structuredClone(contentSource));
      }
    };
    const content = new PostgresLiteContentPreparationStore(
      database,
      database.getPool(),
      sourceAuthority,
      () => evaluatedAt,
      {
        recommendation: next<TodayRecommendationId>('today-recommendation'),
        opportunity: next<ContentOpportunityId>('content-opportunity'),
        draft: next<ContentDraftId>('content-draft'),
        review: next<ContentReviewDecisionId>('content-review-decision'),
        publishPackage: next<PublishPackageId>('publish-package')
      }
    );
    const recommendation = await content.createRecommendation({
      workspaceId,
      title: 'Prepare a source-grounded fee update',
      explanation: 'The accepted Knowledge package supports one bounded topic.',
      sources: [
        {
          owner: contentSource.owner,
          kind: contentSource.kind,
          sourceId: contentSource.sourceId
        }
      ],
      idempotencyKey: 'content-demand-recommendation'
    });
    const opportunity = await content.acceptContentOpportunity({
      workspaceId,
      recommendation: { id: recommendation.todayRecommendationId, version: 1 },
      expectedRecommendationFingerprintSha256: recommendation.recommendationFingerprintSha256,
      title: 'Fee update explainer',
      rationale: 'A human selected this topic for preparation.',
      idempotencyKey: 'content-demand-opportunity'
    });
    const draft = await content.createDraft({
      workspaceId,
      contentOpportunity: { id: opportunity.contentOpportunityId, version: 1 },
      expectedContentOpportunityFingerprintSha256: opportunity.contentOpportunityFingerprintSha256,
      title: 'Fee update explained',
      body: 'Source-grounded copy for human review.',
      idempotencyKey: 'content-demand-draft'
    });
    const ready = await content.markDraftReadyForReview({
      workspaceId,
      contentDraftId: draft.contentDraftId,
      expectedVersion: draft.version,
      expectedContentDraftFingerprintSha256: draft.contentDraftFingerprintSha256,
      idempotencyKey: 'content-demand-ready'
    });
    const review = await content.recordReview({
      workspaceId,
      contentDraft: { id: ready.contentDraftId, version: ready.version },
      expectedContentDraftFingerprintSha256: ready.contentDraftFingerprintSha256,
      outcome: 'APPROVED_FOR_PUBLISH_PACKAGE',
      reviewerPrincipalId: 'user_editor',
      rationale: 'Human review approved a canonical manual-use package.',
      idempotencyKey: 'content-demand-review'
    });
    const publishPackage = await content.preparePublishPackage({
      workspaceId,
      contentDraft: { id: ready.contentDraftId, version: ready.version },
      expectedContentDraftFingerprintSha256: ready.contentDraftFingerprintSha256,
      reviewDecision: { id: review.contentReviewDecisionId, version: review.version },
      idempotencyKey: 'content-demand-package'
    });
    const feedbackStore = new PostgresProductLoopFeedbackStore(
      database,
      database.getPool(),
      () => evaluatedAt,
      () => 'product-loop-feedback_content-demand'
    );
    const feedback = await feedbackStore.recordUseFeedback({
      workspaceId,
      publishPackage: { id: publishPackage.publishPackageId, version: 1 },
      expectedPublishPackageFingerprintSha256: publishPackage.publishPackageFingerprintSha256,
      outcome: 'USER_REPORTED_PUBLISHED',
      externalReference: 'https://example.test/manual/fee-update',
      recordedByPrincipalId: 'user_editor',
      idempotencyKey: 'content-demand-feedback'
    });
    const attributionStore = store();
    const siteLink = await attributionStore.create({
      workspaceId,
      actorPrincipalId: 'user_operator',
      idempotencyKey: 'content-demand-site-inbound',
      motionKind: 'SITE_INBOUND',
      sourceRefs: [
        exactRef('SITE', 'SITE_REQUEST_CONTEXT', 'site_markreg', 'a'),
        {
          ...exactRef('LITE', 'PUBLISH_PACKAGE', publishPackage.publishPackageId, 'b'),
          fingerprintSha256: publishPackage.publishPackageFingerprintSha256
        }
      ],
      touchpointRefs: [],
      downstreamRef: exactRef('MARKREG', 'FORMAL_MATTER', 'formal-matter_content-demand', 'c'),
      attributionState: 'ATTRIBUTED',
      evidenceBasis: 'EXACT_LINEAGE',
      evaluatedAt
    });
    const command = {
      workspaceId,
      actorPrincipalId: 'user_operator',
      idempotencyKey: 'content-demand-final',
      publishPackage: {
        id: publishPackage.publishPackageId,
        version: 1,
        fingerprintSha256: publishPackage.publishPackageFingerprintSha256
      },
      useFeedback: { id: feedback.productLoopFeedbackId, version: 1 },
      siteInboundAttribution: {
        id: siteLink.businessAttributionLinkId,
        version: 1,
        fingerprintSha256: siteLink.businessAttributionFingerprintSha256
      }
    } as const;
    const service = new ContentLedDemandAttributionService(
      new PostgresContentLedDemandLineageReader(database.getPool()),
      feedbackStore,
      attributionStore
    );
    const created = await service.record(command);
    const restarted = new ContentLedDemandAttributionService(
      new PostgresContentLedDemandLineageReader(database.getPool()),
      new PostgresProductLoopFeedbackStore(database, database.getPool()),
      store()
    );
    await expect(restarted.record(command)).resolves.toEqual(created);
    await expect(
      store().find(otherWorkspaceId, created.businessAttributionLinkId)
    ).resolves.toBeUndefined();
    expect(created.motionKind).toBe('CONTENT_LED_DEMAND');
    expect(created.downstreamRef).toEqual(siteLink.downstreamRef);
    expect(created.touchpointRefs.map((reference) => reference.kind)).toEqual([
      'CONTENT_OPPORTUNITY',
      'CONTENT_USE_FEEDBACK',
      'SITE_INBOUND_ATTRIBUTION'
    ]);
    expect(created.authorityConsequences.conversionCreated).toBe(false);
    expect(created.authorityConsequences.causalReturnOnInvestmentClaimed).toBe(false);
  });
});
