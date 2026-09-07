import type { MarkOrbitId } from '@markorbit/contracts';
import type {
  ProductionFeeFactsV1,
  ProductionFilingBasisV1
} from '@markorbit/contracts/markreg-early-funnel';
import { createApiClient, type ApiClient } from './client.js';

export interface CustomerProductionFeeFactsCommandV1 {
  expectedIntakeVersion: number;
  filingBasis: ProductionFilingBasisV1;
  niceClasses: readonly number[];
  idempotencyKey: string;
  correlationId: MarkOrbitId;
}

export interface ProductionFeeFactsEnvelopeV1 {
  feeFacts: ProductionFeeFactsV1;
}

export interface ProductionFeeFactsClient {
  create(
    intakeId: MarkOrbitId,
    command: CustomerProductionFeeFactsCommandV1
  ): Promise<ProductionFeeFactsEnvelopeV1>;
  getCurrent(
    intakeId: MarkOrbitId,
    expectedIntakeVersion: number
  ): Promise<ProductionFeeFactsEnvelopeV1>;
}

export function createProductionFeeFactsClient(
  api: ApiClient = createApiClient()
): ProductionFeeFactsClient {
  return {
    create(intakeId, command) {
      const { idempotencyKey, correlationId, ...body } = command;
      return api.post<ProductionFeeFactsEnvelopeV1>(
        `/api/markreg/production-intakes/${encodeURIComponent(intakeId)}/fee-facts`,
        { schemaVersion: 1, ...body },
        {
          'Idempotency-Key': idempotencyKey,
          'X-Correlation-ID': correlationId
        }
      );
    },
    getCurrent(intakeId, expectedIntakeVersion) {
      return api.get<ProductionFeeFactsEnvelopeV1>(
        `/api/markreg/production-intakes/${encodeURIComponent(intakeId)}/fee-facts/current?expectedIntakeVersion=${expectedIntakeVersion}`
      );
    }
  };
}
