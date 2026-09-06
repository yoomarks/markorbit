import { describe, expect, it, vi } from 'vitest';
import {
  DATA_PLATFORM_BOUNDARY_TEXT,
  DATA_PLATFORM_UNAVAILABLE_TEXT,
  loadDataOwnerSummary,
  parseDataOwnerSummary
} from './data-platform.js';

const ownerSummary = {
  contract_version: 'MARKORBIT_DATA_ENGINE_INTEGRATION_V1',
  engine_version: 'M1.9',
  source_owner: 'MARKORBIT_DATA_ENGINE',
  authority: 'DATA_ENGINE_FACT_READ_MODEL',
  read_only: true,
  generated_at: '2026-09-05T08:30:00+00:00',
  health: { status: 'degraded' },
  operations: {
    version: 'MARKORBIT_OPERATIONS_V2',
    action_authority:
      'ADVISORY_ONLY_EXISTING_DOMAIN_GATES_AND_CHECKPOINT_VALIDATORS_REMAIN_AUTHORITATIVE',
    summary: {
      operation_count: 7,
      state_counts: { RUNNING: 1, BLOCKED: 2 },
      resume_candidates: 1,
      retry_candidates: 1,
      operator_required: 2,
      partial_state_preservation_required: 3
    }
  },
  domain_progress: {
    version: 'MARKORBIT_ADMIN_PROGRESS_V2',
    active_count: 1
  }
};

function response(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' }
    })
  );
}

describe('Data Control Center owner-summary presentation', () => {
  it('parses the bounded owner projection without turning owner health into platform truth', () => {
    expect(parseDataOwnerSummary(ownerSummary)).toEqual(ownerSummary);
  });

  it('fails closed on malformed authority, read-only and count semantics', () => {
    expect(
      parseDataOwnerSummary({ ...ownerSummary, authority: 'MO_PLATFORM_HEALTH' })
    ).toBeUndefined();
    expect(parseDataOwnerSummary({ ...ownerSummary, read_only: false })).toBeUndefined();
    expect(
      parseDataOwnerSummary({
        ...ownerSummary,
        domain_progress: { ...ownerSummary.domain_progress, active_count: -1 }
      })
    ).toBeUndefined();
  });

  it('loads only the dedicated governed Data summary route and rejects non-2xx or malformed success', async () => {
    const fetchImpl: typeof fetch = vi.fn(() => response(ownerSummary));
    await expect(loadDataOwnerSummary(fetchImpl)).resolves.toEqual(ownerSummary);
    expect(fetchImpl).toHaveBeenCalledWith('/api/internal/control-plane/data/summary', {
      method: 'GET',
      credentials: 'include',
      headers: { accept: 'application/json' }
    });

    await expect(
      loadDataOwnerSummary(vi.fn(() => response({ code: 'PERMISSION_DENIED' }, 403)))
    ).rejects.toThrow('Data owner summary unavailable (403 · PERMISSION_DENIED).');
    await expect(
      loadDataOwnerSummary(vi.fn(() => response({ ...ownerSummary, health: { status: 'unknown' } })))
    ).rejects.toThrow('Data owner summary is malformed and cannot be trusted.');
  });

  it('keeps unavailable and boundary language explicitly non-synthetic and read-only', () => {
    const unavailable = DATA_PLATFORM_UNAVAILABLE_TEXT.toLowerCase();
    expect(unavailable).toContain('not the same as healthy');
    expect(unavailable).toContain('empty');
    expect(unavailable).toContain('zero');
    expect(unavailable).toContain('no fallback state is inferred');

    const boundary = DATA_PLATFORM_BOUNDARY_TEXT.toLowerCase();
    expect(boundary).toContain('owner-local operational summary');
    expect(boundary).toContain('not mo platform-wide health');
    expect(boundary).toContain('not mo platform-wide health');
    expect(boundary).toContain('official truth');
    expect(boundary).toContain('specialist data engine admin remains authoritative');
    expect(boundary).not.toContain('approve');
    expect(boundary).not.toContain('activate');
    expect(boundary).not.toContain('repair');
  });
});
