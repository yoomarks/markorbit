import { timingSafeEqual } from 'node:crypto';
import {
  parseInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type {
  TrademarkServiceProtectedActionKind
} from '@markorbit/contracts/trademark-service-execution';
import type { TrademarkServiceExecutionReadiness } from '@markorbit/contracts/trademark-service-workbench';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import type { PostgresTrademarkServiceExecutionRepository } from './trademark-service-execution-postgres.js';
import {
  TrademarkServiceExecutionError,
  TrademarkServiceProtectedActionGate,
  authorizeTrademarkServiceExecution,
  createTrademarkServiceExecutionPlan
} from './trademark-service-execution.js';

export interface TrademarkServiceExecutionRouteOptions {
  internalServiceSecret: string;
  repository: PostgresTrademarkServiceExecutionRepository;
  now?: () => string;
}

type Body = Record<string, unknown>;
type Permission = 'review:read' | 'review:perform';

const actorSpoofFields = new Set([
  'actorId',
  'userId',
  'authorizedByUserId',
  'releasedByUserId',
  'requestedBy',
  'membershipId'
]);

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function principalOf(
  request: JsonRequest,
  secret: string,
  permission: Permission
): WorkspacePrincipal {
  if (!trusted(secret, request.headers['x-markorbit-internal-authorization']))
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );
  let principal: WorkspacePrincipal;
  try {
    principal = parseInternalWorkspacePrincipal(request.headers['x-markorbit-principal']);
  } catch {
    throw new HttpError(
      401,
      'INVALID_INTERNAL_PRINCIPAL',
      'A trusted Workspace Principal is required.'
    );
  }
  const workspaceId = request.headers['x-markorbit-workspace-id'];
  if (!workspaceId || workspaceId.toLowerCase() !== principal.workspaceId.toLowerCase())
    throw new HttpError(404, 'WORKSPACE_MISMATCH', 'Workspace-scoped record was not found.');
  const allowed =
    permission === 'review:read'
      ? principal.permissions.includes('review:read') ||
        principal.permissions.includes('review:perform')
      : principal.permissions.includes('review:perform');
  if (!allowed)
    throw new HttpError(403, 'PERMISSION_DENIED', `${permission} permission is required.`);
  return principal;
}

function bodyOf(request: JsonRequest): Body {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Body;
}

function rejectActorSpoof(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) rejectActorSpoof(item);
    return;
  }
  for (const [key, item] of Object.entries(value as Body)) {
    if (actorSpoofFields.has(key))
      throw new HttpError(
        400,
        'ACTOR_SPOOF_REJECTED',
        'Actor identity comes from the authenticated Workspace Principal.'
      );
    rejectActorSpoof(item);
  }
}

