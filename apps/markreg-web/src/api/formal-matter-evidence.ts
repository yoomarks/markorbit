import { createApiClient, type ApiClient } from './client.js';
import type { MatterIntelligenceProjection } from './matter-intelligence.js';

export interface FormalMatterEvidenceDocumentItem {
  documentItemId: string;
  requirementKey: string;
  documentType: string;
  displayName: string;
  evidenceType: string;
  originalFileName?: string;
  mediaType?: string;
  sizeBytes?: number;
  evidenceSha256: string;
  storageReference?: string;
  verificationStatus: string;
  structuredNote?: Readonly<Record<string, unknown>>;
  createdAt: string;
  updatedAt: string;
}

export interface FormalMatterEvidenceDocumentPackage {
  documentPackageId: string;
  status: string;
  version: number | string;
  schemaVersion: number | string;
  sourceFormalMatterVersion: number | string;
  sourceFormalMatterSha256: string;
  matterSourceCurrent: boolean;
  professionalReviewCaseId: string;
  sourceReviewVersion: number | string;
  sourceCompletedDecisionId: string;
  sourceCompletedDecisionSha256: string;
  canonicalEvidenceSha256?: string;
  documentEvidence: readonly FormalMatterEvidenceDocumentItem[];
  documentEvidenceTotal: number;
  documentEvidenceTruncated: boolean;
  createdAt: string;
  updatedAt: string;
  readyAt?: string;
}

export interface FormalMatterEvidenceLifecycleCurrent {
  lifecycleViewId: string;
  version: number | string;
  formalMatter: Readonly<{ id: string; version: number | string }>;
  matterSourceCurrent: boolean;
  currentEvent: unknown;
  currentEventFingerprintSha256: string;
  state: string;
  customerSafeLabel: string;
  customerSafeSummary: string;
  lifecycleViewFingerprintSha256: string;
  officialStatusVerified: false;
  updatedAt: string;
}

export interface FormalMatterEvidenceLifecycleEvent {
  lifecycleEventId: string;
  version: number | string;
  formalMatter: Readonly<{ id: string; version: number | string }>;
  matterSourceCurrent: boolean;
  source: unknown;
  state: string;
  eventCode: string;
  customerSafeLabel: string;
  customerSafeSummary: string;
  occurredAt: string;
  projectedAt: string;
  lifecycleEventFingerprintSha256: string;
  officialStatusVerified: false;
}

export interface FormalMatterEvidenceProjection {
  schemaVersion: 1;
  workspaceId: string;
  formalMatter: Readonly<{
    formalMatterId: string;
    kind: string;
    status: string;
    version: number | string;
    snapshotSchemaVersion: number | string;
    snapshotSha256: string;
    sourceCustomerConfirmationId: string;
    sourceCustomerConfirmationVersion: number | string;
    sourceMatterDraftId: string;
    sourceMatterDraftVersion: number | string;
    sourceQuoteId: string;
    sourceQuoteVersion: number | string;
    createdAt: string;
    updatedAt: string;
  }>;
  documentPackages: Readonly<{
    items: readonly FormalMatterEvidenceDocumentPackage[];
    returned: number;
    total: number;
    truncated: boolean;
    limit: number;
  }>;
  lifecycle: Readonly<{
    current: FormalMatterEvidenceLifecycleCurrent | null;
    events: readonly FormalMatterEvidenceLifecycleEvent[];
    total: number;
    truncated: boolean;
    limit: number;
    officialStatusVerified: false;
  }>;
  intelligence: MatterIntelligenceProjection;
  semantics: Readonly<{
    workspaceScoped: true;
    readOnly: true;
    recomputed: false;
    reviewedEvidenceIsOfficialTruth: false;
    providerReturnIsOfficialTruth: false;
    lifecycleProjectionIsOfficialStatus: false;
    matterIntelligenceIsOfficialTruth: false;
    preparationLockIncluded: false;
  }>;
  authorityConsequences: Readonly<{
    formalMatterMutated: false;
    lifecycleMutated: false;
    evidenceCreatedOrCertified: false;
    recommendationAuthorized: false;
    paymentCreated: false;
    invoiceCreated: false;
    filingAuthorized: false;
    filingSubmitted: false;
    providerContacted: false;
    officialTruthCreated: false;
  }>;
}

export interface FormalMatterEvidenceQuery {
  page?: number;
  pageSize?: number;
  reviewHistoryLimit?: number;
}

export interface FormalMatterEvidenceClient {
  get(
    formalMatterId: string,
    query?: FormalMatterEvidenceQuery
  ): Promise<FormalMatterEvidenceProjection>;
}

export function createFormalMatterEvidenceClient(
  api: ApiClient = createApiClient()
): FormalMatterEvidenceClient {
  return {
    get(formalMatterId, query = {}) {
      const search = new URLSearchParams({
        page: String(query.page ?? 1),
        pageSize: String(query.pageSize ?? 10),
        reviewHistoryLimit: String(query.reviewHistoryLimit ?? 5)
      });
      return api.get(
        `/api/markreg/formal-matters/${encodeURIComponent(formalMatterId)}/evidence?${search.toString()}`
      );
    }
  };
}
