import { timingSafeEqual } from 'node:crypto';
import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type {
  LiteWorkItemCertifiedDeadlineReferenceV1,
  LiteWorkItemId,
  LiteWorkItemInternalTimingV1,
  LiteWorkItemObservedDateCandidateV1,
  LiteWorkItemPriority,
  LiteWorkItemRelatedReferenceV1,
  LiteWorkItemStatus,
  LiteWorkItemTaskType
} from '@markorbit/contracts/lite-work-item';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { LiteWorkItemRuntimeError, type PostgresLiteWorkItemStore } from './lite-work-item.js';

type Body = Record<string, unknown>;
type WorkItemStore = Pick<
  PostgresLiteWorkItemStore,
  'createManual' | 'get' | 'list' | 'updateInternalFields' | 'transitionStatus'
>;

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
  permission: 'workspace:read' | 'matter:manage'
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

function exactBody(body: Body, fields: readonly string[]): void {
  const actorField = [
    'workspaceId',
    'actorPrincipalId',
    'recordedByPrincipalId',
    'actorId',
    'userId',
    'principalId',
    'membershipId',
    'authorityConsequences',
    'source',
    'status',
    'version'
  ].find((field) => body[field] !== undefined);
  if (actorField)
    throw new HttpError(
      400,
      'ACTOR_SPOOF_REJECTED',
      'Identity, authority and owner lifecycle fields are server-owned.'
    );
  if (Object.keys(body).some((field) => !fields.includes(field)))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body contains unsupported fields.');
}

function noBodyOrQuery(request: JsonRequest): void {
  if (request.body !== undefined || Object.keys(request.query).length > 0)
    throw new HttpError(400, 'INVALID_REQUEST', 'This read accepts no body or query parameters.');
}

function keyOf(request: JsonRequest): string {
  const key = request.headers['idempotency-key'];
  if (!key || !key.trim())
    throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required.');
  return key.trim();
}

function positive(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be a positive integer.`);
  return Number(value);
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be a non-empty string.`);
  return value.trim();
}

function nullablePresentText(value: unknown, field: string): string | null {
  if (value === null) return null;
  return text(value, field);
}

function optionalArray(value: unknown, field: string): readonly unknown[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value))
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be an array.`);
  return value as unknown[];
}

function optionalObject(value: unknown, field: string): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be an object.`);
  return value as Record<string, unknown>;
}

function mapOwnerError(error: unknown): never {
  if (error instanceof LiteWorkItemRuntimeError)
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  throw error;
}

function workItemIdOf(request: JsonRequest): LiteWorkItemId {
  return text(request.params.liteWorkItemId, 'liteWorkItemId') as LiteWorkItemId;
}

