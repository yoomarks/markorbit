import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLiteExecutionClient } from './execution.js';

afterEach(() => vi.restoreAllMocks());

describe('authenticated Execution transport', () => {
  it('sends browser session, Workspace context, CSRF and idempotency for mutations', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: 'csrf_exact' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ executionRelease: {}, consequences: {} }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      );
    const client = createLiteExecutionClient('workspace_exact', 'https://gateway.example');

    await client.createRelease({
      filingAuthorizationId: 'filing-authorization_exact',
      filingAuthorizationVersion: 2,
      requestedExecutionChannel: 'OFFICE_PORTAL',
      idempotencyKey: 'release-create:exact'
    });

    expect(fetch).toHaveBeenNthCalledWith(1, 'https://gateway.example/api/auth/session', {
      credentials: 'include'
    });
    expect(fetch.mock.calls[1]![0]).toBe(
      'https://gateway.example/api/execution/execution-releases'
    );
    const request = fetch.mock.calls[1]![1] as RequestInit;
    expect(request.method).toBe('POST');
    expect(request.credentials).toBe('include');
    expect(request.headers).toMatchObject({
      'x-markorbit-workspace-id': 'workspace_exact',
      'x-markorbit-csrf-token': 'csrf_exact',
      'idempotency-key': 'release-create:exact'
    });
  });

  it('submits only expected currentness for trusted self-assignment', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: 'csrf_exact' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ executionRelease: {} })));
    const client = createLiteExecutionClient('workspace_exact', 'https://gateway.example');

    await client.updateAssignment('execution-release_exact', { expectedVersion: 3 });

    const request = fetch.mock.calls[1]![1] as RequestInit;
    expect(request.body).toBe(JSON.stringify({ expectedVersion: 3 }));
  });
});
