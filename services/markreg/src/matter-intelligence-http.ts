import { timingSafeEqual } from 'node:crypto';
import {
  AuthenticationError,
  parseInternalWorkspacePrincipal,
  type FormalMatterId,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  MatterIntelligenceError,
  type MatterIntelligenceService
} from './matter-intelligence.js';

export interface MatterIntelligenceHttpOptions {
  internalServiceSecret: string;
  service: Pick<MatterIntelligenceService, 'recordCompletedDurationBand'>;
}

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function principalFor(request: JsonRequest, secret: string): WorkspacePrincipal {
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
  if (!principal.permissions.includes('workspace:read') || !principal.permissions.includes('matter:manage'))
    throw new HttpError(
      403,
      'PERMISSION_DENIED',
      'workspace:read and matter:manage permissions are required.'
    );
  return principal;
}

function bodyOf(request: JsonRequest): Readonly<Record<string, unknown>> {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  const body = request.body as Record<string, unknown>;
  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== 'observedCompletedDurationDays')
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'Only observedCompletedDurationDays is accepted by this Phase 5 command.'
    );
  return body;
}

function durationDays(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0)
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'observedCompletedDurationDays must be a non-negative safe integer.'
    );
  return Number(value);
}

function idempotencyKey(request: JsonRequest): string {
  const key = request.headers['idempotency-key']?.trim();
  if (!key) throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required.');
  if (key.length > 300)
    throw new HttpError(400, 'INVALID_REQUEST', 'Idempotency-Key exceeds 300 characters.');
  return key;
}

function correlationId(request: JsonRequest): string {
  const value = request.headers['x-correlation-id']?.trim();
  if (!value) throw new HttpError(400, 'CORRELATION_ID_REQUIRED', 'X-Correlation-Id is required.');
  if (value.length > 300)
    throw new HttpError(400, 'INVALID_REQUEST', 'X-Correlation-Id exceeds 300 characters.');
  return value;
}

function translate(error: unknown): never {
  if (!(error instanceof MatterIntelligenceError)) throw error;
  throw new HttpError(error.status, error.code, error.message, error.retryable, error.details);
}

export function createMatterIntelligenceRoutes(
  options: MatterIntelligenceHttpOptions
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/formal-matters/:formalMatterId/intelligence-observations/cn-duration-band',
      async handle(request) {
        const principal = principalFor(request, options.internalServiceSecret);
        const body = bodyOf(request);
        try {
          const disposition = await options.service.recordCompletedDurationBand({
            workspaceId: principal.workspaceId,
            formalMatterId: request.params.formalMatterId! as FormalMatterId,
            observedCompletedDurationDays: durationDays(body.observedCompletedDurationDays),
            principal,
            idempotencyKey: idempotencyKey(request),
            correlationId: correlationId(request)
          });
          return json(disposition.replayed || disposition.semanticDuplicate ? 200 : 201, disposition);
        } catch (error) {
          return translate(error);
        }
      }
    }
  ];
}
