import type { TrademarkAssetPortfolioPage } from '@markorbit/contracts/trademark-asset-portfolio';
import type { TrademarkAssetView } from '@markorbit/contracts/trademark-asset-composition';
import type {
  TrademarkAssetCommerceProfile,
  UpsertTrademarkAssetCommerceProfileInput
} from '@markorbit/contracts/trademark-asset-commerce';
import type {
  TrademarkServiceIntent,
  TrademarkServiceWorkPackage
} from '@markorbit/contracts/trademark-service-workbench';
import type {
  TrademarkAssetManagementChangeReference,
  TrademarkAssetManagementRecommendation,
  TrademarkAssetManagementSignal,
  TrademarkAssetManagementSignalSeverity
} from '@markorbit/contracts/trademark-asset-management';
import type {
  TrademarkAssetAttentionSignal,
  TrademarkAssetId,
  TrademarkAssetSourceOwner,
  TrademarkAssetSourceReference,
  TrademarkAssetWorkspaceRelationshipKind
} from '@markorbit/contracts/trademark-asset-workspace';
import type {
  PrepareTrademarkAssetAiGuideInput,
  TrademarkAssetAiGuidePreparedResult
} from '@markorbit/contracts/trademark-asset-ai-guide';

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

export interface TrademarkAssetRefreshSummary {
  readonly refreshRunId: `trademark-asset-refresh_${string}`;
  readonly workspaceId: string;
  readonly trademarkAssetId: TrademarkAssetId;
  readonly sourceOwnerScope: readonly TrademarkAssetSourceOwner[];
  readonly observations: readonly Readonly<TrademarkAssetSourceReference>[];
  readonly changes: readonly Readonly<TrademarkAssetManagementChangeReference>[];
  readonly refreshedAt: string;
  readonly officialTruthVerifiedByLite: false;
  readonly legalDeadlineCertified: false;
  readonly conflictResolvedByLite: false;
  readonly executionAuthorized: false;
}

export interface TrademarkAssetPortfolioManagementSummary {
  readonly totalSignals: number;
  readonly urgentSignals: number;
  readonly importantSignals: number;
  readonly changedAssets: number;
  readonly generatedAt: string;
}

export interface TrademarkAssetPortfolioManagementEntry {
  readonly trademarkAssetId: TrademarkAssetId;
  readonly highestSeverity: TrademarkAssetManagementSignalSeverity;
  readonly signalCount: number;
  readonly changeCount: number;
  readonly lastRefreshedAt?: string;
}

export type TrademarkAssetPortfolioResponse = TrademarkAssetPortfolioPage & {
  readonly management: Readonly<TrademarkAssetPortfolioManagementSummary>;
  readonly managementByAsset: readonly Readonly<TrademarkAssetPortfolioManagementEntry>[];
};

export interface TrademarkAssetDetailResponse {
  readonly view: Readonly<TrademarkAssetView>;
  readonly commerceProfile: Readonly<TrademarkAssetCommerceProfile> | null;
  readonly attention?: readonly Readonly<TrademarkAssetAttentionSignal>[];
  readonly latestRefresh?: Readonly<TrademarkAssetRefreshSummary>;
  readonly managementSignals?: readonly Readonly<TrademarkAssetManagementSignal>[];
  readonly recommendations?: readonly Readonly<TrademarkAssetManagementRecommendation>[];
}

export type SaveTrademarkAssetCommerceProfileInput = Omit<
  UpsertTrademarkAssetCommerceProfileInput,
  'workspaceId' | 'trademarkAssetId' | 'idempotencyKey'
>;

export interface PrepareTrademarkServiceWorkPackageInput {
  readonly assetVersion: number | string;
  readonly managementRecommendationReference?: string;
  readonly intent: Readonly<TrademarkServiceIntent>;
}

export type PrepareTrademarkAssetAiGuideRequest = Pick<
  PrepareTrademarkAssetAiGuideInput,
  'expectedTrademarkAssetVersion' | 'requestedKinds'
>;

