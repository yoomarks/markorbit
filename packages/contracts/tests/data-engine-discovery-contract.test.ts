import { describe, expect, it } from 'vitest';

import {
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_ORDERING,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_PROJECTION_FIELDS,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_RESOURCE_KIND,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_SOURCE_SCHEMA_ID,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID,
  DATA_ENGINE_DISCOVERY_CONTRACT_VERSION,
  parseCnPreliminaryPublicationDiscoveryEnvelopeV2,
  parseCnPreliminaryPublicationDiscoveryPageV2
} from '../src/data-engine-discovery.js';
import {
  DATA_ENGINE_FACT_AUTHORITY,
  DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
  DATA_ENGINE_SOURCE_OWNER
} from '../src/data-engine.js';

const QUERY_HASH = `sha256:${'a'.repeat(64)}`;

function page(overrides: Record<string, unknown> = {}) {
  const scope = {
    jurisdiction: 'CN',
    application_number: { start_inclusive: '10000000', end_exclusive: '10001000' },
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
  const limits = { page_size: 25, max_pages: 10, max_results: 1000 };
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
    snapshot_id: 'epoch-2026-08-29',
    snapshot_kind: 'CN_QUIESCENT_SERVING_EPOCH',
    watermark: 'epoch-2026-08-29',
    source_version: 'M1.7-test'
  };
  const results = [
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
  ];
  return {
    stream_id: CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID,
    candidate_type: CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE,
    query,
    snapshot,
    results,
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
    },
    ...overrides
  };
}

function envelope(payload = page()) {
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

describe('CN preliminary-publication Discovery V2 contract', () => {
  it('accepts the exact bounded page and integration envelope', () => {
    expect(parseCnPreliminaryPublicationDiscoveryPageV2(page())).not.toBeNull();
    expect(parseCnPreliminaryPublicationDiscoveryEnvelopeV2(envelope())).not.toBeNull();
  });

  it('fails closed on query, ordering, snapshot and provenance drift', () => {
    const badQueryHash = page();
    badQueryHash.query.query_hash = 'sha256:BAD';
    expect(parseCnPreliminaryPublicationDiscoveryPageV2(badQueryHash)).toBeNull();

    const badOrdering = page();
    badOrdering.query.scope.ordering = ['application_number DESC'];
    expect(parseCnPreliminaryPublicationDiscoveryPageV2(badOrdering)).toBeNull();

    const badSnapshot = page();
    badSnapshot.provenance.snapshot = { ...badSnapshot.snapshot, snapshot_id: 'different' };
    expect(parseCnPreliminaryPublicationDiscoveryPageV2(badSnapshot)).toBeNull();

    const badProvenance = page();
    badProvenance.provenance.query_hash = `sha256:${'b'.repeat(64)}`;
    expect(parseCnPreliminaryPublicationDiscoveryPageV2(badProvenance)).toBeNull();
  });

  it('fails closed on out-of-range or non-deterministically ordered candidates', () => {
    const outOfRange = page();
    outOfRange.results[0]!.application_number = '10002000';
    expect(parseCnPreliminaryPublicationDiscoveryPageV2(outOfRange)).toBeNull();

    const unordered = page();
    unordered.results = [
      { ...unordered.results[0]!, case_id: 'case-2', application_number: '10000002' },
      { ...unordered.results[0]!, case_id: 'case-1', application_number: '10000001' }
    ];
    unordered.provenance.result_count = 2;
    unordered.provenance.emitted_count = 2;
    expect(parseCnPreliminaryPublicationDiscoveryPageV2(unordered)).toBeNull();
  });

  it('rejects envelope engine-version drift', () => {
    expect(
      parseCnPreliminaryPublicationDiscoveryEnvelopeV2({ ...envelope(), engine_version: 'other' })
    ).toBeNull();
  });
});
