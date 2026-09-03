import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AuthenticationError,
  parseInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { csrfToken, type CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayFilingGovernanceHandler } from '../src/filing-governance-http.js';

const workspaceId = '018f0000-0000-7000-8000-000000000701';
const sessionId = '018f0000-0000-7000-8000-000000000702';
const userId = '018f0000-0000-7000-8000-000000000703';
const csrfSecret = 'integration-701-csrf-secret-0123456789';
const internalServiceSecret = 'integration-701-internal-secret-0123456789';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId,
  sessionId,
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: '018f0000-0000-7000-8000-000000000704',
  role: 'MATTER_MANAGER',
  permissions: ['execution:read', 'execution:manage']
};

function client(overrides: Partial<CoreAuthenticationClient> = {}): CoreAuthenticationClient {
  return {
    issue: () => Promise.reject(new Error('issue is not expected')),
    resolve: () => Promise.reject(new Error('resolve is not expected')),
    resolveWorkspace: () => Promise.resolve(principal),
    revoke: () => Promise.resolve(),
    ...overrides
  };
}

function handler(
  authenticationClient: CoreAuthenticationClient | null = client(),
  overrides: Partial<Parameters<typeof createGatewayFilingGovernanceHandler>[0]> = {},
  includeInternalServiceSecret = true
) {
  return createGatewayFilingGovernanceHandler({
    executionUrl: 'http://execution.test',
    ...(authenticationClient ? { authenticationClient } : {}),
    ...(includeInternalServiceSecret ? { internalServiceSecret } : {}),
    csrfSecret,
    allowedOrigins: ['https://app.example'],
    ...overrides
  });
}

function request(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body: unknown = undefined,
  headers: Record<string, string> = {},
  query: Record<string, string> = {}
): JsonRequest {
  return {
    method,
    path,
    body,
    params: {},
    query,
    headers: {
      cookie: 'mo_session=token-701',
      'x-markorbit-workspace-id': workspaceId,
      'x-correlation-id': 'correlation-701',
      'x-request-id': 'request-701',
      ...(method !== 'GET'
        ? {
            origin: 'https://app.example',
            'x-markorbit-csrf-token': csrfToken(sessionId, csrfSecret)
          }
        : {}),
      ...headers
    }
  };
}

