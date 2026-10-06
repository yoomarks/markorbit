import type { CapturedEvidenceReviewSource, EvidenceReviewDecisionResult } from '../lifecycle.js';
import type {
  EvidenceReviewWorkspaceClient,
  EvidenceReviewWorkspaceItem,
  EvidenceReviewWorkspaceState
} from '../evidence-review/ExecutionEvidenceReviewWorkspace.js';

export type EvidenceReviewPreviewScenario =
  | 'queue'
  | 'loading'
  | 'empty'
  | 'unauthorized'
  | 'unavailable'
  | 'error'
  | 'partial'
  | 'permission'
  | 'conflict';

function source(index: number): CapturedEvidenceReviewSource {
  const suffix = String(51910 + index);
  return {
    evidenceReceipt: { id: `evidence-receipt_preview-${suffix}`, version: 1 },
    evidenceReceiptFingerprintSha256: String(index + 3).repeat(64),
    evidenceHandoffId: `evidence-handoff_preview-${suffix}`,
    providerReturn: { id: `provider-return_preview-${suffix}`, version: index === 2 ? 2 : 1 },
    correlationId: `correlation_evidence-review-preview-${suffix}`
  };
}

function item(
  index: number,
  input: {
    claim: string;
    artifacts?: EvidenceReviewWorkspaceItem['receipt']['artifacts'];
    assertions?: EvidenceReviewWorkspaceItem['receipt']['assertions'];
    captured?: boolean;
  }
): EvidenceReviewWorkspaceItem {
  const suffix = String(51910 + index);
  return {
    receipt: {
      evidenceHandoff: {
        evidenceHandoffId: `evidence-handoff_preview-${suffix}`,
        providerReturn: { id: `provider-return_preview-${suffix}`, version: index === 2 ? 2 : 1 },
        providerReturnFingerprintSha256: String(index + 6).repeat(64),
        correlationId: `correlation_evidence-review-preview-${suffix}`
      },
      providerId: `provider_atlas-${suffix}`,
      providerWorkspaceId: `018f0000-0000-7000-8000-00000000${suffix.slice(-4)}`,
      workStatusClaim: input.claim,
      reviewStatus: 'PENDING_REVIEW',
      receivedAt: `2026-10-06T0${8 - index}:24:00.000Z`,
      ...(input.artifacts ? { artifacts: input.artifacts } : {}),
      ...(input.assertions ? { assertions: input.assertions } : {})
    },
    ...(input.captured ? { source: source(index) } : {}),
    evidenceAvailability: 'COMPLETE'
  };
}

export const previewItems: readonly EvidenceReviewWorkspaceItem[] = [
  item(0, {
    claim: 'WORK_COMPLETED',
    artifacts: [
      { kind: 'DOCUMENT', reference: 'evidence://madrid-designation/submission-copy' },
      { kind: 'RECEIPT', reference: 'evidence://provider-dispatch/atlas-51910' }
    ]
  }),
  item(1, {
    claim: 'CORRECTION_PREPARED',
    artifacts: [{ kind: 'DOCUMENT', reference: 'evidence://uk-renewal/corrected-instruction' }],
    assertions: [{ code: 'CLASS_SCOPE_CONFIRMED', value: 'Classes 9 and 42 checked' }],
    captured: true
  }),
  item(2, {
    claim: 'WORK_PARTIALLY_COMPLETED',
    artifacts: [{ kind: 'DOCUMENT', reference: 'evidence://au-classification/provider-note-v2' }]
  })
];

export function previewState(
  scenario: EvidenceReviewPreviewScenario
): EvidenceReviewWorkspaceState {
  if (
    scenario === 'queue' ||
    scenario === 'partial' ||
    scenario === 'permission' ||
    scenario === 'conflict'
  )
    return 'ready';
  return scenario;
}

export function itemsForScenario(
  scenario: EvidenceReviewPreviewScenario
): readonly EvidenceReviewWorkspaceItem[] {
  if (scenario === 'empty') return [];
  if (scenario === 'partial') {
    const [first, ...rest] = previewItems;
    return first ? [{ ...first, evidenceAvailability: 'PARTIAL' }, ...rest] : [];
  }
  return previewItems;
}

export function clientForScenario(
  scenario: EvidenceReviewPreviewScenario
): EvidenceReviewWorkspaceClient {
  return {
    capture(evidenceHandoffId) {
      const index = previewItems.findIndex(
        (entry) => entry.receipt.evidenceHandoff.evidenceHandoffId === evidenceHandoffId
      );
      if (index < 0) return Promise.reject(new Error('Evidence receipt is no longer available.'));
      return Promise.resolve(structuredClone(source(index)));
    },
    decide(input) {
      if (scenario === 'permission') {
        return Promise.reject(
          new Error('Review decision permission denied. Current Principal lacks review:perform.')
        );
      }
      if (scenario === 'conflict') {
        return Promise.reject(
          new Error('Evidence receipt changed before decision. Refresh exact owner truth.')
        );
      }
      const suffix = input.source.evidenceReceipt.id.split('-').at(-1) ?? '51910';
      const result: EvidenceReviewDecisionResult = {
        decision: {
          evidenceReviewDecisionId: `evidence-review-decision_preview-${suffix}`,
          version: 1,
          decisionFingerprintSha256: 'a'.repeat(64),
          outcome: input.outcome,
          rationale: input.rationale,
          source: input.source
        },
        correctionRequest:
          input.outcome === 'CORRECTION_REQUIRED'
            ? {
                correctionRequestId: `correction-request_preview-${suffix}`,
                status: 'OPEN'
              }
            : null
      };
      return Promise.resolve(structuredClone(result));
    }
  };
}
