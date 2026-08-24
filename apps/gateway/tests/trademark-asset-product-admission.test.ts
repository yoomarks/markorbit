import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayProductLoopRoutes } from '../src/product-loop-http.js';

const workspaceId = '56565656-5656-4656-8656-565656565656';
const assetId = 'trademark-asset_mo-de-010';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 'session_mo_de_010',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_mo_de_010',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read']
};

function auth(): CoreAuthenticationClient {
  return {
    issue: () => Promise.reject(new Error('not expected')),
    resolve: () => Promise.reject(new Error('not expected')),
    resolveWorkspace: vi.fn(() => Promise.resolve(principal)),
    revoke: () => Promise.resolve()
  };
}

function baseDetail(jurisdiction = 'US') {
  return {
    view: {
      schemaVersion: 1,
      trademarkAssetId: assetId,
      workspaceId,
      anchorVersion: 1,
      anchor: {
        schemaVersion: 1,
        trademarkAssetId: assetId,
        workspaceId,
        version: 1,
        identity: { jurisdiction, markText: 'MARKORBIT' },
        externalIdentifiers: [
          {
            kind: 'APPLICATION_NUMBER',
            jurisdiction,
            value: jurisdiction === 'US' ? '98123456' : '12345678',
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
      },
      observedFacts: [],
      contextSignals: [],
      conflicts: [],
      sourceReferences: [],
      freshness: 'UNKNOWN',
      composedAt: '2026-08-24T01:00:00.000Z',
      officialTruthVerifiedByLite: false,
      legalDeadlineCertified: false,
      protectedActionAuthorized: false
    },
    attention: [],
    managementSignals: [],
    recommendations: []
  };
}

function providerResponse(init: RequestInit) {
  const headers = init.headers as Record<string, string>;
  return new Response(
    JSON.stringify({
      contract_version: 'MARKORBIT_DATA_ENGINE_INTEGRATION_V1',
      engine_version: 'M1.7-test',
      source_owner: 'MARKORBIT_DATA_ENGINE',
      jurisdiction: 'US',
      resource_kind: 'TRADEMARK_CASE',
      authority: 'DATA_ENGINE_FACT_READ_MODEL',
      legal_conclusion: false,
      fact_state: 'observed',
      payload: {
        case: {
          serial_number: '98123456',
          status_code: '700',
          filing_date: '2024-01-02',
          registration_date: '2025-03-04',
          renewal_date: '2035-03-04',
          record_hash: 'a'.repeat(64),
          ingested_at: '2026-08-24T02:00:00.000Z'
        },
        owners: [
          {
            party_name: 'MarkOrbit Owner LLC',
            record_hash: 'b'.repeat(64),
            ingested_at: '2026-08-24T02:01:00.000Z'
          }
        ],
        classifications: [
          {
            international_codes: ['009', '035'],
            record_hash: 'c'.repeat(64),
            ingested_at: '2026-08-24T02:02:00.000Z'
          }
        ]
      }
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'x-request-id': headers['X-Request-ID']!,
        'x-correlation-id': headers['x-correlation-id']!,
        'x-markorbit-contract-version': 'MARKORBIT_DATA_ENGINE_INTEGRATION_V1',
        'x-markorbit-source-owner': 'MARKORBIT_DATA_ENGINE'
      }
    }
  );
}

function detailRoute(input: {
  liteFetch: typeof fetch;
  dataEngineFetch: typeof fetch;
  authenticationClient?: CoreAuthenticationClient;
}) {
  vi.stubGlobal('fetch', input.liteFetch);
  const route = createGatewayProductLoopRoutes({
    liteUrl: 'http://lite.test',
    authenticationClient: input.authenticationClient ?? auth(),
    internalServiceSecret: 'mo-de-010-internal-secret-0123456789',
    csrfSecret: 'mo-de-010-csrf-secret-012345678901',
    allowedOrigins: ['https://app.markorbit.test'],
    dataEngineUrl: 'http://data-engine.test',
    dataEngineApiKey: 'mo-de-010-data-engine-key-012345678901',
    dataEngineFetchImpl: input.dataEngineFetch
  }).find(
    (candidate) =>
      candidate.method === 'GET' &&
      candidate.path === '/api/lite/trademark-assets/:trademarkAssetId'
  );
  if (!route) throw new Error('Trademark Asset detail route missing.');
  return route;
}

function request() {
  return {
    method: 'GET' as const,
    path: `/api/lite/trademark-assets/${assetId}`,
    params: { trademarkAssetId: assetId },
    query: {},
    headers: {
      cookie: 'mo_session=session-token',
      'x-markorbit-workspace-id': workspaceId,
      'x-correlation-id': 'correlation-mo-de-010'
    },
    body: undefined
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('MO-DE-010 Gateway Trademark Asset admission', () => {
  it('reads an eligible US Asset, maps Data Engine facts and asks Lite to recompose', async () => {
    const base = baseDetail('US');
    const enriched = {
      ...base,
      view: {
        ...base.view,
        observedFacts: [{ kind: 'APPLICATION_STATUS', value: '700' }],
        officialTruthVerifiedByLite: false,
        legalDeadlineCertified: false,
        protectedActionAuthorized: false
      }
    };
    const liteFetch = vi.fn((url: string, init: RequestInit) => {
      if (init.method === 'GET') {
        expect(url).toBe(`http://lite.test/v1/trademark-assets/${assetId}`);
        return Promise.resolve(new Response(JSON.stringify(base), { status: 200 }));
      }
      expect(url).toBe(
        `http://lite.test/internal/v1/workspaces/${workspaceId}/trademark-assets/${assetId}/compose`
      );
      if (typeof init.body !== 'string') throw new Error('Expected JSON string request body.');
      const body = JSON.parse(init.body) as { facts: Array<Record<string, unknown>> };
      expect(body.facts.map((fact) => fact.kind)).toEqual([
        'APPLICATION_STATUS',
        'APPLICATION_DATE',
        'REGISTRATION_DATE',
        'RENEWAL_DATE',
        'OWNER_NAME',
        'NICE_CLASSES'
      ]);
      expect(
        body.facts.every((fact) => (fact.source as Record<string, unknown>).owner === 'DATA_ENGINE')
      ).toBe(true);
      return Promise.resolve(new Response(JSON.stringify(enriched), { status: 200 }));
    }) as unknown as typeof fetch;
    const dataEngineFetch = vi.fn((_url: string, init: RequestInit) =>
      Promise.resolve(providerResponse(init))
    ) as unknown as typeof fetch;

    const result = await detailRoute({ liteFetch, dataEngineFetch }).handle(request());

    expect(result.status).toBe(200);
    expect(result.body).toEqual(enriched);
    expect(dataEngineFetch).toHaveBeenCalledTimes(1);
    expect(liteFetch).toHaveBeenCalledTimes(2);
  });

  it('degrades to the original M10 detail on provider failure without composing absence', async () => {
    const base = baseDetail('US');
    const liteFetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(base), { status: 200 }))
    ) as unknown as typeof fetch;
    const dataEngineFetch = vi.fn(() =>
      Promise.reject(new Error('provider unavailable'))
    ) as unknown as typeof fetch;

    const result = await detailRoute({ liteFetch, dataEngineFetch }).handle(request());

    expect(result.status).toBe(200);
    expect(result.body).toEqual(base);
    expect(dataEngineFetch).toHaveBeenCalledTimes(1);
    expect(liteFetch).toHaveBeenCalledTimes(1);
  });

  it('does not query Data Engine for an unsupported jurisdiction', async () => {
    const base = baseDetail('EU');
    const liteFetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(base), { status: 200 }))
    ) as unknown as typeof fetch;
    const dataEngineFetch = vi.fn() as unknown as typeof fetch;

    const result = await detailRoute({ liteFetch, dataEngineFetch }).handle(request());

    expect(result.status).toBe(200);
    expect(result.body).toEqual(base);
    expect(dataEngineFetch).not.toHaveBeenCalled();
    expect(liteFetch).toHaveBeenCalledTimes(1);
  });

  it('rejects unauthenticated callers before Lite or Data Engine access', async () => {
    const liteFetch = vi.fn() as unknown as typeof fetch;
    const dataEngineFetch = vi.fn() as unknown as typeof fetch;
    const route = detailRoute({ liteFetch, dataEngineFetch });
    const unauthenticated = request();
    unauthenticated.headers = {
      'x-markorbit-workspace-id': workspaceId,
      'x-correlation-id': 'correlation-mo-de-010'
    } as typeof unauthenticated.headers;

    await expect(route.handle(unauthenticated)).rejects.toMatchObject({
      status: 401,
      code: 'AUTHENTICATION_REQUIRED'
    });
    expect(liteFetch).not.toHaveBeenCalled();
    expect(dataEngineFetch).not.toHaveBeenCalled();
  });
});
