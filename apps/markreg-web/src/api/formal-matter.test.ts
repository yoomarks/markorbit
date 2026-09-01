import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from './client.js';
import { createFormalMatterListClient } from './formal-matter.js';

describe('Formal Matter list client', () => {
  it('forwards bounded list filters through the authenticated Gateway route', async () => {
    const get = vi.fn(() => Promise.resolve({ items: [], page: 2, pageSize: 10, total: 0 }));
    const api = { get } as unknown as ApiClient;
    const client = createFormalMatterListClient(api);

    await client.list({
      status: 'OPEN',
      type: 'TRADEMARK_REGISTRATION',
      search: 'mark one',
      createdFrom: '2026-08-01T00:00:00.000Z',
      createdTo: '2026-09-01T00:00:00.000Z',
      page: 2,
      pageSize: 10
    });

    expect(get).toHaveBeenCalledWith(
      '/api/markreg/formal-matters?status=OPEN&type=TRADEMARK_REGISTRATION&search=mark+one&createdFrom=2026-08-01T00%3A00%3A00.000Z&createdTo=2026-09-01T00%3A00%3A00.000Z&page=2&pageSize=10'
    );
  });
});
