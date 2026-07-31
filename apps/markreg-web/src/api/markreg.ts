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
  getGovernedRecord?(view: string, id: string): Promise<unknown>;
  createIntake(command: IntakeCreateCommand): Promise<IntakeRecommendationResponse>;
  createQuote?(command: QuoteCreateCommand): Promise<PlanQuoteResponse>;
  confirmQuote?(command: QuoteConfirmationCommand): Promise<QuoteConfirmation>;
  createCustomerConfirmation?(command: ConfirmationCommand): Promise<ConfirmationResponse>;
  getCustomerConfirmation?(id: string): Promise<ConfirmationResponse>;
  withdrawCustomerConfirmation?(id: string): Promise<ConfirmationResponse>;
  createMatterDraft?(
    confirmationId: string,
    confirmationVersion?: number,
    workspaceId?: string
  ): Promise<MatterDraftResponse>;
  getMatterDraft?(id: string): Promise<MatterDraftResponse>;
  updateMatterDraft?(
    id: string,
    patch: Partial<MatterDraftPreparation>,
    expectedVersion?: number,
    workspaceId?: string
  ): Promise<MatterDraftResponse>;
  evaluateMatterDraft?(
    id: string,
    expectedVersion?: number,
    workspaceId?: string
  ): Promise<MatterDraftResponse>;
  getProfessionalReview?(id: string): Promise<{ reviewCase: ProfessionalReviewCase }>;
  createProfessionalReview?(command: {
    matterDraftId: string;
    matterDraftVersion: string;
    requestedBy: MarkOrbitId;
    idempotencyKey: string;
  }): Promise<{ reviewCase: ProfessionalReviewCase }>;
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
  matterDraft: MatterDraft & { version?: number; workspaceId?: string };
  nextAction?: string;
  consequences: AuthorityBoundary;
}
function confirmationResponse(value: ConfirmationResponse): ConfirmationResponse {
  const raw = value.confirmation as CustomerConfirmation & {
    version?: number;
    acceptedAt?: string;
    sourceSnapshot?: {
      quoteId: string;
      quoteVersion: string;
      planId: string;
      planVersion: string;
      currency: string;
      totalMinor: number;
      lineItems: readonly {
        code: string;
        description: string;
        category: string;
        amountMinor: number;
      }[];
      termsVersion: string;
      acknowledgementCodes: readonly ConfirmationAcknowledgement['code'][];
    };
  };
  if (!raw.sourceSnapshot) return value;
  const at = raw.acceptedAt ?? raw.updatedAt;
  return {
    ...value,
    confirmation: {
      schemaVersion: 1,
      confirmationId: raw.confirmationId,
      customerId: 'customer_workspace',
      quoteSnapshot: {
        ...raw.sourceSnapshot,
        lineItems: raw.sourceSnapshot.lineItems.map((x) => ({
          ...x,
          amount: { amountMinor: x.amountMinor, currency: raw.sourceSnapshot!.currency }
        }))
      } as CustomerConfirmation['quoteSnapshot'],
      confirmedBy: 'workspace_member',
      confirmedAt: at,
      termsVersion: raw.sourceSnapshot.termsVersion,
      acknowledgements: raw.sourceSnapshot.acknowledgementCodes.map((code) => ({
        code,
        acknowledged: true,
        acknowledgedAt: at
      })),
      status: raw.status,
      createdAt: at,
      updatedAt: raw.updatedAt,
      version: raw.version
    } as CustomerConfirmation & { version?: number }
  };
}

export function createMarkregClient(api: ApiClient = createApiClient()): MarkregClient {
  return {
    getGovernedRecord(view, id) {
      const paths: Record<string, string> = {
        consultation: `/api/markreg/intakes/${encodeURIComponent(id)}`,
        'recommendation-plan': `/api/markreg/recommendations/${encodeURIComponent(id)}`,
        quote: `/api/markreg/quotes/${encodeURIComponent(id)}`,
        'customer-confirmation': `/api/markreg/customer-confirmations/${encodeURIComponent(id)}`,
        'matter-draft': `/api/markreg/matter-drafts/${encodeURIComponent(id)}`,
        documents: `/api/lite/professional-review-cases/${encodeURIComponent(id)}`,
        'preparation-lock': `/api/markreg/preparation-locks/${encodeURIComponent(id)}`,
        'filing-authorization': `/api/execution/filing-authorizations/${encodeURIComponent(id)}`
      };
      const path = paths[view];
      if (!path) return Promise.reject(new Error('Unsupported governed route.'));
      return api.get(path);
    },
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
      return api
        .post<ConfirmationResponse>('/api/markreg/customer-confirmations', command, {
          'Idempotency-Key': command.idempotencyKey
        })
        .then(confirmationResponse);
    },
    getCustomerConfirmation(id) {
      return api
        .get<ConfirmationResponse>(`/api/markreg/customer-confirmations/${encodeURIComponent(id)}`)
        .then(confirmationResponse);
    },
    withdrawCustomerConfirmation(id) {
      return api.post(
        `/api/markreg/customer-confirmations/${encodeURIComponent(id)}/withdraw`,
        {},
        {}
      );
    },
    createMatterDraft(confirmationId, confirmationVersion, workspaceId) {
      return api.post(
        '/api/markreg/matter-drafts',
        {
          confirmationId,
          ...(confirmationVersion === undefined ? {} : { confirmationVersion }),
          ...(workspaceId === undefined ? {} : { workspaceId })
        },
        {}
      );
    },
    getMatterDraft(id) {
      return api.get(`/api/markreg/matter-drafts/${encodeURIComponent(id)}`);
    },
    updateMatterDraft(id, patch, expectedVersion, workspaceId) {
      return api.patch(
        `/api/markreg/matter-drafts/${encodeURIComponent(id)}`,
        expectedVersion === undefined ? patch : { preparation: patch, expectedVersion, workspaceId }
      );
    },
    evaluateMatterDraft(id, expectedVersion, workspaceId) {
      return api.post(
        `/api/markreg/matter-drafts/${encodeURIComponent(id)}/evaluate-readiness`,
        { expectedVersion, workspaceId },
        {}
      );
    },
    getProfessionalReview(id) {
      return api.get(`/api/lite/professional-review-cases/${encodeURIComponent(id)}`);
    },
    createProfessionalReview(command) {
      const { idempotencyKey, ...body } = command;
      return api.post('/api/lite/professional-review-cases', body, {
        'Idempotency-Key': idempotencyKey
      });
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
