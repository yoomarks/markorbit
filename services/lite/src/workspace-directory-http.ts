import { timingSafeEqual } from 'node:crypto';
import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type {
  WorkspaceDirectoryContactPointV1,
  WorkspaceDirectoryCustomerRelationshipReferenceV1,
  WorkspaceDirectoryEntryId,
  WorkspaceDirectoryEntryKind,
  WorkspaceDirectoryEntryStatus,
  WorkspaceDirectoryExternalIdentityReferenceV1,
  WorkspaceDirectoryLocalProvenanceV1,
  WorkspaceDirectoryOperationalRole,
  WorkspaceDirectoryProviderReferenceV1
} from '@markorbit/contracts/workspace-directory';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  WorkspaceDirectoryRuntimeError,
  type PostgresWorkspaceDirectoryStore
} from './workspace-directory.js';

type Body = Record<string, unknown>;
type DirectoryStore = Pick<
  PostgresWorkspaceDirectoryStore,
  'create' | 'update' | 'archive' | 'getExact' | 'getLatest' | 'listLatest'
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
  'workspaceDirectoryEntryId',
  'actorPrincipalId',
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
      'Workspace, identity and lifecycle fields are server-owned.'
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
  if (!value?.trim())
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

function array<T>(value: unknown, field: string): readonly T[] {
  if (!Array.isArray(value))
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be an array.`);
  return value as T[];
}

function object<T>(value: unknown, field: string): T {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be an object.`);
  return value as T;
}

function optionalObjectOrNull<T>(value: unknown, field: string): T | null {
  return value === null ? null : object<T>(value, field);
}

function directoryEntryId(request: JsonRequest): WorkspaceDirectoryEntryId {
  return text(
    request.params.workspaceDirectoryEntryId,
    'workspaceDirectoryEntryId'
  ) as WorkspaceDirectoryEntryId;
}

function mapOwnerError(error: unknown): never {
  if (error instanceof WorkspaceDirectoryRuntimeError)
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  throw error;
}

const mutableFields = [
  'entryKind',
  'displayName',
  'aliases',
  'roles',
  'contactPoints',
  'customerRelationship',
  'provider',
  'externalIdentityReferences',
  'provenance'
] as const;

