import {
  AuthenticationError,
  encodeInternalWorkspacePrincipal,
  type Permission,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  type CoreAuthenticationClient,
  readSessionCookie,
  requireTrustedOrigin,
  validateCsrf
} from './auth.js';
import { createDataEngineClient } from './data-engine-http.js';
import {
  mapDataEngineTrademarkAssetFacts,
  resolveTrademarkAssetDataEngineLookup
} from './trademark-asset-data-engine.js';

export interface GatewayProductLoopOptions {
  liteUrl: string;
  authenticationClient?: CoreAuthenticationClient;
  internalServiceSecret?: string;
  csrfSecret: string;
  allowedOrigins: readonly string[];
  dataEngineUrl?: string;
  dataEngineApiKey?: string;
  dataEngineTimeoutMs?: number;
  dataEngineFetchImpl?: typeof fetch;
}

const actorSpoofFields = [
  'actorId',
  'userId',
  'subjectUserId',
  'confirmedByPrincipalId',
  'decidedByPrincipalId',
  'reviewerPrincipalId',
  'reviewedByUserId',
  'recordedByPrincipalId',
  'membershipId'
] as const;

function bodyRecord(request: JsonRequest): Record<string, unknown> {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Record<string, unknown>;
}

function token(request: JsonRequest): string {
  const value = readSessionCookie(request.headers.cookie);
  if (!value) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return value;
}

function mapAuthentication(error: unknown): never {
  if (!(error instanceof AuthenticationError)) throw error;
  const status =
    error.code === 'AUTHENTICATION_SERVICE_UNAVAILABLE'
      ? 503
      : error.code === 'INVALID_WORKSPACE_CONTEXT'
        ? 400
        : [
              'MEMBERSHIP_REQUIRED',
              'MEMBERSHIP_SUSPENDED',
              'WORKSPACE_ARCHIVED',
              'PERMISSION_DENIED',
              'INVALID_CSRF_TOKEN',
              'UNTRUSTED_ORIGIN'
            ].includes(error.code)
          ? 403
          : 401;
  throw new HttpError(status, error.code, error.message, status === 503);
}

function rejectActorSpoof(body: Readonly<Record<string, unknown>>): void {
  if (actorSpoofFields.some((field) => Object.prototype.hasOwnProperty.call(body, field)))
    throw new HttpError(
      400,
      'ACTOR_SPOOF_REJECTED',
      'Actor identity is derived from the authenticated Core Principal.'
    );
}

function workspaceId(request: JsonRequest, body?: Readonly<Record<string, unknown>>): string {
  const header = request.headers['x-markorbit-workspace-id'];
  if (!header)
    throw new HttpError(400, 'INVALID_WORKSPACE_CONTEXT', 'Workspace context is required.');
  if (body?.workspaceId !== undefined && body.workspaceId !== header)
    throw new HttpError(400, 'INVALID_WORKSPACE_CONTEXT', 'Workspace contexts conflict.');
  return header;
}

function idempotency(request: JsonRequest, body: Readonly<Record<string, unknown>>): string {
  const key = request.headers['idempotency-key'];
  if (!key || !key.trim())
    throw new HttpError(400, 'INVALID_REQUEST', 'Idempotency-Key header is required.');
  if (body.idempotencyKey !== undefined && body.idempotencyKey !== key)
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'Request idempotencyKey must match Idempotency-Key header.'
    );
  return key;
}

function hasPermissions(principal: WorkspacePrincipal, required: readonly Permission[]): boolean {
  return required.every((permission) => principal.permissions.includes(permission));
}

