export interface OperationsReviewSource {
  admission: {
    reviewedSourceAdmissionId: string;
    admissionFingerprintSha256?: string;
    reviewDecision?: { id: string; version: number };
    evidenceSource?: {
      evidenceReceipt?: { id: string; version: number };
      providerReturn?: { id: string; version: number };
    };
    admittedEvidenceReferences?: readonly string[];
  };
  reviewDecision: {
    evidenceReviewDecisionId: string;
    outcome?: string;
    rationale?: string;
    decisionFingerprintSha256?: string;
    correctionReasons?: readonly {
      code: string;
      message: string;
      evidenceReferences: readonly string[];
    }[];
  };
  correctionRequest: {
    correctionRequestId: string;
    status: string;
    reasons: readonly { code: string; message: string; evidenceReferences: readonly string[] }[];
  } | null;
  handoff: {
    status: string;
    attemptCount: number;
    deliveryIdempotencyKey?: string;
    markRegIdempotencyKey?: string;
    lastErrorCode?: string;
  } | null;
}

export interface OperationsLifecycleProvenance {
  currentView: {
    lifecycleViewId: string;
    state: string;
    customerSafeLabel: string;
    lifecycleViewFingerprintSha256?: string;
  } | null;
  events: readonly {
    lifecycleEventId: string;
    state: string;
    eventCode: string;
    occurredAt: string;
  }[];
  recommendedAction: { recommendedActionId: string; status: string; policyVersion: string } | null;
  reviewSources: readonly OperationsReviewSource[];
}

export interface EvidenceReviewQueueItem {
  receipt: {
    evidenceHandoff: {
      evidenceHandoffId: string;
      providerReturn: { id: string; version: number };
      providerReturnFingerprintSha256: string;
      correlationId: string;
    };
    providerId: string;
    providerWorkspaceId: string;
    workStatusClaim: string;
    reviewStatus: 'PENDING_REVIEW';
    receivedAt: string;
  };
  source?: {
    evidenceReceipt: { id: string; version: number };
    evidenceReceiptFingerprintSha256: string;
    evidenceHandoffId: string;
    correlationId: string;
  };
}

export interface CapturedEvidenceReviewSource {
  evidenceReceipt: { id: string; version: number };
  evidenceReceiptFingerprintSha256: string;
  evidenceHandoffId: string;
  providerReturn: { id: string; version: number };
  correlationId: string;
}

export interface EvidenceReviewDecisionResult {
  decision: {
    evidenceReviewDecisionId: string;
    version: number;
    decisionFingerprintSha256: string;
    outcome: 'ADMITTED_FOR_INTERNAL_USE' | 'CORRECTION_REQUIRED' | 'REJECTED';
    rationale: string;
    source: CapturedEvidenceReviewSource;
  };
  correctionRequest: {
    correctionRequestId: string;
    status: string;
  } | null;
}

export interface ReviewedSourceAdmissionResult {
  admission: {
    reviewedSourceAdmissionId: string;
    version: number;
    admissionFingerprintSha256: string;
    formalMatter: { id: string; version: number | string };
    correlationId: string;
  };
}

export interface ReviewedSourceDeliveryResult {
  result: {
    event: { lifecycleEventId: string; state: string; officialStatusVerified: false };
    currentView: {
      lifecycleViewId: string;
      version: number;
      lifecycleViewFingerprintSha256: string;
      state: string;
      officialStatusVerified: false;
    };
  };
}

type ErrorBody = { message?: string };

function baseUrl() {
  return (
    (import.meta.env['VITE_MARKREG_GATEWAY_URL'] as string | undefined) ?? 'http://127.0.0.1:4000'
  );
}

function workspaceId() {
  const value = sessionStorage.getItem('markorbit-workspace-id');
  if (!value) throw new Error('Select a Workspace before using Operations review.');
  return value;
}

function mutationHeaders(idempotencyKey?: string) {
  const csrf = sessionStorage.getItem('markorbit-csrf-token');
  if (!csrf) throw new Error('Refresh your authenticated session before changing review state.');
  return {
    'Content-Type': 'application/json',
    'X-MarkOrbit-Workspace-Id': workspaceId(),
    'X-MarkOrbit-CSRF-Token': csrf,
    ...(idempotencyKey
      ? {
          'Idempotency-Key': idempotencyKey,
          'X-Correlation-ID': idempotencyKey
        }
      : {})
  };
}

function operationKey(prefix: string) {
  return `${prefix}:${globalThis.crypto.randomUUID()}`;
}

async function parse<T>(response: Response, fallback: string): Promise<T> {
  const body = (await response.json()) as T & ErrorBody;
  if (!response.ok) throw new Error(body.message ?? fallback);
  return body;
}

export async function loadOperationsLifecycle(
  formalMatterId: string,
  fetcher: typeof fetch = fetch
): Promise<OperationsLifecycleProvenance> {
  const response = await fetcher(
    `${baseUrl()}/api/operations/formal-matters/${encodeURIComponent(formalMatterId)}/lifecycle-provenance`,
    {
      credentials: 'include',
      headers: { 'X-MarkOrbit-Workspace-Id': workspaceId() }
    }
  );
  return parse(response, 'Lifecycle provenance is unavailable.');
}

