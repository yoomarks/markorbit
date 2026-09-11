import { timingSafeEqual } from 'node:crypto';
import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type {
  CommunicationLinkDecisionBasis,
  CommunicationLinkDecisionStatus,
  CommunicationLinkId,
  CommunicationLinkLifecycle,
  CommunicationLinkSourceReferenceV1,
  CommunicationLinkTargetKind,
  CommunicationLinkTargetReferenceV1
} from '@markorbit/contracts/communication-link';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  CommunicationLinkRuntimeError,
  type CommunicationLinkService
} from './communication-link.js';

type Body = Record<string, unknown>;
type LinkService = Pick<
  CommunicationLinkService,
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
  'decidedByPrincipalId',
  'authority',
  'decisionFingerprintSha256',
  'communicationLinkId',
  'version',
  'lifecycle',
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
      'Workspace, actor, decision authority and lifecycle fields are server-owned.'
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
function keyOf(request: JsonRequest): string {
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
function object<T>(value: unknown, field: string): T {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be an object.`);
  return value as T;
}
function linkId(request: JsonRequest): CommunicationLinkId {
  return text(request.params.communicationLinkId, 'communicationLinkId') as CommunicationLinkId;
}
function evidence(value: unknown): readonly string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))
    throw new HttpError(400, 'INVALID_REQUEST', 'evidenceReferences must be an array of strings.');
  return value as string[];
}
function mapOwnerError(error: unknown): never {
  if (error instanceof CommunicationLinkRuntimeError)
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  throw error;
}

export function createCommunicationLinkRoutes(options: {
  internalServiceSecret: string;
  service: LinkService;
}): JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/v1/communication-links',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'matter:manage');
        if (Object.keys(request.query).length > 0)
          throw new HttpError(400, 'INVALID_REQUEST', 'Create accepts no query parameters.');
        const body = bodyOf(request);
        exactBody(body, [
          'source',
          'target',
          'decisionStatus',
          'decisionBasis',
          'reason',
          'evidenceReferences'
        ]);
        try {
          return json(
            201,
            await options.service.create(
              {
                workspaceId: principal.workspaceId,
                actorPrincipalId: principal.userId,
                idempotencyKey: keyOf(request),
                source: object<CommunicationLinkSourceReferenceV1>(body.source, 'source'),
                target: object<CommunicationLinkTargetReferenceV1>(body.target, 'target'),
                decisionStatus: text(
                  body.decisionStatus,
                  'decisionStatus'
                ) as CommunicationLinkDecisionStatus,
                decisionBasis: text(
                  body.decisionBasis,
                  'decisionBasis'
                ) as CommunicationLinkDecisionBasis,
                ...(body.reason === undefined
                  ? {}
                  : { reason: body.reason === null ? null : text(body.reason, 'reason') }),
                evidenceReferences: evidence(body.evidenceReferences)
              },
              principal
            )
          );
        } catch (error) {
          return mapOwnerError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/v1/communication-links',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        noBody(request);
        if (
          Object.keys(request.query).some(
            (key) =>
              ![
                'lifecycle',
                'targetKind',
                'sourceScope',
                'accountRef',
                'threadRef',
                'limit'
              ].includes(key)
          )
        )
          throw new HttpError(
            400,
            'INVALID_REQUEST',
            'Unsupported Communication Link list query parameter.'
          );
        const { lifecycle, targetKind, sourceScope, accountRef, threadRef, limit } = request.query;
        if (limit !== undefined && !/^[1-9]\d*$/u.test(limit))
          throw new HttpError(400, 'INVALID_REQUEST', 'limit must be a positive integer.');
        try {
          return json(
            200,
            await options.service.listLatest(principal.workspaceId, {
              ...(lifecycle === undefined
                ? {}
                : { lifecycle: text(lifecycle, 'lifecycle') as CommunicationLinkLifecycle }),
              ...(targetKind === undefined
                ? {}
                : { targetKind: text(targetKind, 'targetKind') as CommunicationLinkTargetKind }),
              ...(sourceScope === undefined
                ? {}
                : { sourceScope: text(sourceScope, 'sourceScope') as 'MESSAGE' | 'THREAD' }),
              ...(accountRef === undefined ? {} : { accountRef: text(accountRef, 'accountRef') }),
              ...(threadRef === undefined ? {} : { threadRef: text(threadRef, 'threadRef') }),
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
      path: '/v1/communication-links/:communicationLinkId',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        noBodyOrQuery(request);
        try {
          const item = await options.service.getLatest(principal.workspaceId, linkId(request));
          if (!item) throw new HttpError(404, 'NOT_FOUND', 'Communication Link was not found.');
          return json(200, item);
        } catch (error) {
          if (error instanceof HttpError) throw error;
          return mapOwnerError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/v1/communication-links/:communicationLinkId/versions/:version',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        noBodyOrQuery(request);
        try {
          const item = await options.service.getExact(
            principal.workspaceId,
            linkId(request),
            positive(Number(request.params.version), 'version')
          );
          if (!item)
            throw new HttpError(404, 'NOT_FOUND', 'Communication Link version was not found.');
          return json(200, item);
        } catch (error) {
          if (error instanceof HttpError) throw error;
          return mapOwnerError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/v1/communication-links/:communicationLinkId/archive',
      handle: async (request) => {
        const principal = principalOf(request, options.internalServiceSecret, 'matter:manage');
        if (Object.keys(request.query).length > 0)
          throw new HttpError(400, 'INVALID_REQUEST', 'Archive accepts no query parameters.');
        const body = bodyOf(request);
        exactBody(body, ['expectedVersion']);
        try {
          return json(
            200,
            await options.service.archive({
              workspaceId: principal.workspaceId,
              communicationLinkId: linkId(request),
              expectedVersion: positive(body.expectedVersion, 'expectedVersion'),
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
