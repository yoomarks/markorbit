import { timingSafeEqual } from 'node:crypto';
import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type {
  BusinessAttributionEvidenceBasisV1,
  BusinessAttributionLinkIdV1,
  BusinessAttributionMotionKindV1,
  BusinessAttributionReferenceV1,
  BusinessAttributionStateV1
} from '@markorbit/contracts/business-attribution';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  BusinessAttributionRuntimeError,
  type PostgresBusinessAttributionStore
} from './business-attribution.js';

type Store = Pick<PostgresBusinessAttributionStore, 'create' | 'find'>;
type Body = Record<string, unknown>;
function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured),
    right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}
function principalOf(
  request: JsonRequest,
  secret: string,
  permission: 'workspace:read' | 'workspace:manage'
): WorkspacePrincipal {
  if (!trusted(secret, request.headers['x-markorbit-internal-authorization'])) {
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );
  }
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
  if (!workspaceId || workspaceId.toLowerCase() !== principal.workspaceId.toLowerCase()) {
    throw new HttpError(404, 'WORKSPACE_MISMATCH', 'Business attribution was not found.');
  }
  if (!principal.permissions.includes(permission)) {
    throw new HttpError(403, 'PERMISSION_DENIED', `${permission} permission is required.`);
  }
  return principal;
}
function bodyOf(request: JsonRequest): Body {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  }
  return request.body as Body;
}
function exact(body: Body): void {
  const allowed = new Set([
    'motionKind',
    'sourceRefs',
    'touchpointRefs',
    'downstreamRef',
    'attributionState',
    'evidenceBasis',
    'evaluatedAt'
  ]);
  const serverOwned = new Set([
    'workspaceId',
    'actorPrincipalId',
    'recordedByPrincipalId',
    'businessAttributionLinkId',
    'version',
    'businessAttributionFingerprintSha256',
    'authorityConsequences'
  ]);
  if (Object.keys(body).some((field) => serverOwned.has(field))) {
    throw new HttpError(
      400,
      'OWNER_FIELD_SPOOF_REJECTED',
      'Workspace, actor, identity and authority fields are server-owned.'
    );
  }
  if (Object.keys(body).some((field) => !allowed.has(field))) {
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body contains unsupported fields.');
  }
}
function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be a non-empty string.`);
  return value.trim();
}
function refs(value: unknown, field: string): readonly Readonly<BusinessAttributionReferenceV1>[] {
  if (!Array.isArray(value))
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be an array.`);
  return value as readonly Readonly<BusinessAttributionReferenceV1>[];
}
function ref(value: unknown): Readonly<BusinessAttributionReferenceV1> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'INVALID_REQUEST', 'downstreamRef must be an object.');
  return value as Readonly<BusinessAttributionReferenceV1>;
}
function noQuery(request: JsonRequest): void {
  if (Object.keys(request.query).length)
    throw new HttpError(400, 'INVALID_REQUEST', 'Query parameters are not supported.');
}
function map(error: unknown): never {
  if (error instanceof BusinessAttributionRuntimeError)
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  throw error;
}

export function createBusinessAttributionRoutes(options: {
  internalServiceSecret: string;
  store: Store;
}): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/v1/business-attribution-links',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:manage');
        noQuery(request);
        const body = bodyOf(request);
        exact(body);
        try {
          return json(
            201,
            await options.store.create({
              workspaceId: principal.workspaceId,
              actorPrincipalId: principal.userId,
              idempotencyKey: text(request.headers['idempotency-key'], 'Idempotency-Key'),
              motionKind: text(body.motionKind, 'motionKind') as BusinessAttributionMotionKindV1,
              sourceRefs: refs(body.sourceRefs, 'sourceRefs'),
              touchpointRefs: refs(body.touchpointRefs, 'touchpointRefs'),
              ...(body.downstreamRef === undefined
                ? {}
                : { downstreamRef: ref(body.downstreamRef) }),
              attributionState: text(
                body.attributionState,
                'attributionState'
              ) as BusinessAttributionStateV1,
              evidenceBasis: text(
                body.evidenceBasis,
                'evidenceBasis'
              ) as BusinessAttributionEvidenceBasisV1,
              ...(body.evaluatedAt === undefined
                ? {}
                : { evaluatedAt: text(body.evaluatedAt, 'evaluatedAt') })
            })
          );
        } catch (error) {
          return map(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/v1/business-attribution-links/:linkId',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        noQuery(request);
        try {
          const value = await options.store.find(
            principal.workspaceId,
            text(request.params.linkId, 'linkId') as BusinessAttributionLinkIdV1
          );
          if (!value) throw new HttpError(404, 'NOT_FOUND', 'Business attribution was not found.');
          return json(200, value);
        } catch (error) {
          return map(error);
        }
      }
    }
  ];
}
