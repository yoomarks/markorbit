import { describe, expect, it, vi } from 'vitest';
import type { QueryClient } from '@markorbit/persistence';
import type { TrademarkAsset, TrademarkAssetId } from '@markorbit/contracts/trademark-asset-workspace';
import {
  PostgresLiteTrademarkAssetStore,
  TrademarkAssetPersistenceError
} from '../src/trademark-asset.js';
import { TrademarkAssetPortfolioService } from '../src/trademark-asset-portfolio.js';

const workspaceId = '85858585-8585-4858-8858-858585858585';

function asset(
  id: TrademarkAssetId,
  overrides: Partial<TrademarkAsset> = {}
): TrademarkAsset {
  return {
    schemaVersion: 1,
    trademarkAssetId: id,
    workspaceId,
    version: 1,
    identity: { jurisdiction: 'US', markText: 'MARKORBIT' },
    externalIdentifiers: [],
    workspaceRelationships: [{ kind: 'MANAGED', sourceAssetEditableByWorkspace: false }],
    sourceReferences: [
      {
        owner: 'WORKSPACE_USER',
        kind: 'WORKSPACE_ADMISSION',
        sourceId: `admission_${id}`,
        sourceVersion: '1',
        observedAt: '2026-08-19T04:00:00.000Z',
        freshness: 'CURRENT'
      }
    ],
    relations: [],
    workspaceTags: [],
    workspaceNotes: [],
    officialTruthVerifiedByLite: false,
    filingExecutedByLite: false,
    createdAt: '2026-08-19T04:00:00.000Z',
    updatedAt: '2026-08-19T04:00:00.000Z',
    ...overrides
  };
}

describe('M10 WP04 Trademark Asset Portfolio', () => {
  it('uses workspace-scoped cursor search with relationship and private tag filters', async () => {
    const first = asset('trademark-asset_first');
    const second = asset('trademark-asset_second');
    const query = vi.fn(async () => ({
      rows: [
        {
          document_json: first,
          updated_at: '2026-08-19T04:10:00.000Z',
          trademark_asset_id: first.trademarkAssetId
        },
        {
          document_json: second,
          updated_at: '2026-08-19T04:09:00.000Z',
          trademark_asset_id: second.trademarkAssetId
        }
      ]
    }));
    const service = new TrademarkAssetPortfolioService(
      { query } as unknown as QueryClient,
      {} as PostgresLiteTrademarkAssetStore
    );

    const page = await service.search({
      workspaceId,
      limit: 1,
      filter: {
        query: 'mark',
        jurisdictions: ['us'],
        relationshipKinds: ['MANAGED'],
        workspaceTags: ['priority']
      }
    });

    expect(page.assets).toEqual([first]);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBeTruthy();
    expect(page.officialTruthVerifiedByLite).toBe(false);
    const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain('workspace_id=$1');
    expect(sql).toContain('jsonb_array_elements');
    expect(sql).toContain("document_json->'workspaceTags'");
    expect(params[0]).toBe(workspaceId);
  });

  it('bulk imports independently and reports identifier collisions as duplicates', async () => {
    const admit = vi
      .fn()
      .mockResolvedValueOnce(asset('trademark-asset_created'))
      .mockRejectedValueOnce(
        new TrademarkAssetPersistenceError(
          'IDENTIFIER_CONFLICT',
          'External identifier already belongs to another Trademark Asset.',
          409
        )
      );
    const service = new TrademarkAssetPortfolioService(
      { query: vi.fn() } as unknown as QueryClient,
      { admit } as unknown as PostgresLiteTrademarkAssetStore
    );

    const result = await service.bulkImport({
      workspaceId,
      batchKey: 'csv_20260819',
      items: [
        {
          identity: { jurisdiction: 'US', markText: 'ONE' },
          workspaceRelationships: [{ kind: 'MANAGED', sourceAssetEditableByWorkspace: false }],
          sourceReferences: [
            {
              owner: 'WORKSPACE_USER',
              kind: 'WORKSPACE_ADMISSION',
              sourceId: 'row_1',
              sourceVersion: '1',
              observedAt: '2026-08-19T04:00:00.000Z',
              freshness: 'CURRENT'
            }
          ]
        },
        {
          identity: { jurisdiction: 'US', markText: 'TWO' },
          workspaceRelationships: [{ kind: 'MANAGED', sourceAssetEditableByWorkspace: false }],
          sourceReferences: [
            {
              owner: 'WORKSPACE_USER',
              kind: 'WORKSPACE_ADMISSION',
              sourceId: 'row_2',
              sourceVersion: '1',
              observedAt: '2026-08-19T04:00:00.000Z',
              freshness: 'CURRENT'
            }
          ]
        }
      ]
    });

    expect(result).toMatchObject({
      total: 2,
      created: 1,
      duplicates: 1,
      rejected: 0,
      officialTruthVerifiedByLite: false,
      matterCreatedAutomatically: false
    });
    expect(admit).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ workspaceId, idempotencyKey: 'csv_20260819:import:0' })
    );
  });

  it('bulk tags Marketplace references only through private workspace metadata', async () => {
    const marketplace = asset('trademark-asset_marketplace', {
      version: 4,
      workspaceTags: ['watch'],
      workspaceRelationships: [
        {
          kind: 'MARKETPLACE_ADDED',
          sourceAssetId: 'market_asset_123',
          sourceReference: {
            owner: 'MARKETPLACE',
            kind: 'MARKETPLACE_LISTING',
            sourceId: 'listing_123',
            sourceVersion: '8',
            observedAt: '2026-08-19T04:00:00.000Z',
            freshness: 'CURRENT'
          },
          sourceAssetEditableByWorkspace: false
        }
      ]
    });
    const get = vi.fn().mockResolvedValue(marketplace);
    const updateWorkspaceMetadata = vi.fn().mockResolvedValue({
      ...marketplace,
      version: 5,
      workspaceTags: ['priority']
    });
    const service = new TrademarkAssetPortfolioService(
      { query: vi.fn() } as unknown as QueryClient,
      { get, updateWorkspaceMetadata } as unknown as PostgresLiteTrademarkAssetStore
    );

    const result = await service.bulkTag({
      workspaceId,
      batchKey: 'portfolio_tags_1',
      trademarkAssetIds: [marketplace.trademarkAssetId],
      addTags: ['priority'],
      removeTags: ['watch']
    });

    expect(result.marketplaceSourceMutated).toBe(false);
    expect(result.updated).toBe(1);
    expect(updateWorkspaceMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        trademarkAssetId: marketplace.trademarkAssetId,
        expectedVersion: 4,
        workspaceTags: ['priority']
      })
    );
  });
});
