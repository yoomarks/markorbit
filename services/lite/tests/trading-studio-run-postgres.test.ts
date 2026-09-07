import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TradingStudioRunV1 } from '@markorbit/contracts/trading-studio-run';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import { PostgresTradingStudioRunStore } from '../src/trading-studio-run.js';
import { PostgresLiteTrademarkAssetStore } from '../src/trademark-asset.js';

const url = process.env.LITE_TRADEMARK_ASSET_TEST_DATABASE_URL;
const required = process.env.LITE_TRADEMARK_ASSET_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error('LITE_TRADEMARK_ASSET_TEST_DATABASE_URL is required for PostgreSQL tests.');
const suite = url ? describe : describe.skip;
const workspaceId = '98989898-9898-4989-8989-989898989898';

suite('PostgreSQL Lite Trading Studio Run persistence', () => {
  let tick = 0;
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-trading-studio-run-test',
    poolMaximum: 6,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_trademark_asset_test'
  });
  const now = () => new Date(Date.UTC(2026, 8, 7, 1, 0, tick++)).toISOString();
  const runs = () => new PostgresTradingStudioRunStore(database, database.getPool(), now);

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
      `INSERT INTO workspaces(workspace_id,name,slug) VALUES($1,'Trading Studio','trading-studio')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceId]
    );
  });

  beforeEach(async () => {
    tick = 0;
    await database
      .getPool()
      .query(
        'TRUNCATE lite_trading_studio_run_versions,lite_trademark_asset_commands,lite_trademark_assets CASCADE'
      );
  });
  afterAll(() => database.close());

  async function assetId() {
    const store = new PostgresLiteTrademarkAssetStore(database, database.getPool(), now);
    const asset = await store.admit({
      workspaceId,
      identity: { jurisdiction: 'US', markText: 'ORBIT' },
      workspaceRelationships: [{ kind: 'OWNED', sourceAssetEditableByWorkspace: true }],
      sourceReferences: [
        {
          owner: 'WORKSPACE_USER',
          kind: 'WORKSPACE_ADMISSION',
          sourceId: 'admission_trading-studio',
          sourceVersion: '1',
          observedAt: '2026-09-07T00:00:00Z',
          freshness: 'CURRENT'
        }
      ],
      idempotencyKey: 'admit-trading-studio'
    });
    return asset.trademarkAssetId;
  }

  async function queuedRun(): Promise<TradingStudioRunV1> {
    return {
      schemaVersion: 1,
      studioRunId: 'standard-studio-run_1',
      workspaceId,
      version: 1,
      status: 'QUEUED',
      currentness: 'CURRENT',
      checkpoint: 'NONE',
      trademarkAsset: { id: await assetId(), version: 1 },
      canResume: true,
      createdAt: '2026-09-07T01:00:00Z',
      updatedAt: '2026-09-07T01:00:00Z',
      authorityConsequences: {
        humanSelectionCreated: false,
        deepBuildStarted: false,
        listingCreated: false,
        trademarkTruthMutated: false
      }
    };
  }

  it('replays creation and restores the latest version after restart', async () => {
    const first = await queuedRun();
    const command = { run: first, expectedVersion: 0, idempotencyKey: 'create-run-1' };
    expect(await runs().save(command)).toEqual(first);
    expect(await runs().save(command)).toEqual(first);

    const second: TradingStudioRunV1 = {
      ...first,
      version: 2,
      status: 'RUNNING',
      updatedAt: '2026-09-07T01:01:00Z'
    };
    await runs().save({ run: second, expectedVersion: 1, idempotencyKey: 'advance-run-1' });
    expect(await runs().getLatest(workspaceId, first.studioRunId)).toEqual(second);
  });

  it('rejects stale versions and idempotency-key reuse with another payload', async () => {
    const first = await queuedRun();
    await runs().save({ run: first, expectedVersion: 0, idempotencyKey: 'run-conflict' });
    await expect(
      runs().save({
        run: { ...first, version: 2, status: 'RUNNING' },
        expectedVersion: 1,
        idempotencyKey: 'run-conflict'
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    await expect(
      runs().save({
        run: first,
        expectedVersion: 0,
        idempotencyKey: 'stale-run'
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });

    await expect(
      runs().save({
        run: {
          ...first,
          version: 2,
          status: 'RUNNING',
          trademarkAsset: { ...first.trademarkAsset, version: 2 }
        },
        expectedVersion: 1,
        idempotencyKey: 'stale-asset'
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });
});
