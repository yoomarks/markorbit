import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from './client.js';
import { createExaminationStageClient } from './examination-stage.js';

describe('Examination Stage client', () => {
  it('uses only the authenticated public Gateway read and unwraps owner truth', async () => {
    const examination = { schemaVersion: 1, status: 'NOT_ESTABLISHED' };
    const get = vi.fn(() => Promise.resolve({ examination }));
    const post = vi.fn();
    const patch = vi.fn();
    const api = { get, post, patch } as unknown as ApiClient;
    const client = createExaminationStageClient(api);

    await expect(client.get('formal-matter/one')).resolves.toBe(examination);

    expect(get).toHaveBeenCalledOnce();
    expect(get).toHaveBeenCalledWith('/api/markreg/formal-matters/formal-matter%2Fone/examination');
    expect(get).not.toHaveBeenCalledWith(expect.stringContaining('/internal/'));
    expect(post).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });
});
