import type {
  TrademarkAssetBulkImportResult,
  TrademarkAssetBulkImportStatus
} from '@markorbit/contracts/trademark-asset-portfolio';
import type { TrademarkAssetId } from '@markorbit/contracts/trademark-asset-workspace';
import { describe, expect, it, vi } from 'vitest';
import type { BulkImportTrademarkAssetsInput } from '../src/trademark-asset-portfolio.js';
import {
  MAX_LARGE_TRADEMARK_ASSET_MIGRATION_ITEMS,
  TrademarkAssetMigrationOrchestrationError,
  TrademarkAssetMigrationOrchestrator,
  type TrademarkAssetMigrationAdmissionItem,
  type TrademarkAssetBulkImporter
} from '../src/trademark-asset-migration.js';

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
  input: Readonly<BulkImportTrademarkAssetsInput>,
  statusForIndex: (index: number) => TrademarkAssetBulkImportStatus = () => 'CREATED'
): TrademarkAssetBulkImportResult {
  const items = input.items.map((_, importIndex) => {
    const status = statusForIndex(importIndex);
    return {
      importIndex,
      status,
      ...(status === 'CREATED'
        ? {
            trademarkAssetId: `trademark-asset_${input.batchKey}_${importIndex}` as TrademarkAssetId
          }
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
  implementation: (
    input: Readonly<BulkImportTrademarkAssetsInput>
  ) => Promise<TrademarkAssetBulkImportResult>
): TrademarkAssetBulkImporter {
  return { bulkImport: vi.fn(implementation) };
}

describe('Lite Agency Workspace large Trademark Asset migration orchestration', () => {
  it.each([
    { total: 1, expectedChunks: 1 },
    { total: 100, expectedChunks: 1 },
    { total: 101, expectedChunks: 2 }
  ])(
    'delegates $total normalized assets in bounded owner chunks',
    async ({ total, expectedChunks }) => {
      const bulkImport = vi.fn(async (input: Readonly<BulkImportTrademarkAssetsInput>) =>
        ownerResult(input)
      );
      const service = new TrademarkAssetMigrationOrchestrator({ bulkImport });
      const items = Array.from({ length: total }, (_, index) => normalizedItem(index));

      const result = await service.migrate({
        workspaceId,
        migrationKey: 'agency-bootstrap',
        items
      });

      expect(bulkImport).toHaveBeenCalledTimes(expectedChunks);
      expect(
        bulkImport.mock.calls.every(
          ([input]) => input.items.length >= 1 && input.items.length <= 100
        )
      ).toBe(true);
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
    }
  );

  it('scales to a realistic multi-thousand normalized migration without bypassing bulk import', async () => {
    const bulkImport = vi.fn(async (input: Readonly<BulkImportTrademarkAssetsInput>) =>
      ownerResult(input)
    );
    const service = new TrademarkAssetMigrationOrchestrator({ bulkImport });
    const items = Array.from({ length: 2_501 }, (_, index) => normalizedItem(index));

    const result = await service.migrate({
      workspaceId,
      migrationKey: 'legacy-portfolio-2501',
      items
    });

    expect(bulkImport).toHaveBeenCalledTimes(26);
    expect(
      bulkImport.mock.calls.slice(0, 25).every(([input]) => input.items.length === 100)
    ).toBe(true);
    expect(bulkImport.mock.calls[25]?.[0].items).toHaveLength(1);
    expect(result.total).toBe(2_501);
    expect(result.items.at(-1)?.importIndex).toBe(2_500);
    expect(result.chunkCount).toBe(26);
  });

  it('preserves duplicate and rejected outcomes while remapping local indices globally', async () => {
    let callIndex = 0;
    const bulkImport = vi.fn(async (input: Readonly<BulkImportTrademarkAssetsInput>) => {
      const currentCall = callIndex++;
      return ownerResult(input, (localIndex) => {
        if (currentCall === 0 && localIndex === 1) return 'DUPLICATE';
        if (currentCall === 1 && localIndex === 0) return 'REJECTED';
        return 'CREATED';
      });
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

  it('keeps chunk batch keys deterministic so a failed run can be replayed safely', async () => {
    const attemptedBatchKeys: string[] = [];
    let failSecondChunkOnce = true;
    const bulkImport = vi.fn(async (input: Readonly<BulkImportTrademarkAssetsInput>) => {
      attemptedBatchKeys.push(input.batchKey);
      if (input.batchKey === 'retryable-run:chunk:1' && failSecondChunkOnce) {
        failSecondChunkOnce = false;
        throw new Error('transient owner failure');
      }
      return ownerResult(input);
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

  it('fails closed when the bulk-import owner returns an inconsistent chunk result', async () => {
    const service = new TrademarkAssetMigrationOrchestrator(
      importer(async (input) => ({ ...ownerResult(input), total: input.items.length + 1 }))
    );

    await expect(
      service.migrate({
        workspaceId,
        migrationKey: 'bad-owner-result',
        items: [normalizedItem(0)]
      })
    ).rejects.toMatchObject<Partial<TrademarkAssetMigrationOrchestrationError>>({
      code: 'OWNER_RESULT_INVALID'
    });
  });

  it('rejects empty, oversized and unsafe migration keys before delegation', async () => {
    const bulkImport = vi.fn(async (input: Readonly<BulkImportTrademarkAssetsInput>) =>
      ownerResult(input)
    );
    const service = new TrademarkAssetMigrationOrchestrator({ bulkImport });

    await expect(
      service.migrate({ workspaceId, migrationKey: 'empty', items: [] })
    ).rejects.toMatchObject<Partial<TrademarkAssetMigrationOrchestrationError>>({
      code: 'INVALID_INPUT'
    });
    await expect(
      service.migrate({
        workspaceId,
        migrationKey: 'x'.repeat(261),
        items: [normalizedItem(0)]
      })
    ).rejects.toMatchObject<Partial<TrademarkAssetMigrationOrchestrationError>>({
      code: 'INVALID_INPUT'
    });
    await expect(
      service.migrate({
        workspaceId,
        migrationKey: 'too-many',
        items: Array.from(
          { length: MAX_LARGE_TRADEMARK_ASSET_MIGRATION_ITEMS + 1 },
          (_, index) => normalizedItem(index)
        )
      })
    ).rejects.toMatchObject<Partial<TrademarkAssetMigrationOrchestrationError>>({
      code: 'INVALID_INPUT'
    });
    expect(bulkImport).not.toHaveBeenCalled();
  });
});
