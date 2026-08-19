import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import { PostgresLiteTrademarkAssetStore } from '../src/trademark-asset.js';
import { TrademarkAssetPortfolioService } from '../src/trademark-asset-portfolio.js';

const url = process.env.LITE_TRADEMARK_ASSET_TEST_DATABASE_URL;
const required = process.env.LITE_TRADEMARK_ASSET_POSTGRES_TEST_REQUIRED === '1';
if (required && !url) {
  throw new Error(
    'LITE_TRADEMARK_ASSET_TEST_DATABASE_URL is required when LITE_TRADEMARK_ASSET_POSTGRES_TEST_REQUIRED=1.'
  );
}
const suite = url ? describe : describe.skip;
const workspaceId = '94949494-9494-4949-8949-949494949494';
const observedAt = '2026-08-19T04:30:00.000Z';

const admissionSource = {
  owner: 'WORKSPACE_USER',
  kind: 'WORKSPACE_ADMISSION',
  sourceId: 'admission_m10-wp04',
  sourceVersion: '1',
  observedAt,
  freshness: 'CURRENT'
} as const;
const marketplaceSource = {
  owner: 'MARKETPLACE',
  kind: 'MARKETPLACE_LISTING',
  sourceId: 'listing_m10-wp04',
  sourceVersion: '1',
  observedAt,
  freshness: 'CURRENT'
} as const;

suite('PostgreSQL M10-WP-04 Trademark Asset Portfolio', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-trademark-asset-portfolio-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_trademark_asset_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  const store = () =>
    new PostgresLiteTrademarkAssetStore(
      database,
      database.getPool(),
      () => '2026-08-19T04:35:00.000Z'
    );
  const portfolio = () => new TrademarkAssetPortfolioService(database.getPool(), store());

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
       VALUES ($1,'Trademark Asset Portfolio Test','trademark-asset-portfolio-test')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceId]
    );
  });

  beforeEach(async () => {
    await database
      .getPool()
      .query(
        'TRUNCATE lite_trademark_asset_commands,lite_trademark_asset_identifiers,lite_trademark_assets CASCADE'
      );
  });

  afterAll(() => database.close());

  it('executes JSONB relationship/tag filters and cursor pagination on PostgreSQL', async () => {
    const writer = store();
    await writer.admit({
      workspaceId,
      identity: { jurisdiction: 'US', markText: 'MARKORBIT ONE' },
      workspaceRelationships: [{ kind: 'MANAGED', sourceAssetEditableByWorkspace: false }],
      sourceReferences: [admissionSource],
      workspaceTags: ['priority'],
      idempotencyKey: 'portfolio-managed-one'
    });
    const marketplace = await writer.admit({
      workspaceId,
      identity: { jurisdiction: 'GB', markText: 'MARKORBIT MARKET' },
      workspaceRelationships: [
        {
          kind: 'MARKETPLACE_ADDED',
          sourceAssetId: 'market_asset_1',
          sourceReference: marketplaceSource,
          sourceAssetEditableByWorkspace: false
        }
      ],
      sourceReferences: [admissionSource, marketplaceSource],
      workspaceTags: ['priority', 'sale'],
      idempotencyKey: 'portfolio-marketplace-one'
    });
    await writer.admit({
      workspaceId,
      identity: { jurisdiction: 'US', markText: 'OTHER MARK' },
      workspaceRelationships: [{ kind: 'OWNED', sourceAssetEditableByWorkspace: false }],
      sourceReferences: [admissionSource],
      workspaceTags: ['archive'],
      idempotencyKey: 'portfolio-owned-other'
    });

    const filtered = await portfolio().search({
      workspaceId,
      filter: {
        query: 'markorbit',
        relationshipKinds: ['MARKETPLACE_ADDED'],
        workspaceTags: ['sale'],
        jurisdictions: ['gb']
      }
    });
    expect(filtered.assets.map((asset) => asset.trademarkAssetId)).toEqual([
      marketplace.trademarkAssetId
    ]);

    const first = await portfolio().search({ workspaceId, limit: 1 });
    expect(first.assets).toHaveLength(1);
    expect(first.hasMore).toBe(true);
    const nextCursor = first.nextCursor;
    expect(nextCursor).toBeTruthy();
    if (!nextCursor) throw new Error('Expected next Trademark Asset Portfolio cursor.');
    const second = await portfolio().search({
      workspaceId,
      limit: 1,
      cursor: nextCursor
    });
    expect(second.assets).toHaveLength(1);
    expect(second.assets[0]?.trademarkAssetId).not.toBe(first.assets[0]?.trademarkAssetId);
  });

  it('reports duplicate identifiers without aborting the whole import batch', async () => {
    const writer = store();
    await writer.admit({
      workspaceId,
      identity: { jurisdiction: 'US', markText: 'EXISTING' },
      externalIdentifiers: [
        {
          kind: 'APPLICATION_NUMBER',
          jurisdiction: 'US',
          value: '98123456',
          officialTruthVerifiedByLite: false
        }
      ],
      workspaceRelationships: [{ kind: 'MANAGED', sourceAssetEditableByWorkspace: false }],
      sourceReferences: [admissionSource],
      idempotencyKey: 'existing-before-import'
    });

    const result = await portfolio().bulkImport({
      workspaceId,
      batchKey: 'bulk-import-real-pg',
      items: [
        {
          identity: { jurisdiction: 'US', markText: 'DUPLICATE' },
          externalIdentifiers: [
            {
              kind: 'APPLICATION_NUMBER',
              jurisdiction: 'US',
              value: '98123456',
              officialTruthVerifiedByLite: false
            }
          ],
          workspaceRelationships: [{ kind: 'MANAGED', sourceAssetEditableByWorkspace: false }],
          sourceReferences: [admissionSource]
        },
        {
          identity: { jurisdiction: 'US', markText: 'NEW ASSET' },
          externalIdentifiers: [
            {
              kind: 'APPLICATION_NUMBER',
              jurisdiction: 'US',
              value: '98999999',
              officialTruthVerifiedByLite: false
            }
          ],
          workspaceRelationships: [{ kind: 'MANAGED', sourceAssetEditableByWorkspace: false }],
          sourceReferences: [admissionSource]
        }
      ]
    });

    expect(result).toMatchObject({ total: 2, created: 1, duplicates: 1, rejected: 0 });
  });

  it('allows private tags on a Marketplace reference without changing source authority', async () => {
    const marketplace = await store().admit({
      workspaceId,
      identity: { jurisdiction: 'US', markText: 'MARKET SALE' },
      workspaceRelationships: [
        {
          kind: 'MARKETPLACE_ADDED',
          sourceAssetId: 'market_asset_2',
          sourceReference: marketplaceSource,
          sourceAssetEditableByWorkspace: false
        }
      ],
      sourceReferences: [admissionSource, marketplaceSource],
      workspaceTags: ['watch'],
      idempotencyKey: 'marketplace-tag-source'
    });

    const result = await portfolio().bulkTag({
      workspaceId,
      batchKey: 'marketplace-private-tags',
      trademarkAssetIds: [marketplace.trademarkAssetId],
      addTags: ['priority'],
      removeTags: ['watch']
    });
    const updated = await store().get(workspaceId, marketplace.trademarkAssetId);

    expect(result.marketplaceSourceMutated).toBe(false);
    expect(updated.workspaceTags).toEqual(['priority']);
    expect(updated.workspaceRelationships[0]).toMatchObject({
      kind: 'MARKETPLACE_ADDED',
      sourceAssetId: 'market_asset_2',
      sourceAssetEditableByWorkspace: false
    });
  });
});
