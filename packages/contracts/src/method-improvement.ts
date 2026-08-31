import {
  parseBrainResearchMissionV1,
  type BrainResearchMissionV1
} from './brain-method.js';
import type {
  MethodOutcomeEvidenceId,
  MethodOutcomeEvidenceReasonCode,
  MethodOutcomeEvidenceReviewOutcome
} from './method-outcome-evidence.js';

export const methodImprovementTriggerTypes = [
  'CAPABILITY_GAP',
  'PERFORMANCE_GAP',
  'COVERAGE_GAP',
  'BRAIN_RESEARCH_DISCOVERY'
] as const;
export type MethodImprovementTriggerType = (typeof methodImprovementTriggerTypes)[number];

export type MethodImprovementTriggerId = `method-improvement-trigger_${string}`;
export type MethodImprovementResearchMissionId = `method-improvement-research-mission_${string}`;

export interface MethodImprovementPredecessorV1 {
  methodPackageRef: string;
  methodRef: string;
  methodVersionRef: string;
  evaluationRef: string;
  packageFingerprintSha256?: string;
}

export interface MethodImprovementPerformanceReportQueryV1 {
  schemaVersion: 1;
  workspaceId: string;
  methodPackageRef: string;
  methodVersionRef: string;
  segment?: Readonly<{
    kind: 'RESEARCH_DATASET' | 'IMPLEMENTATION_KEY';
    value: string;
  }>;
  watermark: Readonly<{
    admissionSequence: number;
    methodOutcomeEvidenceId: MethodOutcomeEvidenceId;
  }>;
}

export interface MethodImprovementPerformanceReportSampleV1 {
  admissionSequence: number;
  methodOutcomeEvidenceId: MethodOutcomeEvidenceId;
  reviewId: string;
  reviewVersion: number;
  outcome: MethodOutcomeEvidenceReviewOutcome;
  reason?: MethodOutcomeEvidenceReasonCode;
  admittedAt: string;
}

export interface MethodImprovementPerformanceReportCountsV1 {
  confirmed: number;
  overridden: number;
  inconclusive: number;
  methodError: number;
  inputDataError: number;
  applicabilityError: number;
  productUserPreference: number;
}

export interface MethodImprovementPerformanceReportSourceV1 {
  kind: 'CORE_METHOD_OUTCOME_REPORT_V1';
  query: Readonly<MethodImprovementPerformanceReportQueryV1>;
  admittedReviews: number;
  counts: Readonly<MethodImprovementPerformanceReportCountsV1>;
  sampleEvidenceRefs: ReadonlyArray<Readonly<MethodImprovementPerformanceReportSampleV1>>;
  reportFingerprintSha256: string;
}

export interface MethodImprovementTriggerV1 {
  schemaVersion: 1;
  triggerId: MethodImprovementTriggerId;
  workspaceId: string;
  triggerType: MethodImprovementTriggerType;
  predecessor: Readonly<MethodImprovementPredecessorV1>;
  source: Readonly<MethodImprovementPerformanceReportSourceV1>;
  reason: string;
  createdByPrincipalId: string;
  triggerFingerprintSha256: string;
  admittedAt: string;
}

export interface MethodImprovementResearchMissionV1 {
  schemaVersion: 1;
  researchMissionId: MethodImprovementResearchMissionId;
  workspaceId: string;
  triggerId: MethodImprovementTriggerId;
  triggerFingerprintSha256: string;
  predecessor: Readonly<MethodImprovementPredecessorV1>;
  mission: Readonly<BrainResearchMissionV1>;
  missionFingerprintSha256: string;
  createdByPrincipalId: string;
  createdAt: string;
}

export class MethodImprovementContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MethodImprovementContractError';
  }
}

