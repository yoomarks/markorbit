import { timingSafeEqual } from 'node:crypto';
import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  TrademarkAssetMigrationInterruptedError,
  TrademarkAssetMigrationOrchestrationError,
  type ReviewableTrademarkAssetMigrationInput,
  type TrademarkAssetMigrationOrchestrator
} from './trademark-asset-migration.js';
import { TrademarkAssetMigrationRunPersistenceError } from './trademark-asset-migration-postgres.js';
import {
  parseTrademarkAssetAdmissionItem,
  TrademarkAssetPersistenceError
} from './trademark-asset.js';

type Body = Record<string, unknown>;
type MigrationService = Pick<
  TrademarkAssetMigrationOrchestrator,
  'preview' | 'progress' | 'commit'
>;

const SERVER_OWNED_FIELDS = [
  'workspaceId',
  'actorPrincipalId',
  'principalId',
  'userId',
  'membershipId',
  'status',
  'version',
  'updatedAt',
  'officialTruthVerifiedByLite',
  'matterCreatedAutomatically'
] as const;
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

function noQuery(request: JsonRequest): void {
  if (Object.keys(request.query).length > 0)
    throw new HttpError(400, 'INVALID_REQUEST', 'This operation accepts no query parameters.');
}

function nonEmptyText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be a non-empty string.`);
  return value.trim();
}
const NESTED_SERVER_OWNED_FIELDS = [
  'workspaceId',
  'idempotencyKey',
  'actorPrincipalId',
  'principalId',
  'userId',
  'membershipId',
  'status',
  'version',
  'officialTruthVerifiedByLite',
  'matterCreatedAutomatically'
] as const;

function reviewedRows(value: unknown): ReviewableTrademarkAssetMigrationInput['rows'] {
  if (!Array.isArray(value) || value.length < 1)
    throw new HttpError(400, 'INVALID_REQUEST', 'rows must be a non-empty array.');
  return value.map((candidate, index) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate))
      throw new HttpError(400, 'INVALID_REQUEST', `rows[${index}] must be an object.`);
    const row = candidate as Body;
    if (Object.keys(row).some((field) => !['rowKey', 'item'].includes(field)))
      throw new HttpError(400, 'INVALID_REQUEST', `rows[${index}] contains unsupported fields.`);
    const rowKey = nonEmptyText(row.rowKey, `rows[${index}].rowKey`);
    if (!row.item || typeof row.item !== 'object' || Array.isArray(row.item))
      throw new HttpError(400, 'INVALID_REQUEST', `rows[${index}].item must be an object.`);
    const item = row.item as Body;
    if (NESTED_SERVER_OWNED_FIELDS.some((field) => item[field] !== undefined))
      throw new HttpError(
        400,
        'OWNER_FIELD_SPOOF_REJECTED',
        'Migration item contains server-owned fields.'
      );
    return Object.freeze({ rowKey, item: parseTrademarkAssetAdmissionItem(item) });
  });
}

function migrationInput(
  request: JsonRequest,
  principal: WorkspacePrincipal,
  expectedMigrationKey?: string
): ReviewableTrademarkAssetMigrationInput {
  const body = bodyOf(request);
  const spoofed = SERVER_OWNED_FIELDS.find((field) => body[field] !== undefined);
  if (spoofed)
    throw new HttpError(
      400,
      'OWNER_FIELD_SPOOF_REJECTED',
      'Workspace, actor and migration lifecycle fields are server-owned.'
    );
  if (
    Object.keys(body).some(
      (field) => !['migrationKey', 'sourceFingerprintSha256', 'rows'].includes(field)
    )
  )
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body contains unsupported fields.');
  const migrationKey = nonEmptyText(body.migrationKey, 'migrationKey');
  if (expectedMigrationKey !== undefined && migrationKey !== expectedMigrationKey)
    throw new HttpError(
      409,
      'MIGRATION_KEY_MISMATCH',
      'Path migrationKey must exactly match the reviewed migration input.'
    );
  if (
    body.sourceFingerprintSha256 !== undefined &&
    typeof body.sourceFingerprintSha256 !== 'string'
  )
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'sourceFingerprintSha256 must be a string when supplied.'
    );
  return {
    workspaceId: principal.workspaceId,
    migrationKey,
    ...(body.sourceFingerprintSha256 === undefined
      ? {}
      : { sourceFingerprintSha256: body.sourceFingerprintSha256 }),
    rows: reviewedRows(body.rows)
  };
}
function mapMigrationError(error: unknown): never {
  if (error instanceof TrademarkAssetPersistenceError)
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  if (error instanceof TrademarkAssetMigrationRunPersistenceError)
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  if (error instanceof TrademarkAssetMigrationInterruptedError)
    throw new HttpError(error.retryable ? 503 : 502, error.code, error.message, error.retryable);
  if (error instanceof TrademarkAssetMigrationOrchestrationError) {
    const status =
      error.code === 'INVALID_INPUT'
        ? 400
        : error.code === 'PREVIEW_REQUIRED' || error.code === 'RUN_MISMATCH'
          ? 409
          : 502;
    throw new HttpError(status, error.code, error.message, false);
  }
  throw error;
}

export function createTrademarkAssetMigrationRoutes(options: {
  internalServiceSecret: string;
  service: MigrationService;
}): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/v1/trademark-asset-migrations/preview',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        noQuery(request);
        try {
          return json(200, await options.service.preview(migrationInput(request, principal)));
        } catch (error) {
          return mapMigrationError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/v1/trademark-asset-migrations/:migrationKey',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        if (request.body !== undefined)
          throw new HttpError(400, 'INVALID_REQUEST', 'Progress read accepts no request body.');
        noQuery(request);
        const migrationKey = nonEmptyText(request.params.migrationKey, 'migrationKey');
        try {
          const progress = await options.service.progress(principal.workspaceId, migrationKey);
          if (!progress)
            throw new HttpError(404, 'NOT_FOUND', 'Trademark Asset migration was not found.');
          return json(200, progress);
        } catch (error) {
          if (error instanceof HttpError) throw error;
          return mapMigrationError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/trademark-asset-migrations/:migrationKey/commit',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'matter:manage');
        noQuery(request);
        const pathMigrationKey = nonEmptyText(request.params.migrationKey, 'migrationKey');
        try {
          return json(
            200,
            await options.service.commit(migrationInput(request, principal, pathMigrationKey))
          );
        } catch (error) {
          return mapMigrationError(error);
        }
      }
    }
  ];
}
