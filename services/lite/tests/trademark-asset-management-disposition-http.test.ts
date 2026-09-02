import { describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import {
  createTrademarkAssetReadRoutes,
  type TrademarkAssetReadRouteOptions
} from '../src/trademark-asset-http.js';
import { TrademarkAssetManagementDispositionError } from '../src/trademark-asset-management-disposition.js';

const workspaceId = '96969696-9696-4969-8969-969696969696';
const assetId = 'trademark-asset_management-http';
const principalUserId = '11111111-1111-4111-8111-111111111111';
const secret = 'lite-management-disposition-secret-012345';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: principalUserId,
  sessionId: 'session_management_disposition',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_management_disposition',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'matter:manage']
};
const body = {
  expectedTrademarkAssetVersion: 7,
  managementSignal: { id: 'trademark-asset-management-signal_exact', version: 7 },
  recommendation: { id: 'trademark-asset-management-recommendation_exact', version: 7 },
  kind: 'WATCHED',
  note: 'Keep under active watch.'
} as const;
const disposition = {
  schemaVersion: 1,
  dispositionId: 'trademark-asset-management-disposition_http',
  workspaceId,
  version: 1,
  asset: { id: assetId, version: 7 },
  signal: body.managementSignal,
  recommendation: body.recommendation,
  kind: 'WATCHED',
  subjectUserId: principalUserId,
  note: body.note,
  recordedAt: '2026-09-02T00:00:00.000Z',
  officialTruthCreated: false,
  legalConclusionVerified: false,
  capabilityVerified: false
};
const currentProjection = {
  schemaVersion: 1,
  workspaceId,
  asset: { id: assetId, version: 7 },
  items: [{ signal: body.managementSignal, disposition }]
} as const;

function setup() {
  const dispositions = {
    record: vi.fn().mockResolvedValue(disposition),
    listCurrentForAsset: vi.fn().mockResolvedValue(currentProjection)
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
  const route = routes.find(
    (candidate) =>
      candidate.method === 'POST' &&
      candidate.path === '/v1/trademark-assets/:trademarkAssetId/management-dispositions'
  );
  if (!route) throw new Error('Management disposition route is missing.');
  const getRoutes = routes.filter(
    (candidate) =>
      candidate.method === 'GET' &&
      candidate.path === '/v1/trademark-assets/:trademarkAssetId/management-dispositions'
  );
  const getRoute = getRoutes[0];
  if (!getRoute) throw new Error('Management disposition read route is missing.');
  const request: JsonRequest = {
    method: 'POST',
    path: `/v1/trademark-assets/${assetId}/management-dispositions`,
    params: { trademarkAssetId: assetId },
    query: {},
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
      'x-markorbit-workspace-id': workspaceId,
      'idempotency-key': 'management-disposition-http-1'
    },
    body
  };
  const getRequest: JsonRequest = {
    ...request,
    method: 'GET',
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-principal': encodeInternalWorkspacePrincipal({
        ...principal,
        role: 'READ_ONLY',
        permissions: ['workspace:read']
      }),
      'x-markorbit-workspace-id': workspaceId
    },
    body: undefined
  };
  return { dispositions, getRoute, getRoutes, getRequest, route, request };
}

