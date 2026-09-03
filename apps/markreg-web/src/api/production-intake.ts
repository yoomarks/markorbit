import type { MarkOrbitId } from '@markorbit/contracts';
import type {
  CreateProductionIntakeCommandV1,
  ProductionIntakeV1
} from '@markorbit/contracts/markreg-early-funnel';
import { createApiClient, type ApiClient } from './client.js';

export interface ProductionIntakeEnvelopeV1 {
  intake: ProductionIntakeV1;
}

export interface ProductionIntakeClient {
  create(command: CreateProductionIntakeCommandV1): Promise<ProductionIntakeEnvelopeV1>;
  get(intakeId: MarkOrbitId): Promise<ProductionIntakeEnvelopeV1>;
}

export function createProductionIntakeClient(
  api: ApiClient = createApiClient()
): ProductionIntakeClient {
  return {
    create(command) {
      const { idempotencyKey, correlationId, ...body } = command;
      return api.post<ProductionIntakeEnvelopeV1>('/api/markreg/production-intakes', body, {
        'Idempotency-Key': idempotencyKey,
        'X-Correlation-ID': correlationId
      });
    },
    get(intakeId) {
      return api.get<ProductionIntakeEnvelopeV1>(
        `/api/markreg/production-intakes/${encodeURIComponent(intakeId)}`
      );
    }
  };
}
