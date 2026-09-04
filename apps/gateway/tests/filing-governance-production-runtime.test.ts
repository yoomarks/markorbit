import { afterEach, describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest, ServiceRuntime } from '@markorbit/service-kit';
import {
  createRuntime as createExecution,
  InMemoryFilingGovernanceRepository
} from '../../../services/execution/src/index.js';
import { csrfToken, type CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayFilingGovernanceHandler } from '../src/filing-governance-http.js';
import { createRuntime as createGateway } from '../src/index.js';

const workspaceId = '018f0000-0000-7000-8000-000000000711';
const sessionId = '018f0000-0000-7000-8000-000000000712';
const userId = '018f0000-0000-7000-8000-000000000713';
const csrfSecret = 'integration-701-runtime-csrf-secret-0123456789';
const internalServiceSecret = 'integration-701-runtime-internal-secret-0123456789';
const allowedOrigin = 'https://app.example';

const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId,
  sessionId,
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: '018f0000-0000-7000-8000-000000000714',
  role: 'MATTER_MANAGER',
  permissions: ['execution:read', 'execution:manage']
};

function authenticationClient(): CoreAuthenticationClient {
  return {
    issue: () => Promise.reject(new Error('issue is not expected')),
    resolve: () => Promise.reject(new Error('resolve is not expected')),
    resolveWorkspace: () => Promise.resolve(principal),
    revoke: () => Promise.resolve()
  };
}

const active: ServiceRuntime[] = [];

afterEach(async () => {
  await Promise.all(
    active
      .splice(0)
      .reverse()
      .map((runtime) => runtime.stop())
  );
});

async function startProductionRuntime(milestoneTestRuntime = true) {
  const execution = createExecution({
    port: 0,
    internalServiceSecret,
    filingRepositoryFactory: () => new InMemoryFilingGovernanceRepository()
  });
  active.push(execution);
  await execution.start();

  const gateway = createGateway({
    port: 0,
    executionUrl: `http://127.0.0.1:${execution.listeningPort}`,
    authenticationClient: authenticationClient(),
    internalServiceSecret,
    csrfSecret,
    allowedOrigins: [allowedOrigin],
    milestoneTestRuntime
  });
  active.push(gateway);
  await gateway.start();
  return `http://127.0.0.1:${gateway.listeningPort}`;
}

function authenticatedHeaders(mutation = false): Record<string, string> {
  return {
    'content-type': 'application/json',
    cookie: 'mo_session=token-701-runtime',
    'x-markorbit-workspace-id': workspaceId,
    'x-correlation-id': 'correlation-701-runtime',
    'x-request-id': 'request-701-runtime',
    ...(mutation
      ? {
          origin: allowedOrigin,
          'x-markorbit-csrf-token': csrfToken(sessionId, csrfSecret)
        }
      : {})
  };
}

function directRequest(method: 'GET' | 'POST' | 'PATCH', path: string): JsonRequest {
  return {
    method,
    path,
    body: {},
    params: {},
    query: {},
    headers: authenticatedHeaders(method !== 'GET')
  };
}

describe('production Filing Governance Gateway runtime', () => {
  it('does not let milestoneTestRuntime bypass a configured production authority boundary', async () => {
    const base = await startProductionRuntime(true);

    const anonymous = await fetch(`${base}/api/execution/execution-releases`, {
      headers: { 'x-markorbit-workspace-id': workspaceId }
    });
    expect(anonymous.status).toBe(401);

    const authenticated = await fetch(`${base}/api/execution/execution-releases`, {
      headers: authenticatedHeaders()
    });
    expect(authenticated.status).toBe(200);
    expect(await authenticated.json()).toMatchObject({ executionReleases: [] });
  });

  it('enforces Origin and CSRF at the registered runtime route before Execution owner work', async () => {
    const base = await startProductionRuntime(false);
    const withoutOrigin = await fetch(
      `${base}/api/execution/execution-releases/release_701/evaluate`,
      {
        method: 'POST',
        headers: {
          ...authenticatedHeaders(true),
          origin: ''
        },
        body: JSON.stringify({})
      }
    );
    expect(withoutOrigin.status).toBe(403);

    const invalidCsrf = await fetch(
      `${base}/api/execution/execution-releases/release_701/evaluate`,
      {
        method: 'POST',
        headers: {
          ...authenticatedHeaders(true),
          'x-markorbit-csrf-token': 'invalid'
        },
        body: JSON.stringify({})
      }
    );
    expect(invalidCsrf.status).toBe(403);
  });

  it('enforces owner-idempotent command policy at the registered runtime route', async () => {
    const base = await startProductionRuntime(false);
    const response = await fetch(`${base}/api/execution/filing-authorizations`, {
      method: 'POST',
      headers: authenticatedHeaders(true),
      body: JSON.stringify({})
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  });

  it('fails closed when the fixture flag is combined with only one production authority dependency', async () => {
    const withAuthOnly = createGatewayFilingGovernanceHandler({
      executionUrl: 'http://execution.test',
      authenticationClient: authenticationClient(),
      csrfSecret,
      allowedOrigins: [allowedOrigin],
      fixtureTestRuntime: true
    });
    await expect(
      withAuthOnly(directRequest('GET', '/api/execution/execution-releases'))
    ).rejects.toMatchObject({ status: 503, code: 'DOWNSTREAM_UNAVAILABLE' });

    const withSecretOnly = createGatewayFilingGovernanceHandler({
      executionUrl: 'http://execution.test',
      internalServiceSecret,
      csrfSecret,
      allowedOrigins: [allowedOrigin],
      fixtureTestRuntime: true
    });
    await expect(
      withSecretOnly(directRequest('GET', '/api/execution/execution-releases'))
    ).rejects.toMatchObject({ status: 503, code: 'AUTHENTICATION_SERVICE_UNAVAILABLE' });
  });

  it('rejects any route outside the explicit Filing Governance policy', async () => {
    const governed = createGatewayFilingGovernanceHandler({
      executionUrl: 'http://execution.test',
      authenticationClient: authenticationClient(),
      internalServiceSecret,
      csrfSecret,
      allowedOrigins: [allowedOrigin]
    });
    await expect(
      governed(
        directRequest('POST', '/api/execution/execution-releases/release_701/release-preview')
      )
    ).rejects.toMatchObject({ status: 404, code: 'FILING_GOVERNANCE_ROUTE_NOT_FOUND' });
  });
});
