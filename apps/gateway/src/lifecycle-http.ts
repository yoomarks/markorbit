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

export interface GatewayLifecycleHttpOptions {
  markRegUrl: string;
  executionUrl: string;
  authenticationClient?: CoreAuthenticationClient;
  internalServiceSecret?: string;
  csrfSecret: string;
  allowedOrigins: readonly string[];
}

type JsonObject = Record<string, unknown>;
const actorSpoofFields = new Set([
  'actorId',
  'userId',
  'reviewerId',
  'reviewerPrincipalId',
  'requestedBy',
  'membershipId'
]);

function bodyRecord(request: JsonRequest): JsonObject {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as JsonObject;
}

function rejectActorSpoof(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) rejectActorSpoof(item);
    return;
  }
  for (const [key, item] of Object.entries(value as JsonObject)) {
    if (actorSpoofFields.has(key))
      throw new HttpError(
        400,
        'ACTOR_SPOOF_REJECTED',
        'Reviewer identity is derived from the authenticated Workspace Principal.'
      );
    rejectActorSpoof(item);
  }
}

function sessionToken(request: JsonRequest): string {
  const value = readSessionCookie(request.headers.cookie);
  if (!value) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return value;
}

function workspaceId(request: JsonRequest, body?: Readonly<JsonObject>): string {
  const header = request.headers['x-markorbit-workspace-id'];
  if (!header)
    throw new HttpError(400, 'INVALID_WORKSPACE_CONTEXT', 'Workspace context is required.');
  if (body?.workspaceId !== undefined && body.workspaceId !== header)
    throw new HttpError(400, 'INVALID_WORKSPACE_CONTEXT', 'Workspace contexts conflict.');
  return header;
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

function hasPermissions(principal: WorkspacePrincipal, required: readonly Permission[]): boolean {
  return required.every((permission) => principal.permissions.includes(permission));
}

async function payload(response: Response): Promise<JsonObject> {
  return (await response.json().catch(() => ({}))) as JsonObject;
}

function idempotency(request: JsonRequest): string {
  const key = request.headers['idempotency-key'];
  if (!key) throw new HttpError(400, 'INVALID_REQUEST', 'Idempotency-Key header is required.');
  return key;
}

export function createGatewayLifecycleRoutes(
  options: GatewayLifecycleHttpOptions
): readonly JsonRoute[] {
  const authenticate = async (
    request: JsonRequest,
    permissions: readonly Permission[],
    mutation = false
  ): Promise<WorkspacePrincipal> => {
    if (!options.authenticationClient)
      throw new HttpError(
        503,
        'AUTHENTICATION_SERVICE_UNAVAILABLE',
        'Authentication service is unavailable.',
        true
      );
    const body = mutation ? bodyRecord(request) : undefined;
    const requestedWorkspaceId = workspaceId(request, body);
    try {
      const principal = await options.authenticationClient.resolveWorkspace(
        sessionToken(request),
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
        throw new AuthenticationError(
          'PERMISSION_DENIED',
          `${permissions.join(' + ')} permission is required.`
        );
      return principal;
    } catch (error) {
      return mapAuthentication(error);
    }
  };

  const serviceHeaders = (request: JsonRequest, principal: WorkspacePrincipal) => {
    if (!options.internalServiceSecret)
      throw new HttpError(
        503,
        'DOWNSTREAM_UNAVAILABLE',
        'Internal service authentication is unavailable.',
        true
      );
    return {
      'content-type': 'application/json',
      'x-markorbit-internal-authorization': options.internalServiceSecret,
      'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
      'x-markorbit-workspace-id': principal.workspaceId,
      ...(request.headers['x-correlation-id']
        ? { 'x-correlation-id': request.headers['x-correlation-id'] }
        : {})
    };
  };

  const forwardMarkReg = async (
    request: JsonRequest,
    principal: WorkspacePrincipal,
    path: string,
    body?: unknown
  ) => {
    try {
      const response = await fetch(`${options.markRegUrl}${path}`, {
        method: request.method,
        headers: serviceHeaders(request, principal),
        ...(request.method === 'GET' ? {} : { body: JSON.stringify(body ?? request.body ?? {}) })
      });
      return { response, body: await payload(response) };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(503, 'DOWNSTREAM_UNAVAILABLE', 'MarkReg service is unavailable.', true);
    }
  };

  const forwardExecution = async (
    request: JsonRequest,
    principal: WorkspacePrincipal,
    path: string,
    body?: unknown
  ) => {
    try {
      const search = new URLSearchParams(request.query).toString();
      const response = await fetch(`${options.executionUrl}${path}${search ? `?${search}` : ''}`, {
        method: request.method,
        headers: serviceHeaders(request, principal),
        ...(request.method === 'GET' ? {} : { body: JSON.stringify(body ?? request.body ?? {}) })
      });
      return { response, body: await payload(response) };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(503, 'DOWNSTREAM_UNAVAILABLE', 'Execution review service is unavailable.', true);
    }
  };

  const operationsProvenance = async (request: JsonRequest, principal: WorkspacePrincipal) => {
    const formalMatterId = request.params.formalMatterId!;
    const markReg = await forwardMarkReg(
      request,
      principal,
      `/v1/operations/formal-matters/${encodeURIComponent(formalMatterId)}/lifecycle-provenance`
    );
    if (!markReg.response.ok) return json(markReg.response.status, markReg.body);
    const events = Array.isArray(markReg.body.events) ? markReg.body.events : [];
    const admissionIds = [
      ...new Set(
        events.flatMap((event) => {
          if (!event || typeof event !== 'object') return [];
          const source = (event as JsonObject).source;
          if (!source || typeof source !== 'object') return [];
          const reviewedSourceAdmission = (source as JsonObject).reviewedSourceAdmission;
          if (!reviewedSourceAdmission || typeof reviewedSourceAdmission !== 'object') return [];
          const id = (reviewedSourceAdmission as JsonObject).id;
          return typeof id === 'string' ? [id] : [];
        })
      )
    ];
    const reviewSources = await Promise.all(
      admissionIds.map(async (admissionId) => {
        const result = await forwardExecution(
          request,
          principal,
          `/internal/reviewed-source-admissions/${encodeURIComponent(admissionId)}/provenance`
        );
        if (!result.response.ok)
          throw new HttpError(
            result.response.status,
            typeof result.body.code === 'string' ? result.body.code : 'PROVENANCE_UNAVAILABLE',
            typeof result.body.message === 'string'
              ? result.body.message
              : 'Execution review provenance is unavailable.',
            result.response.status >= 500
          );
        return result.body;
      })
    );
    return json(200, { ...markReg.body, reviewSources });
  };

  const transition = async (request: JsonRequest, targetStatus: 'ACKNOWLEDGED' | 'DISMISSED') => {
    const principal = await authenticate(request, ['matter:manage'], true);
    const body = bodyRecord(request);
    const expectedVersion = body.expectedVersion;
    if (!Number.isInteger(expectedVersion) || Number(expectedVersion) < 1)
      throw new HttpError(400, 'INVALID_REQUEST', 'expectedVersion must be a positive integer.');
    const idempotencyKey = idempotency(request);
    if (body.idempotencyKey !== undefined && body.idempotencyKey !== idempotencyKey)
      throw new HttpError(
        400,
        'INVALID_REQUEST',
        'Request idempotencyKey must match Idempotency-Key header.'
      );
    const correlationId =
      request.headers['x-correlation-id'] ?? `lifecycle-action:${idempotencyKey}`;
    const result = await forwardMarkReg(
      request,
      principal,
      `/v1/recommended-actions/${encodeURIComponent(request.params.recommendedActionId!)}/transition`,
      {
        expectedVersion: Number(expectedVersion),
        targetStatus,
        idempotencyKey,
        correlationId
      }
    );
    return json(result.response.status, result.body);
  };

  const reviewCommandContext = (request: JsonRequest) => {
    const key = idempotency(request);
    return {
      key,
      correlationId: request.headers['x-correlation-id'] ?? `evidence-review:${key}`
    };
  };

  return [
    {
      method: 'GET',
      path: '/api/markreg/formal-matters/:formalMatterId/lifecycle',
      handle: async (request) => {
        const principal = await authenticate(request, ['matter:read']);
        const result = await forwardMarkReg(
          request,
          principal,
          `/v1/formal-matters/${encodeURIComponent(request.params.formalMatterId!)}/lifecycle`
        );
        return json(result.response.status, result.body);
      }
    },
    {
      method: 'GET',
      path: '/api/operations/formal-matters/:formalMatterId/lifecycle-provenance',
      handle: async (request) => {
        const principal = await authenticate(request, ['review:perform']);
        return operationsProvenance(request, principal);
      }
    },
    {
      method: 'GET',
      path: '/api/operations/evidence-review/queue',
      handle: async (request) => {
        const principal = await authenticate(request, ['review:read']);
        const result = await forwardExecution(request, principal, '/internal/evidence-review/queue');
        return json(result.response.status, result.body);
      }
    },
    {
      method: 'POST',
      path: '/api/operations/evidence-review/sources/capture',
      handle: async (request) => {
        const principal = await authenticate(request, ['review:perform'], true);
        const body = bodyRecord(request);
        rejectActorSpoof(body);
        const result = await forwardExecution(
          request,
          principal,
          '/internal/evidence-review/sources/capture',
          { evidenceHandoffId: body.evidenceHandoffId }
        );
        return json(result.response.status, result.body);
      }
    },
    {
      method: 'POST',
      path: '/api/operations/evidence-review/decisions',
      handle: async (request) => {
        const principal = await authenticate(request, ['review:perform'], true);
        const body = bodyRecord(request);
        rejectActorSpoof(body);
        const { key, correlationId } = reviewCommandContext(request);
        const command = {
          workspaceId: principal.workspaceId,
          evidenceReceiptId: body.evidenceReceiptId,
          expectedEvidenceReceiptVersion: body.expectedEvidenceReceiptVersion,
          expectedEvidenceReceiptFingerprintSha256: body.expectedEvidenceReceiptFingerprintSha256,
          outcome: body.outcome,
          rationale: body.rationale,
          correctionReasons: body.correctionReasons ?? [],
          idempotencyKey: key,
          correlationId
        };
        const result = await forwardExecution(
          request,
          principal,
          '/internal/evidence-review/decisions',
          { command }
        );
        return json(result.response.status, result.body);
      }
    },
    {
      method: 'POST',
      path: '/api/operations/reviewed-source-admissions',
      handle: async (request) => {
        const principal = await authenticate(request, ['review:perform'], true);
        const body = bodyRecord(request);
        rejectActorSpoof(body);
        const { key, correlationId } = reviewCommandContext(request);
        const command = {
          workspaceId: principal.workspaceId,
          evidenceReviewDecisionId: body.evidenceReviewDecisionId,
          expectedEvidenceReviewDecisionVersion: body.expectedEvidenceReviewDecisionVersion,
          expectedEvidenceReviewDecisionFingerprintSha256:
            body.expectedEvidenceReviewDecisionFingerprintSha256,
          formalMatterId: body.formalMatterId,
          expectedFormalMatterVersion: body.expectedFormalMatterVersion,
          admittedEvidenceReferences: body.admittedEvidenceReferences ?? [],
          idempotencyKey: key,
          correlationId
        };
        const result = await forwardExecution(
          request,
          principal,
          '/internal/reviewed-source-admissions',
          { command }
        );
        return json(result.response.status, result.body);
      }
    },
    {
      method: 'POST',
      path: '/api/operations/reviewed-source-handoffs/deliver',
      handle: async (request) => {
        const principal = await authenticate(request, ['review:perform'], true);
        const body = bodyRecord(request);
        rejectActorSpoof(body);
        const { key, correlationId } = reviewCommandContext(request);
        const command = {
          workspaceId: principal.workspaceId,
          reviewedSourceAdmissionId: body.reviewedSourceAdmissionId,
          expectedReviewedSourceAdmissionVersion: body.expectedReviewedSourceAdmissionVersion,
          expectedAdmissionFingerprintSha256: body.expectedAdmissionFingerprintSha256,
          formalMatterId: body.formalMatterId,
          expectedFormalMatterVersion: body.expectedFormalMatterVersion,
          state: body.state,
          eventCode: body.eventCode,
          customerSafeLabel: body.customerSafeLabel,
          customerSafeSummary: body.customerSafeSummary,
          occurredAt: body.occurredAt,
          idempotencyKey: key,
          correlationId
        };
        const result = await forwardExecution(
          request,
          principal,
          '/internal/reviewed-source-handoffs/deliver',
          { command }
        );
        return json(result.response.status, result.body);
      }
    },
    {
      method: 'POST',
      path: '/api/markreg/recommended-actions/:recommendedActionId/acknowledge',
      handle: (request) => transition(request, 'ACKNOWLEDGED')
    },
    {
      method: 'POST',
      path: '/api/markreg/recommended-actions/:recommendedActionId/dismiss',
      handle: (request) => transition(request, 'DISMISSED')
    }
  ];
}
