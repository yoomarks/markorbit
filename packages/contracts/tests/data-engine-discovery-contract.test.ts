import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  CN_PRELIMINARY_PUBLICATION_DATA_TRUST_VERSION,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_ORDERING,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_PROJECTION_FIELDS,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_RESOURCE_KIND,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_SOURCE_SCHEMA_ID,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID,
  CN_PRELIMINARY_PUBLICATION_SOURCE_READ_DOMAIN,
  CN_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_CONTRACT_VERSION,
  CN_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_KIND,
  CN_PRELIMINARY_PUBLICATION_TRUSTED_SILENCE_SEMANTIC,
  DATA_ENGINE_DISCOVERY_CONTRACT_VERSION,
  parseCnPreliminaryPublicationDiscoveryEnvelopeV2,
  parseCnPreliminaryPublicationDiscoveryPageV2,
  parseCnPreliminaryPublicationSourceReadReceiptV3,
  toCnPreliminaryPublicationSourceReadReceiptReferenceV3
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
    Object.assign(badOrdering.query.scope, { ordering: ['application_number DESC'] });
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

  it('keeps integration release version separate from exact Discovery source version', () => {
    expect(
      parseCnPreliminaryPublicationDiscoveryEnvelopeV2({
        ...envelope(),
        engine_version: '0.4.0'
      })
    ).not.toBeNull();

    const internalDrift = page();
    internalDrift.provenance.engine_version = 'git:different';
    expect(parseCnPreliminaryPublicationDiscoveryEnvelopeV2(envelope(internalDrift))).toBeNull();
  });
});

type SourceReadStateV3 = 'OBSERVED' | 'EMPTY' | 'NOT_OBSERVED' | 'NOT_COVERED' | 'UNAVAILABLE';

function testCanonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(testCanonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, entry]) => [key, testCanonicalize(entry)])
    );
  }
  return value;
}

