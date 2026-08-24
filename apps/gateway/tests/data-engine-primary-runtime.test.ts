import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DATA_ENGINE_FACT_AUTHORITY,
  DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
  DATA_ENGINE_SOURCE_OWNER
} from '@markorbit/contracts/data-engine';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { CoreAuthenticationClient } from '../src/auth.js';
import { createRuntime } from '../src/index.js';

const workspaceId = '91919191-9191-4919-8919-919191919191';
const apiKey = 'mo-de-009-primary-gateway-key-000000000000000000';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: 'user_mo_de_009',
  sessionId: 'session_mo_de_009',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_mo_de_009',
  role: 'READ_ONLY',
  permissions: ['workspace:read']
};

function authFor(resolved: WorkspacePrincipal = principal) {
  const resolveWorkspace = vi.fn(() => Promise.resolve(resolved));
  const client: CoreAuthenticationClient = {
    issue: () => Promise.reject(new Error('not used')),
    resolve: () => Promise.reject(new Error('not used')),
    resolveWorkspace,
    revoke: () => Promise.resolve()
  };
  return { client, resolveWorkspace };
}

function factEnvelope() {
  return {
    contract_version: DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
    engine_version: 'M1.7',
    source_owner: DATA_ENGINE_SOURCE_OWNER,
    jurisdiction: 'CN',
    resource_kind: 'TRADEMARK_CASE',
    authority: DATA_ENGINE_FACT_AUTHORITY,
    legal_conclusion: false,
    fact_state: 'observed',
    payload: { application_number: '12345678' }
  };
}

function providerResponse(
  body: unknown,
  requestId: string,
  correlationId: string,
  status = 200,
  extraHeaders: HeadersInit = {}
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'x-request-id': requestId,
      'x-correlation-id': correlationId,
      'x-markorbit-contract-version': DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
      'x-markorbit-source-owner': DATA_ENGINE_SOURCE_OWNER,
      ...Object.fromEntries(new Headers(extraHeaders))
    }
  });
}

async function withRuntime<T>(
  options: Parameters<typeof createRuntime>[0],
  run: (baseUrl: string) => Promise<T>
): Promise<T> {
  const runtime = createRuntime({ port: 0, ...options });
  await runtime.start();
  try {
    return await run(`http://127.0.0.1:${runtime.listeningPort}`);
  } finally {
    await runtime.stop();
  }
}

