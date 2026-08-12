import {
  AuthenticationError,
  encodeInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  type CoreAuthenticationClient,
  readSessionCookie,
  requireTrustedOrigin,
  validateCsrf
} from './auth.js';

export interface GatewayCapabilityOptions {
  capabilityEngineUrl: string;
  authenticationClient?: CoreAuthenticationClient;
  internalServiceSecret?: string;
  csrfSecret: string;
  allowedOrigins: readonly string[];
}

const identitySpoofFields = [
  'actorId',
  'userId',
  'subjectUserId',
  'workspaceId',
  'membershipId',
  'decidedBySubjectUserId',
  'principal',
  'permissions',
  'role'
] as const;
const dispositionFields = new Set([
  'candidateVersion',
  'expectedCandidateFingerprintSha256',
  'outcome',
  'rationale'
]);

function token(request: JsonRequest): string {
  const value = readSessionCookie(request.headers.cookie);
  if (!value) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return value;
}

function workspaceId(request: JsonRequest): string {
  const value = request.headers['x-markorbit-workspace-id'];
  if (!value)
    throw new HttpError(400, 'INVALID_WORKSPACE_CONTEXT', 'Workspace context is required.');
  return value;
}

function bodyRecord(request: JsonRequest): Record<string, unknown> {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Record<string, unknown>;
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

function rejectSpoofOrUnsupported(body: Readonly<Record<string, unknown>>): void {
  if (identitySpoofFields.some((field) => Object.prototype.hasOwnProperty.call(body, field)))
    throw new HttpError(
      400,
      'SUBJECT_SPOOF_REJECTED',
      'Workspace and subject identity are derived from the authenticated Core Principal.'
    );
  const unsupported = Object.keys(body).filter((key) => !dispositionFields.has(key));
  if (unsupported.length)
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'Reflection disposition contains unsupported fields.'
    );
}

function mutationAllowed(principal: WorkspacePrincipal): boolean {
  return (
    principal.permissions.includes('matter:manage') ||
    principal.permissions.includes('review:perform') ||
    principal.permissions.includes('workspace:manage')
  );
}

export function createGatewayCapabilityRoutes(
  options: GatewayCapabilityOptions
): readonly JsonRoute[] {
  const authenticate = async (
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
    try {
      const principal = await options.authenticationClient.resolveWorkspace(
        token(request),
        workspaceId(request),
        request.headers['x-correlation-id']
      );
      if (!principal.permissions.includes('workspace:read'))
        throw new AuthenticationError(
          'PERMISSION_DENIED',
          'workspace:read permission is required.'
        );
      if (mutation) {
        const body = bodyRecord(request);
        rejectSpoofOrUnsupported(body);
        requireTrustedOrigin(request.headers.origin, options.allowedOrigins);
        validateCsrf(
          principal.sessionId,
          options.csrfSecret,
          request.headers['x-markorbit-csrf-token']
        );
        if (!request.headers['idempotency-key']?.trim())
          throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required.');
        if (!mutationAllowed(principal))
          throw new AuthenticationError(
            'PERMISSION_DENIED',
            'Reflection disposition permission is required.'
          );
      }
      return principal;
    } catch (error) {
      return mapAuthentication(error);
    }
  };

  const forward = async (
    request: JsonRequest,
    principal: WorkspacePrincipal,
    path: string,
    body?: Readonly<Record<string, unknown>>
  ) => {
    if (!options.internalServiceSecret)
      throw new HttpError(
        503,
        'DOWNSTREAM_UNAVAILABLE',
        'Capability Engine authentication is unavailable.',
        true
      );
    try {
      const response = await fetch(`${options.capabilityEngineUrl}${path}`, {
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
        ...(request.method === 'GET' ? {} : { body: JSON.stringify(body ?? {}) })
      });
      const value: unknown = await response.json().catch(() => ({}));
      return json(response.status, value);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(503, 'DOWNSTREAM_UNAVAILABLE', 'Capability Engine is unavailable.', true);
    }
  };

  return [
    {
      method: 'GET',
      path: '/api/lite/capability-center',
      handle: async (request) => {
        const principal = await authenticate(request, false);
        return forward(request, principal, '/internal/v1/capability-center');
      }
    },
    {
      method: 'POST',
      path: '/api/lite/capability-center/reflection-candidates/:reflectionCandidateId/disposition',
      handle: async (request) => {
        const principal = await authenticate(request, true);
        const body = bodyRecord(request);
        return forward(
          request,
          principal,
          `/internal/v1/reflection-candidates/${encodeURIComponent(request.params.reflectionCandidateId!)}/disposition`,
          {
            candidateVersion: body.candidateVersion,
            expectedCandidateFingerprintSha256: body.expectedCandidateFingerprintSha256,
            outcome: body.outcome,
            ...(body.rationale === undefined ? {} : { rationale: body.rationale })
          }
        );
      }
    }
  ];
}
