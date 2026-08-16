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

export interface GatewayPaymentHttpOptions {
  paymentUrl?: string;
  authenticationClient?: CoreAuthenticationClient;
  internalServiceSecret?: string;
  csrfSecret: string;
  allowedOrigins: readonly string[];
}

const spoofFields = [
  'actorId',
  'userId',
  'initiatedByUserId',
  'membershipId',
  'orderId',
  'productId',
  'productVersion',
  'priceId',
  'priceVersion',
  'amount',
  'amountMinor',
  'currency',
  'status',
  'provider',
  'providerPaymentReference'
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

function workspaceId(request: JsonRequest, body?: Readonly<Record<string, unknown>>): string {
  const value = request.headers['x-markorbit-workspace-id'];
  if (!value)
    throw new HttpError(400, 'INVALID_WORKSPACE_CONTEXT', 'Workspace context is required.');
  if (body?.workspaceId !== undefined && body.workspaceId !== value)
    throw new HttpError(400, 'INVALID_WORKSPACE_CONTEXT', 'Workspace contexts conflict.');
  return value;
}

function rejectSpoof(body: Readonly<Record<string, unknown>>): void {
  if (spoofFields.some((field) => Object.prototype.hasOwnProperty.call(body, field)))
    throw new HttpError(
      400,
      'MONETARY_OR_ACTOR_SPOOF_REJECTED',
      'Payment identity, provider state, and monetary truth are derived from governed server state.'
    );
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

export function createGatewayPaymentRoutes(
  options: GatewayPaymentHttpOptions
): readonly JsonRoute[] {
  const paymentUrl = options.paymentUrl ?? process.env.PAYMENT_URL ?? 'http://127.0.0.1:4108';
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
    if (body) {
      rejectSpoof(body);
      idempotency(request, body);
    }
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
      }
      if (!hasPermissions(principal, permissions))
        throw new AuthenticationError('PERMISSION_DENIED', 'Payment permission is required.');
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
        'Payment service authentication is unavailable.',
        true
      );
    try {
      const response = await fetch(`${paymentUrl}${path}`, {
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
      throw new HttpError(503, 'DOWNSTREAM_UNAVAILABLE', 'Payment service is unavailable.', true);
    }
  };

  return [
    {
      method: 'POST',
      path: '/api/payments',
      handle: async (request) => {
        const principal = await authenticate(request, true, ['order:update']);
        return forward(request, principal, '/v1/payments');
      }
    },
    {
      method: 'GET',
      path: '/api/payments/:paymentId',
      handle: async (request) => {
        const principal = await authenticate(request, false, ['order:read']);
        return forward(
          request,
          principal,
          `/v1/payments/${encodeURIComponent(request.params.paymentId!)}`
        );
      }
    }
  ];
}
