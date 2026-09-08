import { describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { TradingStudioRunV1 } from '@markorbit/contracts/trading-studio-run';
import type { TradingCommercialDirectionSetV1 } from '@markorbit/contracts/trading-commercial-direction';
import { createTradingStudioReadRoutes } from '../src/trading-studio-http.js';

const secret = 'lite-trading-studio-http-secret-0123456789';
const unusedSelectionWriter = {
  recordExplicit: () => Promise.reject(new Error('recordExplicit is not expected'))
};
const workspaceId = '98989898-9898-4989-8989-989898989898';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: 'user_trading_studio',
  sessionId: 'session_trading_studio',
  sessionExpiresAt: '2030-01-01T00:00:00Z',
  workspaceId,
  membershipId: 'membership_trading_studio',
  role: 'READ_ONLY',
  permissions: ['workspace:read']
};
const manager: WorkspacePrincipal = {
  ...principal,
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'matter:manage']
};
const run: TradingStudioRunV1 = {
  schemaVersion: 1,
  studioRunId: 'standard-studio-run_1',
  workspaceId,
  version: 1,
  status: 'QUEUED',
  currentness: 'CURRENT',
  checkpoint: 'NONE',
  trademarkAsset: { id: 'trademark-asset_1', version: 1 },
  canResume: true,
  createdAt: '2026-09-07T00:00:00Z',
  updatedAt: '2026-09-07T00:00:00Z',
  authorityConsequences: {
    humanSelectionCreated: false,
    deepBuildStarted: false,
    listingCreated: false,
    trademarkTruthMutated: false
  }
};

function request(overrides: Record<string, string> = {}) {
  return {
    body: undefined,
    method: 'GET' as const,
    path: `/v1/trading/studio-runs/${run.studioRunId}`,
    params: { studioRunId: run.studioRunId },
    query: {},
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
      'x-markorbit-workspace-id': workspaceId,
      ...overrides
    }
  };
}

function route() {
  const found = createTradingStudioReadRoutes({
    internalServiceSecret: secret,
    runs: { getLatest: () => Promise.resolve(run) },
    directionSets: { getExact: () => Promise.resolve({} as TradingCommercialDirectionSetV1) },
    selections: {
      ...unusedSelectionWriter,
      getCurrentForDirectionSet: () => Promise.resolve(undefined)
    }
  })[0];
  if (!found) throw new Error('Trading Studio read route missing.');
  return found;
}

function directionRoute() {
  const directionSet = { commercialDirectionSetId: 'commercial-direction-set_1', version: 2 };
  const found = createTradingStudioReadRoutes({
    internalServiceSecret: secret,
    runs: { getLatest: () => Promise.resolve(run) },
    selections: {
      ...unusedSelectionWriter,
      getCurrentForDirectionSet: () => Promise.resolve(undefined)
    },
    directionSets: {
      getExact: (actualWorkspace, id, version) => {
        expect([actualWorkspace, id, version]).toEqual([
          workspaceId,
          'commercial-direction-set_1',
          2
        ]);
        return Promise.resolve(directionSet as TradingCommercialDirectionSetV1);
      }
    }
  })[1];
  if (!found) throw new Error('Exact Direction Set route missing.');
  return { found, directionSet };
}

