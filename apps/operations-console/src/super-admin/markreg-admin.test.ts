import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadMarkRegCatalogue, loadMarkRegMatters, loadMarkRegOrders } from './markreg-admin.js';

afterEach(() => vi.restoreAllMocks());

describe('Super Admin MarkReg owner reads', () => {
  it('uses the existing catalogue boundary without browser authority headers', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );
    await loadMarkRegCatalogue();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/internal/commercial-admin/catalog?channel=MARKREG_DIRECT&relationshipModel=DIRECT',
      { credentials: 'include', headers: { accept: 'application/json' } }
    );
  });

  it('keeps Orders and Formal Matters explicitly Workspace-scoped', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ items: [], total: 0 }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      )
    );
    await loadMarkRegOrders('workspace/a');
    await loadMarkRegMatters('workspace/a');
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/internal/commercial-admin/workspaces/workspace%2Fa/orders?page=1&pageSize=20'
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/internal/commercial-admin/workspaces/workspace%2Fa/matters?page=1&pageSize=20'
    );
  });

  it('keeps owner failure distinct from known-empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ code: 'MARKREG_UNAVAILABLE', message: 'MarkReg unavailable' }),
        { status: 503, headers: { 'content-type': 'application/json' } }
      )
    );
    await expect(loadMarkRegCatalogue()).rejects.toThrow('MarkReg unavailable');
  });
});
