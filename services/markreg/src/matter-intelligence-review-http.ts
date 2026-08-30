import { timingSafeEqual } from 'node:crypto';
import {
  AuthenticationError,
  parseInternalWorkspacePrincipal,
  type FormalMatterId,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  MatterIntelligenceReviewError,
  type MatterIntelligenceReviewId,
  type MatterIntelligenceReviewOutcome,
  type MatterIntelligenceReviewReason,
  type MatterIntelligenceReviewService
} from './matter-intelligence-review.js';

export interface MatterIntelligenceReviewHttpOptions {
  internalServiceSecret: string;
  service: Pick<MatterIntelligenceReviewService, 'recordReview'>;
}

const OUTCOMES = new Set<MatterIntelligenceReviewOutcome>([
  'CONFIRMED',
  'OVERRIDDEN',
  'INCONCLUSIVE'
]);
const REASONS = new Set<MatterIntelligenceReviewReason>([
  'METHOD_ERROR',
  'INPUT_DATA_ERROR',
  'APPLICABILITY_ERROR',
  'PRODUCT_USER_PREFERENCE',
  'INCONCLUSIVE_EVIDENCE'
]);

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32) {
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  }
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function principalFor(request: JsonRequest, secret: string): WorkspacePrincipal {
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
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw new HttpError(401, error.code, error.message);
    }
    throw error;
  }

  const workspaceId = request.headers['x-markorbit-workspace-id'];
  if (!workspaceId || workspaceId !== principal.workspaceId) {
    throw new HttpError(
      403,
      'WORKSPACE_MISMATCH',
      'Workspace context does not match Principal truth.'
    );
  }
  if (
    !principal.permissions.includes('workspace:read') ||
    !principal.permissions.includes('matter:manage')
  ) {
    throw new HttpError(
      403,
      'PERMISSION_DENIED',
      'workspace:read and matter:manage permissions are required.'
    );
  }
  return principal;
}

function objectBody(request: JsonRequest): Readonly<Record<string, unknown>> {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  }
  const body = request.body as Record<string, unknown>;
  const allowed = new Set(['outcome', 'reason', 'rationale', 'supersedes']);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'Only outcome, reason, rationale and supersedes are accepted by this Phase 6 command.'
    );
  }
  return body;
}

function outcomeOf(value: unknown): MatterIntelligenceReviewOutcome {
  if (typeof value !== 'string' || !OUTCOMES.has(value as MatterIntelligenceReviewOutcome)) {
    throw new HttpError(400, 'INVALID_REQUEST', 'outcome is outside the Phase 6 review taxonomy.');
  }
  return value as MatterIntelligenceReviewOutcome;
}

function reasonOf(value: unknown): MatterIntelligenceReviewReason | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !REASONS.has(value as MatterIntelligenceReviewReason)) {
    throw new HttpError(400, 'INVALID_REQUEST', 'reason is outside the Phase 6 review taxonomy.');
  }
  return value as MatterIntelligenceReviewReason;
}

function rationaleOf(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new HttpError(400, 'INVALID_REQUEST', 'rationale must be a string when supplied.');
  }
  return value;
}

function supersedesOf(
  value: unknown
): Readonly<{ reviewId: MatterIntelligenceReviewId; reviewVersion: number }> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'INVALID_REQUEST', 'supersedes must be an object when supplied.');
  }
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length !== 2 ||
    !Object.hasOwn(record, 'reviewId') ||
    !Object.hasOwn(record, 'reviewVersion') ||
    typeof record.reviewId !== 'string' ||
    !Number.isSafeInteger(record.reviewVersion) ||
    Number(record.reviewVersion) < 1
  ) {
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'supersedes must contain reviewId and a positive reviewVersion.'
    );
  }
  return {
    reviewId: record.reviewId as MatterIntelligenceReviewId,
    reviewVersion: Number(record.reviewVersion)
  };
}

function requiredHeader(request: JsonRequest, name: string, code: string): string {
  const value = request.headers[name]?.trim();
  if (!value) throw new HttpError(400, code, `${name} is required.`);
  if (value.length > 300) {
    throw new HttpError(400, 'INVALID_REQUEST', `${name} exceeds 300 characters.`);
  }
  return value;
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
      path: '/internal/v1/formal-matters/:formalMatterId/intelligence-observations/:observationId/reviews',
      async handle(request) {
        const principal = principalFor(request, options.internalServiceSecret);
        const body = objectBody(request);
        const reason = reasonOf(body.reason);
        const rationale = rationaleOf(body.rationale);
        const supersedes = supersedesOf(body.supersedes);
        try {
          const disposition = await options.service.recordReview({
            workspaceId: principal.workspaceId,
            formalMatterId: request.params.formalMatterId! as FormalMatterId,
            matterIntelligenceObservationId: request.params.observationId!,
            outcome: outcomeOf(body.outcome),
            ...(reason === undefined ? {} : { reason }),
            ...(rationale === undefined ? {} : { rationale }),
            ...(supersedes === undefined ? {} : { supersedes }),
            principal,
            idempotencyKey: requiredHeader(request, 'idempotency-key', 'IDEMPOTENCY_KEY_REQUIRED'),
            correlationId: requiredHeader(request, 'x-correlation-id', 'CORRELATION_ID_REQUIRED')
          });
          return json(
            disposition.replayed || disposition.semanticDuplicate ? 200 : 201,
            disposition
          );
        } catch (error) {
          return translate(error);
        }
      }
    }
  ];
}
