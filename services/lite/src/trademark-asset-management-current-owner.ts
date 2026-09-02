import type {
  TrademarkAssetManagementRecommendation,
  TrademarkAssetManagementSignal
} from '@markorbit/contracts/trademark-asset-management';
import type {
  TrademarkAsset,
  TrademarkAssetId
} from '@markorbit/contracts/trademark-asset-workspace';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';
import { prepareTrademarkAssetManagementRecommendations } from './trademark-asset-management-recommendation.js';
import { deriveTrademarkAssetManagementSignals } from './trademark-asset-management-signal.js';
import { PostgresTrademarkAssetRefreshLedger } from './trademark-asset-refresh.js';
import { composeTrademarkAssetView } from './trademark-asset-view.js';
import { PostgresLiteTrademarkAssetStore } from './trademark-asset.js';

export interface TrademarkAssetManagementCurrentOwnerProjection {
  asset: TrademarkAsset;
  signals: readonly TrademarkAssetManagementSignal[];
  recommendations: readonly TrademarkAssetManagementRecommendation[];
}

export interface TrademarkAssetManagementCurrentOwnerResolver {
  resolve(
    workspaceId: string,
    trademarkAssetId: TrademarkAssetId,
    composedAt: string,
    query: QueryClient
  ): Promise<TrademarkAssetManagementCurrentOwnerProjection>;
}

/** Rebuilds the same current owner projection used by the Trademark Asset detail read. */
export class PostgresTrademarkAssetManagementCurrentOwnerResolver implements TrademarkAssetManagementCurrentOwnerResolver {
  constructor(private readonly database: LiteTransactionHost) {}

  async resolve(
    workspaceId: string,
    trademarkAssetId: TrademarkAssetId,
    composedAt: string,
    query: QueryClient
  ): Promise<TrademarkAssetManagementCurrentOwnerProjection> {
    const asset = await new PostgresLiteTrademarkAssetStore(this.database, query).get(
      workspaceId,
      trademarkAssetId
    );
    const latestRefresh = (
      await new PostgresTrademarkAssetRefreshLedger(this.database, query).listRecent(
        workspaceId,
        trademarkAssetId,
        1
      )
    )[0];
    const view = composeTrademarkAssetView({ anchor: asset, composedAt });
    const signals = deriveTrademarkAssetManagementSignals(view, latestRefresh, composedAt);
    const recommendations = prepareTrademarkAssetManagementRecommendations({
      signals,
      relatedOwnerReferences: view.anchor.relations,
      createdAt: composedAt
    });
    return { asset, signals, recommendations };
  }
}
