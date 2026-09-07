import { describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { CreateUserSelectionCommandV1 } from '@markorbit/contracts/markreg-early-funnel';
import { PostgresProductionUserSelectionService } from '../src/production-user-selection.js';

const workspaceId = '62626262-6262-4626-8626-626262626262';

const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session_task0942_unit',
  userId: 'user_task0942_unit',
  workspaceId,
  membershipId: 'membership_task0942_unit',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'matter:create'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
};

const command: CreateUserSelectionCommandV1 = {
  schemaVersion: 1,
  recommendationId: 'recommendation_task0942',
  expectedRecommendationVersion: 1,
  selectedOptionCode: 'B',
  idempotencyKey: 'selection-task0942-unit',
  correlationId: 'correlation_task0942_unit'
};

describe('Production User Selection command boundary', () => {
  it('rejects an option outside the shared A/B/C vocabulary before persistence', async () => {
    let persistenceTouched = false;
    const unavailable = {
      query: () => {
        persistenceTouched = true;
        return Promise.reject(new Error('must not reach persistence'));
      }
    } as never;
    const service = new PostgresProductionUserSelectionService(
      {
        transact: () => {
          persistenceTouched = true;
          return Promise.reject(new Error('must not transact'));
        }
      },
      unavailable
    );

    await expect(
      service.create(principal, { ...command, selectedOptionCode: 'D' as never })
    ).rejects.toMatchObject({
      code: 'INVALID_PRODUCTION_USER_SELECTION_REQUEST',
      status: 400
    });
    expect(persistenceTouched).toBe(false);
  });
});
