import { describe, expect, it, vi } from 'vitest';

import {
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_ORDERING,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_PROJECTION_FIELDS,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_RESOURCE_KIND,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_SOURCE_SCHEMA_ID,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID,
  DATA_ENGINE_DISCOVERY_CONTRACT_VERSION
} from '@markorbit/contracts/data-engine-discovery';
import {
  DATA_ENGINE_FACT_AUTHORITY,
  DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
  DATA_ENGINE_SOURCE_OWNER
} from '@markorbit/contracts/data-engine';

import { createCnPreliminaryPublicationDiscoveryClientV2 } from '../src/data-engine-discovery-http.js';
import { createDataEngineClient, DataEngineClientError } from '../src/data-engine-http.js';

const QUERY_HASH = `sha256:${'a'.repeat(64)}`;

function envelope(start = '10000000', end = '10001000', pageSize = 25) {
  const scope = {
    jurisdiction: 'CN',
    application_number: { start_inclusive: start, end_exclusive: end },
    is_deleted: 0,
    prelim_pub_date_not_null: true,
    ordering: [...CN_PRELIMINARY_PUBLICATION_DISCOVERY_ORDERING],
    ranking: 'NONE',
    joins: 'NONE',
    read_budget: {
      max_rows_to_read: 250000,
      max_bytes_to_read: 268435456,
      overflow_mode: 'throw'
    }
  };
  const limits = { page_size: pageSize, max_pages: 10, max_results: 1000 };
  const query = {
    contract_version: DATA_ENGINE_DISCOVERY_CONTRACT_VERSION,
    stream_id: CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID,
    source_schema_id: CN_PRELIMINARY_PUBLICATION_DISCOVERY_SOURCE_SCHEMA_ID,
    candidate_type: CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE,
    projection_fields: [...CN_PRELIMINARY_PUBLICATION_DISCOVERY_PROJECTION_FIELDS],
    scope,
    limits,
    query_hash: QUERY_HASH
  };
  const snapshot = {
    snapshot_id: 'epoch-v1',
    snapshot_kind: 'CN_QUIESCENT_SERVING_EPOCH',
    watermark: 'epoch-v1',
    source_version: 'M1.7-test'
  };
  const payload = {
    stream_id: CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID,
    candidate_type: CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE,
    query,
    snapshot,
    results: [
      {
        candidate_type: CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE,
        case_id: 'case-1',
        application_number: '10000001',
        mark_name_raw: 'MARK',
        classes: [9],
        filing_date: '2025-01-01',
        prelim_pub_date: '2026-01-01',
        prelim_pub_issue: '1910',
        source_effective_date: null,
        source_package_id: 'package-1',
        source_row_hash: 'row-hash-1',
        record_hash: 'record-hash-1',
        source_rank: 1
      }
    ],
    next_cursor: null,
    provenance: {
      contract_version: DATA_ENGINE_DISCOVERY_CONTRACT_VERSION,
      query_hash: QUERY_HASH,
      stream_id: CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID,
      candidate_type: CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE,
      source_schema_id: CN_PRELIMINARY_PUBLICATION_DISCOVERY_SOURCE_SCHEMA_ID,
      projection_fields: [...CN_PRELIMINARY_PUBLICATION_DISCOVERY_PROJECTION_FIELDS],
      scope,
      limits,
      snapshot,
      engine_version: 'M1.7-test',
      page_number: 1,
      result_count: 1,
      emitted_count: 1,
      has_more: false
    },
    bounded_truncation: false,
    read_budget: {
      max_rows_to_read: 250000,
      max_bytes_to_read: 268435456,
      read_overflow_mode: 'throw'
    }
  };
  return {
    contract_version: DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
    engine_version: 'M1.7-test',
    source_owner: DATA_ENGINE_SOURCE_OWNER,
    jurisdiction: 'CN',
    resource_kind: CN_PRELIMINARY_PUBLICATION_DISCOVERY_RESOURCE_KIND,
    authority: DATA_ENGINE_FACT_AUTHORITY,
    legal_conclusion: false,
    fact_state: 'observed',
    payload
  };
}

function response(body: unknown, requestId: string, correlationId: string) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'x-request-id': requestId,
      'x-correlation-id': correlationId,
      'x-markorbit-contract-version': DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
      'x-markorbit-source-owner': DATA_ENGINE_SOURCE_OWNER
    }
  });
}

describe('Gateway CN preliminary-publication Discovery adapter', () => {
  it('reuses the authenticated V1 transport and sends only the bounded V2 query', async () => {
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('authorization')).toBe(`Bearer ${'k'.repeat(32)}`);
      expect(headers.get('x-request-id')).toBe('request-1');
      expect(headers.get('x-correlation-id')).toBe('correlation-1');
      return Promise.resolve(response(envelope(), 'request-1', 'correlation-1'));
    });
    const client = createDataEngineClient({
      dataEngineUrl: 'https://data-engine.test',
      apiKey: 'k'.repeat(32),
      fetchImpl,
      requestIdFactory: () => 'generated-request'
    });
    const discovery = createCnPreliminaryPublicationDiscoveryClientV2(client);

    const result = await discovery.discover(
      {
        applicationNumberStart: '10000000',
        applicationNumberEnd: '10001000',
        pageSize: 25,
        cursor: 'opaque-cursor'
      },
      { requestId: 'request-1', correlationId: 'correlation-1' }
    );

    expect(result.payload.query.query_hash).toBe(QUERY_HASH);
    const calledInput = fetchImpl.mock.calls[0]?.[0];
    if (calledInput === undefined) throw new Error('Data Engine Discovery fetch was not invoked.');
    const calledUrl =
      typeof calledInput === 'string'
        ? calledInput
        : calledInput instanceof URL
          ? calledInput.href
          : calledInput.url;
    expect(calledUrl).toContain('/api/v1/cn/discovery/preliminary-publications?');
    expect(calledUrl).toContain('application_number_start=10000000');
    expect(calledUrl).toContain('application_number_end=10001000');
    expect(calledUrl).toContain('page_size=25');
    expect(calledUrl).toContain('cursor=opaque-cursor');
    expect(calledUrl).not.toContain('offset=');
    expect(calledUrl).not.toContain('rank');
  });

  it('fails closed when Data Engine returns different bounds', async () => {
    const rawGet = vi.fn(() => Promise.resolve(envelope('10000000', '10002000', 25)));
    const discovery = createCnPreliminaryPublicationDiscoveryClientV2({ rawGet });

    await expect(
      discovery.discover({
        applicationNumberStart: '10000000',
        applicationNumberEnd: '10001000',
        pageSize: 25
      })
    ).rejects.toMatchObject({
      code: 'DATA_ENGINE_CONTRACT_MISMATCH'
    } satisfies Partial<DataEngineClientError>);
  });

  it('rejects invalid bounds before touching the integration plane', async () => {
    const rawGet = vi.fn();
    const discovery = createCnPreliminaryPublicationDiscoveryClientV2({ rawGet });

    await expect(
      discovery.discover({
        applicationNumberStart: '10001000',
        applicationNumberEnd: '10000000'
      })
    ).rejects.toThrow('lexical application-number range');
    expect(rawGet).not.toHaveBeenCalled();
  });
});
