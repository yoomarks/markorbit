import {
  BrainMethodContractError,
  parseBrainMethodContractV1,
  parseBrainResearchMissionV1,
  parseExecutableMethodPackageV1,
  parseResearchDatasetRefV1,
  type BrainMethodContractV1,
  type BrainMethodEvaluationV1,
  type BrainResearchMissionV1,
  type ExecutableMethodPackageV1,
  type ResearchDatasetRefV1
} from './brain-method.js';

export const CN_DURATION_RESEARCH_DATASET_NAME =
  'CN_FILING_TO_PRELIM_PUBLICATION_DURATION_V1' as const;
export const CN_DURATION_RESEARCH_SOURCE_TABLE = 'markorbit_facts.cn_case_current' as const;
export const CN_DURATION_RESEARCH_METHOD_FAMILY = 'STATISTICAL_ANALYSIS' as const;
export const CN_DURATION_RESEARCH_RECEIPT_VERSION =
  'CN_FILING_TO_PRELIM_RESEARCH_ACCEPTANCE_V1' as const;
export const CN_DURATION_RESEARCH_QUANTILE_METHOD = 'NEAREST_RANK' as const;

const EXACT_ENGINE_SHA = /^git:[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;

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

export interface CnDurationTargetHostAcceptanceReceiptV1 {
  receipt_version: typeof CN_DURATION_RESEARCH_RECEIPT_VERSION;
  status: 'PASS';
  redacted: true;
  objective_only: true;
  data_engine_sha: string;
  engine_version: string;
  dataset_ref_id: string;
  query_fingerprint_sha256: string;
  row_count: number;
  integrity_sha256: string;
  watermark: string;
  completeness: 'COMPLETE_BOUNDED' | 'COMPLETE_TO_WATERMARK';
  valid_rows: number;
  invalid_date_order_rows: number;
  replay_match: true;
  first_batch_size: number;
  replay_batch_size: number;
  physical_batch_size_in_identity: false;
  max_rows: number;
  population_scope: 'DETERMINISTIC_ORDERED_PREFIX';
  replay_scope: 'QUIESCENT_CURRENT_SERVING_EPOCH';
  historic_as_of_reconstruction: false;
  legal_conclusion: false;
  raw_population_rows_emitted: false;
}

export interface CnDurationDescriptiveStatisticsV1 {
  count: number;
  min_days: number;
  p25_days: number;
  median_days: number;
  p75_days: number;
  max_days: number;
}

export interface CnDurationDescriptiveSummaryRunV1 {
  schemaVersion: 1;
  sourceSystem: 'MARKORBIT_DATA_ENGINE';
  dataset_ref_id: string;
  engine_version: string;
  query_fingerprint_sha256: string;
  row_count: number;
  integrity_sha256: string;
  watermark: string;
  valid_rows: number;
  invalid_date_order_rows: number;
  quantile_method: typeof CN_DURATION_RESEARCH_QUANTILE_METHOD;
  statistics: Readonly<CnDurationDescriptiveStatisticsV1>;
  objective_only: true;
  legal_conclusion: false;
  predictive_claim: false;
  raw_population_rows_emitted: false;
  computed_at: string;
}

export interface EvaluateCnDurationResearchInputV1 {
  dataset: unknown;
  acceptanceReceipt: unknown;
  firstSummary: unknown;
  replaySummary: unknown;
}

export type EvaluateCnDurationResearchResultV1 =
  | {
      status: 'REJECTED';
      reason:
        | 'DATASET_SCOPE_MISMATCH'
        | 'ACCEPTANCE_RECEIPT_MISMATCH'
        | 'NO_VALID_ROWS'
        | 'SUMMARY_SCOPE_MISMATCH'
        | 'SUMMARY_REPLAY_MISMATCH';
    }
  | {
      status: 'PASSED';
      dataset: Readonly<ResearchDatasetRefV1>;
      receipt: Readonly<CnDurationTargetHostAcceptanceReceiptV1>;
      statistics: Readonly<CnDurationDescriptiveStatisticsV1>;
      evaluation: Readonly<BrainMethodEvaluationV1>;
    };

export type CompileCnDurationStatisticalMethodResultV1 =
  | Extract<EvaluateCnDurationResearchResultV1, { status: 'REJECTED' }>
  | {
      status: 'READY';
      method: Readonly<BrainMethodContractV1>;
      package: Readonly<ExecutableMethodPackageV1>;
    };

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

function exactKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
  field: string
): void {
  const expectedKeys = new Set(expected);
  const unsupported = Object.keys(value).filter((key) => !expectedKeys.has(key));
  const missing = expected.filter((key) => !(key in value));
  if (unsupported.length || missing.length) {
    throw new BrainMethodContractError(`${field} does not match the frozen evidence contract.`);
  }
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BrainMethodContractError(`${field} must be a non-empty string.`);
  }
  return value.trim();
}

