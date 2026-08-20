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
});
