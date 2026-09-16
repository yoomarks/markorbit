import {
  AuthenticationError,
  encodeInternalWorkspacePrincipal,
  type Permission,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  readSessionCookie,
  requireTrustedOrigin,
  validateCsrf,
  type CoreAuthenticationClient
} from './auth.js';

export interface GatewayBusinessAttributionOptions {
  liteUrl: string;
  authenticationClient?: CoreAuthenticationClient;
  internalServiceSecret?: string;
  csrfSecret: string;
  allowedOrigins: readonly string[];
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function body(request: JsonRequest): Record<string, unknown> {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  }
  return request.body as Record<string, unknown>;
}
const serverFields = [
  'workspaceId',
  'actorPrincipalId',
  'recordedByPrincipalId',
  'businessAttributionLinkId',
  'version',
  'businessAttributionFingerprintSha256',
  'authorityConsequences'
] as const;
function rejectSpoof(value: Record<string, unknown>): void {
  if (serverFields.some((field) => Object.hasOwn(value, field))) {
    throw new HttpError(
      400,
      'ACTOR_SPOOF_REJECTED',
      'Workspace, actor, identity and authority fields are server-owned.'
    );
  }
}
function mapAuth(error: unknown): never {
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
  options: GatewayBusinessAttributionOptions,
  permission: Permission,
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
    if (mutation) {
      requireTrustedOrigin(request.headers.origin, options.allowedOrigins);
      validateCsrf(value.sessionId, options.csrfSecret, request.headers['x-markorbit-csrf-token']);
    }
    if (!value.permissions.includes(permission))
      throw new AuthenticationError('PERMISSION_DENIED', `${permission} permission is required.`);
    return value;
  } catch (error) {
    return mapAuth(error);
  }
}
function configured(options: GatewayBusinessAttributionOptions) {
  const secret = (options.internalServiceSecret ?? '').trim();
  if (!secret)
    throw new HttpError(503, 'LITE_RUNTIME_UNAVAILABLE', 'Lite runtime is unavailable.', true);
  return {
    url: options.liteUrl.replace(/\/$/u, ''),
    secret,
    fetchImpl: options.fetchImpl ?? fetch,
    timeout: options.timeoutMs ?? 3000
  };
}
async function forward(
  request: JsonRequest,
  options: GatewayBusinessAttributionOptions,
  downstreamPath: string,
  method: 'GET' | 'POST'
) {
  const mutation = method === 'POST';
  const value = mutation ? body(request) : undefined;
  if (value) rejectSpoof(value);
  const workspacePrincipal = await principal(
    request,
    options,
    mutation ? 'workspace:manage' : 'workspace:read',
    mutation
  );
  const idempotencyKey = request.headers['idempotency-key']?.trim();
  if (mutation && !idempotencyKey)
    throw new HttpError(400, 'INVALID_REQUEST', 'Idempotency-Key header is required.');
  const target = configured(options);
  try {
    const response = await target.fetchImpl(`${target.url}${downstreamPath}`, {
      method,
      headers: {
        ...(mutation
          ? { 'content-type': 'application/json', 'idempotency-key': idempotencyKey! }
          : {}),
        'x-markorbit-internal-authorization': target.secret,
        'x-markorbit-principal': encodeInternalWorkspacePrincipal(workspacePrincipal),
        'x-markorbit-workspace-id': workspacePrincipal.workspaceId,
        ...(request.headers['x-correlation-id']
          ? { 'x-correlation-id': request.headers['x-correlation-id'] }
          : {})
      },
      ...(mutation ? { body: JSON.stringify(value) } : {}),
      signal: AbortSignal.timeout(target.timeout)
    });
    return json(response.status, await response.json());
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, 'LITE_RUNTIME_UNAVAILABLE', 'Lite runtime is unavailable.', true);
  }
}

export function createGatewayBusinessAttributionRoutes(
  options: GatewayBusinessAttributionOptions
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/api/lite/business-attribution-links',
      handle: (request) => forward(request, options, '/v1/business-attribution-links', 'POST')
    },
    {
      method: 'POST',
      path: '/api/lite/content-led-demand-attribution-links',
      handle: (request) =>
        forward(request, options, '/v1/content-led-demand-attribution-links', 'POST')
    },
    {
      method: 'POST',
      path: '/api/lite/partner-referral-programs',
      handle: (request) => forward(request, options, '/v1/partner-referral-programs', 'POST')
    },
    {
      method: 'POST',
      path: '/api/lite/partner-commission-eligibility-candidates',
      handle: (request) =>
        forward(request, options, '/v1/partner-commission-eligibility-candidates', 'POST')
    },
    {
      method: 'POST',
      path: '/api/lite/education-community/cohorts',
      handle: (request) => forward(request, options, '/v1/education-community/cohorts', 'POST')
    },
    {
      method: 'POST',
      path: '/api/lite/education-community/participants',
      handle: (request) => forward(request, options, '/v1/education-community/participants', 'POST')
    },
    {
      method: 'POST',
      path: '/api/lite/education-community/journeys/:journeyId/invitation',
      handle: (request) =>
        forward(
          request,
          options,
          `/v1/education-community/journeys/${encodeURIComponent(request.params.journeyId!)}/invitation`,
          'POST'
        )
    },
    {
      method: 'POST',
      path: '/api/lite/education-community/activations',
      handle: (request) => forward(request, options, '/v1/education-community/activations', 'POST')
    },
    {
      method: 'POST',
      path: '/api/lite/education-community/journeys/:journeyId/first-value',
      handle: (request) =>
        forward(
          request,
          options,
          `/v1/education-community/journeys/${encodeURIComponent(request.params.journeyId!)}/first-value`,
          'POST'
        )
    },
    {
      method: 'POST',
      path: '/api/lite/education-community/journeys/:journeyId/retained-use',
      handle: (request) =>
        forward(
          request,
          options,
          `/v1/education-community/journeys/${encodeURIComponent(request.params.journeyId!)}/retained-use`,
          'POST'
        )
    },
    {
      method: 'GET',
      path: '/api/lite/partner-commission-eligibility-candidates/:candidateId',
      handle: (request) =>
        forward(
          request,
          options,
          `/v1/partner-commission-eligibility-candidates/${encodeURIComponent(request.params.candidateId!)}`,
          'GET'
        )
    },
    {
      method: 'GET',
      path: '/api/lite/business-attribution-links/site-inbound/summary',
      handle: (request) =>
        forward(request, options, '/v1/business-attribution-links/site-inbound/summary', 'GET')
    },
    {
      method: 'GET',
      path: '/api/lite/business-attribution-links/:linkId',
      handle: (request) =>
        forward(
          request,
          options,
          `/v1/business-attribution-links/${encodeURIComponent(request.params.linkId!)}`,
          'GET'
        )
    }
  ];
}
