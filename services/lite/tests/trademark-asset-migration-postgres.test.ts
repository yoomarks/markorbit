import path from 'node:path';
import type {
  TrademarkAssetBulkImportResult,
  TrademarkAssetBulkImportStatus
} from '@markorbit/contracts/trademark-asset-portfolio';
import type { TrademarkAssetId } from '@markorbit/contracts/trademark-asset-workspace';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BulkImportTrademarkAssetsInput } from '../src/trademark-asset-portfolio.js';
import {
  TrademarkAssetMigrationInterruptedError,
  TrademarkAssetMigrationOrchestrator,
  type ReviewableTrademarkAssetMigrationRow,
  type TrademarkAssetMigrationAdmissionItem,
  type TrademarkAssetMigrationRunSnapshot
} from '../src/trademark-asset-migration.js';
import { PostgresTrademarkAssetMigrationRunStore } from '../src/trademark-asset-migration-postgres.js';

const url = process.env.LITE_TRADEMARK_ASSET_TEST_DATABASE_URL;
const required = process.env.LITE_TRADEMARK_ASSET_POSTGRES_TEST_REQUIRED === '1';
if (required && !url) throw new Error('LITE_TRADEMARK_ASSET_TEST_DATABASE_URL is required.');
const suite = url ? describe : describe.skip;

const workspaceId = '97979797-9797-4979-8979-979797979797';
const otherWorkspaceId = '98989898-9898-4989-8989-989898989898';
type BulkInput = BulkImportTrademarkAssetsInput;
type BulkStatus = TrademarkAssetBulkImportStatus;

function normalizedItem(index: number): TrademarkAssetMigrationAdmissionItem {
  return {
    identity: { jurisdiction: 'US', markText: `MIGRATION ${index}` },
    externalIdentifiers: [
      {
        kind: 'APPLICATION_NUMBER',
        jurisdiction: 'US',
        value: `97${String(index).padStart(6, '0')}`,
        officialTruthVerifiedByLite: false
      }
    ],
    workspaceRelationships: [{ kind: 'MANAGED', sourceAssetEditableByWorkspace: false }],
    sourceReferences: [
      {
        owner: 'WORKSPACE_USER',
        kind: 'WORKSPACE_ADMISSION',
        sourceId: `migration-postgres-${index}`,
        sourceVersion: '1',
        observedAt: '2026-09-10T02:00:00.000Z',
        freshness: 'CURRENT'
      }
    ]
  };
}

function ownerResult(
  input: Readonly<BulkInput>,
  statusForIndex: (index: number) => BulkStatus = () => 'CREATED'
): TrademarkAssetBulkImportResult {
  const items = input.items.map((_, importIndex) => {
    const status = statusForIndex(importIndex);
    const trademarkAssetId = `trademark-asset_${input.batchKey}_${importIndex}` as TrademarkAssetId;
    return {
      importIndex,
      status,
      ...(status === 'CREATED'
        ? { trademarkAssetId }
        : { reason: `${status.toLowerCase()}-${importIndex}` })
    };
  });
  return {
    schemaVersion: 1,
    workspaceId: input.workspaceId,
    total: items.length,
    created: items.filter((item) => item.status === 'CREATED').length,
    duplicates: items.filter((item) => item.status === 'DUPLICATE').length,
    rejected: items.filter((item) => item.status === 'REJECTED').length,
    items,
    officialTruthVerifiedByLite: false,
    matterCreatedAutomatically: false
  };
}

function reviewRows(total: number): ReviewableTrademarkAssetMigrationRow[] {
  return Array.from({ length: total }, (_, index) => ({
    rowKey: `postgres-row-${String(index).padStart(5, '0')}`,
    item: normalizedItem(index)
  }));
}

