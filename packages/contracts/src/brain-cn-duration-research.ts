import {
  BrainMethodContractError,
  parseBrainResearchMissionV1,
  parseResearchDatasetRefV1,
  type BrainResearchMissionV1,
  type ResearchDatasetRefV1
} from './brain-method.js';

export const CN_DURATION_RESEARCH_DATASET_NAME =
  'CN_FILING_TO_PRELIM_PUBLICATION_DURATION_V1' as const;
export const CN_DURATION_RESEARCH_SOURCE_TABLE = 'markorbit_facts.cn_case_current' as const;
export const CN_DURATION_RESEARCH_METHOD_FAMILY = 'STATISTICAL_ANALYSIS' as const;

const EXACT_ENGINE_SHA = /^git:[0-9a-f]{40}$/;

export const CN_DURATION_RESEARCH_MISSION_V1: Readonly<BrainResearchMissionV1> =
  parseBrainResearchMissionV1({
    schemaVersion: 1,
    missionId: 'brain-research-mission_cn-filing-to-prelim-duration-v1',
    capabilityDemand:
      'Reproducible descriptive research over objective CN trademark filing-to-preliminary-publication elapsed days.',
    problem:
      'Measure the bounded factual distribution of calendar days from filing_date to prelim_pub_date without inferring legal status, deadline, cause, risk, opportunity, or future outcome.',
    targetMethodFamily: CN_DURATION_RESEARCH_METHOD_FAMILY,
    applicabilityTarget: {
      jurisdictions: ['CN'],
      authorities: ['CNIPA'],
      objectTypes: ['TRADEMARK_APPLICATION'],
      operations: ['DESCRIPTIVE_DURATION_RESEARCH'],
      procedures: ['FILING_TO_PRELIMINARY_PUBLICATION'],
      stages: ['HISTORICAL_FACT_RESEARCH'],
      filingBases: ['ANY'],
      segments: ['FILING_TO_PRELIM_PUBLICATION'],
      requiredData: ['CN_CASE_CURRENT', 'FILING_DATE', 'PRELIM_PUB_DATE', 'SOURCE_LINEAGE'],
      effectiveFrom: '2026-08-28T00:00:00.000Z'
    },
    knowledgeResearchPlan: [],
    dataEngineResearchPlan: [
      'Consume one accepted Data Engine ResearchDatasetRefV1 for CN_FILING_TO_PRELIM_PUBLICATION_DURATION_V1; do not copy or fabricate population rows in Core.',
      'Require exact CN jurisdiction, cn_case_current source scope, source-fact-only actionability, deterministic keyset pagination, and a quiescent current-serving-epoch watermark.',
      'Evaluate descriptive statistics only over rows declared VALID by the Data Engine date-quality policy; retain invalid-date-order counts as quality evidence rather than repairing dates.',
      'Bind every evaluation and later method artifact to the exact dataset_ref_id, query fingerprint, row count, integrity SHA-256, watermark, and Data Engine git SHA.'
    ],
    hypotheses: [
      'The exact same accepted dataset lineage reproduces identical bounded descriptive duration statistics.',
      'Invalid date-order observations can be surfaced explicitly without coercion and excluded from valid-duration statistics.',
      'A narrow descriptive statistical method can be evaluated without introducing legal interpretation or predictive claims.'
    ],
    featurePlan: [
      'duration_days for VALID filing_date/prelim_pub_date pairs only',
      'INVALID_DATE_ORDER count as data-quality evidence, not a duration value',
      'dataset watermark and source lineage as reproducibility metadata, never predictive features'
    ],
    evaluationPlan: [
      'Reject any dataset whose jurisdiction, source table, factual fields, actionability, replay scope, pagination contract, temporal identity, or integrity lineage differs from the frozen pilot.',
      'Replay the same accepted dataset identity and require identical dataset_ref_id, query_fingerprint_sha256, row_count, and integrity_sha256.',
      'Compute bounded descriptive count and central/distribution statistics deterministically from VALID duration_days only.',
      'Compare the candidate against a count-only descriptive baseline; do not report predictive accuracy, legal correctness, or future-outcome calibration.',
      'Keep any resulting Brain method CANDIDATE or VALIDATED until explicit later activation evidence exists.'
    ],
    successMetrics: [
      'dataset_replay_match_rate=1',
      'dataset_lineage_completeness_rate=1',
      'descriptive_statistic_replay_rate=1',
      'invalid_date_order_explicit_rate=1',
      'raw_population_copy_to_core=0'
    ],
    baselineMetrics: ['valid_row_count_only_v1', 'no_prediction_no_legal_interpretation_v1'],
    createdAt: '2026-08-28T00:00:00.000Z'
  });

