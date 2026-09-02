import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from './client.js';
import { createMatterIntelligenceClient } from './matter-intelligence.js';

describe('Matter Intelligence client', () => {
  it('forwards only the bounded owner-supported read query', async () => {
    const get = vi.fn(() => Promise.resolve({ items: [], page: 2, pageSize: 8, total: 0 }));
    const api = { get } as unknown as ApiClient;
    const client = createMatterIntelligenceClient(api);

    await client.get('formal-matter/one', {
      page: 2,
      pageSize: 8,
      reviewHistoryLimit: 3
    });

    expect(get).toHaveBeenCalledWith(
      '/api/markreg/formal-matters/formal-matter%2Fone/intelligence?page=2&pageSize=8&reviewHistoryLimit=3'
    );
  });

  it('uses conservative bounded defaults', async () => {
    const get = vi.fn(() => Promise.resolve({ items: [], page: 1, pageSize: 10, total: 0 }));
    const api = { get } as unknown as ApiClient;
    const client = createMatterIntelligenceClient(api);

    await client.get('formal-matter_one');

    expect(get).toHaveBeenCalledWith(
      '/api/markreg/formal-matters/formal-matter_one/intelligence?page=1&pageSize=10&reviewHistoryLimit=5'
    );
  });
});
