import {
  AuthenticationError,
  encodeInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest } from '@markorbit/service-kit';
import {
  type CoreAuthenticationClient,
  readSessionCookie,
  requireTrustedOrigin,
  validateCsrf
} from './auth.js';

export interface GatewayFilingGovernanceOptions {
  executionUrl: string;
  authenticationClient?: CoreAuthenticationClient;
  internalServiceSecret?: string;
  csrfSecret: string;
  allowedOrigins: readonly string[];
  fixtureTestRuntime?: boolean;
}

const browserAuthorityFields = new Set([
  'workspaceId',
  'userId',
  'membershipId',
  'role',
  'permissions',
  'principal',
  'actor',
  'actorId',
  'requestedBy',
  'acknowledgedBy',
  'decidedBy'
]);

function safeBody(body: unknown): unknown {
  if (body === undefined || body === null) return {};
  if (typeof body !== 'object' || Array.isArray(body)) return body;
  return Object.fromEntries(
    Object.entries(body as Record<string, unknown>).filter(
      ([field]) => !browserAuthorityFields.has(field)
    )
  );
}

function requiresIdempotency(request: JsonRequest): boolean {
  if (request.method !== 'POST') return false;
  return (
    request.path === '/api/execution/filing-authorizations' ||
    /\/filing-authorizations\/[^/]+\/confirm$/.test(request.path) ||
    request.path === '/api/execution/execution-releases' ||
    /\/execution-releases\/[^/]+\/release$/.test(request.path)
  );
}

function mapAuthentication(error: unknown): never {
  if (error instanceof HttpError) throw error;
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

export function createGatewayFilingGovernanceHandler(options: GatewayFilingGovernanceOptions) {
  const fixtureMode =
    options.fixtureTestRuntime === true &&
    options.authenticationClient === undefined &&
    options.internalServiceSecret === undefined;

  const correlation = (request: JsonRequest) => request.headers['x-correlation-id'];

  const token = (request: JsonRequest) => {
    const value = readSessionCookie(request.headers.cookie);
    if (!value) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
    return value;
  };

  const principalFor = async (
    request: JsonRequest,
    mutation: boolean
  ): Promise<WorkspacePrincipal> => {
    if (!options.authenticationClient)
      throw new HttpError(
        503,
        'AUTHENTICATION_SERVICE_UNAVAILABLE',
        'Authentication service is unavailable.',
        true
      );
    const workspaceId = request.headers['x-markorbit-workspace-id'];
    if (!workspaceId)
      throw new HttpError(400, 'INVALID_WORKSPACE_CONTEXT', 'Workspace context is required.');
    try {
      const principal = await options.authenticationClient.resolveWorkspace(
        token(request),
        workspaceId,
        correlation(request)
      );
      if (mutation) {
        requireTrustedOrigin(request.headers.origin, options.allowedOrigins);
        validateCsrf(
          principal.sessionId,
          options.csrfSecret,
          request.headers['x-markorbit-csrf-token']
        );
      }
      const permission = mutation ? 'execution:manage' : 'execution:read';
      if (!principal.permissions.includes(permission))
        throw new AuthenticationError('PERMISSION_DENIED', `${permission} permission is required.`);
      return principal;
    } catch (error) {
      return mapAuthentication(error);
    }
  };

  const forwardFixture = async (request: JsonRequest) => {
    try {
      const query = new URLSearchParams({ ...request.query }).toString();
      const response = await fetch(
        `${options.executionUrl}${request.path.replace('/api/execution', '/v1')}${query ? `?${query}` : ''}`,
        {
          method: request.method,
          headers: {
            'content-type': 'application/json',
            ...(request.headers['idempotency-key']
              ? { 'idempotency-key': request.headers['idempotency-key'] }
              : {})
          },
          ...(request.method === 'GET' ? {} : { body: JSON.stringify(request.body ?? {}) })
        }
      );
      return json(response.status, await response.json());
    } catch {
      throw new HttpError(
        503,
        'DOWNSTREAM_UNAVAILABLE',
        'Execution filing governance service is unavailable.',
        true
      );
    }
  };

  return async (request: JsonRequest) => {
    if (fixtureMode) return forwardFixture(request);
    if (requiresIdempotency(request) && !request.headers['idempotency-key']?.trim())
      throw new HttpError(
        400,
        'IDEMPOTENCY_KEY_REQUIRED',
        'Idempotency-Key is required for this Filing Governance command.'
      );
    const principal = await principalFor(request, request.method !== 'GET');
    if (!options.internalServiceSecret)
      throw new HttpError(
        503,
        'DOWNSTREAM_UNAVAILABLE',
        'Execution service authentication is unavailable.',
        true
      );
    try {
      const query = new URLSearchParams({ ...request.query }).toString();
      const response = await fetch(
        `${options.executionUrl}${request.path.replace('/api/execution', '/v1')}${query ? `?${query}` : ''}`,
        {
          method: request.method,
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
          ...(request.method === 'GET' ? {} : { body: JSON.stringify(safeBody(request.body)) })
        }
      );
      return json(response.status, await response.json());
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(
        503,
        'DOWNSTREAM_UNAVAILABLE',
        'Execution filing governance service is unavailable.',
        true
      );
    }
  };
}
