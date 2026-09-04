import { createApiClient, type ApiClient } from './client.js';

export interface DurablePreparationInstructionSource {
  instructionEntryId: string;
  sequence: number;
  canonicalFingerprint: string;
}

export interface DurablePreparationLockView {
  schemaVersion: 1;
  preparationLockId: `preparation-lock_${string}`;
  workspaceId: string;
  version: 1;
  source: Readonly<{
    documentPackageId: `document-package_${string}`;
    documentPackageVersion: number;
    canonicalEvidenceHash: string;
    formalMatterId: `formal-matter_${string}`;
    formalMatterVersion: number;
    formalMatterHash: string;
    professionalReviewCaseId: `professional-review_${string}`;
    reviewVersion: number;
    completedDecisionId: string;
    completedDecisionHash: string;
    instructionEntryCount: number;
    instructionEntries: readonly Readonly<DurablePreparationInstructionSource>[];
    instructionSetHash: string;
  }>;
  lockPayloadHash: string;
  createdBy: string;
  createdAt: string;
  authority: Readonly<{
    filingAuthorizationCreated: false;
    executionReleaseCreated: false;
    externalFilingCreated: false;
    paymentCreated: false;
    providerContacted: false;
    officialTruthCreated: false;
  }>;
}

export interface DurablePreparationClient {
  create(command: {
    documentPackageId: string;
    expectedDocumentPackageVersion: number;
    expectedCanonicalEvidenceHash: string;
    idempotencyKey: string;
    correlationId?: string;
  }): Promise<DurablePreparationLockView>;
  get(preparationLockId: string): Promise<DurablePreparationLockView>;
  validateCurrent(preparationLockId: string): Promise<DurablePreparationLockView>;
}

export function createDurablePreparationClient(
  api: ApiClient = createApiClient()
): DurablePreparationClient {
  return {
    create(command) {
      const { idempotencyKey, correlationId, ...body } = command;
      return api.post<DurablePreparationLockView>('/api/markreg/preparation-locks', body, {
        'Idempotency-Key': idempotencyKey,
        ...(correlationId ? { 'X-Correlation-ID': correlationId } : {})
      });
    },
    get(preparationLockId) {
      return api.get<DurablePreparationLockView>(
        `/api/markreg/preparation-locks/${encodeURIComponent(preparationLockId)}`
      );
    },
    validateCurrent(preparationLockId) {
      return api.post<DurablePreparationLockView>(
        `/api/markreg/preparation-locks/${encodeURIComponent(preparationLockId)}/validate-current`,
        {},
        {}
      );
    }
  };
}
