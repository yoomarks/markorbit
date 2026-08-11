import { timingSafeEqual } from 'node:crypto';
import type {
  ProjectLifecycleEventCommand,
  ReviewedSourceAdmissionEnvelope,
  ReviewedSourceAdmissionId
} from '@markorbit/contracts/evidence-lifecycle';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  LifecycleProjectionError,
  type LifecycleProjectionService,
  type ReviewedSourceAdmissionReader
} from './lifecycle-projection.js';
import {
  RECOMMENDED_ACTION_POLICY_VERSION,
  RecommendedActionError,
  type RecommendedActionService
} from './recommended-action.js';

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

export interface MarkRegLifecycleHandoffRouteOptions {
  internalServiceSecret: string;
  lifecycleServiceFor(workspaceId: string): LifecycleProjectionService;
  recommendedActionServiceFor?(workspaceId: string): RecommendedActionService;
}

function lifecycleError(error: unknown): never {
  if (error instanceof LifecycleProjectionError || error instanceof RecommendedActionError)
    throw new HttpError(
      error.status,
      error.code,
      error.message,
      error.status >= 500,
      error.details
    );
  throw error;
}

export function createMarkRegLifecycleHandoffRoutes(
  options: MarkRegLifecycleHandoffRouteOptions
): JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/lifecycle-projections',
      handle: async (request) => {
        requireInternal(request, options.internalServiceSecret);
        const body = bodyOf(request);
        const command = body.command as ProjectLifecycleEventCommand | undefined;
        if (!command) throw new HttpError(400, 'INVALID_REQUEST', 'command is required.');
        const workspaceId = workspaceOf(request, body);
        ensureWorkspace(workspaceId, command.workspaceId);
        try {
          const result = await options.lifecycleServiceFor(workspaceId).project(command);
          let recommendedAction;
          if (
            options.recommendedActionServiceFor &&
            result.currentView.currentEvent.id === result.event.lifecycleEventId
          ) {
            recommendedAction = await options.recommendedActionServiceFor(workspaceId).regenerate({
              workspaceId,
              formalMatterId: result.currentView.formalMatter.id,
              expectedLifecycleViewId: result.currentView.lifecycleViewId,
              expectedLifecycleViewVersion: result.currentView.version,
              expectedLifecycleViewFingerprintSha256:
                result.currentView.lifecycleViewFingerprintSha256,
              policyVersion: RECOMMENDED_ACTION_POLICY_VERSION,
              idempotencyKey: `lifecycle-recommendation:${result.currentView.lifecycleViewId}:v${result.currentView.version}`,
              correlationId: command.correlationId
            });
          }
          return json(200, {
            result,
            ...(recommendedAction ? { recommendedAction } : {})
          });
        } catch (error) {
          return lifecycleError(error);
        }
      }
    }
  ];
}

export class HttpReviewedSourceAdmissionReader implements ReviewedSourceAdmissionReader {
  constructor(
    private readonly executionUrl: string,
    private readonly internalServiceSecret: string,
    private readonly workspaceId: string
  ) {}

  async findReviewedSourceAdmission(
    reviewedSourceAdmissionId: ReviewedSourceAdmissionId
  ): Promise<ReviewedSourceAdmissionEnvelope | undefined> {
    let response: Response;
    try {
      response = await fetch(
        `${this.executionUrl}/internal/reviewed-source-admissions/${encodeURIComponent(reviewedSourceAdmissionId)}`,
        {
          headers: {
            'x-markorbit-internal-authorization': this.internalServiceSecret,
            'x-markorbit-workspace-id': this.workspaceId
          }
        }
      );
    } catch (cause) {
      throw new Error('Execution Reviewed Source Admission transport is unavailable.', {
        cause: cause instanceof Error ? cause : undefined
      });
    }
    if (response.status === 404) return undefined;
    if (!response.ok)
      throw new Error(`Execution Reviewed Source Admission transport returned ${response.status}.`);
    const payload = (await response.json()) as { admission?: ReviewedSourceAdmissionEnvelope };
    if (!payload.admission)
      throw new Error(
        'Execution Reviewed Source Admission transport returned an invalid response.'
      );
    return payload.admission;
  }
}
