import type { TrademarkAssetPortfolioPage } from '@markorbit/contracts/trademark-asset-portfolio';
import type { TrademarkAssetView } from '@markorbit/contracts/trademark-asset-composition';
import type {
  TrademarkAssetId,
  TrademarkAssetWorkspaceRelationshipKind
} from '@markorbit/contracts/trademark-asset-workspace';

const baseUrl = import.meta.env['VITE_LITE_GATEWAY_URL'] ?? 'http://127.0.0.1:4000';

export interface TrademarkAssetSearchInput {
  query?: string;
  jurisdictions?: readonly string[];
  relationshipKinds?: readonly TrademarkAssetWorkspaceRelationshipKind[];
  workspaceTags?: readonly string[];
  ownerOrClientReference?: string;
  cursor?: string;
  limit?: number;
}

export interface TrademarkAssetDetailResponse {
  readonly view: Readonly<TrademarkAssetView>;
}

export interface TrademarkAssetClient {
  search(input?: Readonly<TrademarkAssetSearchInput>): Promise<TrademarkAssetPortfolioPage>;
  load(trademarkAssetId: TrademarkAssetId): Promise<TrademarkAssetDetailResponse>;
}

export class TrademarkAssetHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable = false
  ) {
    super(message);
    this.name = 'TrademarkAssetHttpError';
  }
}

async function request<T>(path: string, workspaceId: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-markorbit-workspace-id': workspaceId
      }
    });
  } catch {
    throw new TrademarkAssetHttpError(
      503,
      'DOWNSTREAM_UNAVAILABLE',
      'Trademark Asset Workspace is temporarily unavailable.',
      true
    );
  }
  const parsed = (await response.json().catch(() => ({}))) as T & {
    code?: string;
    message?: string;
    retryable?: boolean;
  };
  if (!response.ok)
    throw new TrademarkAssetHttpError(
      response.status,
      parsed.code ?? 'TRADEMARK_ASSET_REQUEST_FAILED',
      parsed.message ?? 'Trademark Asset request failed.',
      parsed.retryable ?? response.status >= 500
    );
  return parsed;
}

function searchPath(input: Readonly<TrademarkAssetSearchInput> | undefined): string {
  const query = new URLSearchParams();
  if (input?.query?.trim()) query.set('q', input.query.trim());
  if (input?.jurisdictions?.length) query.set('jurisdiction', input.jurisdictions.join(','));
  if (input?.relationshipKinds?.length)
    query.set('relationship', input.relationshipKinds.join(','));
  if (input?.workspaceTags?.length) query.set('tag', input.workspaceTags.join(','));
  if (input?.ownerOrClientReference?.trim())
    query.set('ownerOrClientReference', input.ownerOrClientReference.trim());
  if (input?.cursor) query.set('cursor', input.cursor);
  if (input?.limit !== undefined) query.set('limit', String(input.limit));
  const suffix = query.toString();
  return `/api/lite/trademark-assets${suffix ? `?${suffix}` : ''}`;
}

export function createTrademarkAssetClient(workspaceId: string): TrademarkAssetClient {
  return {
    search: (input) => request<TrademarkAssetPortfolioPage>(searchPath(input), workspaceId),
    load: (trademarkAssetId) =>
      request<TrademarkAssetDetailResponse>(
        `/api/lite/trademark-assets/${encodeURIComponent(trademarkAssetId)}`,
        workspaceId
      )
  };
}
