import { describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import {
  createTrademarkAssetReadRoutes,
  type TrademarkAssetReadRouteOptions
} from '../src/trademark-asset-http.js';
import { TrademarkAssetPersistenceError } from '../src/trademark-asset.js';

const workspaceId = '96969696-9696-4969-8969-969696969696';
const assetId = 'trademark-asset_commerce-http';
const secret = 'lite-352-commerce-internal-secret-012345';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 'session_commerce_http',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_commerce_http',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'matter:manage']
};

function setup() {
  const assets = { get: vi.fn() };
  const commerce = { get: vi.fn(), upsert: vi.fn().mockResolvedValue({ version: 1 }) };
  const routes = createTrademarkAssetReadRoutes({
    internalServiceSecret: secret,
    assets,
    commerce,
    portfolio: {},
    refreshLedger: {}
  } as unknown as TrademarkAssetReadRouteOptions);
  const write = routes.find((route) => route.method === 'POST');
  const detail = routes.find((route) => route.path === '/v1/trademark-assets/:trademarkAssetId');
  if (!write || !detail) throw new Error('Commerce routes are missing.');
  const request: JsonRequest = {
    method: 'POST',
    path: `/v1/trademark-assets/${assetId}/commerce-profile`,
    params: { trademarkAssetId: assetId },
    query: {},
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
      'x-markorbit-workspace-id': workspaceId,
      'idempotency-key': 'commerce-http-1'
    },
    body: { expectedTrademarkAssetVersion: 1, saleIntent: 'FOR_SALE', sellerRole: 'OWNER' }
  };
  return { assets, commerce, write, detail, request };
}

describe('authenticated Trademark Asset Commerce HTTP boundary', () => {
  it('derives the workspace and exact asset from trusted request context', async () => {
    const { commerce, write, request } = setup();
    expect(await write.handle(request)).toMatchObject({
      status: 200,
      body: { commerceProfile: { version: 1 } }
    });
    expect(commerce.upsert).toHaveBeenCalledWith({
      ...(request.body as object),
      workspaceId,
      trademarkAssetId: assetId,
      idempotencyKey: 'commerce-http-1'
    });
  });

  it.each([
    ['x-markorbit-internal-authorization', 'wrong', 401],
    ['x-markorbit-principal', 'invalid', 401],
    ['x-markorbit-workspace-id', '11111111-1111-4111-8111-111111111111', 404],
    ['idempotency-key', '', 400]
  ] as const)('rejects invalid %s before persistence', async (header, value, status) => {
    const { commerce, write, request } = setup();
    await expect(
      write.handle({ ...request, headers: { ...request.headers, [header]: value } })
    ).rejects.toMatchObject({ status });
    expect(commerce.upsert).not.toHaveBeenCalled();
  });

  it('rejects a read-only principal before persistence', async () => {
    const { commerce, write, request } = setup();
    await expect(
      write.handle({
        ...request,
        headers: {
          ...request.headers,
          'x-markorbit-principal': encodeInternalWorkspacePrincipal({
            ...principal,
            role: 'READ_ONLY',
            permissions: ['workspace:read']
          })
        }
      })
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    expect(commerce.upsert).not.toHaveBeenCalled();
  });

  it.each([
    { workspaceId: '11111111-1111-4111-8111-111111111111' },
    { userId: 'spoofed' },
    { actorId: 'spoofed' },
    { createdByUserId: 'spoofed' },
    { trademarkAssetId: 'trademark-asset_other' },
    { marketplaceListingCreatedByLite: true },
    { sourceTrademarkFactsMutatedByLite: true },
    { negotiable: 'yes' },
    { saleTerritories: null },
    { sellingPoints: false },
    { askingPrice: false }
  ])('rejects spoofed context and malformed optional fields: %j', async (extra) => {
    const { commerce, write, request } = setup();
    await expect(
      write.handle({ ...request, body: { ...(request.body as object), ...extra } })
    ).rejects.toMatchObject({ status: 400 });
    expect(commerce.upsert).not.toHaveBeenCalled();
  });

  it('checks asset visibility before reading its Commerce Profile', async () => {
    const { assets, commerce, detail, request } = setup();
    assets.get.mockRejectedValue(
      new TrademarkAssetPersistenceError('NOT_FOUND', 'Not found.', 404)
    );
    await expect(detail.handle({ ...request, method: 'GET' })).rejects.toMatchObject({
      status: 404
    });
    expect(assets.get).toHaveBeenCalledWith(workspaceId, assetId);
    expect(commerce.get).not.toHaveBeenCalled();
  });
});
