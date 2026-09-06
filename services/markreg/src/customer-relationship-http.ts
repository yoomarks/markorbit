import { timingSafeEqual } from 'node:crypto';
import {
  AuthenticationError,
  parseInternalWorkspacePrincipal,
  type Permission,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  CustomerRelationshipError,
  type CustomerRelationshipId,
  type CustomerRelationshipStatus,
  type PostgresCustomerRelationshipStore
} from './customer-relationship.js';

export interface CustomerRelationshipRouteOptions {
  internalServiceSecret: string;
  store: Pick<PostgresCustomerRelationshipStore, 'create' | 'get' | 'list' | 'update' | 'archive'>;
}

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function principalFor(
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
  } catch (error) {
    if (error instanceof AuthenticationError) throw new HttpError(401, error.code, error.message);
    throw error;
  }
  const workspaceId = request.headers['x-markorbit-workspace-id'];
  if (!workspaceId || workspaceId.toLowerCase() !== principal.workspaceId.toLowerCase())
    throw new HttpError(404, 'WORKSPACE_MISMATCH', 'Workspace-scoped record was not found.');
  if (!principal.permissions.includes(permission))
    throw new HttpError(403, 'PERMISSION_DENIED', `${permission} permission is required.`);
  return principal;
}
function bodyOf(request: JsonRequest): Record<string, unknown> {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Record<string, unknown>;
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new HttpError(400, 'INVALID_REQUEST', `${field} is required.`);
  return value.trim();
}

function positive(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) < 1)
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be a positive integer.`);
  return Number(value);
}

function page(value: string | undefined, fallback: number, field: string): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1)
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be a positive integer.`);
  return parsed;
}

function mapError(error: unknown): never {
  if (error instanceof CustomerRelationshipError)
    throw new HttpError(
      error.status,
      error.code,
      error.message,
      error.code === 'PERSISTENCE_UNAVAILABLE'
    );
  throw error;
}

function idOf(request: JsonRequest): CustomerRelationshipId {
  return request.params.customerRelationshipId! as CustomerRelationshipId;
}

export function createCustomerRelationshipRoutes(
  options: CustomerRelationshipRouteOptions
): readonly JsonRoute[] {
  const principal = (request: JsonRequest, permission: Permission) =>
    principalFor(request, options.internalServiceSecret, permission);
  return [
    {
      method: 'POST',
      path: '/internal/v1/customer-relationships',
      handle: async (request) => {
        const actor = principal(request, 'workspace:manage');
        const body = bodyOf(request);
        try {
          const record = await options.store.create({
            workspaceId: actor.workspaceId,
            displayName: text(body.displayName, 'displayName'),
            relationshipModel: body.relationshipModel as never,
            principalId: actor.userId,
            idempotencyKey: text(request.headers['idempotency-key'], 'Idempotency-Key')
          });
          return json(201, { customerRelationship: record });
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/internal/v1/customer-relationships',
      handle: async (request) => {
        const actor = principal(request, 'workspace:read');
        const status = request.query.status as CustomerRelationshipStatus | undefined;
        if (status !== undefined && status !== 'ACTIVE' && status !== 'ARCHIVED')
          throw new HttpError(400, 'INVALID_REQUEST', 'status is invalid.');
        const pageNumber = page(request.query.page, 1, 'page');
        const pageSize = page(request.query.pageSize, 20, 'pageSize');
        if (pageSize > 100)
          throw new HttpError(400, 'INVALID_REQUEST', 'pageSize cannot exceed 100.');
        try {
          return json(
            200,
            await options.store.list(actor.workspaceId, {
              page: pageNumber,
              pageSize,
              ...(status ? { status } : {})
            })
          );
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/internal/v1/customer-relationships/:customerRelationshipId',
      handle: async (request) => {
        const actor = principal(request, 'workspace:read');
        try {
          return json(200, {
            customerRelationship: await options.store.get(actor.workspaceId, idOf(request))
          });
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'PATCH',
      path: '/internal/v1/customer-relationships/:customerRelationshipId',
      handle: async (request) => {
        const actor = principal(request, 'workspace:manage');
        const body = bodyOf(request);
        try {
          const record = await options.store.update({
            workspaceId: actor.workspaceId,
            customerRelationshipId: idOf(request),
            expectedVersion: positive(body.expectedVersion, 'expectedVersion'),
            ...(body.displayName === undefined
              ? {}
              : { displayName: text(body.displayName, 'displayName') }),
            ...(body.relationshipModel === undefined
              ? {}
              : { relationshipModel: body.relationshipModel as never }),
            principalId: actor.userId
          });
          return json(200, { customerRelationship: record });
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/internal/v1/customer-relationships/:customerRelationshipId/archive',
      handle: async (request) => {
        const actor = principal(request, 'workspace:manage');
        const body = bodyOf(request);
        try {
          const record = await options.store.archive(
            actor.workspaceId,
            idOf(request),
            positive(body.expectedVersion, 'expectedVersion'),
            actor.userId
          );
          return json(200, { customerRelationship: record });
        } catch (error) {
          return mapError(error);
        }
      }
    }
  ];
}
