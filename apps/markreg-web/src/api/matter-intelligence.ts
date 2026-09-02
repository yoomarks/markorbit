import { createApiClient, type ApiClient } from './client.js';

export type MatterIntelligenceReviewOutcome = 'CONFIRMED' | 'OVERRIDDEN' | 'INCONCLUSIVE';

export interface MatterIntelligenceReview {
  matterIntelligenceReviewId: string;
  reviewVersion: number;
  outcome: MatterIntelligenceReviewOutcome;
  reason?: string;
  rationale?: string;
  reviewedByPrincipalId: string;
  reviewedAt: string;
  supersedes?: Readonly<{
    reviewId: string;
    reviewVersion: number;
  }>;
}

export interface MatterIntelligenceObservation {
  matterIntelligenceObservationId: string;
  formalMatter: Readonly<{
    id: string;
    version: number;
    snapshotSha256: string;
  }>;
  observationKind: string;
  observedCompletedDurationDays: number;
  historicalBand: string;
  datasetRefId: string;
  capability: Readonly<{
    id: string;
    version: string;
    inputSchemaId: string;
    outputSchemaId: string;
  }>;
  capabilityRequestId: string;
  capabilityInvocationId: string;
  capabilityOutcomeId: string;
  capabilityReturnId: string;
  sessionReceiptId: string;
  implementation: Readonly<{
    id: string;
    version: number;
    implementationKey: string;
  }>;
  methodPackageRef: string;
  methodRef: string;
  methodVersionRef: string;
  evaluationRef: string;
  researchDatasetRef: string;
  evidenceRefs: readonly string[];
  evidenceFingerprintSha256: string;
  inputFingerprintSha256: string;
  outputFingerprintSha256: string;
  recordedByPrincipalId: string;
  recordedAt: string;
}

export interface MatterIntelligenceReadItem {
  observation: MatterIntelligenceObservation;
  matterSourceCurrent: boolean;
  currentReview: MatterIntelligenceReview | null;
  reviewHistory: readonly MatterIntelligenceReview[];
  reviewHistoryTotal: number;
  reviewHistoryComplete: boolean;
  reviewState: 'UNREVIEWED' | 'REVIEWED';
}

export interface MatterIntelligenceProjection {
  formalMatter: Readonly<{
    id: string;
    version: number;
    snapshotSha256: string;
  }>;
  items: readonly MatterIntelligenceReadItem[];
  page: number;
  pageSize: number;
  total: number;
  reviewHistoryLimit: number;
  semantics: Readonly<{
    descriptiveHistoricalEvidence: true;
    prediction: false;
    deadline: false;
    serviceLevelAgreement: false;
    officialStatus: false;
  }>;
  authorityConsequences: Readonly<{
    officialTruthCreated: false;
    lifecycleStateMutated: false;
    formalMatterMutated: false;
    filingAuthorized: false;
    paymentAuthorized: false;
    externalActionExecuted: false;
  }>;
}

export interface MatterIntelligenceQuery {
  page?: number;
  pageSize?: number;
  reviewHistoryLimit?: number;
}

export interface MatterIntelligenceClient {
  get(formalMatterId: string, query?: MatterIntelligenceQuery): Promise<MatterIntelligenceProjection>;
}

export function createMatterIntelligenceClient(
  api: ApiClient = createApiClient()
): MatterIntelligenceClient {
  return {
    get(formalMatterId, query = {}) {
      const search = new URLSearchParams({
        page: String(query.page ?? 1),
        pageSize: String(query.pageSize ?? 10),
        reviewHistoryLimit: String(query.reviewHistoryLimit ?? 5)
      });
      return api.get(
        `/api/markreg/formal-matters/${encodeURIComponent(formalMatterId)}/intelligence?${search.toString()}`
      );
    }
  };
}
