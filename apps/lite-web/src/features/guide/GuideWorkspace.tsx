import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  TrademarkAsset,
  TrademarkAssetId
} from '@markorbit/contracts/trademark-asset-workspace';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader
} from '@markorbit/ui';
import {
  createTrademarkAssetClient,
  TrademarkAssetHttpError,
  type TrademarkAssetClient,
  type TrademarkAssetDetailResponse
} from '../../api/trademark-assets.js';
import { TrademarkAssetAiGuide } from '../trademark-assets/TrademarkAssetAiGuide.js';
import '../trademark-assets/trademark-asset-workspace.css';

export interface GuideWorkspaceProps {
  workspaceId: string;
  client?: TrademarkAssetClient;
}

type LoadState = 'loading' | 'ready' | 'error';

function assetTitle(asset: Readonly<TrademarkAsset>): string {
  return asset.workspaceAlias || asset.identity.markText || 'Untitled trademark asset';
}

function detailFailure(status: number | undefined): { title: string; description: string } {
  if (status === 403) {
    return {
      title: 'AI Guide permission required',
      description:
        'You do not have permission to use this Trademark Asset in the current Workspace.'
    };
  }
  if (status === 404) {
    return {
      title: 'Trademark Asset unavailable for Guide',
      description:
        'This Asset is unavailable in the current Workspace. No local Guide context was substituted.'
    };
  }
  return {
    title: 'AI Guide source unavailable',
    description:
      'Current Trademark Asset truth could not be loaded. No fixture or local suggestion was substituted.'
  };
}

export function GuideWorkspace({ workspaceId, client: suppliedClient }: GuideWorkspaceProps) {
  const client = useMemo(
    () => suppliedClient ?? createTrademarkAssetClient(workspaceId),
    [suppliedClient, workspaceId]
  );
  const [portfolioState, setPortfolioState] = useState<LoadState>('loading');
  const [assets, setAssets] = useState<readonly TrademarkAsset[]>([]);
  const [selectedId, setSelectedId] = useState<TrademarkAssetId>();
  const [detailState, setDetailState] = useState<LoadState>('ready');
  const [detail, setDetail] = useState<TrademarkAssetDetailResponse>();
  const [detailErrorStatus, setDetailErrorStatus] = useState<number>();

  const loadAssets = useCallback(async () => {
    setPortfolioState('loading');
    try {
      const page = await client.search({ limit: 100 });
      setAssets(page.assets);
      setPortfolioState('ready');
    } catch {
      setAssets([]);
      setPortfolioState('error');
    }
  }, [client]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const chooseAsset = async (trademarkAssetId: TrademarkAssetId) => {
    setSelectedId(trademarkAssetId);
    setDetail(undefined);
    setDetailErrorStatus(undefined);
    setDetailState('loading');
    try {
      const loaded = await client.load(trademarkAssetId);
      setDetail(loaded);
      setDetailState('ready');
    } catch (error) {
      setDetailErrorStatus(error instanceof TrademarkAssetHttpError ? error.status : 503);
      setDetailState('error');
    }
  };

  const resetSelection = () => {
    setSelectedId(undefined);
    setDetail(undefined);
    setDetailErrorStatus(undefined);
    setDetailState('ready');
  };

  return (
    <main aria-label="AI Guide workspace">
      <PageHeader
        title="Guide"
        description="Asset-scoped AI preparation grounded in current Workspace Trademark Asset truth."
        actions={<Badge>Authenticated · Asset-scoped</Badge>}
      />

      <Card>
        <strong>Guide is advisory, not a universal assistant authority.</strong>
        <p>
          Choose a current Workspace Trademark Asset before asking for bounded explanation, missing
          information review, or checklist preparation. Guide output does not create official truth,
          filing, execution, contact, payment, publication, or other protected authority.
        </p>
      </Card>

      {selectedId ? (
        <section aria-label="Selected Guide asset">
          <Button variant="secondary" onClick={resetSelection}>
            ← Choose another Asset
          </Button>
          {detailState === 'loading' ? (
            <LoadingState label="Loading current Trademark Asset for Guide" />
          ) : detailState === 'error' ? (
            <ErrorState
              {...detailFailure(detailErrorStatus)}
              onRetry={() => void chooseAsset(selectedId)}
            />
          ) : detail ? (
            <>
              <Card>
                <p>Current Guide subject</p>
                <h2>{detail.view.anchor.identity.markText || 'Untitled trademark asset'}</h2>
                <p>
                  {detail.view.anchor.identity.jurisdiction} · {detail.view.trademarkAssetId} ·
                  exact version {detail.view.anchor.version}
                </p>
              </Card>
              <TrademarkAssetAiGuide
                assetId={detail.view.trademarkAssetId}
                assetVersion={detail.view.anchor.version}
                onPrepare={(input) => client.prepareAiGuide(detail.view.trademarkAssetId, input)}
              />
            </>
          ) : null}
        </section>
      ) : portfolioState === 'loading' ? (
        <LoadingState label="Loading Workspace Trademark Assets for Guide" />
      ) : portfolioState === 'error' ? (
        <ErrorState
          title="AI Guide assets unavailable"
          description="Current Workspace Trademark Assets could not be loaded. No fixture or local Guide context was substituted."
          onRetry={() => void loadAssets()}
        />
      ) : assets.length === 0 ? (
        <EmptyState
          title="No Trademark Assets available for Guide"
          description="This Workspace has no current Trademark Asset available for asset-scoped AI preparation."
        />
      ) : (
        <section aria-labelledby="guide-assets-heading">
          <h2 id="guide-assets-heading">Choose a Trademark Asset</h2>
          <div className="lite-grid">
            {assets.map((asset) => (
              <Card key={asset.trademarkAssetId}>
                <p>{asset.identity.jurisdiction}</p>
                <h3>{assetTitle(asset)}</h3>
                <p>{asset.workspaceRelationships.map((item) => item.kind).join(' · ')}</p>
                <Button onClick={() => void chooseAsset(asset.trademarkAssetId)}>
                  Use AI Guide
                </Button>
              </Card>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
