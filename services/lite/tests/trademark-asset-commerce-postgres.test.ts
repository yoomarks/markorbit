import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import { PostgresLiteTrademarkAssetStore } from '../src/trademark-asset.js';
import {
  PostgresTrademarkAssetCommerceStore,
  TrademarkAssetCommerceError
} from '../src/trademark-asset-commerce.js';

const url = process.env.LITE_TRADEMARK_ASSET_TEST_DATABASE_URL;
const required = process.env.LITE_TRADEMARK_ASSET_POSTGRES_TEST_REQUIRED === '1';
if (required && !url) {
  throw new Error(
    'LITE_TRADEMARK_ASSET_TEST_DATABASE_URL is required when LITE_TRADEMARK_ASSET_POSTGRES_TEST_REQUIRED=1.'
  );
}
const suite = url ? describe : describe.skip;
const workspaceId = '96969696-9696-4969-8969-969696969696';
const observedAt = '2026-08-19T06:45:00.000Z';
const admissionSource = {
  owner: 'WORKSPACE_USER',
  kind: 'WORKSPACE_ADMISSION',
  sourceId: 'admission_m10-wp05',
  sourceVersion: '1',
  observedAt,
  freshness: 'CURRENT'
} as const;
const marketplaceSource = {
  owner: 'MARKETPLACE',
  kind: 'MARKETPLACE_LISTING',
  sourceId: 'listing_m10-wp05',
  sourceVersion: '1',
  observedAt,
  freshness: 'CURRENT'
} as const;