type RecordValue = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;
const OUTCOMES = new Set<MethodOutcomeEvidenceReviewOutcome>([
  'CONFIRMED',
  'OVERRIDDEN',
  'INCONCLUSIVE'
]);
const REASONS = new Set<MethodOutcomeEvidenceReasonCode>([
  'METHOD_ERROR',
  'INPUT_DATA_ERROR',
  'APPLICABILITY_ERROR',
  'PRODUCT_USER_PREFERENCE',
  'INCONCLUSIVE_EVIDENCE'
]);

function invalid(message: string): never {
  throw new MethodImprovementContractError(message);
}

function record(value: unknown, field: string): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid(`${field} must be an object.`);
  return value as RecordValue;
}

function exactKeys(value: RecordValue, allowed: readonly string[], field: string): void {
  const supported = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !supported.has(key));
  if (unknown.length) invalid(`${field} contains unsupported fields: ${unknown.join(', ')}.`);
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string') return invalid(`${field} must be a string.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    return invalid(`${field} must contain between 1 and ${maximum} characters.`);
  return cleaned;
}

function prefixed(value: unknown, prefix: string, field: string): string {
  const cleaned = text(value, field);
  if (!cleaned.startsWith(prefix) || cleaned === prefix)
    return invalid(`${field} must start with ${prefix}.`);
  return cleaned;
}

function sha256(value: unknown, field: string): string {
  const cleaned = text(value, field, 64).toLowerCase();
  if (!SHA256.test(cleaned)) return invalid(`${field} must be a lowercase SHA-256 digest.`);
  return cleaned;
}

function workspace(value: unknown, field = 'workspaceId'): string {
  const cleaned = text(value, field, 36).toLowerCase();
  if (!UUID.test(cleaned)) return invalid(`${field} must be a canonical UUID.`);
  return cleaned;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    return invalid(`${field} must be a positive safe integer.`);
  return Number(value);
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0)
    return invalid(`${field} must be a non-negative safe integer.`);
  return Number(value);
}

function instant(value: unknown, field: string): string {
  const cleaned = text(value, field, 64);
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== cleaned)
    return invalid(`${field} must be a canonical ISO-8601 instant.`);
  return cleaned;
}

export function parseMethodImprovementPredecessorV1(
  value: unknown
): MethodImprovementPredecessorV1 {
  const predecessor = record(value, 'predecessor');
  exactKeys(
    predecessor,
    [
      'methodPackageRef',
      'methodRef',
      'methodVersionRef',
      'evaluationRef',
      'packageFingerprintSha256'
    ],
    'predecessor'
  );
  return {
    methodPackageRef: prefixed(
      predecessor.methodPackageRef,
      'brain-method-package:',
      'predecessor.methodPackageRef'
    ),
    methodRef: prefixed(predecessor.methodRef, 'brain-method:', 'predecessor.methodRef'),
    methodVersionRef: prefixed(
      predecessor.methodVersionRef,
      'brain-method-version:',
      'predecessor.methodVersionRef'
    ),
    evaluationRef: prefixed(
      predecessor.evaluationRef,
      'brain-method-evaluation:',
      'predecessor.evaluationRef'
    ),
    ...(predecessor.packageFingerprintSha256 === undefined
      ? {}
      : {
          packageFingerprintSha256: sha256(
            predecessor.packageFingerprintSha256,
            'predecessor.packageFingerprintSha256'
          )
        })
  };
}

function parseSegment(
  value: unknown
): NonNullable<MethodImprovementPerformanceReportQueryV1['segment']> {
  const segment = record(value, 'source.query.segment');
  exactKeys(segment, ['kind', 'value'], 'source.query.segment');
  if (segment.kind !== 'RESEARCH_DATASET' && segment.kind !== 'IMPLEMENTATION_KEY')
    return invalid('source.query.segment.kind is invalid.');
  const segmentValue = text(segment.value, 'source.query.segment.value');
  if (segment.kind === 'RESEARCH_DATASET' && !segmentValue.startsWith('research-dataset:'))
    return invalid('RESEARCH_DATASET segment must be a research-dataset reference.');
  return { kind: segment.kind, value: segmentValue };
}

