import {
  AuthenticationError,
  encodeInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import {
  parseCapabilityRequestV2Command,
  type CapabilityRequestV2Command
} from '@markorbit/contracts/capability-runtime';
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
const capabilityRequestFields = new Set([
  'schemaVersion',
  'capabilityId',
  'capabilityVersion',
  'purpose',
  'input',
  'inputSchemaId',
  'outputSchemaId',
  'riskClass',
  'idempotencyKey',
  'correlationId'
]);
const capabilityIdentitySpoofFields = [
  'caller',
  'workspaceId',
  'principalId',
  'callerProduct',
  'permissionContextRef',
  'entitlementContextRef',
  'membershipId',
  'userId',
  'principal'
] as const;
const implementationControlFields = [
  'provider',
  'providerId',
  'model',
  'modelId',
  'endpoint',
  'credential',
  'credentialRef',
  'implementation',
  'implementationKey',
  'implementationProfileId'
] as const;

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

function trustedCapabilityCommand(
  request: JsonRequest,
  principal: WorkspacePrincipal
): CapabilityRequestV2Command {
  const body = bodyRecord(request);
  if (
    capabilityIdentitySpoofFields.some((field) => Object.prototype.hasOwnProperty.call(body, field))
  ) {
    throw new HttpError(
      400,
      'SUBJECT_SPOOF_REJECTED',
      'Capability caller identity is derived from the authenticated Core Workspace Principal.'
    );
  }
  if (
    implementationControlFields.some((field) => Object.prototype.hasOwnProperty.call(body, field))
  ) {
    throw new HttpError(
      400,
      'IMPLEMENTATION_CONTROL_REJECTED',
      'Provider, model, credential and implementation selection are server-governed.'
    );
  }
  const unsupported = Object.keys(body).filter((key) => !capabilityRequestFields.has(key));
  if (unsupported.length) {
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      `Capability request contains unsupported fields: ${unsupported.join(', ')}.`
    );
  }

  let command: CapabilityRequestV2Command;
  try {
    command = parseCapabilityRequestV2Command({
      schemaVersion: body.schemaVersion,
      capabilityId: body.capabilityId,
      capabilityVersion: body.capabilityVersion,
      caller: {
        workspaceId: principal.workspaceId,
        principalId: principal.userId,
        callerProduct: 'LITE',
        permissionContextRef: `core-workspace-membership:${principal.membershipId}`
      },
      purpose: body.purpose,
      input: body.input,
      inputSchemaId: body.inputSchemaId,
      outputSchemaId: body.outputSchemaId,
      riskClass: body.riskClass,
      idempotencyKey: body.idempotencyKey,
      correlationId: body.correlationId
    });
  } catch (error) {
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      error instanceof Error ? error.message : 'Capability request is invalid.'
    );
  }

  const idempotencyKey = request.headers['idempotency-key']?.trim();
  if (!idempotencyKey || idempotencyKey !== command.idempotencyKey) {
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'Idempotency-Key header is required and must match the governed request command.'
    );
  }
  const correlationId = request.headers['x-correlation-id']?.trim();
  if (correlationId && correlationId !== command.correlationId) {
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'X-Correlation-Id must match the governed request command when supplied.'
    );
  }
  return command;
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

  const authenticateInvocation = async (request: JsonRequest): Promise<WorkspacePrincipal> => {
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
      requireTrustedOrigin(request.headers.origin, options.allowedOrigins);
      validateCsrf(
        principal.sessionId,
        options.csrfSecret,
        request.headers['x-markorbit-csrf-token']
      );
      if (!request.headers['idempotency-key']?.trim())
        throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required.');
      return principal;
    } catch (error) {
      return mapAuthentication(error);
    }
  };

  const forward = async (
    request: JsonRequest,
    principal: WorkspacePrincipal,
    path: string,
    body?: unknown,
    callerProduct?: string,
    correlationId?: string
  ) => {
    if (!options.internalServiceSecret)
      throw new HttpError(
        503,
        'DOWNSTREAM_UNAVAILABLE',
        'Capability Engine authentication is unavailable.',
        true
      );
    try {
      const forwardedCorrelationId = correlationId ?? request.headers['x-correlation-id'];
      const response = await fetch(`${options.capabilityEngineUrl}${path}`, {
        method: request.method,
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': options.internalServiceSecret,
          'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
          'x-markorbit-workspace-id': principal.workspaceId,
          ...(callerProduct ? { 'x-markorbit-caller-product': callerProduct } : {}),
          ...(forwardedCorrelationId ? { 'x-correlation-id': forwardedCorrelationId } : {}),
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
      method: 'POST',
      path: '/api/lite/capability-requests',
      handle: async (request) => {
        const principal = await authenticateInvocation(request);
        const command = trustedCapabilityCommand(request, principal);
        return forward(
          request,
          principal,
          '/v1/capability-requests',
          command,
          'LITE',
          command.correlationId
        );
      }
    },
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
