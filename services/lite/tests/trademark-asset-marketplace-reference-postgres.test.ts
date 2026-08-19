import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import { PostgresLiteTrademarkAssetStore } from '../src/trademark-asset.js';
import { PostgresTrademarkAssetMarketplaceReferenceStore } from '../src/trademark-asset-marketplace-reference.js';

const url = process.env.LITE_TRADEMARK_ASSET_TEST_DATABASE_URL;
const required = process.env.LITE_TRADEMARK_ASSET_POSTGRES_TEST_REQUIRED === '1';
if (required && !url) {
  throw new Error(
    'LITE_TRADEMARK_ASSET_TEST_DATABASE_URL is required when LITE_TRADEMARK_ASSET_POSTGRES_TEST_REQUIRED=1.'
  );
}
const suite = url ? describe : describe.skip;
const workspaceId = '97979797-9797-4979-8979-979797979797';
const observedAt = '2026-08-19T12:10:00.000Z';
const admissionSource = {
  owner: 'WORKSPACE_USER',
  kind: 'WORKSPACE_ADMISSION',
  sourceId: 'admission_m10-wp06',
  sourceVersion: '1',
  observedAt,
  freshness: 'CURRENT'
} as const;
const marketplaceSource = {
  owner: 'MARKETPLACE',
  kind: 'MARKETPLACE_LISTING',
  sourceId: 'marketplace-listing_606',
  sourceVersion: '9',
  sourceFingerprintSha256: 'a'.repeat(64),
  observedAt,
  freshness: 'CURRENT'
} as const;

