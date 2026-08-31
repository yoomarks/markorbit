import { createHash } from 'node:crypto';
import {
  CN_DURATION_BAND_ACCEPTED_DATASET_REF,
  CN_DURATION_BAND_ACCEPTED_QUERY_FINGERPRINT_SHA256,
  CN_DURATION_BAND_EXECUTABLE_KIND,
  CN_DURATION_BAND_METHOD_FAMILY,
  CN_DURATION_BAND_RESEARCH_MISSION_V1,
  classifyCnCompletedDurationHistoricalBandV1,
  cnCompletedDurationHistoricalBands,
  type CnDurationBandThresholdsV1
} from '@markorbit/contracts/brain-cn-duration-band-classification';
import {
  evaluateCnDurationResearchV1,
  type EvaluateCnDurationResearchInputV1
} from '@markorbit/contracts/brain-cn-duration-research';
import {
  BrainMethodContractError,
  parseBrainMethodContractV1,
  parseExecutableMethodPackageV1,
  type BrainMethodContractV1,
  type BrainMethodEvaluationV1,
  type BrainMethodVersionId,
  type ExecutableMethodPackageV1
} from '@markorbit/contracts/brain-method';
import {
  MethodImprovementContractError,
  assertMethodImprovementMissionBinding,
  parseMethodImprovementResearchMissionV1,
  parseMethodImprovementTriggerV1,
  type MethodImprovementPredecessorV1,
  type MethodImprovementResearchMissionV1,
  type MethodImprovementTriggerV1
} from '@markorbit/contracts/method-improvement';

export type MethodImprovementCandidateErrorCode =
  | 'INVALID_TRIGGER'
  | 'MISSION_MISMATCH'
  | 'PREDECESSOR_MISMATCH'
  | 'RESEARCH_REJECTED'
  | 'THRESHOLD_CONTRACT_MISMATCH'
  | 'NO_CANDIDATE_CHANGE';

export class MethodImprovementCandidateError extends Error {
  constructor(
    readonly code: MethodImprovementCandidateErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'MethodImprovementCandidateError';
  }
}

export interface BuildMethodImprovementCandidateInputV1 {
  trigger: unknown;
  researchMission: unknown;
  research: Readonly<EvaluateCnDurationResearchInputV1>;
}

export interface MethodImprovementCandidateV1 {
  schemaVersion: 1;
  triggerId: MethodImprovementTriggerV1['triggerId'];
  researchMissionId: MethodImprovementResearchMissionV1['researchMissionId'];
  predecessor: Readonly<MethodImprovementPredecessorV1>;
  canonicalPredecessorMethodVersionId: BrainMethodVersionId;
  researchDatasetRefId: string;
  candidateFingerprintSha256: string;
  methodFingerprintSha256: string;
  packageFingerprintSha256: string;
  method: Readonly<BrainMethodContractV1>;
  package: Readonly<ExecutableMethodPackageV1>;
}

const PILOT_A_PREDECESSOR = Object.freeze({
  methodPackageRef: 'brain-method-package:package_cn-duration@1',
  methodRef: 'brain-method:method_cn-duration',
  methodVersionRef: 'brain-method-version:method-version_cn-duration',
  evaluationRef: 'brain-method-evaluation:evaluation_cn-duration'
});

const PREDECESSOR_THRESHOLDS: Readonly<CnDurationBandThresholdsV1> = Object.freeze({
  p25Days: 335,
  medianDays: 336,
  p75Days: 383
});

const CANONICAL_PREDECESSOR_METHOD_ID =
  'brain-method_cn-completed-duration-historical-band' as const;
export const PHASE7_PILOT_A_CANONICAL_PREDECESSOR_METHOD_VERSION_ID =
  `brain-method-version_cn-completed-duration-historical-band-${CN_DURATION_BAND_ACCEPTED_QUERY_FINGERPRINT_SHA256.slice(0, 16)}` as BrainMethodVersionId;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

function fingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function fail(code: MethodImprovementCandidateErrorCode, message: string, cause?: unknown): never {
  throw new MethodImprovementCandidateError(code, message, {
    cause: cause instanceof Error ? cause : undefined
  });
}

