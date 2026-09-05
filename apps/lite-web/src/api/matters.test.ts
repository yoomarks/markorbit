import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FormalMatter } from '@markorbit/contracts';
import { createMatterWorkspaceClient } from './matters.js';

afterEach(() => vi.unstubAllGlobals());

const matter = {
  formalMatterId: 'formal-matter_a/b',
  workspaceId: 'workspace-live',
  version: 4,
  snapshotSha256: 'f'.repeat(64),
  sourceMatterDraftId: 'matter-draft_1',
  sourceMatterDraftVersion: 3
} as FormalMatter;

describe('Matter Workspace Gateway client', () => {
  it('uses authenticated Workspace-scoped reads with exact filters and encoded IDs', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [], page: 2, pageSize: 20, total: 0 }), {
          status: 200
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ formalMatter: matter }), { status: 200 })
      );
    vi.stubGlobal('fetch', fetchMock);
    const client = createMatterWorkspaceClient('workspace-live');

    await client.list({
      search: 'orbit mark',
      status: 'OPEN',
      type: 'TRADEMARK_REGISTRATION',
      page: 2
    });
    await client.load('formal-matter_a/b');

    const urls = fetchMock.mock.calls.map(([url]) =>
      url instanceof Request ? url.url : url instanceof URL ? url.href : url
    );
    expect(urls).toEqual([
      '/api/markreg/formal-matters?search=orbit+mark&status=OPEN&type=TRADEMARK_REGISTRATION&page=2&pageSize=20',
      '/api/markreg/formal-matters/formal-matter_a%2Fb'
    ]);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.credentials).toBe('include');
      expect(new Headers(init?.headers).get('x-markorbit-workspace-id')).toBe('workspace-live');
      expect(new Headers(init?.headers).get('x-correlation-id')).toBeTruthy();
    }
  });

  it.each([401, 403, 404, 503])('preserves Matter HTTP %s without empty fallback', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ code: `HTTP_${status}`, message: 'Owner response' }), {
          status
        })
      )
    );
    await expect(createMatterWorkspaceClient('workspace-live').list({})).rejects.toMatchObject({
      status,
      code: `HTTP_${status}`
    });
  });

  it('obtains CSRF and starts review from exact current Matter lineage without browser actor fields', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: 'csrf-matter-846' }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ reviewCase: { reviewCaseId: 'review_846', version: 2 } }),
          { status: 201 }
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await createMatterWorkspaceClient('workspace-live').startProfessionalReview(
      matter
    );

    expect(result).toEqual({ reviewCaseId: 'review_846', version: 2 });
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/auth/session', { credentials: 'include' });
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe('/api/lite/professional-review-cases');
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' });
    const headers = new Headers(init?.headers);
    expect(headers.get('x-markorbit-workspace-id')).toBe('workspace-live');
    expect(headers.get('x-markorbit-csrf-token')).toBe('csrf-matter-846');
    expect(headers.get('idempotency-key')).toBe('professional-review:formal-matter_a/b');
    if (typeof init?.body !== 'string') throw new Error('Expected JSON body');
    expect(JSON.parse(init.body)).toEqual({
      formalMatterId: 'formal-matter_a/b',
      sourceFormalMatterVersion: 4,
      sourceSnapshotSha256: 'f'.repeat(64),
      matterDraftId: 'matter-draft_1',
      matterDraftVersion: '3'
    });
    expect(init.body).not.toMatch(/actorId|userId|principalId|reviewerId|workspaceId/);
  });

  it('fails closed on malformed review success', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ csrfToken: 'csrf-matter-846' }), { status: 200 })
        )
        .mockResolvedValueOnce(new Response(JSON.stringify({ reviewCase: {} }), { status: 201 }))
    );
    await expect(
      createMatterWorkspaceClient('workspace-live').startProfessionalReview(matter)
    ).rejects.toMatchObject({ status: 503, code: 'MALFORMED_REVIEW_RESPONSE' });
  });
});
