import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from './client.js';
import { createFormalMatterEvidenceClient } from './formal-matter-evidence.js';

describe('Formal Matter Evidence client', () => {
  it('forwards only the bounded owner-supported read query', async () => {
    const get = vi.fn(() => Promise.resolve({ schemaVersion: 1 }));
    const api = { get } as unknown as ApiClient;
    const client = createFormalMatterEvidenceClient(api);

    await client.get('formal-matter/one', {
      page: 3,
      pageSize: 7,
      reviewHistoryLimit: 2
    });

    expect(get).toHaveBeenCalledWith(
      '/api/markreg/formal-matters/formal-matter%2Fone/evidence?page=3&pageSize=7&reviewHistoryLimit=2'
    );
  });

  it('uses conservative bounded defaults', async () => {
    const get = vi.fn(() => Promise.resolve({ schemaVersion: 1 }));
    const api = { get } as unknown as ApiClient;
    const client = createFormalMatterEvidenceClient(api);

    await client.get('formal-matter_one');

    expect(get).toHaveBeenCalledWith(
      '/api/markreg/formal-matters/formal-matter_one/evidence?page=1&pageSize=10&reviewHistoryLimit=5'
    );
  });
});
