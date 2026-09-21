import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { describe, expect, it, vi } from 'vitest';
import type { CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayProductLoopRoutes } from '../src/product-loop-http.js';

const workspaceId = '27272727-2727-4272-8272-272727272727';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 'session_seed_review_gateway',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_seed_review_gateway',
  role: 'WORKSPACE_ADMIN',
  permissions: ['workspace:read', 'matter:manage']
};

const authenticationClient: CoreAuthenticationClient = {
  issue: vi.fn() as never,
  resolve: vi.fn() as never,
  resolveWorkspace: vi.fn(() => Promise.resolve(principal)),
  revoke: vi.fn() as never
};

function request(
  path: string,
  params: Record<string, string>,
  query: Record<string, string> = {}
): JsonRequest {
  return {
    method: 'GET',
    path,
    params,
    query,
    body: undefined,
    headers: {
      cookie: 'mo_session=seed-review-session',
      'x-markorbit-workspace-id': workspaceId,
      'x-request-id': 'seed-review-agent-read'
    }
  };
}

describe('Gateway Seed review Data Engine reads', () => {
  it('reads the exact CN agent record through authenticated Workspace context', async () => {
    const payload = {
      agent_code: 'A001',
      record: {
        agent_code: 'A001',
        entity_id: '20000000-0000-0000-0000-000000000002',
        source_reference: {
          owner: 'DATA_ENGINE',
          kind: 'CN_AGENT',
          id: 'A001',
          version: '42',
          fingerprintSha256: 'a'.repeat(64),
          observedAt: '2026-09-21T01:02:03.000Z'
        }
      },
      semantics: 'CURRENT_OFFICIAL_CNIPA_AGENT_CODE_FACT_NO_IDENTITY_RESOLUTION'
    };
    const dataEngineFetchImpl = vi.fn<typeof fetch>((input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      expect(url).toBe('https://data-engine.test/api/v1/cn/agents/A001');
      expect(new Headers(init?.headers).get('authorization')).toBe(
        'Bearer data-engine-test-key-01234567890123456789'
      );
      return Promise.resolve(
        new Response(
          JSON.stringify({
            contract_version: 'MARKORBIT_DATA_ENGINE_INTEGRATION_V1',
            engine_version: 'M1.9-test',
            source_owner: 'MARKORBIT_DATA_ENGINE',
            jurisdiction: 'CN',
            resource_kind: 'AGENT_SOURCE_RECORD',
            authority: 'DATA_ENGINE_FACT_READ_MODEL',
            legal_conclusion: false,
            fact_state: 'observed',
            payload
          }),
          {
            status: 200,
            headers: {
              'x-request-id': 'seed-review-agent-read',
              'x-correlation-id': 'seed-review-agent-read',
              'x-markorbit-contract-version': 'MARKORBIT_DATA_ENGINE_INTEGRATION_V1',
              'x-markorbit-source-owner': 'MARKORBIT_DATA_ENGINE'
            }
          }
        )
      );
    });
    const routes = createGatewayProductLoopRoutes({
      liteUrl: 'http://lite.test',
      authenticationClient,
      internalServiceSecret: 'seed-review-internal-secret-0123456789',
      csrfSecret: 'seed-review-csrf-secret-0123456789',
      allowedOrigins: ['https://lite.example.com'],
      dataEngineUrl: 'https://data-engine.test',
      dataEngineApiKey: 'data-engine-test-key-01234567890123456789',
      dataEngineFetchImpl
    });
    const route = routes.find(
      (item) => item.method === 'GET' && item.path === '/api/data-engine/cn/agents/:agentCode'
    );
    if (!route) throw new Error('Exact CN agent Seed route missing.');

    const response = await route.handle(
      request('/api/data-engine/cn/agents/A001', { agentCode: 'A001' })
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      resource_kind: 'AGENT_SOURCE_RECORD',
      payload: { agent_code: 'A001' }
    });
    expect(dataEngineFetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported query parameters before calling Data Engine', async () => {
    const dataEngineFetchImpl = vi.fn();
    const routes = createGatewayProductLoopRoutes({
      liteUrl: 'http://lite.test',
      authenticationClient,
      internalServiceSecret: 'seed-review-internal-secret-0123456789',
      csrfSecret: 'seed-review-csrf-secret-0123456789',
      allowedOrigins: ['https://lite.example.com'],
      dataEngineUrl: 'https://data-engine.test',
      dataEngineApiKey: 'data-engine-test-key-01234567890123456789',
      dataEngineFetchImpl
    });
    const route = routes.find(
      (item) => item.method === 'GET' && item.path === '/api/data-engine/cn/agents/:agentCode'
    );
    if (!route) throw new Error('Exact CN agent Seed route missing.');

    await expect(
      route.handle(
        request('/api/data-engine/cn/agents/A001', { agentCode: 'A001' }, { q: 'forged' })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    expect(dataEngineFetchImpl).not.toHaveBeenCalled();
  });
});
