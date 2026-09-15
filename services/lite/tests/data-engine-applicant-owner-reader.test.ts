import { describe, expect, it, vi } from 'vitest';
import { HttpDataEngineApplicantOwnerReader } from '../src/data-engine-applicant-owner-reader.js';

const request = {
  requestContext: { requester_workspace_id: 'workspace-a', request_id: 'owner-read-1' },
  applicant: {
    applicant_candidate_id: 'applicant/one',
    source_reference: {
      owner: 'MARKORBIT_DATA_ENGINE' as const,
      authority: 'DATA_ENGINE_FACT_READ_MODEL' as const,
      jurisdiction: 'US' as const,
      source_kind: 'APPLICANT_IDENTITY' as const,
      source_id: 'applicant-source',
      source_version: 'M1.9-test',
      source_fingerprint_sha256: `sha256:${'a'.repeat(64)}`,
      observed_at: '2026-09-15T00:00:00.000Z'
    }
  },
  trademark: {
    trademark_candidate_id: 'trademark/one',
    source_reference: {
      owner: 'MARKORBIT_DATA_ENGINE' as const,
      authority: 'DATA_ENGINE_FACT_READ_MODEL' as const,
      jurisdiction: 'US' as const,
      source_kind: 'TRADEMARK_RECORD' as const,
      source_id: 'trademark-source',
      source_version: 'M1.9-test',
      source_fingerprint_sha256: `sha256:${'b'.repeat(64)}`,
      observed_at: '2026-09-15T00:00:00.000Z'
    }
  }
};

function response(headers: Record<string, string>) {
  return new Response(
    JSON.stringify({
      contract_version: 'MARKORBIT_DATA_ENGINE_INTEGRATION_V1',
      engine_version: 'M1.9-test',
      source_owner: 'MARKORBIT_DATA_ENGINE',
      jurisdiction: 'US',
      resource_kind: 'APPLICANT_PORTFOLIO_DISCOVERY',
      authority: 'DATA_ENGINE_FACT_READ_MODEL',
      legal_conclusion: false,
      fact_state: 'not_found',
      payload: null
    }),
    { status: 200, headers }
  );
}

describe('Lite Data Engine exact Applicant owner reader', () => {
  it('binds both exact source references and transport lineage', async () => {
    const fetchImpl = vi.fn<typeof fetch>((input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      expect(url).toContain('/applicants/applicant%2Fone/trademarks/trademark%2Fone?');
      expect(url).toContain('applicant_source_id=applicant-source');
      expect(url).toContain('trademark_source_id=trademark-source');
      return Promise.resolve(
        response({
          'x-request-id': 'owner-read-1',
          'x-correlation-id': 'owner-read-1',
          'x-markorbit-contract-version': 'MARKORBIT_DATA_ENGINE_INTEGRATION_V1',
          'x-markorbit-source-owner': 'MARKORBIT_DATA_ENGINE'
        })
      );
    });
    const reader = new HttpDataEngineApplicantOwnerReader({
      dataEngineUrl: 'https://data-engine.test/',
      apiKey: 'data-engine-test-key-01234567890123456789',
      fetchImpl
    });
    expect((await reader.readTrademark(request)).fact_state).toBe('not_found');
  });

  it('fails closed when owner transport lineage is not exact', async () => {
    const reader = new HttpDataEngineApplicantOwnerReader({
      dataEngineUrl: 'https://data-engine.test',
      apiKey: 'data-engine-test-key-01234567890123456789',
      fetchImpl: vi.fn(() => Promise.resolve(response({})))
    });
    await expect(reader.readTrademark(request)).rejects.toMatchObject({
      code: 'OWNER_READ_UNAVAILABLE',
      status: 503
    });
  });
});