function testFingerprint(value: unknown): string {
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(testCanonicalize(value)), 'utf8')
    .digest('hex')}`;
}

const SOURCE_READ_SNAPSHOT_ID = 'epoch-2026-10-09';
const SOURCE_CORPUS_FINGERPRINT = testFingerprint({ corpus: '2026-10-09' });

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('test fixture member must be an object');
  }
  return value as Record<string, unknown>;
}

function asList(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) throw new TypeError('test fixture member must be an array');
  return value.map(asObject);
}

function ownerEvidence(
  kind: string,
  snapshotId: string | null = SOURCE_READ_SNAPSHOT_ID,
  sourceCorpusFingerprint: string | null = SOURCE_CORPUS_FINGERPRINT
) {
  return {
    source_owner: DATA_ENGINE_SOURCE_OWNER,
    evidence_kind: kind,
    evidence_id: `evidence:${kind}:中文`,
    evidence_version: '2026-10-10T00:00:00.000Z',
    evidence_fingerprint_sha256: testFingerprint({ kind, version: 1, nullable: null }),
    snapshot_id: snapshotId,
    source_corpus_fingerprint_sha256: sourceCorpusFingerprint
  };
}

function normalizedSourceReadQuery() {
  return {
    contract_version: DATA_ENGINE_DISCOVERY_CONTRACT_VERSION,
    stream_id: CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID,
    source_schema_id: CN_PRELIMINARY_PUBLICATION_DISCOVERY_SOURCE_SCHEMA_ID,
    candidate_type: CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE,
    projection_fields: [...CN_PRELIMINARY_PUBLICATION_DISCOVERY_PROJECTION_FIELDS],
    scope: {
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
    },
    limits: { page_size: 100, max_pages: 10, max_results: 1000 }
  };
}

function trustedDataTrust(trusted: boolean) {
  const coverageThrough = trusted ? '2026-10-09T00:00:00.000Z' : '2026-10-08T00:00:00.000Z';
  const requiredCoverageThrough = '2026-10-09T00:00:00.000Z';
  const dimension = (name: string, value: boolean) => ({
    value,
    evidence_reference: ownerEvidence(`DATA_TRUST_${name.toUpperCase()}`)
  });
  return {
    trust_version: CN_PRELIMINARY_PUBLICATION_DATA_TRUST_VERSION,
    domain: CN_PRELIMINARY_PUBLICATION_SOURCE_READ_DOMAIN,
    snapshot_id: SOURCE_READ_SNAPSHOT_ID,
    source_corpus_fingerprint_sha256: SOURCE_CORPUS_FINGERPRINT,
    queryable: dimension('queryable', true),
    complete: dimension('complete', true),
    fresh: dimension('fresh', trusted),
    accepted: dimension('accepted', true),
    trusted_for_silence: dimension('trusted_for_silence', trusted),
    evaluated_at: '2026-10-10T08:02:30.000Z',
    coverage_through: coverageThrough,
    required_coverage_through: requiredCoverageThrough,
    acceptance_status: 'PASS',
    source_supports_silence: true,
    reason_codes: trusted ? [] : ['SOURCE_COVERAGE_STALE'],
    silence_semantics: CN_PRELIMINARY_PUBLICATION_TRUSTED_SILENCE_SEMANTIC,
    legal_conclusion: false
  };
}

function resealSourceReadReceipt(receipt: Record<string, unknown>): Record<string, unknown> {
  const material = structuredClone(receipt);
  delete material.receipt_fingerprint_sha256;
  receipt.receipt_fingerprint_sha256 = testFingerprint(material);
  return receipt;
}

function rebindSourceReadQuery(receipt: Record<string, unknown>): Record<string, unknown> {
  const queryFingerprint = testFingerprint(receipt.query);
  receipt.query_fingerprint_sha256 = queryFingerprint;
  receipt.scope_id = `${CN_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_KIND}:${queryFingerprint}`;
  if (receipt.coverage_evidence !== null) {
    asObject(receipt.coverage_evidence).scope_query_fingerprint_sha256 = queryFingerprint;
  }
  return resealSourceReadReceipt(receipt);
}

function rebindResultSet(receipt: Record<string, unknown>): Record<string, unknown> {
  const resultSet = asObject(receipt.result_set);
  const references = resultSet.result_references as unknown[];
  resultSet.result_count = references.length;
  resultSet.result_fingerprint_sha256 = testFingerprint(references);
  return resealSourceReadReceipt(receipt);
}

function sourceReadReceipt(state: SourceReadStateV3 = 'OBSERVED'): Record<string, unknown> {
  const query = normalizedSourceReadQuery();
  const queryFingerprint = testFingerprint(query);
  const readEndedAt = '2026-10-10T08:02:00.000Z';
  const snapshot = {
    snapshot_id: SOURCE_READ_SNAPSHOT_ID,
    snapshot_kind: 'CN_QUIESCENT_SERVING_EPOCH',
    watermark: 'cn-preliminary-publication:2026-10-09',
    source_version: 'data-engine-source-v2026.10.09'
  };
  const observedReference = {
    source_owner: DATA_ENGINE_SOURCE_OWNER,
    candidate_type: CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE,
    case_id: 'case-中文-1',
    application_number: '10000001',
    source_package_id: 'cn-preliminary-publication-corpus',
    source_row_fingerprint_sha256: testFingerprint({ row: 1 }),
    record_fingerprint_sha256: testFingerprint({ record: 1 }),
    observed_at: '2026-10-10T08:01:30.000Z'
  };
  const resultReferences = state === 'OBSERVED' ? [observedReference] : [];
  const hasCompletedScan = state === 'EMPTY' || state === 'NOT_OBSERVED';
  const hasScan = state === 'OBSERVED' || hasCompletedScan;
  const pageResultCount = state === 'OBSERVED' ? 1 : 0;
  const responseCursor = state === 'OBSERVED' ? testFingerprint({ cursor: 'next' }) : null;
  const scan = hasScan
    ? {
        page_count: 1,
        continuation_chain: [
          {
            page_number: 1,
            request_cursor_fingerprint_sha256: null,
            response_cursor_fingerprint_sha256: responseCursor,
            result_count: pageResultCount,
            cumulative_result_count: pageResultCount,
            page_fingerprint_sha256: testFingerprint({ page: 1, result_count: pageResultCount }),
            snapshot_id: snapshot.snapshot_id
          }
        ],
        final_cursor_fingerprint_sha256: responseCursor,
        exact_scope_complete: hasCompletedScan,
        bounded_truncation: false,
        read_budget_overflowed: false
      }
    : null;
  const dataTrust =
    state === 'EMPTY'
      ? trustedDataTrust(true)
      : state === 'NOT_OBSERVED'
        ? trustedDataTrust(false)
        : null;
  const coverageDecision = state === 'NOT_COVERED' ? 'NOT_COVERED' : 'COVERED';
  const evidenceSnapshotId = state === 'NOT_COVERED' ? null : snapshot.snapshot_id;
  const evidenceCorpusFingerprint = state === 'NOT_COVERED' ? null : SOURCE_CORPUS_FINGERPRINT;
  const coverageEvidence =
    state === 'UNAVAILABLE'
      ? null
      : {
          decision: coverageDecision,
          scope_query_fingerprint_sha256: queryFingerprint,
          snapshot_id: evidenceSnapshotId,
          source_corpus_fingerprint_sha256: evidenceCorpusFingerprint,
          evaluated_at: '2026-10-10T08:02:30.000Z',
          coverage_through: dataTrust?.coverage_through ?? null,
          required_coverage_through: dataTrust?.required_coverage_through ?? null,
          evidence_reference: ownerEvidence(
            'EXACT_SCOPE_COVERAGE_DECISION',
            evidenceSnapshotId,
            evidenceCorpusFingerprint
          )
        };
  const reasonCodes =
    state === 'NOT_OBSERVED'
      ? ['NO_OBSERVATION_WITHOUT_TRUSTED_SILENCE']
      : state === 'NOT_COVERED'
        ? ['EXACT_SCOPE_NOT_COVERED']
        : state === 'UNAVAILABLE'
          ? ['SOURCE_READ_TIMEOUT']
          : [];
  const material: Record<string, unknown> = {
    contract_version: CN_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_CONTRACT_VERSION,
    receipt_kind: CN_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_KIND,
    receipt_id: `source-read:${state.toLowerCase()}:中文`,
    source_owner: DATA_ENGINE_SOURCE_OWNER,
    authority: DATA_ENGINE_FACT_AUTHORITY,
    jurisdiction: 'CN',
    resource_kind: CN_PRELIMINARY_PUBLICATION_DISCOVERY_RESOURCE_KIND,
    state,
    scope_id: `${CN_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_KIND}:${queryFingerprint}`,
    issued_at: '2026-10-10T08:03:00.000Z',
    read_started_at: '2026-10-10T08:00:00.000Z',
    read_ended_at: readEndedAt,
    read_completed_at: hasCompletedScan ? readEndedAt : null,
    query,
    query_fingerprint_sha256: queryFingerprint,
    snapshot: state === 'NOT_COVERED' || state === 'UNAVAILABLE' ? null : snapshot,
    producer_implementation: {
      package_id: 'markorbit-data-engine',
      package_version: '3.0.0-test',
      package_fingerprint_sha256: testFingerprint({ implementation: 3 }),
      build_id: 'git:0123456789abcdef'
    },
    source_corpus:
      state === 'NOT_COVERED' || state === 'UNAVAILABLE'
        ? null
        : {
            package_id: 'cn-preliminary-publication-corpus',
            package_version: '2026-10-09',
            package_fingerprint_sha256: SOURCE_CORPUS_FINGERPRINT,
            snapshot_id: snapshot.snapshot_id,
            registration_evidence_reference: ownerEvidence('REGISTERED_SOURCE_CORPUS')
          },
    coverage_evidence: coverageEvidence,
    data_trust: dataTrust,
    scan,
    result_set: {
      result_count: resultReferences.length,
      result_references: resultReferences,
      result_fingerprint_sha256: testFingerprint(resultReferences)
    },
    reason_codes: reasonCodes,
    retryable: state === 'UNAVAILABLE' ? true : null,
    silence_semantics:
      state === 'EMPTY' ? CN_PRELIMINARY_PUBLICATION_TRUSTED_SILENCE_SEMANTIC : null,
    legal_conclusion: false,
    authority_consequences: {
      rulePackAdmitted: false,
      sourceUsePromoted: false,
      methodActivated: false,
      capabilityVerified: false,
      projectionPersistenceAuthorized: false,
      productBusinessStateCreated: false,
      officialTruthCreated: false,
      legalDeadlineCertified: false,
      executionAuthorized: false,
      lifecyclePositionInferred: false,
      recommendationAuthorized: false
    }
  };
  return resealSourceReadReceipt(material);
}

describe('CN preliminary-publication source-read receipt V3 contract', () => {
  it.each<SourceReadStateV3>(['OBSERVED', 'EMPTY', 'NOT_OBSERVED', 'NOT_COVERED', 'UNAVAILABLE'])(
    'accepts the owner-issued %s state without collapsing its meaning',
    (state) => {
      const parsed = parseCnPreliminaryPublicationSourceReadReceiptV3(sourceReadReceipt(state));
      expect(parsed?.state).toBe(state);
      expect(parsed?.authority_consequences).toEqual({
        rulePackAdmitted: false,
        sourceUsePromoted: false,
        methodActivated: false,
        capabilityVerified: false,
        projectionPersistenceAuthorized: false,
        productBusinessStateCreated: false,
        officialTruthCreated: false,
        legalDeadlineCertified: false,
        executionAuthorized: false,
        lifecyclePositionInferred: false,
        recommendationAuthorized: false
      });
    }
  );

  it('keeps OBSERVED positive but not necessarily complete', () => {
    const parsed = parseCnPreliminaryPublicationSourceReadReceiptV3(sourceReadReceipt('OBSERVED'));
    expect(parsed?.result_set.result_count).toBe(1);
    expect(parsed?.scan?.exact_scope_complete).toBe(false);
    expect(parsed?.read_completed_at).toBeNull();
    expect(parsed?.silence_semantics).toBeNull();

    const zero = sourceReadReceipt('OBSERVED');
    asObject(zero.result_set).result_references = [];
    rebindResultSet(zero);
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(zero)).toBeNull();
  });

  it('admits EMPTY only with an exact complete scan and verified five-dimensional trust', () => {
    const valid = sourceReadReceipt('EMPTY');
    const parsed = parseCnPreliminaryPublicationSourceReadReceiptV3(valid);
    expect(parsed?.result_set.result_count).toBe(0);
    expect(parsed?.silence_semantics).toBe(CN_PRELIMINARY_PUBLICATION_TRUSTED_SILENCE_SEMANTIC);

    const missingTrust = sourceReadReceipt('EMPTY');
    missingTrust.data_trust = null;
    resealSourceReadReceipt(missingTrust);
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(missingTrust)).toBeNull();

    const staleTrust = sourceReadReceipt('EMPTY');
    staleTrust.data_trust = trustedDataTrust(false);
    const coverage = asObject(staleTrust.coverage_evidence);
    coverage.coverage_through = asObject(staleTrust.data_trust).coverage_through;
    coverage.required_coverage_through = asObject(staleTrust.data_trust).required_coverage_through;
    resealSourceReadReceipt(staleTrust);
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(staleTrust)).toBeNull();

    const positiveResult = sourceReadReceipt('EMPTY');
    const observed = sourceReadReceipt('OBSERVED');
    const observedReferences = asObject(observed.result_set).result_references as unknown[];
    asObject(positiveResult.result_set).result_references = structuredClone(observedReferences);
    const emptyPage = asList(asObject(positiveResult.scan).continuation_chain)[0]!;
    emptyPage.result_count = 1;
    emptyPage.cumulative_result_count = 1;
    rebindResultSet(positiveResult);
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(positiveResult)).toBeNull();

    for (const mutate of [
      (receipt: Record<string, unknown>) => {
        asObject(receipt.scan).exact_scope_complete = false;
        receipt.read_completed_at = null;
      },
      (receipt: Record<string, unknown>) => {
        asObject(receipt.scan).bounded_truncation = true;
      },
      (receipt: Record<string, unknown>) => {
        asObject(receipt.scan).read_budget_overflowed = true;
      },
      (receipt: Record<string, unknown>) => {
        const cursor = testFingerprint({ cursor: 'unconsumed' });
        asObject(receipt.scan).final_cursor_fingerprint_sha256 = cursor;
        asList(asObject(receipt.scan).continuation_chain)[0]!.response_cursor_fingerprint_sha256 =
          cursor;
      }
    ]) {
      const receipt = sourceReadReceipt('EMPTY');
      mutate(receipt);
      resealSourceReadReceipt(receipt);
      expect(parseCnPreliminaryPublicationSourceReadReceiptV3(receipt)).toBeNull();
    }
  });

  it('keeps NOT_OBSERVED separate from EMPTY even after a complete zero-row scan', () => {
    const receipt = sourceReadReceipt('NOT_OBSERVED');
    const parsed = parseCnPreliminaryPublicationSourceReadReceiptV3(receipt);
    expect(parsed?.scan?.exact_scope_complete).toBe(true);
    expect(parsed?.data_trust?.trusted_for_silence.value).toBe(false);
    expect(parsed?.silence_semantics).toBeNull();

    receipt.silence_semantics = CN_PRELIMINARY_PUBLICATION_TRUSTED_SILENCE_SEMANTIC;
    resealSourceReadReceipt(receipt);
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(receipt)).toBeNull();
  });

  it('requires an explicit owner coverage decision for NOT_COVERED', () => {
    const valid = sourceReadReceipt('NOT_COVERED');
    expect(
      parseCnPreliminaryPublicationSourceReadReceiptV3(valid)?.coverage_evidence?.decision
    ).toBe('NOT_COVERED');

    valid.coverage_evidence = null;
    resealSourceReadReceipt(valid);
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(valid)).toBeNull();
  });

  it('represents only a typed owner UNAVAILABLE receipt and retains retryability', () => {
    const valid = sourceReadReceipt('UNAVAILABLE');
    const parsed = parseCnPreliminaryPublicationSourceReadReceiptV3(valid);
    expect(parsed?.retryable).toBe(true);
    expect(parsed?.snapshot).toBeNull();
    expect(parsed?.scan).toBeNull();
    expect(parsed?.data_trust).toBeNull();
    expect(parsed?.read_completed_at).toBeNull();

    const interrupted = sourceReadReceipt('UNAVAILABLE');
    const partialObserved = sourceReadReceipt('OBSERVED');
    interrupted.snapshot = structuredClone(partialObserved.snapshot);
    interrupted.source_corpus = structuredClone(partialObserved.source_corpus);
    interrupted.scan = structuredClone(partialObserved.scan);
    const interruptedPage = asList(asObject(interrupted.scan).continuation_chain)[0]!;
    interruptedPage.result_count = 0;
    interruptedPage.cumulative_result_count = 0;
    resealSourceReadReceipt(interrupted);
    const parsedInterrupted = parseCnPreliminaryPublicationSourceReadReceiptV3(interrupted);
    expect(parsedInterrupted?.scan?.exact_scope_complete).toBe(false);
    expect(parsedInterrupted?.result_set.result_count).toBe(0);

    const mismatchedPartial = sourceReadReceipt('UNAVAILABLE');
    mismatchedPartial.snapshot = structuredClone(partialObserved.snapshot);
    mismatchedPartial.scan = structuredClone(partialObserved.scan);
    resealSourceReadReceipt(mismatchedPartial);
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(mismatchedPartial)).toBeNull();

    const missingRetryability = sourceReadReceipt('UNAVAILABLE');
    missingRetryability.retryable = null;
    resealSourceReadReceipt(missingRetryability);
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(missingRetryability)).toBeNull();

    expect(
      parseCnPreliminaryPublicationSourceReadReceiptV3({
        code: 'DATA_ENGINE_UNAVAILABLE',
        retryable: true
      })
    ).toBeNull();
  });

  it('does not reinterpret a V2 empty page or envelope as a V3 EMPTY receipt', () => {
    const emptyPage = page();
    emptyPage.results = [];
    emptyPage.provenance.result_count = 0;
    emptyPage.provenance.emitted_count = 0;
    expect(parseCnPreliminaryPublicationDiscoveryPageV2(emptyPage)).not.toBeNull();
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(emptyPage)).toBeNull();
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(envelope(emptyPage))).toBeNull();
  });

  it('recomputes the complete normalized query fingerprint and fixed scope id', () => {
    const valid = sourceReadReceipt('EMPTY');
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(valid)).not.toBeNull();

    const drift = sourceReadReceipt('EMPTY');
    asObject(asObject(drift.query).limits).page_size = 99;
    resealSourceReadReceipt(drift);
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(drift)).toBeNull();

    rebindSourceReadQuery(drift);
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(drift)).not.toBeNull();

    const callerNamedScope = sourceReadReceipt('EMPTY');
    callerNamedScope.scope_id = 'caller-controlled-scope';
    resealSourceReadReceipt(callerNamedScope);
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(callerNamedScope)).toBeNull();
  });

  it('validates the full continuation chain and canonical result digest', () => {
    const brokenCursor = sourceReadReceipt('OBSERVED');
    asList(asObject(brokenCursor.scan).continuation_chain)[0]!.request_cursor_fingerprint_sha256 =
      testFingerprint({ forged: 'cursor' });
    resealSourceReadReceipt(brokenCursor);
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(brokenCursor)).toBeNull();

    const wrongSnapshot = sourceReadReceipt('OBSERVED');
    asList(asObject(wrongSnapshot.scan).continuation_chain)[0]!.snapshot_id = 'other-epoch';
    resealSourceReadReceipt(wrongSnapshot);
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(wrongSnapshot)).toBeNull();

    const wrongDigest = sourceReadReceipt('OBSERVED');
    asObject(wrongDigest.result_set).result_fingerprint_sha256 = testFingerprint({ forged: true });
    resealSourceReadReceipt(wrongDigest);
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(wrongDigest)).toBeNull();

    const oversizedPage = sourceReadReceipt('OBSERVED');
    const oversizedPageEntry = asList(asObject(oversizedPage.scan).continuation_chain)[0]!;
    oversizedPageEntry.result_count = 101;
    oversizedPageEntry.cumulative_result_count = 101;
    resealSourceReadReceipt(oversizedPage);
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(oversizedPage)).toBeNull();
  });

  it('rejects cursor replay and repeated page fingerprints after a valid body reseal', () => {
    const cursorA = testFingerprint({ cursor: 'A' });
    const replayedCursor = sourceReadReceipt('EMPTY');
    const replayedScan = asObject(replayedCursor.scan);
    replayedScan.page_count = 3;
    replayedScan.continuation_chain = [
      {
        page_number: 1,
        request_cursor_fingerprint_sha256: null,
        response_cursor_fingerprint_sha256: cursorA,
        result_count: 0,
        cumulative_result_count: 0,
        page_fingerprint_sha256: testFingerprint({ page: 1 }),
        snapshot_id: SOURCE_READ_SNAPSHOT_ID
      },
      {
        page_number: 2,
        request_cursor_fingerprint_sha256: cursorA,
        response_cursor_fingerprint_sha256: cursorA,
        result_count: 0,
        cumulative_result_count: 0,
        page_fingerprint_sha256: testFingerprint({ page: 2 }),
        snapshot_id: SOURCE_READ_SNAPSHOT_ID
      },
      {
        page_number: 3,
        request_cursor_fingerprint_sha256: cursorA,
        response_cursor_fingerprint_sha256: null,
        result_count: 0,
        cumulative_result_count: 0,
        page_fingerprint_sha256: testFingerprint({ page: 3 }),
        snapshot_id: SOURCE_READ_SNAPSHOT_ID
      }
    ];
    replayedScan.final_cursor_fingerprint_sha256 = null;
    resealSourceReadReceipt(replayedCursor);
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(replayedCursor)).toBeNull();

    const repeatedPage = sourceReadReceipt('EMPTY');
    const repeatedScan = asObject(repeatedPage.scan);
    const repeatedFingerprint = testFingerprint({ repeated: 'page' });
    repeatedScan.page_count = 2;
    repeatedScan.continuation_chain = [
      {
        page_number: 1,
        request_cursor_fingerprint_sha256: null,
        response_cursor_fingerprint_sha256: cursorA,
        result_count: 0,
        cumulative_result_count: 0,
        page_fingerprint_sha256: repeatedFingerprint,
        snapshot_id: SOURCE_READ_SNAPSHOT_ID
      },
      {
        page_number: 2,
        request_cursor_fingerprint_sha256: cursorA,
        response_cursor_fingerprint_sha256: null,
        result_count: 0,
        cumulative_result_count: 0,
        page_fingerprint_sha256: repeatedFingerprint,
        snapshot_id: SOURCE_READ_SNAPSHOT_ID
      }
    ];
    repeatedScan.final_cursor_fingerprint_sha256 = null;
    resealSourceReadReceipt(repeatedPage);
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(repeatedPage)).toBeNull();
  });

  it('binds corpus, coverage and every Data Trust owner reference to one source identity', () => {
    const valid = parseCnPreliminaryPublicationSourceReadReceiptV3(sourceReadReceipt('EMPTY'));
    expect(valid?.source_corpus?.snapshot_id).toBe(valid?.snapshot?.snapshot_id);
    expect(valid?.data_trust?.source_corpus_fingerprint_sha256).toBe(
      valid?.source_corpus?.package_fingerprint_sha256
    );

    const coverageDrift = sourceReadReceipt('EMPTY');
    asObject(coverageDrift.coverage_evidence).snapshot_id = 'different-snapshot';
    resealSourceReadReceipt(coverageDrift);
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(coverageDrift)).toBeNull();

    const trustReferenceDrift = sourceReadReceipt('EMPTY');
    const completeEvidence = asObject(
      asObject(asObject(trustReferenceDrift.data_trust).complete).evidence_reference
    );
    completeEvidence.source_corpus_fingerprint_sha256 = testFingerprint({ corpus: 'other' });
    resealSourceReadReceipt(trustReferenceDrift);
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(trustReferenceDrift)).toBeNull();

    const corpusReferenceDrift = sourceReadReceipt('EMPTY');
    asObject(
      asObject(corpusReferenceDrift.source_corpus).registration_evidence_reference
    ).snapshot_id = 'different-snapshot';
    resealSourceReadReceipt(corpusReferenceDrift);
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(corpusReferenceDrift)).toBeNull();
  });

  it('rejects producer implementation identity collapsed into source corpus identity', () => {
    const receipt = sourceReadReceipt('EMPTY');
    const producer = asObject(receipt.producer_implementation);
    const corpus = asObject(receipt.source_corpus);
    producer.package_id = corpus.package_id;
    producer.package_version = corpus.package_version;
    producer.package_fingerprint_sha256 = corpus.package_fingerprint_sha256;
    resealSourceReadReceipt(receipt);
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(receipt)).toBeNull();
  });

  it('binds evaluation time to trust, coverage and the receipt issuance boundary', () => {
    const mismatchedEvaluation = sourceReadReceipt('EMPTY');
    asObject(mismatchedEvaluation.coverage_evidence).evaluated_at = '2026-10-10T08:02:31.000Z';
    resealSourceReadReceipt(mismatchedEvaluation);
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(mismatchedEvaluation)).toBeNull();

    const futureEvaluation = sourceReadReceipt('NOT_COVERED');
    asObject(futureEvaluation.coverage_evidence).evaluated_at = '2026-10-10T08:04:00.000Z';
    resealSourceReadReceipt(futureEvaluation);
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(futureEvaluation)).toBeNull();

    const futureCoverage = sourceReadReceipt('EMPTY');
    const futureCoverageTrust = asObject(futureCoverage.data_trust);
    futureCoverageTrust.coverage_through = '2026-10-10T08:02:31.000Z';
    asObject(futureCoverage.coverage_evidence).coverage_through = '2026-10-10T08:02:31.000Z';
    resealSourceReadReceipt(futureCoverage);
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(futureCoverage)).toBeNull();
  });

  it('binds OBSERVED row references to the declared source corpus', () => {
    const receipt = sourceReadReceipt('OBSERVED');
    const resultReference = asList(asObject(receipt.result_set).result_references)[0]!;
    resultReference.source_package_id = 'different-corpus';
    rebindResultSet(receipt);
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(receipt)).toBeNull();
  });

  const integrityMutations: Array<[string, (receipt: Record<string, unknown>) => void]> = [
    ['receipt identity', (receipt) => (receipt.receipt_id = 'mutated')],
    ['state', (receipt) => (receipt.state = 'NOT_OBSERVED')],
    ['snapshot watermark', (receipt) => (asObject(receipt.snapshot).watermark = 'mutated')],
    [
      'producer implementation package',
      (receipt) => (asObject(receipt.producer_implementation).package_version = 'mutated')
    ],
    [
      'source corpus package',
      (receipt) => (asObject(receipt.source_corpus).package_version = 'mutated')
    ],
    [
      'coverage evidence',
      (receipt) =>
        (asObject(asObject(receipt.coverage_evidence).evidence_reference).evidence_id = 'mutated')
    ],
    [
      'data trust evidence',
      (receipt) =>
        (asObject(asObject(asObject(receipt.data_trust).complete).evidence_reference).evidence_id =
          'mutated')
    ],
    [
      'scan page',
      (receipt) =>
        (asList(asObject(receipt.scan).continuation_chain)[0]!.page_fingerprint_sha256 =
          testFingerprint({ mutated: true }))
    ],
    ['time', (receipt) => (receipt.issued_at = '2026-10-10T08:04:00.000Z')],
    ['authority', (receipt) => (asObject(receipt.authority_consequences).sourceUsePromoted = true)]
  ];

  it.each(integrityMutations)(
    'rejects %s mutation against the canonical receipt body',
    (_, mutate) => {
      const receipt = sourceReadReceipt('EMPTY');
      mutate(receipt);
      expect(parseCnPreliminaryPublicationSourceReadReceiptV3(receipt)).toBeNull();
    }
  );

  it('rejects extra keys at every strict boundary sampled', () => {
    const topLevel = sourceReadReceipt('EMPTY');
    topLevel.extra = true;
    resealSourceReadReceipt(topLevel);
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(topLevel)).toBeNull();

    const nested = sourceReadReceipt('EMPTY');
    asObject(nested.query).extra = true;
    rebindSourceReadQuery(nested);
    expect(parseCnPreliminaryPublicationSourceReadReceiptV3(nested)).toBeNull();
  });

  it('exports a strict reference without materializing or widening the receipt', () => {
    const receipt = sourceReadReceipt('UNAVAILABLE');
    expect(toCnPreliminaryPublicationSourceReadReceiptReferenceV3(receipt)).toEqual({
      contract_version: CN_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_CONTRACT_VERSION,
      receipt_kind: CN_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_KIND,
      receipt_id: 'source-read:unavailable:中文',
      source_owner: DATA_ENGINE_SOURCE_OWNER,
      state: 'UNAVAILABLE',
      scope_id: receipt.scope_id,
      query_fingerprint_sha256: receipt.query_fingerprint_sha256,
      snapshot_id: null,
      source_version: null,
      issued_at: '2026-10-10T08:03:00.000Z',
      receipt_fingerprint_sha256: receipt.receipt_fingerprint_sha256
    });
    expect(() => toCnPreliminaryPublicationSourceReadReceiptReferenceV3({ invalid: true })).toThrow(
      TypeError
    );
  });

  it('locks cross-runtime canonical query and receipt fingerprints with Unicode, null and integers', () => {
    const receipt = sourceReadReceipt('EMPTY');
    expect(receipt.query_fingerprint_sha256).toBe(
      'sha256:c13877ee6665da674e5401977b0c84c2e9f48377f71505fe0dfc36a22b7e32fe'
    );
    expect(receipt.receipt_fingerprint_sha256).toBe(
      'sha256:fd4465c1cde30eb36c005c110be7bcc426c06c760f5cd918823430071c64a39b'
    );
  });
});
