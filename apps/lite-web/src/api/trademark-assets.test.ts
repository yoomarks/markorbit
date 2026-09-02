import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTrademarkAssetClient } from './trademark-assets.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Trademark Asset client', () => {
  it('sends authenticated workspace context on portfolio reads', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    const fetchMock: typeof fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = requestUrl(input);
      capturedInit = init;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            schemaVersion: 1,
            workspaceId,
            assets: [],
            hasMore: false,
            officialTruthVerifiedByLite: false
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    await createTrademarkAssetClient(workspaceId).search({
      query: 'orbit',
      relationshipKinds: ['REPRESENTED'],
      limit: 25
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(capturedUrl).toContain('/api/lite/trademark-assets?');
    expect(capturedUrl).toContain('q=orbit');
    expect(capturedUrl).toContain('relationship=REPRESENTED');
    expect(capturedUrl).toContain('limit=25');
    expect(capturedInit?.method).toBe('GET');
    expect(capturedInit?.credentials).toBe('include');
    expect(new Headers(capturedInit?.headers).get('x-markorbit-workspace-id')).toBe(workspaceId);
  });

  it('encodes the asset id for detail reads', async () => {
    let capturedUrl = '';
    const fetchMock: typeof fetch = vi.fn((input: RequestInfo | URL) => {
      capturedUrl = requestUrl(input);
      return Promise.resolve(
        new Response(JSON.stringify({ view: {} }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    await createTrademarkAssetClient(workspaceId).load('trademark-asset_test');

    expect(capturedUrl).toContain('/api/lite/trademark-assets/trademark-asset_test');
  });

  it('saves Commerce Profile through the authenticated Gateway mutation conventions', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock: typeof fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      requests.push({ url, ...(init ? { init } : {}) });
      if (url.endsWith('/api/auth/session')) {
        return Promise.resolve(
          new Response(JSON.stringify({ csrfToken: 'csrf-commerce' }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            commerceProfile: {
              trademarkAssetId: 'trademark-asset_test',
              workspaceId,
              version: 2
            }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const saved = await createTrademarkAssetClient(workspaceId).saveCommerceProfile(
      'trademark-asset_test',
      {
        expectedTrademarkAssetVersion: 3,
        expectedCommerceProfileVersion: 1,
        saleIntent: 'FOR_SALE',
        sellerRole: 'OWNER'
      }
    );

    expect(saved.version).toBe(2);
    expect(requests).toHaveLength(2);
    const mutation = requests[1]!;
    expect(mutation.url).toContain(
      '/api/lite/trademark-assets/trademark-asset_test/commerce-profile'
    );
    expect(mutation.init?.method).toBe('POST');
    expect(mutation.init?.credentials).toBe('include');
    const headers = new Headers(mutation.init?.headers);
    expect(headers.get('x-markorbit-workspace-id')).toBe(workspaceId);
    expect(headers.get('x-markorbit-csrf-token')).toBe('csrf-commerce');
    expect(headers.get('idempotency-key')).toMatch(/^commerce-profile-trademark-asset_test-/);
    const mutationBody = mutation.init?.body;
    if (typeof mutationBody !== 'string') throw new Error('Expected a JSON request body.');
    expect(JSON.parse(mutationBody)).toEqual({
      expectedTrademarkAssetVersion: 3,
      expectedCommerceProfileVersion: 1,
      saleIntent: 'FOR_SALE',
      sellerRole: 'OWNER'
    });
  });

  it('prepares bounded AI Guide suggestions with CSRF and no caller authority fields', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock: typeof fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      requests.push({ url, ...(init ? { init } : {}) });
      if (url.endsWith('/api/auth/session')) {
        return Promise.resolve(
          new Response(JSON.stringify({ csrfToken: 'csrf-ai-guide' }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            schemaVersion: 1,
            workspaceId,
            subjectUserId: 'server-derived-user',
            trademarkAssetId: 'trademark-asset_test',
            trademarkAssetVersion: 3,
            contextReferences: [],
            evidence: [],
            suggestions: [],
            staleOrConflictingEvidencePresent: false,
            officialTruthCreatedByGuide: false,
            officialStatusVerifiedByGuide: false,
            deadlineCertifiedByGuide: false,
            externalActionAuthorizedByGuide: false,
            customerOrProviderContactAuthorizedByGuide: false,
            paidExecutionAuthorizedByGuide: false,
            generatedAt: '2026-09-02T00:00:00.000Z'
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await createTrademarkAssetClient(workspaceId).prepareAiGuide(
      'trademark-asset_test',
      {
        expectedTrademarkAssetVersion: 3,
        requestedKinds: ['EXPLAIN_ASSET', 'IDENTIFY_MISSING_INFORMATION', 'PREPARE_CHECKLIST']
      }
    );

    expect(result.trademarkAssetVersion).toBe(3);
    expect(requests).toHaveLength(2);
    expect(requests[0]?.url).toContain('/api/auth/session');
    const preparation = requests[1]!;
    expect(preparation.url).toContain('/api/lite/trademark-assets/trademark-asset_test/ai-guide');
    expect(preparation.init?.method).toBe('POST');
    expect(preparation.init?.credentials).toBe('include');
    const headers = new Headers(preparation.init?.headers);
    expect(headers.get('x-markorbit-workspace-id')).toBe(workspaceId);
    expect(headers.get('x-markorbit-csrf-token')).toBe('csrf-ai-guide');
    expect(headers.has('idempotency-key')).toBe(false);
    const body = preparation.init?.body;
    if (typeof body !== 'string') throw new Error('Expected a JSON request body.');
    const parsed = JSON.parse(body) as Record<string, unknown>;
    expect(parsed).toEqual({
      expectedTrademarkAssetVersion: 3,
      requestedKinds: ['EXPLAIN_ASSET', 'IDENTIFY_MISSING_INFORMATION', 'PREPARE_CHECKLIST']
    });
    expect(parsed).not.toHaveProperty('workspaceId');
    expect(parsed).not.toHaveProperty('subjectUserId');
    expect(parsed).not.toHaveProperty('principal');
    expect(parsed).not.toHaveProperty('provenance');
    expect(parsed).not.toHaveProperty('contextReferences');
  });
});
