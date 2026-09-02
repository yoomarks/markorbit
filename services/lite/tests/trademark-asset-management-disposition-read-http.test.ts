import { describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import {
  createTrademarkAssetReadRoutes,
  type TrademarkAssetReadRouteOptions
} from '../src/trademark-asset-http.js';
import { TrademarkAssetManagementDispositionError } from '../src/trademark-asset-management-disposition.js';

const workspaceId = '96969696-9696-4969-8969-969696969696';
const assetId = 'trademark-asset_management-read-http';
const secret = 'lite-management-disposition-read-secret-01';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 'session_management_disposition_read',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_management_disposition_read',
  role: 'READ_ONLY',
  permissions: ['workspace:read']
};
const signal = { id: 'trademark-asset-management-signal_exact', version: 7 } as const;
const disposition = {
  schemaVersion: 1,
  dispositionId: 'trademark-asset-management-disposition_read-http',
  workspaceId,
  version: 1,
  asset: { id: assetId, version: 7 },
  signal,
  kind: 'DISMISSED',
  subjectUserId: principal.userId,
  recordedAt: '2026-09-02T00:00:00.000Z',
  officialTruthCreated: false,
  legalConclusionVerified: false,
  capabilityVerified: false
} as const;
const projection = {
  schemaVersion: 1,
  workspaceId,
  asset: { id: assetId, version: 7 },
  items: [{ signal, disposition }]
} as const;

function setup() {
  const dispositions = {
    record: vi.fn(),
    listCurrentForAsset: vi.fn().mockResolvedValue(projection)
  };
  const routes = createTrademarkAssetReadRoutes({
    internalServiceSecret: secret,
    assets: {},
    commerce: {},
    dispositions,
    portfolio: {},
    refreshLedger: {},
    aiGuide: {}
  } as unknown as TrademarkAssetReadRouteOptions);
  const matching = routes.filter(
    (candidate) =>
      candidate.method === 'GET' &&
      candidate.path === '/v1/trademark-assets/:trademarkAssetId/management-dispositions'
  );
  if (matching.length !== 1) throw new Error('Exact-current disposition GET route must exist once.');
  const route = matching[0]!;
  const request: JsonRequest = {
    method: 'GET',
    path: `/v1/trademark-assets/${assetId}/management-dispositions`,
    params: { trademarkAssetId: assetId },
    query: {},
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
      'x-markorbit-workspace-id': workspaceId
    },
    body: undefined
  };
  return { dispositions, matching, route, request };
}

describe('authenticated Trademark Asset management disposition read HTTP boundary', () => {
  it('registers exactly one GET and forwards trusted Workspace plus exact path Asset identity', async () => {
    const { dispositions, matching, route, request } = setup();

    expect(matching).toHaveLength(1);
    expect(await route.handle(request)).toEqual({ status: 200, body: projection });
    expect(dispositions.listCurrentForAsset).toHaveBeenCalledOnce();
    expect(dispositions.listCurrentForAsset).toHaveBeenCalledWith(workspaceId, assetId);
    expect(dispositions.record).not.toHaveBeenCalled();
  });

  it('requires only workspace:read and does not incorrectly require matter:manage', async () => {
    const { route, request } = setup();
    await expect(route.handle(request)).resolves.toEqual({ status: 200, body: projection });
  });

  it.each([
    ['x-markorbit-internal-authorization', 'wrong', 401, 'UNTRUSTED_INTERNAL_CALLER'],
    ['x-markorbit-principal', 'invalid', 401, 'INVALID_INTERNAL_PRINCIPAL'],
    [
      'x-markorbit-workspace-id',
      '22222222-2222-4222-8222-222222222222',
      404,
      'WORKSPACE_MISMATCH'
    ]
  ] as const)('rejects invalid %s before owner read', async (header, value, status, code) => {
    const { dispositions, route, request } = setup();
    await expect(
      route.handle({ ...request, headers: { ...request.headers, [header]: value } })
    ).rejects.toMatchObject({ status, code });
    expect(dispositions.listCurrentForAsset).not.toHaveBeenCalled();
  });

  it('requires workspace:read after trusted Workspace resolution', async () => {
    const { dispositions, route, request } = setup();
    await expect(
      route.handle({
        ...request,
        headers: {
          ...request.headers,
          'x-markorbit-principal': encodeInternalWorkspacePrincipal({
            ...principal,
            role: 'READ_ONLY',
            permissions: []
          })
        }
      })
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    expect(dispositions.listCurrentForAsset).not.toHaveBeenCalled();
  });

  it.each([
    ['INVALID_INPUT', 400, false],
    ['NOT_FOUND', 404, false],
    ['PERSISTENCE_UNAVAILABLE', 503, true]
  ] as const)('preserves owner read error %s', async (code, status, retryable) => {
    const { dispositions, route, request } = setup();
    dispositions.listCurrentForAsset.mockRejectedValueOnce(
      new TrademarkAssetManagementDispositionError(code, `owner ${code}`, status, retryable)
    );

    await expect(route.handle(request)).rejects.toMatchObject({
      status,
      code,
      message: `owner ${code}`,
      retryable
    });
  });
});
