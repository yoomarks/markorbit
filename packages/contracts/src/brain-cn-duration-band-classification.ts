import {
  parseBrainMethodContractV1,
  parseBrainResearchMissionV1,
  parseExecutableMethodPackageV1,
  type BrainMethodContractV1,
  type BrainMethodEvaluationV1,
  type BrainResearchMissionV1,
  type ExecutableMethodPackageV1
} from './brain-method.js';
import {
  evaluateCnDurationResearchV1,
  type EvaluateCnDurationResearchInputV1
} from './brain-cn-duration-research.js';

export const CN_DURATION_BAND_METHOD_FAMILY = 'CLASSIFICATION' as const;
export const CN_DURATION_BAND_EXECUTABLE_KIND =
  'HISTORICAL_COMPLETED_DURATION_QUARTILE_BAND_CLASSIFICATION' as const;
export const CN_DURATION_BAND_ACCEPTED_EVIDENCE_SHA256 =
  'de407eb5e5c0704c7e2817cf8ce67f14c381d1a587fb986a664425d8a3eb411c' as const;
export const CN_DURATION_BAND_ACCEPTED_DATASET_REF =
  'research-dataset_7bdd73d7e4eab9cec0bc04337747f2ea6c1b692f9a79570c4b7ba4fde1faa82d' as const;
export const CN_DURATION_BAND_ACCEPTED_QUERY_FINGERPRINT_SHA256 =
  '7bdd73d7e4eab9cec0bc04337747f2ea6c1b692f9a79570c4b7ba4fde1faa82d' as const;
export const CN_DURATION_BAND_ACCEPTED_INTEGRITY_SHA256 =
  'e09c3080154094ac90dff79ac2db657b7aff58179272b3293707f2f523b185e0' as const;
export const CN_DURATION_BAND_ACCEPTED_WATERMARK =
  'cn-serving-epoch:coverage=2026-07-31:max-success-sequence=85:success-count=85' as const;
export const CN_DURATION_BAND_ACCEPTED_ENGINE_VERSION =
  'git:4ee0030dd77fac50f973573818225324888dc064' as const;

export const CN_DURATION_BAND_RESEARCH_MISSION_V1: Readonly<BrainResearchMissionV1> =
  parseBrainResearchMissionV1({
    schemaVersion: 1,
    missionId: 'brain-research-mission_cn-completed-duration-historical-band-v1',
    capabilityDemand:
      'Classify an already completed CN filing-to-preliminary-publication elapsed-day observation relative to one accepted historical distribution.',
    problem:
      'Interpret only where a completed factual elapsed-day observation falls relative to the accepted CN historical p25/median/p75 boundaries without predicting future duration, legal status, risk, probability, recommendation, or business action.',
    targetMethodFamily: CN_DURATION_BAND_METHOD_FAMILY,
    applicabilityTarget: {
      jurisdictions: ['CN'],
      authorities: ['CNIPA'],
      objectTypes: ['TRADEMARK_APPLICATION'],
      operations: ['CLASSIFY_COMPLETED_DURATION_HISTORICAL_BAND'],
      procedures: ['FILING_TO_PRELIMINARY_PUBLICATION'],
      stages: ['COMPLETED_INTERVAL_INTERPRETATION'],
      filingBases: ['ANY'],
      segments: ['FILING_TO_PRELIM_PUBLICATION'],
      requiredData: ['OBSERVED_COMPLETED_DURATION_DAYS', 'ACCEPTED_CN_DURATION_DISTRIBUTION'],
      effectiveFrom: '2026-08-29T00:00:00.000Z'
    },
    knowledgeResearchPlan: [],
    dataEngineResearchPlan: [
      'Reuse only the exact Phase 3 target-host CN duration evidence already accepted through Core #298/#306.',
      'Bind evaluation to the exact accepted ResearchDatasetRefV1, query fingerprint, integrity SHA-256, watermark and Data Engine git SHA.',
      'Consume only the accepted metadata-only p25/median/p75 descriptive statistics; do not rescan or copy raw population rows.'
    ],
    hypotheses: [
      'Every non-negative integer completed-duration observation maps deterministically to exactly one historical quartile band.',
      'Boundary behavior around p25, median and p75 is reproducible and independent of physical Data Engine batch size.',
      'Historical-band classification can remain descriptive without implying prediction, legal status, risk, probability or recommendation.'
    ],
    featurePlan: [
      'observedCompletedDurationDays supplied by the caller as a completed factual interval',
      'accepted p25_days, median_days and p75_days from exact Phase 3 Data Engine lineage',
      'exact ResearchDatasetRefV1 identity retained as method/package provenance'
    ],
    evaluationPlan: [
      'Require the existing CN duration statistical evaluator to PASS on the exact accepted Phase 3 evidence.',
      'Reject any dataset, engine, query fingerprint, integrity, watermark or accepted threshold drift.',
      'Require strictly increasing p25/median/p75 boundaries for the frozen four-band classifier.',
      'Evaluate boundary transitions at p25-1/p25/p25+1, median/median+1 and p75/p75+1 plus zero.',
      'Reject negative, fractional or unsafe-integer observations.',
      'Compile only a VALIDATED package; activation requires a separate Phase 4 governance decision.'
    ],
    successMetrics: [
      'source_statistical_evaluation_pass_rate=1',
      'accepted_dataset_identity_match_rate=1',
      'boundary_case_pass_rate=1',
      'deterministic_classification_replay_rate=1',
      'exactly_one_band_rate=1',
      'predictive_legal_risk_recommendation_claim_rate=0'
    ],
    baselineMetrics: [
      'three-threshold-deterministic-comparator-v1',
      'no-prediction-no-legal-risk-recommendation-v1'
    ],
    createdAt: '2026-08-29T00:00:00.000Z'
  });

