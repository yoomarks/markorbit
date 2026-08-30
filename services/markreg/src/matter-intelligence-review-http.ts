import { timingSafeEqual } from 'node:crypto';
import {
  AuthenticationError,
  parseInternalWorkspacePrincipal,
  type FormalMatterId,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import {
  matterIntelligenceReviewOutcomes,
  matterIntelligenceReviewReasonCodes,
  type MatterIntelligenceReviewOutcome,
  type MatterIntelligenceReviewReasonCode
} from '@markorbit/contracts/method-outcome-evidence';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  MatterIntelligenceReviewError,
  type MatterIntelligenceReviewService
} from './matter-intelligence-review.js';
import type { MatterIntelligenceObservationId } from './matter-intelligence.js';

export interface MatterIntelligenceReviewHttpOptions {
  internalServiceSecret: string;
  service: Pick<MatterIntelligenceReviewService, 'record' | 'resolveSource'>;
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
  requireManage: boolean
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
  if (!workspaceId || workspaceId !== principal.workspaceId)
    throw new HttpError(
      403,
      'WORKSPACE_MISMATCH',
      'Workspace context does not match Principal truth.'
    );
  if (
    !principal.permissions.includes('workspace:read') ||
    !principal.permissions.includes('matter:read') ||
    (requireManage && !principal.permissions.includes('matter:manage'))
  )
    throw new HttpError(
      403,
      'PERMISSION_DENIED',
      requireManage
        ? 'workspace:read, matter:read and matter:manage permissions are required.'
        : 'workspace:read and matter:read permissions are required.'
    );
  return principal;
}

function bodyRecord(request: JsonRequest): Readonly<Record<string, unknown>> {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  const body = request.body as Record<string, unknown>;
  const allowed = new Set(['outcome', 'reasonCode', 'rationale']);
  const unsupported = Object.keys(body).filter((key) => !allowed.has(key));
  if (unsupported.length)
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      `Unsupported review fields: ${unsupported.join(', ')}. Reviewer and provenance are server-derived.`
    );
  return body;
}

function enumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  field: string
): T {
  if (typeof value !== 'string' || !(values as readonly string[]).includes(value))
    throw new HttpError(400, 'INVALID_REQUEST', `${field} is invalid.`);
  return value as T;
}

function rationale(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 2000)
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'rationale must contain between 1 and 2000 characters when supplied.'
    );
  return value.trim();
}

function idempotencyKey(request: JsonRequest): string {
  const value = request.headers['idempotency-key']?.trim();
  if (!value) throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required.');
  if (value.length > 300)
    throw new HttpError(400, 'INVALID_REQUEST', 'Idempotency-Key exceeds 300 characters.');
  return value;
}

function correlationId(request: JsonRequest): string {
  const value = request.headers['x-correlation-id']?.trim();
  if (!value) throw new HttpError(400, 'CORRELATION_ID_REQUIRED', 'X-Correlation-Id is required.');
  if (value.length > 300)
    throw new HttpError(400, 'INVALID_REQUEST', 'X-Correlation-Id exceeds 300 characters.');
  return value;
}

function positiveVersion(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1)
    throw new HttpError(400, 'INVALID_REQUEST', 'reviewVersion must be a positive integer.');
  return parsed;
}

function translate(error: unknown): never {
  if (!(error instanceof MatterIntelligenceReviewError)) throw error;
  throw new HttpError(error.status, error.code, error.message, error.retryable);
}

export function createMatterIntelligenceReviewRoutes(
  options: MatterIntelligenceReviewHttpOptions
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/formal-matters/:formalMatterId/intelligence-observations/:observationId/review',
      async handle(request) {
        const principal = principalFor(request, options.internalServiceSecret, true);
        const body = bodyRecord(request);
        try {
          const disposition = await options.service.record({
            workspaceId: principal.workspaceId,
            formalMatterId: request.params.formalMatterId! as FormalMatterId,
            observationId: request.params.observationId! as MatterIntelligenceObservationId,
            outcome: enumValue(
              body.outcome,
              matterIntelligenceReviewOutcomes,
              'outcome'
            ) as MatterIntelligenceReviewOutcome,
            reasonCode: enumValue(
              body.reasonCode,
              matterIntelligenceReviewReasonCodes,
              'reasonCode'
            ) as MatterIntelligenceReviewReasonCode,
            rationale: rationale(body.rationale),
            principal,
            idempotencyKey: idempotencyKey(request),
            correlationId: correlationId(request)
          });
          return json(disposition.replayed || disposition.semanticDuplicate ? 200 : 201, disposition);
        } catch (error) {
          return translate(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/internal/v1/matter-intelligence-reviews/:reviewId/versions/:reviewVersion/source-authority',
      async handle(request) {
        const principal = principalFor(request, options.internalServiceSecret, false);
        try {
          return json(
            200,
            await options.service.resolveSource(
              principal.workspaceId,
              request.params.reviewId!,
              positiveVersion(request.params.reviewVersion)
            )
          );
        } catch (error) {
          return translate(error);
        }
      }
    }
  ];
}