describe('Lite Trading Studio read HTTP boundary', () => {
  it('restores the latest workspace-scoped Studio Run', async () => {
    const response = await route().handle(request());
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ run });
  });

  it('rejects Workspace spoofing and missing read authority', async () => {
    await expect(
      route().handle(
        request({ 'x-markorbit-workspace-id': '78787878-7878-4787-8787-787878787878' })
      )
    ).rejects.toMatchObject({ status: 404, code: 'WORKSPACE_MISMATCH' });
    const denied = { ...principal, permissions: [] } satisfies WorkspacePrincipal;
    await expect(
      route().handle(request({ 'x-markorbit-principal': encodeInternalWorkspacePrincipal(denied) }))
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
  });

  it('loads the exact Direction Set version named by a Studio Run', async () => {
    const { found, directionSet } = directionRoute();
    const response = await found.handle({
      ...request(),
      path: '/v1/trading/direction-sets/commercial-direction-set_1/versions/2',
      params: { directionSetId: 'commercial-direction-set_1', version: '2' }
    });
    expect(response.body).toEqual({ directionSet });
  });

  it('restores the current explicit Selection for a Direction Set', async () => {
    const selection = { directionSelectionId: 'trading-direction-selection_1' };
    const found = createTradingStudioReadRoutes({
      internalServiceSecret: secret,
      runs: { getLatest: () => Promise.resolve(run) },
      directionSets: { getExact: () => Promise.resolve({} as TradingCommercialDirectionSetV1) },
      selections: {
        ...unusedSelectionWriter,
        getCurrentForDirectionSet: () => Promise.resolve(selection as never)
      }
    })[2];
    if (!found) throw new Error('Current Selection route missing.');
    const response = await found.handle({
      ...request(),
      path: '/v1/trading/direction-sets/commercial-direction-set_1/selection',
      params: { directionSetId: 'commercial-direction-set_1' }
    });
    expect(response.body).toEqual({ selection });
  });

  it('composes one internally consistent Studio state snapshot', async () => {
    const completed = {
      ...run,
      version: 2,
      status: 'COMPLETED' as const,
      checkpoint: 'COMMERCIAL_DIRECTIONS' as const,
      aiProfile: { id: 'trading-ai-derived_ai-profile_1' as const, version: 1 },
      brandDna: { id: 'trading-ai-derived_brand-dna_1' as const, version: 1 },
      directionSet: { id: 'commercial-direction-set_1' as const, version: 1 },
      canResume: false,
      completedAt: '2026-09-07T00:01:00Z'
    };
    const directionSet = { commercialDirectionSetId: completed.directionSet.id, version: 1 };
    const selection = {
      directionSelectionId: 'trading-direction-selection_1',
      directionSet: completed.directionSet
    };
    const found = createTradingStudioReadRoutes({
      internalServiceSecret: secret,
      runs: { getLatest: () => Promise.resolve(completed) },
      directionSets: { getExact: () => Promise.resolve(directionSet as never) },
      selections: {
        ...unusedSelectionWriter,
        getCurrentForDirectionSet: () => Promise.resolve(selection as never)
      }
    })[3];
    if (!found) throw new Error('Studio state route missing.');
    const response = await found.handle({
      ...request(),
      path: `/v1/trading/studio-runs/${run.studioRunId}/state`
    });
    expect(response.body).toEqual({ run: completed, directionSet, selection });
  });

  it('fails closed when current Selection points at another Direction Set version', async () => {
    const completed = {
      ...run,
      status: 'COMPLETED' as const,
      checkpoint: 'COMMERCIAL_DIRECTIONS' as const,
      aiProfile: { id: 'trading-ai-derived_ai-profile_1' as const, version: 1 },
      brandDna: { id: 'trading-ai-derived_brand-dna_1' as const, version: 1 },
      directionSet: { id: 'commercial-direction-set_1' as const, version: 1 },
      canResume: false,
      completedAt: '2026-09-07T00:01:00Z'
    };
    const found = createTradingStudioReadRoutes({
      internalServiceSecret: secret,
      runs: { getLatest: () => Promise.resolve(completed) },
      directionSets: { getExact: () => Promise.resolve({} as never) },
      selections: {
        ...unusedSelectionWriter,
        getCurrentForDirectionSet: () =>
          Promise.resolve({
            directionSet: { id: completed.directionSet.id, version: 2 }
          } as never)
      }
    })[3];
    if (!found) throw new Error('Studio state route missing.');
    await expect(
      found.handle({
        ...request(),
        path: `/v1/trading/studio-runs/${run.studioRunId}/state`
      })
    ).rejects.toMatchObject({ status: 409, code: 'STUDIO_STATE_VERSION_CONFLICT' });
  });

  it('records only a trusted explicit human Selection command', async () => {
    const recordExplicit = vi.fn(() =>
      Promise.resolve({ directionSelectionId: 'trading-direction-selection_1' } as never)
    );
    const found = createTradingStudioReadRoutes({
      internalServiceSecret: secret,
      runs: { getLatest: () => Promise.resolve(run) },
      directionSets: { getExact: () => Promise.resolve({} as never) },
      selections: { getCurrentForDirectionSet: () => Promise.resolve(undefined), recordExplicit }
    })[4];
    if (!found) throw new Error('Selection command route missing.');

    const response = await found.handle({
      ...request({
        'idempotency-key': 'select-direction-1',
        'x-correlation-id': 'correlation_selection-1',
        'x-markorbit-principal': encodeInternalWorkspacePrincipal(manager)
      }),
      method: 'POST',
      path: '/v1/trading/direction-sets/commercial-direction-set_1/selection',
      params: { directionSetId: 'commercial-direction-set_1' },
      body: {
        expectedDirectionSetVersion: 1,
        selectedDirectionId: 'trading-ai-derived_commercial-direction_1',
        expectedDirectionVersion: 1
      }
    });

    expect(response).toEqual({
      status: 201,
      body: { selection: { directionSelectionId: 'trading-direction-selection_1' } }
    });
    expect(recordExplicit).toHaveBeenCalledWith(workspaceId, {
      schemaVersion: 1,
      directionSetId: 'commercial-direction-set_1',
      expectedDirectionSetVersion: 1,
      selectedDirectionId: 'trading-ai-derived_commercial-direction_1',
      expectedDirectionVersion: 1,
      idempotencyKey: 'select-direction-1',
      correlationId: 'correlation_selection-1'
    });
  });

  it('rejects missing mutation permission and client-authored Selection authority', async () => {
    const recordExplicit = vi.fn();
    const found = createTradingStudioReadRoutes({
      internalServiceSecret: secret,
      runs: { getLatest: () => Promise.resolve(run) },
      directionSets: { getExact: () => Promise.resolve({} as never) },
      selections: { getCurrentForDirectionSet: () => Promise.resolve(undefined), recordExplicit }
    })[4];
    if (!found) throw new Error('Selection command route missing.');
    const body = {
      expectedDirectionSetVersion: 1,
      selectedDirectionId: 'trading-ai-derived_commercial-direction_1',
      expectedDirectionVersion: 1
    };

    await expect(
      found.handle({
        ...request({
          'idempotency-key': 'select-direction-2',
          'x-correlation-id': 'correlation_selection-2'
        }),
        method: 'POST',
        params: { directionSetId: 'commercial-direction-set_1' },
        body
      })
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    await expect(
      found.handle({
        ...request({
          'idempotency-key': 'select-direction-3',
          'x-correlation-id': 'correlation_selection-3',
          'x-markorbit-principal': encodeInternalWorkspacePrincipal(manager)
        }),
        method: 'POST',
        params: { directionSetId: 'commercial-direction-set_1' },
        body: { ...body, selectedAt: '2026-09-08T00:00:00Z' }
      })
    ).rejects.toMatchObject({ status: 400, code: 'ACTOR_SPOOF_REJECTED' });
    expect(recordExplicit).not.toHaveBeenCalled();
  });
});
