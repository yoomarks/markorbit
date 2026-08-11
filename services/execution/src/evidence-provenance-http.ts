import { timingSafeEqual } from 'node:crypto';
import {
  parseInternalWorkspacePrincipal,
  type MarkOrbitId,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type {
  EvidenceReviewDecisionId,
  RecordEvidenceReviewDecisionCommand,
  ReviewedSourceAdmissionId
} from '@markorbit/contracts/evidence-lifecycle';
import type { EvidenceHandoffId } from '@markorbit/contracts/provider-execution';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { EvidenceReviewError, type EvidenceReviewService } from './evidence-review.js';
import type { EvidenceReviewQueueReader } from './evidence-review-queue-postgres.js';
import {
  ReviewedSourceHandoffError,
  type ReviewedSourceAdmissionService,
  type ReviewedSourceHandoffService
} from './reviewed-source-handoff.js';

export interface ExecutionEvidenceProvenanceRouteOptions {
  internalServiceSecret: string;
  admissionServiceFor(workspaceId: string): ReviewedSourceAdmissionService;
  handoffServiceFor(workspaceId: string): ReviewedSourceHandoffService;
  evidenceReviewServiceFor(workspaceId: string): EvidenceReviewService;
  reviewQueueFor?(workspaceId: string): EvidenceReviewQueueReader;
}

type Permission = 'review:read' | 'review:perform';
type Body = Record<string, unknown>;
const actorSpoofFields = new Set([
  'actorId',
  'userId',
  'reviewerId',
  'reviewerPrincipalId',
  'requestedBy',
  'membershipId'
]);

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

function operationsPrincipal(
  request: JsonRequest,
  secret: string,
  permission: Permission = 'review:perform'
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
  const allowed =
    permission === 'review:read'
      ? principal.permissions.includes('review:read') || principal.permissions.includes('review:perform')
      : principal.permissions.includes('review:perform');
  if (!allowed)
    throw new HttpError(403, 'PERMISSION_DENIED', `${permission} permission is required.`);
  return principal;
}

function reviewerPrincipal(principal: WorkspacePrincipal) {
  return {
    workspaceId: principal.workspaceId,
    userId: principal.userId as MarkOrbitId,
    permissions: principal.permissions
  };
}

function ensureWorkspace(expected: string, actual: unknown) {
  if (typeof actual !== 'string' || actual.toLowerCase() !== expected.toLowerCase())
    throw new HttpError(404, 'WORKSPACE_MISMATCH', 'Workspace-scoped record was not found.');
}

function rejectActorSpoof(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) rejectActorSpoof(item);
    return;
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (actorSpoofFields.has(key))
      throw new HttpError(
        400,
        'ACTOR_SPOOF_REJECTED',
        'Reviewer identity is derived from the authenticated Workspace Principal.'
      );
    rejectActorSpoof(item);
  }
}

function mapError(error: unknown): never {
  if (error instanceof EvidenceReviewError || error instanceof ReviewedSourceHandoffError)
    throw new HttpError(
      error.status,
      error.code,
      error.message,
      error.status >= 500,
      error.details
    );
  throw error;
}

export function createExecutionEvidenceProvenanceRoutes(
  options: ExecutionEvidenceProvenanceRouteOptions
): JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/internal/evidence-review/queue',
      handle: async (request) => {
        const principal = operationsPrincipal(request, options.internalServiceSecret, 'review:read');
        if (!options.reviewQueueFor)
          throw new HttpError(
            503,
            'DEPENDENCY_UNAVAILABLE',
            'Execution evidence review queue is unavailable.',
            true
          );
        const requestedLimit = Number(request.query.limit ?? '100');
        if (!Number.isFinite(requestedLimit) || requestedLimit < 1)
          throw new HttpError(400, 'INVALID_REQUEST', 'limit must be a positive number.');
        try {
          return json(200, {
            items: await options.reviewQueueFor(principal.workspaceId).list(
              principal.workspaceId,
              requestedLimit
            )
          });
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/internal/evidence-review/sources/capture',
      handle: async (request) => {
        const principal = operationsPrincipal(
          request,
          options.internalServiceSecret,
          'review:perform'
        );
        const body = bodyOf(request);
        rejectActorSpoof(body);
        const evidenceHandoffId = body.evidenceHandoffId;
        if (typeof evidenceHandoffId !== 'string' || !evidenceHandoffId.trim())
          throw new HttpError(400, 'INVALID_REQUEST', 'evidenceHandoffId is required.');
        try {
          return json(200, {
            source: await options
              .evidenceReviewServiceFor(principal.workspaceId)
              .captureReviewSource(
                evidenceHandoffId as EvidenceHandoffId,
                reviewerPrincipal(principal)
              )
          });
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/internal/evidence-review/decisions',
      handle: async (request) => {
        const principal = operationsPrincipal(
          request,
          options.internalServiceSecret,
          'review:perform'
        );
        const body = bodyOf(request);
        rejectActorSpoof(body);
        const command = body.command as RecordEvidenceReviewDecisionCommand | undefined;
        if (!command) throw new HttpError(400, 'INVALID_REQUEST', 'command is required.');
        ensureWorkspace(principal.workspaceId, command.workspaceId);
        try {
          const service = options.evidenceReviewServiceFor(principal.workspaceId);
          const decision = await service.recordDecision(command, reviewerPrincipal(principal));
          const correctionRequest =
            decision.outcome === 'CORRECTION_REQUIRED'
              ? await service.getCorrectionRequest(
                  decision.evidenceReviewDecisionId as EvidenceReviewDecisionId,
                  reviewerPrincipal(principal)
                )
              : undefined;
          return json(201, {
            decision,
            correctionRequest: correctionRequest ?? null
          });
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/internal/reviewed-source-admissions/:reviewedSourceAdmissionId/provenance',
      handle: async (request) => {
        const principal = operationsPrincipal(request, options.internalServiceSecret);
        const reviewedSourceAdmissionId = request.params
          .reviewedSourceAdmissionId! as ReviewedSourceAdmissionId;
        try {
          const admission = await options
            .admissionServiceFor(principal.workspaceId)
            .getAdmission(principal.workspaceId, reviewedSourceAdmissionId);
          if (!admission)
            throw new HttpError(404, 'NOT_FOUND', 'Reviewed Source Admission was not found.');
          const review = options.evidenceReviewServiceFor(principal.workspaceId);
          const [reviewDecision, correctionRequest, handoff] = await Promise.all([
            review.getDecision(admission.reviewDecision.id, reviewerPrincipal(principal)),
            review.getCorrectionRequest(admission.reviewDecision.id, reviewerPrincipal(principal)),
            options
              .handoffServiceFor(principal.workspaceId)
              .getDelivery(principal.workspaceId, reviewedSourceAdmissionId)
          ]);
          if (!reviewDecision)
            throw new HttpError(
              409,
              'PROVENANCE_INCOMPLETE',
              'Evidence Review Decision provenance is unavailable.'
            );
          return json(200, {
            admission,
            reviewDecision,
            correctionRequest: correctionRequest ?? null,
            handoff: handoff ?? null
          });
        } catch (error) {
          if (error instanceof HttpError) throw error;
          return mapError(error);
        }
      }
    }
  ];
}
