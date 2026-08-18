import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import type { TrademarkAssetSourceReference } from '@markorbit/contracts/trademark-asset-workspace';
import {
  PostgresLiteTrademarkAssetStore,
  TrademarkAssetPersistenceError
} from '../src/trademark-asset.js';

const url = process.env.LITE_TRADEMARK_ASSET_TEST_DATABASE_URL;
const required = process.env.LITE_TRADEMARK_ASSET_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'LITE_TRADEMARK_ASSET_TEST_DATABASE_URL is required when LITE_TRADEMARK_ASSET_POSTGRES_TEST_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const workspaceId = '74747474-7474-4747-8747-747474747474';
const otherWorkspaceId = '75757575-7575-4757-8757-757575757575';

const admissionSource = (version = '1'): TrademarkAssetSourceReference => ({
  owner: 'WORKSPACE_USER',
  kind: 'WORKSPACE_ADMISSION',
  sourceId: 'user-admission-us-98123456',
  sourceVersion: version,
  observedAt: '2026-08-19T00:00:00.000Z',
  freshness: 'CURRENT'
});

suite('PostgreSQL Lite Trademark Assets', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-trademark-asset-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_trademark_asset_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 7, 19, 0, 0, tick++)).toISOString();
  const store = () => new PostgresLiteTrademarkAssetStore(database, database.getPool(), now);

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
      `INSERT INTO workspaces (workspace_id,name,slug) VALUES
       ($1,'Trademark Asset Test','trademark-asset-test'),
       ($2,'Trademark Asset Other','trademark-asset-other')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceId, otherWorkspaceId]
    );
  });

  beforeEach(async () => {
    tick = 0;
    await database
      .getPool()
      .query('TRUNCATE lite_trademark_asset_commands,lite_trademark_assets CASCADE');
  });

  afterAll(() => database.close());

  const admit = (service: PostgresLiteTrademarkAssetStore, key = 'admit-1') =>
    service.admit({
      workspaceId,
      identity: {
        jurisdiction: 'us',
        applicationNumber: '98123456',
        registrationNumber: '7654321',
        markText: 'MARKORBIT'
      },
      niceClasses: ['42', '35', '42'],
      ownerOrClientReference: 'client-private-001',
      sourceObservedStatus: 'REGISTERED',
      sourceReferences: [admissionSource()],
      idempotencyKey: key
    });

  it('persists a deterministic Workspace-private Asset with exact admission provenance', async () => {
    const asset = await admit(store());
    expect(asset.trademarkAssetId).toMatch(/^trademark-asset_[0-9a-f]{32}$/);
    expect(asset.identity.jurisdiction).toBe('US');
    expect(asset.niceClasses).toEqual(['35', '42']);
    expect(asset.sourceReferences).toEqual([admissionSource()]);
    expect(asset.officialTruthVerifiedByLite).toBe(false);
    expect(asset.filingExecutedByLite).toBe(false);
  });

  it('replays the same command after store restart and rejects a changed idempotent request', async () => {
    const first = await admit(store(), 'stable-admission');
    const restarted = store();
    expect(await admit(restarted, 'stable-admission')).toEqual(first);
    await expect(
      restarted.admit({
        workspaceId,
        identity: first.identity,
        niceClasses: ['9'],
        sourceReferences: [admissionSource()],
        idempotencyKey: 'stable-admission'
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', status: 409 });
  });

  it('deduplicates the same canonical identity under concurrency', async () => {
    const service = store();
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) => admit(service, `concurrent-${index}`))
    );
    expect(new Set(results.map((asset) => asset.trademarkAssetId)).size).toBe(1);
    const rows = await database
      .getPool()
      .query('SELECT count(*)::int AS count FROM lite_trademark_assets WHERE workspace_id=$1', [
        workspaceId
      ]);
    expect((rows.rows[0] as { count: number } | undefined)?.count).toBe(1);
  });

  it('isolates find and list by Workspace even when an Asset id is guessed directly', async () => {
    const service = store();
    const asset = await admit(service);
    expect(await service.find(otherWorkspaceId, asset.trademarkAssetId)).toBeUndefined();
    expect(await service.list(otherWorkspaceId)).toEqual([]);
    expect((await service.list(workspaceId)).map((item) => item.trademarkAssetId)).toEqual([
      asset.trademarkAssetId
    ]);
  });

  it('updates only private Workspace metadata with optimistic concurrency and durable replay', async () => {
    const service = store();
    const asset = await admit(service);
    const updated = await service.updateWorkspaceMetadata({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      expectedVersion: 1,
      workspaceTags: ['priority', 'client-a', 'priority'],
      workspaceNotes: ['Check renewal documents'],
      idempotencyKey: 'metadata-1'
    });
    expect(updated.version).toBe(2);
    expect(updated.workspaceTags).toEqual(['client-a', 'priority']);
    expect(updated.workspaceNotes).toEqual(['Check renewal documents']);
    expect(updated.identity).toEqual(asset.identity);
    expect(updated.sourceReferences).toEqual(asset.sourceReferences);
    expect(updated.officialTruthVerifiedByLite).toBe(false);
    expect(updated.filingExecutedByLite).toBe(false);

    const restarted = store();
    expect(
      await restarted.updateWorkspaceMetadata({
        workspaceId,
        trademarkAssetId: asset.trademarkAssetId,
        expectedVersion: 1,
        workspaceTags: ['priority', 'client-a'],
        workspaceNotes: ['Check renewal documents'],
        idempotencyKey: 'metadata-1'
      })
    ).toEqual(updated);
    expect(await restarted.find(workspaceId, asset.trademarkAssetId)).toEqual(updated);

    await expect(
      restarted.updateWorkspaceMetadata({
        workspaceId,
        trademarkAssetId: asset.trademarkAssetId,
        expectedVersion: 1,
        workspaceTags: ['stale-write'],
        workspaceNotes: [],
        idempotencyKey: 'metadata-stale'
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT', status: 409 });
  });

  it('requires a registry-style identifier instead of treating mark text alone as canonical identity', async () => {
    await expect(
      store().admit({
        workspaceId,
        identity: { jurisdiction: 'US', markText: 'MARKORBIT' },
        sourceReferences: [admissionSource()],
        idempotencyKey: 'mark-only'
      })
    ).rejects.toBeInstanceOf(TrademarkAssetPersistenceError);
  });
});
