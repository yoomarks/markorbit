import { timingSafeEqual } from 'node:crypto';
import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { PrepareTrademarkAssetAiGuideInput } from '@markorbit/contracts/trademark-asset-ai-guide';
import type { UpsertTrademarkAssetCommerceProfileInput } from '@markorbit/contracts/trademark-asset-commerce';
import type {
  AiGuideSuggestionKind,
  TrademarkAssetId,
  TrademarkAssetWorkspaceRelationshipKind
} from '@markorbit/contracts/trademark-asset-workspace';
import { aiGuideSuggestionKinds } from '@markorbit/contracts/trademark-asset-workspace';
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
  TrademarkAssetManagementDispositionError,
  type PostgresTrademarkAssetManagementDispositionStore,
  type RecordTrademarkAssetManagementDispositionCommand
} from './trademark-asset-management-disposition.js';
import {
  TrademarkAssetRefreshError,
  type PostgresTrademarkAssetRefreshLedger
} from './trademark-asset-refresh.js';
import { composeTrademarkAssetView } from './trademark-asset-view.js';
import { createTrademarkAssetCompositionRoutes } from './trademark-asset-composition-http.js';
import {
  TrademarkAssetCommerceError,
  type PostgresTrademarkAssetCommerceStore
} from './trademark-asset-commerce.js';
import type { TrademarkAssetAiGuidePreparer } from './trademark-asset-ai-guide.js';

export interface TrademarkAssetReadRouteOptions {
  internalServiceSecret: string;
  assets: PostgresLiteTrademarkAssetStore;
  portfolio: TrademarkAssetPortfolioService;
  refreshLedger: PostgresTrademarkAssetRefreshLedger;
  commerce: PostgresTrademarkAssetCommerceStore;
  dispositions: Pick<
    PostgresTrademarkAssetManagementDispositionStore,
    'record' | 'listCurrentForAsset'
  >;
  aiGuide: Pick<TrademarkAssetAiGuidePreparer, 'prepare'>;
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
  if (
    error instanceof TrademarkAssetPersistenceError ||
    error instanceof TrademarkAssetRefreshError ||
    error instanceof TrademarkAssetCommerceError ||
    error instanceof TrademarkAssetManagementDispositionError
  )
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  throw error;
}

const browserDispositionKinds = ['WATCHED', 'DEFERRED', 'DISMISSED', 'CONTINUED'] as const;

