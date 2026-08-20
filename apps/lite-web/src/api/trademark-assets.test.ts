import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTrademarkAssetClient } from './trademark-assets.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Trademark Asset client', () => {
  it('sends authenticated workspace context on portfolio reads', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
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
    vi.stubGlobal('fetch', fetchMock);

    await createTrademarkAssetClient(workspaceId).search({
      query: 'orbit',
      relationshipKinds: ['REPRESENTED'],
      limit: 25
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestedUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(requestedUrl).toContain('/api/lite/trademark-assets?');
    expect(requestedUrl).toContain('q=orbit');
    expect(requestedUrl).toContain('relationship=REPRESENTED');
    expect(requestedUrl).toContain('limit=25');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
        headers: expect.objectContaining({
          'x-markorbit-workspace-id': workspaceId
        })
      })
    );
  });

  it('encodes the asset id for detail reads', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ view: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await createTrademarkAssetClient(workspaceId).load('trademark-asset_test');

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      '/api/lite/trademark-assets/trademark-asset_test'
    );
  });
});
