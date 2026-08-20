import { timingSafeEqual } from 'node:crypto';
import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type {
  TrademarkAssetId,
  TrademarkAssetWorkspaceRelationshipKind
} from '@markorbit/contracts/trademark-asset-workspace';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  TrademarkAssetPersistenceError,
  type PostgresLiteTrademarkAssetStore
} from './trademark-asset.js';
import type { TrademarkAssetPortfolioService } from './trademark-asset-portfolio.js';
import { deriveTrademarkAssetAttention } from './trademark-asset-attention.js';
import { deriveTrademarkAssetManagementSignals } from './trademark-asset-management-signal.js';
import { prepareTrademarkAssetManagementRecommendations } from './trademark-asset-management-recommendation.js';
import {
  TrademarkAssetRefreshError,
  type PostgresTrademarkAssetRefreshLedger
} from './trademark-asset-refresh.js';
import { composeTrademarkAssetView } from './trademark-asset-view.js';

export interface TrademarkAssetReadRouteOptions {
  internalServiceSecret: string;
  assets: PostgresLiteTrademarkAssetStore;
  portfolio: TrademarkAssetPortfolioService;
  refreshLedger: PostgresTrademarkAssetRefreshLedger;
  now?: () => string;
}

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function principalOf(request: JsonRequest, secret: string): WorkspacePrincipal {
  if (!trusted(secret, request.headers['x-markorbit-internal-authorization']))
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );
  let principal: WorkspacePrincipal;
  try {
    principal = parseInternalWorkspacePrincipal(request.headers['x-markorbit-principal']);
  } catch {
    throw new HttpError(
      401,
      'INVALID_INTERNAL_PRINCIPAL',
      'A trusted Workspace Principal is required.'
    );
  }
  const workspaceId = request.headers['x-markorbit-workspace-id'];
  if (!workspaceId || workspaceId.toLowerCase() !== principal.workspaceId.toLowerCase())
    throw new HttpError(404, 'WORKSPACE_MISMATCH', 'Workspace-scoped record was not found.');
  if (!principal.permissions.includes('workspace:read'))
    throw new HttpError(403, 'PERMISSION_DENIED', 'workspace:read permission is required.');
  return principal;
}

function csv(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
}

function positiveLimit(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100)
    throw new HttpError(400, 'INVALID_REQUEST', 'limit must be an integer between 1 and 100.');
  return parsed;
}

function mapError(error: unknown): never {
  if (error instanceof TrademarkAssetPersistenceError || error instanceof TrademarkAssetRefreshError)
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  throw error;
}

export function createTrademarkAssetReadRoutes(
  options: TrademarkAssetReadRouteOptions
): readonly JsonRoute[] {
  const now = options.now ?? (() => new Date().toISOString());
  return [
    {
      method: 'GET',
      path: '/v1/trademark-assets',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret);
        try {
          const relationships = csv(request.query.relationship) as
            TrademarkAssetWorkspaceRelationshipKind[] | undefined;
          const jurisdictions = csv(request.query.jurisdiction);
          const workspaceTags = csv(request.query.tag);
          const limit = positiveLimit(request.query.limit);
          const page = await options.portfolio.search({
            workspaceId: principal.workspaceId,
            ...(request.query.cursor ? { cursor: request.query.cursor } : {}),
            ...(limit !== undefined ? { limit } : {}),
            filter: {
              ...(request.query.q ? { query: request.query.q } : {}),
              ...(jurisdictions ? { jurisdictions } : {}),
              ...(relationships ? { relationshipKinds: relationships } : {}),
              ...(workspaceTags ? { workspaceTags } : {}),
              ...(request.query.ownerOrClientReference
                ? { ownerOrClientReference: request.query.ownerOrClientReference }
                : {})
            }
          });
          const generatedAt = now();
          const managementEntries = await Promise.all(
            page.assets.map(async (anchor) => {
              const latestRefresh = (
                await options.refreshLedger.listRecent(
                  principal.workspaceId,
                  anchor.trademarkAssetId,
                  1
                )
              )[0];
              const view = composeTrademarkAssetView({ anchor, composedAt: generatedAt });
              const signals = deriveTrademarkAssetManagementSignals(view, latestRefresh, generatedAt);
              return {
                trademarkAssetId: anchor.trademarkAssetId,
                signals,
                latestRefresh
              };
            })
          );
          return json(200, {
            ...page,
            management: {
              totalSignals: managementEntries.reduce((sum, entry) => sum + entry.signals.length, 0),
              urgentSignals: managementEntries.reduce(
                (sum, entry) =>
                  sum + entry.signals.filter((signal) => signal.severity === 'URGENT').length,
                0
              ),
              importantSignals: managementEntries.reduce(
                (sum, entry) =>
                  sum + entry.signals.filter((signal) => signal.severity === 'IMPORTANT').length,
                0
              ),
              changedAssets: managementEntries.filter(
                (entry) => (entry.latestRefresh?.changes.length ?? 0) > 0
              ).length,
              generatedAt
            },
            managementByAsset: managementEntries.map((entry) => ({
              trademarkAssetId: entry.trademarkAssetId,
              highestSeverity: entry.signals[0]?.severity ?? 'INFO',
              signalCount: entry.signals.length,
              changeCount: entry.latestRefresh?.changes.length ?? 0,
              lastRefreshedAt: entry.latestRefresh?.refreshedAt
            }))
          });
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/v1/trademark-assets/:trademarkAssetId',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret);
        try {
          const trademarkAssetId = request.params.trademarkAssetId! as TrademarkAssetId;
          const anchor = await options.assets.get(principal.workspaceId, trademarkAssetId);
          const composedAt = now();
          const view = composeTrademarkAssetView({ anchor, composedAt });
          const latestRefresh = (
            await options.refreshLedger.listRecent(principal.workspaceId, trademarkAssetId, 1)
          )[0];
          const managementSignals = deriveTrademarkAssetManagementSignals(
            view,
            latestRefresh,
            composedAt
          );
          const recommendations = prepareTrademarkAssetManagementRecommendations({
            signals: managementSignals,
            relatedOwnerReferences: view.anchor.relations,
            createdAt: composedAt
          });
          return json(200, {
            view,
            attention: deriveTrademarkAssetAttention(view, composedAt),
            latestRefresh,
            managementSignals,
            recommendations
          });
        } catch (error) {
          return mapError(error);
        }
      }
    }
  ];
}
