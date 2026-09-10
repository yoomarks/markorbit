import type {
  TrademarkAssetBulkImportResult,
  TrademarkAssetBulkImportStatus
} from '@markorbit/contracts/trademark-asset-portfolio';
import type { TrademarkAssetId } from '@markorbit/contracts/trademark-asset-workspace';
import { describe, expect, it, vi } from 'vitest';
import type { BulkImportTrademarkAssetsInput } from '../src/trademark-asset-portfolio.js';
import {
  InMemoryTrademarkAssetMigrationRunStore,
  MAX_LARGE_TRADEMARK_ASSET_MIGRATION_ITEMS,
  TrademarkAssetMigrationInterruptedError,
  TrademarkAssetMigrationOrchestrator,
  type TrademarkAssetBulkImporter,
  type TrademarkAssetMigrationAdmissionItem
} from '../src/trademark-asset-migration.js';

type BulkInput = BulkImportTrademarkAssetsInput;
type BulkStatus = TrademarkAssetBulkImportStatus;

const workspaceId = '96969696-9696-4969-8969-969696969696';

function normalizedItem(index: number): TrademarkAssetMigrationAdmissionItem {
  return {
    identity: { jurisdiction: 'US', markText: `MARK ${index}` },
    externalIdentifiers: [
      {
        kind: 'APPLICATION_NUMBER',
        jurisdiction: 'US',
        value: `98${String(index).padStart(6, '0')}`,
        officialTruthVerifiedByLite: false
      }
    ],
    workspaceRelationships: [{ kind: 'MANAGED', sourceAssetEditableByWorkspace: false }],
    sourceReferences: [
      {
        owner: 'WORKSPACE_USER',
        kind: 'WORKSPACE_ADMISSION',
        sourceId: `migration-row-${index}`,
        sourceVersion: '1',
        observedAt: '2026-09-10T00:00:00.000Z',
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

function importer(
  implementation: (input: Readonly<BulkInput>) => Promise<TrademarkAssetBulkImportResult>
): TrademarkAssetBulkImporter {
  return { bulkImport: vi.fn(implementation) };
}

function createdImporter() {
  return vi.fn((input: Readonly<BulkInput>) => Promise.resolve(ownerResult(input)));
}

describe('Lite Agency Workspace large Trademark Asset migration orchestration', () => {
  it.each([
    { total: 1, expectedChunks: 1 },
    { total: 100, expectedChunks: 1 },
    { total: 101, expectedChunks: 2 }
  ])('delegates bounded owner chunks', async ({ total, expectedChunks }) => {
    const bulkImport = createdImporter();
    const service = new TrademarkAssetMigrationOrchestrator({ bulkImport });
    const items = Array.from({ length: total }, (_, index) => normalizedItem(index));

    const result = await service.migrate({
      workspaceId,
      migrationKey: 'agency-bootstrap',
      items
    });

    expect(bulkImport).toHaveBeenCalledTimes(expectedChunks);
    expect(bulkImport.mock.calls.every(([input]) => input.items.length <= 100)).toBe(true);
    expect(result).toMatchObject({
      total,
      created: total,
      duplicates: 0,
      rejected: 0,
      chunkCount: expectedChunks,
      officialTruthVerifiedByLite: false,
      matterCreatedAutomatically: false
    });
    expect(result.items.map((item) => item.importIndex)).toEqual(
      Array.from({ length: total }, (_, index) => index)
    );
    expect(bulkImport.mock.calls[0]?.[0].batchKey).toBe('agency-bootstrap:chunk:0');
    if (expectedChunks > 1) {
      expect(bulkImport.mock.calls[1]?.[0].batchKey).toBe('agency-bootstrap:chunk:1');
    }
  });

  it('scales to 2,501 normalized assets through the existing owner', async () => {
    const bulkImport = createdImporter();
    const service = new TrademarkAssetMigrationOrchestrator({ bulkImport });
    const items = Array.from({ length: 2_501 }, (_, index) => normalizedItem(index));

    const result = await service.migrate({
      workspaceId,
      migrationKey: 'legacy-portfolio-2501',
      items
    });

    expect(bulkImport).toHaveBeenCalledTimes(26);
    const firstTwentyFive = bulkImport.mock.calls.slice(0, 25);
    expect(firstTwentyFive.every(([input]) => input.items.length === 100)).toBe(true);
    expect(bulkImport.mock.calls[25]?.[0].items).toHaveLength(1);
    expect(result.total).toBe(2_501);
    expect(result.items.at(-1)?.importIndex).toBe(2_500);
    expect(result.chunkCount).toBe(26);
  });

  it('preserves duplicate and rejected outcomes with global indices', async () => {
    let callIndex = 0;
    const bulkImport = vi.fn((input: Readonly<BulkInput>) => {
      const currentCall = callIndex++;
      return Promise.resolve(
        ownerResult(input, (localIndex) => {
          if (currentCall === 0 && localIndex === 1) return 'DUPLICATE';
          if (currentCall === 1 && localIndex === 0) return 'REJECTED';
          return 'CREATED';
        })
      );
    });
    const service = new TrademarkAssetMigrationOrchestrator({ bulkImport });

    const result = await service.migrate({
      workspaceId,
      migrationKey: 'mixed-outcomes',
      items: Array.from({ length: 101 }, (_, index) => normalizedItem(index))
    });

    expect(result).toMatchObject({ total: 101, created: 99, duplicates: 1, rejected: 1 });
    expect(result.items[1]).toMatchObject({ importIndex: 1, status: 'DUPLICATE' });
    expect(result.items[100]).toMatchObject({ importIndex: 100, status: 'REJECTED' });
  });

  it('uses deterministic chunk keys for safe whole-run replay', async () => {
    const attemptedBatchKeys: string[] = [];
    let failSecondChunkOnce = true;
    const bulkImport = vi.fn((input: Readonly<BulkInput>) => {
      attemptedBatchKeys.push(input.batchKey);
      if (input.batchKey === 'retryable-run:chunk:1' && failSecondChunkOnce) {
        failSecondChunkOnce = false;
        return Promise.reject(new Error('transient owner failure'));
      }
      return Promise.resolve(ownerResult(input));
    });
    const service = new TrademarkAssetMigrationOrchestrator({ bulkImport });
    const input = {
      workspaceId,
      migrationKey: 'retryable-run',
      items: Array.from({ length: 201 }, (_, index) => normalizedItem(index))
    } as const;

    await expect(service.migrate(input)).rejects.toThrow('transient owner failure');
    const replay = await service.migrate(input);

    expect(attemptedBatchKeys).toEqual([
      'retryable-run:chunk:0',
      'retryable-run:chunk:1',
      'retryable-run:chunk:0',
      'retryable-run:chunk:1',
      'retryable-run:chunk:2'
    ]);
    expect(replay.total).toBe(201);
    expect(replay.created).toBe(201);
  });

  it('fails closed on an inconsistent owner result', async () => {
    const invalidOwner = importer((input) =>
      Promise.resolve({ ...ownerResult(input), total: input.items.length + 1 })
    );
    const service = new TrademarkAssetMigrationOrchestrator(invalidOwner);

    await expect(
      service.migrate({
        workspaceId,
        migrationKey: 'bad-owner-result',
        items: [normalizedItem(0)]
      })
    ).rejects.toMatchObject({
      code: 'OWNER_RESULT_INVALID'
    });
  });

  it('rejects invalid migration boundaries before delegation', async () => {
    const bulkImport = createdImporter();
    const service = new TrademarkAssetMigrationOrchestrator({ bulkImport });

    await expect(
      service.migrate({ workspaceId, migrationKey: 'empty', items: [] })
    ).rejects.toMatchObject({
      code: 'INVALID_INPUT'
    });

    await expect(
      service.migrate({
        workspaceId,
        migrationKey: 'x'.repeat(261),
        items: [normalizedItem(0)]
      })
    ).rejects.toMatchObject({
      code: 'INVALID_INPUT'
    });

    const tooManyItems = Array.from(
      { length: MAX_LARGE_TRADEMARK_ASSET_MIGRATION_ITEMS + 1 },
      (_, index) => normalizedItem(index)
    );
    await expect(
      service.migrate({ workspaceId, migrationKey: 'too-many', items: tooManyItems })
    ).rejects.toMatchObject({
      code: 'INVALID_INPUT'
    });
    expect(bulkImport).not.toHaveBeenCalled();
  });
});

describe('Lite Agency Workspace reviewable Trademark Asset migration', () => {
  function reviewRows(total: number) {
    return Array.from({ length: total }, (_, index) => ({
      rowKey: `source-row-${String(index).padStart(5, '0')}`,
      item: normalizedItem(index)
    }));
  }

  it('previews a deterministic large-run chunk plan without Asset admission', async () => {
    const bulkImport = createdImporter();
    const service = new TrademarkAssetMigrationOrchestrator({ bulkImport });
    const preview = await service.preview({
      workspaceId,
      migrationKey: 'review-2501',
      rows: reviewRows(2_501)
    });

    expect(bulkImport).not.toHaveBeenCalled();
    expect(preview).toMatchObject({ total: 2_501, chunkCount: 26 });
    expect(preview.chunks[0]).toMatchObject({ chunkIndex: 0, startIndex: 0, endExclusive: 100 });
    expect(preview.chunks[25]).toMatchObject({
      chunkIndex: 25,
      startIndex: 2_500,
      endExclusive: 2_501,
      rowKeys: ['source-row-02500']
    });
  });

  it('requires preview before commit', async () => {
    const bulkImport = createdImporter();
    const service = new TrademarkAssetMigrationOrchestrator({ bulkImport });
    await expect(
      service.commit({ workspaceId, migrationKey: 'needs-preview', rows: reviewRows(1) })
    ).rejects.toMatchObject({ code: 'PREVIEW_REQUIRED' });
    expect(bulkImport).not.toHaveBeenCalled();
  });

  it('keeps rowKey attached to owner outcomes after commit', async () => {
    const bulkImport = vi.fn((input: Readonly<BulkInput>) =>
      Promise.resolve(
        ownerResult(input, (index) => {
          if (index === 1) return 'DUPLICATE';
          if (index === 2) return 'REJECTED';
          return 'CREATED';
        })
      )
    );
    const service = new TrademarkAssetMigrationOrchestrator({ bulkImport });
    const input = { workspaceId, migrationKey: 'row-results', rows: reviewRows(3) } as const;

    await service.preview(input);
    const result = await service.commit(input);

    expect(result).toMatchObject({ total: 3, created: 1, duplicates: 1, rejected: 1 });
    expect(result.items[0]).toMatchObject({ rowKey: 'source-row-00000', status: 'CREATED' });
    expect(result.items[1]).toMatchObject({ rowKey: 'source-row-00001', status: 'DUPLICATE' });
    expect(result.items[2]).toMatchObject({ rowKey: 'source-row-00002', status: 'REJECTED' });
    expect(result.officialTruthVerifiedByLite).toBe(false);
    expect(result.matterCreatedAutomatically).toBe(false);
  });
  it('fails closed when a reviewed migration key is reused with reordered rows', async () => {
    const bulkImport = createdImporter();
    const service = new TrademarkAssetMigrationOrchestrator({ bulkImport });
    const rows = reviewRows(2);
    await service.preview({ workspaceId, migrationKey: 'review-order-lock', rows });

    await expect(
      service.commit({
        workspaceId,
        migrationKey: 'review-order-lock',
        rows: [rows[1]!, rows[0]!]
      })
    ).rejects.toMatchObject({ code: 'RUN_MISMATCH' });
    expect(bulkImport).not.toHaveBeenCalled();
  });

  it('persists trustworthy progress and resumes from the first incomplete chunk', async () => {
    const store = new InMemoryTrademarkAssetMigrationRunStore();
    const attemptedBatchKeys: string[] = [];
    let failSecondChunkOnce = true;
    const bulkImport = vi.fn((input: Readonly<BulkInput>) => {
      attemptedBatchKeys.push(input.batchKey);
      if (input.batchKey === 'resume-run:chunk:1' && failSecondChunkOnce) {
        failSecondChunkOnce = false;
        return Promise.reject(Object.assign(new Error('temporary owner outage'), { status: 503 }));
      }
      return Promise.resolve(ownerResult(input));
    });
    const input = { workspaceId, migrationKey: 'resume-run', rows: reviewRows(201) } as const;
    const first = new TrademarkAssetMigrationOrchestrator({ bulkImport }, store);
    await first.preview(input);

    const interrupted = await first.commit(input).catch((error: unknown) => error);
    expect(interrupted).toBeInstanceOf(TrademarkAssetMigrationInterruptedError);
    expect(interrupted).toMatchObject({
      code: 'OWNER_INTERRUPTED',
      retryable: true,
      progress: { status: 'INTERRUPTED', nextChunkIndex: 1, created: 100, total: 201 }
    });
    expect((await first.progress(workspaceId, 'resume-run'))?.items).toHaveLength(100);

    const resumed = new TrademarkAssetMigrationOrchestrator({ bulkImport }, store);
    const result = await resumed.commit(input);
    expect(attemptedBatchKeys).toEqual([
      'resume-run:chunk:0',
      'resume-run:chunk:1',
      'resume-run:chunk:1',
      'resume-run:chunk:2'
    ]);
    expect(result).toMatchObject({ total: 201, created: 201, duplicates: 0, rejected: 0 });
    expect(result.items[100]).toMatchObject({ rowKey: 'source-row-00100', importIndex: 100 });
    expect((await resumed.progress(workspaceId, 'resume-run'))?.status).toBe('COMPLETED');
  });
  it('fails closed on a corrupt owner result during reviewed commit', async () => {
    const bulkImport = vi.fn((input: Readonly<BulkInput>) =>
      Promise.resolve({ ...ownerResult(input), total: input.items.length + 1 })
    );
    const service = new TrademarkAssetMigrationOrchestrator({ bulkImport });
    const input = {
      workspaceId,
      migrationKey: 'review-corrupt-owner',
      rows: reviewRows(1)
    } as const;
    await service.preview(input);

    await expect(service.commit(input)).rejects.toMatchObject({ code: 'OWNER_RESULT_INVALID' });
    expect((await service.progress(workspaceId, 'review-corrupt-owner'))?.status).toBe(
      'INTERRUPTED'
    );
  });
});
