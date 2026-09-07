import { describe, expect, it } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { TradingStudioRunV1 } from '@markorbit/contracts/trading-studio-run';
import { createTradingStudioReadRoutes } from '../src/trading-studio-http.js';

const secret = 'lite-trading-studio-http-secret-0123456789';
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
    runs: { getLatest: () => Promise.resolve(run) }
  })[0];
  if (!found) throw new Error('Trading Studio read route missing.');
  return found;
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
});
