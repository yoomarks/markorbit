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
export interface GatewayOutboundContactPolicyOptions {
  liteUrl: string;
  authenticationClient?: CoreAuthenticationClient;
  internalServiceSecret?: string;
  csrfSecret: string;
  allowedOrigins: readonly string[];
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}
type Mode = 'DURABLE_MUTATION' | 'ADVISORY_POST';
function body(r: JsonRequest): Record<string, unknown> {
  if (!r.body || typeof r.body !== 'object' || Array.isArray(r.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return r.body as Record<string, unknown>;
}
const spoof = [
  'workspaceId',
  'actorPrincipalId',
  'assertedByPrincipalId',
  'recordedByPrincipalId',
  'assertionId',
  'suppressionId',
  'version',
  'status',
  'authorityConsequences',
  'legalConsentVerifiedByMarkOrbit',
  'externalSendAuthorized',
  'externalMessageSent',
  'protectedActionAuthorized',
  'readinessFingerprintSha256',
  'evaluatedAt'
] as const;
function rejectSpoof(v: Record<string, unknown>) {
  if (spoof.some((f) => Object.hasOwn(v, f)))
    throw new HttpError(
      400,
      'ACTOR_SPOOF_REJECTED',
      'Workspace, actor, lifecycle and authority fields are server-owned.'
    );
}
function mapAuth(e: unknown): never {
  if (!(e instanceof AuthenticationError)) throw e;
  const status =
    e.code === 'AUTHENTICATION_SERVICE_UNAVAILABLE'
      ? 503
      : [
            'MEMBERSHIP_REQUIRED',
            'MEMBERSHIP_SUSPENDED',
            'WORKSPACE_ARCHIVED',
            'PERMISSION_DENIED',
            'INVALID_CSRF_TOKEN',
            'UNTRUSTED_ORIGIN'
          ].includes(e.code)
        ? 403
        : 401;
  throw new HttpError(status, e.code, e.message, status === 503);
}
async function principal(
  r: JsonRequest,
  o: GatewayOutboundContactPolicyOptions,
  permission: Permission
): Promise<WorkspacePrincipal> {
  const token = readSessionCookie(r.headers.cookie);
  if (!token) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  const w = r.headers['x-markorbit-workspace-id'];
  if (!w) throw new HttpError(400, 'INVALID_WORKSPACE_CONTEXT', 'Workspace context is required.');
  if (!o.authenticationClient)
    throw new HttpError(
      503,
      'AUTHENTICATION_SERVICE_UNAVAILABLE',
      'Authentication service is unavailable.',
      true
    );
  try {
    const p = await o.authenticationClient.resolveWorkspace(
      token,
      w,
      r.headers['x-correlation-id']
    );
    requireTrustedOrigin(r.headers.origin, o.allowedOrigins);
    validateCsrf(p.sessionId, o.csrfSecret, r.headers['x-markorbit-csrf-token']);
    if (!p.permissions.includes(permission))
      throw new AuthenticationError('PERMISSION_DENIED', `${permission} permission is required.`);
    return p;
  } catch (e) {
    return mapAuth(e);
  }
}
function configured(o: GatewayOutboundContactPolicyOptions) {
  const secret = (o.internalServiceSecret ?? '').trim();
  if (!secret)
    throw new HttpError(503, 'LITE_RUNTIME_UNAVAILABLE', 'Lite runtime is unavailable.', true);
  return {
    url: o.liteUrl.replace(/\/$/u, ''),
    secret,
    fetchImpl: o.fetchImpl ?? fetch,
    timeout: o.timeoutMs ?? 3000
  };
}
async function forward(
  r: JsonRequest,
  o: GatewayOutboundContactPolicyOptions,
  path: string,
  permission: Permission,
  mode: Mode
) {
  const v = body(r);
  rejectSpoof(v);
  const p = await principal(r, o, permission);
  const idem = r.headers['idempotency-key']?.trim();
  if (mode === 'DURABLE_MUTATION' && !idem)
    throw new HttpError(400, 'INVALID_REQUEST', 'Idempotency-Key header is required.');
  const target = configured(o);
  try {
    const res = await target.fetchImpl(`${target.url}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-markorbit-internal-authorization': target.secret,
        'x-markorbit-principal': encodeInternalWorkspacePrincipal(p),
        'x-markorbit-workspace-id': p.workspaceId,
        ...(idem ? { 'idempotency-key': idem } : {}),
        ...(r.headers['x-correlation-id']
          ? { 'x-correlation-id': r.headers['x-correlation-id'] }
          : {})
      },
      body: JSON.stringify(v),
      signal: AbortSignal.timeout(target.timeout)
    });
    return json(res.status, await res.json());
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(503, 'LITE_RUNTIME_UNAVAILABLE', 'Lite runtime is unavailable.', true);
  }
}
export function createGatewayOutboundContactPolicyRoutes(
  o: GatewayOutboundContactPolicyOptions
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/api/lite/outbound-contact-policy/basis-assertions',
      handle: (r) =>
        forward(
          r,
          o,
          '/v1/outbound-contact-policy/basis-assertions',
          'workspace:manage',
          'DURABLE_MUTATION'
        )
    },
    {
      method: 'POST',
      path: '/api/lite/outbound-contact-policy/basis-assertions/:assertionId/revoke',
      handle: (r) =>
        forward(
          r,
          o,
          `/v1/outbound-contact-policy/basis-assertions/${encodeURIComponent(r.params.assertionId!)}/revoke`,
          'workspace:manage',
          'DURABLE_MUTATION'
        )
    },
    {
      method: 'POST',
      path: '/api/lite/outbound-contact-policy/basis-assertions/:assertionId/supersede',
      handle: (r) =>
        forward(
          r,
          o,
          `/v1/outbound-contact-policy/basis-assertions/${encodeURIComponent(r.params.assertionId!)}/supersede`,
          'workspace:manage',
          'DURABLE_MUTATION'
        )
    },
    {
      method: 'POST',
      path: '/api/lite/outbound-contact-policy/suppressions',
      handle: (r) =>
        forward(
          r,
          o,
          '/v1/outbound-contact-policy/suppressions',
          'workspace:manage',
          'DURABLE_MUTATION'
        )
    },
    {
      method: 'POST',
      path: '/api/lite/outbound-contact-policy/suppressions/:suppressionId/clear',
      handle: (r) =>
        forward(
          r,
          o,
          `/v1/outbound-contact-policy/suppressions/${encodeURIComponent(r.params.suppressionId!)}/clear`,
          'workspace:manage',
          'DURABLE_MUTATION'
        )
    },
    {
      method: 'POST',
      path: '/api/lite/outbound-contact-policy/readiness/evaluate',
      handle: (r) =>
        forward(
          r,
          o,
          '/v1/outbound-contact-policy/readiness/evaluate',
          'workspace:read',
          'ADVISORY_POST'
        )
    }
  ];
}