suite('PostgreSQL M10-WP-06 Marketplace Asset Reference', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-trademark-asset-marketplace-reference-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_trademark_asset_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  const assetStore = () =>
    new PostgresLiteTrademarkAssetStore(
      database,
      database.getPool(),
      () => '2026-08-19T12:11:00.000Z'
    );
  const overlayStore = () =>
    new PostgresTrademarkAssetMarketplaceReferenceStore(
      database,
      database.getPool(),
      assetStore(),
      () => '2026-08-19T12:12:00.000Z',
      () => '00000000-0000-4000-8000-000000000606'
    );

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
    await migrate(database.getPool(), 'lite_trademark_asset_test', liteMigrations);
    await database.getPool().query(
      `INSERT INTO workspaces (workspace_id,name,slug)
       VALUES ($1,'Trademark Asset Marketplace Reference Test','trademark-asset-marketplace-reference-test')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceId]
    );
  });

  beforeEach(async () => {
    await database
      .getPool()
      .query(
        'TRUNCATE lite_trademark_asset_marketplace_commands,lite_trademark_asset_marketplace_overlays,lite_trademark_asset_commerce_commands,lite_trademark_asset_commerce_profiles,lite_trademark_asset_commands,lite_trademark_asset_identifiers,lite_trademark_assets CASCADE'
      );
  });

  afterAll(() => database.close());

  it('persists a private reseller overlay while keeping Marketplace source truth read-only', async () => {
    const writer = assetStore();
    const asset = await writer.admit({
      workspaceId,
      identity: { jurisdiction: 'US', markText: 'MARKET REF' },
      workspaceRelationships: [
        {
          kind: 'MARKETPLACE_ADDED',
          sourceAssetId: 'marketplace-asset_606',
          sourceReference: marketplaceSource,
          sourceAssetEditableByWorkspace: false
        }
      ],
      sourceReferences: [admissionSource, marketplaceSource],
      idempotencyKey: 'marketplace-reference-asset'
    });

    const created = await overlayStore().upsert({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      expectedTrademarkAssetVersion: asset.version,
      source: {
        sourceAssetId: 'marketplace-asset_606',
        sourceListingId: 'marketplace-listing_606',
        sourceListingVersion: '9',
        sourceListingFingerprintSha256: 'a'.repeat(64),
        sourceReference: marketplaceSource,
        observedAt
      },
      privateTags: ['buyer-saas'],
      privateNotes: ['Recommend to customer A'],
      favorite: true,
      headline: 'Private reseller presentation',
      sellingPoints: ['Short mark'],
      aiTags: ['saas'],
      showcaseTemplateReference: 'showcase_clean_2',
      mediaAssetReferences: ['display_artwork_2'],
      customerRecommendationReferences: ['customer_a'],
      sharePreparationReference: 'share_candidate_1',
      idempotencyKey: 'overlay-create-1'
    });

    expect(created).toMatchObject({
      version: 1,
      favorite: true,
      localPriceOverrideAllowed: false,
      sourceListingMutableByWorkspace: false,
      sourceTrademarkFactsMutableByWorkspace: false,
      ownershipClaimCreatedByLite: false,
      marketplacePublicationCreatedByLite: false,
      transactionAuthorizedByLite: false
    });

    const replay = await overlayStore().upsert({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      expectedTrademarkAssetVersion: asset.version,
      source: {
        sourceAssetId: 'marketplace-asset_606',
        sourceListingId: 'marketplace-listing_606',
        sourceListingVersion: '9',
        sourceListingFingerprintSha256: 'a'.repeat(64),
        sourceReference: marketplaceSource,
        observedAt
      },
      privateTags: ['buyer-saas'],
      privateNotes: ['Recommend to customer A'],
      favorite: true,
      headline: 'Private reseller presentation',
      sellingPoints: ['Short mark'],
      aiTags: ['saas'],
      showcaseTemplateReference: 'showcase_clean_2',
      mediaAssetReferences: ['display_artwork_2'],
      customerRecommendationReferences: ['customer_a'],
      sharePreparationReference: 'share_candidate_1',
      idempotencyKey: 'overlay-create-1'
    });
    expect(replay).toEqual(created);

    const unchanged = await writer.get(workspaceId, asset.trademarkAssetId);
    expect(unchanged.version).toBe(asset.version);
    expect(unchanged.workspaceRelationships).toEqual(asset.workspaceRelationships);
    expect(unchanged.identity).toEqual(asset.identity);
  });

  it('rejects overlay writes when the Asset is not a Marketplace-added reference', async () => {
    const asset = await assetStore().admit({
      workspaceId,
      identity: { jurisdiction: 'CN', markText: 'OWNED ASSET' },
      workspaceRelationships: [{ kind: 'OWNED', sourceAssetEditableByWorkspace: false }],
      sourceReferences: [admissionSource],
      idempotencyKey: 'owned-asset'
    });

    await expect(
      overlayStore().upsert({
        workspaceId,
        trademarkAssetId: asset.trademarkAssetId,
        expectedTrademarkAssetVersion: asset.version,
        source: {
          sourceAssetId: 'marketplace-asset_606',
          sourceListingId: 'marketplace-listing_606',
          sourceListingVersion: '9',
          sourceReference: marketplaceSource,
          observedAt
        },
        idempotencyKey: 'owned-overlay-blocked'
      })
    ).rejects.toMatchObject({ code: 'RELATIONSHIP_CONFLICT', status: 403 });
  });

  it('rejects a source asset mismatch rather than silently copying a different Marketplace record', async () => {
    const asset = await assetStore().admit({
      workspaceId,
      identity: { jurisdiction: 'GB', markText: 'SOURCE BOUNDARY' },
      workspaceRelationships: [
        {
          kind: 'MARKETPLACE_ADDED',
          sourceAssetId: 'marketplace-asset_expected',
          sourceReference: marketplaceSource,
          sourceAssetEditableByWorkspace: false
        }
      ],
      sourceReferences: [admissionSource, marketplaceSource],
      idempotencyKey: 'source-boundary-marketplace-asset'
    });

    await expect(
      overlayStore().upsert({
        workspaceId,
        trademarkAssetId: asset.trademarkAssetId,
        expectedTrademarkAssetVersion: asset.version,
        source: {
          sourceAssetId: 'marketplace-asset_wrong',
          sourceListingId: 'marketplace-listing_606',
          sourceListingVersion: '9',
          sourceReference: marketplaceSource,
          observedAt
        },
        idempotencyKey: 'source-mismatch-overlay'
      })
    ).rejects.toMatchObject({ code: 'SOURCE_REFERENCE_CONFLICT' });
  });
});
