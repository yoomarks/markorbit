import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { csrfToken, type CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayFilingGovernanceHandler } from '../src/filing-governance-http.js';

const workspaceId = '018f0000-0000-7000-8000-000000000711';
const sessionId = '018f0000-0000-7000-8000-000000000712';
const userId = '018f0000-0000-7000-8000-000000000713';
const csrfSecret = 'integration-701-boundary-csrf-secret-0123456789';
const internalServiceSecret = 'integration-701-boundary-internal-secret-0123456789';

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

function client(): CoreAuthenticationClient {
  return {
    issue: () => Promise.reject(new Error('issue is not expected')),
    resolve: () => Promise.reject(new Error('resolve is not expected')),
    resolveWorkspace: () => Promise.resolve(principal),
    revoke: () => Promise.resolve()
  };
}

function handler(options: {
  authenticationClient?: CoreAuthenticationClient;
  internalServiceSecret?: string;
  fixtureTestRuntime?: boolean;
} = {}) {
  return createGatewayFilingGovernanceHandler({
    executionUrl: 'http://execution.test',
    authenticationClient: options.authenticationClient ?? client(),
    internalServiceSecret: options.internalServiceSecret ?? internalServiceSecret,
    csrfSecret,
    allowedOrigins: ['https://app.example'],
    ...(options.fixtureTestRuntime === undefined
      ? {}
      : { fixtureTestRuntime: options.fixtureTestRuntime })
  });
}

function request(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body: unknown = undefined,
  headers: Record<string, string> = {}
): JsonRequest {
  return {
    method,
    path,
    body,
    params: {},
    query: {},
    headers: {
      cookie: 'mo_session=token-701-boundary',
      'x-markorbit-workspace-id': workspaceId,
      ...(method === 'GET'
        ? {}
        : {
            origin: 'https://app.example',
            'x-markorbit-csrf-token': csrfToken(sessionId, csrfSecret)
          }),
      ...headers
    }
  };
}

function ownerResponse(status: number, body: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' }
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Filing Governance browser command boundary', () => {
  it('does not enable fixture bypass when a real authentication dependency exists', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    const governed = createGatewayFilingGovernanceHandler({
      executionUrl: 'http://execution.test',
      authenticationClient: client(),
      csrfSecret,
      allowedOrigins: ['https://app.example'],
      fixtureTestRuntime: true
    });

    await expect(governed(request('GET', '/api/execution/execution-releases'))).rejects.toMatchObject({
      status: 503,
      code: 'DOWNSTREAM_UNAVAILABLE'
    });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('does not enable fixture bypass when a real internal service secret exists', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    const governed = createGatewayFilingGovernanceHandler({
      executionUrl: 'http://execution.test',
      internalServiceSecret,
      csrfSecret,
      allowedOrigins: ['https://app.example'],
      fixtureTestRuntime: true
    });

    await expect(governed(request('GET', '/api/execution/execution-releases'))).rejects.toMatchObject({
      status: 503,
      code: 'AUTHENTICATION_SERVICE_UNAVAILABLE'
    });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('rejects owner-only and unknown browser command fields before Execution', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);

    for (const extra of [
      { expiresAt: '2035-01-01T00:00:00.000Z' },
      { futureOwnerField: 'must-not-pass' }
    ]) {
      await expect(
        handler()(
          request(
            'POST',
            '/api/execution/filing-authorizations',
            {
              preparationLockId: 'lock_701',
              preparationLockVersion: 'v1',
              authorizedParty: { partyId: 'party_701', displayName: 'Alex Owner' },
              authorizationCapacity: 'OWNER',
              executionChannel: 'OFFICE_PORTAL',
              ...extra
            },
            { 'idempotency-key': 'create-701-boundary' }
          )
        )
      ).rejects.toMatchObject({ status: 400, code: 'INVALID_EXECUTION_REQUEST' });
    }

    expect(downstream).not.toHaveBeenCalled();
  });

  it('rejects nested authority and unknown fields inside authorizedParty', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);

    await expect(
      handler()(
        request(
          'POST',
          '/api/execution/filing-authorizations',
          {
            authorizedParty: {
              partyId: 'party_701',
              displayName: 'Alex Owner',
              actorId: 'spoofed-actor'
            }
          },
          { 'idempotency-key': 'nested-authority-701' }
        )
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_EXECUTION_AUTHORITY' });

    await expect(
      handler()(
        request(
          'POST',
          '/api/execution/filing-authorizations',
          {
            authorizedParty: {
              partyId: 'party_701',
              displayName: 'Alex Owner',
              metadata: { source: 'browser' }
            }
          },
          { 'idempotency-key': 'nested-unknown-701' }
        )
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_EXECUTION_REQUEST' });

    expect(downstream).not.toHaveBeenCalled();
  });

  it('projects only the declared assignment command fields', async () => {
    const downstream = vi.fn(() => ownerResponse(200, { ok: true }));
    vi.stubGlobal('fetch', downstream);

    const result = await handler()(
      request('PATCH', '/api/execution/execution-releases/release_701/assignment', {
        internalExecutorId: 'executor_701',
        expectedVersion: 4
      })
    );

    expect(result.status).toBe(200);
    const init = downstream.mock.calls[0]?.[1];
    if (!init || typeof init.body !== 'string') throw new Error('Expected projected request body.');
    expect(JSON.parse(init.body)).toEqual({
      internalExecutorId: 'executor_701',
      expectedVersion: 4
    });
  });

  it('preserves Preparation currentness 422 owner truth exactly', async () => {
    const owner = {
      code: 'PREPARATION_LOCK_NOT_CURRENT',
      message: 'The Preparation Lock is no longer current.',
      details: { expectedVersion: 8, actualVersion: 9 }
    };
    vi.stubGlobal('fetch', vi.fn(() => ownerResponse(422, owner)));

    const result = await handler()(
      request('POST', '/api/execution/filing-task-drafts/task_701/validate-current', {})
    );

    expect(result).toEqual({ status: 422, body: owner });
  });
});
