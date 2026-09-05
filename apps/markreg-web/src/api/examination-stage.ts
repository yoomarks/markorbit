import { createApiClient, type ApiClient } from './client.js';

export type ExaminationWorkflowState =
  | 'INTERNAL_PROCESSING'
  | 'REVIEWED_PROVIDER_EVIDENCE'
  | 'WAITING_NO_ACTION'
  | 'CUSTOMER_ACTION_NEEDED'
  | 'CORRECTION_OR_REVIEW_ISSUE';

export type ExaminationEventCode =
  | 'EXAMINATION_INTERNAL_PROCESSING'
  | 'EXAMINATION_REVIEWED_EVIDENCE'
  | 'EXAMINATION_WAITING_NO_ACTION'
  | 'EXAMINATION_CUSTOMER_ACTION_NEEDED'
  | 'EXAMINATION_CORRECTION_OR_REVIEW_ISSUE';

export interface ExaminationStageSource {
  reviewedSourceAdmission: Readonly<{
    id: string;
    version: number | string;
    fingerprintSha256: string;
  }>;
  evidenceReviewDecision: Readonly<{ id: string; version: number | string }>;
  evidenceReceipt: Readonly<{ id: string; version: number | string }>;
  providerReturn: Readonly<{ id: string; version: number | string }>;
  formalMatter: Readonly<{ id: string; version: number | string }>;
}

export interface ExaminationStageHistoryEntry {
  lifecycleEvent: Readonly<{
    id: string;
    version: number;
    fingerprintSha256: string;
  }>;
  workflowState: ExaminationWorkflowState;
  eventCode: ExaminationEventCode;
  customerSafeLabel: string;
  customerSafeSummary: string;
  sourceClass: 'REVIEWED_EXTERNAL_EVIDENCE';
  projectionClass: 'INTERNAL_PRODUCT_PROJECTION';
  sourceCurrentness: 'HISTORICAL';
  source: ExaminationStageSource;
  occurredAt: string;
  projectedAt: string;
  officialStatusVerified: false;
}

export interface ExaminationStageCurrentEntry extends Omit<
  ExaminationStageHistoryEntry,
  'sourceCurrentness'
> {
  lifecycleView: Readonly<{
    id: string;
    version: number;
    fingerprintSha256: string;
  }>;
  sourceCurrentness: 'CURRENT';
}

export interface ExaminationStageProjection {
  schemaVersion: 1;
  workspaceId: string;
  formalMatter: Readonly<{ id: string; version: number | string }>;
  status: 'ESTABLISHED' | 'NOT_ESTABLISHED';
  current: ExaminationStageCurrentEntry | null;
  history: readonly ExaminationStageHistoryEntry[];
  deadline: null;
  deadlineStatus: 'UNAVAILABLE';
  officialStatusVerified: false;
  authorityConsequences: Readonly<{
    protectedActionAuthorized: false;
    filingAuthorized: false;
    filingSubmitted: false;
    paymentCreated: false;
    providerContacted: false;
    officeMutationCreated: false;
    officialTruthCreated: false;
  }>;
}

interface ExaminationStageEnvelope {
  examination: ExaminationStageProjection;
}

export interface ExaminationStageClient {
  get(formalMatterId: string): Promise<ExaminationStageProjection>;
}

export function createExaminationStageClient(
  api: ApiClient = createApiClient()
): ExaminationStageClient {
  return {
    async get(formalMatterId) {
      const response = await api.get<ExaminationStageEnvelope>(
        `/api/markreg/formal-matters/${encodeURIComponent(formalMatterId)}/examination`
      );
      return response.examination;
    }
  };
}