export async function loadEvidenceReviewQueue(
  fetcher: typeof fetch = fetch
): Promise<readonly EvidenceReviewQueueItem[]> {
  const response = await fetcher(`${baseUrl()}/api/operations/evidence-review/queue`, {
    credentials: 'include',
    headers: { 'X-MarkOrbit-Workspace-Id': workspaceId() }
  });
  const body = await parse<{ items: readonly EvidenceReviewQueueItem[] }>(
    response,
    'Evidence review queue is unavailable.'
  );
  return body.items;
}

export async function captureEvidenceReviewSource(
  evidenceHandoffId: string,
  fetcher: typeof fetch = fetch
): Promise<CapturedEvidenceReviewSource> {
  const response = await fetcher(`${baseUrl()}/api/operations/evidence-review/sources/capture`, {
    method: 'POST',
    credentials: 'include',
    headers: mutationHeaders(),
    body: JSON.stringify({ evidenceHandoffId })
  });
  const body = await parse<{ source: CapturedEvidenceReviewSource }>(
    response,
    'Evidence review source could not be captured.'
  );
  return body.source;
}

export async function recordEvidenceReviewDecision(
  input: {
    source: CapturedEvidenceReviewSource;
    outcome: 'ADMITTED_FOR_INTERNAL_USE' | 'CORRECTION_REQUIRED' | 'REJECTED';
    rationale: string;
    correctionReason?: string;
  },
  fetcher: typeof fetch = fetch
): Promise<EvidenceReviewDecisionResult> {
  const key = operationKey('operations-evidence-review');
  const correctionReasons =
    input.outcome === 'CORRECTION_REQUIRED'
      ? [
          {
            code: 'PROVIDER_EVIDENCE_CORRECTION_REQUIRED',
            message: input.correctionReason?.trim() || 'Provider evidence requires correction.',
            evidenceReferences: [input.source.evidenceHandoffId]
          }
        ]
      : [];
  const response = await fetcher(`${baseUrl()}/api/operations/evidence-review/decisions`, {
    method: 'POST',
    credentials: 'include',
    headers: mutationHeaders(key),
    body: JSON.stringify({
      evidenceReceiptId: input.source.evidenceReceipt.id,
      expectedEvidenceReceiptVersion: input.source.evidenceReceipt.version,
      expectedEvidenceReceiptFingerprintSha256: input.source.evidenceReceiptFingerprintSha256,
      outcome: input.outcome,
      rationale: input.rationale,
      correctionReasons
    })
  });
  return parse(response, 'Evidence review decision could not be recorded.');
}

export async function admitReviewedSource(
  input: {
    decision: EvidenceReviewDecisionResult['decision'];
    formalMatterId: string;
    expectedFormalMatterVersion: number | string;
    admittedEvidenceReferences: readonly string[];
  },
  fetcher: typeof fetch = fetch
): Promise<ReviewedSourceAdmissionResult> {
  const key = operationKey('operations-reviewed-source-admission');
  const response = await fetcher(`${baseUrl()}/api/operations/reviewed-source-admissions`, {
    method: 'POST',
    credentials: 'include',
    headers: mutationHeaders(key),
    body: JSON.stringify({
      evidenceReviewDecisionId: input.decision.evidenceReviewDecisionId,
      expectedEvidenceReviewDecisionVersion: input.decision.version,
      expectedEvidenceReviewDecisionFingerprintSha256: input.decision.decisionFingerprintSha256,
      formalMatterId: input.formalMatterId,
      expectedFormalMatterVersion: input.expectedFormalMatterVersion,
      admittedEvidenceReferences: input.admittedEvidenceReferences
    })
  });
  return parse(response, 'Reviewed source could not be admitted.');
}

export async function deliverReviewedSource(
  input: {
    admission: ReviewedSourceAdmissionResult['admission'];
    state:
      | 'INTERNAL_PROCESSING'
      | 'REVIEWED_PROVIDER_EVIDENCE'
      | 'CUSTOMER_ACTION_NEEDED'
      | 'WAITING_NO_ACTION'
      | 'CORRECTION_OR_REVIEW_ISSUE';
    eventCode: string;
    customerSafeLabel: string;
    customerSafeSummary: string;
  },
  fetcher: typeof fetch = fetch
): Promise<ReviewedSourceDeliveryResult> {
  const key = operationKey('operations-reviewed-source-delivery');
  const response = await fetcher(`${baseUrl()}/api/operations/reviewed-source-handoffs/deliver`, {
    method: 'POST',
    credentials: 'include',
    headers: mutationHeaders(key),
    body: JSON.stringify({
      reviewedSourceAdmissionId: input.admission.reviewedSourceAdmissionId,
      expectedReviewedSourceAdmissionVersion: input.admission.version,
      expectedAdmissionFingerprintSha256: input.admission.admissionFingerprintSha256,
      formalMatterId: input.admission.formalMatter.id,
      expectedFormalMatterVersion: input.admission.formalMatter.version,
      state: input.state,
      eventCode: input.eventCode,
      customerSafeLabel: input.customerSafeLabel,
      customerSafeSummary: input.customerSafeSummary,
      occurredAt: new Date().toISOString()
    })
  });
  return parse(response, 'Reviewed source lifecycle projection could not be delivered.');
}
