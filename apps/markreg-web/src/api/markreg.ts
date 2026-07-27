import type { IntakeCreateCommand, IntakeRecommendationResponse } from '@markorbit/contracts';
import { createApiClient, type ApiClient } from './client.js';

export interface MarkregClient {
  createIntake(command: IntakeCreateCommand): Promise<IntakeRecommendationResponse>;
}

export function createMarkregClient(api: ApiClient = createApiClient()): MarkregClient {
  return {
    createIntake(command) {
      const { idempotencyKey, correlationId, ...body } = command;
      return api.post<IntakeRecommendationResponse>('/v1/markreg/intakes', body, {
        'Idempotency-Key': idempotencyKey,
        'X-Correlation-ID': correlationId
      });
    }
  };
}