function parseReportQuery(value: unknown): MethodImprovementPerformanceReportQueryV1 {
  const query = record(value, 'source.query');
  exactKeys(
    query,
    ['schemaVersion', 'workspaceId', 'methodPackageRef', 'methodVersionRef', 'segment', 'watermark'],
    'source.query'
  );
  if (query.schemaVersion !== 1) invalid('source.query.schemaVersion must be 1.');
  const watermark = record(query.watermark, 'source.query.watermark');
  exactKeys(
    watermark,
    ['admissionSequence', 'methodOutcomeEvidenceId'],
    'source.query.watermark'
  );
  return {
    schemaVersion: 1,
    workspaceId: workspace(query.workspaceId, 'source.query.workspaceId'),
    methodPackageRef: prefixed(
      query.methodPackageRef,
      'brain-method-package:',
      'source.query.methodPackageRef'
    ),
    methodVersionRef: prefixed(
      query.methodVersionRef,
      'brain-method-version:',
      'source.query.methodVersionRef'
    ),
    ...(query.segment === undefined ? {} : { segment: parseSegment(query.segment) }),
    watermark: {
      admissionSequence: positiveInteger(
        watermark.admissionSequence,
        'source.query.watermark.admissionSequence'
      ),
      methodOutcomeEvidenceId: prefixed(
        watermark.methodOutcomeEvidenceId,
        'method-outcome-evidence_',
        'source.query.watermark.methodOutcomeEvidenceId'
      ) as MethodOutcomeEvidenceId
    }
  };
}

function parseSample(value: unknown, index: number): MethodImprovementPerformanceReportSampleV1 {
  const field = `source.sampleEvidenceRefs[${index}]`;
  const sample = record(value, field);
  exactKeys(
    sample,
    [
      'admissionSequence',
      'methodOutcomeEvidenceId',
      'reviewId',
      'reviewVersion',
      'outcome',
      'reason',
      'admittedAt'
    ],
    field
  );
  if (typeof sample.outcome !== 'string' || !OUTCOMES.has(sample.outcome as never))
    return invalid(`${field}.outcome is invalid.`);
  if (
    sample.reason !== undefined &&
    (typeof sample.reason !== 'string' || !REASONS.has(sample.reason as never))
  )
    return invalid(`${field}.reason is invalid.`);
  if (sample.outcome === 'CONFIRMED' && sample.reason !== undefined)
    return invalid(`${field}.reason must be absent for CONFIRMED.`);
  if (sample.outcome === 'OVERRIDDEN' && sample.reason === undefined)
    return invalid(`${field}.reason is required for OVERRIDDEN.`);
  if (sample.outcome === 'INCONCLUSIVE' && sample.reason !== 'INCONCLUSIVE_EVIDENCE')
    return invalid(`${field}.reason must be INCONCLUSIVE_EVIDENCE for INCONCLUSIVE.`);
  return {
    admissionSequence: positiveInteger(sample.admissionSequence, `${field}.admissionSequence`),
    methodOutcomeEvidenceId: prefixed(
      sample.methodOutcomeEvidenceId,
      'method-outcome-evidence_',
      `${field}.methodOutcomeEvidenceId`
    ) as MethodOutcomeEvidenceId,
    reviewId: prefixed(sample.reviewId, 'matter-intelligence-review_', `${field}.reviewId`),
    reviewVersion: positiveInteger(sample.reviewVersion, `${field}.reviewVersion`),
    outcome: sample.outcome as MethodOutcomeEvidenceReviewOutcome,
    ...(sample.reason === undefined
      ? {}
      : { reason: sample.reason as MethodOutcomeEvidenceReasonCode }),
    admittedAt: instant(sample.admittedAt, `${field}.admittedAt`)
  };
}

