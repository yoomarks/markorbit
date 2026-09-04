import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLiteExecutionClient, ExecutionHttpError } from './execution.js';

afterEach(() => vi.unstubAllGlobals());

describe('Execution Release authenticated Gateway client', () => {
  it('binds reads to the authenticated session and exact Workspace', async () => {
    const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(
        new Response(JSON.stringify({ executionReleases: [], consequences: {} }), { status: 200 })
      )
    );
    vi.stubGlobal('fetch', fetch);

    await createLiteExecutionClient('workspace-695').listReleases();

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('http://127.0.0.1:4000/api/execution/execution-releases');
    expect(init).toMatchObject({ method: 'GET', credentials: 'include' });
    const headers = new Headers(init?.headers);
    expect(headers.get('x-markorbit-workspace-id')).toBe('workspace-695');
    expect(headers.get('x-markorbit-csrf-token')).toBeNull();
    expect(headers.get('idempotency-key')).toBeNull();
  });

  it('uses CSRF, exact Workspace and only the Gateway-declared mutation bodies', async () => {
    const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>((url) =>
      Promise.resolve(
        new Response(
          JSON.stringify(url.endsWith('/api/auth/session') ? { csrfToken: 'csrf-695' } : {}),
          { status: 200 }
        )
      )
    );
    vi.stubGlobal('fetch', fetch);
    const client = createLiteExecutionClient('workspace-695');

    await client.updateAssignment('release-695', { expectedVersion: 7 });
    await client.release('release-695', {
      rationale: 'Current governed evidence is ready.',
      idempotencyKey: 'release:release-695'
    });
    await client.createRelease({
      filingAuthorizationId: 'filing-authorization_695',
      filingAuthorizationVersion: 3,
      requestedExecutionChannel: 'OFFICE_PORTAL',
      idempotencyKey: 'execution-release:filing-authorization_695:3'
    });

    const writes = fetch.mock.calls.filter(([url]) => !String(url).endsWith('/api/auth/session'));
    expect(writes.map(([url]) => String(url))).toEqual([
      'http://127.0.0.1:4000/api/execution/execution-releases/release-695/assignment',
      'http://127.0.0.1:4000/api/execution/execution-releases/release-695/release',
      'http://127.0.0.1:4000/api/execution/execution-releases'
    ]);
    expect(writes.map(([, init]) => JSON.parse(init?.body as string) as unknown)).toEqual([
      { expectedVersion: 7 },
      { rationale: 'Current governed evidence is ready.' },
      {
        filingAuthorizationId: 'filing-authorization_695',
        filingAuthorizationVersion: 3,
        requestedExecutionChannel: 'OFFICE_PORTAL'
      }
    ]);
    writes.forEach(([, init], index) => {
      expect(init?.credentials).toBe('include');
      const headers = new Headers(init?.headers);
      expect(headers.get('x-markorbit-workspace-id')).toBe('workspace-695');
      expect(headers.get('x-markorbit-csrf-token')).toBe('csrf-695');
      expect(headers.get('idempotency-key')).toBe(
        [null, 'release:release-695', 'execution-release:filing-authorization_695:3'][index]
      );
      const body = JSON.parse(init?.body as string) as Record<string, unknown>;
      for (const forbidden of [
        'internalExecutorId',
        'executorId',
        'decidedBy',
        'reviewerId',
        'actor',
        'actorId',
        'userId',
        'principal',
        'membershipId',
        'workspaceId'
      ])
        expect(body).not.toHaveProperty(forbidden);
    });
  });

  it.each([401, 403, 404, 409, 422, 503])(
    'preserves governed mutation status %s without fixture fallback',
    async (status) => {
      const fetch = vi.fn<(url: string) => Promise<Response>>((url) =>
        Promise.resolve(
          url.endsWith('/api/auth/session')
            ? new Response(JSON.stringify({ csrfToken: 'csrf-695' }), { status: 200 })
            : new Response(
                JSON.stringify({ code: `EXECUTION_${status}`, message: 'durable owner truth' }),
                { status }
              )
        )
      );
      vi.stubGlobal('fetch', fetch);

      await expect(
        createLiteExecutionClient('workspace-695').updateAssignment('release-695', {
          expectedVersion: 7
        })
      ).rejects.toEqual(
        new ExecutionHttpError(status, `EXECUTION_${status}`, 'durable owner truth')
      );
    }
  );

  it('keeps authentication failure distinct before a protected mutation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ code: 'AUTHENTICATION_REQUIRED', message: 'sign in' }), {
            status: 401
          })
        )
      )
    );

    await expect(
      createLiteExecutionClient('workspace-695').updateAssignment('release-695', {
        expectedVersion: 7
      })
    ).rejects.toEqual(new ExecutionHttpError(401, 'AUTHENTICATION_REQUIRED', 'sign in'));
  });

  it('maps transport failure to explicit 503 without fabricating release truth', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline')))
    );

    await expect(createLiteExecutionClient('workspace-695').listReleases()).rejects.toMatchObject({
      status: 503,
      code: 'DOWNSTREAM_UNAVAILABLE'
    });
  });
});
