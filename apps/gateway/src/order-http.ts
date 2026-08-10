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
import { createGatewayLifecycleRoutes } from './lifecycle-http.js';

export interface GatewayOrderHttpOptions {
  markRegUrl: string;
  executionUrl?: string;
  authenticationClient?: CoreAuthenticationClient;
  internalServiceSecret?: string;
  csrfSecret: string;
  allowedOrigins: readonly string[];
}

const actorSpoofFields = [
  'actorId',
  'userId',
  'createdByUserId',
  'updatedByUserId',
  'linkedByUserId',
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
      'Actor identity is derived from the authenticated Principal.'
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
  if (!key) throw new HttpError(400, 'INVALID_REQUEST', 'Idempotency-Key header is required.');
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

export function createGatewayOrderRoutes(options: GatewayOrderHttpOptions): readonly JsonRoute[] {
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
        throw new AuthenticationError('PERMISSION_DENIED', 'Order permission is required.');
      return principal;
    } catch (error) {
      return mapAuthentication(error);
    }
  };

  const forward = async (request: JsonRequest, principal: WorkspacePrincipal, path: string) => {
    if (!options.internalServiceSecret)
      throw new HttpError(
        503,
        'DOWNSTREAM_UNAVAILABLE',
        'MarkReg service authentication is unavailable.',
        true
      );
    try {
      const search = new URLSearchParams(request.query).toString();
      const response = await fetch(`${options.markRegUrl}${path}${search ? `?${search}` : ''}`, {
        method: request.method,
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': options.internalServiceSecret,
          'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
          'x-markorbit-workspace-id': principal.workspaceId,
          ...(request.headers['x-correlation-id']
            ? { 'x-correlation-id': request.headers['x-correlation-id'] }
            : {}),
          ...(request.headers['idempotency-key']
            ? { 'idempotency-key': request.headers['idempotency-key'] }
            : {})
        },
        ...(request.method === 'GET' ? {} : { body: JSON.stringify(request.body ?? {}) })
      });
      return json(response.status, await response.json());
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(503, 'DOWNSTREAM_UNAVAILABLE', 'MarkReg service is unavailable.', true);
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
      return forward(request, principal, request.path.replace('/api/markreg', '/v1'));
    }
  });

  return [
    route('POST', '/api/markreg/orders', ['order:create']),
    route('GET', '/api/markreg/orders', ['order:read'], false),
    route('GET', '/api/markreg/orders/:orderId', ['order:read'], false),
    route('POST', '/api/markreg/orders/:orderId/request-confirmation', ['order:update']),
    route('POST', '/api/markreg/orders/:orderId/confirm', ['order:confirm']),
    route('POST', '/api/markreg/orders/:orderId/evaluate-readiness', ['order:update']),
    route('POST', '/api/markreg/orders/:orderId/create-matter', [
      'order:matter:create',
      'matter:create'
    ]),
    route('POST', '/api/markreg/orders/:orderId/link-matter', [
      'order:matter:create',
      'matter:read'
    ]),
    route('POST', '/api/markreg/orders/:orderId/cancel', ['order:cancel']),
    ...createGatewayLifecycleRoutes({
      markRegUrl: options.markRegUrl,
      executionUrl: options.executionUrl ?? process.env.EXECUTION_URL ?? 'http://127.0.0.1:4104',
      ...(options.authenticationClient ? { authenticationClient: options.authenticationClient } : {}),
      ...(options.internalServiceSecret
        ? { internalServiceSecret: options.internalServiceSecret }
        : {}),
      csrfSecret: options.csrfSecret,
      allowedOrigins: options.allowedOrigins
    })
  ];
}
