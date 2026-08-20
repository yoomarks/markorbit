import { describe, expect, it } from 'vitest';
import { PostgresTrademarkAssetRefreshLedger } from '../src/trademark-asset-refresh.js';

const noopDatabase = {
  transact: () => Promise.reject(new Error('database should not be reached'))
};
const noopQuery = {
  query: () => Promise.resolve({ rows: [] })
};

const ledger = new PostgresTrademarkAssetRefreshLedger(noopDatabase, noopQuery as never);

describe('M11-WP02 Trademark Asset refresh validation', () => {
  it('requires an explicit non-empty source-owner scope', async () => {
    await expect(
      ledger.refresh({
        workspaceId: '94949494-9494-4949-8949-949494949494',
        trademarkAssetId: 'trademark-asset_test',
        sourceOwnerScope: [],
        observations: [],
        idempotencyKey: 'empty-scope'
      })
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('rejects observations from outside the declared refresh scope', async () => {
    await expect(
      ledger.refresh({
        workspaceId: '94949494-9494-4949-8949-949494949494',
        trademarkAssetId: 'trademark-asset_test',
        sourceOwnerScope: ['DATA_ENGINE'],
        observations: [
          {
            owner: 'MARKREG',
            kind: 'MARKREG_LIFECYCLE_PROJECTION',
            sourceId: 'lifecycle_test',
            sourceVersion: '1',
            observedAt: '2026-08-20T15:00:00.000Z',
            freshness: 'CURRENT'
          }
        ],
        idempotencyKey: 'wrong-scope'
      })
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('rejects duplicate current observations for the same exact source key', async () => {
    const observation = {
      owner: 'DATA_ENGINE',
      kind: 'DATA_ENGINE_TRADEMARK_RECORD',
      sourceId: 'record_test',
      sourceVersion: '1',
      observedAt: '2026-08-20T15:00:00.000Z',
      freshness: 'CURRENT'
    } as const;
    await expect(
      ledger.refresh({
        workspaceId: '94949494-9494-4949-8949-949494949494',
        trademarkAssetId: 'trademark-asset_test',
        sourceOwnerScope: ['DATA_ENGINE'],
        observations: [observation, { ...observation, sourceVersion: '2' }],
        idempotencyKey: 'duplicate-source'
      })
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});