suite('PostgreSQL Lite Agency Trademark Asset migration run store', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-trademark-asset-migration-run-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_trademark_asset_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  const store = () => new PostgresTrademarkAssetMigrationRunStore(database.getPool());

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
       ($1,'Migration Run Test','migration-run-test'),
       ($2,'Migration Run Other','migration-run-other')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceId, otherWorkspaceId]
    );
  });

  beforeEach(async () => {
    await database.getPool().query('TRUNCATE lite_trademark_asset_migration_runs');
  });

  afterAll(() => database.close());

  it('survives process restart and resumes from the first incomplete owner chunk', async () => {
    const attemptedBatchKeys: string[] = [];
    let failSecondChunkOnce = true;
    const bulkImport = vi.fn((input: Readonly<BulkInput>) => {
      attemptedBatchKeys.push(input.batchKey);
      if (input.batchKey === 'postgres-resume:chunk:1' && failSecondChunkOnce) {
        failSecondChunkOnce = false;
        return Promise.reject(Object.assign(new Error('temporary owner outage'), { status: 503 }));
      }
      return Promise.resolve(ownerResult(input));
    });
    const rows = reviewRows(201);
    const input = { workspaceId, migrationKey: 'postgres-resume', rows } as const;
    const storeA = store();
    const serviceA = new TrademarkAssetMigrationOrchestrator({ bulkImport }, storeA);
    await serviceA.preview(input);

    let interrupted: Readonly<TrademarkAssetMigrationRunSnapshot> | undefined;
    try {
      await serviceA.commit(input);
      throw new Error('expected migration interruption');
    } catch (error) {
      expect(error).toBeInstanceOf(TrademarkAssetMigrationInterruptedError);
      interrupted = (error as TrademarkAssetMigrationInterruptedError).progress;
    }
    expect(interrupted).toMatchObject({
      status: 'INTERRUPTED',
      nextChunkIndex: 1,
      total: 201,
      created: 100,
      duplicates: 0,
      rejected: 0
    });
    expect(interrupted?.items).toHaveLength(100);
    const attemptsBeforeRestart = [...attemptedBatchKeys];

    const storeB = store();
    const persistedAfterRestart = await storeB.load(workspaceId, 'postgres-resume');
    expect(persistedAfterRestart).toEqual(interrupted);
    await expect(
      storeB.save({
        ...persistedAfterRestart!,
        items: persistedAfterRestart!.items.map((item, index) =>
          index === 0
            ? { ...item, trademarkAssetId: 'trademark-asset_tampered' }
            : item
        ),
        updatedAt: '2026-09-10T03:00:00.000Z'
      })
    ).rejects.toMatchObject({ code: 'PERSISTENCE_CONFLICT' });
    const serviceB = new TrademarkAssetMigrationOrchestrator({ bulkImport }, storeB);
    const completed = await serviceB.commit(input);

    expect(attemptsBeforeRestart).toEqual(['postgres-resume:chunk:0', 'postgres-resume:chunk:1']);
    expect(attemptedBatchKeys.slice(attemptsBeforeRestart.length)).toEqual([
      'postgres-resume:chunk:1',
      'postgres-resume:chunk:2'
    ]);
    expect(completed).toMatchObject({ total: 201, created: 201, duplicates: 0, rejected: 0 });

    const storeC = store();
    const serviceC = new TrademarkAssetMigrationOrchestrator({ bulkImport }, storeC);
    const completedAfterRestart = await serviceC.progress(workspaceId, 'postgres-resume');
    expect(completedAfterRestart).toMatchObject({
      status: 'COMPLETED',
      nextChunkIndex: 3,
      total: 201,
      created: 201
    });
    expect(completedAfterRestart?.items).toHaveLength(201);

    await expect(storeC.save(interrupted)).rejects.toMatchObject({
      code: 'PERSISTENCE_CONFLICT'
    });
    await expect(
      storeC.save({ ...completedAfterRestart!, fingerprint: 'a'.repeat(64) })
    ).rejects.toMatchObject({ code: 'PERSISTENCE_CONFLICT' });

    await expect(
      serviceC.commit({
        workspaceId,
        migrationKey: 'postgres-resume',
        rows: [rows[1]!, rows[0]!, ...rows.slice(2)]
      })
    ).rejects.toMatchObject({ code: 'RUN_MISMATCH' });
    expect(await storeC.load(otherWorkspaceId, 'postgres-resume')).toBeUndefined();
  });
});