export const cnCompletedDurationHistoricalBands = [
  'LOWER_QUARTILE_OR_BELOW',
  'LOWER_INTERQUARTILE',
  'UPPER_INTERQUARTILE',
  'UPPER_QUARTILE'
] as const;
export type CnCompletedDurationHistoricalBandV1 =
  (typeof cnCompletedDurationHistoricalBands)[number];

export interface CnDurationBandThresholdsV1 {
  p25Days: number;
  medianDays: number;
  p75Days: number;
}

export type EvaluateCnDurationBandClassificationResultV1 =
  | {
      status: 'REJECTED';
      reason:
        | 'SOURCE_STATISTICAL_EVALUATION_REJECTED'
        | 'SOURCE_EVIDENCE_IDENTITY_MISMATCH'
        | 'THRESHOLD_CONTRACT_MISMATCH'
        | 'BOUNDARY_EVALUATION_FAILED';
    }
  | {
      status: 'PASSED';
      thresholds: Readonly<CnDurationBandThresholdsV1>;
      evaluation: Readonly<BrainMethodEvaluationV1>;
      sourceEvaluation: Readonly<BrainMethodEvaluationV1>;
      dataset: Readonly<ExecutableMethodPackageV1['lineage']['researchDatasets'][number]>;
    };

export type CompileCnDurationBandClassificationResultV1 =
  | Extract<EvaluateCnDurationBandClassificationResultV1, { status: 'REJECTED' }>
  | {
      status: 'READY';
      method: Readonly<BrainMethodContractV1>;
      package: Readonly<ExecutableMethodPackageV1>;
    };

function nonNegativeInteger(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError('observedCompletedDurationDays must be a non-negative safe integer.');
  }
  return value;
}

function validThresholds(value: Readonly<CnDurationBandThresholdsV1>): boolean {
  return (
    Number.isSafeInteger(value.p25Days) &&
    Number.isSafeInteger(value.medianDays) &&
    Number.isSafeInteger(value.p75Days) &&
    value.p25Days >= 0 &&
    value.p25Days < value.medianDays &&
    value.medianDays < value.p75Days
  );
}

export function classifyCnCompletedDurationHistoricalBandV1(
  observedCompletedDurationDays: number,
  thresholds: Readonly<CnDurationBandThresholdsV1>
): CnCompletedDurationHistoricalBandV1 {
  const days = nonNegativeInteger(observedCompletedDurationDays);
  if (!validThresholds(thresholds)) {
    throw new TypeError('CN duration historical band thresholds are invalid.');
  }
  if (days <= thresholds.p25Days) return 'LOWER_QUARTILE_OR_BELOW';
  if (days <= thresholds.medianDays) return 'LOWER_INTERQUARTILE';
  if (days <= thresholds.p75Days) return 'UPPER_INTERQUARTILE';
  return 'UPPER_QUARTILE';
}