function parseCounts(value: unknown, admittedReviews: number): MethodImprovementPerformanceReportCountsV1 {
  const counts = record(value, 'source.counts');
  const keys = [
    'confirmed',
    'overridden',
    'inconclusive',
    'methodError',
    'inputDataError',
    'applicabilityError',
    'productUserPreference'
  ] as const;
  exactKeys(counts, keys, 'source.counts');
  const parsed = Object.fromEntries(
    keys.map((key) => [key, nonNegativeInteger(counts[key], `source.counts.${key}`)])
  ) as unknown as MethodImprovementPerformanceReportCountsV1;
  if (parsed.confirmed + parsed.overridden + parsed.inconclusive !== admittedReviews)
    return invalid('source outcome counts must equal admittedReviews.');
  if (
    parsed.methodError +
      parsed.inputDataError +
      parsed.applicabilityError +
      parsed.productUserPreference >
    parsed.overridden
  )
    return invalid('source override-reason counts cannot exceed overridden count.');
  return parsed;
}

export function parseMethodImprovementPerformanceReportSourceV1(
  value: unknown
): MethodImprovementPerformanceReportSourceV1 {
  const source = record(value, 'source');
  exactKeys(
    source,
    [
      'kind',
      'query',
      'admittedReviews',
      'counts',
      'sampleEvidenceRefs',
      'reportFingerprintSha256'
    ],
    'source'
  );
  if (source.kind !== 'CORE_METHOD_OUTCOME_REPORT_V1')
    return invalid('source.kind must be CORE_METHOD_OUTCOME_REPORT_V1.');
  const admittedReviews = positiveInteger(source.admittedReviews, 'source.admittedReviews');
  if (!Array.isArray(source.sampleEvidenceRefs) || source.sampleEvidenceRefs.length > 20)
    return invalid('source.sampleEvidenceRefs must be an array with at most 20 entries.');
  return {
    kind: 'CORE_METHOD_OUTCOME_REPORT_V1',
    query: parseReportQuery(source.query),
    admittedReviews,
    counts: parseCounts(source.counts, admittedReviews),
    sampleEvidenceRefs: source.sampleEvidenceRefs.map(parseSample),
    reportFingerprintSha256: sha256(
      source.reportFingerprintSha256,
      'source.reportFingerprintSha256'
    )
  };
}

export function parseMethodImprovementTriggerV1(value: unknown): MethodImprovementTriggerV1 {
  const trigger = record(value, 'methodImprovementTrigger');
  exactKeys(
    trigger,
    [
      'schemaVersion',
      'triggerId',
      'workspaceId',
      'triggerType',
      'predecessor',
      'source',
      'reason',
      'createdByPrincipalId',
      'triggerFingerprintSha256',
      'admittedAt'
    ],
    'methodImprovementTrigger'
  );
  if (trigger.schemaVersion !== 1) invalid('methodImprovementTrigger.schemaVersion must be 1.');
  if (
    typeof trigger.triggerType !== 'string' ||
    !(methodImprovementTriggerTypes as readonly string[]).includes(trigger.triggerType)
  )
    return invalid('methodImprovementTrigger.triggerType is invalid.');
  if (trigger.triggerType !== 'PERFORMANCE_GAP')
    return invalid('V1 runtime admission currently supports PERFORMANCE_GAP only.');
  const workspaceId = workspace(trigger.workspaceId);
  const predecessor = parseMethodImprovementPredecessorV1(trigger.predecessor);
  const source = parseMethodImprovementPerformanceReportSourceV1(trigger.source);
  if (source.query.workspaceId !== workspaceId)
    return invalid('source.query.workspaceId must match trigger workspaceId.');
  if (
    source.query.methodPackageRef !== predecessor.methodPackageRef ||
    source.query.methodVersionRef !== predecessor.methodVersionRef
  )
    return invalid('source query must match predecessor package/version refs.');
  if (source.counts.methodError < 1)
    return invalid('PERFORMANCE_GAP source must contain at least one METHOD_ERROR signal.');
  return {
    schemaVersion: 1,
    triggerId: prefixed(
      trigger.triggerId,
      'method-improvement-trigger_',
      'methodImprovementTrigger.triggerId'
    ) as MethodImprovementTriggerId,
    workspaceId,
    triggerType: trigger.triggerType as MethodImprovementTriggerType,
    predecessor,
    source,
    reason: text(trigger.reason, 'methodImprovementTrigger.reason', 1000),
    createdByPrincipalId: text(
      trigger.createdByPrincipalId,
      'methodImprovementTrigger.createdByPrincipalId',
      300
    ),
    triggerFingerprintSha256: sha256(
      trigger.triggerFingerprintSha256,
      'methodImprovementTrigger.triggerFingerprintSha256'
    ),
    admittedAt: instant(trigger.admittedAt, 'methodImprovementTrigger.admittedAt')
  };
}