function gatewayHeaders() {
  return {
    cookie: 'mo_session=token_mo_de_009',
    'x-markorbit-workspace-id': workspaceId,
    'x-request-id': 'mo-de-009-provider-hop-1',
    'x-correlation-id': 'mo-de-009-correlation-1'
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('MO-DE-009 primary Gateway protected query admission', () => {
  it('routes an authenticated Workspace read through the normal createRuntime() with service auth and tracing', async () => {
    const authentication = authFor();
    const provider = vi.fn((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      expect(url).toBe('http://data-engine.test/api/v1/cn/cases/12345678');
      const headers = new Headers(init?.headers);
      expect(headers.get('authorization')).toBe(`Bearer ${apiKey}`);
      expect(headers.get('x-request-id')).toBe('mo-de-009-provider-hop-1');
      expect(headers.get('x-correlation-id')).toBe('mo-de-009-correlation-1');
      return Promise.resolve(
        providerResponse(factEnvelope(), 'mo-de-009-provider-hop-1', 'mo-de-009-correlation-1')
      );
    });

    await withRuntime(
      {
        authenticationClient: authentication.client,
        dataEngineUrl: 'http://data-engine.test',
        dataEngineApiKey: apiKey,
        dataEngineFetchImpl: provider
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/data-engine/cn/cases/12345678`, {
          headers: gatewayHeaders()
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
          jurisdiction: 'CN',
          resource_kind: 'TRADEMARK_CASE',
          fact_state: 'observed'
        });
        expect(response.headers.get('x-correlation-id')).toBe('mo-de-009-correlation-1');
        expect(response.headers.get('x-data-engine-request-id')).toBe('mo-de-009-provider-hop-1');
        expect(response.headers.get('x-data-engine-contract-version')).toBe(
          DATA_ENGINE_INTEGRATION_CONTRACT_VERSION
        );
      }
    );

    expect(authentication.resolveWorkspace).toHaveBeenCalledWith(
      'token_mo_de_009',
      workspaceId,
      'mo-de-009-correlation-1'
    );
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('rejects unauthenticated callers before Data Engine access', async () => {
    const provider = vi.fn();
    await withRuntime(
      {
        authenticationClient: authFor().client,
        dataEngineUrl: 'http://data-engine.test',
        dataEngineApiKey: apiKey,
        dataEngineFetchImpl: provider
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/data-engine/cn/cases/12345678`, {
          headers: { 'x-markorbit-workspace-id': workspaceId }
        });
        expect(response.status).toBe(401);
        expect(await response.json()).toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
      }
    );
    expect(provider).not.toHaveBeenCalled();
  });

  it('enforces workspace:read before Data Engine access', async () => {
    const provider = vi.fn();
    await withRuntime(
      {
        authenticationClient: authFor({ ...principal, permissions: [] }).client,
        dataEngineUrl: 'http://data-engine.test',
        dataEngineApiKey: apiKey,
        dataEngineFetchImpl: provider
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/data-engine/cn/cases/12345678`, {
          headers: gatewayHeaders()
        });
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({ code: 'PERMISSION_DENIED' });
      }
    );
    expect(provider).not.toHaveBeenCalled();
  });

  it('fails closed when the primary Gateway has no valid Data Engine service configuration', async () => {
    const provider = vi.fn();
    await withRuntime(
      { authenticationClient: authFor().client, dataEngineFetchImpl: provider },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/data-engine/cn/cases/12345678`, {
          headers: gatewayHeaders()
        });
        expect(response.status).toBe(503);
        expect(await response.json()).toMatchObject({
          code: 'DATA_ENGINE_CONFIGURATION_UNAVAILABLE',
          retryable: true
        });
      }
    );
    expect(provider).not.toHaveBeenCalled();
  });

  it('rejects invalid bounded query parameters before provider access', async () => {
    const provider = vi.fn();
    await withRuntime(
      {
        authenticationClient: authFor().client,
        dataEngineUrl: 'http://data-engine.test',
        dataEngineApiKey: apiKey,
        dataEngineFetchImpl: provider
      },
      async (baseUrl) => {
        const response = await fetch(
          `${baseUrl}/api/data-engine/us/cases/99123456/history?limit=0`,
          { headers: gatewayHeaders() }
        );
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ code: 'INVALID_REQUEST' });
      }
    );
    expect(provider).not.toHaveBeenCalled();
  });

  it('preserves provider not_found as coverage unknown through the primary Gateway', async () => {
    const provider = vi.fn(() =>
      Promise.resolve(
        providerResponse(
          {
            code: 'DATA_ENGINE_INTEGRATION_NOT_FOUND',
            message: 'Resource not found.',
            retryable: false,
            fact_state: 'not_found'
          },
          'mo-de-009-provider-hop-1',
          'mo-de-009-correlation-1',
          404
        )
      )
    );
    await withRuntime(
      {
        authenticationClient: authFor().client,
        dataEngineUrl: 'http://data-engine.test',
        dataEngineApiKey: apiKey,
        dataEngineFetchImpl: provider
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/data-engine/cn/cases/does-not-exist`, {
          headers: gatewayHeaders()
        });
        expect(response.status).toBe(404);
        expect(await response.json()).toMatchObject({
          code: 'DATA_ENGINE_INTEGRATION_NOT_FOUND',
          details: {
            integrationErrorCode: 'DATA_ENGINE_NOT_FOUND',
            factState: 'not_found',
            coverageState: 'unknown'
          }
        });
      }
    );
  });

  it('does not expose the deferred MO-DE-007 change-feed route', async () => {
    const provider = vi.fn();
    await withRuntime(
      {
        authenticationClient: authFor().client,
        dataEngineUrl: 'http://data-engine.test',
        dataEngineApiKey: apiKey,
        dataEngineFetchImpl: provider
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/data-engine/us/changes`, {
          headers: gatewayHeaders()
        });
        expect(response.status).toBe(404);
        expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' });
      }
    );
    expect(provider).not.toHaveBeenCalled();
  });
});
