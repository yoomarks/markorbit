import type {
  IntakeCreateCommand,
  IntakeRecommendationResponse,
  PlanQuoteResponse,
  QuoteConfirmation,
  QuoteConfirmationCommand,
  QuoteCreateCommand
} from '@markorbit/contracts';
import { createApiClient, type ApiClient } from './client.js';

export interface MarkregClient {
  createIntake(command: IntakeCreateCommand): Promise<IntakeRecommendationResponse>;
  createQuote?(command: QuoteCreateCommand): Promise<PlanQuoteResponse>;
  confirmQuote?(command: QuoteConfirmationCommand): Promise<QuoteConfirmation>;
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
    }
  };
}
