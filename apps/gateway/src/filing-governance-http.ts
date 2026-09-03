import {
  AuthenticationError,
  encodeInternalWorkspacePrincipal,
  type Permission,
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

const authorityFields = new Set([
  'workspaceId',
  'workplaceId',
  'actor',
  'actorId',
  'userId',
  'membershipId',
  'subjectUserId'
]);

const idempotentMutation = (request: JsonRequest): boolean =>
  request.method === 'POST' &&
  (request.path === '/api/execution/filing-authorizations' ||
    request.path.endsWith('/confirm') ||
    request.path === '/api/execution/execution-releases' ||
    request.path.endsWith('/release'));

function bodyRecord(request: JsonRequest): Record<string, unknown> {
  const body = request.body ?? {};
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    throw new HttpError(400, 'INVALID_EXECUTION_REQUEST', 'Request body must be an object.');
  return body as Record<string, unknown>;
}

function governedBody(request: JsonRequest): Record<string, unknown> {
  const body = { ...bodyRecord(request) };
  const spoof = Object.keys(body).find((field) => authorityFields.has(field));
  if (spoof)
    throw new HttpError(
      400,
      'INVALID_EXECUTION_AUTHORITY',
      `${spoof} cannot be supplied as browser execution authority.`
    );
  if (request.path.endsWith('/confirm')) delete body.acknowledgedBy;
  if (request.path.endsWith('/release')) delete body.decidedBy;
  return body;
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
  const fixtureMode = options.fixtureTestRuntime === true;

  const correlation = (request: JsonRequest) => request.headers['x-correlation-id'];
  const token = (request: JsonRequest) => {
    const value = readSessionCookie(request.headers.cookie);
    if (!value) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
    return value;
  };

  const principalFor = async (
    request: JsonRequest,
    permission: Permission,
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
      if (!principal.permissions.includes(permission))
        throw new AuthenticationError('PERMISSION_DENIED', `${permission} permission is required.`);
      return principal;
    } catch (error) {
      return mapAuthentication(error);
    }
  };

  const downstreamUrl = (request: JsonRequest) => {
    const search = new URLSearchParams(request.query).toString();
    const path = request.path.replace('/api/execution', '/v1');
    return `${options.executionUrl}${path}${search ? `?${search}` : ''}`;
  };

  const forwardFixture = async (request: JsonRequest) => {
    try {
      const response = await fetch(downstreamUrl(request), {
        method: request.method,
        headers: {
          'content-type': 'application/json',
          ...(request.headers['idempotency-key']
            ? { 'idempotency-key': request.headers['idempotency-key'] }
            : {}),
          ...(request.headers['x-correlation-id']
            ? { 'x-correlation-id': request.headers['x-correlation-id'] }
            : {})
        },
        ...(request.method === 'GET' ? {} : { body: JSON.stringify(request.body ?? {}) })
      });
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

  const forwardGoverned = async (
    request: JsonRequest,
    principal: WorkspacePrincipal,
    body?: unknown
  ) => {
    if (!options.internalServiceSecret)
      throw new HttpError(
        503,
        'DOWNSTREAM_UNAVAILABLE',
        'Execution service authentication is unavailable.',
        true
      );
    try {
      const response = await fetch(downstreamUrl(request), {
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
        ...(request.method === 'GET'
          ? {}
          : { body: JSON.stringify(body === undefined ? (request.body ?? {}) : body) })
      });
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

  return async (request: JsonRequest) => {
    if (fixtureMode) return forwardFixture(request);

    const mutation = request.method !== 'GET';
    const body = mutation ? governedBody(request) : undefined;
    if (idempotentMutation(request) && !request.headers['idempotency-key']?.trim())
      throw new HttpError(
        400,
        'IDEMPOTENCY_KEY_REQUIRED',
        'Idempotency-Key is required for this Filing Governance command.'
      );
    const principal = await principalFor(
      request,
      mutation ? 'execution:manage' : 'execution:read',
      mutation
    );
    return forwardGoverned(request, principal, body);
  };
}
