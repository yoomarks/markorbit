import { timingSafeEqual } from 'node:crypto';
import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import {
  trademarkAssetObservedFactKinds,
  type TrademarkAssetObservedFactValue
} from '@markorbit/contracts/trademark-asset-composition';
import {
  trademarkAssetFreshnessStates,
  type TrademarkAssetId,
  type TrademarkAssetSourceReference
} from '@markorbit/contracts/trademark-asset-workspace';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { deriveTrademarkAssetAttention } from './trademark-asset-attention.js';
import { deriveTrademarkAssetManagementSignals } from './trademark-asset-management-signal.js';
import { prepareTrademarkAssetManagementRecommendations } from './trademark-asset-management-recommendation.js';
import type { PostgresTrademarkAssetRefreshLedger } from './trademark-asset-refresh.js';
import type { PostgresLiteTrademarkAssetStore } from './trademark-asset.js';
import {
  composeTrademarkAssetView,
  type TrademarkAssetFactContribution
} from './trademark-asset-view.js';

export interface TrademarkAssetCompositionRouteOptions {
  internalServiceSecret: string;
  assets: PostgresLiteTrademarkAssetStore;
  refreshLedger: PostgresTrademarkAssetRefreshLedger;
  now?: () => string;
}

type UnknownRecord = Record<string, unknown>;

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

function record(value: unknown): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must contain object records.');
  return value as UnknownRecord;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new HttpError(400, 'INVALID_REQUEST', `${label} is required.`);
  return value.trim();
}

function factValue(value: unknown): TrademarkAssetObservedFactValue {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return value;
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value;
  throw new HttpError(400, 'INVALID_REQUEST', 'Fact value must be scalar or an array of strings.');
}

function sourceReference(value: unknown): TrademarkAssetSourceReference {
  const source = record(value);
  if (source.owner !== 'DATA_ENGINE' || source.kind !== 'DATA_ENGINE_TRADEMARK_RECORD')
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'Only Data Engine trademark-record facts are accepted.'
    );
  const observedAt = text(source.observedAt, 'source.observedAt');
  if (Number.isNaN(Date.parse(observedAt)))
    throw new HttpError(400, 'INVALID_REQUEST', 'source.observedAt must be an ISO timestamp.');
  if (!trademarkAssetFreshnessStates.includes(source.freshness as never))
    throw new HttpError(400, 'INVALID_REQUEST', 'source.freshness is invalid.');
  const fingerprint = source.sourceFingerprintSha256;
  if (
    fingerprint !== undefined &&
    (typeof fingerprint !== 'string' || !/^[a-f0-9]{64}$/i.test(fingerprint))
  )
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'source.sourceFingerprintSha256 must be SHA-256 hex.'
    );
  return {
    owner: 'DATA_ENGINE',
    kind: 'DATA_ENGINE_TRADEMARK_RECORD',
    sourceId: text(source.sourceId, 'source.sourceId'),
    sourceVersion: text(source.sourceVersion, 'source.sourceVersion'),
    ...(typeof fingerprint === 'string' ? { sourceFingerprintSha256: fingerprint } : {}),
    observedAt,
    freshness: source.freshness as TrademarkAssetSourceReference['freshness']
  };
}

function factsOf(request: JsonRequest): readonly TrademarkAssetFactContribution[] {
  const body = record(request.body);
  if (!Array.isArray(body.facts))
    throw new HttpError(400, 'INVALID_REQUEST', 'facts must be an array.');
  return body.facts.map((raw) => {
    const fact = record(raw);
    if (
      !trademarkAssetObservedFactKinds.includes(fact.kind as never) ||
      fact.kind === 'LIFECYCLE_STAGE'
    )
      throw new HttpError(
        400,
        'INVALID_REQUEST',
        'Fact kind is not admitted for Data Engine composition.'
      );
    if (fact.consequential !== undefined && typeof fact.consequential !== 'boolean')
      throw new HttpError(
        400,
        'INVALID_REQUEST',
        'fact.consequential must be boolean when supplied.'
      );
    return {
      kind: fact.kind as TrademarkAssetFactContribution['kind'],
      value: factValue(fact.value),
      source: sourceReference(fact.source),
      ...(fact.consequential === true ? { consequential: true } : {})
    };
  });
}

export function createTrademarkAssetCompositionRoutes(
  options: TrademarkAssetCompositionRouteOptions
): readonly JsonRoute[] {
  const now = options.now ?? (() => new Date().toISOString());
  return [
    {
      method: 'POST',
      path: '/internal/v1/workspaces/:workspaceId/trademark-assets/:trademarkAssetId/compose',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret);
        if (request.params.workspaceId?.toLowerCase() !== principal.workspaceId.toLowerCase())
          throw new HttpError(404, 'WORKSPACE_MISMATCH', 'Workspace-scoped record was not found.');
        const trademarkAssetId = request.params.trademarkAssetId! as TrademarkAssetId;
        const anchor = await options.assets.get(principal.workspaceId, trademarkAssetId);
        const composedAt = now();
        const view = composeTrademarkAssetView({ anchor, facts: factsOf(request), composedAt });
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
      }
    }
  ];
}
