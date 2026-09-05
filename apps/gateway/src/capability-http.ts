import {
  AuthenticationError,
  encodeInternalOperatorPrincipal,
  encodeInternalWorkspacePrincipal,
  parseInternalOperatorPrincipal,
  type InternalOperatorPrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import {
  parseCapabilityRequestV2Command,
  type CapabilityRequestV2Command
} from '@markorbit/contracts/capability-runtime';
import {
  HttpError,
  json,
  type JsonRequest,
  type JsonResult,
  type JsonRoute
} from '@markorbit/service-kit';
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
  coreUrl?: string;
  cognitiveTimeoutMs?: number;
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
const COGNITIVE_READ_CAPABILITY = 'control-plane:cognitive:read' as const;

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

function projectionRecord(value: unknown, owner: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new HttpError(
      503,
      'COGNITIVE_OWNER_RESPONSE_INVALID',
      `${owner} cognitive owner response is malformed.`,
      true
    );
  return value as Record<string, unknown>;
}

function canonicalTimestamp(value: unknown): boolean {
  if (typeof value !== 'string' || !value) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function invalidProjection(owner: string): never {
  throw new HttpError(
    503,
    'COGNITIVE_OWNER_RESPONSE_INVALID',
    `${owner} cognitive owner response is malformed.`,
    true
  );
}

function validateCoreCognitiveProjection(value: unknown): unknown {
  const projection = projectionRecord(value, 'Core');
  const source = projectionRecord(projection.source, 'Core');
  const buildRuns = projectionRecord(projection.brainBuildRuns, 'Core');
  projectionRecord(projection.summary, 'Core');
  if (
    projection.schemaVersion !== 1 ||
    !canonicalTimestamp(projection.generatedAt) ||
    source.domain !== 'CORE' ||
    source.authority !== 'BRAIN_REGISTRIES' ||
    source.availability !== 'AVAILABLE' ||
    !Array.isArray(projection.brainAssets) ||
    !Array.isArray(projection.brainGaps) ||
    !Array.isArray(projection.methodImprovements) ||
    buildRuns.availability !== 'NOT_DURABLY_RECORDED' ||
    buildRuns.inventory !== null ||
    buildRuns.reasonCode !== 'NO_DURABLE_BUILD_RUN_REGISTRY'
  )
    return invalidProjection('Core');
  return value;
}

function validateCapabilityCognitiveProjection(value: unknown): unknown {
  const projection = projectionRecord(value, 'Capability Engine');
  const source = projectionRecord(projection.source, 'Capability Engine');
  const policySource = projectionRecord(
    projection.sourceAdmissionPolicySource,
    'Capability Engine'
  );
  projectionRecord(projection.summary, 'Capability Engine');
  if (
    projection.schemaVersion !== 1 ||
    !canonicalTimestamp(projection.generatedAt) ||
    source.domain !== 'CAPABILITY_ENGINE' ||
    source.authority !== 'RUNTIME_CAPABILITY_AND_IMPLEMENTATION_PROFILE_REGISTRIES' ||
    source.availability !== 'AVAILABLE' ||
    policySource.domain !== 'CAPABILITY_ENGINE' ||
    policySource.authority !== 'SOURCE_ADMISSION_POLICY_CATALOG' ||
    policySource.availability !== 'AVAILABLE' ||
    !Array.isArray(projection.runtimeCapabilities) ||
    !Array.isArray(projection.implementationProfiles) ||
    !Array.isArray(projection.sourceAdmissionPolicies)
  )
    return invalidProjection('Capability Engine');
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
  const coreUrl = options.coreUrl ?? process.env.CORE_URL ?? 'http://127.0.0.1:4101';
  const cognitiveTimeoutMs = options.cognitiveTimeoutMs ?? 3_000;

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

  const resolveCognitiveOperator = async (
    request: JsonRequest
  ): Promise<{ principal: InternalOperatorPrincipal } | { response: JsonResult }> => {
    if (!options.internalServiceSecret)
      throw new HttpError(
        503,
        'AUTHENTICATION_SERVICE_UNAVAILABLE',
        'Cognitive operator authentication is unavailable.',
        true
      );
    let response: Response;
    try {
      response = await fetch(`${coreUrl}/internal/control-plane/operator-principals/resolve`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': options.internalServiceSecret,
          ...(request.headers['x-correlation-id']
            ? { 'x-correlation-id': request.headers['x-correlation-id'] }
            : {}),
          ...(request.headers['x-request-id']
            ? { 'x-request-id': request.headers['x-request-id'] }
            : {})
        },
        body: JSON.stringify({ token: token(request) }),
        signal: AbortSignal.timeout(cognitiveTimeoutMs)
      });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(
        503,
        'AUTHENTICATION_SERVICE_UNAVAILABLE',
        'Cognitive operator authentication is unavailable.',
        true
      );
    }
    const value: unknown = await response.json().catch(() => undefined);
    if (value === undefined)
      throw new HttpError(
        503,
        'COGNITIVE_OPERATOR_RESPONSE_INVALID',
        'Core cognitive operator response is malformed.',
        true
      );
    if (!response.ok) return { response: json(response.status, value) };

    let principal: InternalOperatorPrincipal;
    try {
      const encoded = Buffer.from(
        JSON.stringify({ schemaVersion: 1, principal: value }),
        'utf8'
      ).toString('base64url');
      principal = parseInternalOperatorPrincipal(encoded);
    } catch {
      throw new HttpError(
        503,
        'COGNITIVE_OPERATOR_RESPONSE_INVALID',
        'Core cognitive operator response is malformed.',
        true
      );
    }
    if (!principal.capabilities.includes(COGNITIVE_READ_CAPABILITY))
      return {
        response: json(403, {
          code: 'PERMISSION_DENIED',
          message: `${COGNITIVE_READ_CAPABILITY} capability is required.`
        })
      };
    return { principal };
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

  const forwardCognitive = async (
    request: JsonRequest,
    principal: InternalOperatorPrincipal,
    ownerUrl: string,
    path: string,
    owner: 'Core' | 'Capability Engine',
    validate: (value: unknown) => unknown
  ): Promise<JsonResult> => {
    if (!options.internalServiceSecret)
      throw new HttpError(
        503,
        'DOWNSTREAM_UNAVAILABLE',
        `${owner} service authentication is unavailable.`,
        true
      );
    try {
      const response = await fetch(`${ownerUrl}${path}`, {
        method: 'GET',
        headers: {
          'x-markorbit-internal-authorization': options.internalServiceSecret,
          'x-markorbit-principal': encodeInternalOperatorPrincipal(principal),
          ...(request.headers['x-correlation-id']
            ? { 'x-correlation-id': request.headers['x-correlation-id'] }
            : {}),
          ...(request.headers['x-request-id']
            ? { 'x-request-id': request.headers['x-request-id'] }
            : {})
        },
        signal: AbortSignal.timeout(cognitiveTimeoutMs)
      });
      const value: unknown = await response.json().catch(() => undefined);
      if (value === undefined)
        throw new HttpError(
          503,
          'COGNITIVE_OWNER_RESPONSE_INVALID',
          `${owner} cognitive owner response is malformed.`,
          true
        );
      if (response.ok) validate(value);
      return json(response.status, value);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(
        503,
        'DOWNSTREAM_UNAVAILABLE',
        `${owner} cognitive owner source is unavailable.`,
        true
      );
    }
  };

  const cognitive = async (
    request: JsonRequest,
    ownerUrl: string,
    path: string,
    owner: 'Core' | 'Capability Engine',
    validate: (value: unknown) => unknown
  ): Promise<JsonResult> => {
    const resolution = await resolveCognitiveOperator(request);
    if ('response' in resolution) return resolution.response;
    return forwardCognitive(request, resolution.principal, ownerUrl, path, owner, validate);
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
    },
    {
      method: 'GET',
      path: '/api/internal/control-plane/cognitive/brain',
      handle: (request) =>
        cognitive(
          request,
          coreUrl,
          '/internal/control-plane/cognitive',
          'Core',
          validateCoreCognitiveProjection
        )
    },
    {
      method: 'GET',
      path: '/api/internal/control-plane/cognitive/capabilities',
      handle: (request) =>
        cognitive(
          request,
          options.capabilityEngineUrl,
          '/internal/control-plane/cognitive/capabilities',
          'Capability Engine',
          validateCapabilityCognitiveProjection
        )
    }
  ];
}