suite('PostgreSQL M10-WP-05 Trademark Asset Commerce Profile', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-trademark-asset-commerce-test',
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
      () => '2026-08-19T06:46:00.000Z'
    );
  const commerceStore = () =>
    new PostgresTrademarkAssetCommerceStore(
      database,
      database.getPool(),
      assetStore(),
      () => '2026-08-19T06:47:00.000Z',
      () => '00000000-0000-4000-8000-000000000505'
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
       VALUES ($1,'Trademark Asset Commerce Test','trademark-asset-commerce-test')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceId]
    );
  });

  beforeEach(async () => {
    await database
      .getPool()
      .query(
        'TRUNCATE lite_trademark_asset_commerce_commands,lite_trademark_asset_commerce_profiles,lite_trademark_asset_commands,lite_trademark_asset_identifiers,lite_trademark_assets CASCADE'
      );
  });

  afterAll(() => database.close());

  it('creates and version-controls workspace-owned sale configuration without publishing a listing', async () => {
    const asset = await assetStore().admit({
      workspaceId,
      identity: { jurisdiction: 'US', markText: 'SELLABLE' },
      workspaceRelationships: [
        { kind: 'REPRESENTED', sourceAssetEditableByWorkspace: false },
        { kind: 'MANAGED', sourceAssetEditableByWorkspace: false }
      ],
      sourceReferences: [admissionSource],
      idempotencyKey: 'commerce-asset'
    });

    const created = await commerceStore().upsert({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      expectedTrademarkAssetVersion: asset.version,
      saleIntent: 'FOR_SALE',
      askingPrice: { amountMinor: 280000, currency: 'usd' },
      negotiable: true,
      saleTerritories: ['us', 'gb'],
      sellerRole: 'AUTHORIZED_REPRESENTATIVE',
      headline: 'Short ecommerce-ready mark',
      sellingPoints: ['Short name', 'Easy pronunciation'],
      aiTags: ['ecommerce', 'short-name'],
      showcaseTemplateReference: 'showcase_clean_1',
      mediaAssetReferences: ['display_artwork_1'],
      idempotencyKey: 'commerce-create-1'
    });

    expect(created).toMatchObject({
      version: 1,
      saleIntent: 'FOR_SALE',
      askingPrice: { amountMinor: 280000, currency: 'USD' },
      marketplaceListingCreatedByLite: false,
      sourceTrademarkFactsMutatedByLite: false
    });
    expect(created.saleTerritories).toEqual(['GB', 'US']);

    const replay = await commerceStore().upsert({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      expectedTrademarkAssetVersion: asset.version,
      saleIntent: 'FOR_SALE',
      askingPrice: { amountMinor: 280000, currency: 'usd' },
      negotiable: true,
      saleTerritories: ['us', 'gb'],
      sellerRole: 'AUTHORIZED_REPRESENTATIVE',
      headline: 'Short ecommerce-ready mark',
      sellingPoints: ['Short name', 'Easy pronunciation'],
      aiTags: ['ecommerce', 'short-name'],
      showcaseTemplateReference: 'showcase_clean_1',
      mediaAssetReferences: ['display_artwork_1'],
      idempotencyKey: 'commerce-create-1'
    });
    expect(replay).toEqual(created);

    const updated = await commerceStore().upsert({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      expectedTrademarkAssetVersion: asset.version,
      expectedCommerceProfileVersion: 1,
      saleIntent: 'FOR_SALE',
      askingPrice: { amountMinor: 300000, currency: 'USD' },
      negotiable: false,
      saleTerritories: ['US'],
      sellerRole: 'AUTHORIZED_REPRESENTATIVE',
      headline: 'Updated sale presentation',
      sellingPoints: ['Short name'],
      aiTags: ['ecommerce'],
      idempotencyKey: 'commerce-update-2'
    });
    expect(updated.version).toBe(2);
    expect(updated.commerceProfileId).toBe(created.commerceProfileId);
    expect(updated.marketplaceListingCreatedByLite).toBe(false);
  });

  it('rejects a source Commerce Profile for a Marketplace-only Asset reference', async () => {
    const marketplace = await assetStore().admit({
      workspaceId,
      identity: { jurisdiction: 'US', markText: 'MARKET SOURCE' },
      workspaceRelationships: [
        {
          kind: 'MARKETPLACE_ADDED',
          sourceAssetId: 'market_asset_505',
          sourceReference: marketplaceSource,
          sourceAssetEditableByWorkspace: false
        }
      ],
      sourceReferences: [admissionSource, marketplaceSource],
      idempotencyKey: 'marketplace-only-asset'
    });

    await expect(
      commerceStore().upsert({
        workspaceId,
        trademarkAssetId: marketplace.trademarkAssetId,
        expectedTrademarkAssetVersion: marketplace.version,
        saleIntent: 'FOR_SALE',
        sellerRole: 'AUTHORIZED_REPRESENTATIVE',
        idempotencyKey: 'marketplace-commerce-blocked'
      })
    ).rejects.toMatchObject<Partial<TrademarkAssetCommerceError>>({
      code: 'READ_ONLY_SOURCE',
      status: 403
    });
  });

  it('does not mutate Trademark Asset source identity or relationships when commerce data changes', async () => {
    const writer = assetStore();
    const asset = await writer.admit({
      workspaceId,
      identity: { jurisdiction: 'CN', markText: 'ORIGINAL MARK' },
      workspaceRelationships: [{ kind: 'OWNED', sourceAssetEditableByWorkspace: false }],
      sourceReferences: [admissionSource],
      workspaceTags: ['managed'],
      idempotencyKey: 'source-boundary-asset'
    });

    await commerceStore().upsert({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      expectedTrademarkAssetVersion: asset.version,
      saleIntent: 'FOR_SALE',
      sellerRole: 'OWNER',
      headline: 'Display-only headline',
      mediaAssetReferences: ['ai_enhanced_display_artwork'],
      idempotencyKey: 'source-boundary-commerce'
    });

    const unchanged = await writer.get(workspaceId, asset.trademarkAssetId);
    expect(unchanged.version).toBe(asset.version);
    expect(unchanged.identity).toEqual(asset.identity);
    expect(unchanged.workspaceRelationships).toEqual(asset.workspaceRelationships);
  });
});
