import { describe, expect, it } from 'vitest';
import { PostgresTrademarkAssetRefreshLedger } from '../src/trademark-asset-refresh.js';

const ledger = new PostgresTrademarkAssetRefreshLedger(
  {
    transact: () => Promise.reject(new Error('unused'))
  },
  { query: () => Promise.resolve({ rows: [] }) } as never
);

describe('M11-WP02 refresh ledger reads', () => {
  it('rejects unbounded read limits before querying persistence', async () => {
    await expect(
      ledger.listRecent('94949494-9494-4949-8949-949494949494', 'trademark-asset_test', 101)
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});
