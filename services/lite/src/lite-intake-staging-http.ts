import { timingSafeEqual } from 'node:crypto';
import {
  parseInternalWorkspacePrincipal,
  type Permission,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type {
  LiteIntakeCaseCandidateId,
  LiteIntakeManagedAiExtractionRefV1,
  LiteIntakePrimarySourceV1,
  LiteIntakeReviewedMaterialV1,
  LiteIntakeStagingId,
  LiteIntakeStagingLifecycle
} from '@markorbit/contracts/lite-intake-staging';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  LiteIntakeStagingRuntimeError,
  type LiteIntakeDraftCaseInput,
  type LiteIntakeReviewedFieldInput,
  type LiteIntakeStagingService
} from './lite-intake-staging.js';

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
function exactBody(body: Body, allowed: readonly string[], required: readonly string[] = []): void {
  const unsupported = Object.keys(body).filter((key) => !allowed.includes(key));
  const missing = required.filter((key) => body[key] === undefined);
  if (unsupported.length || missing.length)
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      `Request body fields are invalid; unsupported=${unsupported.join(',') || 'none'}; missing=${missing.join(',') || 'none'}.`
    );
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
  return value as readonly T[];
}

function object<T>(value: unknown, field: string): Readonly<T> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be an object.`);
  return value as Readonly<T>;
}
function stagingId(request: JsonRequest): LiteIntakeStagingId {
  return text(request.params.stagingId, 'stagingId') as LiteIntakeStagingId;
}

function caseCandidateId(request: JsonRequest): LiteIntakeCaseCandidateId {
  return text(request.params.caseCandidateId, 'caseCandidateId') as LiteIntakeCaseCandidateId;
}

function idempotencyKey(request: JsonRequest): string {
  return text(request.headers['idempotency-key'], 'Idempotency-Key');
}

function noBody(request: JsonRequest): void {
  if (request.body !== undefined)
    throw new HttpError(400, 'INVALID_REQUEST', 'This read accepts no request body.');
}

function mapRuntimeError(error: unknown): never {
  if (error instanceof LiteIntakeStagingRuntimeError)
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  throw error;
}

type IntakeStagingHttpService = Pick<
  LiteIntakeStagingService,
  'create' | 'reviseCase' | 'reviewCase' | 'commitCase' | 'getExact' | 'getLatest' | 'listLatest'
>;

export function createLiteIntakeStagingRoutes(options: {
  internalServiceSecret: string;
  service: IntakeStagingHttpService;
}): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/lite-intake-staging',
      async handle(request) {
        const principal = principalOf(request, options.internalServiceSecret, 'matter:manage');
        if (Object.keys(request.query).length)
          throw new HttpError(400, 'INVALID_REQUEST', 'Create accepts no query parameters.');
        const body = bodyOf(request);
        exactBody(body, ['sources', 'aiExtractions', 'caseCandidates'], ['sources']);
        try {
          return json(
            201,
            await options.service.create({
              workspaceId: principal.workspaceId,
              actorPrincipalId: principal.userId,
              idempotencyKey: idempotencyKey(request),
              sources: array<LiteIntakePrimarySourceV1>(body.sources, 'sources'),
              ...(body.aiExtractions === undefined
                ? {}
                : {
                    aiExtractions: array<LiteIntakeManagedAiExtractionRefV1>(
                      body.aiExtractions,
                      'aiExtractions'
                    )
                  }),
              ...(body.caseCandidates === undefined
                ? {}
                : {
                    caseCandidates: array<LiteIntakeDraftCaseInput>(
                      body.caseCandidates,
                      'caseCandidates'
                    )
                  })
            })
          );
        } catch (error) {
          return mapRuntimeError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/internal/v1/lite-intake-staging/:stagingId/cases/:caseCandidateId/revise',
      async handle(request) {
        const principal = principalOf(request, options.internalServiceSecret, 'matter:manage');
        if (Object.keys(request.query).length)
          throw new HttpError(400, 'INVALID_REQUEST', 'Revise accepts no query parameters.');
        const body = bodyOf(request);
        exactBody(
          body,
          ['expectedVersion', 'state', 'fieldCandidates', 'sources', 'aiExtractions'],
          ['expectedVersion', 'state', 'fieldCandidates']
        );
        try {
          return json(
            200,
            await options.service.reviseCase({
              workspaceId: principal.workspaceId,
              stagingId: stagingId(request),
              caseCandidateId: caseCandidateId(request),
              expectedVersion: positive(body.expectedVersion, 'expectedVersion'),
              idempotencyKey: idempotencyKey(request),
              state: text(body.state, 'state') as LiteIntakeDraftCaseInput['state'],
              fieldCandidates: array<LiteIntakeDraftCaseInput['fieldCandidates'][number]>(
                body.fieldCandidates,
                'fieldCandidates'
              ),
              ...(body.sources === undefined
                ? {}
                : { sources: array<LiteIntakePrimarySourceV1>(body.sources, 'sources') }),
              ...(body.aiExtractions === undefined
                ? {}
                : {
                    aiExtractions: array<LiteIntakeManagedAiExtractionRefV1>(
                      body.aiExtractions,
                      'aiExtractions'
                    )
                  })
            })
          );
        } catch (error) {
          return mapRuntimeError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/internal/v1/lite-intake-staging/:stagingId/cases/:caseCandidateId/review',
      async handle(request) {
        const principal = principalOf(request, options.internalServiceSecret, 'matter:manage');
        if (Object.keys(request.query).length)
          throw new HttpError(400, 'INVALID_REQUEST', 'Review accepts no query parameters.');
        const body = bodyOf(request);
        exactBody(
          body,
          ['expectedVersion', 'fieldCandidates', 'material'],
          ['expectedVersion', 'fieldCandidates', 'material']
        );
        try {
          return json(
            200,
            await options.service.reviewCase({
              workspaceId: principal.workspaceId,
              actorPrincipalId: principal.userId,
              stagingId: stagingId(request),
              caseCandidateId: caseCandidateId(request),
              expectedVersion: positive(body.expectedVersion, 'expectedVersion'),
              idempotencyKey: idempotencyKey(request),
              fieldCandidates: array<LiteIntakeReviewedFieldInput>(
                body.fieldCandidates,
                'fieldCandidates'
              ),
              material: object<LiteIntakeReviewedMaterialV1>(body.material, 'material')
            })
          );
        } catch (error) {
          return mapRuntimeError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/internal/v1/lite-intake-staging/:stagingId/cases/:caseCandidateId/commit',
      async handle(request) {
        const principal = principalOf(request, options.internalServiceSecret, 'matter:create');
        if (Object.keys(request.query).length)
          throw new HttpError(400, 'INVALID_REQUEST', 'Commit accepts no query parameters.');
        const body = bodyOf(request);
        exactBody(
          body,
          ['expectedVersion', 'expectedReviewedFingerprintSha256'],
          ['expectedVersion', 'expectedReviewedFingerprintSha256']
        );
        try {
          const result = await options.service.commitCase({
            workspaceId: principal.workspaceId,
            stagingId: stagingId(request),
            caseCandidateId: caseCandidateId(request),
            expectedVersion: positive(body.expectedVersion, 'expectedVersion'),
            expectedReviewedFingerprintSha256: text(
              body.expectedReviewedFingerprintSha256,
              'expectedReviewedFingerprintSha256'
            ),
            idempotencyKey: idempotencyKey(request),
            principal
          });
          return json(result.status === 'COMMITTED' ? 200 : 202, result);
        } catch (error) {
          return mapRuntimeError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/internal/v1/lite-intake-staging',
      async handle(request) {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        noBody(request);
        if (Object.keys(request.query).some((key) => !['lifecycle', 'limit'].includes(key)))
          throw new HttpError(400, 'INVALID_REQUEST', 'Unsupported Intake Staging list query.');
        const { lifecycle, limit } = request.query;
        if (limit !== undefined && !/^[1-9]\d*$/u.test(limit))
          throw new HttpError(400, 'INVALID_REQUEST', 'limit must be a positive integer.');
        try {
          return json(
            200,
            await options.service.listLatest(principal.workspaceId, {
              ...(lifecycle === undefined
                ? {}
                : { lifecycle: text(lifecycle, 'lifecycle') as LiteIntakeStagingLifecycle }),
              ...(limit === undefined ? {} : { limit: Number(limit) })
            })
          );
        } catch (error) {
          return mapRuntimeError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/internal/v1/lite-intake-staging/:stagingId',
      async handle(request) {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        noBody(request);
        if (Object.keys(request.query).length)
          throw new HttpError(400, 'INVALID_REQUEST', 'Latest read accepts no query parameters.');
        try {
          const item = await options.service.getLatest(principal.workspaceId, stagingId(request));
          if (!item)
            throw new HttpError(
              404,
              'LITE_INTAKE_STAGING_NOT_FOUND',
              'Lite Intake Staging was not found in this Workspace.'
            );
          return json(200, item);
        } catch (error) {
          return mapRuntimeError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/internal/v1/lite-intake-staging/:stagingId/versions/:version',
      async handle(request) {
        const principal = principalOf(request, options.internalServiceSecret, 'workspace:read');
        noBody(request);
        if (Object.keys(request.query).length)
          throw new HttpError(400, 'INVALID_REQUEST', 'Exact read accepts no query parameters.');
        const version = positive(Number(request.params.version), 'version');
        try {
          const item = await options.service.getExact(
            principal.workspaceId,
            stagingId(request),
            version
          );
          if (!item)
            throw new HttpError(
              404,
              'LITE_INTAKE_STAGING_NOT_FOUND',
              'Lite Intake Staging version was not found in this Workspace.'
            );
          return json(200, item);
        } catch (error) {
          return mapRuntimeError(error);
        }
      }
    }
  ];
}
