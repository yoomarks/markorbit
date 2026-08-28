import { describe, expect, it } from 'vitest';
import {
  compileCnDurationStatisticalMethodPackageV1,
  evaluateCnDurationResearchV1
} from '../src/brain-cn-duration-research.js';

const querySha = 'a'.repeat(64);
const integritySha = 'b'.repeat(64);
const engineSha = 'c'.repeat(40);
const watermark = 'cn-serving-epoch:coverage=2026-07-31:max-success-sequence=1234:success-count=99';

function dataset(overrides: Record<string, unknown> = {}) {
  return {
    contract_version: 1,
    dataset_ref_id: `research-dataset_${querySha}`,
    engine_version: `git:${engineSha}`,
    fact_schema_version: 'CN_CASE_CURRENT_FILING_TO_PRELIM_DURATION_V1',
    jurisdictions: ['CN'],
    resource_kinds: ['cn_case_current'],
    query: {
      dataset: 'CN_FILING_TO_PRELIM_PUBLICATION_DURATION_V1',
      engine: 'clickhouse',
      source_table: 'markorbit_facts.cn_case_current',
      selected_fields: [
        'application_number',
        'filing_date',
        'prelim_pub_date',
        'source_package_id',
        'source_effective_date',
        'source_row_hash',
        'record_hash',
        'source_rank'
      ],
      source_predicate: {
        is_deleted: 0,
        filing_date: 'NOT_NULL',
        prelim_pub_date: 'NOT_NULL'
      },
      derived_fields: {
        duration_days: 'CALENDAR_DAYS(prelim_pub_date-filing_date)',
        quality: ['VALID', 'INVALID_DATE_ORDER']
      },
      source_lineage: 'PER_ROW_PACKAGE_AND_HASH_BOUND',
      replay_scope: 'QUIESCENT_CURRENT_SERVING_EPOCH',
      historic_as_of_reconstruction: false,
      missing_temporal_policy: 'EXCLUDE_DECLARED',
      invalid_date_order_policy: 'RETAIN_WITH_NULL_DURATION_AND_QUALITY_FLAG',
      ordering: ['application_number ASC'],
      population_bound: { strategy: 'ORDERED_PREFIX', max_rows: 10_000 },
      legal_conclusion: false,
      actionability: 'SOURCE_FACT_ONLY'
    },
    as_of: null,
    watermark,
    completeness: 'COMPLETE_BOUNDED',
    pagination: {
      strategy: 'KEYSET',
      order_by: ['application_number ASC'],
      cursor_field: 'application_number',
      execution_batch_size_in_replay_identity: false
    },
    aggregation: null,
    sampling: null,
    partition: null,
    row_count: 10_000,
    generated_at: '2026-08-28T05:20:00.000Z',
    query_fingerprint_sha256: querySha,
    integrity_sha256: integritySha,
    ...overrides
  };
}

function receipt(overrides: Record<string, unknown> = {}) {
  return {
    receipt_version: 'CN_FILING_TO_PRELIM_RESEARCH_ACCEPTANCE_V1',
    status: 'PASS',
    redacted: true,
    objective_only: true,
    data_engine_sha: engineSha,
    engine_version: `git:${engineSha}`,
    dataset_ref_id: `research-dataset_${querySha}`,
    query_fingerprint_sha256: querySha,
    row_count: 10_000,
    integrity_sha256: integritySha,
    watermark,
    completeness: 'COMPLETE_BOUNDED',
    valid_rows: 9_990,
    invalid_date_order_rows: 10,
    replay_match: true,
    first_batch_size: 5_000,
    replay_batch_size: 1_000,
    physical_batch_size_in_identity: false,
    max_rows: 10_000,
    population_scope: 'DETERMINISTIC_ORDERED_PREFIX',
    replay_scope: 'QUIESCENT_CURRENT_SERVING_EPOCH',
    historic_as_of_reconstruction: false,
    legal_conclusion: false,
    raw_population_rows_emitted: false,
    ...overrides
  };
}

function summary(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    sourceSystem: 'MARKORBIT_DATA_ENGINE',
    dataset_ref_id: `research-dataset_${querySha}`,
    engine_version: `git:${engineSha}`,
    query_fingerprint_sha256: querySha,
    row_count: 10_000,
    integrity_sha256: integritySha,
    watermark,
    valid_rows: 9_990,
    invalid_date_order_rows: 10,
    quantile_method: 'NEAREST_RANK',
    statistics: {
      count: 9_990,
      min_days: 12,
      p25_days: 88,
      median_days: 121,
      p75_days: 164,
      max_days: 420
    },
    objective_only: true,
    legal_conclusion: false,
    predictive_claim: false,
    raw_population_rows_emitted: false,
    computed_at: '2026-08-28T05:25:00.000Z',
    ...overrides
  };
}

