import { timingSafeEqual } from 'node:crypto';
import {
  parseInternalWorkspacePrincipal,
  type FormalMatterId,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type { RecommendedActionId } from '@markorbit/contracts/evidence-lifecycle';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import type { FormalMatterRepository } from './formal-matter.js';
import {
  LifecycleProjectionError,
  type LifecycleProjectionService
} from './lifecycle-projection.js';
import {
  RecommendedActionError,
  type RecommendedActionService
} from './recommended-action.js';

type Body = Record<string, unknown>;

type SurfacePermission = 'matter:read' | 'matter:manage' | 'review:perform';

export interface MarkRegLifecycleSurfaceRouteOptions {
  internalServiceSecret: string;
  formalMatterRepository: FormalMatterRepository;
  lifecycleServiceFor(workspaceId: string): LifecycleProjectionService;
  recommendedActionServiceFor(workspaceId: string): RecommendedActionService;
}

function trusted(configured: string, supplied: string | undefined) {
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
  permission: SurfacePermission
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
  if (!principal.permissions.includes(permission))
    throw new HttpError(403, 'PERMISSION_DENIED', `${permission} permission is required.`);
  return principal;
}

function bodyOf(request: JsonRequest): Body {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Body;
}

function mapSurfaceError(error: unknown): never {
  if (error instanceof LifecycleProjectionError || error instanceof RecommendedActionError)
    throw new HttpError(
      error.status,
      error.code,
      error.message,
      error.status >= 500,
      error.details
    );
  throw error;
}

function customerView(view: Awaited<ReturnType<LifecycleProjectionService['getCurrentView']>>) {
  if (!view) return null;
  return {
    lifecycleViewId: view.lifecycleViewId,
    formalMatter: structuredClone(view.formalMatter),
    version: view.version,
    state: view.state,
    customerSafeLabel: view.customerSafeLabel,
    customerSafeSummary: view.customerSafeSummary,
    officialStatusVerified: false as const,
    updatedAt: view.updatedAt
  };
}

function customerEvent(
  event: Awaited<ReturnType<LifecycleProjectionService['listEvents']>>[number]
) {
  return {
    lifecycleEventId: event.lifecycleEventId,
    formalMatter: structuredClone(event.formalMatter),
    version: event.version,
    state: event.state,
    eventCode: event.eventCode,
    customerSafeLabel: event.customerSafeLabel,
    customerSafeSummary: event.customerSafeSummary,
    occurredAt: event.occurredAt,
    officialStatusVerified: false as const
  };
}

async function requireMatter(
  repository: FormalMatterRepository,
  workspaceId: string,
  formalMatterId: FormalMatterId
) {
  const matter = await repository.findById(workspaceId, formalMatterId);
  if (!matter)
    throw new HttpError(404, 'FORMAL_MATTER_NOT_FOUND', 'Formal Matter was not found.');
  return matter;
}

export function createMarkRegLifecycleSurfaceRoutes(
  options: MarkRegLifecycleSurfaceRouteOptions
): JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/v1/formal-matters/:formalMatterId/lifecycle',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'matter:read');
        const formalMatterId = request.params.formalMatterId! as FormalMatterId;
        await requireMatter(options.formalMatterRepository, principal.workspaceId, formalMatterId);
        try {
          const lifecycle = options.lifecycleServiceFor(principal.workspaceId);
          const recommendations = options.recommendedActionServiceFor(principal.workspaceId);
          const [view, events, recommendedAction] = await Promise.all([
            lifecycle.getCurrentView(principal.workspaceId, formalMatterId),
            lifecycle.listEvents(principal.workspaceId, formalMatterId),
            recommendations.getCustomerProjection(principal.workspaceId, formalMatterId)
          ]);
          return json(200, {
            lifecycle: customerView(view),
            timeline: events.slice(-50).map(customerEvent),
            recommendedAction,
            noAction: recommendedAction === null
          });
        } catch (error) {
          return mapSurfaceError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/v1/operations/formal-matters/:formalMatterId/lifecycle-provenance',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'review:perform');
        const formalMatterId = request.params.formalMatterId! as FormalMatterId;
        await requireMatter(options.formalMatterRepository, principal.workspaceId, formalMatterId);
        try {
          const lifecycle = options.lifecycleServiceFor(principal.workspaceId);
          const recommendations = options.recommendedActionServiceFor(principal.workspaceId);
          const [currentView, events, recommendedAction] = await Promise.all([
            lifecycle.getCurrentView(principal.workspaceId, formalMatterId),
            lifecycle.listEvents(principal.workspaceId, formalMatterId),
            recommendations.getForOperations(principal.workspaceId, formalMatterId)
          ]);
          return json(200, {
            currentView: currentView ?? null,
            events,
            recommendedAction: recommendedAction ?? null
          });
        } catch (error) {
          return mapSurfaceError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/recommended-actions/:recommendedActionId/transition',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'matter:manage');
        const body = bodyOf(request);
        const expectedVersion = body.expectedVersion;
        const targetStatus = body.targetStatus;
        const idempotencyKey = body.idempotencyKey;
        const correlationId = body.correlationId;
        if (!Number.isInteger(expectedVersion) || Number(expectedVersion) < 1)
          throw new HttpError(400, 'INVALID_REQUEST', 'expectedVersion must be a positive integer.');
        if (targetStatus !== 'ACKNOWLEDGED' && targetStatus !== 'DISMISSED')
          throw new HttpError(
            400,
            'INVALID_REQUEST',
            'Customer transition must be ACKNOWLEDGED or DISMISSED.'
          );
        if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim())
          throw new HttpError(400, 'INVALID_REQUEST', 'idempotencyKey is required.');
        if (typeof correlationId !== 'string' || !correlationId.trim())
          throw new HttpError(400, 'INVALID_REQUEST', 'correlationId is required.');
        try {
          const service = options.recommendedActionServiceFor(principal.workspaceId);
          const result = await service.transition({
            workspaceId: principal.workspaceId,
            recommendedActionId: request.params.recommendedActionId! as RecommendedActionId,
            expectedVersion: Number(expectedVersion),
            targetStatus,
            idempotencyKey,
            correlationId
          });
          if (!result.action)
            throw new HttpError(
              404,
              'RECOMMENDATION_NOT_FOUND',
              'Recommended Action was not found.'
            );
          return json(200, {
            recommendedAction: await service.getCustomerProjection(
              principal.workspaceId,
              result.action.formalMatter.id
            )
          });
        } catch (error) {
          if (error instanceof HttpError) throw error;
          return mapSurfaceError(error);
        }
      }
    }
  ];
}
