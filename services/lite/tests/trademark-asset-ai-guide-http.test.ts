import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { TrademarkAssetAiGuidePreparedResult } from '@markorbit/contracts/trademark-asset-ai-guide';
import type { JsonRequest } from '@markorbit/service-kit';
import {
  createTrademarkAssetReadRoutes,
  type TrademarkAssetReadRouteOptions
} from '../src/trademark-asset-http.js';
import {
  TrademarkAssetAiGuidePreparer,
  type TrademarkAssetAiGuidePrepareRequest
} from '../src/trademark-asset-ai-guide.js';

const workspaceId = '96969696-9696-4969-8969-969696969696';
const assetId = 'trademark-asset_ai-guide-http';
const secret = 'lite-548-ai-guide-internal-secret-012345';
const source = {
  owner: 'MARKREG',
  kind: 'MARKREG_LIFECYCLE_PROJECTION',
  sourceId: 'matter_ai-guide-http',
  sourceVersion: '7',
  observedAt: '2026-09-02T00:00:00.000Z',
  freshness: 'STALE'
} as const;
const anchor = {
  schemaVersion: 1,
  trademarkAssetId: assetId,
  workspaceId,
  version: 3,
  identity: { jurisdiction: 'US', markText: 'MARK ORBIT' },
  externalIdentifiers: [],
  workspaceRelationships: [{ kind: 'REPRESENTED', sourceAssetEditableByWorkspace: true }],
  sourceReferences: [source],
  relations: [],
  workspaceTags: [],
  workspaceNotes: [],
  officialTruthVerifiedByLite: false,
  filingExecutedByLite: false,
  createdAt: '2026-09-02T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z'
} as const;
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 'session_ai_guide_http',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_ai_guide_http',
  role: 'READ_ONLY',
  permissions: ['workspace:read']
};

function setup() {
  const assets = { get: vi.fn().mockResolvedValue(anchor) };
  const commerce = { get: vi.fn(), upsert: vi.fn() };
  const aiGuide = {
    prepare: vi.fn(
      (
        input: Readonly<TrademarkAssetAiGuidePrepareRequest>
      ): TrademarkAssetAiGuidePreparedResult => ({
        schemaVersion: 1,
        workspaceId: input.workspaceId,
        subjectUserId: input.subjectUserId,
        trademarkAssetId: input.view.trademarkAssetId,
        trademarkAssetVersion: input.view.anchorVersion,
        contextReferences: [],
        evidence: input.view.sourceReferences,
        suggestions: [],
        staleOrConflictingEvidencePresent: true,
        officialTruthCreatedByGuide: false,
        officialStatusVerifiedByGuide: false,
        deadlineCertifiedByGuide: false,
        externalActionAuthorizedByGuide: false,
        customerOrProviderContactAuthorizedByGuide: false,
        paidExecutionAuthorizedByGuide: false,
        generatedAt: '2026-09-02T01:00:00.000Z'
      })
    )
  };
  const routes = createTrademarkAssetReadRoutes({
    internalServiceSecret: secret,
    assets,
    commerce,
    aiGuide,
    portfolio: {},
    refreshLedger: {},
    now: () => '2026-09-02T01:00:00.000Z'
  } as unknown as TrademarkAssetReadRouteOptions);
  const route = routes.find(
    (candidate) =>
      candidate.method === 'POST' &&
      candidate.path === '/v1/trademark-assets/:trademarkAssetId/ai-guide'
  );
  if (!route) throw new Error('AI Guide route is missing.');
  const request: JsonRequest = {
    method: 'POST',
    path: `/v1/trademark-assets/${assetId}/ai-guide`,
    params: { trademarkAssetId: assetId },
    query: {},
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
      'x-markorbit-workspace-id': workspaceId
    },
    body: { expectedTrademarkAssetVersion: 3, requestedKinds: ['EXPLAIN_ASSET'] }
  };
  return { aiGuide, assets, commerce, request, route };
}

