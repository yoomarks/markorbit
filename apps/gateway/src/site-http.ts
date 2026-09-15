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

export interface GatewaySiteOptionsV1 {
  siteUrl?: string;
  authenticationClient?: CoreAuthenticationClient;
  internalServiceSecret?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  csrfSecret?: string;
  allowedOrigins?: readonly string[];
  trustedProxy?: boolean;
}

function body(request: JsonRequest): Record<string, unknown> {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Record<string, unknown>;
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

async function principal(
  request: JsonRequest,
  options: GatewaySiteOptionsV1,
  permission: 'workspace:read' | 'workspace:manage',
  mutation: boolean
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
    const value = await options.authenticationClient.resolveWorkspace(
      token,
      workspaceId,
      request.headers['x-correlation-id']
    );
    if (!value.permissions.includes(permission))
      throw new AuthenticationError('PERMISSION_DENIED', `${permission} permission is required.`);
    if (mutation) {
      requireTrustedOrigin(request.headers.origin, options.allowedOrigins ?? []);
      validateCsrf(
        value.sessionId,
        options.csrfSecret ?? '',
        request.headers['x-markorbit-csrf-token']
      );
    }
    return value;
  } catch (error) {
    return mapAuthentication(error);
  }
}

function rejectSpoofFields(value: Readonly<Record<string, unknown>>): void {
  const forbidden = ['workspaceId', 'userId', 'membershipId', 'actor', 'principal'];
  if (forbidden.some((field) => Object.prototype.hasOwnProperty.call(value, field)))
    throw new HttpError(
      400,
      'SITE_AUTHORITY_SPOOF_REJECTED',
      'Workspace and actor truth are derived from the authenticated Principal.'
    );
}

function configured(options: GatewaySiteOptionsV1) {
  const secret = (options.internalServiceSecret ?? '').trim();
  if (!secret)
    throw new HttpError(503, 'SITE_RUNTIME_UNAVAILABLE', 'Site runtime is unavailable.', true);
  return {
    url: (options.siteUrl ?? 'http://127.0.0.1:4109').replace(/\/$/u, ''),
    secret,
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs: options.timeoutMs ?? 3_000
  };
}

