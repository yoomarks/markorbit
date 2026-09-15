import type { MarkOrbitId } from '@markorbit/contracts';
import type {
  CreateProductionQuoteCommandV1,
  ProductionQuoteV1
} from '@markorbit/contracts/markreg-early-funnel';
import { createApiClient, type ApiClient } from './client.js';

export interface ProductionQuoteEnvelopeV1 {
  quote: ProductionQuoteV1;
}

export interface ProductionQuoteClient {
  create(command: CreateProductionQuoteCommandV1): Promise<ProductionQuoteEnvelopeV1>;
  get(quoteId: MarkOrbitId): Promise<ProductionQuoteEnvelopeV1>;
}

export function createProductionQuoteClient(
  api: ApiClient = createApiClient()
): ProductionQuoteClient {
  return {
    create(command) {
      const { idempotencyKey, correlationId, ...body } = command;
      return api.post<ProductionQuoteEnvelopeV1>('/api/markreg/production-quotes', body, {
        'Idempotency-Key': idempotencyKey,
        'X-Correlation-ID': correlationId
      });
    },
    get(quoteId) {
      return api.get<ProductionQuoteEnvelopeV1>(
        `/api/markreg/production-quotes/${encodeURIComponent(quoteId)}`
      );
    }
  };
}