export function createLiteWorkItemRoutes(options: {
  internalServiceSecret: string;
  store: WorkItemStore;
}): JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/v1/work-items',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'matter:manage');
        if (Object.keys(request.query).length > 0)
          throw new HttpError(400, 'INVALID_REQUEST', 'Create accepts no query parameters.');
        const body = bodyOf(request);
        exactBody(body, [
          'taskType',
          'title',
          'note',
          'priority',
          'assigneePrincipalId',
          'relatedReferences',
          'certifiedDeadlineReferences',
          'observedDateCandidates',
          'internalTiming'
        ]);
        try {
          return json(
            201,
            await options.store.createManual({
              workspaceId: principal.workspaceId,
              actorPrincipalId: principal.userId,
              idempotencyKey: keyOf(request),
              taskType: text(body.taskType, 'taskType') as LiteWorkItemTaskType,
              title: text(body.title, 'title'),
              ...(body.note === undefined ? {} : { note: text(body.note, 'note') }),
              ...(body.priority === undefined
                ? {}
                : { priority: text(body.priority, 'priority') as LiteWorkItemPriority }),
              ...(body.assigneePrincipalId === undefined
                ? {}
                : { assigneePrincipalId: text(body.assigneePrincipalId, 'assigneePrincipalId') }),
              ...(body.relatedReferences === undefined
                ? {}
                : {
                    relatedReferences: optionalArray(
                      body.relatedReferences,
                      'relatedReferences'
                    ) as readonly LiteWorkItemRelatedReferenceV1[]
                  }),
              ...(body.certifiedDeadlineReferences === undefined
                ? {}
                : {
                    certifiedDeadlineReferences: optionalArray(
                      body.certifiedDeadlineReferences,
                      'certifiedDeadlineReferences'
                    ) as readonly LiteWorkItemCertifiedDeadlineReferenceV1[]
                  }),
              ...(body.observedDateCandidates === undefined
                ? {}
                : {
                    observedDateCandidates: optionalArray(
                      body.observedDateCandidates,
                      'observedDateCandidates'
                    ) as readonly LiteWorkItemObservedDateCandidateV1[]
                  }),
              ...(body.internalTiming === undefined
                ? {}
                : {
                    internalTiming: optionalObject(
                      body.internalTiming,
                      'internalTiming'
                    ) as unknown as LiteWorkItemInternalTimingV1
                  })
            })
          );
        } catch (error) {
          return mapOwnerError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/v1/work-items',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        if (request.body !== undefined)
          throw new HttpError(400, 'INVALID_REQUEST', 'List accepts no request body.');
        if (
          Object.keys(request.query).some(
            (key) => !['statuses', 'assigneePrincipalId', 'unassigned', 'limit'].includes(key)
          )
        )
          throw new HttpError(
            400,
            'INVALID_REQUEST',
            'Unsupported Work Item list query parameter.'
          );
        const { statuses, assigneePrincipalId, unassigned, limit } = request.query;
        if (assigneePrincipalId !== undefined && unassigned !== undefined)
          throw new HttpError(
            400,
            'INVALID_REQUEST',
            'assigneePrincipalId and unassigned are mutually exclusive.'
          );
        if (unassigned !== undefined && unassigned !== 'true')
          throw new HttpError(400, 'INVALID_REQUEST', 'unassigned must be true when supplied.');
        if (limit !== undefined && !/^[1-9]\d*$/u.test(limit))
          throw new HttpError(400, 'INVALID_REQUEST', 'limit must be a positive integer.');
        const parsedStatuses = statuses
          ?.split(',')
          .map((status) => status.trim())
          .filter(Boolean);
        if (statuses !== undefined && (!parsedStatuses || parsedStatuses.length === 0))
          throw new HttpError(400, 'INVALID_REQUEST', 'statuses must contain at least one status.');
        try {
          return json(
            200,
            await options.store.list(principal.workspaceId, {
              ...(parsedStatuses === undefined
                ? {}
                : { statuses: parsedStatuses as LiteWorkItemStatus[] }),
              ...(assigneePrincipalId === undefined && unassigned === undefined
                ? {}
                : {
                    assigneePrincipalId:
                      unassigned === 'true'
                        ? null
                        : text(assigneePrincipalId, 'assigneePrincipalId')
                  }),
              ...(limit === undefined ? {} : { limit: Number(limit) })
            })
          );
        } catch (error) {
          return mapOwnerError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/v1/work-items/:liteWorkItemId',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        noBodyOrQuery(request);
        try {
          const item = await options.store.get(principal.workspaceId, workItemIdOf(request));
          if (!item) throw new HttpError(404, 'NOT_FOUND', 'Lite Work Item was not found.');
          return json(200, item);
        } catch (error) {
          if (error instanceof HttpError) throw error;
          return mapOwnerError(error);
        }
      }
    },
    {
      method: 'PATCH',
      path: '/v1/work-items/:liteWorkItemId',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'matter:manage');
        if (Object.keys(request.query).length > 0)
          throw new HttpError(400, 'INVALID_REQUEST', 'Patch accepts no query parameters.');
        const body = bodyOf(request);
        exactBody(body, [
          'expectedVersion',
          'title',
          'note',
          'priority',
          'assigneePrincipalId',
          'internalTiming'
        ]);
        try {
          return json(
            200,
            await options.store.updateInternalFields({
              workspaceId: principal.workspaceId,
              liteWorkItemId: workItemIdOf(request),
              expectedVersion: positive(body.expectedVersion, 'expectedVersion'),
              idempotencyKey: keyOf(request),
              ...(body.title === undefined ? {} : { title: text(body.title, 'title') }),
              ...(body.note === undefined ? {} : { note: nullablePresentText(body.note, 'note') }),
              ...(body.priority === undefined
                ? {}
                : { priority: text(body.priority, 'priority') as LiteWorkItemPriority }),
              ...(body.assigneePrincipalId === undefined
                ? {}
                : {
                    assigneePrincipalId: nullablePresentText(
                      body.assigneePrincipalId,
                      'assigneePrincipalId'
                    )
                  }),
              ...(body.internalTiming === undefined
                ? {}
                : {
                    internalTiming: optionalObject(
                      body.internalTiming,
                      'internalTiming'
                    ) as unknown as LiteWorkItemInternalTimingV1
                  })
            })
          );
        } catch (error) {
          return mapOwnerError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/work-items/:liteWorkItemId/status',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'matter:manage');
        if (Object.keys(request.query).length > 0)
          throw new HttpError(
            400,
            'INVALID_REQUEST',
            'Status transition accepts no query parameters.'
          );
        const body = bodyOf(request);
        exactBody(body, ['expectedVersion', 'toStatus']);
        try {
          return json(
            200,
            await options.store.transitionStatus({
              workspaceId: principal.workspaceId,
              liteWorkItemId: workItemIdOf(request),
              expectedVersion: positive(body.expectedVersion, 'expectedVersion'),
              toStatus: text(body.toStatus, 'toStatus') as LiteWorkItemStatus,
              idempotencyKey: keyOf(request)
            })
          );
        } catch (error) {
          return mapOwnerError(error);
        }
      }
    }
  ];
}
