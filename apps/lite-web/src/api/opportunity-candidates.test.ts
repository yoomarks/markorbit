import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OpportunityCandidateId } from '@markorbit/contracts/product-loop';
import { createOpportunityCandidateClient } from './opportunity-candidates.js';

afterEach(() => vi.unstubAllGlobals());

describe('Opportunity Candidate Gateway client', () => {
  it('uses only authenticated Gateway reads with Workspace context and exact encoded cursors', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ opportunityCandidateId: 'x' })))
      .mockResolvedValueOnce(new Response('null', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const client = createOpportunityCandidateClient('workspace-live');
    const id = 'opportunity-candidate_a/b' as OpportunityCandidateId;

    await client.list({ limit: 25, cursor: 'candidate cursor' });
    await client.load(id);
    await client.loadQualification(id);

    expect(
      fetchMock.mock.calls.map(([url]) =>
        url instanceof Request ? url.url : url instanceof URL ? url.href : url
      )
    ).toEqual([
      'http://127.0.0.1:4000/api/lite/opportunity-candidates?cursor=candidate+cursor&limit=25',
      'http://127.0.0.1:4000/api/lite/opportunity-candidates/opportunity-candidate_a%2Fb',
      'http://127.0.0.1:4000/api/lite/opportunity-candidates/opportunity-candidate_a%2Fb/qualification'
    ]);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.credentials).toBe('include');
      expect(new Headers(init?.headers).get('x-markorbit-workspace-id')).toBe('workspace-live');
      expect(JSON.stringify(init ?? {})).not.toContain('internal');
    }
  });

  it.each([401, 403, 404, 503])('preserves HTTP %s without fixture fallback', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ code: `HTTP_${status}`, message: 'Owner response' }), {
          status
        })
      )
    );
    const promise = createOpportunityCandidateClient('workspace-live').list();
    await expect(promise).rejects.toMatchObject({
      status,
      code: `HTTP_${status}`
    });
  });

  it('maps a network failure to retryable 503 rather than an empty page', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')));
    await expect(createOpportunityCandidateClient('workspace-live').list()).rejects.toMatchObject({
      status: 503,
      retryable: true
    });
  });
});
