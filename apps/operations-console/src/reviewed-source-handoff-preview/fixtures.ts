import type {
  HandoffOutcome,
  HandoffWorkspaceState,
  ReviewedSourceHandoffClient,
  ReviewedSourceHandoffSource
} from '../reviewed-source-handoff/ReviewedSourceHandoffWorkspace.js';

export type HandoffPreviewScenario =
  | 'ready'
  | 'loading'
  | 'empty'
  | 'unauthorized'
  | 'unavailable'
  | 'error'
  | 'partial'
  | 'dependency-unavailable'
  | 'permission'
  | 'stale-admission'
  | 'idempotency-conflict'
  | 'delivered';

export const previewSource: ReviewedSourceHandoffSource = {
  admission: {
    reviewedSourceAdmissionId: 'reviewed-source-admission_preview-51930',
    version: 1,
    admissionFingerprintSha256: 'a'.repeat(64),
    formalMatter: { id: 'formal-matter_preview-51930', version: 7 },
    correlationId: 'correlation_reviewed-source-preview-51930'
  },
  admittedAt: '2026-10-06T09:14:00.000Z',
  decision: {
    id: 'evidence-review-decision_preview-51930',
    version: 1,
    fingerprint: 'd'.repeat(64)
  },
  evidenceReceipt: { id: 'evidence-receipt_preview-51930', version: 1 },
  providerReturn: { id: 'provider-return_preview-51930', version: 2 },
  admittedEvidenceReferences: [
    'evidence://madrid-designation/submission-copy-v2',
    'evidence://provider-dispatch/atlas-51930'
  ],
  formalMatterTitle: 'ATLAS · Madrid designation',
  jurisdiction: 'WIPO / EU designation'
};

const deliveryKey = 'operations-reviewed-source-delivery:preview-51930';
const markRegKey = 'reviewed-source-projection:reviewed-source-admission_preview-51930:aaaaaaaa';

export function deliveredOutcome(attemptCount = 1): HandoffOutcome {
  return {
    status: 'DELIVERED',
    attemptCount,
    deliveryIdempotencyKey: deliveryKey,
    markRegIdempotencyKey: markRegKey,
    deliveredAt: '2026-10-06T09:18:00.000Z',
    result: {
      event: {
        lifecycleEventId: 'lifecycle-event_preview-51930',
        state: 'REVIEWED_PROVIDER_EVIDENCE',
        officialStatusVerified: false
      },
      currentView: {
        lifecycleViewId: 'lifecycle-view_preview-51930',
        version: 1,
        lifecycleViewFingerprintSha256: 'v'.repeat(64),
        state: 'REVIEWED_PROVIDER_EVIDENCE',
        officialStatusVerified: false
      }
    }
  };
}

export const pendingOutcome: HandoffOutcome = {
  status: 'PENDING',
  attemptCount: 1,
  deliveryIdempotencyKey: deliveryKey,
  markRegIdempotencyKey: markRegKey,
  lastErrorCode: 'DEPENDENCY_UNAVAILABLE',
  retryable: true
};

export function stateForScenario(scenario: HandoffPreviewScenario): HandoffWorkspaceState {
  if (
    [
      'ready',
      'dependency-unavailable',
      'permission',
      'stale-admission',
      'idempotency-conflict',
      'delivered'
    ].includes(scenario)
  )
    return 'ready';
  return scenario as HandoffWorkspaceState;
}

export function sourceForScenario(scenario: HandoffPreviewScenario) {
  return scenario === 'empty' ? undefined : previewSource;
}

export function initialOutcomeForScenario(scenario: HandoffPreviewScenario) {
  return scenario === 'delivered' ? deliveredOutcome() : undefined;
}

export function clientForScenario(scenario: HandoffPreviewScenario): ReviewedSourceHandoffClient {
  let attempts = 0;
  return {
    deliver() {
      attempts += 1;
      if (scenario === 'permission')
        return Promise.reject(
          new Error('Handoff permission denied. Current Principal lacks review:perform.')
        );
      if (scenario === 'stale-admission')
        return Promise.reject(
          new Error(
            'Reviewed Source Admission changed. Refresh the exact source version and fingerprint.'
          )
        );
      if (scenario === 'idempotency-conflict')
        return Promise.reject(
          new Error('Idempotency conflict. This delivery key is bound to a different request.')
        );
      if (scenario === 'dependency-unavailable' && attempts === 1)
        return Promise.resolve(structuredClone(pendingOutcome));
      return Promise.resolve(structuredClone(deliveredOutcome(attempts)));
    }
  };
}
