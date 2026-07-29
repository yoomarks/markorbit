import type {
  IntakeCreateCommand,
  IntakeRecommendationResponse,
  PlanQuoteResponse,
  QuoteConfirmation,
  QuoteConfirmationCommand,
  QuoteCreateCommand,
  CustomerConfirmation,
  MatterDraft,
  MatterDraftPreparation,
  AuthorityBoundary,
  ConfirmationAcknowledgement,
  MarkOrbitId,
  ProfessionalReviewCase,
  DocumentPackage,
  DocumentItem,
  DocumentReference,
  DocumentRequirementCode,
  CustomerInstructionLedger,
  CustomerInstructionEntry,
  CustomerInstructionAcknowledgement,
  PreparationLock,
  FilingAuthorization,
  FilingAuthorizationAcknowledgementCode,
  AuthorizationCapacity,
  FilingExecutionChannel,
  AuthorizationAuthorityConsequences
} from '@markorbit/contracts';
import { createApiClient, type ApiClient } from './client.js';

export interface MarkregClient {
  createIntake(command: IntakeCreateCommand): Promise<IntakeRecommendationResponse>;
  createQuote?(command: QuoteCreateCommand): Promise<PlanQuoteResponse>;
  confirmQuote?(command: QuoteConfirmationCommand): Promise<QuoteConfirmation>;
  createCustomerConfirmation?(command: ConfirmationCommand): Promise<ConfirmationResponse>;
  getCustomerConfirmation?(id: string): Promise<ConfirmationResponse>;
  withdrawCustomerConfirmation?(id: string): Promise<ConfirmationResponse>;
  createMatterDraft?(confirmationId: string): Promise<MatterDraftResponse>;
  getMatterDraft?(id: string): Promise<MatterDraftResponse>;
  updateMatterDraft?(
    id: string,
    patch: Partial<MatterDraftPreparation>
  ): Promise<MatterDraftResponse>;
  evaluateMatterDraft?(id: string): Promise<MatterDraftResponse>;
  getProfessionalReview?(id: string): Promise<{ reviewCase: ProfessionalReviewCase }>;
  createDocumentPackage?(command: {
    professionalReviewCaseId: string;
    professionalReviewDecisionVersion: string;
    matterDraftVersion: string;
    idempotencyKey: string;
  }): Promise<DocumentPackage>;
  getDocumentPackage?(id: string): Promise<DocumentPackage>;
  addDocument?(
    id: string,
    input: {
      requirementCode: DocumentRequirementCode;
      documentType: string;
      documentReference: DocumentReference;
      suppliedBy: MarkOrbitId;
    }
  ): Promise<DocumentItem>;
  updateDocument?(
    packageId: string,
    itemId: string,
    patch: { documentReference: Partial<DocumentReference> }
  ): Promise<DocumentItem>;
  evaluateDocumentPackage?(id: string): Promise<DocumentPackage>;
  createInstructionLedger?(documentPackageId: string): Promise<CustomerInstructionLedger>;
  appendInstruction?(
    id: string,
    input: { type: 'DOCUMENT_USE_AUTHORIZATION'; structuredValue: Record<string, unknown> }
  ): Promise<CustomerInstructionEntry>;
  confirmInstruction?(ledgerId: string, entryId: string): Promise<CustomerInstructionLedger>;
  confirmInstructionLedger?(
    id: string,
    acknowledgements: CustomerInstructionAcknowledgement[]
  ): Promise<{ instructionLedger: CustomerInstructionLedger }>;
  createPreparationLock?(
    documentPackageId: string,
    instructionLedgerId: string
  ): Promise<PreparationLock>;
  getPreparationLock?(id: string): Promise<PreparationLock>;
  createFilingAuthorization?(command: {
    preparationLockId: string;
    preparationLockVersion: string;
    authorizedParty: { partyId: MarkOrbitId; displayName: string };
    authorizationCapacity: AuthorizationCapacity;
    executionChannel: FilingExecutionChannel;
    idempotencyKey: string;
  }): Promise<FilingAuthorizationResponse>;
  getFilingAuthorization?(id: string): Promise<FilingAuthorizationResponse>;
  confirmFilingAuthorization?(
    id: string,
    command: {
      acknowledgementCodes: FilingAuthorizationAcknowledgementCode[];
      acknowledgedBy: MarkOrbitId;
      idempotencyKey: string;
    }
  ): Promise<FilingAuthorizationResponse>;
  withdrawFilingAuthorization?(id: string): Promise<FilingAuthorizationResponse>;
}
export interface FilingAuthorizationResponse {
  filingAuthorization: FilingAuthorization;
  consequences: AuthorizationAuthorityConsequences;
}
export interface ConfirmationCommand {
  quoteId: MarkOrbitId;
  quoteVersion: string;
  planId: MarkOrbitId;
  planVersion: string;
  customerId: MarkOrbitId;
  termsVersion: string;
  acknowledgements: ConfirmationAcknowledgement[];
  actor: QuoteConfirmationCommand['actor'];
  idempotencyKey: string;
}
export interface ConfirmationResponse {
  confirmation: CustomerConfirmation;
  nextAction: 'PREPARE_MATTER_DRAFT' | 'NONE';
  consequences: AuthorityBoundary;
}
export interface MatterDraftResponse {
  matterDraft: MatterDraft;
  nextAction?: string;
  consequences: AuthorityBoundary;
}

