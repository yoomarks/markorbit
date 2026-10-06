import { describe, expect, it, vi } from 'vitest';
import { createKnowledgeOperatorRunClient } from './knowledge-operator-runs.js';

describe('Knowledge operator run client', () => {
  it('sends the exact plan and stable idempotency key through the authenticated Core bridge', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: 'csrf-1' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ replayed: false, record: { run: { id: 'run_1' } } }), {
          status: 201,
          headers: { 'content-type': 'application/json' }
        })
      );
    const client = createKnowledgeOperatorRunClient('workspace-1', {
      baseUrl: 'http://gateway.test/',
      fetchImpl
    });

    await expect(
      client.dispatch({ planId: 'pln_1', idempotencyKey: 'stable-run-1' })
    ).resolves.toMatchObject({ replayed: false, record: { run: { id: 'run_1' } } });

    expect(fetchImpl.mock.calls[0]).toEqual([
      'http://gateway.test/api/auth/session',
      { credentials: 'include' }
    ]);
    const [url, init] = fetchImpl.mock.calls[1]!;
    expect(url).toBe('http://gateway.test/api/knowledge/operator-runs');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('x-markorbit-workspace-id')).toBe('workspace-1');
    expect(new Headers(init?.headers).get('x-markorbit-csrf-token')).toBe('csrf-1');
    expect(new Headers(init?.headers).get('idempotency-key')).toBe('stable-run-1');
    expect(init?.body).toBe(JSON.stringify({ planId: 'pln_1' }));
  });

  it('fails closed when authentication or Knowledge rejects the request', async () => {
    const authFailure = createKnowledgeOperatorRunClient('workspace-1', {
      baseUrl: 'http://gateway.test',
      fetchImpl: vi.fn<typeof fetch>(() =>
        Promise.resolve(
          new Response(JSON.stringify({ code: 'AUTHENTICATION_REQUIRED' }), { status: 401 })
        )
      )
    });
    await expect(
      authFailure.dispatch({ planId: 'pln_1', idempotencyKey: 'stable-run-1' })
    ).rejects.toMatchObject({
      status: 401,
      code: 'AUTHENTICATION_REQUIRED'
    });

    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: 'csrf-1' }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 'IDEMPOTENCY_CONFLICT', message: 'Conflict.' }), {
          status: 409
        })
      );
    const conflict = createKnowledgeOperatorRunClient('workspace-1', {
      baseUrl: 'http://gateway.test',
      fetchImpl
    });
    await expect(
      conflict.dispatch({ planId: 'pln_1', idempotencyKey: 'stable-run-1' })
    ).rejects.toMatchObject({ status: 409, code: 'IDEMPOTENCY_CONFLICT' });
  });
});