async function callSite(
  request: JsonRequest,
  options: GatewaySiteOptionsV1,
  path: string,
  method: 'GET' | 'POST',
  value: unknown,
  actor?: WorkspacePrincipal
) {
  const target = configured(options);
  try {
    const response = await target.fetchImpl(`${target.url}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-markorbit-internal-authorization': target.secret,
        ...(actor
          ? {
              'x-markorbit-principal': encodeInternalWorkspacePrincipal(actor),
              'x-markorbit-workspace-id': actor.workspaceId
            }
          : {}),
        ...(request.headers['idempotency-key']
          ? { 'idempotency-key': request.headers['idempotency-key'] }
          : {}),
        ...(request.headers['x-correlation-id']
          ? { 'x-correlation-id': request.headers['x-correlation-id'] }
          : {})
      },
      ...(method === 'GET' ? {} : { body: JSON.stringify(value) }),
      signal: AbortSignal.timeout(target.timeoutMs)
    });
    const responseBody: unknown = await response.json();
    return { status: response.status, body: responseBody };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, 'SITE_RUNTIME_UNAVAILABLE', 'Site runtime is unavailable.', true);
  }
}

function trustedHostname(request: JsonRequest, options: GatewaySiteOptionsV1): string {
  const forwarded = request.headers['x-forwarded-host'];
  const value = options.trustedProxy && forwarded ? forwarded : request.headers.host;
  if (!value || value.includes(','))
    throw new HttpError(400, 'INVALID_SITE_HOST', 'One trusted request host is required.');
  return value;
}

export function createGatewaySiteRoutesV1(options: GatewaySiteOptionsV1): readonly JsonRoute[] {
  const mutate = async (request: JsonRequest, path: (actor: WorkspacePrincipal) => string) => {
    const value = body(request);
    rejectSpoofFields(value);
    if (!request.headers['idempotency-key'])
      throw new HttpError(400, 'INVALID_REQUEST', 'Idempotency-Key header is required.');
    const actor = await principal(request, options, 'workspace:manage', true);
    const response = await callSite(request, options, path(actor), 'POST', value, actor);
    return json(response.status, response.body);
  };
  return [
    {
      method: 'GET',
      path: '/api/site',
      async handle(request) {
        if (Object.keys(request.query).length)
          throw new HttpError(
            400,
            'INVALID_REQUEST',
            'Public Site resolution does not accept query authority.'
          );
        const response = await callSite(
          request,
          options,
          '/internal/site-runtime/resolve',
          'POST',
          { hostname: trustedHostname(request, options), observedAt: new Date().toISOString() }
        );
        if (response.status !== 200) return json(response.status, response.body);
        const record = response.body as { publicSite?: unknown } | undefined;
        if (!record?.publicSite)
          throw new HttpError(
            503,
            'SITE_RUNTIME_INVALID_RESPONSE',
            'Site runtime response is invalid.',
            true
          );
        return json(200, record.publicSite);
      }
    },
    {
      method: 'GET',
      path: '/api/sites',
      async handle(request) {
        const actor = await principal(request, options, 'workspace:read', false);
        const response = await callSite(
          request,
          options,
          `/internal/workspaces/${encodeURIComponent(actor.workspaceId)}/sites`,
          'GET',
          undefined,
          actor
        );
        return json(response.status, response.body);
      }
    },
    {
      method: 'POST',
      path: '/api/sites',
      handle: (request) =>
        mutate(
          request,
          (actor) => `/internal/workspaces/${encodeURIComponent(actor.workspaceId)}/sites`
        )
    },
    {
      method: 'POST',
      path: '/api/sites/:siteId/configurations',
      handle: (request) =>
        mutate(
          request,
          (actor) =>
            `/internal/workspaces/${encodeURIComponent(actor.workspaceId)}/sites/${encodeURIComponent(request.params.siteId!)}/configurations`
        )
    },
    {
      method: 'POST',
      path: '/api/sites/:siteId/host-bindings',
      handle: (request) =>
        mutate(
          request,
          (actor) =>
            `/internal/workspaces/${encodeURIComponent(actor.workspaceId)}/sites/${encodeURIComponent(request.params.siteId!)}/host-bindings`
        )
    },
    {
      method: 'POST',
      path: '/api/site-host-bindings/:bindingId/verify',
      handle: (request) =>
        mutate(
          request,
          (actor) =>
            `/internal/workspaces/${encodeURIComponent(actor.workspaceId)}/site-host-bindings/${encodeURIComponent(request.params.bindingId!)}/verify`
        )
    },
    {
      method: 'POST',
      path: '/api/sites/:siteId/activate',
      handle: (request) =>
        mutate(
          request,
          (actor) =>
            `/internal/workspaces/${encodeURIComponent(actor.workspaceId)}/sites/${encodeURIComponent(request.params.siteId!)}/activate`
        )
    },
    {
      method: 'POST',
      path: '/api/sites/:siteId/suspend',
      handle: (request) =>
        mutate(
          request,
          (actor) =>
            `/internal/workspaces/${encodeURIComponent(actor.workspaceId)}/sites/${encodeURIComponent(request.params.siteId!)}/suspend`
        )
    },
    {
      method: 'GET',
      path: '/api/sites/:siteId/configuration',
      async handle(request) {
        const actor = await principal(request, options, 'workspace:read', false);
        const response = await callSite(
          request,
          options,
          `/internal/workspaces/${encodeURIComponent(actor.workspaceId)}/sites/${encodeURIComponent(request.params.siteId!)}/configuration`,
          'GET',
          undefined,
          actor
        );
        return json(response.status, response.body);
      }
    },
    {
      method: 'GET',
      path: '/api/sites/:siteId/host-bindings',
      async handle(request) {
        const actor = await principal(request, options, 'workspace:read', false);
        const response = await callSite(
          request,
          options,
          `/internal/workspaces/${encodeURIComponent(actor.workspaceId)}/sites/${encodeURIComponent(request.params.siteId!)}/host-bindings`,
          'GET',
          undefined,
          actor
        );
        return json(response.status, response.body);
      }
    }
  ];
}
