import type {
  CreateProductionIntakeCommandV1,
  ProductionIntakeV1
} from '@markorbit/contracts/markreg-early-funnel';
import { parseProductionIntakeV1 } from '@markorbit/contracts/markreg-early-funnel';
import { createApiClient, type ApiClient } from './client.js';

interface ProductionIntakeEnvelope {
  intake: unknown;
}

export interface ProductionIntakeClient {
  create(command: CreateProductionIntakeCommandV1): Promise<ProductionIntakeV1>;
  get(intakeId: string): Promise<ProductionIntakeV1>;
}

export function createProductionIntakeClient(
  api: ApiClient = createApiClient()
): ProductionIntakeClient {
  return {
    async create(command) {
      const { idempotencyKey, correlationId, ...body } = command;
      const response = await api.post<ProductionIntakeEnvelope>(
        '/api/markreg/production-intakes',
        body,
        {
          'Idempotency-Key': idempotencyKey,
          'X-Correlation-ID': correlationId
        }
      );
      return parseProductionIntakeV1(response.intake);
    },
    async get(intakeId) {
      const response = await api.get<ProductionIntakeEnvelope>(
        `/api/markreg/production-intakes/${encodeURIComponent(intakeId)}`
      );
      return parseProductionIntakeV1(response.intake);
    }
  };
}
