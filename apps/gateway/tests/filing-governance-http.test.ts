import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AuthenticationError,
  parseInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { csrfToken, type CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayFilingGovernanceHandler } from '../src/filing-governance-http.js';

const workspaceId = '018f0000-0000-7000-8000-000000000711';
const sessionId = '018f0000-0000-7000-8000-000000000712';
const userId = '018f0000-0000-7000-8000-000000000713';
const csrfSecret = 'integration-701-csrf-secret-0123456789';
const internalServiceSecret = 'integration-701-internal-secret-0123456789';
const principal = {
  kind: 'WORKSPACE',
  userId,
  sessionId,
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: '018f0000-0000-7000-8000-000000000714',
  role: 'MATTER_MANAGER',
  permissions: ['execution:read', 'execution:manage']
} as WorkspacePrincipal;

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

function response(status: number, value: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { 'content-type': 'application/json' }
    })
  );
}

const filingAuthorizationBody = {
  preparationLockId: 'preparation-lock_701',
  preparationLockVersion: '7:9',
  authorizedParty: { partyId: 'party_701', displayName: 'Customer' },
  authorizationCapacity: 'APPLICANT',
  executionChannel: 'INTERNAL'
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('governed Filing Governance Gateway boundary', () => {
  it('forwards create with trusted Principal and only declared browser command fields', async () => {
    const downstream = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(() => response(200, { filingAuthorization: { status: 'PENDING_CONFIRMATION' } }));
    vi.stubGlobal('fetch', downstream);
    const result = await handler()(
      request('POST', '/api/execution/filing-authorizations', filingAuthorizationBody, {
        'idempotency-key': 'filing-auth-key-701'
      })
    );
    expect(result.status).toBe(200);
    expect(downstream).toHaveBeenCalledTimes(1);
    const [url, init] = downstream.mock.calls[0]!;
    expect(url).toBe('http://execution.test/v1/filing-authorizations');
    if (!init) throw new Error('Expected request init.');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-markorbit-internal-authorization']).toBe(internalServiceSecret);
    expect(headers['x-markorbit-workspace-id']).toBe(workspaceId);
    expect(headers['x-correlation-id']).toBe('correlation-701');
    expect(headers['x-request-id']).toBe('request-701');
    expect(headers['idempotency-key']).toBe('filing-auth-key-701');
    expect(headers.cookie).toBeUndefined();
    expect(parseInternalWorkspacePrincipal(headers['x-markorbit-principal'])).toEqual(principal);
    const forwardedBody = init.body;
    if (typeof forwardedBody !== 'string') throw new Error('Expected string body.');
    expect(JSON.parse(forwardedBody)).toEqual(filingAuthorizationBody);
  });

  it.each([
    [{ actor: { userId: 'actor_spoof' } }, 'INVALID_EXECUTION_AUTHORITY'],
    [{ expiresAt: '2035-01-01T00:00:00.000Z' }, 'INVALID_EXECUTION_REQUEST'],
    [{ futureOwnerField: 'must-not-pass' }, 'INVALID_EXECUTION_REQUEST']
  ] as const)('rejects browser authority or unknown command field %#', async (extra, code) => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    await expect(
      handler()(
        request(
          'POST',
          '/api/execution/filing-authorizations',
          { ...filingAuthorizationBody, ...extra },
          { 'idempotency-key': 'filing-auth-key-701' }
        )
      )
    ).rejects.toMatchObject({ status: 400, code });
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
            ...filingAuthorizationBody,
            authorizedParty: {
              partyId: 'party_701',
              displayName: 'Customer',
              actorId: 'actor_spoof'
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
            ...filingAuthorizationBody,
            authorizedParty: {
              partyId: 'party_701',
              displayName: 'Customer',
              metadata: { source: 'browser' }
            }
          },
          { 'idempotency-key': 'nested-unknown-701' }
        )
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_EXECUTION_REQUEST' });

    expect(downstream).not.toHaveBeenCalled();
  });

  it('strips legacy actor display fields only on their declared commands', async () => {
    const downstream = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(() => response(200, { ok: true }));
    vi.stubGlobal('fetch', downstream);

    await handler()(
      request(
        'POST',
        '/api/execution/filing-authorizations/auth_701/confirm',
        { acknowledgementCodes: ['OWNER_CONFIRMED'], acknowledgedBy: 'browser_spoof' },
        { 'idempotency-key': 'confirm-701' }
      )
    );
    await handler()(
      request(
        'POST',
        '/api/execution/execution-releases/release_701/release',
        { rationale: 'Ready', decidedBy: 'browser_spoof' },
        { 'idempotency-key': 'release-701' }
      )
    );

    const confirmInit = downstream.mock.calls[0]?.[1];
    const releaseInit = downstream.mock.calls[1]?.[1];
    if (!confirmInit || typeof confirmInit.body !== 'string')
      throw new Error('Expected confirm body.');
    if (!releaseInit || typeof releaseInit.body !== 'string')
      throw new Error('Expected release body.');
    expect(JSON.parse(confirmInit.body)).toEqual({ acknowledgementCodes: ['OWNER_CONFIRMED'] });
    expect(JSON.parse(releaseInit.body)).toEqual({ rationale: 'Ready' });
  });

  it('projects only the declared assignment command fields', async () => {
    const downstream = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(() => response(200, { ok: true }));
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

  it('uses execution:read for GET and preserves query/correlation without browser session forwarding', async () => {
    const downstream = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(() => response(200, { executionReleases: [] }));
    vi.stubGlobal('fetch', downstream);
    const readOnly = { ...principal, permissions: ['execution:read'] } as WorkspacePrincipal;
    const result = await handler(client({ resolveWorkspace: () => Promise.resolve(readOnly) }))(
      request('GET', '/api/execution/execution-releases', undefined, {}, { status: 'DRAFT' })
    );
    expect(result.status).toBe(200);
    const [url, init] = downstream.mock.calls[0]!;
    expect(url).toBe('http://execution.test/v1/execution-releases?status=DRAFT');
    if (!init) throw new Error('Expected request init.');
    const headers = init.headers as Record<string, string>;
    expect(headers.cookie).toBeUndefined();
    expect(headers['x-markorbit-workspace-id']).toBe(workspaceId);
  });

  it('requires execution:manage, trusted Origin and CSRF for POST/PATCH', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    const readOnly = { ...principal, permissions: ['execution:read'] } as WorkspacePrincipal;
    await expect(
      handler(client({ resolveWorkspace: () => Promise.resolve(readOnly) }))(
        request('POST', '/api/execution/execution-releases/release_701/evaluate', {})
      )
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    await expect(
      handler()(
        request(
          'PATCH',
          '/api/execution/execution-releases/release_701/assignment',
          { internalExecutorId: 'executor_701' },
          { origin: 'https://evil.example' }
        )
      )
    ).rejects.toMatchObject({ status: 403, code: 'UNTRUSTED_ORIGIN' });
    await expect(
      handler()(
        request(
          'POST',
          '/api/execution/filing-task-drafts/task_701/validate-current',
          {},
          { 'x-markorbit-csrf-token': 'invalid' }
        )
      )
    ).rejects.toMatchObject({ status: 403, code: 'INVALID_CSRF_TOKEN' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it.each([
    '/api/execution/filing-authorizations',
    '/api/execution/filing-authorizations/auth_701/confirm',
    '/api/execution/execution-releases',
    '/api/execution/execution-releases/release_701/release'
  ])('requires Idempotency-Key for owner idempotent command %s', async (path) => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(handler()(request('POST', path, {}))).rejects.toMatchObject({
      status: 400,
      code: 'IDEMPOTENCY_KEY_REQUIRED'
    });
  });

  it.each([
    ['POST', '/api/execution/filing-authorizations/auth_701/withdraw'],
    ['POST', '/api/execution/execution-releases/release_701/evaluate'],
    ['PATCH', '/api/execution/execution-releases/release_701/assignment'],
    ['POST', '/api/execution/filing-task-drafts/task_701/validate-current']
  ] as const)(
    'does not invent idempotency for non-idempotent owner command %s %s',
    async (method, path) => {
      const downstream = vi.fn(() => response(200, { ok: true }));
      vi.stubGlobal('fetch', downstream);
      const result = await handler()(request(method, path, {}));
      expect(result.status).toBe(200);
      expect(downstream).toHaveBeenCalledTimes(1);
    }
  );

  it('keeps Workspace and membership failures privacy-safe before Execution is reached', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);
    await expect(
      handler(
        client({
          resolveWorkspace: () =>
            Promise.reject(
              new AuthenticationError('MEMBERSHIP_REQUIRED', 'Membership is required.')
            )
        })
      )(request('GET', '/api/execution/execution-releases/release_701'))
    ).rejects.toMatchObject({ status: 403, code: 'MEMBERSHIP_REQUIRED' });
    await expect(
      handler()(
        request('GET', '/api/execution/execution-releases/release_701', undefined, {
          'x-markorbit-workspace-id': ''
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_WORKSPACE_CONTEXT' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it.each([400, 403, 404, 409, 422, 503])('preserves owner status %i and body', async (status) => {
    const owner = { code: `OWNER_${status}`, details: { status } };
    vi.stubGlobal('fetch', vi.fn(() => response(status, owner)));
    const result = await handler()(request('GET', '/api/execution/execution-releases/release_701'));
    expect(result.status).toBe(status);
    expect(result.body).toEqual(owner);
  });

  it('maps transport failure to explicit 503 without local success fallback', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline')))
    );
    await expect(
      handler()(request('GET', '/api/execution/execution-releases/release_701'))
    ).rejects.toMatchObject({ status: 503, code: 'DOWNSTREAM_UNAVAILABLE' });
  });

  it('does not enable fixture bypass when only one production dependency is configured', async () => {
    const downstream = vi.fn();
    vi.stubGlobal('fetch', downstream);

    await expect(
      handler(client(), { fixtureTestRuntime: true }, false)(
        request('GET', '/api/execution/execution-releases')
      )
    ).rejects.toMatchObject({ status: 503, code: 'DOWNSTREAM_UNAVAILABLE' });
    await expect(
      handler(null, { fixtureTestRuntime: true }, true)(
        request('GET', '/api/execution/execution-releases')
      )
    ).rejects.toMatchObject({ status: 503, code: 'AUTHENTICATION_SERVICE_UNAVAILABLE' });
    expect(downstream).not.toHaveBeenCalled();
  });

  it('fails closed without production auth but preserves explicit milestone fixture compatibility', async () => {
    const downstream = vi.fn(() => response(200, { fixture: true }));
    vi.stubGlobal('fetch', downstream);
    await expect(
      handler(null, {}, false)(request('GET', '/api/execution/execution-releases'))
    ).rejects.toMatchObject({ status: 503, code: 'AUTHENTICATION_SERVICE_UNAVAILABLE' });
    const fixture = handler(null, { fixtureTestRuntime: true }, false);
    const result = await fixture(request('GET', '/api/execution/execution-releases'));
    expect(result.status).toBe(200);
    expect(downstream).toHaveBeenCalledTimes(1);
  });
});