function exactAcceptedSource(
  dataset: Readonly<ExecutableMethodPackageV1['lineage']['researchDatasets'][number]>,
  thresholds: Readonly<CnDurationBandThresholdsV1>
): boolean {
  return (
    dataset.dataset_ref_id === CN_DURATION_BAND_ACCEPTED_DATASET_REF &&
    dataset.engine_version === CN_DURATION_BAND_ACCEPTED_ENGINE_VERSION &&
    dataset.query_fingerprint_sha256 === CN_DURATION_BAND_ACCEPTED_QUERY_FINGERPRINT_SHA256 &&
    dataset.integrity_sha256 === CN_DURATION_BAND_ACCEPTED_INTEGRITY_SHA256 &&
    dataset.watermark === CN_DURATION_BAND_ACCEPTED_WATERMARK &&
    dataset.row_count === 10000 &&
    thresholds.p25Days === 335 &&
    thresholds.medianDays === 336 &&
    thresholds.p75Days === 383
  );
}

function boundaryEvaluationPasses(thresholds: Readonly<CnDurationBandThresholdsV1>): boolean {
  const cases: readonly [number, CnCompletedDurationHistoricalBandV1][] = [
    [0, 'LOWER_QUARTILE_OR_BELOW'],
    [thresholds.p25Days - 1, 'LOWER_QUARTILE_OR_BELOW'],
    [thresholds.p25Days, 'LOWER_QUARTILE_OR_BELOW'],
    [thresholds.p25Days + 1, 'LOWER_INTERQUARTILE'],
    [thresholds.medianDays, 'LOWER_INTERQUARTILE'],
    [thresholds.medianDays + 1, 'UPPER_INTERQUARTILE'],
    [thresholds.p75Days, 'UPPER_INTERQUARTILE'],
    [thresholds.p75Days + 1, 'UPPER_QUARTILE']
  ];
  return cases.every(
    ([days, expected]) => classifyCnCompletedDurationHistoricalBandV1(days, thresholds) === expected
  );
}

export function evaluateCnDurationBandClassificationV1(
  input: Readonly<EvaluateCnDurationResearchInputV1>
): EvaluateCnDurationBandClassificationResultV1 {
  const source = evaluateCnDurationResearchV1(input);
  if (source.status !== 'PASSED') {
    return { status: 'REJECTED', reason: 'SOURCE_STATISTICAL_EVALUATION_REJECTED' };
  }

  const dataset = source.dataset;
  const thresholds: CnDurationBandThresholdsV1 = {
    p25Days: source.statistics.p25_days,
    medianDays: source.statistics.median_days,
    p75Days: source.statistics.p75_days
  };
  if (!validThresholds(thresholds)) {
    return { status: 'REJECTED', reason: 'THRESHOLD_CONTRACT_MISMATCH' };
  }
  if (!exactAcceptedSource(dataset, thresholds)) {
    return { status: 'REJECTED', reason: 'SOURCE_EVIDENCE_IDENTITY_MISMATCH' };
  }
  if (!boundaryEvaluationPasses(thresholds)) {
    return { status: 'REJECTED', reason: 'BOUNDARY_EVALUATION_FAILED' };
  }

  const evaluation: BrainMethodEvaluationV1 = {
    evaluationId: `evaluation_cn-completed-duration-historical-band-${dataset.query_fingerprint_sha256.slice(0, 16)}`,
    evaluatedAt: source.evaluation.evaluatedAt,
    status: 'PASSED',
    baseline:
      'three-threshold-deterministic-comparator-v1 / no-prediction-no-legal-risk-recommendation-v1',
    metrics: {
      sourceStatisticalEvaluationPassRate: 1,
      acceptedDatasetIdentityMatchRate: 1,
      boundaryCasePassRate: 1,
      deterministicClassificationReplayRate: 1,
      exactlyOneBandRate: 1,
      predictiveClaimRate: 0,
      legalClaimRate: 0,
      riskClaimRate: 0,
      recommendationClaimRate: 0,
      p25Days: thresholds.p25Days,
      medianDays: thresholds.medianDays,
      p75Days: thresholds.p75Days
    },
    evidenceSummary:
      `The exact accepted Phase 3 dataset ${dataset.dataset_ref_id} reproduced p25=${thresholds.p25Days}, median=${thresholds.medianDays}, p75=${thresholds.p75Days}; deterministic boundary evaluation passed for completed observations. ` +
      'The classifier describes historical distribution position only and makes no predictive, legal, risk or recommendation claim.'
  };

  return {
    status: 'PASSED',
    thresholds,
    evaluation,
    sourceEvaluation: source.evaluation,
    dataset
  };
}

