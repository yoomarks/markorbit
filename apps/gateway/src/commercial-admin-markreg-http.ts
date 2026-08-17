import {
  AuthenticationError,
  encodeInternalOperatorPrincipal,
  type InternalOperatorPrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { type CoreAuthenticationClient, readSessionCookie } from './auth.js';

export interface GatewayCommercialAdminMarkRegOptions {
  markRegUrl?: string;
  authenticationClient?: CoreAuthenticationClient;
  internalServiceSecret?: string;
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
      : error.code === 'PERMISSION_DENIED'
        ? 403
        : 401;
  throw new HttpError(status, error.code, error.message, status === 503);
}

function queryString(query: Readonly<Record<string, string | undefined>>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined) search.set(key, value);
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}

export function createGatewayCommercialAdminMarkRegRoutes(
  options: GatewayCommercialAdminMarkRegOptions
): readonly JsonRoute[] {
  const markRegUrl = options.markRegUrl ?? process.env.MARKREG_URL ?? 'http://127.0.0.1:4105';

  const authenticate = async (request: JsonRequest): Promise<InternalOperatorPrincipal> => {
    if (!options.authenticationClient?.resolveInternalOperator)
      throw new HttpError(
        503,
        'AUTHENTICATION_SERVICE_UNAVAILABLE',
        'Commercial admin authentication is unavailable.',
        true
      );
    try {
      const principal = await options.authenticationClient.resolveInternalOperator(
        token(request),
        request.headers['x-correlation-id']
      );
      if (!principal.capabilities.includes('commercial-admin:read'))
        throw new AuthenticationError(
          'PERMISSION_DENIED',
          'commercial-admin:read capability is required.'
        );
      return principal;
    } catch (error) {
      return mapAuthentication(error);
    }
  };

  const forward = async (
    request: JsonRequest,
    principal: InternalOperatorPrincipal,
    path: string
  ) => {
    if (!options.internalServiceSecret)
      throw new HttpError(
        503,
        'DOWNSTREAM_UNAVAILABLE',
        'MarkReg service authentication is unavailable.',
        true
      );
    try {
      const response = await fetch(`${markRegUrl}${path}${queryString(request.query)}`, {
        headers: {
          'x-markorbit-internal-authorization': options.internalServiceSecret,
          'x-markorbit-principal': encodeInternalOperatorPrincipal(principal),
          ...(request.headers['x-correlation-id']
            ? { 'x-correlation-id': request.headers['x-correlation-id'] }
            : {})
        }
      });
      return json(response.status, await response.json());
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(503, 'DOWNSTREAM_UNAVAILABLE', 'MarkReg service is unavailable.', true);
    }
  };

  const route = (path: string, downstream: (request: JsonRequest) => string): JsonRoute => ({
    method: 'GET',
    path,
    handle: async (request) => forward(request, await authenticate(request), downstream(request))
  });

  return [
    route('/api/internal/commercial-admin/catalog', () => '/internal/commercial-admin/catalog'),
    route(
      '/api/internal/commercial-admin/workspaces/:workspaceId/orders',
      (request) =>
        `/internal/commercial-admin/workspaces/${encodeURIComponent(request.params.workspaceId!)}/orders`
    ),
    route(
      '/api/internal/commercial-admin/workspaces/:workspaceId/orders/:orderId',
      (request) =>
        `/internal/commercial-admin/workspaces/${encodeURIComponent(request.params.workspaceId!)}/orders/${encodeURIComponent(request.params.orderId!)}`
    ),
    route(
      '/api/internal/commercial-admin/workspaces/:workspaceId/checkouts/:checkoutSessionId',
      (request) =>
        `/internal/commercial-admin/workspaces/${encodeURIComponent(request.params.workspaceId!)}/checkouts/${encodeURIComponent(request.params.checkoutSessionId!)}`
    ),
    route(
      '/api/internal/commercial-admin/workspaces/:workspaceId/matters',
      (request) =>
        `/internal/commercial-admin/workspaces/${encodeURIComponent(request.params.workspaceId!)}/matters`
    ),
    route(
      '/api/internal/commercial-admin/workspaces/:workspaceId/matters/:formalMatterId',
      (request) =>
        `/internal/commercial-admin/workspaces/${encodeURIComponent(request.params.workspaceId!)}/matters/${encodeURIComponent(request.params.formalMatterId!)}`
    )
  ];
}
