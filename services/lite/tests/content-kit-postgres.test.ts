import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import type {
  ContentDraftId,
  ContentOpportunityId,
  ContentReviewDecisionId,
  ProductLoopSourceReference,
  PublishPackageId,
  TodayRecommendationId
} from '@markorbit/contracts/product-loop';
import type { ContentPick, DailyOrbitItem } from '@markorbit/contracts/daily-workspace';
import {
  ContentKitService,
  PostgresContentKitLifecycleReader,
  type DailyOrbitSnapshotReader
} from '../src/content-kit.js';
import {
  PostgresLiteContentPreparationStore,
  type ProductLoopSourceAuthority
} from '../src/content-preparation.js';

const url = process.env.LITE_CONTENT_KIT_TEST_DATABASE_URL;
const required = process.env.LITE_CONTENT_KIT_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'LITE_CONTENT_KIT_TEST_DATABASE_URL is required when LITE_CONTENT_KIT_POSTGRES_TEST_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const workspaceId = '92929292-9292-4929-8929-929292929292';
const otherWorkspaceId = '93939393-9393-4939-8939-939393939393';
const userId = 'user_m9_wp04_postgres';
const source: ProductLoopSourceReference = {
  schemaVersion: 1,
  owner: 'CORE',
  kind: 'KNOWLEDGE_READY_PACKAGE',
  sourceId: 'rdp_m9-wp04-postgres',
  sourceVersion: 'CORE_CONTENT_V1',
  sourceFingerprintSha256: 'e'.repeat(64),
  observedAt: '2026-08-18T06:00:00.000Z'
};

function sequence<T extends string>(prefix: string) {
  let value = 0;
  return () => `${prefix}_${++value}` as T;
}