export function createWorkspaceDirectoryRoutes(options: {
  internalServiceSecret: string;
  store: DirectoryStore;
}): JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/v1/workspace-directory-entries',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'matter:manage');
        if (Object.keys(request.query).length > 0)
          throw new HttpError(400, 'INVALID_REQUEST', 'Create accepts no query parameters.');
        const body = bodyOf(request);
        exactBody(body, mutableFields);
        try {
          return json(
            201,
            await options.store.create({
              workspaceId: principal.workspaceId,
              actorPrincipalId: principal.userId,
              idempotencyKey: idempotencyKey(request),
              entryKind: text(body.entryKind, 'entryKind') as WorkspaceDirectoryEntryKind,
              displayName: text(body.displayName, 'displayName'),
              ...(body.aliases === undefined
                ? {}
                : { aliases: array<string>(body.aliases, 'aliases') }),
              ...(body.roles === undefined
                ? {}
                : {
                    roles: array<WorkspaceDirectoryOperationalRole>(body.roles, 'roles')
                  }),
              ...(body.contactPoints === undefined
                ? {}
                : {
                    contactPoints: array<WorkspaceDirectoryContactPointV1>(
                      body.contactPoints,
                      'contactPoints'
                    )
                  }),
              ...(body.customerRelationship === undefined
                ? {}
                : {
                    customerRelationship: object<WorkspaceDirectoryCustomerRelationshipReferenceV1>(
                      body.customerRelationship,
                      'customerRelationship'
                    )
                  }),
              ...(body.provider === undefined
                ? {}
                : {
                    provider: object<WorkspaceDirectoryProviderReferenceV1>(
                      body.provider,
                      'provider'
                    )
                  }),
              ...(body.externalIdentityReferences === undefined
                ? {}
                : {
                    externalIdentityReferences:
                      array<WorkspaceDirectoryExternalIdentityReferenceV1>(
                        body.externalIdentityReferences,
                        'externalIdentityReferences'
                      )
                  }),
              ...(body.provenance === undefined
                ? {}
                : {
                    provenance: object<WorkspaceDirectoryLocalProvenanceV1>(
                      body.provenance,
                      'provenance'
                    )
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
      path: '/v1/workspace-directory-entries/:workspaceDirectoryEntryId/update',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'matter:manage');
        if (Object.keys(request.query).length > 0)
          throw new HttpError(400, 'INVALID_REQUEST', 'Update accepts no query parameters.');
        const body = bodyOf(request);
        exactBody(body, ['expectedVersion', ...mutableFields]);
        try {
          return json(
            200,
            await options.store.update({
              workspaceId: principal.workspaceId,
              actorPrincipalId: principal.userId,
              workspaceDirectoryEntryId: directoryEntryId(request),
              expectedVersion: positive(body.expectedVersion, 'expectedVersion'),
              idempotencyKey: idempotencyKey(request),
              ...(body.entryKind === undefined
                ? {}
                : {
                    entryKind: text(body.entryKind, 'entryKind') as WorkspaceDirectoryEntryKind
                  }),
              ...(body.displayName === undefined
                ? {}
                : { displayName: text(body.displayName, 'displayName') }),
              ...(body.aliases === undefined
                ? {}
                : { aliases: array<string>(body.aliases, 'aliases') }),
              ...(body.roles === undefined
                ? {}
                : {
                    roles: array<WorkspaceDirectoryOperationalRole>(body.roles, 'roles')
                  }),
              ...(body.contactPoints === undefined
                ? {}
                : {
                    contactPoints: array<WorkspaceDirectoryContactPointV1>(
                      body.contactPoints,
                      'contactPoints'
                    )
                  }),
              ...(body.customerRelationship === undefined
                ? {}
                : {
                    customerRelationship:
                      optionalObjectOrNull<WorkspaceDirectoryCustomerRelationshipReferenceV1>(
                        body.customerRelationship,
                        'customerRelationship'
                      )
                  }),
              ...(body.provider === undefined
                ? {}
                : {
                    provider: optionalObjectOrNull<WorkspaceDirectoryProviderReferenceV1>(
                      body.provider,
                      'provider'
                    )
                  }),
              ...(body.externalIdentityReferences === undefined
                ? {}
                : {
                    externalIdentityReferences:
                      array<WorkspaceDirectoryExternalIdentityReferenceV1>(
                        body.externalIdentityReferences,
                        'externalIdentityReferences'
                      )
                  }),
              ...(body.provenance === undefined
                ? {}
                : {
                    provenance: object<WorkspaceDirectoryLocalProvenanceV1>(
                      body.provenance,
                      'provenance'
                    )
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
      path: '/v1/workspace-directory-entries',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        noBody(request);
        if (
          Object.keys(request.query).some(
            (key) => !['status', 'entryKind', 'q', 'limit'].includes(key)
          )
        )
          throw new HttpError(
            400,
            'INVALID_REQUEST',
            'Unsupported Workspace Directory list query parameter.'
          );
        const { status, entryKind, q, limit } = request.query;
        if (limit !== undefined && !/^[1-9]\d*$/u.test(limit))
          throw new HttpError(400, 'INVALID_REQUEST', 'limit must be a positive integer.');
        try {
          return json(
            200,
            await options.store.listLatest(principal.workspaceId, {
              ...(status === undefined
                ? {}
                : { status: text(status, 'status') as WorkspaceDirectoryEntryStatus }),
              ...(entryKind === undefined
                ? {}
                : {
                    entryKind: text(entryKind, 'entryKind') as WorkspaceDirectoryEntryKind
                  }),
              ...(q === undefined ? {} : { query: text(q, 'q') }),
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
      path: '/v1/workspace-directory-entries/:workspaceDirectoryEntryId',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        noBodyOrQuery(request);
        try {
          const value = await options.store.getLatest(
            principal.workspaceId,
            directoryEntryId(request)
          );
          if (!value)
            throw new HttpError(404, 'NOT_FOUND', 'Workspace Directory entry was not found.');
          return json(200, value);
        } catch (error) {
          if (error instanceof HttpError) throw error;
          return mapOwnerError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/v1/workspace-directory-entries/:workspaceDirectoryEntryId/versions/:version',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        noBodyOrQuery(request);
        try {
          const value = await options.store.getExact(
            principal.workspaceId,
            directoryEntryId(request),
            positive(Number(request.params.version), 'version')
          );
          if (!value)
            throw new HttpError(
              404,
              'NOT_FOUND',
              'Workspace Directory entry version was not found.'
            );
          return json(200, value);
        } catch (error) {
          if (error instanceof HttpError) throw error;
          return mapOwnerError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/workspace-directory-entries/:workspaceDirectoryEntryId/archive',
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
              workspaceDirectoryEntryId: directoryEntryId(request),
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
