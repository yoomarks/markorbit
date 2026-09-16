import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  noTradingAssetClassificationAuthorityConsequencesV1,
  type TradingListingAssetV1
} from '@markorbit/contracts/trading-asset-classification';
import {
  ManagedDatabase,
  loadMigrationsForOwner,
  migrate,
  type QueryClient
} from '@markorbit/persistence';
import {
  PostgresTradingListingAssetStore,
  type TradingListingAssetCurrentnessV1
} from '../src/trading-listing-asset.js';

const url = process.env.LITE_TRADEMARK_ASSET_TEST_DATABASE_URL;
const required = process.env.LITE_TRADEMARK_ASSET_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error('LITE_TRADEMARK_ASSET_TEST_DATABASE_URL is required for PostgreSQL tests.');
const suite = url ? describe : describe.skip;

const workspaceA = '12121212-1212-4121-8121-121212121212';
const workspaceB = '34343434-3434-4343-8343-343434343434';
const workspaceMissing = '56565656-5656-4565-8565-565656565656';

suite('PostgreSQL Lite Trading Listing Asset persistence', () => {
  let tick = 0;
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-trading-listing-asset-test',
    poolMaximum: 6,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_trademark_asset_test'
  });
  const now = () => new Date(Date.UTC(2026, 8, 16, 1, 0, tick++)).toISOString();
  const assets = (query: QueryClient = database.getPool()) =>
    new PostgresTradingListingAssetStore(database, query, now);

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
        ($1,'Asset A','asset-a'),
        ($2,'Asset B','asset-b'),
        ($3,'Asset Missing','asset-missing')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceA, workspaceB, workspaceMissing]
    );
  });

  beforeEach(async () => {
    tick = 0;
    await database.getPool().query('TRUNCATE lite_trading_listing_asset_versions CASCADE');
  });

  afterAll(() => database.close());

  function aiAsset(workspaceId: string, version = 1): TradingListingAssetV1 {
    return {
      schemaVersion: 1,
      classification: 'LISTING_ASSET',
      listingAssetId: 'listing-asset_pg-currentness-1',
      version,
      trademarkAsset: { id: 'trademark-asset_pg-currentness-1', version: 3 },
      mediaReference: `listing-media_pg-currentness-${version}`,
      owner: { ownerReference: 'lite-trading', ownerVersion: version },
      contentClass: 'AI_CONCEPT',
      provenanceReferences: [`source-asset_pg-currentness-1@${version}`],
      publicationApprovalReference: `asset-publication-approval_pg-${version}`,
      admission: {
        schemaVersion: 1,
        admissionId: `trading-listing-asset-admission_pg-${version}`,
        source: {
          workspaceId,
          studioVisualAsset: { id: 'trading-ai-derived_visual-asset_pg-1', version },
          qualityReview: { id: 'trading-studio-visual-quality-review_pg-1', version },
          showcase: { id: 'trading-showcase_pg-1', version },
          showcasePanelSlotId: 'hero'
        },
        publicRepresentationApproval: {
          method: 'EXPLICIT_HUMAN_ACTION',
          approvalReference: `asset-publication-approval_pg-${version}`,
          approvedAt: `2026-09-16T01:0${version}:00.000Z`
        }
      },
      visibility: 'LISTING_PUBLIC',
      aiConceptLabel: true,
      createdAt: `2026-09-16T01:0${version}:01.000Z`,
      authorityConsequences: noTradingAssetClassificationAuthorityConsequencesV1
    };
  }

  function existingAsset(version = 1): TradingListingAssetV1 {
    return {
      schemaVersion: 1,
      classification: 'LISTING_ASSET',
      listingAssetId: 'listing-asset_existing-pg-1',
      version,
      trademarkAsset: { id: 'trademark-asset_existing-pg-1', version: 1 },
      mediaReference: `listing-media_existing-pg-${version}`,
      owner: { ownerReference: 'seller-record_pg-1', ownerVersion: 1 },
      contentClass: 'EXISTING_ASSET',
      provenanceReferences: ['existing-real-brand-material_pg-1'],
      publicationApprovalReference: 'asset-publication-approval_existing-pg-1',
      visibility: 'LISTING_PUBLIC',
      aiConceptLabel: false,
      createdAt: `2026-09-16T02:0${version}:00.000Z`,
      authorityConsequences: noTradingAssetClassificationAuthorityConsequencesV1
    };
  }

  const expectState = async (
    value: Promise<TradingListingAssetCurrentnessV1>,
    state: TradingListingAssetCurrentnessV1['state']
  ) => expect(value).resolves.toMatchObject({ state });

  it('persists one exact AI Concept Listing Asset and resolves it CURRENT after restart', async () => {
    const first = aiAsset(workspaceA);
    const command = {
      workspaceId: workspaceA,
      asset: first,
      expectedVersion: 0,
      idempotencyKey: 'asset-create'
    };
    expect(await assets().saveAsset(command)).toEqual(first);
    expect(await assets().saveAsset(command)).toEqual(first);

    const restarted = assets();
    expect(await restarted.getAssetVersion(workspaceA, first.listingAssetId, 1)).toEqual(first);
    await expectState(restarted.resolveCurrentness(workspaceA, first.listingAssetId, 1), 'CURRENT');
  });

  it('keeps v1 exact but marks it STALE after v2 becomes current', async () => {
    const first = aiAsset(workspaceA, 1);
    await assets().saveAsset({
      workspaceId: workspaceA,
      asset: first,
      expectedVersion: 0,
      idempotencyKey: 'asset-v1'
    });
    const second = aiAsset(workspaceA, 2);
    await assets().saveAsset({
      workspaceId: workspaceA,
      asset: second,
      expectedVersion: 1,
      idempotencyKey: 'asset-v2'
    });

    expect(await assets().getAssetVersion(workspaceA, first.listingAssetId, 1)).toEqual(first);
    await expectState(assets().resolveCurrentness(workspaceA, first.listingAssetId, 1), 'STALE');
    await expectState(assets().resolveCurrentness(workspaceA, second.listingAssetId, 2), 'CURRENT');
  });

  it('fails closed on idempotency conflicts and stale expected versions', async () => {
    const first = aiAsset(workspaceA);
    await assets().saveAsset({
      workspaceId: workspaceA,
      asset: first,
      expectedVersion: 0,
      idempotencyKey: 'asset-conflict'
    });

    await expect(
      assets().saveAsset({
        workspaceId: workspaceA,
        asset: aiAsset(workspaceA, 2),
        expectedVersion: 1,
        idempotencyKey: 'asset-conflict'
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });

    await expect(
      assets().saveAsset({
        workspaceId: workspaceA,
        asset: first,
        expectedVersion: 0,
        idempotencyKey: 'asset-stale'
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });

  it('isolates identical Listing Asset identities by trusted Workspace envelope', async () => {
    const a = aiAsset(workspaceA);
    const b = aiAsset(workspaceB);
    await assets().saveAsset({
      workspaceId: workspaceA,
      asset: a,
      expectedVersion: 0,
      idempotencyKey: 'asset-ws-a'
    });
    await assets().saveAsset({
      workspaceId: workspaceB,
      asset: b,
      expectedVersion: 0,
      idempotencyKey: 'asset-ws-b'
    });

    expect(await assets().getAssetVersion(workspaceA, a.listingAssetId, 1)).toEqual(a);
    expect(await assets().getAssetVersion(workspaceB, b.listingAssetId, 1)).toEqual(b);
    await expectState(
      assets().resolveCurrentness(workspaceMissing, a.listingAssetId, 1),
      'NOT_FOUND'
    );
  });

  it('rejects an AI Concept admission from another Workspace', async () => {
    await expect(
      assets().saveAsset({
        workspaceId: workspaceA,
        asset: aiAsset(workspaceB),
        expectedVersion: 0,
        idempotencyKey: 'asset-cross-workspace-admission'
      })
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('uses the trusted durable envelope for EXISTING_ASSET Workspace ownership', async () => {
    const asset = existingAsset();
    await assets().saveAsset({
      workspaceId: workspaceA,
      asset,
      expectedVersion: 0,
      idempotencyKey: 'existing-asset-create'
    });

    expect(await assets().getAssetVersion(workspaceA, asset.listingAssetId, 1)).toEqual(asset);
    await expectState(assets().resolveCurrentness(workspaceA, asset.listingAssetId, 1), 'CURRENT');
    await expect(
      assets().getAssetVersion(workspaceB, asset.listingAssetId, 1)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('returns UNKNOWN for corrupt durable state instead of treating it as current', async () => {
    const first = aiAsset(workspaceA);
    await assets().saveAsset({
      workspaceId: workspaceA,
      asset: first,
      expectedVersion: 0,
      idempotencyKey: 'asset-integrity'
    });
    await database.getPool().query(
      `UPDATE lite_trading_listing_asset_versions
          SET document_json='{}'::jsonb
        WHERE workspace_id=$1 AND listing_asset_id=$2 AND version=1`,
      [workspaceA, first.listingAssetId]
    );

    await expectState(assets().resolveCurrentness(workspaceA, first.listingAssetId, 1), 'UNKNOWN');
    await expect(
      assets().getAssetVersion(workspaceA, first.listingAssetId, 1)
    ).rejects.toMatchObject({ code: 'INTEGRITY_FAILURE' });
  });

  it('returns UNAVAILABLE when the currentness reader cannot reach persistence', async () => {
    const unavailableQuery = {
      query: () => Promise.reject(new Error('database unavailable'))
    } as unknown as QueryClient;

    await expectState(
      assets(unavailableQuery).resolveCurrentness(workspaceA, 'listing-asset_pg-currentness-1', 1),
      'UNAVAILABLE'
    );
  });
});
