import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import {
  CN_DURATION_RESEARCH_CORE_INTAKE_VERSION,
  compileCnDurationResearchEvidenceBundleV1,
  runCnDurationResearchEvidenceFileIntakeV1
} from '../src/brain-cn-duration-evidence-intake.js';

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
      source_column_aliases: { source_package_id: 'last_source_package_id' },
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

function evidence(overrides: Record<string, unknown> = {}) {
  return {
    evidence_version: 'CN_FILING_TO_PRELIM_RESEARCH_EVIDENCE_V1',
    status: 'PASS',
    redacted: true,
    objective_only: true,
    dataset: dataset(),
    acceptance_receipt: receipt(),
    first_summary: summary({ computed_at: '2026-08-28T05:24:00.000Z' }),
    replay_summary: summary(),
    raw_population_rows_emitted: false,
    ...overrides
  };
}

describe('CN duration Phase 3 evidence intake', () => {
  it('turns one exact PASS evidence bundle into metadata-only VALIDATED artifacts', () => {
    const result = compileCnDurationResearchEvidenceBundleV1(evidence());

    expect(result.status).toBe('READY');
    if (result.status !== 'READY') throw new Error('expected READY');
    expect(result.evaluation.status).toBe('PASSED');
    expect(result.method.lifecycle).toBe('VALIDATED');
    expect(result.package.lifecycle).toBe('VALIDATED');
    expect(result.package.activatedAt).toBeUndefined();
    expect(result.evaluation.metrics.rawPopulationCopyToCore).toBe(0);
    expect(result.method.lineage.researchDatasets[0]?.dataset_ref_id).toBe(
      `research-dataset_${querySha}`
    );
    expect(result.package.executable.legalConclusion).toBe(false);
    expect(result.package.executable.predictiveClaim).toBe(false);
  });

  it('rejects BLOCKED, wrong-version, or widened top-level evidence bundles', () => {
    expect(
      compileCnDurationResearchEvidenceBundleV1(
        evidence({ status: 'BLOCKED', reason: 'target host blocked' })
      )
    ).toEqual({ status: 'REJECTED', reason: 'EVIDENCE_BUNDLE_MISMATCH' });

    expect(
      compileCnDurationResearchEvidenceBundleV1(
        evidence({ evidence_version: 'CN_FILING_TO_PRELIM_RESEARCH_EVIDENCE_V2' })
      )
    ).toEqual({ status: 'REJECTED', reason: 'EVIDENCE_BUNDLE_MISMATCH' });

    expect(compileCnDurationResearchEvidenceBundleV1(evidence({ raw_rows: [] }))).toEqual({
      status: 'REJECTED',
      reason: 'EVIDENCE_BUNDLE_MISMATCH'
    });
  });

  it('delegates physical-lineage and replay drift to the frozen evaluator', () => {
    const acceptedDataset = dataset();
    const acceptedQuery = acceptedDataset.query as Record<string, unknown>;
    const wrongAliasDataset = dataset({
      query: {
        ...acceptedQuery,
        source_column_aliases: { source_package_id: 'source_package_id' }
      }
    });
    expect(
      compileCnDurationResearchEvidenceBundleV1(evidence({ dataset: wrongAliasDataset }))
    ).toEqual({ status: 'REJECTED', reason: 'DATASET_SCOPE_MISMATCH' });

    expect(
      compileCnDurationResearchEvidenceBundleV1(
        evidence({
          replay_summary: summary({
            statistics: {
              count: 9_990,
              min_days: 12,
              p25_days: 88,
              median_days: 122,
              p75_days: 164,
              max_days: 420
            }
          })
        })
      )
    ).toEqual({ status: 'REJECTED', reason: 'SUMMARY_REPLAY_MISMATCH' });
  });

  it('hashes the exact evidence file and never promotes it beyond READY/VALIDATED', () => {
    const directory = mkdtempSync(join(tmpdir(), 'markorbit-cn-duration-intake-'));
    try {
      const path = join(directory, 'evidence.json');
      const raw = `${JSON.stringify(evidence(), null, 2)}\n`;
      writeFileSync(path, raw, 'utf8');

      const result = runCnDurationResearchEvidenceFileIntakeV1(path);
      expect(result.intake_version).toBe(CN_DURATION_RESEARCH_CORE_INTAKE_VERSION);
      expect(result.evidence_sha256).toBe(createHash('sha256').update(raw).digest('hex'));
      expect(result.status).toBe('READY');
      if (result.status !== 'READY') throw new Error('expected READY');
      expect(result.method.lifecycle).toBe('VALIDATED');
      expect(result.package.lifecycle).toBe('VALIDATED');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects invalid JSON without fabricating an evaluation or method', () => {
    const directory = mkdtempSync(join(tmpdir(), 'markorbit-cn-duration-intake-invalid-'));
    try {
      const path = join(directory, 'evidence.json');
      writeFileSync(path, '{not-json', 'utf8');

      const result = runCnDurationResearchEvidenceFileIntakeV1(path);
      expect(result.status).toBe('REJECTED');
      expect(result).toMatchObject({ reason: 'EVIDENCE_JSON_INVALID' });
      expect('method' in result).toBe(false);
      expect('package' in result).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
