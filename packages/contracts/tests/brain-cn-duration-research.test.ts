import { describe, expect, it } from 'vitest';
import {
  CN_DURATION_RESEARCH_MISSION_V1,
  parseCnDurationResearchDatasetCandidateV1
} from '../src/brain-cn-duration-research.js';

const querySha = 'a'.repeat(64);
const integritySha = 'b'.repeat(64);
const engineSha = 'c'.repeat(40);

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
    watermark: 'cn-serving-epoch:coverage=2026-07-31:max-success-sequence=1234:success-count=99',
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
    generated_at: '2026-08-28T00:00:00.000Z',
    query_fingerprint_sha256: querySha,
    integrity_sha256: integritySha,
    ...overrides
  };
}

describe('CN duration Phase 3 research mission', () => {
  it('freezes a Data Engine research-only STATISTICAL_ANALYSIS mission before acceptance', () => {
    expect(CN_DURATION_RESEARCH_MISSION_V1.targetMethodFamily).toBe('STATISTICAL_ANALYSIS');
    expect(CN_DURATION_RESEARCH_MISSION_V1.applicabilityTarget.jurisdictions).toEqual(['CN']);
    expect(CN_DURATION_RESEARCH_MISSION_V1.knowledgeResearchPlan).toEqual([]);
    expect(CN_DURATION_RESEARCH_MISSION_V1.dataEngineResearchPlan.length).toBeGreaterThan(0);
    expect(CN_DURATION_RESEARCH_MISSION_V1.successMetrics).toContain(
      'raw_population_copy_to_core=0'
    );
    expect(CN_DURATION_RESEARCH_MISSION_V1.baselineMetrics).toContain(
      'no_prediction_no_legal_interpretation_v1'
    );
  });

  it('accepts the exact frozen Data Engine candidate shape without claiming acceptance', () => {
    const parsed = parseCnDurationResearchDatasetCandidateV1(dataset());

    expect(parsed.engine_version).toBe(`git:${engineSha}`);
    expect(parsed.jurisdictions).toEqual(['CN']);
    expect(parsed.resource_kinds).toEqual(['cn_case_current']);
    expect(parsed.query.actionability).toBe('SOURCE_FACT_ONLY');
    expect(parsed.query.legal_conclusion).toBe(false);
  });

  it('rejects jurisdiction and source-scope drift', () => {
    expect(() =>
      parseCnDurationResearchDatasetCandidateV1(dataset({ jurisdictions: ['US'] }))
    ).toThrow('jurisdictions is outside the frozen pilot');

    const changedQuery = {
      ...(dataset().query as Record<string, unknown>),
      source_table: 'markorbit_facts.cn_observed_event'
    };
    expect(() =>
      parseCnDurationResearchDatasetCandidateV1(dataset({ query: changedQuery }))
    ).toThrow('source table is outside the frozen pilot');
  });

  it('rejects actionable or legal interpretation drift', () => {
    const changedQuery = {
      ...(dataset().query as Record<string, unknown>),
      legal_conclusion: true,
      actionability: 'RISK_SCORE'
    };

    expect(() =>
      parseCnDurationResearchDatasetCandidateV1(dataset({ query: changedQuery }))
    ).toThrow('must remain objective SOURCE_FACT_ONLY evidence');
  });

  it('rejects non-exact engine builds and historical as-of claims', () => {
    expect(() =>
      parseCnDurationResearchDatasetCandidateV1(dataset({ engine_version: 'M1.7' }))
    ).toThrow('must bind an exact git SHA');

    expect(() =>
      parseCnDurationResearchDatasetCandidateV1(
        dataset({
          as_of: '2026-07-31T00:00:00.000Z',
          watermark: null
        })
      )
    ).toThrow('must not claim historical as-of reconstruction');
  });

  it('rejects aggregation, sampling, field and pagination drift', () => {
    expect(() =>
      parseCnDurationResearchDatasetCandidateV1(
        dataset({ aggregation: { group_by: ['filing_year'] } })
      )
    ).toThrow('must remain the frozen unaggregated');

    const changedFields = {
      ...(dataset().query as Record<string, unknown>),
      selected_fields: ['application_number', 'filing_date', 'prelim_pub_date']
    };
    expect(() =>
      parseCnDurationResearchDatasetCandidateV1(dataset({ query: changedFields }))
    ).toThrow('selected_fields is outside the frozen pilot');

    expect(() =>
      parseCnDurationResearchDatasetCandidateV1(
        dataset({
          pagination: {
            strategy: 'OFFSET',
            order_by: ['application_number ASC'],
            cursor_field: 'application_number',
            execution_batch_size_in_replay_identity: false
          }
        })
      )
    ).toThrow('pagination is outside the deterministic frozen pilot');
  });
});
