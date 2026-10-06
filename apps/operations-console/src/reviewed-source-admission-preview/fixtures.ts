import type { ReviewedSourceAdmissionResult } from '../lifecycle.js';
import type {
  AdmissionDecision,
  FormalMatterAdmissionTarget,
  ReviewedSourceAdmissionClient,
  ReviewedSourceAdmissionState
} from '../reviewed-source-admission/ReviewedSourceAdmissionWorkspace.js';

export type AdmissionPreviewScenario =
  | 'ready'
  | 'loading'
  | 'empty'
  | 'unauthorized'
  | 'unavailable'
  | 'error'
  | 'partial'
  | 'nonadmissible'
  | 'permission'
  | 'decision-conflict'
  | 'matter-conflict';

export const previewDecision: AdmissionDecision = {
  evidenceReviewDecisionId: 'evidence-review-decision_preview-51920',
  version: 1,
  decisionFingerprintSha256: 'd'.repeat(64),
  outcome: 'ADMITTED_FOR_INTERNAL_USE',
  rationale: 'The exact receipt and supplied references support bounded internal use.',
  reviewedAt: '2026-10-06T09:05:00.000Z',
  reviewerLabel: 'Riley Morgan · verified Principal',
  source: {
    evidenceReceipt: { id: 'evidence-receipt_preview-51920', version: 1 },
    evidenceReceiptFingerprintSha256: 'e'.repeat(64),
    evidenceHandoffId: 'evidence-handoff_preview-51920',
    providerReturn: { id: 'provider-return_preview-51920', version: 2 },
    correlationId: 'correlation_reviewed-source-preview-51920'
  },
  evidenceReferences: [
    { kind: 'DOCUMENT', reference: 'evidence://madrid-designation/submission-copy-v2' },
    { kind: 'RECEIPT', reference: 'evidence://provider-dispatch/atlas-51920' }
  ]
};

export const previewTargets: readonly FormalMatterAdmissionTarget[] = [
  {
    id: 'formal-matter_preview-51920',
    version: 7,
    title: 'ATLAS · Madrid designation',
    jurisdiction: 'WIPO / EU designation',
    ownerLabel: 'Atlas Labs Pte. Ltd.',
    updatedAt: '2026-10-06T08:55:00.000Z'
  },
  {
    id: 'formal-matter_preview-51921',
    version: 3,
    title: 'ATLAS · UK renewal',
    jurisdiction: 'United Kingdom',
    ownerLabel: 'Atlas Labs Pte. Ltd.',
    updatedAt: '2026-10-05T15:20:00.000Z'
  }
];

export function stateForScenario(scenario: AdmissionPreviewScenario): ReviewedSourceAdmissionState {
  if (
    scenario === 'ready' ||
    scenario === 'nonadmissible' ||
    scenario === 'permission' ||
    scenario === 'decision-conflict' ||
    scenario === 'matter-conflict'
  )
    return 'ready';
  return scenario;
}

export function decisionForScenario(
  scenario: AdmissionPreviewScenario
): AdmissionDecision | undefined {
  if (scenario === 'empty') return undefined;
  if (scenario === 'nonadmissible') {
    return {
      ...previewDecision,
      evidenceReviewDecisionId: 'evidence-review-decision_preview-51921',
      outcome: 'CORRECTION_REQUIRED',
      rationale: 'The Provider Return must be corrected before admission.'
    };
  }
  return previewDecision;
}

export function clientForScenario(
  scenario: AdmissionPreviewScenario
): ReviewedSourceAdmissionClient {
  return {
    admit(input) {
      if (scenario === 'permission') {
        return Promise.reject(
          new Error('Admission permission denied. Current Principal lacks review:perform.')
        );
      }
      if (scenario === 'decision-conflict') {
        return Promise.reject(
          new Error('Evidence Review Decision changed. Refresh the exact decision version.')
        );
      }
      if (scenario === 'matter-conflict') {
        return Promise.reject(
          new Error('Formal Matter version changed. Refresh the exact MarkReg target.')
        );
      }
      const result: ReviewedSourceAdmissionResult = {
        admission: {
          reviewedSourceAdmissionId: 'reviewed-source-admission_preview-51920',
          version: 1,
          admissionFingerprintSha256: 'a'.repeat(64),
          formalMatter: {
            id: input.formalMatterId,
            version: input.expectedFormalMatterVersion
          },
          correlationId: input.decision.source.correlationId
        }
      };
      return Promise.resolve(structuredClone(result));
    }
  };
}
