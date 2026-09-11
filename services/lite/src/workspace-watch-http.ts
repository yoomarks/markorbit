import { timingSafeEqual } from 'node:crypto';
import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type {
  WorkspaceWatchExternalTargetReferenceV1,
  WorkspaceWatchPurpose,
  WorkspaceWatchTargetId,
  WorkspaceWatchTargetKind,
  WorkspaceWatchTargetStatus
} from '@markorbit/contracts/workspace-watch';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { WorkspaceWatchRuntimeError, type PostgresWorkspaceWatchStore } from './workspace-watch.js';

type Body = Record<string, unknown>;
type WatchStore = Pick<
  PostgresWorkspaceWatchStore,
  'create' | 'archive' | 'getExact' | 'getLatest' | 'listLatest'
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

const SERVER_OWNED_FIELDS = [
  'workspaceId',
  'actorPrincipalId',
  'createdByPrincipalId',
  'principalId',
  'userId',
  'membershipId',
  'userConfirmed',
  'status',
  'version',
  'authorityConsequences',
  'createdAt',
  'updatedAt',
  'archivedAt'
] as const;

function exactBody(body: Body, fields: readonly string[]): void {
  const spoofed = SERVER_OWNED_FIELDS.find((field) => body[field] !== undefined);
  if (spoofed)
    throw new HttpError(
      400,
      'OWNER_FIELD_SPOOF_REJECTED',
      'Workspace, actor and owner lifecycle fields are server-owned.'
    );
  if (Object.keys(body).some((field) => !fields.includes(field)))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body contains unsupported fields.');
}

function noBody(request: JsonRequest): void {
  if (request.body !== undefined)
    throw new HttpError(400, 'INVALID_REQUEST', 'This read accepts no request body.');
}

function noBodyOrQuery(request: JsonRequest): void {
  noBody(request);
  if (Object.keys(request.query).length > 0)
    throw new HttpError(400, 'INVALID_REQUEST', 'This read accepts no query parameters.');
}

function idempotencyKey(request: JsonRequest): string {
  const value = request.headers['idempotency-key'];
  if (!value || !value.trim())
    throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required.');
  return value.trim();
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be a non-empty string.`);
  return value.trim();
}

function positive(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be a positive integer.`);
  return Number(value);
}

function target(value: unknown): WorkspaceWatchExternalTargetReferenceV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'INVALID_REQUEST', 'target must be an object.');
  return value as WorkspaceWatchExternalTargetReferenceV1;
}

function watchId(request: JsonRequest): WorkspaceWatchTargetId {
  return text(
    request.params.workspaceWatchTargetId,
    'workspaceWatchTargetId'
  ) as WorkspaceWatchTargetId;
}

function mapOwnerError(error: unknown): never {
  if (error instanceof WorkspaceWatchRuntimeError)
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  throw error;
}

export function createWorkspaceWatchRoutes(options: {
  internalServiceSecret: string;
  store: WatchStore;
}): JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/v1/watch-targets',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'matter:manage');
        if (Object.keys(request.query).length > 0)
          throw new HttpError(400, 'INVALID_REQUEST', 'Create accepts no query parameters.');
        const body = bodyOf(request);
        exactBody(body, ['target', 'purpose', 'reason']);
        try {
          return json(
            201,
            await options.store.create({
              workspaceId: principal.workspaceId,
              actorPrincipalId: principal.userId,
              idempotencyKey: idempotencyKey(request),
              target: target(body.target),
              purpose: text(body.purpose, 'purpose') as WorkspaceWatchPurpose,
              ...(body.reason === undefined ? {} : { reason: text(body.reason, 'reason') })
            })
          );
        } catch (error) {
          return mapOwnerError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/v1/watch-targets',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        noBody(request);
        if (
          Object.keys(request.query).some(
            (key) => !['status', 'targetKind', 'purpose', 'limit'].includes(key)
          )
        )
          throw new HttpError(400, 'INVALID_REQUEST', 'Unsupported Watch list query parameter.');
        const { status, targetKind, purpose, limit } = request.query;
        if (limit !== undefined && !/^[1-9]\d*$/u.test(limit))
          throw new HttpError(400, 'INVALID_REQUEST', 'limit must be a positive integer.');
        try {
          return json(
            200,
            await options.store.listLatest(principal.workspaceId, {
              ...(status === undefined
                ? {}
                : { status: text(status, 'status') as WorkspaceWatchTargetStatus }),
              ...(targetKind === undefined
                ? {}
                : { targetKind: text(targetKind, 'targetKind') as WorkspaceWatchTargetKind }),
              ...(purpose === undefined
                ? {}
                : { purpose: text(purpose, 'purpose') as WorkspaceWatchPurpose }),
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
      path: '/v1/watch-targets/:workspaceWatchTargetId',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        noBodyOrQuery(request);
        try {
          const value = await options.store.getLatest(principal.workspaceId, watchId(request));
          if (!value)
            throw new HttpError(404, 'NOT_FOUND', 'Workspace Watch Target was not found.');
          return json(200, value);
        } catch (error) {
          if (error instanceof HttpError) throw error;
          return mapOwnerError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/v1/watch-targets/:workspaceWatchTargetId/versions/:version',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        noBodyOrQuery(request);
        try {
          const value = await options.store.getExact(
            principal.workspaceId,
            watchId(request),
            positive(Number(request.params.version), 'version')
          );
          if (!value)
            throw new HttpError(404, 'NOT_FOUND', 'Workspace Watch Target version was not found.');
          return json(200, value);
        } catch (error) {
          if (error instanceof HttpError) throw error;
          return mapOwnerError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/watch-targets/:workspaceWatchTargetId/archive',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'matter:manage');
        if (Object.keys(request.query).length > 0)
          throw new HttpError(400, 'INVALID_REQUEST', 'Archive accepts no query parameters.');
        const body = bodyOf(request);
        exactBody(body, ['expectedVersion']);
        try {
          return json(
            200,
            await options.store.archive({
              workspaceId: principal.workspaceId,
              workspaceWatchTargetId: watchId(request),
              expectedVersion: positive(body.expectedVersion, 'expectedVersion'),
              idempotencyKey: idempotencyKey(request)
            })
          );
        } catch (error) {
          return mapOwnerError(error);
        }
      }
    }
  ];
}