function exactStrings(actual: readonly string[], expected: readonly string[]): boolean {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function assertFrozenPredecessor(predecessor: Readonly<MethodImprovementPredecessorV1>): void {
  if (
    predecessor.methodPackageRef !== PILOT_A_PREDECESSOR.methodPackageRef ||
    predecessor.methodRef !== PILOT_A_PREDECESSOR.methodRef ||
    predecessor.methodVersionRef !== PILOT_A_PREDECESSOR.methodVersionRef ||
    predecessor.evaluationRef !== PILOT_A_PREDECESSOR.evaluationRef
  ) {
    fail(
      'PREDECESSOR_MISMATCH',
      'Phase 7 pilot A candidate requires the exact frozen CN duration predecessor.'
    );
  }
}

function assertAdmissionFingerprints(
  trigger: Readonly<MethodImprovementTriggerV1>,
  researchMission: Readonly<MethodImprovementResearchMissionV1>
): void {
  const expectedTrigger = fingerprint({
    schemaVersion: trigger.schemaVersion,
    workspaceId: trigger.workspaceId,
    triggerType: trigger.triggerType,
    predecessor: trigger.predecessor,
    source: trigger.source,
    reason: trigger.reason,
    createdByPrincipalId: trigger.createdByPrincipalId
  });
  if (trigger.triggerFingerprintSha256 !== expectedTrigger) {
    fail('INVALID_TRIGGER', 'Method Improvement trigger fingerprint verification failed.');
  }

  const expectedMission = fingerprint({
    schemaVersion: researchMission.schemaVersion,
    workspaceId: researchMission.workspaceId,
    triggerId: researchMission.triggerId,
    triggerFingerprintSha256: researchMission.triggerFingerprintSha256,
    predecessor: researchMission.predecessor,
    mission: researchMission.mission,
    createdByPrincipalId: researchMission.createdByPrincipalId,
    createdAt: researchMission.createdAt
  });
  if (researchMission.missionFingerprintSha256 !== expectedMission) {
    fail('MISSION_MISMATCH', 'Method Improvement research mission fingerprint verification failed.');
  }
}

function assertPilotAMission(
  trigger: Readonly<MethodImprovementTriggerV1>,
  researchMission: Readonly<MethodImprovementResearchMissionV1>
): void {
  const mission = researchMission.mission;
  const applicability = mission.applicabilityTarget;
  if (
    mission.targetMethodFamily !== CN_DURATION_BAND_METHOD_FAMILY ||
    !exactStrings(applicability.jurisdictions, ['CN']) ||
    !exactStrings(applicability.authorities, ['CNIPA']) ||
    !exactStrings(applicability.objectTypes, ['TRADEMARK_CASE']) ||
    !exactStrings(applicability.operations, ['DURATION_BAND_CLASSIFICATION']) ||
    !exactStrings(applicability.procedures, ['COMPLETED_CASE_RESEARCH']) ||
    !exactStrings(applicability.stages, ['COMPLETED']) ||
    !exactStrings(applicability.filingBases, ['NOT_APPLICABLE']) ||
    !exactStrings(applicability.segments, ['HISTORICAL_BAND']) ||
    !exactStrings(applicability.requiredData, ['COMPLETED_DURATION_FACTS']) ||
    !mission.baselineMetrics.includes(trigger.predecessor.evaluationRef)
  ) {
    fail(
      'MISSION_MISMATCH',
      'Research mission is not the frozen CN completed-duration historical-band improvement mission.'
    );
  }
}

function parseInputs(input: Readonly<BuildMethodImprovementCandidateInputV1>): {
  trigger: MethodImprovementTriggerV1;
  researchMission: MethodImprovementResearchMissionV1;
} {
  let trigger: MethodImprovementTriggerV1;
  let researchMission: MethodImprovementResearchMissionV1;
  try {
    trigger = parseMethodImprovementTriggerV1(input.trigger);
  } catch (error) {
    if (error instanceof MethodImprovementContractError) {
      return fail('INVALID_TRIGGER', error.message, error);
    }
    throw error;
  }
  try {
    researchMission = parseMethodImprovementResearchMissionV1(input.researchMission);
    assertMethodImprovementMissionBinding(trigger, researchMission);
  } catch (error) {
    if (error instanceof MethodImprovementContractError) {
      return fail('MISSION_MISMATCH', error.message, error);
    }
    throw error;
  }
  if (trigger.triggerType !== 'PERFORMANCE_GAP') {
    fail('INVALID_TRIGGER', 'Phase 7 pilot A candidate requires PERFORMANCE_GAP.');
  }
  assertFrozenPredecessor(trigger.predecessor);
  assertAdmissionFingerprints(trigger, researchMission);
  assertPilotAMission(trigger, researchMission);
  return { trigger, researchMission };
}

function candidateThresholds(
  statistics: Readonly<{ p25_days: number; median_days: number; p75_days: number }>
): Readonly<CnDurationBandThresholdsV1> {
  const thresholds = {
    p25Days: statistics.p25_days,
    medianDays: statistics.median_days,
    p75Days: statistics.p75_days
  };
  if (
    !Number.isSafeInteger(thresholds.p25Days) ||
    !Number.isSafeInteger(thresholds.medianDays) ||
    !Number.isSafeInteger(thresholds.p75Days) ||
    thresholds.p25Days < 0 ||
    thresholds.p25Days >= thresholds.medianDays ||
    thresholds.medianDays >= thresholds.p75Days ||
    thresholds.p75Days >= Number.MAX_SAFE_INTEGER
  ) {
    fail(
      'THRESHOLD_CONTRACT_MISMATCH',
      'Candidate p25/median/p75 thresholds must be non-negative, safe and strictly increasing.'
    );
  }
  return thresholds;
}

function boundaryEvaluationPasses(thresholds: Readonly<CnDurationBandThresholdsV1>): boolean {
  const cases: Array<[number, (typeof cnCompletedDurationHistoricalBands)[number]]> = [
    [0, 'LOWER_QUARTILE_OR_BELOW'],
    [thresholds.p25Days, 'LOWER_QUARTILE_OR_BELOW'],
    [thresholds.p25Days + 1, 'LOWER_INTERQUARTILE'],
    [thresholds.medianDays, 'LOWER_INTERQUARTILE'],
    [thresholds.medianDays + 1, 'UPPER_INTERQUARTILE'],
    [thresholds.p75Days, 'UPPER_INTERQUARTILE'],
    [thresholds.p75Days + 1, 'UPPER_QUARTILE']
  ];
  if (thresholds.p25Days > 0) {
    cases.splice(1, 0, [thresholds.p25Days - 1, 'LOWER_QUARTILE_OR_BELOW']);
  }
  return cases.every(
    ([days, expected]) => classifyCnCompletedDurationHistoricalBandV1(days, thresholds) === expected
  );
}

function changedThresholdCount(thresholds: Readonly<CnDurationBandThresholdsV1>): number {
  return (
    Number(thresholds.p25Days !== PREDECESSOR_THRESHOLDS.p25Days) +
    Number(thresholds.medianDays !== PREDECESSOR_THRESHOLDS.medianDays) +
    Number(thresholds.p75Days !== PREDECESSOR_THRESHOLDS.p75Days)
  );
}

export function buildMethodImprovementCandidateV1(
  input: Readonly<BuildMethodImprovementCandidateInputV1>
): Readonly<MethodImprovementCandidateV1> {
  const { trigger, researchMission } = parseInputs(input);
  const evaluated = evaluateCnDurationResearchV1(input.research);
  if (evaluated.status !== 'PASSED') {
    return fail(
      'RESEARCH_REJECTED',
      `CN duration research evidence was rejected: ${evaluated.reason}.`
    );
  }

  const thresholds = candidateThresholds(evaluated.statistics);
  if (!boundaryEvaluationPasses(thresholds)) {
    fail(
      'THRESHOLD_CONTRACT_MISMATCH',
      'Candidate historical-band thresholds failed deterministic boundary evaluation.'
    );
  }
  const changedThresholds = changedThresholdCount(thresholds);
  if (
    changedThresholds === 0 ||
    evaluated.dataset.dataset_ref_id === CN_DURATION_BAND_ACCEPTED_DATASET_REF ||
    evaluated.dataset.query_fingerprint_sha256 ===
      CN_DURATION_BAND_ACCEPTED_QUERY_FINGERPRINT_SHA256
  ) {
    fail(
      'NO_CANDIDATE_CHANGE',
      'Research reproduces the predecessor research identity or thresholds and does not justify a new candidate.'
    );
  }

  const candidateIdentitySha256 = fingerprint({
    schemaVersion: 1,
    triggerFingerprintSha256: trigger.triggerFingerprintSha256,
    missionFingerprintSha256: researchMission.missionFingerprintSha256,
    predecessor: trigger.predecessor,
    canonicalPredecessorMethodVersionId: PHASE7_PILOT_A_CANONICAL_PREDECESSOR_METHOD_VERSION_ID,
    research: {
      datasetRefId: evaluated.dataset.dataset_ref_id,
      engineVersion: evaluated.dataset.engine_version,
      queryFingerprintSha256: evaluated.dataset.query_fingerprint_sha256,
      rowCount: evaluated.dataset.row_count,
      integritySha256: evaluated.dataset.integrity_sha256,
      watermark: evaluated.dataset.watermark,
      sourceEvaluationId: evaluated.evaluation.evaluationId
    },
    thresholds
  });
  const versionKey = candidateIdentitySha256.slice(0, 16);
  const methodVersionId =
    `brain-method-version_cn-completed-duration-historical-band-phase7-${versionKey}` as BrainMethodVersionId;
  const packageId =
    `executable-method-package_cn-completed-duration-historical-band-phase7-${versionKey}` as const;
  const createdAt = evaluated.evaluation.evaluatedAt;
  const applicability = CN_DURATION_BAND_RESEARCH_MISSION_V1.applicabilityTarget;
  const executable = {
    kind: CN_DURATION_BAND_EXECUTABLE_KIND,
    semantics: 'COMPLETED_INTERVAL_RELATIVE_TO_ACCEPTED_HISTORICAL_DISTRIBUTION',
    datasetRefId: evaluated.dataset.dataset_ref_id,
    thresholds,
    bands: [...cnCompletedDurationHistoricalBands],
    legalConclusion: false,
    predictiveClaim: false,
    riskClaim: false,
    probabilityClaim: false,
    recommendation: false,
    methodImprovement: {
      triggerId: trigger.triggerId,
      triggerFingerprintSha256: trigger.triggerFingerprintSha256,
      researchMissionId: researchMission.researchMissionId,
      missionFingerprintSha256: researchMission.missionFingerprintSha256,
      predecessor: trigger.predecessor,
      canonicalPredecessorMethodVersionId: PHASE7_PILOT_A_CANONICAL_PREDECESSOR_METHOD_VERSION_ID,
      sourceReportFingerprintSha256: trigger.source.reportFingerprintSha256
    }
  } as const;
  const lineage = {
    knowledgeSources: [],
    researchDatasets: [evaluated.dataset]
  } as const;
  const limitations = [
    'This artifact is a Phase 7 CANDIDATE only; it has not passed predecessor comparison/backtest, shadow evaluation or activation governance.',
    'Applies only to an already completed CN filing-to-preliminary-publication elapsed-day observation and the exact candidate research dataset identity in lineage.',
    'Historical quartile-band position is descriptive interpretation only; it is not a legal deadline, SLA, future-duration prediction, case-status inference, probability, risk score, recommendation, or business action.',
    'The predecessor remains immutable and production-active until a later explicit lifecycle decision; this candidate cannot be selected by ordinary ACTIVE-only runtime selection.',
    'A different Data Engine dataset identity or changed thresholds requires a separate research evaluation and candidate identity.'
  ] as const;
  const evaluation: BrainMethodEvaluationV1 = {
    evaluationId: `evaluation_cn-completed-duration-historical-band-phase7-candidate-${versionKey}`,
    evaluatedAt: createdAt,
    status: 'CONDITIONAL',
    baseline: trigger.predecessor.evaluationRef,
    metrics: {
      sourceStatisticalEvaluationPassRate: 1,
      deterministicBoundaryPassRate: 1,
      candidateThresholdChangeCount: changedThresholds,
      p25Days: thresholds.p25Days,
      medianDays: thresholds.medianDays,
      p75Days: thresholds.p75Days
    },
    evidenceSummary:
      `Reproducible CN duration research ${evaluated.dataset.dataset_ref_id} passed source replay and deterministic candidate boundary checks. ` +
      'The artifact remains CANDIDATE because comparison/backtest against the exact predecessor is a separate Phase 7 gate.'
  };

  let method: BrainMethodContractV1;
  let pkg: ExecutableMethodPackageV1;
  try {
    method = parseBrainMethodContractV1({
      schemaVersion: 1,
      methodId: CANONICAL_PREDECESSOR_METHOD_ID,
      methodVersionId,
      methodFamily: CN_DURATION_BAND_METHOD_FAMILY,
      version: 2,
      purpose:
        'Candidate replacement for the governed CN completed-duration historical-band classifier using a newly reproducible duration distribution.',
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
        'candidate historical p25_days/median_days/p75_days thresholds',
        'exact candidate ResearchDatasetRefV1 lineage',
        'exact Method Improvement trigger and research-mission fingerprints'
      ],
      algorithm: executable,
      outputSchemaId: 'brain.cn-completed-duration-historical-band.v1',
      limitations,
      coverage:
        'CN / CNIPA / trademark applications / already completed filing-to-preliminary-publication elapsed-day observations / exact candidate research distribution.',
      evaluation,
      fallback: { behavior: 'NOT_APPLICABLE' },
      lineage,
      lifecycle: 'CANDIDATE',
      supersedesMethodVersionIds: [PHASE7_PILOT_A_CANONICAL_PREDECESSOR_METHOD_VERSION_ID],
      createdAt
    });
    pkg = parseExecutableMethodPackageV1({
      schemaVersion: 1,
      packageId,
      packageVersion: 1,
      methodId: CANONICAL_PREDECESSOR_METHOD_ID,
      methodVersionId,
      methodFamily: CN_DURATION_BAND_METHOD_FAMILY,
      lifecycle: 'CANDIDATE',
      selectionPriority: 0,
      applicability,
      inputSchemaId: 'brain-input.cn-completed-duration-historical-band.v1',
      outputSchemaId: 'brain.cn-completed-duration-historical-band.v1',
      executable,
      requiredData: applicability.requiredData,
      referenceDependencies: [],
      reasonCodes: {
        HISTORICAL_BAND_CLASSIFIED:
          'Completed factual duration was classified relative to candidate historical p25/median/p75 thresholds.',
        NOT_APPLICABLE:
          'Request is outside the exact completed-duration classification applicability.',
        SOURCE_EVIDENCE_MISMATCH:
          'Candidate research dataset identity or descriptive thresholds do not match lineage.',
        INVALID_COMPLETED_DURATION:
          'Observed completed duration must be a non-negative safe integer.'
      },
      fallback: { behavior: 'NOT_APPLICABLE' },
      evaluation,
      lineage,
      limitations,
      createdAt
    });
  } catch (error) {
    if (error instanceof BrainMethodContractError) {
      return fail('THRESHOLD_CONTRACT_MISMATCH', error.message, error);
    }
    throw error;
  }

  const methodFingerprintSha256 = fingerprint(method);
  const packageFingerprintSha256 = fingerprint(pkg);
  const candidateFingerprintSha256 = fingerprint({
    candidateIdentitySha256,
    methodFingerprintSha256,
    packageFingerprintSha256
  });
  return {
    schemaVersion: 1,
    triggerId: trigger.triggerId,
    researchMissionId: researchMission.researchMissionId,
    predecessor: trigger.predecessor,
    canonicalPredecessorMethodVersionId: PHASE7_PILOT_A_CANONICAL_PREDECESSOR_METHOD_VERSION_ID,
    researchDatasetRefId: evaluated.dataset.dataset_ref_id,
    candidateFingerprintSha256,
    methodFingerprintSha256,
    packageFingerprintSha256,
    method,
    package: pkg
  };
}