export function createMarkregClient(api: ApiClient = createApiClient()): MarkregClient {
  return {
    createIntake(command) {
      const { idempotencyKey, correlationId, ...body } = command;
      return api.post<IntakeRecommendationResponse>('/v1/markreg/intakes', body, {
        'Idempotency-Key': idempotencyKey,
        'X-Correlation-ID': correlationId
      });
    },
    createQuote(command) {
      const { idempotencyKey, correlationId, ...body } = command;
      return api.post<PlanQuoteResponse>('/v1/markreg/quotes', body, {
        'Idempotency-Key': idempotencyKey,
        'X-Correlation-ID': correlationId
      });
    },
    confirmQuote(command) {
      const { idempotencyKey, correlationId, ...body } = command;
      return api.post<QuoteConfirmation>(
        `/v1/markreg/quotes/${encodeURIComponent(command.quoteId)}/confirm`,
        body,
        { 'Idempotency-Key': idempotencyKey, 'X-Correlation-ID': correlationId }
      );
    },
    createCustomerConfirmation(command) {
      const { idempotencyKey, ...body } = command;
      return api.post('/api/markreg/customer-confirmations', body, {
        'Idempotency-Key': idempotencyKey
      });
    },
    getCustomerConfirmation(id) {
      return api.get(`/api/markreg/customer-confirmations/${encodeURIComponent(id)}`);
    },
    withdrawCustomerConfirmation(id) {
      return api.post(
        `/api/markreg/customer-confirmations/${encodeURIComponent(id)}/withdraw`,
        {},
        {}
      );
    },
    createMatterDraft(confirmationId) {
      return api.post('/api/markreg/matter-drafts', { confirmationId }, {});
    },
    getMatterDraft(id) {
      return api.get(`/api/markreg/matter-drafts/${encodeURIComponent(id)}`);
    },
    updateMatterDraft(id, patch) {
      return api.patch(`/api/markreg/matter-drafts/${encodeURIComponent(id)}`, patch);
    },
    evaluateMatterDraft(id) {
      return api.post(
        `/api/markreg/matter-drafts/${encodeURIComponent(id)}/evaluate-readiness`,
        {},
        {}
      );
    },
    getProfessionalReview(id) {
      return api.get(`/api/lite/professional-review-cases/${encodeURIComponent(id)}`);
    },
    createDocumentPackage(command) {
      const { idempotencyKey, ...body } = command;
      return api.post('/api/markreg/document-packages', body, {
        'Idempotency-Key': idempotencyKey
      });
    },
    getDocumentPackage(id) {
      return api.get(`/api/markreg/document-packages/${encodeURIComponent(id)}`);
    },
    addDocument(id, input) {
      return api.post(
        `/api/markreg/document-packages/${encodeURIComponent(id)}/documents`,
        input,
        {}
      );
    },
    updateDocument(packageId, itemId, patch) {
      return api.patch(
        `/api/markreg/document-packages/${encodeURIComponent(packageId)}/documents/${encodeURIComponent(itemId)}`,
        patch
      );
    },
    evaluateDocumentPackage(id) {
      return api.post(`/api/markreg/document-packages/${encodeURIComponent(id)}/evaluate`, {}, {});
    },
    createInstructionLedger(documentPackageId) {
      return api.post('/api/markreg/instruction-ledgers', { documentPackageId }, {});
    },
    appendInstruction(id, input) {
      return api.post(
        `/api/markreg/instruction-ledgers/${encodeURIComponent(id)}/entries`,
        input,
        {}
      );
    },
    confirmInstruction(ledgerId, entryId) {
      return api.post(
        `/api/markreg/instruction-ledgers/${encodeURIComponent(ledgerId)}/entries/${encodeURIComponent(entryId)}/confirm`,
        {},
        {}
      );
    },
    confirmInstructionLedger(id, acknowledgements) {
      return api.post(
        `/api/markreg/instruction-ledgers/${encodeURIComponent(id)}/confirm`,
        { acknowledgements },
        {}
      );
    },
    createPreparationLock(documentPackageId, instructionLedgerId) {
      return api.post(
        '/api/markreg/preparation-locks',
        { documentPackageId, instructionLedgerId },
        {}
      );
    },
    getPreparationLock(id) {
      return api.get(`/api/markreg/preparation-locks/${encodeURIComponent(id)}`);
    },
    createFilingAuthorization(command) {
      const { idempotencyKey, ...body } = command;
      return api.post('/api/execution/filing-authorizations', body, {
        'Idempotency-Key': idempotencyKey
      });
    },
    getFilingAuthorization(id) {
      return api.get(`/api/execution/filing-authorizations/${encodeURIComponent(id)}`);
    },
    confirmFilingAuthorization(id, command) {
      const { idempotencyKey, ...body } = command;
      return api.post(
        `/api/execution/filing-authorizations/${encodeURIComponent(id)}/confirm`,
        body,
        { 'Idempotency-Key': idempotencyKey }
      );
    },
    withdrawFilingAuthorization(id) {
      return api.post(
        `/api/execution/filing-authorizations/${encodeURIComponent(id)}/withdraw`,
        {},
        {}
      );
    }
  };
}
