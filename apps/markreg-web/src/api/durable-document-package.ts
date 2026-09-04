import type {
  DurableDocumentEvidenceInput,
  DurableDocumentPackageView,
  DurableInstructionInput,
  ProfessionalReviewCase
} from '@markorbit/contracts';
import { createApiClient, type ApiClient } from './client.js';

const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, member]) => member !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, member]) => `${JSON.stringify(key)}:${canonicalJson(member)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
};

async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export interface DurableDocumentPackageClient {
  createFromCompletedReview(
    review: ProfessionalReviewCase,
    idempotencyKey: string
  ): Promise<DurableDocumentPackageView>;
  get(documentPackageId: string): Promise<DurableDocumentPackageView>;
  upsertEvidence(
    documentPackageId: string,
    expectedVersion: number,
    evidence: DurableDocumentEvidenceInput,
    idempotencyKey: string
  ): Promise<DurableDocumentPackageView>;
  appendInstruction(
    documentPackageId: string,
    expectedVersion: number,
    instruction: DurableInstructionInput,
    idempotencyKey: string
  ): Promise<DurableDocumentPackageView>;
  markReady(
    documentPackageId: string,
    expectedVersion: number,
    idempotencyKey: string
  ): Promise<DurableDocumentPackageView>;
}

export function createDurableDocumentPackageClient(
  api: ApiClient = createApiClient()
): DurableDocumentPackageClient {
  return {
    async createFromCompletedReview(review, idempotencyKey) {
      if (
        review.status !== 'REVIEWED_READY_FOR_NEXT_STEP' ||
        !review.decision ||
        !review.version ||
        !review.completedAt
      )
        throw new Error('A completed durable Professional Review version is required.');
      const expectedCompletedDecisionHash = await sha256(review.decision);
      return api.post<DurableDocumentPackageView>(
        '/api/markreg/document-packages',
        {
          professionalReviewCaseId: review.reviewCaseId,
          expectedReviewVersion: review.version,
          expectedCompletedDecisionId: review.decision.decidedAt,
          expectedCompletedDecisionHash
        },
        { 'Idempotency-Key': idempotencyKey }
      );
    },
    get(documentPackageId) {
      return api.get<DurableDocumentPackageView>(
        `/api/markreg/document-packages/${encodeURIComponent(documentPackageId)}`
      );
    },
    upsertEvidence(documentPackageId, expectedVersion, evidence, idempotencyKey) {
      return api.post<DurableDocumentPackageView>(
        `/api/markreg/document-packages/${encodeURIComponent(documentPackageId)}/documents`,
        { expectedVersion, evidence },
        { 'Idempotency-Key': idempotencyKey }
      );
    },
    appendInstruction(documentPackageId, expectedVersion, instruction, idempotencyKey) {
      return api.post<DurableDocumentPackageView>(
        `/api/markreg/document-packages/${encodeURIComponent(documentPackageId)}/instructions`,
        { expectedVersion, instruction },
        { 'Idempotency-Key': idempotencyKey }
      );
    },
    markReady(documentPackageId, expectedVersion, idempotencyKey) {
      return api.post<DurableDocumentPackageView>(
        `/api/markreg/document-packages/${encodeURIComponent(documentPackageId)}/mark-ready`,
        { expectedVersion },
        { 'Idempotency-Key': idempotencyKey }
      );
    }
  };
}