function exactStrings(value: unknown): readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? [...value] : [];
}

function assertExactArray(
  actual: readonly string[],
  expected: readonly string[],
  field: string
): void {
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    throw new BrainMethodContractError(
      `CN duration research dataset ${field} is outside the frozen pilot.`
    );
  }
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return value as Readonly<Record<string, unknown>>;
}

/**
 * Consumer-side scope guard only. Passing this guard does not mean the dataset is accepted.
 * Acceptance still requires the real target-host receipt recorded by the Phase 3 gate.
 */
export function parseCnDurationResearchDatasetCandidateV1(value: unknown): ResearchDatasetRefV1 {
  const dataset = parseResearchDatasetRefV1(value);

  assertExactArray(dataset.jurisdictions, ['CN'], 'jurisdictions');
  assertExactArray(dataset.resource_kinds, ['cn_case_current'], 'resource_kinds');

  if (!EXACT_ENGINE_SHA.test(dataset.engine_version)) {
    throw new BrainMethodContractError(
      'CN duration research dataset engine_version must bind an exact git SHA.'
    );
  }
  if (!dataset.watermark?.startsWith('cn-serving-epoch:')) {
    throw new BrainMethodContractError(
      'CN duration research dataset must use a cn-serving-epoch watermark.'
    );
  }
  if (dataset.as_of !== null) {
    throw new BrainMethodContractError(
      'CN duration research dataset must not claim historical as-of reconstruction.'
    );
  }
  if (!['COMPLETE_BOUNDED', 'COMPLETE_TO_WATERMARK'].includes(dataset.completeness)) {
    throw new BrainMethodContractError(
      'CN duration research dataset completeness is outside the frozen pilot.'
    );
  }
  if (dataset.row_count < 1) {
    throw new BrainMethodContractError('CN duration research dataset must contain factual rows.');
  }
  if (dataset.aggregation !== null || dataset.sampling !== null || dataset.partition !== null) {
    throw new BrainMethodContractError(
      'CN duration research dataset must remain the frozen unaggregated, unsampled, unpartitioned row dataset.'
    );
  }

  const query = record(dataset.query);
  if (query.dataset !== CN_DURATION_RESEARCH_DATASET_NAME) {
    throw new BrainMethodContractError(
      'CN duration research dataset identity is outside the frozen pilot.'
    );
  }
  if (query.source_table !== CN_DURATION_RESEARCH_SOURCE_TABLE) {
    throw new BrainMethodContractError(
      'CN duration research source table is outside the frozen pilot.'
    );
  }
  if (query.legal_conclusion !== false || query.actionability !== 'SOURCE_FACT_ONLY') {
    throw new BrainMethodContractError(
      'CN duration research dataset must remain objective SOURCE_FACT_ONLY evidence.'
    );
  }
  if (
    query.replay_scope !== 'QUIESCENT_CURRENT_SERVING_EPOCH' ||
    query.historic_as_of_reconstruction !== false
  ) {
    throw new BrainMethodContractError(
      'CN duration research dataset replay scope is outside the frozen pilot.'
    );
  }
  assertExactArray(
    exactStrings(query.selected_fields),
    [
      'application_number',
      'filing_date',
      'prelim_pub_date',
      'source_package_id',
      'source_effective_date',
      'source_row_hash',
      'record_hash',
      'source_rank'
    ],
    'selected_fields'
  );

  const pagination = record(dataset.pagination);
  if (
    pagination.strategy !== 'KEYSET' ||
    pagination.cursor_field !== 'application_number' ||
    pagination.execution_batch_size_in_replay_identity !== false
  ) {
    throw new BrainMethodContractError(
      'CN duration research pagination is outside the deterministic frozen pilot.'
    );
  }
  assertExactArray(
    exactStrings(pagination.order_by),
    ['application_number ASC'],
    'pagination.order_by'
  );

  return dataset;
}
