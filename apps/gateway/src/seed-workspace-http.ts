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

export interface GatewaySeedWorkspaceOptions {
  liteUrl: string;
  authenticationClient?: CoreAuthenticationClient;
  internalServiceSecret?: string;
  csrfSecret: string;
  allowedOrigins: readonly string[];
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

type Body = Record<string, unknown>;

function body(request: JsonRequest): Body {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Body;
}

function exact(value: Body, fields: readonly string[]) {
  if (Object.keys(value).some((field) => !fields.includes(field)))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body contains unsupported fields.');
}

function required(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string')
    throw new HttpError(400, 'INVALID_REQUEST', `${field} is required.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum)
    throw new HttpError(400, 'INVALID_REQUEST', `${field} is invalid.`);
  return normalized;
}

function mapAuthentication(error: unknown): never {
  if (!(error instanceof AuthenticationError)) throw error;
  const status =
    error.code === 'AUTHENTICATION_SERVICE_UNAVAILABLE'
      ? 503
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

function target(options: GatewaySeedWorkspaceOptions) {
  const secret = (options.internalServiceSecret ?? '').trim();
  if (!secret)
    throw new HttpError(503, 'LITE_RUNTIME_UNAVAILABLE', 'Lite runtime is unavailable.', true);
  return {
    url: options.liteUrl.replace(/\/$/u, ''),
    secret,
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs: options.timeoutMs ?? 3000
  };
}

async function browserPrincipal(
  request: JsonRequest,
  options: GatewaySeedWorkspaceOptions
): Promise<WorkspacePrincipal> {
  const token = readSessionCookie(request.headers.cookie);
  if (!token) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  const workspaceId = request.headers['x-markorbit-workspace-id'];
  if (!workspaceId)
    throw new HttpError(400, 'INVALID_WORKSPACE_CONTEXT', 'Workspace context is required.');
  if (!options.authenticationClient)
    throw new HttpError(
      503,
      'AUTHENTICATION_SERVICE_UNAVAILABLE',
      'Authentication service is unavailable.',
      true
    );
  try {
    const principal = await options.authenticationClient.resolveWorkspace(
      token,
      workspaceId,
      request.headers['x-correlation-id']
    );
    requireTrustedOrigin(request.headers.origin, options.allowedOrigins);
    validateCsrf(
      principal.sessionId,
      options.csrfSecret,
      request.headers['x-markorbit-csrf-token']
    );
    if (!principal.permissions.includes('workspace:manage'))
      throw new AuthenticationError(
        'PERMISSION_DENIED',
        'workspace:manage permission is required.'
      );
    return principal;
  } catch (error) {
    return mapAuthentication(error);
  }
}

async function downstream(
  request: JsonRequest,
  options: GatewaySeedWorkspaceOptions,
  input: {
    path: string;
    body: Body;
    principal?: WorkspacePrincipal;
    idempotencyKey?: string;
  }
) {
  const configured = target(options);
  try {
    const response = await configured.fetchImpl(`${configured.url}${input.path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-markorbit-internal-authorization': configured.secret,
        ...(input.principal
          ? {
              'x-markorbit-principal': encodeInternalWorkspacePrincipal(input.principal),
              'x-markorbit-workspace-id': input.principal.workspaceId
            }
          : {}),
        ...(input.idempotencyKey ? { 'idempotency-key': input.idempotencyKey } : {}),
        ...(request.headers['x-correlation-id']
          ? { 'x-correlation-id': request.headers['x-correlation-id'] }
          : {})
      },
      body: JSON.stringify(input.body),
      signal: AbortSignal.timeout(configured.timeoutMs)
    });
    return json(response.status, await response.json());
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, 'LITE_RUNTIME_UNAVAILABLE', 'Lite runtime is unavailable.', true);
  }
}

export function createGatewaySeedWorkspaceRoutes(
  options: GatewaySeedWorkspaceOptions
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/api/lite/seed-workspace-invitations/preview',
      handle: async (request) => {
        try {
          requireTrustedOrigin(request.headers.origin, options.allowedOrigins);
        } catch (error) {
          return mapAuthentication(error);
        }
        const value = body(request);
        exact(value, ['packageId', 'invitationClaimToken']);
        return downstream(request, options, {
          path: '/v1/seed-workspace-invitations/preview',
          body: {
            packageId: required(value.packageId, 'packageId', 300),
            invitationClaimToken: required(value.invitationClaimToken, 'invitationClaimToken', 500)
          }
        });
      }
    },
    {
      method: 'POST',
      path: '/api/lite/seed-workspace-claims',
      handle: async (request) => {
        const value = body(request);
        exact(value, ['packageId', 'invitationClaimToken']);
        const idempotencyKey = request.headers['idempotency-key']?.trim();
        if (!idempotencyKey)
          throw new HttpError(400, 'INVALID_REQUEST', 'Idempotency-Key header is required.');
        const principal = await browserPrincipal(request, options);
        return downstream(request, options, {
          path: '/v1/seed-workspace-claims',
          principal,
          idempotencyKey,
          body: {
            packageId: required(value.packageId, 'packageId', 300),
            invitationClaimToken: required(value.invitationClaimToken, 'invitationClaimToken', 500)
          }
        });
      }
    },
    {
      method: 'POST',
      path: '/api/lite/seed-workspace-packages/:packageId/first-value',
      handle: async (request) => {
        const value = body(request);
        exact(value, ['workItemId']);
        const idempotencyKey = request.headers['idempotency-key']?.trim();
        if (!idempotencyKey)
          throw new HttpError(400, 'INVALID_REQUEST', 'Idempotency-Key header is required.');
        const principal = await browserPrincipal(request, options);
        const packageId = required(request.params.packageId, 'packageId', 300);
        return downstream(request, options, {
          path: `/v1/seed-workspace-packages/${encodeURIComponent(packageId)}/first-value`,
          principal,
          idempotencyKey,
          body: { workItemId: required(value.workItemId, 'workItemId', 300) }
        });
      }
    }
  ];
}
