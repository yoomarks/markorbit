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
  mapHistoricalTrademarkAssetTabularRows,
  prepareHistoricalTrademarkAssetImport,
  TrademarkAssetMigrationInterruptedError,
  TrademarkAssetMigrationOrchestrator,
  type TrademarkAssetBulkImporter,
  type TrademarkAssetMigrationAdmissionItem
} from '../src/trademark-asset-migration.js';

type BulkInput = BulkImportTrademarkAssetsInput;
type BulkStatus = TrademarkAssetBulkImportStatus;

const workspaceId = '96969696-9696-4969-8969-969696969696';
const sourceFingerprintA = 'a'.repeat(64);
const sourceFingerprintB = 'b'.repeat(64);

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

describe('Lite Agency Workspace historical import preparation', () => {
  it('separates READY and UNRESOLVED rows into one deterministic receipt', async () => {
    const input = {
      workspaceId,
      migrationKey: 'historical-preparation',
      sourceFingerprintSha256: sourceFingerprintA,
      rows: [
        { rowKey: 'row-0', state: 'READY', item: normalizedItem(0) },
        { rowKey: 'row-1', state: 'UNRESOLVED', reason: ' applicant identity ambiguous ' },
        { rowKey: 'row-2', state: 'READY', item: normalizedItem(2) }
      ]
    } as const;

    const first = prepareHistoricalTrademarkAssetImport(input);
    const replay = prepareHistoricalTrademarkAssetImport(input);

    expect(replay.manifestFingerprintSha256).toBe(first.manifestFingerprintSha256);
    expect(first).toMatchObject({
      total: 3,
      ready: 2,
      unresolved: 1,
      sourceFingerprintSha256: sourceFingerprintA,
      officialTruthVerifiedByLite: false,
      assetsCreatedAutomatically: false,
      matterCreatedAutomatically: false
    });
    expect(first.readyRows.map((row) => row.sourceIndex)).toEqual([0, 2]);
    expect(first.unresolvedRows).toEqual([
      { rowKey: 'row-1', sourceIndex: 1, reason: 'applicant identity ambiguous' }
    ]);
    expect(first.migrationInput?.rows.map((row) => row.rowKey)).toEqual(['row-0', 'row-2']);

    const bulkImport = createdImporter();
    const orchestrator = new TrademarkAssetMigrationOrchestrator({ bulkImport });
    await orchestrator.preview(first.migrationInput!);
    expect(bulkImport).not.toHaveBeenCalled();
  });

  it('returns a review receipt without migration input when every row is unresolved', () => {
    const receipt = prepareHistoricalTrademarkAssetImport({
      workspaceId,
      migrationKey: 'all-unresolved',
      rows: [
        { rowKey: 'row-0', state: 'UNRESOLVED', reason: 'missing application number' },
        { rowKey: 'row-1', state: 'UNRESOLVED', reason: 'jurisdiction unknown' }
      ]
    });

    expect(receipt).toMatchObject({ total: 2, ready: 0, unresolved: 2 });
    expect(receipt.migrationInput).toBeUndefined();
  });

  it('fails closed on duplicate row keys and malformed row outcomes', () => {
    expect(() =>
      prepareHistoricalTrademarkAssetImport({
        workspaceId,
        migrationKey: 'duplicate-row-key',
        rows: [
          { rowKey: 'same', state: 'READY', item: normalizedItem(0) },
          { rowKey: ' same ', state: 'UNRESOLVED', reason: 'needs review' }
        ]
      })
    ).toThrow('rowKey must be unique');

    expect(() =>
      prepareHistoricalTrademarkAssetImport({
        workspaceId,
        migrationKey: 'bad-unresolved',
        rows: [{ rowKey: 'row-0', state: 'UNRESOLVED', reason: '   ' }]
      })
    ).toThrow('reason must contain');

    expect(() =>
      prepareHistoricalTrademarkAssetImport({
        workspaceId,
        migrationKey: 'bad-ready',
        rows: [{ rowKey: 'row-0', state: 'READY', item: null } as never]
      })
    ).toThrow('requires one normalized item');
  });
});

