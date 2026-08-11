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
import {
  LiteContentPreparationError,
  PostgresLiteContentPreparationStore,
  type ProductLoopSourceAuthority
} from '../src/content-preparation.js';

const url = process.env.LITE_CONTENT_TEST_DATABASE_URL;
const required = process.env.LITE_CONTENT_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'LITE_CONTENT_TEST_DATABASE_URL is required when LITE_CONTENT_POSTGRES_TEST_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const workspaceId = '77777777-7777-4777-8777-777777777777';
const otherWorkspaceId = '88888888-8888-4888-8888-888888888888';
const sourceFingerprint = 'a'.repeat(64);

function sequence<T extends string>(prefix: string) {
  let value = 0;
  return () => `${prefix}_${++value}` as T;
}

suite('PostgreSQL Lite Content preparation', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-content-preparation-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_content_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  const source: ProductLoopSourceReference = {
    schemaVersion: 1,
    owner: 'KNOWLEDGE',
    kind: 'KNOWLEDGE_READY_PACKAGE',
    sourceId: 'rdp_accepted-content-001',
    sourceVersion: 'export-v1',
    sourceFingerprintSha256: sourceFingerprint,
    observedAt: '2026-08-11T08:30:00.000Z',
    correlationId: 'correlation_ready-package-001'
  };
  const sourceAuthority: ProductLoopSourceAuthority = {
    async resolve(requestWorkspaceId, locator) {
      if (requestWorkspaceId !== workspaceId && requestWorkspaceId !== otherWorkspaceId)
        throw new Error('unexpected workspace');
      if (
        locator.owner !== source.owner ||
        locator.kind !== source.kind ||
        locator.sourceId !== source.sourceId
      )
        throw new Error('unexpected source locator');
      return structuredClone(source);
    }
  };
  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 7, 11, 8, 31, tick++)).toISOString();
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
    const coreMigrations = await loadMigrationsForOwner(
      migrationsDirectory,
      migrationOwners,
      '@markorbit/core-service'
    );
    const liteMigrations = await loadMigrationsForOwner(
      migrationsDirectory,
      migrationOwners,
      '@markorbit/lite-service'
    );
    await migrate(database.getPool(), 'lite_content_test_core', coreMigrations);
    await migrate(database.getPool(), 'lite_content_test', liteMigrations);
    await database.getPool().query(
      `INSERT INTO workspaces (workspace_id,name,slug) VALUES
       ($1,'Lite Content Test','lite-content-test'),
       ($2,'Lite Content Other','lite-content-other')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceId, otherWorkspaceId]
    );
  });

  beforeEach(async () => {
    tick = 0;
    await database.getPool().query(
      'TRUNCATE lite_content_preparation_commands,lite_publish_packages,lite_content_review_decisions,lite_content_drafts,lite_content_opportunities,lite_today_recommendations CASCADE'
    );
  });

  afterAll(() => database.close());

  async function recommendation(service = store(), key = 'recommendation-1') {
    return service.createRecommendation({
      workspaceId,
      title: 'Explain the new trademark maintenance change',
      explanation: 'Accepted Knowledge content is relevant to client education today.',
      sources: [
        {
          owner: 'KNOWLEDGE',
          kind: 'KNOWLEDGE_READY_PACKAGE',
          sourceId: source.sourceId
        }
      ],
      idempotencyKey: key
    });
  }

  async function opportunity(service = store(), key = 'opportunity-1') {
    const value = await recommendation(service);
    return service.acceptContentOpportunity({
      workspaceId,
      recommendation: { id: value.todayRecommendationId, version: value.version },
      expectedRecommendationFingerprintSha256: value.recommendationFingerprintSha256,
      title: 'Prepare a client-facing maintenance explainer',
      rationale: 'The governed source supports a bounded educational content draft.',
      idempotencyKey: key
    });
  }

  async function initialDraft(service = store(), key = 'draft-1') {
    const value = await opportunity(service);
    return service.createDraft({
      workspaceId,
      contentOpportunity: { id: value.contentOpportunityId, version: value.version },
      expectedContentOpportunityFingerprintSha256: value.contentOpportunityFingerprintSha256,
      title: 'US trademark maintenance: what clients should know',
      body: 'Draft version one.',
      idempotencyKey: key
    });
  }

  it('persists exact Knowledge provenance, bounded draft versions, Human Review and a non-published PublishPackage across restart', async () => {
    const first = store();
    const rec = await recommendation(first);
    expect(rec.sources).toEqual([source]);
    expect(rec.executionAuthorized).toBe(false);

    const opp = await first.acceptContentOpportunity({
      workspaceId,
      recommendation: { id: rec.todayRecommendationId, version: rec.version },
      expectedRecommendationFingerprintSha256: rec.recommendationFingerprintSha256,
      title: 'Prepare a client-facing maintenance explainer',
      rationale: 'Use exact accepted Knowledge provenance.',
      idempotencyKey: 'opportunity-restart'
    });
    expect(opp.publishAuthorized).toBe(false);

    const draft1 = await first.createDraft({
      workspaceId,
      contentOpportunity: { id: opp.contentOpportunityId, version: opp.version },
      expectedContentOpportunityFingerprintSha256: opp.contentOpportunityFingerprintSha256,
      title: 'Maintenance explainer',
      body: 'First bounded draft.',
      idempotencyKey: 'draft-restart'
    });
    const draft2 = await first.reviseDraft({
      workspaceId,
      contentDraftId: draft1.contentDraftId,
      expectedVersion: draft1.version,
      expectedContentDraftFingerprintSha256: draft1.contentDraftFingerprintSha256,
      title: 'Maintenance explainer',
      body: 'Second bounded draft with review-ready wording.',
      idempotencyKey: 'draft-revise-restart'
    });
    const reviewReady = await first.markDraftReadyForReview({
      workspaceId,
      contentDraftId: draft2.contentDraftId,
      expectedVersion: draft2.version,
      expectedContentDraftFingerprintSha256: draft2.contentDraftFingerprintSha256,
      idempotencyKey: 'draft-ready-restart'
    });
    expect(reviewReady.version).toBe(3);
    expect(reviewReady.status).toBe('READY_FOR_HUMAN_REVIEW');
    expect(reviewReady.published).toBe(false);

    const review = await first.recordReview({
      workspaceId,
      contentDraft: { id: reviewReady.contentDraftId, version: reviewReady.version },
      expectedContentDraftFingerprintSha256: reviewReady.contentDraftFingerprintSha256,
      outcome: 'APPROVED_FOR_PUBLISH_PACKAGE',
      reviewerPrincipalId: 'user_reviewer-001',
      rationale: 'Accurate enough for a prepared manual-use package.',
      idempotencyKey: 'review-restart'
    });
    expect(review.publishesExternally).toBe(false);

    const prepared = await first.preparePublishPackage({
      workspaceId,
      contentDraft: { id: reviewReady.contentDraftId, version: reviewReady.version },
      expectedContentDraftFingerprintSha256: reviewReady.contentDraftFingerprintSha256,
      reviewDecision: { id: review.contentReviewDecisionId, version: review.version },
      idempotencyKey: 'package-restart'
    });
    expect(prepared.status).toBe('PREPARED');
    expect(prepared.externalPublishExecuted).toBe(false);

    const history = await database.getPool().query(
      'SELECT version,document_json->>\'body\' AS body FROM lite_content_drafts WHERE workspace_id=$1 AND content_draft_id=$2 ORDER BY version',
      [workspaceId, draft1.contentDraftId]
    );
    expect(history.rows).toMatchObject([
      { version: 1, body: 'First bounded draft.' },
      { version: 2, body: 'Second bounded draft with review-ready wording.' },
      { version: 3, body: 'Second bounded draft with review-ready wording.' }
    ]);

    const afterRestart = store();
    expect(await afterRestart.findLatestDraft(workspaceId, draft1.contentDraftId)).toEqual(
      reviewReady
    );
    expect(await afterRestart.findPublishPackage(workspaceId, prepared.publishPackageId)).toEqual(
      prepared
    );
    expect(
      await afterRestart.preparePublishPackage({
        workspaceId,
        contentDraft: { id: reviewReady.contentDraftId, version: reviewReady.version },
        expectedContentDraftFingerprintSha256: reviewReady.contentDraftFingerprintSha256,
        reviewDecision: { id: review.contentReviewDecisionId, version: review.version },
        idempotencyKey: 'package-restart'
      })
    ).toEqual(prepared);
    expect(
      await afterRestart.findPublishPackage(otherWorkspaceId, prepared.publishPackageId)
    ).toBeUndefined();
  });

  it('serializes competing draft revisions so only one expected-version mutation wins', async () => {
    const service = store();
    const draft = await initialDraft(service, 'draft-concurrency');
    const commands = ['A', 'B'].map((suffix) =>
      service.reviseDraft({
        workspaceId,
        contentDraftId: draft.contentDraftId,
        expectedVersion: draft.version,
        expectedContentDraftFingerprintSha256: draft.contentDraftFingerprintSha256,
        title: `Concurrent ${suffix}`,
        body: `Concurrent body ${suffix}`,
        idempotencyKey: `revise-concurrent-${suffix}`
      })
    );
    const settled = await Promise.allSettled(commands);
    expect(settled.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    const failure = settled.find((item) => item.status === 'rejected');
    expect(failure?.status).toBe('rejected');
    if (failure?.status === 'rejected') {
      expect(failure.reason).toBeInstanceOf(LiteContentPreparationError);
      expect((failure.reason as LiteContentPreparationError).code).toBe('VERSION_CONFLICT');
    }
    expect((await service.findLatestDraft(workspaceId, draft.contentDraftId))?.version).toBe(2);
  });

  it('replays exact commands but rejects idempotency drift', async () => {
    const service = store();
    const original = await recommendation(service, 'same-key');
    expect(await recommendation(store(), 'same-key')).toEqual(original);
    await expect(
      store().createRecommendation({
        workspaceId,
        title: 'Different title under the same key',
        explanation: 'Accepted Knowledge content is relevant to client education today.',
        sources: [
          {
            owner: 'KNOWLEDGE',
            kind: 'KNOWLEDGE_READY_PACKAGE',
            sourceId: source.sourceId
          }
        ],
        idempotencyKey: 'same-key'
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('never prepares a PublishPackage without an approving Human Review Decision', async () => {
    const service = store();
    const draft = await initialDraft(service, 'draft-review-block');
    const ready = await service.markDraftReadyForReview({
      workspaceId,
      contentDraftId: draft.contentDraftId,
      expectedVersion: draft.version,
      expectedContentDraftFingerprintSha256: draft.contentDraftFingerprintSha256,
      idempotencyKey: 'ready-review-block'
    });
    const review = await service.recordReview({
      workspaceId,
      contentDraft: { id: ready.contentDraftId, version: ready.version },
      expectedContentDraftFingerprintSha256: ready.contentDraftFingerprintSha256,
      outcome: 'CHANGES_REQUIRED',
      reviewerPrincipalId: 'user_reviewer-002',
      rationale: 'Clarify the scope before preparing material for manual use.',
      idempotencyKey: 'review-block'
    });
    await expect(
      service.preparePublishPackage({
        workspaceId,
        contentDraft: { id: ready.contentDraftId, version: ready.version },
        expectedContentDraftFingerprintSha256: ready.contentDraftFingerprintSha256,
        reviewDecision: { id: review.contentReviewDecisionId, version: review.version },
        idempotencyKey: 'package-block'
      })
    ).rejects.toMatchObject({ code: 'HUMAN_REVIEW_REQUIRED' });
    expect(
      await database
        .getPool()
        .query('SELECT count(*)::int AS count FROM lite_publish_packages')
        .then((result) => result.rows[0]?.count)
    ).toBe(0);
  });
});