describe('authenticated Trademark Asset management disposition HTTP boundary', () => {
  it('registers the exact GET once and reads with workspace:read without matter:manage', async () => {
    const { dispositions, getRoute, getRoutes, getRequest } = setup();
    expect(getRoutes).toHaveLength(1);
    expect(await getRoute.handle(getRequest)).toEqual({
      status: 200,
      body: currentProjection
    });
    expect(dispositions.listCurrentForAsset).toHaveBeenCalledOnce();
    expect(dispositions.listCurrentForAsset).toHaveBeenCalledWith(workspaceId, assetId);
  });

  it.each([
    ['x-markorbit-internal-authorization', 'wrong', 401, 'UNTRUSTED_INTERNAL_CALLER'],
    ['x-markorbit-principal', 'invalid', 401, 'INVALID_INTERNAL_PRINCIPAL'],
    ['x-markorbit-workspace-id', '22222222-2222-4222-8222-222222222222', 404, 'WORKSPACE_MISMATCH']
  ] as const)('rejects invalid GET %s before persistence', async (header, value, status, code) => {
    const { dispositions, getRoute, getRequest } = setup();
    await expect(
      getRoute.handle({ ...getRequest, headers: { ...getRequest.headers, [header]: value } })
    ).rejects.toMatchObject({ status, code });
    expect(dispositions.listCurrentForAsset).not.toHaveBeenCalled();
  });

  it('requires workspace:read for GET', async () => {
    const { dispositions, getRoute, getRequest } = setup();
    await expect(
      getRoute.handle({
        ...getRequest,
        headers: {
          ...getRequest.headers,
          'x-markorbit-principal': encodeInternalWorkspacePrincipal({
            ...principal,
            permissions: ['matter:manage']
          })
        }
      })
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    expect(dispositions.listCurrentForAsset).not.toHaveBeenCalled();
  });

  it.each([
    { query: { workspaceId: '22222222-2222-4222-8222-222222222222' } },
    { query: { subjectUserId: 'spoofed' } },
    { body: { managementSignal: body.managementSignal } }
  ])('rejects caller-supplied GET scope or management input: %j', async (replacement) => {
    const { dispositions, getRoute, getRequest } = setup();
    await expect(getRoute.handle({ ...getRequest, ...replacement })).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_REQUEST'
    });
    expect(dispositions.listCurrentForAsset).not.toHaveBeenCalled();
  });

  it.each([
    ['INVALID_INPUT', 400, false],
    ['NOT_FOUND', 404, false],
    ['PERSISTENCE_UNAVAILABLE', 503, true]
  ] as const)('preserves GET owner error %s', async (code, status, retryable) => {
    const { dispositions, getRoute, getRequest } = setup();
    dispositions.listCurrentForAsset.mockRejectedValueOnce(
      new TrademarkAssetManagementDispositionError(code, `owner ${code}`, status, retryable)
    );
    await expect(getRoute.handle(getRequest)).rejects.toMatchObject({
      status,
      code,
      message: `owner ${code}`,
      retryable
    });
  });

  it.each(['WATCHED', 'DEFERRED', 'DISMISSED', 'CONTINUED'] as const)(
    'forwards exact %s owner references and principal-derived identity once',
    async (kind) => {
      const { dispositions, route, request } = setup();
      const exactBody = { ...body, kind };
      expect(await route.handle({ ...request, body: exactBody })).toEqual({
        status: 200,
        body: { disposition }
      });
      expect(dispositions.record).toHaveBeenCalledOnce();
      expect(dispositions.record).toHaveBeenCalledWith({
        workspaceId,
        trademarkAssetId: assetId,
        expectedTrademarkAssetVersion: 7,
        managementSignal: body.managementSignal,
        recommendation: body.recommendation,
        kind,
        subjectUserId: principalUserId,
        note: body.note,
        idempotencyKey: 'management-disposition-http-1'
      });
    }
  );

  it.each([
    ['x-markorbit-internal-authorization', 'wrong', 401, 'UNTRUSTED_INTERNAL_CALLER'],
    ['x-markorbit-principal', 'invalid', 401, 'INVALID_INTERNAL_PRINCIPAL'],
    ['x-markorbit-workspace-id', '22222222-2222-4222-8222-222222222222', 404, 'WORKSPACE_MISMATCH'],
    ['idempotency-key', '', 400, 'IDEMPOTENCY_KEY_REQUIRED']
  ] as const)('rejects invalid %s before persistence', async (header, value, status, code) => {
    const { dispositions, route, request } = setup();
    await expect(
      route.handle({ ...request, headers: { ...request.headers, [header]: value } })
    ).rejects.toMatchObject({ status, code });
    expect(dispositions.record).not.toHaveBeenCalled();
  });

  it('requires matter:manage after trusted Workspace resolution', async () => {
    const { dispositions, route, request } = setup();
    await expect(
      route.handle({
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
    expect(dispositions.record).not.toHaveBeenCalled();
  });

  it.each([
    { workspaceId: '22222222-2222-4222-8222-222222222222' },
    { trademarkAssetId: 'trademark-asset_spoofed' },
    { subjectUserId: 'spoofed' },
    { actorId: 'spoofed' },
    { userId: 'spoofed' },
    { principalId: 'spoofed' },
    { membershipId: 'spoofed' },
    { workflowReference: { kind: 'MATTER', id: 'matter_spoofed', version: 1 } },
    { filingAuthorized: true },
    { paymentAuthorized: true },
    { customerContactAuthorized: true },
    { externalPublicationAuthorized: true },
    { authority: 'SELF_DECLARED' }
  ])(
    'fails closed for spoofed identity, workflow, or protected-action input: %j',
    async (extra) => {
      const { dispositions, route, request } = setup();
      await expect(
        route.handle({ ...request, body: { ...(request.body as object), ...extra } })
      ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
      expect(dispositions.record).not.toHaveBeenCalled();
    }
  );

  it.each([
    { managementSignal: { ...body.managementSignal, assetId } },
    { recommendation: { ...body.recommendation, workflowReference: 'workflow_spoofed' } },
    { expectedTrademarkAssetVersion: 0 },
    { managementSignal: { ...body.managementSignal, version: 0 } },
    { recommendation: { ...body.recommendation, version: 1.5 } },
    { kind: 'RESOLVED_BY_WORKFLOW_REFERENCE' }
  ])('rejects malformed or browser-forbidden disposition input: %j', async (replacement) => {
    const { dispositions, route, request } = setup();
    await expect(
      route.handle({ ...request, body: { ...(request.body as object), ...replacement } })
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    expect(dispositions.record).not.toHaveBeenCalled();
  });

  it.each([
    ['INVALID_INPUT', 400, false],
    ['NOT_FOUND', 404, false],
    ['VERSION_CONFLICT', 409, false],
    ['IDEMPOTENCY_CONFLICT', 409, false],
    ['LEASE_CONFLICT', 409, false],
    ['PERSISTENCE_UNAVAILABLE', 503, true]
  ] as const)('preserves owner error %s', async (code, status, retryable) => {
    const { dispositions, route, request } = setup();
    dispositions.record.mockRejectedValueOnce(
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
