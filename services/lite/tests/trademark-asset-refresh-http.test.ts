import { describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import {
  createTrademarkAssetReadRoutes,
  type TrademarkAssetReadRouteOptions
} from '../src/trademark-asset-http.js';

const workspaceId = '56565656-5656-4565-8565-565656565656';
const assetId = 'trademark-asset_refresh-http';
const userId = '11111111-1111-4111-8111-111111111111';
const secret = 'lite-refresh-http-secret-012345678901';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId,
  sessionId: 'session_refresh_http',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_refresh_http',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'matter:manage']
};

const body = {
  sourceOwnerScope: ['MANAGED_COMMUNICATION', 'WORKSPACE_USER'],
  observations: [],
  admittedClaims: [
    {
      claimClass: 'COMMUNICATION_CLAIM',
      claimId: 'claim_mail_1',
      factKind: 'STATUS_TEXT',
      value: 'Office action received',
      source: {
        owner: 'MANAGED_COMMUNICATION',
        kind: 'MANAGED_COMMUNICATION_MESSAGE',
        sourceId: 'managed-message_1',
        sourceVersion: '1',
        observedAt: '2026-09-15T10:00:00.000Z',
        freshness: 'CURRENT'
      },
      reviewedAt: '2026-09-15T10:05:00.000Z'
    },
    {
      claimClass: 'WORKSPACE_USER_CONFIRMATION',
      claimId: 'claim_user_1',
      factKind: 'STATUS_TEXT',
      value: 'Client confirms no response filed yet',
      confirmedAt: '2026-09-15T10:06:00.000Z'
    }
  ]
} as const;

const refreshResult = {
  schemaVersion: 1,
  refreshRunId: 'trademark-asset-refresh_http-1',
  workspaceId,
  trademarkAssetId: assetId,
  sourceOwnerScope: ['MANAGED_COMMUNICATION', 'WORKSPACE_USER'],
  observations: [],
  sourceReadStates: [],
  admittedClaims: [],
  changes: [],
  refreshedAt: '2026-09-15T10:07:00.000Z',
  officialTruthVerifiedByLite: false,
  legalDeadlineCertified: false,
  conflictResolvedByLite: false,
  executionAuthorized: false
} as const;

function setup() {
  const refresh = vi.fn().mockResolvedValue(refreshResult);
  const routes = createTrademarkAssetReadRoutes({
    internalServiceSecret: secret,
    assets: {},
    portfolio: {},
    refreshLedger: { refresh },
    commerce: {},
    dispositions: {},
    aiGuide: {}
  } as unknown as TrademarkAssetReadRouteOptions);
  const route = routes.find(
    (candidate) =>
      candidate.method === 'POST' &&
      candidate.path === '/v1/trademark-assets/:trademarkAssetId/refresh'
  );
  if (!route) throw new Error('Trademark Asset refresh route is missing.');
  const request: JsonRequest = {
    method: 'POST',
    path: `/v1/trademark-assets/${assetId}/refresh`,
    params: { trademarkAssetId: assetId },
    query: {},
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
      'x-markorbit-workspace-id': workspaceId,
      'idempotency-key': 'refresh-http-1'
    },
    body
  };
  return { refresh, request, route };
}

describe('authenticated Trademark Asset refresh HTTP boundary', () => {
  it('binds admitted-claim human actors to the trusted principal and delegates once', async () => {
    const { refresh, request, route } = setup();
    expect(await route.handle(request)).toEqual({ status: 200, body: refreshResult });
    expect(refresh).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledWith({
      workspaceId,
      trademarkAssetId: assetId,
      sourceOwnerScope: body.sourceOwnerScope,
      observations: body.observations,
      admittedClaims: [
        { ...body.admittedClaims[0], reviewedByPrincipalId: userId },
        { ...body.admittedClaims[1], confirmedByPrincipalId: userId }
      ],
      idempotencyKey: 'refresh-http-1'
    });
  });

  it.each([
    ['reviewedByPrincipalId', 'COMMUNICATION_CLAIM'],
    ['confirmedByPrincipalId', 'WORKSPACE_USER_CONFIRMATION']
  ] as const)('rejects caller-supplied nested %s', async (field, claimClass) => {
    const { refresh, request, route } = setup();
    const claims = body.admittedClaims.map((claim) =>
      claim.claimClass === claimClass ? { ...claim, [field]: 'forged-user' } : claim
    );
    await expect(
      route.handle({ ...request, body: { ...body, admittedClaims: claims } })
    ).rejects.toMatchObject({
      status: 400,
      code: 'ACTOR_SPOOF_REJECTED'
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('requires matter:manage and Idempotency-Key before calling the owner', async () => {
    const { refresh, request, route } = setup();
    await expect(
      route.handle({
        ...request,
        headers: {
          ...request.headers,
          'x-markorbit-principal': encodeInternalWorkspacePrincipal({
            ...principal,
            permissions: ['workspace:read']
          })
        }
      })
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    await expect(
      route.handle({
        ...request,
        headers: Object.fromEntries(
          Object.entries(request.headers).filter(([key]) => key !== 'idempotency-key')
        )
      })
    ).rejects.toMatchObject({ status: 400, code: 'IDEMPOTENCY_KEY_REQUIRED' });
    expect(refresh).not.toHaveBeenCalled();
  });
});
