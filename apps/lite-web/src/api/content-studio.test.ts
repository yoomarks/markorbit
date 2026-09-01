import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContentStudioHttpError, createContentStudioClient } from './content-studio.js';

afterEach(() => vi.unstubAllGlobals());

describe('Content Studio authenticated Gateway client', () => {
  it('uses only the Gateway list/detail routes with durable work identity and pagination', async () => {
    const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
    fetch.mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const client = createContentStudioClient('workspace-1');
    await client.list('cursor/2');
    await client.find('content-opportunity_stable');
    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([
      'http://127.0.0.1:4000/api/lite/content-studio/works?limit=20&after=cursor%2F2',
      'http://127.0.0.1:4000/api/lite/content-studio/works/content-opportunity_stable'
    ]);
    for (const [, init] of fetch.mock.calls) {
      expect(init).toMatchObject({
        credentials: 'include',
        headers: { 'x-markorbit-workspace-id': 'workspace-1' }
      });
    }
  });

  it.each([400, 401, 403, 404, 503])(
    'preserves %s instead of fabricating an empty list',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve(
            new Response(JSON.stringify({ code: `OWNER_${status}`, message: 'owner truth' }), {
              status
            })
          )
        )
      );
      await expect(createContentStudioClient('workspace-1').list()).rejects.toEqual(
        new ContentStudioHttpError(status, `OWNER_${status}`, 'owner truth')
      );
    }
  );

  it('maps transport failure to 503 without fixture fallback', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline')))
    );
    await expect(createContentStudioClient('workspace-1').list()).rejects.toMatchObject({
      status: 503,
      code: 'DOWNSTREAM_UNAVAILABLE'
    });
  });
});