export function compileCnDurationBandClassificationMethodPackageV1(
  input: Readonly<EvaluateCnDurationResearchInputV1>
): CompileCnDurationBandClassificationResultV1 {
  const evaluated = evaluateCnDurationBandClassificationV1(input);
  if (evaluated.status === 'REJECTED') return evaluated;

  const versionKey = evaluated.dataset.query_fingerprint_sha256.slice(0, 16);
  const methodId = 'brain-method_cn-completed-duration-historical-band' as const;
  const methodVersionId =
    `brain-method-version_cn-completed-duration-historical-band-${versionKey}` as const;
  const packageId =
    `executable-method-package_cn-completed-duration-historical-band-${versionKey}` as const;
  const applicability = CN_DURATION_BAND_RESEARCH_MISSION_V1.applicabilityTarget;
  const executable = {
    kind: CN_DURATION_BAND_EXECUTABLE_KIND,
    semantics: 'COMPLETED_INTERVAL_RELATIVE_TO_ACCEPTED_HISTORICAL_DISTRIBUTION',
    datasetRefId: evaluated.dataset.dataset_ref_id,
    thresholds: {
      p25Days: evaluated.thresholds.p25Days,
      medianDays: evaluated.thresholds.medianDays,
      p75Days: evaluated.thresholds.p75Days
    },
    bands: [...cnCompletedDurationHistoricalBands],
    legalConclusion: false,
    predictiveClaim: false,
    riskClaim: false,
    probabilityClaim: false,
    recommendation: false
  } as const;
  const lineage = {
    knowledgeSources: [],
    researchDatasets: [evaluated.dataset]
  } as const;
  const limitations = [
    'Applies only to an already completed CN filing-to-preliminary-publication elapsed-day observation and the exact accepted Phase 3 dataset identity in lineage.',
    'Historical quartile-band position is descriptive interpretation only; it is not a legal deadline, SLA, future-duration prediction, case-status inference, probability, risk score, recommendation, or business action.',
    'A different Data Engine dataset identity or changed p25/median/p75 thresholds requires a new research evaluation and method version.',
    'The caller owns the completed-duration input and any product lifecycle state; Capability and Brain do not infer or persist product worklist state.',
    'This package is VALIDATED only and cannot be selected for ordinary runtime execution until a separate governed activation decision succeeds.'
  ];

  const method = parseBrainMethodContractV1({
    schemaVersion: 1,
    methodId,
    methodVersionId,
    methodFamily: CN_DURATION_BAND_METHOD_FAMILY,
    version: 1,
    purpose:
      'Classify one already completed CN filing-to-preliminary-publication elapsed-day observation by its position relative to the exact accepted historical p25/median/p75 distribution.',
    targetObjectType: 'TRADEMARK_APPLICATION',
    applicability,
    requiredInputs: [
      'observedCompletedDurationDays',
      'acceptedResearchDatasetRef',
      'jurisdiction',
      'procedure'
    ],
    featureDefinitions: [
      'non-negative integer observedCompletedDurationDays supplied by caller',
      'accepted historical p25_days/median_days/p75_days thresholds',
      'exact accepted ResearchDatasetRefV1 lineage'
    ],
    algorithm: executable,
    outputSchemaId: 'brain.cn-completed-duration-historical-band.v1',
    limitations,
    coverage:
      'CN / CNIPA / trademark applications / already completed filing-to-preliminary-publication elapsed-day observations / exact accepted Phase 3 historical distribution.',
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
    methodFamily: CN_DURATION_BAND_METHOD_FAMILY,
    lifecycle: 'VALIDATED',
    selectionPriority: 0,
    applicability,
    inputSchemaId: 'brain-input.cn-completed-duration-historical-band.v1',
    outputSchemaId: 'brain.cn-completed-duration-historical-band.v1',
    executable,
    requiredData: applicability.requiredData,
    referenceDependencies: [],
    reasonCodes: {
      HISTORICAL_BAND_CLASSIFIED:
        'Completed factual duration was classified relative to the accepted historical p25/median/p75 distribution.',
      NOT_APPLICABLE:
        'Request is outside the exact completed-duration classification applicability.',
      SOURCE_EVIDENCE_MISMATCH:
        'Accepted Phase 3 dataset identity or descriptive thresholds do not match the frozen method.',
      INVALID_COMPLETED_DURATION: 'Observed completed duration must be a non-negative safe integer.'
    },
    fallback: { behavior: 'NOT_APPLICABLE' },
    evaluation: evaluated.evaluation,
    lineage,
    limitations,
    createdAt: evaluated.evaluation.evaluatedAt
  });

  return { status: 'READY', method, package: pkg };
}
