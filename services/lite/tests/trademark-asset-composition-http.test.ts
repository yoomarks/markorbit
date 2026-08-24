import { describe, expect, it, vi } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { TrademarkAsset } from '@markorbit/contracts/trademark-asset-workspace';
import { createTrademarkAssetCompositionRoutes } from '../src/trademark-asset-composition-http.js';
import type { PostgresLiteTrademarkAssetStore } from '../src/trademark-asset.js';
import type { PostgresTrademarkAssetRefreshLedger } from '../src/trademark-asset-refresh.js';

const workspaceId = '67676767-6767-4676-8676-676767676767';
const assetId = 'trademark-asset_mo-de-010-lite';
const internalServiceSecret = 'mo-de-010-lite-internal-secret-012345';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 'session_mo_de_010_lite',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_mo_de_010_lite',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read']
};
const anchor: TrademarkAsset = {
  schemaVersion: 1,
  trademarkAssetId: assetId,
  workspaceId,
  version: 1,
  identity: { jurisdiction: 'US', markText: 'MARKORBIT' },
  externalIdentifiers: [
    {
      kind: 'APPLICATION_NUMBER',
      jurisdiction: 'US',
      value: '98123456',
      officialTruthVerifiedByLite: false
    }
  ],
  workspaceRelationships: [{ kind: 'MANAGED', sourceAssetEditableByWorkspace: false }],
  sourceReferences: [],
  relations: [],
  workspaceTags: [],
  workspaceNotes: [],
  officialTruthVerifiedByLite: false,
  filingExecutedByLite: false,
  createdAt: '2026-08-24T01:00:00.000Z',
  updatedAt: '2026-08-24T01:00:00.000Z'
};

function route() {
  const getAsset = vi.fn(() => Promise.resolve(anchor));
  const assets = {
    get: getAsset
  } as unknown as PostgresLiteTrademarkAssetStore;
  const refreshLedger = {
    listRecent: vi.fn(() => Promise.resolve([]))
  } as unknown as PostgresTrademarkAssetRefreshLedger;
  const value = createTrademarkAssetCompositionRoutes({
    internalServiceSecret,
    assets,
    refreshLedger,
    now: () => '2026-08-24T03:00:00.000Z'
  })[0];
  if (!value) throw new Error('composition route missing');
  return { value, getAsset, refreshLedger };
}

function request(facts: unknown, secret = internalServiceSecret) {
  return {
    method: 'POST' as const,
    path: `/internal/v1/workspaces/${workspaceId}/trademark-assets/${assetId}/compose`,
    params: { workspaceId, trademarkAssetId: assetId },
    query: {},
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
      'x-markorbit-workspace-id': workspaceId
    },
    body: { facts }
  };
}

const dataEngineSource = {
  owner: 'DATA_ENGINE',
  kind: 'DATA_ENGINE_TRADEMARK_RECORD',
  sourceId: 'US:98123456:case',
  sourceVersion: `M1.7-test:${'a'.repeat(16)}`,
  sourceFingerprintSha256: 'a'.repeat(64),
  observedAt: '2026-08-24T02:00:00.000Z',
  freshness: 'UNKNOWN'
};

describe('MO-DE-010 Lite trusted Trademark Asset recomposition', () => {
  it('recomposes admitted Data Engine facts while preserving authority invariants', async () => {
    const { value, getAsset } = route();
    const result = await value.handle(
      request([
        {
          kind: 'APPLICATION_STATUS',
          value: '700',
          source: dataEngineSource,
          consequential: true
        },
        { kind: 'NICE_CLASSES', value: ['009', '035'], source: dataEngineSource }
      ])
    );

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      view: {
        trademarkAssetId: assetId,
        officialTruthVerifiedByLite: false,
        legalDeadlineCertified: false,
        protectedActionAuthorized: false,
        observedFacts: [
          expect.objectContaining({ kind: 'APPLICATION_STATUS', value: '700' }),
          expect.objectContaining({ kind: 'NICE_CLASSES', value: ['009', '035'] })
        ]
      }
    });
    expect(getAsset).toHaveBeenCalledWith(workspaceId, assetId);
  });

  it('rejects untrusted callers before reading the Asset', async () => {
    const { value, getAsset } = route();
    await expect(value.handle(request([], 'wrong-secret'))).rejects.toMatchObject({
      status: 401,
      code: 'UNTRUSTED_INTERNAL_CALLER'
    });
    expect(getAsset).not.toHaveBeenCalled();
  });

  it('rejects non-Data-Engine fact ownership and lifecycle-stage injection', async () => {
    const { value } = route();
    await expect(
      value.handle(
        request([
          {
            kind: 'APPLICATION_STATUS',
            value: 'REGISTERED',
            source: { ...dataEngineSource, owner: 'KNOWLEDGE', kind: 'KNOWLEDGE_SOURCE' }
          }
        ])
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });

    await expect(
      value.handle(
        request([{ kind: 'LIFECYCLE_STAGE', value: 'REGISTERED', source: dataEngineSource }])
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
  });
});
