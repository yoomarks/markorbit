import type { MarkOrbitId } from '@markorbit/contracts';
import type {
  CreateUserSelectionCommandV1,
  ProductionRecommendationV1,
  UserSelectionV1
} from '@markorbit/contracts/markreg-early-funnel';
import { createApiClient, type ApiClient } from './client.js';

export interface CreateProductionRecommendationBrowserCommandV1 {
  schemaVersion: 1;
  intakeId: MarkOrbitId;
  expectedIntakeVersion: number;
  expectedIntakeFingerprintSha256: string;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

export interface ProductionRecommendationEnvelopeV1 {
  recommendation: ProductionRecommendationV1;
}

export interface ProductionUserSelectionEnvelopeV1 {
  selection: UserSelectionV1;
}

export interface ProductionGuidanceClient {
  createRecommendation(
    command: CreateProductionRecommendationBrowserCommandV1
  ): Promise<ProductionRecommendationEnvelopeV1>;
  getRecommendation(recommendationId: MarkOrbitId): Promise<ProductionRecommendationEnvelopeV1>;
  createSelection(
    command: CreateUserSelectionCommandV1
  ): Promise<ProductionUserSelectionEnvelopeV1>;
  getSelection(selectionId: MarkOrbitId): Promise<ProductionUserSelectionEnvelopeV1>;
}

export function createProductionGuidanceClient(
  api: ApiClient = createApiClient()
): ProductionGuidanceClient {
  return {
    createRecommendation(command) {
      const { idempotencyKey, correlationId, ...body } = command;
      return api.post<ProductionRecommendationEnvelopeV1>(
        '/api/markreg/production-recommendations',
        body,
        {
          'Idempotency-Key': idempotencyKey,
          'X-Correlation-ID': correlationId
        }
      );
    },
    getRecommendation(recommendationId) {
      return api.get<ProductionRecommendationEnvelopeV1>(
        `/api/markreg/production-recommendations/${encodeURIComponent(recommendationId)}`
      );
    },
    createSelection(command) {
      const { idempotencyKey, correlationId, ...body } = command;
      return api.post<ProductionUserSelectionEnvelopeV1>(
        '/api/markreg/production-user-selections',
        body,
        {
          'Idempotency-Key': idempotencyKey,
          'X-Correlation-ID': correlationId
        }
      );
    },
    getSelection(selectionId) {
      return api.get<ProductionUserSelectionEnvelopeV1>(
        `/api/markreg/production-user-selections/${encodeURIComponent(selectionId)}`
      );
    }
  };
}