describe('Lite Agency Workspace historical tabular mapping', () => {
  const baseTabularInput = {
    workspaceId,
    sourceFingerprintSha256: sourceFingerprintA,
    sourceArtifactId: 'legacy-portfolio.csv',
    sourceArtifactVersion: 'v1',
    observedAt: '2026-09-10T01:02:03.000Z',
    relationshipKind: 'MANAGED' as const,
    headers: ['Jurisdiction', 'Mark', 'Application', 'Registration', 'Madrid', 'Internal'],
    columns: {
      jurisdiction: 'Jurisdiction',
      markText: 'Mark',
      applicationNumber: 'Application',
      registrationNumber: 'Registration',
      madridIrNumber: 'Madrid',
      internalReference: 'Internal'
    }
  } as const;

  it('maps decoded rows into the existing deterministic preparation receipt', async () => {
    const input = {
      ...baseTabularInput,
      migrationKey: 'historical-tabular-map',
      rows: [
        { rowKey: 'legacy-row-001', cells: ['us', 'ALPHA', '98123456', '', '', ''] },
        { rowKey: 'legacy-row-002', cells: ['CN', 'BETA', '', '1234567', '1800000', 'INT-2'] },
        { rowKey: 'legacy-row-003', cells: ['', 'GAMMA', '98123458', '', '', ''] },
        { rowKey: 'legacy-row-004', cells: ['US', '', '98123459', '', '', ''] },
        { rowKey: 'legacy-row-005', cells: ['US', 'DELTA', '', '', '', ''] }
      ]
    } as const;

    const first = mapHistoricalTrademarkAssetTabularRows(input);
    const replay = mapHistoricalTrademarkAssetTabularRows(input);
    expect(replay.manifestFingerprintSha256).toBe(first.manifestFingerprintSha256);
    expect(first).toMatchObject({ total: 5, ready: 2, unresolved: 3 });
    expect(first.readyRows.map((row) => row.rowKey)).toEqual(['legacy-row-001', 'legacy-row-002']);
    expect(first.unresolvedRows.map((row) => row.reason)).toEqual([
      'jurisdiction is missing',
      'mark text is missing',
      'at least one exact external identifier is required'
    ]);

    const firstItem = first.migrationInput!.rows[0]!.item;
    expect(firstItem.identity).toEqual({ jurisdiction: 'US', markText: 'ALPHA' });
    expect(firstItem.externalIdentifiers).toEqual([
      expect.objectContaining({
        kind: 'APPLICATION_NUMBER',
        jurisdiction: 'US',
        value: '98123456',
        officialTruthVerifiedByLite: false
      })
    ]);
    expect(firstItem.workspaceRelationships).toEqual([
      expect.objectContaining({ kind: 'MANAGED', sourceAssetEditableByWorkspace: true })
    ]);
    expect(firstItem.sourceReferences[0]).toMatchObject({
      owner: 'WORKSPACE_USER',
      kind: 'WORKSPACE_ADMISSION',
      sourceVersion: 'v1',
      sourceFingerprintSha256: sourceFingerprintA,
      observedAt: '2026-09-10T01:02:03.000Z',
      freshness: 'UNKNOWN'
    });
    expect(firstItem.sourceReferences[0]?.sourceId).toMatch(
      /^legacy-portfolio\.csv#row:[0-9a-f]{24}$/u
    );

    const bulkImport = createdImporter();
    const orchestrator = new TrademarkAssetMigrationOrchestrator({ bulkImport });
    await orchestrator.preview(first.migrationInput!);
    expect(bulkImport).not.toHaveBeenCalled();
  });

  it('keeps the reviewed relationship kind explicit and never infers Applicant/customer truth', () => {
    const rows = [
      {
        rowKey: 'explicit-row',
        cells: ['US', 'OMEGA', '98120000', '', '', '', 'Applicant Display Name']
      }
    ] as const;
    const headers = [...baseTabularInput.headers, 'Applicant Name'] as const;
    const managed = mapHistoricalTrademarkAssetTabularRows({
      ...baseTabularInput,
      headers,
      migrationKey: 'explicit-managed',
      relationshipKind: 'MANAGED',
      rows
    });
    const owned = mapHistoricalTrademarkAssetTabularRows({
      ...baseTabularInput,
      headers,
      migrationKey: 'explicit-owned',
      relationshipKind: 'OWNED',
      rows
    });

    expect(managed.migrationInput!.rows[0]!.item.workspaceRelationships[0]?.kind).toBe('MANAGED');
    expect(owned.migrationInput!.rows[0]!.item.workspaceRelationships[0]?.kind).toBe('OWNED');
    expect(managed.migrationInput!.rows[0]!.item).not.toHaveProperty('ownerOrClientReference');
  });

  it('fails closed on ambiguous or unknown structural column mappings', () => {
    expect(() =>
      mapHistoricalTrademarkAssetTabularRows({
        ...baseTabularInput,
        migrationKey: 'duplicate-headers',
        headers: [' Jurisdiction ', 'Jurisdiction', 'Mark', 'Application'],
        columns: {
          jurisdiction: 'Jurisdiction',
          markText: 'Mark',
          applicationNumber: 'Application'
        },
        rows: [{ rowKey: 'row-1', cells: ['US', 'US', 'ALPHA', '98123456'] }]
      })
    ).toThrow('duplicated after trimming');

    expect(() =>
      mapHistoricalTrademarkAssetTabularRows({
        ...baseTabularInput,
        migrationKey: 'unknown-column',
        columns: {
          ...baseTabularInput.columns,
          registrationNumber: 'Unknown Header'
        },
        rows: [{ rowKey: 'row-1', cells: ['US', 'ALPHA', '98123456', '', '', ''] }]
      })
    ).toThrow('references unknown header');

    expect(() =>
      mapHistoricalTrademarkAssetTabularRows({
        ...baseTabularInput,
        migrationKey: 'same-source-column',
        columns: {
          jurisdiction: 'Jurisdiction',
          markText: 'Jurisdiction',
          applicationNumber: 'Application'
        },
        rows: [{ rowKey: 'row-1', cells: ['US', 'ALPHA', '98123456', '', '', ''] }]
      })
    ).toThrow('cannot map to multiple semantic fields');

    expect(() =>
      mapHistoricalTrademarkAssetTabularRows({
        ...baseTabularInput,
        migrationKey: 'marketplace-not-allowed',
        relationshipKind: 'MARKETPLACE_ADDED' as never,
        rows: [{ rowKey: 'row-1', cells: ['US', 'ALPHA', '98123456', '', '', ''] }]
      })
    ).toThrow('relationshipKind must be MANAGED, OWNED, or REPRESENTED');
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

  it('binds a reviewed run to the explicit source-file fingerprint', async () => {
    const bulkImport = createdImporter();
    const store = new InMemoryTrademarkAssetMigrationRunStore();
    const service = new TrademarkAssetMigrationOrchestrator({ bulkImport }, store);
    const rows = reviewRows(2);
    const input = {
      workspaceId,
      migrationKey: 'source-lineage',
      sourceFingerprintSha256: sourceFingerprintA,
      rows
    } as const;

    const first = await service.preview(input);
    const replay = await service.preview(input);
    expect(replay.fingerprint).toBe(first.fingerprint);
    expect(replay.sourceFingerprintSha256).toBe(sourceFingerprintA);
    expect((await service.progress(workspaceId, 'source-lineage'))?.sourceFingerprintSha256).toBe(
      sourceFingerprintA
    );

    await expect(
      service.commit({ ...input, sourceFingerprintSha256: sourceFingerprintB })
    ).rejects.toMatchObject({ code: 'RUN_MISMATCH' });
    expect(bulkImport).not.toHaveBeenCalled();

    const result = await service.commit(input);
    expect(result.sourceFingerprintSha256).toBe(sourceFingerprintA);
  });

  it('rejects a non-lowercase SHA-256 source fingerprint', async () => {
    const service = new TrademarkAssetMigrationOrchestrator({ bulkImport: createdImporter() });
    await expect(
      service.preview({
        workspaceId,
        migrationKey: 'invalid-source-fingerprint',
        sourceFingerprintSha256: 'A'.repeat(64),
        rows: reviewRows(1)
      })
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
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
