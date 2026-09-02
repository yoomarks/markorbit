import { describe, expect, it, vi } from 'vitest';
import type { QueryClient, TransactionOptions } from '@markorbit/persistence';
import type { LiteTransactionHost } from '../src/content-preparation.js';
import {
  nextTrademarkAssetManagementRecoveryAttempt,
  PostgresTrademarkAssetManagementDispositionStore,
  trademarkAssetManagementDispositionRecoveryAuthority
} from '../src/trademark-asset-management-disposition.js';
import type { TrademarkAssetManagementCurrentOwnerResolver } from '../src/trademark-asset-management-current-owner.js';

describe('M11-WP07 management disposition recovery policy', () => {
  it('backs off internal recovery and dead-letters at the configured ceiling', () => {
    expect(nextTrademarkAssetManagementRecoveryAttempt('2026-08-21T01:00:00.000Z', 0, 5)).toEqual({
      status: 'PENDING',
      attemptCount: 1,
      availableAt: '2026-08-21T01:00:15.000Z'
    });
    expect(nextTrademarkAssetManagementRecoveryAttempt('2026-08-21T01:00:00.000Z', 1, 5)).toEqual({
      status: 'PENDING',
      attemptCount: 2,
      availableAt: '2026-08-21T01:00:30.000Z'
    });
    expect(nextTrademarkAssetManagementRecoveryAttempt('2026-08-21T01:00:00.000Z', 4, 5)).toEqual({
      status: 'DEAD_LETTER',
      attemptCount: 5,
      availableAt: '2026-08-21T01:00:00.000Z'
    });
  });

  it('keeps disposition/watch and recovery permanently non-authoritative', () => {
    expect(trademarkAssetManagementDispositionRecoveryAuthority).toEqual({
      mayPersistPrivateDisposition: true,
      mayMaintainWatchState: true,
      mayRetryInternalProjectionWork: true,
      mayDeadLetterInternalProjectionWork: true,
      mayReplayDeadLetterAfterExplicitInternalRecovery: true,
      mayCreateOfficialTruth: false,
      mayCertifyLegalDeadline: false,
      mayCreateLegalConclusion: false,
      mayAuthorizeFiling: false,
      mayAuthorizeExternalContact: false,
      mayAuthorizePayment: false,
      mayAuthorizeExternalPublication: false,
      mayCreateVerifiedCapability: false,
      mayUseCrossServiceSql: false
    });
  });
});

describe('exact-current management disposition read', () => {
  const workspaceId = '96969696-9696-4969-8969-969696969696';
  const assetId = 'trademark-asset_empty-current-read';
  const currentOwner = {
    resolve: vi.fn().mockResolvedValue({
      asset: {
        workspaceId,
        trademarkAssetId: assetId,
        version: 3
      },
      signals: [],
      recommendations: []
    })
  } as unknown as TrademarkAssetManagementCurrentOwnerResolver;

  function storeWith(
    database: LiteTransactionHost,
    owner: TrademarkAssetManagementCurrentOwnerResolver = currentOwner
  ) {
    return new PostgresTrademarkAssetManagementDispositionStore(
      database,
      { query: vi.fn() } as never,
      () => '2026-09-03T00:00:00.000Z',
      () => 'trademark-asset-management-disposition_unused',
      () => 'trademark-asset-management-recovery_unused',
      owner
    );
  }

  it('returns an empty deterministic projection inside a read-only repeatable-read snapshot', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const client: QueryClient = { query };
    const database: LiteTransactionHost = {
      async transact<T>(
        callback: (queryClient: QueryClient) => Promise<T>,
        options?: TransactionOptions
      ): Promise<T> {
        expect(options).toEqual({ isolation: 'REPEATABLE READ', readOnly: true });
        return await callback(client);
      }
    };
    const result = await storeWith(database).listCurrentForAsset(workspaceId, assetId);
    expect(result).toEqual({
      schemaVersion: 1,
      workspaceId,
      asset: { id: assetId, version: 3 },
      items: []
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('WHERE workspace_id=$1'), [
      workspaceId,
      assetId
    ]);
  });

  it('fails closed for inconsistent current-owner lineage', async () => {
    const owner = {
      resolve: vi.fn().mockResolvedValue({
        asset: {
          workspaceId: '97979797-9797-4979-8979-979797979797',
          trademarkAssetId: assetId,
          version: 3
        },
        signals: [],
        recommendations: []
      })
    } as unknown as TrademarkAssetManagementCurrentOwnerResolver;
    const client: QueryClient = {
      query: vi.fn()
    };
    const database: LiteTransactionHost = {
      async transact<T>(callback: (queryClient: QueryClient) => Promise<T>): Promise<T> {
        return await callback(client);
      }
    };
    await expect(
      storeWith(database, owner).listCurrentForAsset(workspaceId, assetId)
    ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE', status: 503, retryable: true });
  });

  it('maps snapshot failures to a retryable persistence error', async () => {
    const database: LiteTransactionHost = {
      transact: () => Promise.reject(new Error('database unavailable'))
    };
    const store = storeWith(database);
    await expect(store.listCurrentForAsset(workspaceId, assetId)).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
      status: 503,
      retryable: true
    });
  });
});
