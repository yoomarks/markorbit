import {
  AuthenticationError,
  encodeInternalOperatorPrincipal,
  type InternalOperatorPrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { type CoreAuthenticationClient, readSessionCookie } from './auth.js';

export interface GatewayCommercialAdminMgsnOptions {
  mgsnUrl?: string;
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

export function createGatewayCommercialAdminMgsnRoutes(
  options: GatewayCommercialAdminMgsnOptions
): readonly JsonRoute[] {
  const mgsnUrl = options.mgsnUrl ?? process.env.MGSN_URL ?? 'http://127.0.0.1:4106';

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
        'MGSN service authentication is unavailable.',
        true
      );
    try {
      const response = await fetch(`${mgsnUrl}${path}`, {
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
      throw new HttpError(503, 'DOWNSTREAM_UNAVAILABLE', 'MGSN service is unavailable.', true);
    }
  };

  return [
    {
      method: 'GET',
      path: '/api/internal/commercial-admin/providers',
      handle: async (request) =>
        forward(request, await authenticate(request), '/internal/commercial-admin/providers')
    },
    {
      method: 'GET',
      path: '/api/internal/commercial-admin/providers/:providerId',
      handle: async (request) =>
        forward(
          request,
          await authenticate(request),
          `/internal/commercial-admin/providers/${encodeURIComponent(request.params.providerId!)}`
        )
    }
  ];
}