function exactReference(value: unknown, field: string): { id: string; version: number } {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be an object.`);
  const reference = value as Record<string, unknown>;
  if (
    Object.keys(reference).some((key) => key !== 'id' && key !== 'version') ||
    typeof reference.id !== 'string' ||
    !reference.id.trim() ||
    !Number.isInteger(reference.version) ||
    (reference.version as number) < 1
  )
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      `${field} must contain only a non-empty id and positive integer version.`
    );
  return { id: reference.id, version: reference.version as number };
}

function managementDispositionCommand(
  request: JsonRequest,
  principal: WorkspacePrincipal
): RecordTrademarkAssetManagementDispositionCommand {
  if (!principal.permissions.includes('matter:manage'))
    throw new HttpError(403, 'PERMISSION_DENIED', 'matter:manage permission is required.');
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  const body = request.body as Record<string, unknown>;
  const fields = [
    'expectedTrademarkAssetVersion',
    'managementSignal',
    'recommendation',
    'kind',
    'note'
  ] as const;
  if (Object.keys(body).some((field) => !fields.includes(field as (typeof fields)[number])))
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'Only exact-current disposition fields are accepted; identity, authority, workflow and external-action fields are forbidden.'
    );
  if (
    !Number.isInteger(body.expectedTrademarkAssetVersion) ||
    (body.expectedTrademarkAssetVersion as number) < 1
  )
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'expectedTrademarkAssetVersion must be a positive integer.'
    );
  const managementSignal = exactReference(
    body.managementSignal,
    'managementSignal'
  ) as RecordTrademarkAssetManagementDispositionCommand['managementSignal'];
  const recommendation =
    body.recommendation === undefined
      ? undefined
      : (exactReference(body.recommendation, 'recommendation') as NonNullable<
          RecordTrademarkAssetManagementDispositionCommand['recommendation']
        >);
  if (
    typeof body.kind !== 'string' ||
    !browserDispositionKinds.includes(body.kind as (typeof browserDispositionKinds)[number])
  )
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'kind must be WATCHED, DEFERRED, DISMISSED, or CONTINUED.'
    );
  if (body.note !== undefined && (typeof body.note !== 'string' || !body.note.trim()))
    throw new HttpError(400, 'INVALID_REQUEST', 'note must be a non-empty string when provided.');
  const idempotencyKey = request.headers['idempotency-key'];
  if (!idempotencyKey?.trim())
    throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required.');

  return {
    workspaceId: principal.workspaceId,
    trademarkAssetId: request.params.trademarkAssetId! as TrademarkAssetId,
    expectedTrademarkAssetVersion: body.expectedTrademarkAssetVersion as number,
    managementSignal,
    ...(recommendation ? { recommendation } : {}),
    kind: body.kind as (typeof browserDispositionKinds)[number],
    subjectUserId: principal.userId,
    ...(body.note !== undefined ? { note: body.note } : {}),
    idempotencyKey
  };
}

function commerceInput(
  request: JsonRequest,
  principal: WorkspacePrincipal
): UpsertTrademarkAssetCommerceProfileInput {
  if (!principal.permissions.includes('matter:manage'))
    throw new HttpError(403, 'PERMISSION_DENIED', 'matter:manage permission is required.');
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  const body = request.body as Record<string, unknown>;
  const fields = [
    'expectedTrademarkAssetVersion',
    'expectedCommerceProfileVersion',
    'saleIntent',
    'askingPrice',
    'negotiable',
    'saleTerritories',
    'sellerRole',
    'headline',
    'sellingPoints',
    'aiTags',
    'showcaseTemplateReference',
    'mediaAssetReferences'
  ] satisfies readonly (keyof UpsertTrademarkAssetCommerceProfileInput)[];
  if (Object.keys(body).some((field) => !fields.includes(field as (typeof fields)[number])))
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'Only Commerce Profile fields are accepted; identity and authority come from trusted context.'
    );
  if (Object.values(body).some((value) => value === null))
    throw new HttpError(400, 'INVALID_REQUEST', 'Omit optional fields instead of sending null.');
  if (body.negotiable !== undefined && typeof body.negotiable !== 'boolean')
    throw new HttpError(400, 'INVALID_REQUEST', 'negotiable must be a boolean.');
  for (const field of ['saleTerritories', 'sellingPoints', 'aiTags', 'mediaAssetReferences']) {
    if (body[field] !== undefined && !Array.isArray(body[field]))
      throw new HttpError(400, 'INVALID_REQUEST', `${field} must be an array.`);
  }
  if (
    body.askingPrice !== undefined &&
    (typeof body.askingPrice !== 'object' || Array.isArray(body.askingPrice))
  )
    throw new HttpError(400, 'INVALID_REQUEST', 'askingPrice must be an object.');
  const key = request.headers['idempotency-key'];
  if (!key?.trim())
    throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required.');
  // The existing store validates domain values, versions and exact-asset editability.
  return {
    ...body,
    workspaceId: principal.workspaceId,
    trademarkAssetId: request.params.trademarkAssetId! as TrademarkAssetId,
    idempotencyKey: key
  } as UpsertTrademarkAssetCommerceProfileInput;
}

function aiGuideInput(
  request: JsonRequest,
  principal: WorkspacePrincipal
): PrepareTrademarkAssetAiGuideInput {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  const body = request.body as Record<string, unknown>;
  const fields = ['expectedTrademarkAssetVersion', 'requestedKinds'] as const;
  if (Object.keys(body).some((field) => !fields.includes(field as (typeof fields)[number])))
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'Only expectedTrademarkAssetVersion and requestedKinds are accepted; identity, authority, evidence and context come from trusted owner state.'
    );
  if (
    !Number.isInteger(body.expectedTrademarkAssetVersion) ||
    (body.expectedTrademarkAssetVersion as number) < 1
  )
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'expectedTrademarkAssetVersion must be a positive integer.'
    );
  if (!Array.isArray(body.requestedKinds) || body.requestedKinds.length === 0)
    throw new HttpError(400, 'INVALID_REQUEST', 'requestedKinds must be a non-empty array.');
  if (body.requestedKinds.length > aiGuideSuggestionKinds.length)
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      `requestedKinds must contain at most ${aiGuideSuggestionKinds.length} kinds.`
    );
  if (
    body.requestedKinds.some(
      (kind) =>
        typeof kind !== 'string' || !aiGuideSuggestionKinds.includes(kind as AiGuideSuggestionKind)
    )
  )
    throw new HttpError(400, 'INVALID_REQUEST', 'requestedKinds contains an unsupported kind.');
  if (new Set(body.requestedKinds).size !== body.requestedKinds.length)
    throw new HttpError(400, 'INVALID_REQUEST', 'requestedKinds must not contain duplicates.');

  return {
    workspaceId: principal.workspaceId,
    subjectUserId: principal.userId,
    trademarkAssetId: request.params.trademarkAssetId! as TrademarkAssetId,
    expectedTrademarkAssetVersion: body.expectedTrademarkAssetVersion as number,
    requestedKinds: body.requestedKinds as AiGuideSuggestionKind[]
  };
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
              const signals = deriveTrademarkAssetManagementSignals(
                view,
                latestRefresh,
                generatedAt
              );
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
          const commerceProfile = await options.commerce.get(
            principal.workspaceId,
            trademarkAssetId
          );
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
            commerceProfile: commerceProfile ?? null,
            attention: deriveTrademarkAssetAttention(view, composedAt),
            latestRefresh,
            managementSignals,
            recommendations
          });
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/v1/trademark-assets/:trademarkAssetId/management-dispositions',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret);
        if (Object.keys(request.query).length > 0 || request.body !== undefined) {
          throw new HttpError(
            400,
            'INVALID_REQUEST',
            'This read accepts only the path Trademark Asset and trusted Workspace Principal.'
          );
        }
        try {
          return json(
            200,
            await options.dispositions.listCurrentForAsset(
              principal.workspaceId,
              request.params.trademarkAssetId! as TrademarkAssetId
            )
          );
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/trademark-assets/:trademarkAssetId/commerce-profile',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret);
        const input = commerceInput(request, principal);
        try {
          const commerceProfile = await options.commerce.upsert(input);
          return json(200, { commerceProfile });
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/trademark-assets/:trademarkAssetId/ai-guide',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret);
        const input = aiGuideInput(request, principal);
        try {
          const anchor = await options.assets.get(input.workspaceId, input.trademarkAssetId);
          if (anchor.version !== input.expectedTrademarkAssetVersion)
            throw new HttpError(
              409,
              'ASSET_VERSION_CONFLICT',
              'Trademark Asset changed; refresh before preparing its AI Guide.'
            );
          const commerceProfile = await options.commerce.get(
            input.workspaceId,
            input.trademarkAssetId
          );
          if (commerceProfile && commerceProfile.trademarkAssetVersion !== anchor.version)
            throw new HttpError(
              409,
              'COMMERCE_PROFILE_VERSION_CONFLICT',
              'Commerce Profile is stale for the current Trademark Asset version.'
            );
          const view = composeTrademarkAssetView({ anchor, composedAt: now() });
          return json(
            200,
            options.aiGuide.prepare({
              workspaceId: input.workspaceId,
              subjectUserId: input.subjectUserId,
              view,
              ...(commerceProfile ? { commerceProfile } : {}),
              requestedKinds: input.requestedKinds
            })
          );
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/trademark-assets/:trademarkAssetId/management-dispositions',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret);
        const command = managementDispositionCommand(request, principal);
        try {
          const disposition = await options.dispositions.record(command);
          return json(200, { disposition });
        } catch (error) {
          return mapError(error);
        }
      }
    },
    ...createTrademarkAssetCompositionRoutes({
      internalServiceSecret: options.internalServiceSecret,
      assets: options.assets,
      refreshLedger: options.refreshLedger,
      ...(options.now ? { now: options.now } : {})
    })
  ];
}
