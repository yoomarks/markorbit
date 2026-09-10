import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type {
  TradingListingDraftV1,
  TradingPublishedListingV1
} from '@markorbit/contracts/trading-listing';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import {
  PostgresTradingListingStore,
  type TradingListingReviewRecordV1
} from '../src/trading-listing.js';

const url = process.env.LITE_TRADEMARK_ASSET_TEST_DATABASE_URL;
const required = process.env.LITE_TRADEMARK_ASSET_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error('LITE_TRADEMARK_ASSET_TEST_DATABASE_URL is required for PostgreSQL tests.');
const suite = url ? describe : describe.skip;

const workspaceA = '12121212-1212-4121-8121-121212121212';
const workspaceB = '34343434-3434-4343-8343-343434343434';
const workspaceMissing = '56565656-5656-4565-8565-565656565656';

suite('PostgreSQL Lite Trading Listing persistence', () => {
  let tick = 0;
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-trading-listing-test',
    poolMaximum: 6,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_trademark_asset_test'
  });
  const now = () => new Date(Date.UTC(2026, 8, 10, 5, 0, tick++)).toISOString();
  const listings = () => new PostgresTradingListingStore(database, database.getPool(), now);

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
    await migrate(database.getPool(), 'lite_trademark_asset_test', migrations);
    await database.getPool().query(
      `INSERT INTO workspaces(workspace_id,name,slug) VALUES
        ($1,'Listing A','listing-a'),
        ($2,'Listing B','listing-b'),
        ($3,'Listing Missing','listing-missing')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceA, workspaceB, workspaceMissing]
    );
  });

  beforeEach(async () => {
    tick = 0;
    await database.getPool().query(
      `TRUNCATE
         lite_trading_published_listing_versions,
         lite_trading_listing_review_versions,
         lite_trading_listing_draft_versions
       CASCADE`
    );
  });

  afterAll(() => database.close());

  function draft(workspaceId: string, version = 1): TradingListingDraftV1 {
    return {
      schemaVersion: 1,
      listingDraftId: 'trading-listing-draft_pg-1',
      workspaceId,
      version,
      trademarkAsset: { id: 'trademark-asset_pg-1', version: 3 },
      commerceProfile: { id: 'trademark-asset-commerce_pg-1', version: 2 },
      commercialDirection: {
        id: 'trading-ai-derived_commercial-direction_pg-1',
        version: 2
      },
      aiProfile: { id: 'trading-ai-derived_ai-profile_pg-1', version: 3 },
      showcase: { id: 'trading-showcase_pg-1', version: 4 },
      listingAssets: [{ id: 'listing-asset_pg-1', version: 1 }],
      opportunityStory: {
        bestForBuyerPersonaRefs: ['trading-commercial-persona_buyer-1'],
        whyThisMarkSellingPointRefs: ['trading-selling-point_short-name-1'],
        buyingPointRefs: ['trading-buying-point_fast-launch-1'],
        businessOpportunitySummary:
          version === 1 ? 'Exact reviewed opportunity story.' : 'Later mutable opportunity story.',
        endConsumerRefs: ['trading-commercial-persona_consumer-1'],
        operatorPersonaRefs: ['trading-commercial-persona_operator-1'],
        scenarioRefs: ['trading-commercial-scenario_dtc-launch-1'],
        assumptionRefs: ['trading-commercial-assumption_channel-fit-1']
      },
      listingMethod: 'MAKE_OFFER',
      sellerRelationshipVerified: false,
      status: 'DRAFT',
      createdAt: `2026-09-10T05:0${version}:00.000Z`
    };
  }

  function review(
    workspaceId: string,
    sourceDraft: TradingListingDraftV1,
    version = 1
  ): TradingListingReviewRecordV1 {
    return {
      schemaVersion: 1,
      listingReviewId: 'trading-listing-review_pg-1',
      workspaceId,
      version,
      reviewedDraft: {
        id: sourceDraft.listingDraftId,
        version: sourceDraft.version
      },
      review: {
        reviewedTrademarkAsset: sourceDraft.trademarkAsset,
        reviewedCommercialDirection: sourceDraft.commercialDirection,
        reviewedShowcase: sourceDraft.showcase,
        reviewState: 'CURRENT',
        reviewedAt: '2026-09-10T05:10:00.000Z',
        humanApprovalReference: 'listing-publish-approval_pg-1'
      }
    };
  }

  function published(
    sourceDraft: TradingListingDraftV1,
    sourceReview: TradingListingReviewRecordV1,
    version = 1
  ): TradingPublishedListingV1 {
    return {
      schemaVersion: 1,
      listingId: 'trading-listing_pg-1',
      version,
      draft: {
        id: sourceDraft.listingDraftId,
        version: sourceDraft.version
      },
      publishedDraftSnapshot: sourceDraft,
      publishReview: sourceReview.review,
      status: 'PUBLISHED',
      publishedAt: '2026-09-10T05:11:00.000Z'
    };
  }

  it('keeps exact Draft v1 addressable while latest advances to v2 after store restart', async () => {
    const first = draft(workspaceA, 1);
    const create = { draft: first, expectedVersion: 0, idempotencyKey: 'draft-create' };
    expect(await listings().saveDraft(create)).toEqual(first);
    expect(await listings().saveDraft(create)).toEqual(first);

    const second = draft(workspaceA, 2);
    await listings().saveDraft({
      draft: second,
      expectedVersion: 1,
      idempotencyKey: 'draft-update'
    });

    const restarted = listings();
    expect(await restarted.getDraftVersion(workspaceA, first.listingDraftId, 1)).toEqual(first);
    expect(await restarted.getLatestDraft(workspaceA, first.listingDraftId)).toEqual(second);
  });

  it('fails closed on stale expected versions and conflicting idempotency replay', async () => {
    const first = draft(workspaceA);
    await listings().saveDraft({
      draft: first,
      expectedVersion: 0,
      idempotencyKey: 'draft-conflict'
    });

    await expect(
      listings().saveDraft({
        draft: draft(workspaceA, 2),
        expectedVersion: 1,
        idempotencyKey: 'draft-conflict'
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });

    await expect(
      listings().saveDraft({
        draft: first,
        expectedVersion: 0,
        idempotencyKey: 'draft-stale'
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });

  it('preserves an exact reviewed Draft after a later Draft version exists', async () => {
    const first = draft(workspaceA);
    await listings().saveDraft({
      draft: first,
      expectedVersion: 0,
      idempotencyKey: 'review-draft-1'
    });
    const firstReview = review(workspaceA, first);
    await listings().saveReview({
      reviewRecord: firstReview,
      expectedVersion: 0,
      idempotencyKey: 'review-create'
    });

    const second = draft(workspaceA, 2);
    await listings().saveDraft({
      draft: second,
      expectedVersion: 1,
      idempotencyKey: 'review-draft-2'
    });

    const restarted = listings();
    expect(await restarted.getReviewVersion(workspaceA, firstReview.listingReviewId, 1)).toEqual(
      firstReview
    );
    expect(await restarted.getDraftVersion(workspaceA, first.listingDraftId, 1)).toEqual(first);
    expect(await restarted.getLatestDraft(workspaceA, first.listingDraftId)).toEqual(second);
  });

  it('preserves the exact published Draft snapshot after later Draft state exists', async () => {
    const first = draft(workspaceA);
    await listings().saveDraft({
      draft: first,
      expectedVersion: 0,
      idempotencyKey: 'published-draft-1'
    });
    const firstReview = review(workspaceA, first);
    await listings().saveReview({
      reviewRecord: firstReview,
      expectedVersion: 0,
      idempotencyKey: 'published-review-1'
    });
    const firstPublished = published(first, firstReview);
    await listings().savePublishedListing({
      listing: firstPublished,
      review: { id: firstReview.listingReviewId, version: firstReview.version },
      expectedVersion: 0,
      idempotencyKey: 'published-create'
    });

    await listings().saveDraft({
      draft: draft(workspaceA, 2),
      expectedVersion: 1,
      idempotencyKey: 'published-draft-2'
    });

    const restarted = listings();
    const restored = await restarted.getPublishedListingVersion(
      workspaceA,
      firstPublished.listingId,
      1
    );
    expect(restored).toEqual(firstPublished);
    expect(restored.publishedDraftSnapshot.version).toBe(1);
    expect((await restarted.getLatestDraft(workspaceA, first.listingDraftId)).version).toBe(2);
  });

  it('isolates identical Listing identities by Workspace', async () => {
    const a = draft(workspaceA);
    const b = draft(workspaceB);
    await listings().saveDraft({ draft: a, expectedVersion: 0, idempotencyKey: 'ws-a' });
    await listings().saveDraft({ draft: b, expectedVersion: 0, idempotencyKey: 'ws-b' });

    expect(await listings().getDraftVersion(workspaceA, a.listingDraftId, 1)).toEqual(a);
    expect(await listings().getDraftVersion(workspaceB, b.listingDraftId, 1)).toEqual(b);
    await expect(
      listings().getDraftVersion(workspaceMissing, a.listingDraftId, 1)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects review evidence that does not bind the exact persisted Draft', async () => {
    const first = draft(workspaceA);
    await listings().saveDraft({
      draft: first,
      expectedVersion: 0,
      idempotencyKey: 'mismatch-draft'
    });
    const original = review(workspaceA, first);
    const mismatched: TradingListingReviewRecordV1 = {
      ...original,
      review: {
        ...original.review,
        reviewedShowcase: { ...first.showcase, version: 5 }
      }
    };

    await expect(
      listings().saveReview({
        reviewRecord: mismatched,
        expectedVersion: 0,
        idempotencyKey: 'mismatch-review'
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });

  it('rejects a contract-valid published snapshot that differs from the exact persisted Draft', async () => {
    const first = draft(workspaceA);
    await listings().saveDraft({
      draft: first,
      expectedVersion: 0,
      idempotencyKey: 'snapshot-draft'
    });
    const firstReview = review(workspaceA, first);
    await listings().saveReview({
      reviewRecord: firstReview,
      expectedVersion: 0,
      idempotencyKey: 'snapshot-review'
    });

    const fabricated = {
      ...first,
      opportunityStory: {
        ...first.opportunityStory,
        businessOpportunitySummary: 'Fabricated historical rewrite.'
      }
    };
    const listing = published(fabricated, {
      ...firstReview,
      review: {
        ...firstReview.review,
        reviewedTrademarkAsset: fabricated.trademarkAsset,
        reviewedCommercialDirection: fabricated.commercialDirection,
        reviewedShowcase: fabricated.showcase
      }
    });

    await expect(
      listings().savePublishedListing({
        listing,
        review: { id: firstReview.listingReviewId, version: 1 },
        expectedVersion: 0,
        idempotencyKey: 'snapshot-published'
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });

  it('fails closed when persisted JSON is malformed instead of returning empty or healthy state', async () => {
    const first = draft(workspaceA);
    await listings().saveDraft({
      draft: first,
      expectedVersion: 0,
      idempotencyKey: 'integrity-draft'
    });
    await database.getPool().query(
      `UPDATE lite_trading_listing_draft_versions
          SET document_json='{}'::jsonb
        WHERE workspace_id=$1 AND listing_draft_id=$2 AND version=1`,
      [workspaceA, first.listingDraftId]
    );

    await expect(
      listings().getDraftVersion(workspaceA, first.listingDraftId, 1)
    ).rejects.toMatchObject({ code: 'INTEGRITY_FAILURE' });
  });

  it('does not create Published Listing state merely by persisting a Draft or Review', async () => {
    const first = draft(workspaceA);
    await listings().saveDraft({
      draft: first,
      expectedVersion: 0,
      idempotencyKey: 'authority-draft'
    });
    const firstReview = review(workspaceA, first);
    await listings().saveReview({
      reviewRecord: firstReview,
      expectedVersion: 0,
      idempotencyKey: 'authority-review'
    });

    const count = await database
      .getPool()
      .query('SELECT count(*)::int AS count FROM lite_trading_published_listing_versions');
    expect((count.rows[0] as { count: number }).count).toBe(0);
  });
});