function sha256(value: unknown, field: string): string {
  const normalized = text(value, field).toLowerCase();
  if (!SHA256.test(normalized)) {
    throw new BrainMethodContractError(`${field} must be a SHA-256 fingerprint.`);
  }
  return normalized;
}

function exactGitSha(value: unknown, field: string): string {
  const normalized = text(value, field).toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(normalized)) {
    throw new BrainMethodContractError(`${field} must be an exact 40-character git SHA.`);
  }
  return normalized;
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new BrainMethodContractError(`${field} must be a non-negative safe integer.`);
  }
  return value as number;
}

function positiveInteger(value: unknown, field: string): number {
  const parsed = nonNegativeInteger(value, field);
  if (parsed < 1) throw new BrainMethodContractError(`${field} must be positive.`);
  return parsed;
}

function instant(value: unknown, field: string): string {
  const normalized = text(value, field);
  if (Number.isNaN(Date.parse(normalized))) {
    throw new BrainMethodContractError(`${field} must be an ISO date/time.`);
  }
  return normalized;
}

function exactTrue(value: unknown, field: string): true {
  if (value !== true) throw new BrainMethodContractError(`${field} must be true.`);
  return true;
}

function exactFalse(value: unknown, field: string): false {
  if (value !== false) throw new BrainMethodContractError(`${field} must be false.`);
  return false;
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
  if (dataset.as_of !== null) {
    throw new BrainMethodContractError(
      'CN duration research dataset must not claim historical as-of reconstruction.'
    );
  }
  if (!dataset.watermark?.startsWith('cn-serving-epoch:')) {
    throw new BrainMethodContractError(
      'CN duration research dataset must use a cn-serving-epoch watermark.'
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

export function parseCnDurationTargetHostAcceptanceReceiptV1(
  value: unknown
): CnDurationTargetHostAcceptanceReceiptV1 {
  const receipt = record(value);
  exactKeys(
    receipt,
    [
      'receipt_version',
      'status',
      'redacted',
      'objective_only',
      'data_engine_sha',
      'engine_version',
      'dataset_ref_id',
      'query_fingerprint_sha256',
      'row_count',
      'integrity_sha256',
      'watermark',
      'completeness',
      'valid_rows',
      'invalid_date_order_rows',
      'replay_match',
      'first_batch_size',
      'replay_batch_size',
      'physical_batch_size_in_identity',
      'max_rows',
      'population_scope',
      'replay_scope',
      'historic_as_of_reconstruction',
      'legal_conclusion',
      'raw_population_rows_emitted'
    ],
    'CN duration target-host receipt'
  );
  if (
    receipt.receipt_version !== CN_DURATION_RESEARCH_RECEIPT_VERSION ||
    receipt.status !== 'PASS' ||
    receipt.population_scope !== 'DETERMINISTIC_ORDERED_PREFIX' ||
    receipt.replay_scope !== 'QUIESCENT_CURRENT_SERVING_EPOCH'
  ) {
    throw new BrainMethodContractError(
      'CN duration target-host receipt is outside the frozen gate.'
    );
  }
  const dataEngineSha = exactGitSha(receipt.data_engine_sha, 'receipt.data_engine_sha');
  const engineVersion = text(receipt.engine_version, 'receipt.engine_version');
  if (engineVersion !== `git:${dataEngineSha}`) {
    throw new BrainMethodContractError(
      'CN duration target-host receipt engine identity is inconsistent.'
    );
  }
  const rowCount = positiveInteger(receipt.row_count, 'receipt.row_count');
  const validRows = nonNegativeInteger(receipt.valid_rows, 'receipt.valid_rows');
  const invalidRows = nonNegativeInteger(
    receipt.invalid_date_order_rows,
    'receipt.invalid_date_order_rows'
  );
  if (validRows + invalidRows !== rowCount) {
    throw new BrainMethodContractError(
      'CN duration target-host receipt quality counts do not reconcile.'
    );
  }
  const firstBatchSize = positiveInteger(receipt.first_batch_size, 'receipt.first_batch_size');
  const replayBatchSize = positiveInteger(receipt.replay_batch_size, 'receipt.replay_batch_size');
  if (firstBatchSize === replayBatchSize) {
    throw new BrainMethodContractError(
      'CN duration target-host receipt must prove replay across different physical batch sizes.'
    );
  }
  const maxRows = positiveInteger(receipt.max_rows, 'receipt.max_rows');
  if (rowCount > maxRows) {
    throw new BrainMethodContractError(
      'CN duration target-host receipt row_count exceeds max_rows.'
    );
  }
  exactTrue(receipt.redacted, 'receipt.redacted');
  exactTrue(receipt.objective_only, 'receipt.objective_only');
  exactTrue(receipt.replay_match, 'receipt.replay_match');
  exactFalse(receipt.physical_batch_size_in_identity, 'receipt.physical_batch_size_in_identity');
  exactFalse(receipt.historic_as_of_reconstruction, 'receipt.historic_as_of_reconstruction');
  exactFalse(receipt.legal_conclusion, 'receipt.legal_conclusion');
  exactFalse(receipt.raw_population_rows_emitted, 'receipt.raw_population_rows_emitted');
  if (!['COMPLETE_BOUNDED', 'COMPLETE_TO_WATERMARK'].includes(String(receipt.completeness))) {
    throw new BrainMethodContractError('CN duration target-host receipt completeness is invalid.');
  }
  return {
    receipt_version: CN_DURATION_RESEARCH_RECEIPT_VERSION,
    status: 'PASS',
    redacted: true,
    objective_only: true,
    data_engine_sha: dataEngineSha,
    engine_version: engineVersion,
    dataset_ref_id: text(receipt.dataset_ref_id, 'receipt.dataset_ref_id'),
    query_fingerprint_sha256: sha256(
      receipt.query_fingerprint_sha256,
      'receipt.query_fingerprint_sha256'
    ),
    row_count: rowCount,
    integrity_sha256: sha256(receipt.integrity_sha256, 'receipt.integrity_sha256'),
    watermark: text(receipt.watermark, 'receipt.watermark'),
    completeness: receipt.completeness as 'COMPLETE_BOUNDED' | 'COMPLETE_TO_WATERMARK',
    valid_rows: validRows,
    invalid_date_order_rows: invalidRows,
    replay_match: true,
    first_batch_size: firstBatchSize,
    replay_batch_size: replayBatchSize,
    physical_batch_size_in_identity: false,
    max_rows: maxRows,
    population_scope: 'DETERMINISTIC_ORDERED_PREFIX',
    replay_scope: 'QUIESCENT_CURRENT_SERVING_EPOCH',
    historic_as_of_reconstruction: false,
    legal_conclusion: false,
    raw_population_rows_emitted: false
  };
}

function parseStatistics(value: unknown): CnDurationDescriptiveStatisticsV1 {
  const statistics = record(value);
  exactKeys(
    statistics,
    ['count', 'min_days', 'p25_days', 'median_days', 'p75_days', 'max_days'],
    'CN duration descriptive statistics'
  );
  const parsed: CnDurationDescriptiveStatisticsV1 = {
    count: positiveInteger(statistics.count, 'statistics.count'),
    min_days: nonNegativeInteger(statistics.min_days, 'statistics.min_days'),
    p25_days: nonNegativeInteger(statistics.p25_days, 'statistics.p25_days'),
    median_days: nonNegativeInteger(statistics.median_days, 'statistics.median_days'),
    p75_days: nonNegativeInteger(statistics.p75_days, 'statistics.p75_days'),
    max_days: nonNegativeInteger(statistics.max_days, 'statistics.max_days')
  };
  if (
    parsed.min_days > parsed.p25_days ||
    parsed.p25_days > parsed.median_days ||
    parsed.median_days > parsed.p75_days ||
    parsed.p75_days > parsed.max_days
  ) {
    throw new BrainMethodContractError('CN duration descriptive quantiles must be monotonic.');
  }
  return parsed;
}

export function parseCnDurationDescriptiveSummaryRunV1(
  value: unknown
): CnDurationDescriptiveSummaryRunV1 {
  const summary = record(value);
  exactKeys(
    summary,
    [
      'schemaVersion',
      'sourceSystem',
      'dataset_ref_id',
      'engine_version',
      'query_fingerprint_sha256',
      'row_count',
      'integrity_sha256',
      'watermark',
      'valid_rows',
      'invalid_date_order_rows',
      'quantile_method',
      'statistics',
      'objective_only',
      'legal_conclusion',
      'predictive_claim',
      'raw_population_rows_emitted',
      'computed_at'
    ],
    'CN duration descriptive summary'
  );
  if (
    summary.schemaVersion !== 1 ||
    summary.sourceSystem !== 'MARKORBIT_DATA_ENGINE' ||
    summary.quantile_method !== CN_DURATION_RESEARCH_QUANTILE_METHOD
  ) {
    throw new BrainMethodContractError(
      'CN duration descriptive summary is outside the frozen gate.'
    );
  }
  const engineVersion = text(summary.engine_version, 'summary.engine_version');
  if (!EXACT_ENGINE_SHA.test(engineVersion)) {
    throw new BrainMethodContractError(
      'CN duration descriptive summary requires exact engine git SHA.'
    );
  }
  const rowCount = positiveInteger(summary.row_count, 'summary.row_count');
  const validRows = nonNegativeInteger(summary.valid_rows, 'summary.valid_rows');
  const invalidRows = nonNegativeInteger(
    summary.invalid_date_order_rows,
    'summary.invalid_date_order_rows'
  );
  if (validRows + invalidRows !== rowCount) {
    throw new BrainMethodContractError(
      'CN duration descriptive summary quality counts do not reconcile.'
    );
  }
  const statistics = parseStatistics(summary.statistics);
  if (statistics.count !== validRows) {
    throw new BrainMethodContractError(
      'CN duration descriptive summary statistics count must equal valid_rows.'
    );
  }
  exactTrue(summary.objective_only, 'summary.objective_only');
  exactFalse(summary.legal_conclusion, 'summary.legal_conclusion');
  exactFalse(summary.predictive_claim, 'summary.predictive_claim');
  exactFalse(summary.raw_population_rows_emitted, 'summary.raw_population_rows_emitted');
  return {
    schemaVersion: 1,
    sourceSystem: 'MARKORBIT_DATA_ENGINE',
    dataset_ref_id: text(summary.dataset_ref_id, 'summary.dataset_ref_id'),
    engine_version: engineVersion,
    query_fingerprint_sha256: sha256(
      summary.query_fingerprint_sha256,
      'summary.query_fingerprint_sha256'
    ),
    row_count: rowCount,
    integrity_sha256: sha256(summary.integrity_sha256, 'summary.integrity_sha256'),
    watermark: text(summary.watermark, 'summary.watermark'),
    valid_rows: validRows,
    invalid_date_order_rows: invalidRows,
    quantile_method: CN_DURATION_RESEARCH_QUANTILE_METHOD,
    statistics,
    objective_only: true,
    legal_conclusion: false,
    predictive_claim: false,
    raw_population_rows_emitted: false,
    computed_at: instant(summary.computed_at, 'summary.computed_at')
  };
}

function sameDatasetIdentity(
  dataset: Readonly<ResearchDatasetRefV1>,
  evidence: {
    dataset_ref_id: string;
    engine_version: string;
    query_fingerprint_sha256: string;
    row_count: number;
    integrity_sha256: string;
    watermark: string;
  }
): boolean {
  return (
    evidence.dataset_ref_id === dataset.dataset_ref_id &&
    evidence.engine_version === dataset.engine_version &&
    evidence.query_fingerprint_sha256 === dataset.query_fingerprint_sha256 &&
    evidence.row_count === dataset.row_count &&
    evidence.integrity_sha256 === dataset.integrity_sha256 &&
    evidence.watermark === dataset.watermark
  );
}

function sameStatistics(
  left: Readonly<CnDurationDescriptiveStatisticsV1>,
  right: Readonly<CnDurationDescriptiveStatisticsV1>
): boolean {
  return (
    left.count === right.count &&
    left.min_days === right.min_days &&
    left.p25_days === right.p25_days &&
    left.median_days === right.median_days &&
    left.p75_days === right.p75_days &&
    left.max_days === right.max_days
  );
}

export function evaluateCnDurationResearchV1(
  input: Readonly<EvaluateCnDurationResearchInputV1>
): EvaluateCnDurationResearchResultV1 {
  let dataset: ResearchDatasetRefV1;
  try {
    dataset = parseCnDurationResearchDatasetCandidateV1(input.dataset);
  } catch {
    return { status: 'REJECTED', reason: 'DATASET_SCOPE_MISMATCH' };
  }

  let receipt: CnDurationTargetHostAcceptanceReceiptV1;
  try {
    receipt = parseCnDurationTargetHostAcceptanceReceiptV1(input.acceptanceReceipt);
  } catch {
    return { status: 'REJECTED', reason: 'ACCEPTANCE_RECEIPT_MISMATCH' };
  }
  if (
    !sameDatasetIdentity(dataset, receipt) ||
    receipt.completeness !== dataset.completeness ||
    receipt.data_engine_sha !== dataset.engine_version.slice(4)
  ) {
    return { status: 'REJECTED', reason: 'ACCEPTANCE_RECEIPT_MISMATCH' };
  }
  if (receipt.valid_rows < 1) {
    return { status: 'REJECTED', reason: 'NO_VALID_ROWS' };
  }

  let firstSummary: CnDurationDescriptiveSummaryRunV1;
  let replaySummary: CnDurationDescriptiveSummaryRunV1;
  try {
    firstSummary = parseCnDurationDescriptiveSummaryRunV1(input.firstSummary);
    replaySummary = parseCnDurationDescriptiveSummaryRunV1(input.replaySummary);
  } catch {
    return { status: 'REJECTED', reason: 'SUMMARY_SCOPE_MISMATCH' };
  }
  if (
    !sameDatasetIdentity(dataset, firstSummary) ||
    !sameDatasetIdentity(dataset, replaySummary) ||
    firstSummary.valid_rows !== receipt.valid_rows ||
    replaySummary.valid_rows !== receipt.valid_rows ||
    firstSummary.invalid_date_order_rows !== receipt.invalid_date_order_rows ||
    replaySummary.invalid_date_order_rows !== receipt.invalid_date_order_rows
  ) {
    return { status: 'REJECTED', reason: 'SUMMARY_SCOPE_MISMATCH' };
  }
  if (!sameStatistics(firstSummary.statistics, replaySummary.statistics)) {
    return { status: 'REJECTED', reason: 'SUMMARY_REPLAY_MISMATCH' };
  }

  const evaluation: BrainMethodEvaluationV1 = {
    evaluationId: `evaluation_cn-filing-to-prelim-duration-${dataset.query_fingerprint_sha256.slice(0, 16)}`,
    evaluatedAt: replaySummary.computed_at,
    status: 'PASSED',
    baseline: 'valid-row-count-only-v1 / no-prediction-no-legal-interpretation-v1',
    metrics: {
      datasetReplayMatchRate: 1,
      datasetLineageCompletenessRate: 1,
      descriptiveStatisticReplayRate: 1,
      invalidDateOrderExplicitRate: 1,
      rawPopulationCopyToCore: 0,
      rowCount: dataset.row_count,
      validRowCount: receipt.valid_rows,
      invalidDateOrderRowCount: receipt.invalid_date_order_rows,
      medianDays: replaySummary.statistics.median_days,
      p25Days: replaySummary.statistics.p25_days,
      p75Days: replaySummary.statistics.p75_days
    },
    evidenceSummary:
      `Accepted Data Engine dataset ${dataset.dataset_ref_id} replayed across different physical batch sizes and reproduced the same objective NEAREST_RANK descriptive statistics. ` +
      'No raw population rows are retained in Core, and this evaluation makes no predictive or legal claim.'
  };

  return {
    status: 'PASSED',
    dataset,
    receipt,
    statistics: replaySummary.statistics,
    evaluation
  };
}

export function compileCnDurationStatisticalMethodPackageV1(
  input: Readonly<EvaluateCnDurationResearchInputV1>
): CompileCnDurationStatisticalMethodResultV1 {
  const evaluated = evaluateCnDurationResearchV1(input);
  if (evaluated.status === 'REJECTED') return evaluated;

  const versionKey = evaluated.dataset.query_fingerprint_sha256.slice(0, 16);
  const methodId = 'brain-method_cn-filing-to-prelim-duration-descriptive' as const;
  const methodVersionId =
    `brain-method-version_cn-filing-to-prelim-duration-descriptive-${versionKey}` as const;
  const packageId =
    `executable-method-package_cn-filing-to-prelim-duration-descriptive-${versionKey}` as const;
  const applicability = CN_DURATION_RESEARCH_MISSION_V1.applicabilityTarget;
  const algorithm = {
    kind: 'DESCRIPTIVE_EMPIRICAL_DISTRIBUTION',
    datasetRefId: evaluated.dataset.dataset_ref_id,
    quantileMethod: CN_DURATION_RESEARCH_QUANTILE_METHOD,
    statistics: evaluated.statistics,
    legalConclusion: false,
    predictiveClaim: false
  } as const;
  const lineage = {
    knowledgeSources: [],
    researchDatasets: [evaluated.dataset]
  } as const;
  const limitations = [
    'Applies only to the accepted bounded CN filing-to-preliminary-publication dataset identity in lineage.',
    'Descriptive elapsed-day statistics are not a legal deadline, SLA, outcome prediction, case-status inference, risk score, or recommendation.',
    'Dataset freshness, source coverage and population bounds remain Data Engine evidence properties; a different dataset identity requires a new evaluation.',
    'This package is VALIDATED only and is not eligible for automatic runtime selection until a separate activation gate succeeds.'
  ];

  const method = parseBrainMethodContractV1({
    schemaVersion: 1,
    methodId,
    methodVersionId,
    methodFamily: CN_DURATION_RESEARCH_METHOD_FAMILY,
    version: 1,
    purpose:
      'Represent a reproducible empirical CN filing-to-preliminary-publication elapsed-day distribution from one accepted Data Engine dataset identity.',
    targetObjectType: 'TRADEMARK_APPLICATION',
    applicability,
    requiredInputs: ['acceptedResearchDatasetRef', 'jurisdiction', 'procedure'],
    featureDefinitions: [
      'VALID duration_days only',
      'INVALID_DATE_ORDER count retained as explicit data-quality evidence',
      'NEAREST_RANK bounded empirical quartiles',
      'exact Data Engine dataset lineage'
    ],
    algorithm,
    outputSchemaId: 'brain.cn-filing-to-prelim-duration.descriptive.v1',
    limitations,
    coverage:
      'CN / CNIPA / trademark applications / filing_date to prelim_pub_date / accepted bounded factual research population.',
    evaluation: evaluated.evaluation,
    fallback: { behavior: 'NOT_APPLICABLE' },
    lineage,
    lifecycle: 'VALIDATED',
    supersedesMethodVersionIds: [],
    createdAt: evaluated.evaluation.evaluatedAt,
    validatedAt: evaluated.evaluation.evaluatedAt
  });

  const pkg = parseExecutableMethodPackageV1({
    schemaVersion: 1,
    packageId,
    packageVersion: 1,
    methodId,
    methodVersionId,
    methodFamily: CN_DURATION_RESEARCH_METHOD_FAMILY,
    lifecycle: 'VALIDATED',
    selectionPriority: 0,
    applicability,
    inputSchemaId: 'brain-input.cn-filing-to-prelim-duration.descriptive.v1',
    outputSchemaId: 'brain.cn-filing-to-prelim-duration.descriptive.v1',
    executable: algorithm,
    requiredData: applicability.requiredData,
    referenceDependencies: [],
    reasonCodes: {
      DESCRIPTIVE_DISTRIBUTION_REPRODUCED:
        'Accepted dataset lineage and objective descriptive statistics replayed deterministically.',
      NOT_APPLICABLE: 'Request is outside the exact CN duration research applicability.',
      DATASET_LINEAGE_MISMATCH:
        'Dataset or target-host acceptance evidence does not match lineage.',
      REPLAY_MISMATCH: 'Descriptive statistics did not reproduce from the same dataset identity.'
    },
    fallback: { behavior: 'NOT_APPLICABLE' },
    evaluation: evaluated.evaluation,
    lineage,
    limitations,
    createdAt: evaluated.evaluation.evaluatedAt
  });

  return { status: 'READY', method, package: pkg };
}
