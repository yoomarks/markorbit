import { timingSafeEqual } from 'node:crypto';
import {
  parseInternalWorkspacePrincipal,
  type MarkOrbitId,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type { ReviewedSourceAdmissionId } from '@markorbit/contracts/evidence-lifecycle';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { EvidenceReviewError, type EvidenceReviewService } from './evidence-review.js';
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
}

function trusted(configured: string, supplied: string | undefined) {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function operationsPrincipal(request: JsonRequest, secret: string): WorkspacePrincipal {
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
  if (!principal.permissions.includes('review:perform'))
    throw new HttpError(403, 'PERMISSION_DENIED', 'review:perform permission is required.');
  return principal;
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
      path: '/internal/reviewed-source-admissions/:reviewedSourceAdmissionId/provenance',
      handle: async (request) => {
        const principal = operationsPrincipal(request, options.internalServiceSecret);
        const reviewedSourceAdmissionId =
          request.params.reviewedSourceAdmissionId! as ReviewedSourceAdmissionId;
        try {
          const admission = await options
            .admissionServiceFor(principal.workspaceId)
            .getAdmission(principal.workspaceId, reviewedSourceAdmissionId);
          if (!admission)
            throw new HttpError(
              404,
              'NOT_FOUND',
              'Reviewed Source Admission was not found.'
            );
          const reviewerPrincipal = {
            workspaceId: principal.workspaceId,
            userId: principal.userId as MarkOrbitId,
            permissions: principal.permissions
          };
          const review = options.evidenceReviewServiceFor(principal.workspaceId);
          const [reviewDecision, correctionRequest, handoff] = await Promise.all([
            review.getDecision(admission.reviewDecision.id, reviewerPrincipal),
            review.getCorrectionRequest(admission.reviewDecision.id, reviewerPrincipal),
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
