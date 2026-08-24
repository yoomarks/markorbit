import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import {
  DATA_ENGINE_FACT_AUTHORITY,
  DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
  DATA_ENGINE_SOURCE_OWNER
} from '@markorbit/contracts/data-engine';
import type { CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayDataEngineRoutes } from '../src/data-engine-product-http.js';

const workspaceId = '93939393-9393-4939-8939-939393939393';
const apiKey = 'mo-de-009-query-contract-key-00000000000000000000';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: 'user_mo_de_009_query',
  sessionId: 'session_mo_de_009_query',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_mo_de_009_query',
  role: 'READ_ONLY',
  permissions: ['workspace:read']
};
const authenticationClient: CoreAuthenticationClient = {
  issue: () => Promise.reject(new Error('not used')),
  resolve: () => Promise.reject(new Error('not used')),
  resolveWorkspace: () => Promise.resolve(principal),
  revoke: () => Promise.resolve()
};

function providerResponse(
  body: unknown,
  requestId = 'query-contract-request',
  correlationId = 'query-contract-correlation'
) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'x-request-id': requestId,
      'x-correlation-id': correlationId,
      'x-markorbit-contract-version': DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
      'x-markorbit-source-owner': DATA_ENGINE_SOURCE_OWNER
    }
  });
}

function factEnvelope(resourceKind: 'TRADEMARK_CASE_360' | 'TRADEMARK_CASE_HISTORY') {
  return {
    contract_version: DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
    engine_version: 'M1.7',
    source_owner: DATA_ENGINE_SOURCE_OWNER,
    jurisdiction: 'US',
    resource_kind: resourceKind,
    authority: DATA_ENGINE_FACT_AUTHORITY,
    legal_conclusion: false,
    fact_state: 'observed',
    payload: {}
  };
}

function request(path: string, query: Record<string, string>) {
  return {
    method: 'GET',
    path,
    params: { serialNumber: '99123456' },
    query,
    headers: {
      cookie: 'mo_session=query-contract-token',
      'x-markorbit-workspace-id': workspaceId,
      'x-request-id': 'query-contract-request',
      'x-correlation-id': 'query-contract-correlation'
    },
    body: undefined
  } as const;
}

function route(path: string, fetchImpl: typeof fetch) {
  const value = createGatewayDataEngineRoutes({
    dataEngineUrl: 'http://data-engine.test',
    dataEngineApiKey: apiKey,
    authenticationClient,
    fetchImpl
  }).find((candidate) => candidate.method === 'GET' && candidate.path === path);
  if (!value) throw new Error(`Missing route ${path}`);
  return value;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('MO-DE-009 frozen product query contract', () => {
  it('forwards every frozen US 360 query parameter without widening the contract', async () => {
    const provider = vi.fn((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      expect(url).toBe(
        'http://data-engine.test/api/v1/us/cases/99123456/360?as_of=2026-08-24&history_limit=5000&assignment_limit=500&ttab_limit=500'
      );
      expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${apiKey}`);
      return Promise.resolve(providerResponse(factEnvelope('TRADEMARK_CASE_360')));
    }) as typeof fetch;

    const result = await route('/api/data-engine/us/cases/:serialNumber/360', provider).handle(
      request('/api/data-engine/us/cases/99123456/360', {
        as_of: '2026-08-24',
        history_limit: '5000',
        assignment_limit: '500',
        ttab_limit: '500'
      })
    );

    expect(result.status).toBe(200);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('rejects a history limit above the frozen provider maximum before provider access', async () => {
    const provider = vi.fn() as typeof fetch;
    await expect(
      Promise.resolve().then(() =>
        route('/api/data-engine/us/cases/:serialNumber/history', provider).handle(
          request('/api/data-engine/us/cases/99123456/history', { limit: '5001' })
        )
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    expect(provider).not.toHaveBeenCalled();
  });

  it('rejects unknown query keys instead of silently dropping them', async () => {
    const provider = vi.fn() as typeof fetch;
    await expect(
      Promise.resolve().then(() =>
        route('/api/data-engine/us/cases/:serialNumber/history', provider).handle(
          request('/api/data-engine/us/cases/99123456/history', { cursor: 'unexpected' })
        )
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    expect(provider).not.toHaveBeenCalled();
  });

  it('rejects invalid as_of calendar dates before provider access', async () => {
    const provider = vi.fn() as typeof fetch;
    await expect(
      Promise.resolve().then(() =>
        route('/api/data-engine/us/cases/:serialNumber/360', provider).handle(
          request('/api/data-engine/us/cases/99123456/360', { as_of: '2026-02-31' })
        )
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    expect(provider).not.toHaveBeenCalled();
  });
});
