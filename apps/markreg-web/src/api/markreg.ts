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
  MarkOrbitId
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
    }
  };
}
