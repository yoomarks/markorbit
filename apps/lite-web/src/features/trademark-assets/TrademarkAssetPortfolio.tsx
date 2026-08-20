import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  TrademarkAsset,
  TrademarkAssetId,
  TrademarkAssetWorkspaceRelationshipKind
} from '@markorbit/contracts/trademark-asset-workspace';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Select,
  TextInput
} from '@markorbit/ui';
import {
  createTrademarkAssetClient,
  type TrademarkAssetClient,
  type TrademarkAssetDetailResponse
} from '../../api/trademark-assets.js';
import { TrademarkAssetWorkspace } from './TrademarkAssetWorkspace.js';
import './trademark-asset-workspace.css';

export interface TrademarkAssetPortfolioProps {
  workspaceId: string;
  client?: TrademarkAssetClient;
}

type LoadState = 'loading' | 'ready' | 'error';

const relationshipOptions: ReadonlyArray<TrademarkAssetWorkspaceRelationshipKind | 'ALL'> = [
  'ALL',
  'OWNED',
  'MANAGED',
  'REPRESENTED',
  'MARKETPLACE_ADDED'
];

function assetTitle(asset: Readonly<TrademarkAsset>): string {
  return asset.workspaceAlias || asset.identity.markText || 'Untitled trademark asset';
}

function relationshipLabel(asset: Readonly<TrademarkAsset>): string {
  return asset.workspaceRelationships.map((relationship) => relationship.kind).join(' · ');
}

export function TrademarkAssetPortfolio({
  workspaceId,
  client: suppliedClient
}: TrademarkAssetPortfolioProps) {
  const client = useMemo(
    () => suppliedClient ?? createTrademarkAssetClient(workspaceId),
    [suppliedClient, workspaceId]
  );
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [assets, setAssets] = useState<readonly TrademarkAsset[]>([]);
  const [query, setQuery] = useState('');
  const [relationship, setRelationship] = useState<TrademarkAssetWorkspaceRelationshipKind | 'ALL'>(
    'ALL'
  );
  const [selectedId, setSelectedId] = useState<TrademarkAssetId>();
  const [detail, setDetail] = useState<TrademarkAssetDetailResponse>();
  const [detailState, setDetailState] = useState<LoadState>('ready');

  const loadPortfolio = useCallback(async () => {
    setLoadState('loading');
    try {
      const page = await client.search({
        ...(query.trim() ? { query: query.trim() } : {}),
        ...(relationship === 'ALL' ? {} : { relationshipKinds: [relationship] }),
        limit: 100
      });
      setAssets(page.assets);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, [client, query, relationship]);

  useEffect(() => {
    void loadPortfolio();
  }, [loadPortfolio]);

  const openAsset = async (trademarkAssetId: TrademarkAssetId) => {
    setSelectedId(trademarkAssetId);
    setDetail(undefined);
    setDetailState('loading');
    try {
      setDetail(await client.load(trademarkAssetId));
      setDetailState('ready');
    } catch {
      setDetailState('error');
    }
  };

  if (selectedId) {
    if (detailState === 'loading') return <LoadingState label="Loading Trademark Asset" />;
    if (detailState === 'error')
      return (
        <ErrorState
          title="Trademark Asset unavailable"
          description="This workspace-scoped asset could not be loaded. No source record was changed."
          onRetry={() => void openAsset(selectedId)}
        />
      );
    if (detail)
      return (
        <div className="trademark-asset-portfolio__detail">
          <Button variant="secondary" onClick={() => setSelectedId(undefined)}>
            ← Back to trademarks
          </Button>
          <TrademarkAssetWorkspace view={detail.view} attention={detail.attention ?? []} />
        </div>
      );
  }

  return (
    <main className="trademark-asset-portfolio">
      <PageHeader
        title="Trademark Assets"
        description="Your durable workspace portfolio of owned, managed, represented and Marketplace-added trademark assets."
        actions={<Badge>Workspace-scoped · source-aware</Badge>}
      />
      <div className="trademark-asset-portfolio__filters" role="search">
        <TextInput
          label="Search trademark assets"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select
          label="Workspace relationship"
          value={relationship}
          onChange={(event) =>
            setRelationship(event.target.value as TrademarkAssetWorkspaceRelationshipKind | 'ALL')
          }
        >
          {relationshipOptions.map((value) => (
            <option key={value} value={value}>
              {value === 'ALL' ? 'All relationships' : value}
            </option>
          ))}
        </Select>
      </div>

      {loadState === 'loading' ? (
        <LoadingState label="Loading durable Trademark Assets" />
      ) : loadState === 'error' ? (
        <ErrorState
          title="Trademark Asset portfolio unavailable"
          description="The durable workspace portfolio could not be loaded. No source record was changed."
          onRetry={() => void loadPortfolio()}
        />
      ) : assets.length === 0 ? (
        <EmptyState
          title="No Trademark Assets found"
          description="No durable asset in this Workspace matches the current search and relationship filter."
        />
      ) : (
        <div className="trademark-asset-portfolio__list" aria-live="polite">
          {assets.map((asset) => {
            const marketplace = asset.workspaceRelationships.some(
              (item) => item.kind === 'MARKETPLACE_ADDED'
            );
            return (
              <Card key={asset.trademarkAssetId}>
                <div className="trademark-asset-portfolio__row">
                  <div>
                    <p className="trademark-asset-workspace__eyebrow">
                      {asset.identity.jurisdiction}
                    </p>
                    <h2>{assetTitle(asset)}</h2>
                    <p>{relationshipLabel(asset)}</p>
                  </div>
                  <div className="trademark-asset-workspace__badges">
                    {marketplace ? <span>Marketplace source · read-only</span> : null}
                    {asset.workspacePriority ? <span>{asset.workspacePriority}</span> : null}
                  </div>
                </div>
                {asset.workspaceTags.length ? (
                  <p className="trademark-asset-portfolio__tags">
                    Workspace tags: {asset.workspaceTags.join(' · ')}
                  </p>
                ) : null}
                <small>
                  Asset {asset.trademarkAssetId} · version {asset.version} · source truth is not
                  verified by Lite
                </small>
                <div className="trademark-asset-portfolio__actions">
                  <Button onClick={() => void openAsset(asset.trademarkAssetId)}>
                    View asset details
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