function samePredecessor(
  left: MethodImprovementPredecessorV1,
  right: MethodImprovementPredecessorV1
): boolean {
  return (
    left.methodPackageRef === right.methodPackageRef &&
    left.methodRef === right.methodRef &&
    left.methodVersionRef === right.methodVersionRef &&
    left.evaluationRef === right.evaluationRef &&
    left.packageFingerprintSha256 === right.packageFingerprintSha256
  );
}

export function parseMethodImprovementResearchMissionV1(
  value: unknown
): MethodImprovementResearchMissionV1 {
  const wrapper = record(value, 'methodImprovementResearchMission');
  exactKeys(
    wrapper,
    [
      'schemaVersion',
      'researchMissionId',
      'workspaceId',
      'triggerId',
      'triggerFingerprintSha256',
      'predecessor',
      'mission',
      'missionFingerprintSha256',
      'createdByPrincipalId',
      'createdAt'
    ],
    'methodImprovementResearchMission'
  );
  if (wrapper.schemaVersion !== 1)
    invalid('methodImprovementResearchMission.schemaVersion must be 1.');
  const mission = parseBrainResearchMissionV1(wrapper.mission);
  const predecessor = parseMethodImprovementPredecessorV1(wrapper.predecessor);
  const createdAt = instant(wrapper.createdAt, 'methodImprovementResearchMission.createdAt');
  if (mission.createdAt !== createdAt)
    return invalid('mission.createdAt must match methodImprovementResearchMission.createdAt.');
  return {
    schemaVersion: 1,
    researchMissionId: prefixed(
      wrapper.researchMissionId,
      'method-improvement-research-mission_',
      'methodImprovementResearchMission.researchMissionId'
    ) as MethodImprovementResearchMissionId,
    workspaceId: workspace(wrapper.workspaceId),
    triggerId: prefixed(
      wrapper.triggerId,
      'method-improvement-trigger_',
      'methodImprovementResearchMission.triggerId'
    ) as MethodImprovementTriggerId,
    triggerFingerprintSha256: sha256(
      wrapper.triggerFingerprintSha256,
      'methodImprovementResearchMission.triggerFingerprintSha256'
    ),
    predecessor,
    mission,
    missionFingerprintSha256: sha256(
      wrapper.missionFingerprintSha256,
      'methodImprovementResearchMission.missionFingerprintSha256'
    ),
    createdByPrincipalId: text(
      wrapper.createdByPrincipalId,
      'methodImprovementResearchMission.createdByPrincipalId',
      300
    ),
    createdAt
  };
}

export function assertMethodImprovementMissionBinding(
  trigger: Readonly<MethodImprovementTriggerV1>,
  mission: Readonly<MethodImprovementResearchMissionV1>
): void {
  if (
    mission.workspaceId !== trigger.workspaceId ||
    mission.triggerId !== trigger.triggerId ||
    mission.triggerFingerprintSha256 !== trigger.triggerFingerprintSha256 ||
    mission.createdByPrincipalId !== trigger.createdByPrincipalId ||
    !samePredecessor(mission.predecessor, trigger.predecessor)
  )
    invalid('Research mission wrapper does not match its immutable Method Improvement trigger.');
}
