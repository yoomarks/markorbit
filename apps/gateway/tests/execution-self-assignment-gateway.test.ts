import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { csrfToken, type CoreAuthenticationClient } from '../src/auth.js';
import { createGatewayFilingGovernanceHandler } from '../src/filing-governance-http.js';

const workspaceId = '018f0000-0000-7000-8000-000000000694';
const sessionId = '018f0000-0000-7000-8000-000000000695';
const userId = '018f0000-0000-7000-8000-000000000696';
const csrfSecret = 'integration-694-csrf-secret-0123456789';
const internalServiceSecret = 'integration-694-internal-secret-0123456789';

const principal = {
  kind: 'WORKSPACE',
  userId,
  sessionId,
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: '018f0000-0000-7000-8000-000000000697',
  role: 'MATTER_MANAGER',
  permissions: ['execution:read', 'execution:manage']
} as WorkspacePrincipal;

const authenticationClient: CoreAuthenticationClient = {
  issue: () => Promise.reject(new Error('issue is not expected')),
  resolve: () => Promise.reject(new Error('resolve is not expected')),
  resolveWorkspace: () => Promise.resolve(principal),
  revoke: () => Promise.resolve()
};

function governedRequest(body: unknown): JsonRequest {
  return {
    method: 'PATCH',
    path: '/api/execution/execution-releases/release_694/assignment',
    body,
    params: {},
    query: {},
    headers: {
      cookie: 'mo_session=token-694',
      'x-markorbit-workspace-id': workspaceId,
      'x-correlation-id': 'correlation-694',
      'x-request-id': 'request-694',
      origin: 'https://app.example',
      'x-markorbit-csrf-token': csrfToken(sessionId, csrfSecret)
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

describe('Execution Release trusted self-assignment Gateway bridge', () => {
  it('keeps the browser assignment URL but forwards only expectedVersion to owner self-assignment', async () => {
    const downstream = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(() => response(200, { executionRelease: { assignment: { internalExecutorId: userId } } }));
    vi.stubGlobal('fetch', downstream);

    const handler = createGatewayFilingGovernanceHandler({
      executionUrl: 'http://execution.test',
      authenticationClient,
      internalServiceSecret,
      csrfSecret,
      allowedOrigins: ['https://app.example']
    });

    const result = await handler(governedRequest({ expectedVersion: 7 }));

    expect(result.status).toBe(200);
    expect(downstream).toHaveBeenCalledTimes(1);
    const [url, init] = downstream.mock.calls[0]!;
    expect(url).toBe('http://execution.test/v1/execution-releases/release_694/self-assignment');
    if (!init || typeof init.body !== 'string') throw new Error('Expected governed PATCH body.');
    expect(JSON.parse(init.body)).toEqual({ expectedVersion: 7 });
    const headers = init.headers as Record<string, string>;
    expect(headers['x-markorbit-internal-authorization']).toBe(internalServiceSecret);
    expect(headers['x-markorbit-workspace-id']).toBe(workspaceId);
    expect(headers['x-correlation-id']).toBe('correlation-694');
    expect(headers['x-request-id']).toBe('request-694');
    expect(headers.cookie).toBeUndefined();
    expect(parseInternalWorkspacePrincipal(headers['x-markorbit-principal'])).toEqual(principal);
  });

  it.each(['internalExecutorId', 'executorId', 'actorId', 'userId', 'principal', 'membershipId'])(
    'rejects browser-supplied assignment authority field %s before Execution is reached',
    async (field) => {
      const downstream = vi.fn();
      vi.stubGlobal('fetch', downstream);
      const handler = createGatewayFilingGovernanceHandler({
        executionUrl: 'http://execution.test',
        authenticationClient,
        internalServiceSecret,
        csrfSecret,
        allowedOrigins: ['https://app.example']
      });

      await expect(
        handler(governedRequest({ expectedVersion: 7, [field]: 'browser-spoof' }))
      ).rejects.toMatchObject({ status: 400, code: 'INVALID_EXECUTION_AUTHORITY' });
      expect(downstream).not.toHaveBeenCalled();
    }
  );

  it.each([409, 422])('preserves owner self-assignment status %i and body', async (status) => {
    const owner = { code: `OWNER_${status}`, details: { status } };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => response(status, owner))
    );
    const handler = createGatewayFilingGovernanceHandler({
      executionUrl: 'http://execution.test',
      authenticationClient,
      internalServiceSecret,
      csrfSecret,
      allowedOrigins: ['https://app.example']
    });

    const result = await handler(governedRequest({ expectedVersion: 7 }));
    expect(result.status).toBe(status);
    expect(result.body).toEqual(owner);
  });

  it('keeps explicit fixture runtime on the legacy generic assignment path', async () => {
    const downstream = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(() => response(200, { ok: true }));
    vi.stubGlobal('fetch', downstream);

    const handler = createGatewayFilingGovernanceHandler({
      executionUrl: 'http://execution.test',
      csrfSecret,
      allowedOrigins: ['https://app.example'],
      fixtureTestRuntime: true
    });

    const fixtureRequest: JsonRequest = {
      ...governedRequest({ internalExecutorId: 'executor_fixture', expectedVersion: 2 }),
      headers: {}
    };
    const result = await handler(fixtureRequest);

    expect(result.status).toBe(200);
    const [url, init] = downstream.mock.calls[0]!;
    expect(url).toBe('http://execution.test/v1/execution-releases/release_694/assignment');
    if (!init || typeof init.body !== 'string') throw new Error('Expected fixture PATCH body.');
    expect(JSON.parse(init.body)).toEqual({
      internalExecutorId: 'executor_fixture',
      expectedVersion: 2
    });
  });
});
