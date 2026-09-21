import { timingSafeEqual } from 'node:crypto';
import {
  parseInternalWorkspacePrincipal,
  type Permission,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import {
  parseSeedWorkspacePackageV1,
  type SeedWorkspacePackageIdV1
} from '@markorbit/contracts/seed-workspace-package';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  SeedWorkspacePackageOwnerError,
  type PostgresSeedWorkspacePackageStore,
  type SeedWorkspaceClaimService
} from './seed-workspace-package.js';

type Body = Record<string, unknown>;

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
  if (
    request.headers['x-markorbit-workspace-id']?.toLowerCase() !==
    principal.workspaceId.toLowerCase()
  )
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

function exact(value: Body, fields: readonly string[]): void {
  if (Object.keys(value).some((key) => !fields.includes(key)))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body contains unsupported fields.');
}

function value(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new HttpError(400, 'INVALID_REQUEST', `${field} is required.`);
  return value.trim();
}

function key(request: JsonRequest): string {
  const result = request.headers['idempotency-key']?.trim();
  if (!result) throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required.');
  return result;
}

function map(error: unknown): never {
  if (error instanceof SeedWorkspacePackageOwnerError)
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  throw error;
}

export function createSeedWorkspacePackageRoutes(options: {
  internalServiceSecret: string;
  store: Pick<
    PostgresSeedWorkspacePackageStore,
    'savePrepared' | 'readForWorkspace' | 'previewInvitation'
  >;
  claims: Pick<SeedWorkspaceClaimService, 'claim'>;
}): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/v1/seed-workspace-invitations/preview',
      handle: async (request) => {
        if (
          !trusted(
            options.internalServiceSecret,
            request.headers['x-markorbit-internal-authorization']
          )
        )
          throw new HttpError(
            401,
            'UNTRUSTED_INTERNAL_CALLER',
            'Trusted internal authorization is required.'
          );
        const body = bodyOf(request);
        exact(body, ['packageId', 'invitationClaimToken']);
        try {
          return json(
            200,
            await options.store.previewInvitation({
              packageId: value(body.packageId, 'packageId') as SeedWorkspacePackageIdV1,
              invitationClaimToken: value(body.invitationClaimToken, 'invitationClaimToken')
            })
          );
        } catch (error) {
          return map(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/seed-workspace-packages',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:manage');
        try {
          const prepared = parseSeedWorkspacePackageV1(bodyOf(request));
          if (prepared.preparedByWorkspaceId !== principal.workspaceId)
            throw new HttpError(
              404,
              'WORKSPACE_MISMATCH',
              'Workspace-scoped record was not found.'
            );
          return json(201, await options.store.savePrepared(prepared));
        } catch (error) {
          return map(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/v1/seed-workspace-packages/:packageId',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        try {
          const found = await options.store.readForWorkspace(
            principal.workspaceId,
            request.params.packageId! as SeedWorkspacePackageIdV1
          );
          if (!found)
            throw new HttpError(
              404,
              'SEED_PACKAGE_NOT_FOUND',
              'Seed Workspace Package was not found.'
            );
          return json(200, found);
        } catch (error) {
          return map(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/seed-workspace-claims',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:manage');
        const body = bodyOf(request);
        exact(body, ['packageId', 'invitationClaimToken']);
        try {
          return json(
            200,
            await options.claims.claim({
              packageId: value(body.packageId, 'packageId') as SeedWorkspacePackageIdV1,
              workspaceId: principal.workspaceId,
              actorPrincipalId: principal.userId,
              idempotencyKey: key(request),
              invitationClaimToken: value(body.invitationClaimToken, 'invitationClaimToken')
            })
          );
        } catch (error) {
          return map(error);
        }
      }
    }
  ];
}