function environmentTimeout(): number | undefined {
  const raw = process.env.DATA_ENGINE_TIMEOUT_MS;
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

export function createGatewayProductLoopRoutes(
  options: GatewayProductLoopOptions
): readonly JsonRoute[] {
  const dataEngineUrl = options.dataEngineUrl ?? process.env.DATA_ENGINE_URL;
  const dataEngineApiKey = options.dataEngineApiKey ?? process.env.DATA_ENGINE_API_KEY;
  const dataEngineTimeoutMs = options.dataEngineTimeoutMs ?? environmentTimeout();

  const authenticate = async (
    request: JsonRequest,
    mutation: boolean,
    permissions: readonly Permission[]
  ): Promise<WorkspacePrincipal> => {
    if (!options.authenticationClient)
      throw new HttpError(
        503,
        'AUTHENTICATION_SERVICE_UNAVAILABLE',
        'Authentication service is unavailable.',
        true
      );
    const body = mutation ? bodyRecord(request) : undefined;
    if (body) rejectActorSpoof(body);
    const requestedWorkspaceId = workspaceId(request, body);
    try {
      const principal = await options.authenticationClient.resolveWorkspace(
        token(request),
        requestedWorkspaceId,
        request.headers['x-correlation-id']
      );
      if (mutation) {
        requireTrustedOrigin(request.headers.origin, options.allowedOrigins);
        validateCsrf(
          principal.sessionId,
          options.csrfSecret,
          request.headers['x-markorbit-csrf-token']
        );
        idempotency(request, body!);
      }
      if (!hasPermissions(principal, permissions))
        throw new AuthenticationError('PERMISSION_DENIED', 'Product-loop permission is required.');
      return principal;
    } catch (error) {
      return mapAuthentication(error);
    }
  };

  const liteCall = async (
    request: JsonRequest,
    principal: WorkspacePrincipal,
    input: { method?: 'GET' | 'POST'; path?: string; body?: unknown } = {}
  ): Promise<{ status: number; body: unknown }> => {
    if (!options.internalServiceSecret)
      throw new HttpError(
        503,
        'DOWNSTREAM_UNAVAILABLE',
        'Lite service authentication is unavailable.',
        true
      );
    try {
      const method = input.method ?? request.method;
      const search = input.path ? '' : new URLSearchParams(request.query).toString();
      const path = input.path ?? request.path.replace('/api/lite', '/v1');
      const response = await fetch(`${options.liteUrl}${path}${search ? `?${search}` : ''}`, {
        method,
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': options.internalServiceSecret,
          'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
          'x-markorbit-workspace-id': principal.workspaceId,
          ...(request.headers['x-correlation-id']
            ? { 'x-correlation-id': request.headers['x-correlation-id'] }
            : {}),
          ...(request.headers['x-request-id']
            ? { 'x-request-id': request.headers['x-request-id'] }
            : {}),
          ...(request.headers['idempotency-key']
            ? { 'idempotency-key': request.headers['idempotency-key'] }
            : {})
        },
        ...(method === 'GET' ? {} : { body: JSON.stringify(input.body ?? request.body ?? {}) })
      });
      return { status: response.status, body: await response.json() };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(503, 'DOWNSTREAM_UNAVAILABLE', 'Lite service is unavailable.', true);
    }
  };

  const forward = async (request: JsonRequest, principal: WorkspacePrincipal) => {
    const response = await liteCall(request, principal);
    return json(response.status, response.body);
  };

  const trademarkAssetDetail = async (request: JsonRequest): Promise<ReturnType<typeof json>> => {
    const principal = await authenticate(request, false, ['workspace:read']);
    const base = await liteCall(request, principal);
    if (base.status !== 200) return json(base.status, base.body);

    const lookup = resolveTrademarkAssetDataEngineLookup(base.body);
    if (!lookup || !dataEngineUrl || !dataEngineApiKey) return json(200, base.body);

    try {
      const client = createDataEngineClient({
        dataEngineUrl,
        apiKey: dataEngineApiKey,
        ...(dataEngineTimeoutMs === undefined ? {} : { timeoutMs: dataEngineTimeoutMs }),
        ...(options.dataEngineFetchImpl ? { fetchImpl: options.dataEngineFetchImpl } : {})
      });
      const context = {
        ...(request.headers['x-correlation-id']
          ? { correlationId: request.headers['x-correlation-id'] }
          : {}),
        ...(request.headers['x-request-id'] ? { requestId: request.headers['x-request-id'] } : {})
      };
      const envelope =
        lookup.jurisdiction === 'CN'
          ? await client.cnCase(lookup.applicationNumber, context)
          : await client.usCase(lookup.applicationNumber, context);
      const facts = mapDataEngineTrademarkAssetFacts(envelope);
      if (!facts.length) return json(200, base.body);

      const recomposed = await liteCall(request, principal, {
        method: 'POST',
        path: `/internal/v1/workspaces/${encodeURIComponent(principal.workspaceId)}/trademark-assets/${encodeURIComponent(request.params.trademarkAssetId!)}/compose`,
        body: { facts }
      });
      return recomposed.status === 200 ? json(200, recomposed.body) : json(200, base.body);
    } catch {
      // MO-DE-010 enrichment is advisory read composition. Provider/config/runtime failure must
      // preserve the original M10 detail rather than manufacture absence or make the Asset unusable.
      return json(200, base.body);
    }
  };

  const route = (
    method: JsonRoute['method'],
    path: string,
    permissions: readonly Permission[],
    mutation = method !== 'GET'
  ): JsonRoute => ({
    method,
    path,
    handle: async (request) => {
      const principal = await authenticate(request, mutation, permissions);
      return forward(request, principal);
    }
  });

  return [
    route('GET', '/api/lite/today', ['workspace:read'], false),
    route('GET', '/api/lite/daily-orbit', ['workspace:read'], false),
    route('GET', '/api/lite/daily-workspace', ['workspace:read'], false),
    route('GET', '/api/lite/opportunity-candidates', ['workspace:read'], false),
    route(
      'GET',
      '/api/lite/opportunity-candidates/:opportunityCandidateId',
      ['workspace:read'],
      false
    ),
    route(
      'GET',
      '/api/lite/opportunity-candidates/:opportunityCandidateId/qualification',
      ['workspace:read'],
      false
    ),
    route('GET', '/api/lite/trademark-assets', ['workspace:read'], false),
    {
      method: 'GET',
      path: '/api/lite/trademark-assets/:trademarkAssetId',
      handle: trademarkAssetDetail
    },
    route('POST', '/api/lite/trademark-assets/:trademarkAssetId/commerce-profile', [
      'matter:manage'
    ]),
    route(
      'GET',
      '/api/lite/trademark-assets/:trademarkAssetId/service-work-package',
      ['workspace:read'],
      false
    ),
    route('POST', '/api/lite/trademark-assets/:trademarkAssetId/service-work-packages', [
      'matter:create'
    ]),
    route('POST', '/api/lite/trademark-service-work-packages/:workPackageId/execution-readiness', [
      'review:perform'
    ]),
    route('GET', '/api/lite/content-studio/works', ['workspace:read'], false),
    route('GET', '/api/lite/content-studio/works/:contentOpportunityId', ['workspace:read'], false),
    route('GET', '/api/lite/content-kits/:contentPickId', ['workspace:read'], false),
    route('GET', '/api/lite/visual-briefs/:visualBriefId', ['workspace:read'], false),
    route('GET', '/api/lite/visual-outputs/:visualOutputReferenceId', ['workspace:read'], false),
    route('GET', '/api/lite/analytics/product-loop-conversions', ['workspace:read'], false),
    route('GET', '/api/lite/prepared-actions/:preparedActionId', ['workspace:read'], false),
    route('POST', '/api/lite/product-preference-events', ['workspace:read']),
    route('POST', '/api/lite/today/:todayRecommendationId/prepared-actions', ['matter:manage']),
    route('POST', '/api/lite/prepared-actions/:preparedActionId/confirm', ['matter:manage']),
    route('POST', '/api/lite/content-kits/:contentPickId/visual-briefs', ['matter:manage']),
    route('POST', '/api/lite/visual-briefs/:visualBriefId/request', ['matter:manage']),
    route('POST', '/api/lite/publish-packages/:publishPackageId/use-feedback', ['matter:manage'])
  ];
}
