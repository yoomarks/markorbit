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

export async function loadOperationsLifecycle(
  formalMatterId: string,
  fetcher: typeof fetch = fetch
): Promise<OperationsLifecycleProvenance> {
  const workspaceId = sessionStorage.getItem('markorbit-workspace-id');
  if (!workspaceId) throw new Error('Select a Workspace before inspecting lifecycle provenance.');
  const baseUrl =
    (import.meta.env['VITE_MARKREG_GATEWAY_URL'] as string | undefined) ?? 'http://127.0.0.1:4000';
  const response = await fetcher(
    `${baseUrl}/api/operations/formal-matters/${encodeURIComponent(formalMatterId)}/lifecycle-provenance`,
    {
      credentials: 'include',
      headers: { 'X-MarkOrbit-Workspace-Id': workspaceId }
    }
  );
  const body = (await response.json()) as OperationsLifecycleProvenance & {
    message?: string;
  };
  if (!response.ok) throw new Error(body.message ?? 'Lifecycle provenance is unavailable.');
  return body;
}