suite('PostgreSQL M9-WP-04 Content Kit projection', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-content-kit-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_content_kit_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
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
  const now = () => new Date(Date.UTC(2026, 7, 18, 6, 1, tick++)).toISOString();
  const ids = {
    recommendation: sequence<TodayRecommendationId>('today-recommendation'),
    opportunity: sequence<ContentOpportunityId>('content-opportunity'),
    draft: sequence<ContentDraftId>('content-draft'),
    review: sequence<ContentReviewDecisionId>('content-review-decision'),
    publishPackage: sequence<PublishPackageId>('publish-package')
  };

  function store() {
    return new PostgresLiteContentPreparationStore(
      database,
      database.getPool(),
      sourceAuthority,
      now,
      ids
    );
  }

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
    await migrate(database.getPool(), 'lite_content_kit_test', liteMigrations);
    await database.getPool().query(
      `INSERT INTO workspaces (workspace_id,name,slug) VALUES
       ($1,'Content Kit Test','content-kit-test'),
       ($2,'Content Kit Other','content-kit-other')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceId, otherWorkspaceId]
    );
  });

  beforeEach(async () => {
    tick = 0;
    await database
      .getPool()
      .query(
        'TRUNCATE lite_content_preparation_commands,lite_publish_packages,lite_content_review_decisions,lite_content_drafts,lite_content_opportunities,lite_today_recommendations CASCADE'
      );
  });

  afterAll(() => database.close());

  it('reads exact accepted lifecycle state into a non-publishing Content Kit across a fresh reader', async () => {
    const writer = store();
    const recommendation = await writer.createRecommendation({
      workspaceId,
      title: 'Prepare USPTO fee update content',
      explanation: 'The exact governed source has bounded editorial value.',
      sources: [{ owner: source.owner, kind: source.kind, sourceId: source.sourceId }],
      idempotencyKey: 'wp04-rec'
    });
    const opportunity = await writer.acceptContentOpportunity({
      workspaceId,
      recommendation: {
        id: recommendation.todayRecommendationId,
        version: recommendation.version
      },
      expectedRecommendationFingerprintSha256: recommendation.recommendationFingerprintSha256,
      title: 'Prepare the fee update explainer',
      rationale: 'The user accepted the existing content recommendation.',
      idempotencyKey: 'wp04-opp'
    });
    const draft = await writer.createDraft({
      workspaceId,
      contentOpportunity: { id: opportunity.contentOpportunityId, version: opportunity.version },
      expectedContentOpportunityFingerprintSha256: opportunity.contentOpportunityFingerprintSha256,
      title: 'USPTO fee update explained',
      body: 'Editable draft grounded in the accepted source.',
      idempotencyKey: 'wp04-draft'
    });
    const reviewReady = await writer.markDraftReadyForReview({
      workspaceId,
      contentDraftId: draft.contentDraftId,
      expectedVersion: draft.version,
      expectedContentDraftFingerprintSha256: draft.contentDraftFingerprintSha256,
      idempotencyKey: 'wp04-ready'
    });
    const review = await writer.recordReview({
      workspaceId,
      contentDraft: { id: reviewReady.contentDraftId, version: reviewReady.version },
      expectedContentDraftFingerprintSha256: reviewReady.contentDraftFingerprintSha256,
      outcome: 'APPROVED_FOR_PUBLISH_PACKAGE',
      reviewerPrincipalId: userId,
      rationale: 'Human review approved a manual-use package only.',
      idempotencyKey: 'wp04-review'
    });
    const publishPackage = await writer.preparePublishPackage({
      workspaceId,
      contentDraft: { id: reviewReady.contentDraftId, version: reviewReady.version },
      expectedContentDraftFingerprintSha256: reviewReady.contentDraftFingerprintSha256,
      reviewDecision: { id: review.contentReviewDecisionId, version: review.version },
      idempotencyKey: 'wp04-package'
    });

    const orbitItem: DailyOrbitItem = {
      schemaVersion: 1,
      dailyOrbitItemId: 'daily-orbit-item_m9-wp04-postgres',
      workspaceId,
      version: 1,
      signal: { id: 'daily-signal_m9-wp04-postgres', version: 1 },
      recommendation: {
        id: recommendation.todayRecommendationId,
        version: recommendation.version
      },
      section: 'TODAYS_ORBIT',
      score: {
        importance: { score: 85, reason: 'Fee change.' },
        personalRelevance: { score: 50, reason: 'Workspace baseline.' },
        timeSensitivity: { score: 85, reason: 'High.' },
        contentPotential: { score: 90, reason: 'Editorial potential.' },
        total: 76
      },
      whyThisMatters: 'The exact governed fee update is timely.',
      source,
      rankedAt: '2026-08-18T06:10:00.000Z',
      executionAuthorized: false,
      legalTruthVerified: false
    };
    const pick: ContentPick = {
      schemaVersion: 1,
      contentPickId: 'content-pick_m9-wp04-postgres',
      workspaceId,
      version: 1,
      orbitItem: { id: orbitItem.dailyOrbitItemId, version: 1 },
      recommendation: {
        id: recommendation.todayRecommendationId,
        version: recommendation.version
      },
      title: 'USPTO fee update',
      whyPublish: 'The source-derived fee change has bounded editorial potential.',
      suggestedAngles: ['What changed', 'What applicants should review'],
      recommendedPlatforms: ['WECHAT_OFFICIAL_ACCOUNT', 'WECHAT_MOMENTS'],
      contentOpportunity: { id: opportunity.contentOpportunityId, version: opportunity.version },
      publishAuthorized: false,
      externalPublishExecuted: false,
      createdAt: '2026-08-18T06:02:00.000Z'
    };
    const orbit: DailyOrbitSnapshotReader = {
      snapshot(requestWorkspaceId, requestUserId) {
        if (requestWorkspaceId !== workspaceId || requestUserId !== userId)
          return Promise.resolve({
            schemaVersion: 1,
            workspaceId: requestWorkspaceId,
            subjectUserId: requestUserId,
            generatedAt: '2026-08-18T06:10:00.000Z',
            preferenceSource: 'NONE',
            items: [],
            contentPicks: [],
            partial: false,
            warnings: [],
            executionAuthorized: false,
            legalTruthVerified: false
          });
        return Promise.resolve({
          schemaVersion: 1,
          workspaceId,
          subjectUserId: userId,
          generatedAt: '2026-08-18T06:10:00.000Z',
          preferenceSource: 'NONE',
          items: [orbitItem],
          contentPicks: [pick],
          partial: false,
          warnings: [],
          executionAuthorized: false,
          legalTruthVerified: false
        });
      }
    };

    const service = new ContentKitService(
      orbit,
      new PostgresContentKitLifecycleReader(database.getPool())
    );
    const kit = await service.find(workspaceId, userId, pick.contentPickId);

    expect(kit.contentOpportunity).toEqual({ id: opportunity.contentOpportunityId, version: 1 });
    expect(kit.draftReferences).toEqual([
      { id: reviewReady.contentDraftId, version: reviewReady.version }
    ]);
    expect(kit.publishPackageReferences).toEqual([
      { id: publishPackage.publishPackageId, version: publishPackage.version }
    ]);
    expect(kit.platformVariants[0]?.draft).toEqual({
      id: reviewReady.contentDraftId,
      version: reviewReady.version
    });
    expect(kit.platformVariants[0]?.humanReviewRequired).toBe(true);
    expect(kit.externalPublishExecuted).toBe(false);
    expect(publishPackage.externalPublishExecuted).toBe(false);

    await expect(service.find(otherWorkspaceId, userId, pick.contentPickId)).rejects.toMatchObject({
      code: 'CONTENT_PICK_NOT_FOUND',
      status: 404
    });
  });
});