function response(status: number, value: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { 'content-type': 'application/json' }
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('authenticated Filing Governance Gateway bridge', () => {
  it('forwards trusted Principal authority and exact idempotency/correlation without browser cookie', async () => {
    const downstream = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(() => response(409, { code: 'SOURCE_VERSION_MISMATCH', preserved: true }));
    vi.stubGlobal('fetch', downstream);
    const result = await handler()(
      request(
        'POST',
        '/api/execution/filing-authorizations',
        {
          preparationLockId: 'preparation-lock_701',
          preparationLockVersion: 'v1',
          authorizedParty: { partyId: 'customer_701', displayName: 'Alex Owner' },
          authorizationCapacity: 'OWNER',
          executionChannel: 'OFFICE_PORTAL'
        },
        { 'idempotency-key': 'authorization-create-701' }
      )
    );
    expect(result).toEqual({
      status: 409,
      body: { code: 'SOURCE_VERSION_MISMATCH', preserved: true }
    });
    const [url, init] = downstream.mock.calls[0]!;
    expect(url).toBe('http://execution.test/v1/filing-authorizations');
    if (!init) throw new Error('Expected downstream init.');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-markorbit-internal-authorization']).toBe(internalServiceSecret);
    expect(headers['x-markorbit-workspace-id']).toBe(workspaceId);
    expect(headers['x-correlation-id']).toBe('correlation-701');
    expect(headers['x-request-id']).toBe('request-701');
    expect(headers['idempotency-key']).toBe('authorization-create-701');
    expect(headers.cookie).toBeUndefined();
    expect(parseInternalWorkspacePrincipal(headers['x-markorbit-principal'])).toEqual(principal);
  });

  it('uses execution:read for GET and preserves query without requiring mutation security', async () => {
    const downstream = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(() => response(200, { executionReleases: [] }));
    vi.stubGlobal('fetch', downstream);
    const readOnly = { ...principal, permissions: ['execution:read'] } as WorkspacePrincipal;
    const result = await handler(client({ resolveWorkspace: () => Promise.resolve(readOnly) }))(
      request('GET', '/api/execution/execution-releases', undefined, {}, { status: 'READY' })
    );
    expect(result.status).toBe(200);
    expect(downstream.mock.calls[0]![0]).toBe(
      'http://execution.test/v1/execution-releases?status=READY'
    );
  });

  it('requires Core session, exact Workspace context and read/manage permissions', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    await expect(
      handler()(request('GET', '/api/execution/execution-releases', undefined, { cookie: '' }))
    ).rejects.toMatchObject({ status: 401, code: 'AUTHENTICATION_REQUIRED' });
    await expect(
      handler()(
        request('GET', '/api/execution/execution-releases', undefined, {
          'x-markorbit-workspace-id': ''
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_WORKSPACE_CONTEXT' });
    const noRead = { ...principal, permissions: ['execution:manage'] } as WorkspacePrincipal;
    await expect(
      handler(client({ resolveWorkspace: () => Promise.resolve(noRead) }))(
        request('GET', '/api/execution/execution-releases')
      )
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    const noManage = { ...principal, permissions: ['execution:read'] } as WorkspacePrincipal;
    await expect(
      handler(client({ resolveWorkspace: () => Promise.resolve(noManage) }))(
        request('POST', '/api/execution/execution-releases/release_701/evaluate', {})
      )
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('enforces trusted Origin and CSRF on every POST/PATCH mutation', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    await expect(
      handler()(
        request('POST', '/api/execution/execution-releases/release_701/evaluate', {}, {
          origin: 'https://evil.example'
        })
      )
    ).rejects.toMatchObject({ status: 403, code: 'UNTRUSTED_ORIGIN' });
    await expect(
      handler()(
        request('PATCH', '/api/execution/execution-releases/release_701/assignment', {}, {
          'x-markorbit-csrf-token': 'invalid'
        })
      )
    ).rejects.toMatchObject({ status: 403, code: 'INVALID_CSRF_TOKEN' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('requires Idempotency-Key only for owner-idempotent governed commands', async () => {
    const downstream = vi.fn(() => response(200, { ok: true }));
    vi.stubGlobal('fetch', downstream);
    for (const path of [
      '/api/execution/filing-authorizations',
      '/api/execution/filing-authorizations/authorization_701/confirm',
      '/api/execution/execution-releases',
      '/api/execution/execution-releases/release_701/release'
    ]) {
      await expect(handler()(request('POST', path, {}))).rejects.toMatchObject({
        status: 400,
        code: 'IDEMPOTENCY_KEY_REQUIRED'
      });
    }
    for (const [method, path] of [
      ['POST', '/api/execution/filing-authorizations/authorization_701/withdraw'],
      ['POST', '/api/execution/execution-releases/release_701/evaluate'],
      ['PATCH', '/api/execution/execution-releases/release_701/assignment'],
      ['POST', '/api/execution/execution-releases/release_701/withdraw'],
      ['POST', '/api/execution/filing-task-drafts/task_701/validate-current']
    ] as const) {
      const result = await handler()(request(method, path, {}));
      expect(result.status).toBe(200);
    }
  });

  it('rejects generic browser authority spoof fields but preserves authorizedParty', async () => {
    const downstream = vi.fn(() => response(200, { ok: true }));
    vi.stubGlobal('fetch', downstream);
    await expect(
      handler()(
        request(
          'POST',
          '/api/execution/filing-authorizations',
          { workspaceId, actorId: 'browser_actor' },
          { 'idempotency-key': 'spoof-701' }
        )
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_EXECUTION_AUTHORITY' });
    const result = await handler()(
      request(
        'POST',
        '/api/execution/filing-authorizations',
        { authorizedParty: { partyId: 'customer_701', displayName: 'Alex Owner' } },
        { 'idempotency-key': 'authorized-party-701' }
      )
    );
    expect(result.status).toBe(200);
    const init = downstream.mock.calls[0]![1];
    if (!init || typeof init.body !== 'string') throw new Error('Expected request body.');
    expect(JSON.parse(init.body)).toMatchObject({
      authorizedParty: { partyId: 'customer_701', displayName: 'Alex Owner' }
    });
  });

  it('strips browser acknowledgedBy and decidedBy because Execution binds trusted principal user', async () => {
    const downstream = vi.fn(() => response(200, { ok: true }));
    vi.stubGlobal('fetch', downstream);
    await handler()(
      request(
        'POST',
        '/api/execution/filing-authorizations/authorization_701/confirm',
        { acknowledgementCodes: ['AUTHORIZATION_IS_NOT_SUBMISSION'], acknowledgedBy: 'spoof' },
        { 'idempotency-key': 'confirm-701' }
      )
    );
    await handler()(
      request(
        'POST',
        '/api/execution/execution-releases/release_701/release',
        { decidedBy: 'spoof', rationale: 'All checks passed.' },
        { 'idempotency-key': 'release-701' }
      )
    );
    for (const call of downstream.mock.calls) {
      const init = call[1];
      if (!init || typeof init.body !== 'string') throw new Error('Expected request body.');
      const body = JSON.parse(init.body) as Record<string, unknown>;
      expect(body.acknowledgedBy).toBeUndefined();
      expect(body.decidedBy).toBeUndefined();
    }
  });

  it('preserves owner 400/403/404/409/503 status and body exactly', async () => {
    for (const status of [400, 403, 404, 409, 503]) {
      const owner = { code: `OWNER_${status}`, status };
      vi.stubGlobal('fetch', vi.fn(() => response(status, owner)));
      const result = await handler()(
        request('GET', '/api/execution/filing-authorizations/authorization_701')
      );
      expect(result).toEqual({ status, body: owner });
    }
  });

  it('maps membership/auth dependency and transport failures without local success fallback', async () => {
    await expect(
      handler(
        client({
          resolveWorkspace: () =>
            Promise.reject(new AuthenticationError('MEMBERSHIP_REQUIRED', 'Membership is required.'))
        })
      )(request('GET', '/api/execution/execution-releases'))
    ).rejects.toMatchObject({ status: 403, code: 'MEMBERSHIP_REQUIRED' });
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    await expect(
      handler()(request('GET', '/api/execution/execution-releases'))
    ).rejects.toMatchObject({ status: 503, code: 'DOWNSTREAM_UNAVAILABLE' });
    await expect(
      handler(null)(request('GET', '/api/execution/execution-releases'))
    ).rejects.toMatchObject({ status: 503, code: 'AUTHENTICATION_SERVICE_UNAVAILABLE' });
    await expect(
      handler(client(), {}, false)(request('GET', '/api/execution/execution-releases'))
    ).rejects.toMatchObject({ status: 503, code: 'DOWNSTREAM_UNAVAILABLE' });
  });

  it('allows anonymous forwarding only in explicit fixture test runtime', async () => {
    const downstream = vi.fn(() => response(200, { fixture: true }));
    vi.stubGlobal('fetch', downstream);
    const result = await handler(null, { fixtureTestRuntime: true }, false)(
      request('POST', '/api/execution/execution-releases/release_701/evaluate', {}, { cookie: '' })
    );
    expect(result).toEqual({ status: 200, body: { fixture: true } });
    const headers = downstream.mock.calls[0]![1]?.headers as Record<string, string>;
    expect(headers['x-markorbit-principal']).toBeUndefined();
  });
});