function positiveVersion(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be a positive integer.`);
  return Number(value);
}

function strings(value: unknown, field: string, required = false): string[] {
  if (value === undefined && !required) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be a string array.`);
  if (required && value.length === 0)
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must not be empty.`);
  return value as string[];
}

function readinessOf(value: unknown, workspaceId: string): TrademarkServiceExecutionReadiness {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'INVALID_REQUEST', 'A Lite-produced Execution Readiness is required.');
  const readiness = value as Partial<TrademarkServiceExecutionReadiness>;
  if (typeof readiness.workspaceId !== 'string' || readiness.workspaceId !== workspaceId)
    throw new HttpError(404, 'WORKSPACE_MISMATCH', 'Execution Readiness was not found.');
  if (readiness.readinessState !== 'READY_FOR_EXECUTION_PREPARATION')
    throw new HttpError(409, 'READINESS_REQUIRED', 'Execution Readiness is not ready.');
  return value as TrademarkServiceExecutionReadiness;
}

function actionKinds(value: unknown): TrademarkServiceProtectedActionKind[] {
  const values = strings(value, 'allowedActions', true);
  const allowed = new Set<TrademarkServiceProtectedActionKind>([
    'PROVIDER_INSTRUCTION',
    'AUTHORITY_FILING',
    'PAYMENT',
    'EXTERNAL_COMMUNICATION',
    'PUBLICATION'
  ]);
  if (values.some((item) => !allowed.has(item as TrademarkServiceProtectedActionKind)))
    throw new HttpError(400, 'INVALID_REQUEST', 'allowedActions contains an unsupported action.');
  return values as TrademarkServiceProtectedActionKind[];
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new HttpError(400, 'INVALID_REQUEST', `${field} is required.`);
  return value.trim();
}

function mapError(error: unknown): never {
  if (error instanceof TrademarkServiceExecutionError)
    throw new HttpError(error.status, error.code, error.message, error.status >= 500);
  throw error;
}

export function createTrademarkServiceExecutionRoutes(
  options: TrademarkServiceExecutionRouteOptions
): readonly JsonRoute[] {
  const now = options.now ?? (() => new Date().toISOString());
  return [
    {
      method: 'POST',
      path: '/v1/trademark-service-execution-authorizations',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'review:perform');
        const body = bodyOf(request);
        rejectActorSpoof(body);
        const readiness = readinessOf(body.readiness, principal.workspaceId);
        try {
          const authorization = authorizeTrademarkServiceExecution({
            workspaceId: principal.workspaceId,
            readiness,
            workPackageVersion: positiveVersion(body.workPackageVersion, 'workPackageVersion'),
            authorizedByUserId: principal.userId,
            authorizationCapacity: requiredString(body.authorizationCapacity, 'authorizationCapacity'),
            authorizedAt: now(),
            ...(typeof body.expiresAt === 'string' ? { expiresAt: body.expiresAt } : {}),
            allowedActions: actionKinds(body.allowedActions),
            ...(body.commercialCeiling && typeof body.commercialCeiling === 'object'
              ? {
                  commercialCeiling: body.commercialCeiling as Parameters<
                    typeof authorizeTrademarkServiceExecution
                  >[0]['commercialCeiling']
                }
              : {}),
            ...(typeof body.providerRestriction === 'string'
              ? { providerRestriction: body.providerRestriction }
              : {}),
            conditions: strings(body.conditions, 'conditions'),
            explicitUserAuthorization: body.explicitUserAuthorization === true,
            acknowledgementAuthorizationIsNotSubmission:
              body.acknowledgementAuthorizationIsNotSubmission === true,
            acknowledgementOfficialAcceptanceNotGuaranteed:
              body.acknowledgementOfficialAcceptanceNotGuaranteed === true
          });
          await options.repository.createAuthorization(authorization);
          return json(201, { authorization });
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/v1/trademark-service-execution-authorizations/:executionAuthorizationId',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'review:read');
        const snapshot = await options.repository.getSnapshot(
          principal.workspaceId,
          request.params.executionAuthorizationId!
        );
        if (!snapshot)
          throw new HttpError(404, 'EXECUTION_AUTHORIZATION_NOT_FOUND', 'Execution authorization was not found.');
        return json(200, { snapshot });
      }
    },
    {
      method: 'POST',
      path: '/v1/trademark-service-execution-authorizations/:executionAuthorizationId/plan',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'review:perform');
        const body = bodyOf(request);
        rejectActorSpoof(body);
        const snapshot = await options.repository.getSnapshot(
          principal.workspaceId,
          request.params.executionAuthorizationId!
        );
        if (!snapshot)
          throw new HttpError(404, 'EXECUTION_AUTHORIZATION_NOT_FOUND', 'Execution authorization was not found.');
        if (!Array.isArray(body.steps))
          throw new HttpError(400, 'INVALID_REQUEST', 'steps must be an array.');
        try {
          const plan = createTrademarkServiceExecutionPlan({
            workspaceId: principal.workspaceId,
            authorization: snapshot.authorization,
            createdAt: now(),
            steps: body.steps as Parameters<typeof createTrademarkServiceExecutionPlan>[0]['steps']
          });
          await options.repository.savePlan(principal.workspaceId, plan);
          return json(201, { plan });
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/trademark-service-execution-authorizations/:executionAuthorizationId/protected-action-releases',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'review:perform');
        const body = bodyOf(request);
        rejectActorSpoof(body);
        const key = request.headers['idempotency-key'];
        if (!key?.trim())
          throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required.');
        const snapshot = await options.repository.getSnapshot(
          principal.workspaceId,
          request.params.executionAuthorizationId!
        );
        if (!snapshot?.plan)
          throw new HttpError(409, 'EXECUTION_PLAN_REQUIRED', 'A durable Execution Plan is required.');
        try {
          const release = new TrademarkServiceProtectedActionGate().release({
            workspaceId: principal.workspaceId,
            authorization: snapshot.authorization,
            plan: snapshot.plan,
            stepId: requiredString(body.stepId, 'stepId'),
            idempotencyKey: key,
            evidenceReferences: strings(body.evidenceReferences, 'evidenceReferences', true),
            releasedByUserId: principal.userId,
            releasedAt: now(),
            currentWorkPackageVersion: positiveVersion(
              body.currentWorkPackageVersion,
              'currentWorkPackageVersion'
            )
          });
          const durableRelease = await options.repository.saveProtectedActionRelease(release);
          return json(201, { release: durableRelease });
        } catch (error) {
          return mapError(error);
        }
      }
    }
  ];
}
