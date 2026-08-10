import { timingSafeEqual } from 'node:crypto';
import type {
  ProjectLifecycleEventCommand,
  ReviewedSourceAdmissionId
} from '@markorbit/contracts/evidence-lifecycle';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  ReviewedSourceHandoffError,
  type DeliverReviewedSourceCommand,
  type MarkRegLifecycleProjectionClient,
  type ReviewedSourceAdmissionService,
  type ReviewedSourceHandoffService,
  type ReviewedSourceProjectionResult
} from './reviewed-source-handoff.js';

export interface ExecutionReviewedSourceInternalRouteOptions {
  internalServiceSecret: string;
  admissionServiceFor(workspaceId: string): ReviewedSourceAdmissionService;
  handoffServiceFor(workspaceId: string): ReviewedSourceHandoffService;
}

type Body = Record<string, unknown>;

function bodyOf(request: JsonRequest): Body {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Body;
}

function trusted(configured: string, supplied: string | undefined) {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function requireInternal(request: JsonRequest, secret: string) {
  if (!trusted(secret, request.headers['x-markorbit-internal-authorization']))
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );
}

function workspaceOf(request: JsonRequest, body?: Body) {
  const workspaceId =
    request.headers['x-markorbit-workspace-id'] ??
    (typeof body?.workspaceId === 'string' ? body.workspaceId : undefined);
  if (!workspaceId)
    throw new HttpError(400, 'INVALID_WORKSPACE_CONTEXT', 'Workspace context is required.');
  return workspaceId.toLowerCase();
}

function ensureWorkspace(workspaceId: string, actual: unknown) {
  if (typeof actual !== 'string' || actual.toLowerCase() !== workspaceId)
    throw new HttpError(404, 'WORKSPACE_MISMATCH', 'Workspace-scoped record was not found.');
}

function handoffError(error: unknown): never {
  if (error instanceof ReviewedSourceHandoffError)
    throw new HttpError(error.status, error.code, error.message, error.retryable, error.details);
  throw error;
}

export function createExecutionReviewedSourceInternalRoutes(
  options: ExecutionReviewedSourceInternalRouteOptions
): JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/internal/reviewed-source-admissions/:reviewedSourceAdmissionId',
      handle: async (request) => {
        requireInternal(request, options.internalServiceSecret);
        const workspaceId = workspaceOf(request);
        try {
          const admission = await options
            .admissionServiceFor(workspaceId)
            .getAdmission(
              workspaceId,
              request.params.reviewedSourceAdmissionId! as ReviewedSourceAdmissionId
            );
          if (!admission)
            throw new HttpError(404, 'NOT_FOUND', 'Reviewed Source Admission was not found.');
          return json(200, { admission });
        } catch (error) {
          if (error instanceof HttpError) throw error;
          return handoffError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/internal/reviewed-source-handoffs/deliver',
      handle: async (request) => {
        requireInternal(request, options.internalServiceSecret);
        const body = bodyOf(request);
        const command = body.command as DeliverReviewedSourceCommand | undefined;
        if (!command) throw new HttpError(400, 'INVALID_REQUEST', 'command is required.');
        const workspaceId = workspaceOf(request, body);
        ensureWorkspace(workspaceId, command.workspaceId);
        try {
          return json(200, {
            result: await options.handoffServiceFor(workspaceId).deliver(command)
          });
        } catch (error) {
          return handoffError(error);
        }
      }
    }
  ];
}

const knownErrorCodes = new Set([
  'INVALID_INPUT',
  'PERMISSION_DENIED',
  'REVIEW_DECISION_NOT_ADMISSIBLE',
  'STALE_SOURCE',
  'SOURCE_VERSION_MISMATCH',
  'SOURCE_FINGERPRINT_MISMATCH',
  'IDEMPOTENCY_CONFLICT',
  'VERSION_CONFLICT',
  'PERSISTENCE_UNAVAILABLE',
  'DEPENDENCY_UNAVAILABLE'
]);

export class HttpMarkRegLifecycleProjectionClient implements MarkRegLifecycleProjectionClient {
  constructor(
    private readonly markRegUrl: string,
    private readonly internalServiceSecret: string
  ) {}

  async project(
    command: Readonly<ProjectLifecycleEventCommand>
  ): Promise<ReviewedSourceProjectionResult> {
    let response: Response;
    try {
      response = await fetch(`${this.markRegUrl}/internal/lifecycle-projections`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': this.internalServiceSecret,
          'x-markorbit-workspace-id': command.workspaceId,
          'x-correlation-id': String(command.correlationId)
        },
        body: JSON.stringify({ command })
      });
    } catch (cause) {
      throw new ReviewedSourceHandoffError(
        'DEPENDENCY_UNAVAILABLE',
        'MarkReg lifecycle projection transport is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause.message : String(cause) }
      );
    }

    const payload = (await response.json().catch(() => undefined)) as
      | {
          result?: ReviewedSourceProjectionResult;
          code?: string;
          message?: string;
          retryable?: boolean;
          details?: Readonly<Record<string, unknown>>;
        }
      | undefined;
    if (!response.ok) {
      const code = payload?.code;
      if (code && knownErrorCodes.has(code))
        throw new ReviewedSourceHandoffError(
          code as ReviewedSourceHandoffError['code'],
          payload?.message ?? 'MarkReg rejected the Reviewed Source handoff.',
          response.status,
          payload?.retryable ?? response.status >= 500,
          payload?.details
        );
      throw new ReviewedSourceHandoffError(
        'DEPENDENCY_UNAVAILABLE',
        payload?.message ?? 'MarkReg lifecycle projection transport is unavailable.',
        response.status >= 500 ? response.status : 503,
        true
      );
    }
    if (!payload?.result)
      throw new ReviewedSourceHandoffError(
        'DEPENDENCY_UNAVAILABLE',
        'MarkReg lifecycle projection returned an invalid response.',
        503,
        true
      );
    return payload.result;
  }
}