describe('CN duration Phase 3 evaluation gate', () => {
  it('evaluates only exact accepted lineage with deterministic descriptive replay', () => {
    const result = evaluateCnDurationResearchV1({
      dataset: dataset(),
      acceptanceReceipt: receipt(),
      firstSummary: summary({ computed_at: '2026-08-28T05:24:00.000Z' }),
      replaySummary: summary()
    });

    expect(result.status).toBe('PASSED');
    if (result.status !== 'PASSED') throw new Error('expected PASSED');
    expect(result.evaluation.status).toBe('PASSED');
    expect(result.evaluation.metrics.datasetReplayMatchRate).toBe(1);
    expect(result.evaluation.metrics.descriptiveStatisticReplayRate).toBe(1);
    expect(result.evaluation.metrics.rawPopulationCopyToCore).toBe(0);
    expect(result.statistics.median_days).toBe(121);
  });

  it('compiles only a VALIDATED method/package and preserves exact dataset lineage', () => {
    const result = compileCnDurationStatisticalMethodPackageV1({
      dataset: dataset(),
      acceptanceReceipt: receipt(),
      firstSummary: summary({ computed_at: '2026-08-28T05:24:00.000Z' }),
      replaySummary: summary()
    });

    expect(result.status).toBe('READY');
    if (result.status !== 'READY') throw new Error('expected READY');
    expect(result.method.methodFamily).toBe('STATISTICAL_ANALYSIS');
    expect(result.method.lifecycle).toBe('VALIDATED');
    expect(result.package.lifecycle).toBe('VALIDATED');
    expect(result.package.activatedAt).toBeUndefined();
    expect(result.method.lineage.knowledgeSources).toEqual([]);
    expect(result.method.lineage.researchDatasets).toHaveLength(1);
    expect(result.method.lineage.researchDatasets[0]?.dataset_ref_id).toBe(
      `research-dataset_${querySha}`
    );
    expect(result.package.executable.predictiveClaim).toBe(false);
    expect(result.package.executable.legalConclusion).toBe(false);
  });

  it('rejects a target-host receipt that does not match the dataset identity', () => {
    const result = evaluateCnDurationResearchV1({
      dataset: dataset(),
      acceptanceReceipt: receipt({ integrity_sha256: 'd'.repeat(64) }),
      firstSummary: summary(),
      replaySummary: summary()
    });

    expect(result).toEqual({ status: 'REJECTED', reason: 'ACCEPTANCE_RECEIPT_MISMATCH' });
  });

  it('rejects acceptance that did not replay across different physical batch sizes', () => {
    const result = evaluateCnDurationResearchV1({
      dataset: dataset(),
      acceptanceReceipt: receipt({ replay_batch_size: 5_000 }),
      firstSummary: summary(),
      replaySummary: summary()
    });

    expect(result).toEqual({ status: 'REJECTED', reason: 'ACCEPTANCE_RECEIPT_MISMATCH' });
  });

  it('rejects descriptive replay drift even when dataset lineage is unchanged', () => {
    const replay = summary({
      statistics: {
        count: 9_990,
        min_days: 12,
        p25_days: 88,
        median_days: 122,
        p75_days: 164,
        max_days: 420
      }
    });
    const result = evaluateCnDurationResearchV1({
      dataset: dataset(),
      acceptanceReceipt: receipt(),
      firstSummary: summary(),
      replaySummary: replay
    });

    expect(result).toEqual({ status: 'REJECTED', reason: 'SUMMARY_REPLAY_MISMATCH' });
  });

  it('rejects quality-count and quantile-contract drift before method compilation', () => {
    const badQuality = evaluateCnDurationResearchV1({
      dataset: dataset(),
      acceptanceReceipt: receipt(),
      firstSummary: summary({ valid_rows: 9_989 }),
      replaySummary: summary()
    });
    expect(badQuality).toEqual({ status: 'REJECTED', reason: 'SUMMARY_SCOPE_MISMATCH' });

    const badQuantiles = evaluateCnDurationResearchV1({
      dataset: dataset(),
      acceptanceReceipt: receipt(),
      firstSummary: summary({
        statistics: {
          count: 9_990,
          min_days: 12,
          p25_days: 130,
          median_days: 121,
          p75_days: 164,
          max_days: 420
        }
      }),
      replaySummary: summary()
    });
    expect(badQuantiles).toEqual({ status: 'REJECTED', reason: 'SUMMARY_SCOPE_MISMATCH' });
  });
});
