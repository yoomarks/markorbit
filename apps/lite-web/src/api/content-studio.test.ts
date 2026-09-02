import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContentStudioHttpError, createContentStudioClient } from './content-studio.js';
import { draft, opportunity, publishPackage, review } from '../features/content-studio/fixtures.js';

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

  it('uses exact governed preparation routes, bodies, Workspace, CSRF and caller idempotency keys', async () => {
    const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>((url) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url.endsWith('/api/auth/session') ? { csrfToken: 'csrf-preparation' } : {}
          ),
          { status: 200 }
        )
      )
    );
    vi.stubGlobal('fetch', fetch);
    const client = createContentStudioClient('workspace-1');

    await client.createDraft(
      opportunity,
      { title: 'First title', body: 'First body' },
      'create-key'
    );
    await client.reviseDraft(draft, { title: 'Next title', body: 'Next body' }, 'revise-key');
    await client.markReadyForReview(draft, 'ready-key');
    await client.recordReview(
      draft,
      { outcome: 'CHANGES_REQUIRED', rationale: 'Clarify the evidence.' },
      'review-key'
    );
    await client.preparePublishPackage(draft, review, 'package-key');

    const writes = fetch.mock.calls.filter(([url]) => !String(url).endsWith('/api/auth/session'));
    expect(writes.map(([url]) => String(url))).toEqual([
      'http://127.0.0.1:4000/api/lite/content-studio/works/content-opportunity_413/drafts',
      'http://127.0.0.1:4000/api/lite/content-drafts/content-draft_413/revisions',
      'http://127.0.0.1:4000/api/lite/content-drafts/content-draft_413/ready-for-review',
      'http://127.0.0.1:4000/api/lite/content-drafts/content-draft_413/reviews',
      'http://127.0.0.1:4000/api/lite/content-drafts/content-draft_413/publish-packages'
    ]);
    expect(writes.map(([, init]) => JSON.parse(init?.body as string) as unknown)).toEqual([
      {
        contentOpportunityVersion: opportunity.version,
        expectedContentOpportunityFingerprintSha256:
          opportunity.contentOpportunityFingerprintSha256,
        title: 'First title',
        body: 'First body'
      },
      {
        expectedVersion: draft.version,
        expectedContentDraftFingerprintSha256: draft.contentDraftFingerprintSha256,
        title: 'Next title',
        body: 'Next body'
      },
      {
        expectedVersion: draft.version,
        expectedContentDraftFingerprintSha256: draft.contentDraftFingerprintSha256
      },
      {
        contentDraftVersion: draft.version,
        expectedContentDraftFingerprintSha256: draft.contentDraftFingerprintSha256,
        outcome: 'CHANGES_REQUIRED',
        rationale: 'Clarify the evidence.'
      },
      {
        contentDraftVersion: draft.version,
        expectedContentDraftFingerprintSha256: draft.contentDraftFingerprintSha256,
        reviewDecisionId: review.contentReviewDecisionId,
        reviewDecisionVersion: review.version
      }
    ]);
    writes.forEach(([, init], index) => {
      const headers = new Headers(init?.headers);
      expect(init?.method).toBe('POST');
      expect(init?.credentials).toBe('include');
      expect(headers.get('x-markorbit-workspace-id')).toBe('workspace-1');
      expect(headers.get('x-markorbit-csrf-token')).toBe('csrf-preparation');
      expect(headers.get('idempotency-key')).toBe(
        ['create-key', 'revise-key', 'ready-key', 'review-key', 'package-key'][index]
      );
      expect(JSON.parse(init?.body as string)).not.toHaveProperty('reviewerPrincipalId');
      expect(JSON.parse(init?.body as string)).not.toHaveProperty('actor');
      expect(JSON.parse(init?.body as string)).not.toHaveProperty('userId');
    });
  });

  it.each([401, 403, 404, 409, 422, 503])(
    'preserves governed preparation mutation error status %s',
    async (status) => {
      const fetch = vi.fn<(url: string) => Promise<Response>>((url) =>
        Promise.resolve(
          url.endsWith('/api/auth/session')
            ? new Response(JSON.stringify({ csrfToken: 'csrf' }), { status: 200 })
            : new Response(JSON.stringify({ code: `PREP_${status}`, message: 'owner truth' }), {
                status
              })
        )
      );
      vi.stubGlobal('fetch', fetch);
      await expect(
        createContentStudioClient('workspace-1').markReadyForReview(draft, 'same-logical-key')
      ).rejects.toEqual(new ContentStudioHttpError(status, `PREP_${status}`, 'owner truth'));
    }
  );

  it.each([
    ['USER_REPORTED_PUBLISHED', 'USER_REPORTED_PUBLISHED'],
    ['USER_REPORTED_USED', 'USER_REPORTED_USED'],
    ['NOT_USED', 'NOT_USED']
  ] as const)(
    'records %s with the canonical authenticated package protocol',
    async (_, outcome) => {
      const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>((url) =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              url.endsWith('/api/auth/session') ? { csrfToken: 'csrf-content-studio' } : { outcome }
            ),
            { status: 200 }
          )
        )
      );
      vi.stubGlobal('fetch', fetch);

      await createContentStudioClient('workspace-1').recordUseFeedback(publishPackage, outcome);

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch.mock.calls[0]).toEqual([
        'http://127.0.0.1:4000/api/auth/session',
        { credentials: 'include' }
      ]);
      const [url, init] = fetch.mock.calls[1]!;
      expect(url).toBe(
        'http://127.0.0.1:4000/api/lite/publish-packages/publish-package_413/use-feedback'
      );
      expect(init).toMatchObject({ method: 'POST', credentials: 'include' });
      const headers = new Headers(init?.headers);
      expect(headers.get('x-markorbit-workspace-id')).toBe('workspace-1');
      expect(headers.get('x-markorbit-csrf-token')).toBe('csrf-content-studio');
      expect(headers.get('idempotency-key')).toBe('feedback:publish-package_413:1');
      expect(typeof init?.body).toBe('string');
      expect(JSON.parse(init?.body as string)).toEqual({
        workspaceId: 'workspace-1',
        publishPackageVersion: publishPackage.version,
        expectedPublishPackageFingerprintSha256: publishPackage.publishPackageFingerprintSha256,
        outcome
      });
    }
  );

  it.each([401, 403, 404, 409, 503])(
    'preserves feedback mutation error status %s',
    async (status) => {
      const fetch = vi.fn<(url: string) => Promise<Response>>((url) =>
        Promise.resolve(
          url.endsWith('/api/auth/session')
            ? new Response(JSON.stringify({ csrfToken: 'csrf' }), { status: 200 })
            : new Response(JSON.stringify({ code: `FEEDBACK_${status}`, message: 'owner truth' }), {
                status
              })
        )
      );
      vi.stubGlobal('fetch', fetch);
      await expect(
        createContentStudioClient('workspace-1').recordUseFeedback(
          publishPackage,
          'USER_REPORTED_USED'
        )
      ).rejects.toEqual(new ContentStudioHttpError(status, `FEEDBACK_${status}`, 'owner truth'));
    }
  );

  it('keeps authentication/session failure distinct before mutation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ code: 'AUTH_REQUIRED', message: 'sign in' }), {
            status: 401
          })
        )
      )
    );
    await expect(
      createContentStudioClient('workspace-1').recordUseFeedback(
        publishPackage,
        'USER_REPORTED_PUBLISHED'
      )
    ).rejects.toEqual(new ContentStudioHttpError(401, 'AUTH_REQUIRED', 'sign in'));
  });
});
