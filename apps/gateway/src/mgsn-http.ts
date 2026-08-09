import {
  AuthenticationError,
  encodeInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  readSessionCookie,
  requireTrustedOrigin,
  validateCsrf,
  type CoreAuthenticationClient
} from './auth.js';

export const PROVIDER_WORKSPACE_HEADER_NAME = 'x-markorbit-provider-workspace-id';

export interface GatewayMgsnRouteOptions {
  mgsnUrl: string;
  authenticationClient?: CoreAuthenticationClient;
  internalServiceSecret?: string;
  csrfSecret: string;
  allowedOrigins: readonly string[];
}

type RouteMethod = 'GET' | 'POST';
type RouteDefinition = readonly [RouteMethod, string];

const operationsRoutes: readonly RouteDefinition[] = [
  ['GET', '/api/mgsn/providers'],
  ['POST', '/api/mgsn/providers'],
  ['GET', '/api/mgsn/providers/:providerId'],
  ['POST', '/api/mgsn/providers/:providerId/status'],
  ['GET', '/api/mgsn/providers/:providerId/supply-capabilities'],
  ['POST', '/api/mgsn/providers/:providerId/supply-capabilities'],
  ['GET', '/api/mgsn/supply-capabilities/:providerSupplyCapabilityId'],
  ['POST', '/api/mgsn/supply-capabilities/:providerSupplyCapabilityId/revise'],
  ['POST', '/api/mgsn/service-packages'],
  ['GET', '/api/mgsn/service-packages/:servicePackageId'],
  ['GET', '/api/mgsn/service-packages/:servicePackageId/candidate-supply-capabilities'],
  ['POST', '/api/mgsn/service-packages/:servicePackageId/evaluate-provider'],
  ['GET', '/api/mgsn/eligibility-evaluations/:eligibilityEvaluationId'],
  ['POST', '/api/mgsn/allocations'],
  ['GET', '/api/mgsn/allocations/:allocationId'],
  ['GET', '/api/mgsn/provider-acceptances/:providerAcceptanceId'],
  ['POST', '/api/mgsn/provider-returns/:providerReturnId/handoff']
];

const providerRoutes: readonly RouteDefinition[] = [
  ['GET', '/api/provider/allocations/:allocationId'],
  ['POST', '/api/provider/allocations/:allocationId/respond'],
  ['POST', '/api/provider/returns'],
  ['GET', '/api/provider/returns/:providerReturnId']
];

function requestToken(request: JsonRequest) {
  const value = readSessionCookie(request.headers.cookie);
  if (!value) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return value;
}

function recordBody(request: JsonRequest): Record<string, unknown> {
  if (request.body === undefined || request.body === null) return {};
  if (typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Record<string, unknown>;
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

function requirePermission(principal: WorkspacePrincipal, mutation: boolean) {
  const permission = mutation ? 'execution:manage' : 'execution:read';
  if (!principal.permissions.includes(permission))
    throw new AuthenticationError('PERMISSION_DENIED', `${permission} permission is required.`);
}

function forbidProviderIdentityPayload(request: JsonRequest) {
  const body = recordBody(request);
  if ('providerId' in body || 'providerWorkspaceId' in body)
    throw new HttpError(
      400,
      'PROVIDER_IDENTITY_PAYLOAD_FORBIDDEN',
      'Provider identity is derived from the authenticated Provider Workspace.'
    );
}

function downstreamPath(path: string, provider: boolean) {
  return provider
    ? path.replace('/api/provider', '/v1/provider')
    : path.replace('/api/mgsn', '/v1');
}

export function createGatewayMgsnRoutes(options: GatewayMgsnRouteOptions): JsonRoute[] {
  const authentication = () => {
    if (!options.authenticationClient)
      throw new HttpError(
        503,
        'AUTHENTICATION_SERVICE_UNAVAILABLE',
        'Authentication service is unavailable.',
        true
      );
    return options.authenticationClient;
  };
  const correlation = (request: JsonRequest) => request.headers['x-correlation-id'];
  const resolvePrincipal = async (request: JsonRequest, provider: boolean) => {
    const workspaceId = provider
      ? request.headers[PROVIDER_WORKSPACE_HEADER_NAME]
      : (request.headers['x-markorbit-workspace-id'] ??
        (typeof recordBody(request).workspaceId === 'string'
          ? (recordBody(request).workspaceId as string)
          : undefined));
    if (!workspaceId)
      throw new HttpError(
        400,
        provider ? 'PROVIDER_WORKSPACE_CONTEXT_REQUIRED' : 'INVALID_WORKSPACE_CONTEXT',
        provider ? 'Provider Workspace context is required.' : 'Workspace context is required.'
      );
    try {
      return await authentication().resolveWorkspace(
        requestToken(request),
        workspaceId,
        correlation(request)
      );
    } catch (error) {
      return mapAuthentication(error);
    }
  };
  const forward = async (
    request: JsonRequest,
    principal: WorkspacePrincipal,
    provider: boolean
  ) => {
    if (!options.internalServiceSecret)
      throw new HttpError(
        503,
        'MGSN_INTERNAL_AUTHORIZATION_UNAVAILABLE',
        'MGSN internal authorization is unavailable.',
        true
      );
    const search = new URLSearchParams(request.query).toString();
    try {
      const response = await fetch(
        `${options.mgsnUrl}${downstreamPath(request.path, provider)}${search ? `?${search}` : ''}`,
        {
          method: request.method,
          headers: {
            'content-type': 'application/json',
            'x-markorbit-internal-authorization': options.internalServiceSecret,
            'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
            'x-markorbit-workspace-id': principal.workspaceId,
            ...(correlation(request) ? { 'x-correlation-id': correlation(request)! } : {}),
            ...(request.headers['idempotency-key']
              ? { 'idempotency-key': request.headers['idempotency-key'] }
              : {})
          },
          ...(request.method === 'GET' ? {} : { body: JSON.stringify(request.body ?? {}) })
        }
      );
      return json(response.status, await response.json());
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(503, 'MGSN_UNAVAILABLE', 'MGSN service is unavailable.', true);
    }
  };
  const handle = async (request: JsonRequest, provider: boolean) => {
    const mutation = request.method !== 'GET';
    if (provider && mutation) forbidProviderIdentityPayload(request);
    try {
      const principal = await resolvePrincipal(request, provider);
      requirePermission(principal, mutation);
      if (mutation) {
        requireTrustedOrigin(request.headers.origin, options.allowedOrigins);
        validateCsrf(
          principal.sessionId,
          options.csrfSecret,
          request.headers['x-markorbit-csrf-token']
        );
      }
      return forward(request, principal, provider);
    } catch (error) {
      return mapAuthentication(error);
    }
  };
  return [
    ...operationsRoutes.map(([method, path]): JsonRoute => ({
      method,
      path,
      handle: (request) => handle(request, false)
    })),
    ...providerRoutes.map(([method, path]): JsonRoute => ({
      method,
      path,
      handle: (request) => handle(request, true)
    }))
  ];
}