export interface TrademarkAssetClient {
  search(input?: Readonly<TrademarkAssetSearchInput>): Promise<TrademarkAssetPortfolioResponse>;
  load(trademarkAssetId: TrademarkAssetId): Promise<TrademarkAssetDetailResponse>;
  prepareAiGuide(
    trademarkAssetId: TrademarkAssetId,
    input: Readonly<PrepareTrademarkAssetAiGuideRequest>
  ): Promise<TrademarkAssetAiGuidePreparedResult>;
  saveCommerceProfile(
    trademarkAssetId: TrademarkAssetId,
    input: Readonly<SaveTrademarkAssetCommerceProfileInput>
  ): Promise<TrademarkAssetCommerceProfile>;
  loadServiceWorkPackage(
    trademarkAssetId: TrademarkAssetId
  ): Promise<TrademarkServiceWorkPackage | undefined>;
  prepareServiceWorkPackage(
    trademarkAssetId: TrademarkAssetId,
    input: Readonly<PrepareTrademarkServiceWorkPackageInput>
  ): Promise<TrademarkServiceWorkPackage>;
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

async function request<T>(
  path: string,
  workspaceId: string,
  init?: Readonly<{
    method?: 'GET' | 'POST';
    body?: unknown;
    idempotencyKey?: string;
    csrfToken?: string;
  }>
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: init?.method ?? 'GET',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-markorbit-workspace-id': workspaceId,
        ...(init?.idempotencyKey ? { 'idempotency-key': init.idempotencyKey } : {}),
        ...(init?.csrfToken ? { 'x-markorbit-csrf-token': init.csrfToken } : {})
      },
      ...(init?.body === undefined ? {} : { body: JSON.stringify(init.body) })
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

async function currentCsrfToken(): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/session`, { credentials: 'include' });
  const payload = (await response.json().catch(() => ({}))) as { csrfToken?: string };
  if (!response.ok || !payload.csrfToken)
    throw new TrademarkAssetHttpError(
      response.status || 401,
      'AUTHENTICATION_REQUIRED',
      'An authenticated session is required for this action.',
      false
    );
  return payload.csrfToken;
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
    search: (input) => request<TrademarkAssetPortfolioResponse>(searchPath(input), workspaceId),
    load: (trademarkAssetId) =>
      request<TrademarkAssetDetailResponse>(
        `/api/lite/trademark-assets/${encodeURIComponent(trademarkAssetId)}`,
        workspaceId
      ),
    prepareAiGuide: async (trademarkAssetId, input) => {
      const csrfToken = await currentCsrfToken();
      return request<TrademarkAssetAiGuidePreparedResult>(
        `/api/lite/trademark-assets/${encodeURIComponent(trademarkAssetId)}/ai-guide`,
        workspaceId,
        {
          method: 'POST',
          body: input,
          csrfToken
        }
      );
    },
    saveCommerceProfile: async (trademarkAssetId, input) => {
      const csrfToken = await currentCsrfToken();
      const response = await request<{ commerceProfile: TrademarkAssetCommerceProfile }>(
        `/api/lite/trademark-assets/${encodeURIComponent(trademarkAssetId)}/commerce-profile`,
        workspaceId,
        {
          method: 'POST',
          body: input,
          idempotencyKey: `commerce-profile-${trademarkAssetId}-${crypto.randomUUID()}`,
          csrfToken
        }
      );
      return response.commerceProfile;
    },
    loadServiceWorkPackage: async (trademarkAssetId) => {
      const response = await request<{ workPackage: TrademarkServiceWorkPackage | null }>(
        `/api/lite/trademark-assets/${encodeURIComponent(trademarkAssetId)}/service-work-package`,
        workspaceId
      );
      return response.workPackage ?? undefined;
    },
    prepareServiceWorkPackage: async (trademarkAssetId, input) => {
      const csrfToken = await currentCsrfToken();
      const response = await request<{ workPackage: TrademarkServiceWorkPackage }>(
        `/api/lite/trademark-assets/${encodeURIComponent(trademarkAssetId)}/service-work-packages`,
        workspaceId,
        {
          method: 'POST',
          body: input,
          idempotencyKey: `service-work-package-${trademarkAssetId}-${crypto.randomUUID()}`,
          csrfToken
        }
      );
      return response.workPackage;
    }
  };
}