describe('authenticated Trademark Asset AI Guide HTTP boundary', () => {
  it('uses owner-derived identity and the current composed View without writes or network calls', async () => {
    const { aiGuide, assets, commerce, request, route } = setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const response = await route.handle(request);

    expect(response).toMatchObject({
      status: 200,
      body: {
        workspaceId,
        subjectUserId: principal.userId,
        trademarkAssetId: assetId,
        trademarkAssetVersion: 3,
        staleOrConflictingEvidencePresent: true,
        officialTruthCreatedByGuide: false,
        officialStatusVerifiedByGuide: false,
        deadlineCertifiedByGuide: false,
        externalActionAuthorizedByGuide: false,
        customerOrProviderContactAuthorizedByGuide: false,
        paidExecutionAuthorizedByGuide: false
      }
    });
    expect(assets.get).toHaveBeenCalledWith(workspaceId, assetId);
    const preparedInput = aiGuide.prepare.mock.calls[0]?.[0];
    expect(preparedInput).toMatchObject({
      workspaceId,
      subjectUserId: principal.userId,
      requestedKinds: ['EXPLAIN_ASSET']
    });
    expect(preparedInput?.view).toMatchObject({
      anchor,
      anchorVersion: 3,
      sourceReferences: [source],
      composedAt: '2026-09-02T01:00:00.000Z'
    });
    expect(commerce.upsert).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('preserves stale evidence and every advisory authority lock from the existing preparer', async () => {
    const { assets, commerce, request } = setup();
    const routes = createTrademarkAssetReadRoutes({
      internalServiceSecret: secret,
      assets,
      commerce,
      aiGuide: new TrademarkAssetAiGuidePreparer(
        () => '2026-09-02T01:00:00.000Z',
        () => '00000000-0000-4000-8000-000000000548'
      ),
      portfolio: {},
      refreshLedger: {},
      now: () => '2026-09-02T01:00:00.000Z'
    } as unknown as TrademarkAssetReadRouteOptions);
    const route = routes.find(
      (candidate) =>
        candidate.method === 'POST' &&
        candidate.path === '/v1/trademark-assets/:trademarkAssetId/ai-guide'
    );
    if (!route) throw new Error('AI Guide route is missing.');

    const response = await route.handle(request);
    expect(response).toMatchObject({
      status: 200,
      body: {
        workspaceId,
        subjectUserId: principal.userId,
        trademarkAssetId: assetId,
        trademarkAssetVersion: 3,
        evidence: [source],
        staleOrConflictingEvidencePresent: true,
        officialTruthCreatedByGuide: false,
        officialStatusVerifiedByGuide: false,
        deadlineCertifiedByGuide: false,
        externalActionAuthorizedByGuide: false,
        customerOrProviderContactAuthorizedByGuide: false,
        paidExecutionAuthorizedByGuide: false,
        suggestions: [
          {
            userConfirmationRequiredForAnyConsequence: true,
            externalActionAuthorized: false,
            filingAuthorized: false,
            customerOrProviderContactAuthorized: false,
            paidExecutionAuthorized: false,
            officialTruthVerified: false,
            capabilityVerified: false,
            staleOrConflictingEvidencePresent: true
          }
        ]
      }
    });
  });

  it.each([
    ['x-markorbit-internal-authorization', 'wrong', 401],
    ['x-markorbit-principal', 'invalid', 401],
    ['x-markorbit-workspace-id', '11111111-1111-4111-8111-111111111111', 404]
  ] as const)('rejects invalid %s before reading owner state', async (header, value, status) => {
    const { aiGuide, assets, request, route } = setup();
    await expect(
      route.handle({ ...request, headers: { ...request.headers, [header]: value } })
    ).rejects.toMatchObject({ status });
    expect(assets.get).not.toHaveBeenCalled();
    expect(aiGuide.prepare).not.toHaveBeenCalled();
  });

  it('requires workspace:read before reading owner state', async () => {
    const { aiGuide, assets, request, route } = setup();
    await expect(
      route.handle({
        ...request,
        headers: {
          ...request.headers,
          'x-markorbit-principal': encodeInternalWorkspacePrincipal({
            ...principal,
            permissions: []
          })
        }
      })
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    expect(assets.get).not.toHaveBeenCalled();
    expect(aiGuide.prepare).not.toHaveBeenCalled();
  });

  it.each([
    { workspaceId: '11111111-1111-4111-8111-111111111111' },
    { subjectUserId: 'spoofed' },
    { userId: 'spoofed' },
    { actorId: 'spoofed' },
    { principalId: 'spoofed' },
    { membershipId: 'spoofed' },
    { trademarkAssetId: 'trademark-asset_other' },
    { evidence: [] },
    { contextReferences: [] },
    { view: {} },
    { commerceProfile: {} },
    { marketplaceOverlay: {} }
  ])('rejects caller-supplied identity, provenance or context: %j', async (extra) => {
    const { aiGuide, assets, request, route } = setup();
    await expect(
      route.handle({ ...request, body: { ...(request.body as object), ...extra } })
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    expect(assets.get).not.toHaveBeenCalled();
    expect(aiGuide.prepare).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    null,
    [],
    { expectedTrademarkAssetVersion: 0, requestedKinds: ['EXPLAIN_ASSET'] },
    { expectedTrademarkAssetVersion: 1.5, requestedKinds: ['EXPLAIN_ASSET'] },
    { expectedTrademarkAssetVersion: 3, requestedKinds: [] },
    { expectedTrademarkAssetVersion: 3, requestedKinds: ['UNSUPPORTED'] },
    { expectedTrademarkAssetVersion: 3, requestedKinds: ['EXPLAIN_ASSET', 'EXPLAIN_ASSET'] }
  ])('rejects malformed guide input before reading owner state: %j', async (body) => {
    const { aiGuide, assets, request, route } = setup();
    await expect(route.handle({ ...request, body })).rejects.toMatchObject({ status: 400 });
    expect(assets.get).not.toHaveBeenCalled();
    expect(aiGuide.prepare).not.toHaveBeenCalled();
  });

  it('returns an explicit conflict for a stale expected Asset version', async () => {
    const { aiGuide, commerce, request, route } = setup();
    await expect(
      route.handle({
        ...request,
        body: { expectedTrademarkAssetVersion: 2, requestedKinds: ['EXPLAIN_ASSET'] }
      })
    ).rejects.toMatchObject({ status: 409, code: 'ASSET_VERSION_CONFLICT' });
    expect(commerce.get).not.toHaveBeenCalled();
    expect(aiGuide.prepare).not.toHaveBeenCalled();
  });

  it('passes only a same-Asset-version Commerce Profile as bounded private context', async () => {
    const { aiGuide, commerce, request, route } = setup();
    const commerceProfile = {
      commerceProfileId: 'trademark-asset-commerce_ai-guide-http',
      workspaceId,
      trademarkAssetId: assetId,
      trademarkAssetVersion: 3,
      version: 2
    };
    commerce.get.mockResolvedValue(commerceProfile);
    await route.handle(request);
    expect(aiGuide.prepare).toHaveBeenCalledWith(expect.objectContaining({ commerceProfile }));
    expect(aiGuide.prepare.mock.calls[0]?.[0]).not.toHaveProperty('marketplaceOverlay');
  });

  it('fails closed when the Commerce Profile targets another Asset version', async () => {
    const { aiGuide, commerce, request, route } = setup();
    commerce.get.mockResolvedValue({ trademarkAssetVersion: 2 });
    await expect(route.handle(request)).rejects.toMatchObject({
      status: 409,
      code: 'COMMERCE_PROFILE_VERSION_CONFLICT'
    });
    expect(aiGuide.prepare).not.toHaveBeenCalled();
  });

  it('wires the deterministic preparer into the production owner runtime', () => {
    const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
    expect(main).toContain('const trademarkAssetAiGuide = new TrademarkAssetAiGuidePreparer();');
    expect(main).toContain('aiGuide: trademarkAssetAiGuide');
  });
});
