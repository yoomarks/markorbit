import { createHash } from 'node:crypto';
import { parseMethodApplicabilityV1, type MethodApplicabilityV1 } from './brain-method.js';
import {
  parseTrademarkAssetSourceReference,
  parseTrademarkAssetSourceReadState,
  trademarkAssetSourceOwners,
  type TrademarkAssetId,
  type TrademarkAssetSourceOwner,
  type TrademarkAssetSourceReference,
  type TrademarkAssetSourceReadState
} from './trademark-asset-workspace.js';
import type { ProductLoopExactReference } from './product-loop.js';

export type TrademarkLifecycleProjectionId = `trademark-lifecycle-projection_${string}`;

export const trademarkLifecycleProcessStates = [
  'OCCURRED',
  'CURRENT',
  'UPCOMING',
  'FUTURE',
  'UNKNOWN',
  'NOT_APPLICABLE'
] as const;
export type TrademarkLifecycleProcessState = (typeof trademarkLifecycleProcessStates)[number];
export type ProcessState = TrademarkLifecycleProcessState;

export const trademarkLifecycleCoverageStates = [
  'FULL',
  'PARTIAL',
  'LIMITED_MANUAL',
  'NOT_COVERED'
] as const;
export type TrademarkLifecycleCoverageState = (typeof trademarkLifecycleCoverageStates)[number];

export const trademarkLifecycleCurrentnessStates = ['CURRENT', 'STALE', 'UNKNOWN'] as const;
export type TrademarkLifecycleCurrentnessState =
  (typeof trademarkLifecycleCurrentnessStates)[number];

export const trademarkLifecycleConflictStates = ['NONE', 'RESOLVED', 'UNRESOLVED'] as const;
export type TrademarkLifecycleConflictState = (typeof trademarkLifecycleConflictStates)[number];
export type ConflictState = TrademarkLifecycleConflictState;

export const trademarkLifecycleEvaluationStates = [
  'PRESENT',
  'COMPLETE_NONE',
  'PARTIAL',
  'UNAVAILABLE'
] as const;
export type TrademarkLifecycleEvaluationState = (typeof trademarkLifecycleEvaluationStates)[number];
export type EvaluationState = TrademarkLifecycleEvaluationState;

export const trademarkLifecycleTimeClasses = [
  'SOURCE_RECORDED',
  'REVIEWED_TIMING',
  'RULE_WINDOW',
  'PREDICTION',
  'TYPICAL_RANGE'
] as const;
export type TrademarkLifecycleTimeClass = (typeof trademarkLifecycleTimeClasses)[number];
export type TimeClass = TrademarkLifecycleTimeClass;

export const trademarkLifecycleTimePresentationMeanings = [
  'RECORDED_FACT',
  'REVIEWED_NON_CERTIFIED_TIME',
  'RULE_DERIVED_WINDOW',
  'PREDICTED_TIME',
  'TYPICAL_DURATION'
] as const;
export type TrademarkLifecycleTimePresentationMeaning =
  (typeof trademarkLifecycleTimePresentationMeanings)[number];
export const trademarkLifecyclePresentationMeaningByTimeClass = Object.freeze({
  SOURCE_RECORDED: 'RECORDED_FACT',
  REVIEWED_TIMING: 'REVIEWED_NON_CERTIFIED_TIME',
  RULE_WINDOW: 'RULE_DERIVED_WINDOW',
  PREDICTION: 'PREDICTED_TIME',
  TYPICAL_RANGE: 'TYPICAL_DURATION'
} as const satisfies Readonly<
  Record<TrademarkLifecycleTimeClass, TrademarkLifecycleTimePresentationMeaning>
>);

export const trademarkLifecycleTimeValueStates = ['AVAILABLE', 'UNKNOWN', 'CONFLICTING'] as const;
export type TrademarkLifecycleTimeValueState = (typeof trademarkLifecycleTimeValueStates)[number];

export const trademarkLifecycleTimePrecisions = ['SECOND', 'DAY', 'MONTH', 'YEAR'] as const;
export type TrademarkLifecycleTimePrecision = (typeof trademarkLifecycleTimePrecisions)[number];

export interface ExactOwnerReferenceV1 {
  owner: string;
  kind: string;
  id: string;
  version: number | string;
  fingerprintSha256?: string;
}

export type AssetReferenceV1 = ProductLoopExactReference<TrademarkAssetId>;

export interface BilingualTextV1 {
  zhCN: string;
  en: string;
}

export interface TrademarkLifecycleSemanticGlossaryEntryV1 {
  code: string;
  text: Readonly<BilingualTextV1>;
}

export interface TrackIdentityV1 {
  jurisdiction: string;
  authority: string;
  objectType: string;
  procedure: string;
  applicationOrRegistrationBasis?: string;
  trackFingerprintSha256: string;
  relatedOwnerReferences: readonly Readonly<ExactOwnerReferenceV1>[];
}

export interface SourceReadV1 {
  scopeId: string;
  owner: TrademarkAssetSourceOwner;
  state: TrademarkAssetSourceReadState;
  asOf: string;
  sourceReferences: readonly Readonly<TrademarkAssetSourceReference>[];
}

export interface TrademarkLifecycleCoverage {
  coverageEvaluationId: string;
  state: TrademarkLifecycleCoverageState;
  scopeFingerprintSha256: string;
  evaluatedAt: string;
  reasonCodes: readonly string[];
  coverageFingerprintSha256: string;
}
export type Coverage = TrademarkLifecycleCoverage;

export interface TrademarkLifecycleCurrentness {
  state: TrademarkLifecycleCurrentnessState;
  evaluatedAt: string;
  reasonCodes: readonly string[];
}
export type Currentness = TrademarkLifecycleCurrentness;

export interface CalibratedConfidenceV1 {
  probability: number;
  calibrationMethodReference: Readonly<ExactOwnerReferenceV1>;
  evaluationState: 'ADMITTED';
  evaluatedAt: string;
}

export interface TrademarkLifecyclePointTimeValueV1 {
  kind: 'POINT';
  value: string;
  precision: TrademarkLifecycleTimePrecision;
  jurisdictionTimeZone: string;
}

export interface TrademarkLifecycleIntervalTimeValueV1 {
  kind: 'INTERVAL';
  start: string;
  end: string;
  precision: TrademarkLifecycleTimePrecision;
  jurisdictionTimeZone: string;
  startInclusive: boolean;
  endInclusive: boolean;
}

export interface TrademarkLifecycleDurationRangeTimeValueV1 {
  kind: 'DURATION_RANGE';
  minimumDays: number;
  maximumDays: number;
  dayBasis: 'CALENDAR_DAYS' | 'BUSINESS_DAYS';
}

export type TrademarkLifecycleTimeValueV1 =
  | TrademarkLifecyclePointTimeValueV1
  | TrademarkLifecycleIntervalTimeValueV1
  | TrademarkLifecycleDurationRangeTimeValueV1;
export type TimeValue = TrademarkLifecycleTimeValueV1;

interface TrademarkLifecycleTimeAssertionBaseV1 {
  timeAssertionId: string;
  semanticRole: string;
  labelCode: string;
  timeClass: TrademarkLifecycleTimeClass;
  presentationMeaning: TrademarkLifecycleTimePresentationMeaning;
  asOf: string;
  currentness: TrademarkLifecycleCurrentnessState;
  sourceReferences: readonly Readonly<TrademarkAssetSourceReference>[];
  ruleReferences: readonly Readonly<ExactOwnerReferenceV1>[];
  reasonCodes: readonly string[];
  legalDeadlineCertified: false;
}

export interface TrademarkLifecycleAvailableTimeAssertionV1 extends TrademarkLifecycleTimeAssertionBaseV1 {
  valueState: 'AVAILABLE';
  value: Readonly<TrademarkLifecycleTimeValueV1>;
  confidence: Readonly<CalibratedConfidenceV1> | null;
}

export interface TrademarkLifecycleUnknownTimeAssertionV1 extends TrademarkLifecycleTimeAssertionBaseV1 {
  valueState: 'UNKNOWN';
  value: null;
  confidence: null;
}

export interface TrademarkLifecycleConflictingTimeAssertionV1 extends TrademarkLifecycleTimeAssertionBaseV1 {
  valueState: 'CONFLICTING';
  value: null;
  confidence: null;
  conflictIds: readonly string[];
}

export type TimeAssertionV1 =
  | TrademarkLifecycleAvailableTimeAssertionV1
  | TrademarkLifecycleUnknownTimeAssertionV1
  | TrademarkLifecycleConflictingTimeAssertionV1;

export type TrademarkLifecycleDestinationV1 =
  | Readonly<{
      kind: 'EVIDENCE_INSPECTION';
      reference: Readonly<ExactOwnerReferenceV1>;
    }>
  | Readonly<{
      kind: 'EXISTING_WORKBENCH';
      reference: Readonly<ExactOwnerReferenceV1>;
    }>
  | Readonly<{
      kind: 'REVIEWABLE_HANDOFF';
      reference: Readonly<ExactOwnerReferenceV1>;
    }>;

interface TrademarkLifecycleNodeBaseV1 {
  order: number;
  name: Readonly<BilingualTextV1>;
  summary: Readonly<BilingualTextV1>;
  processState: TrademarkLifecycleProcessState;
  timeAssertions: readonly Readonly<TimeAssertionV1>[];
  sourceReferences: readonly Readonly<TrademarkAssetSourceReference>[];
  ruleReferences: readonly Readonly<ExactOwnerReferenceV1>[];
  reasonCodes: readonly string[];
  limitationCodes: readonly string[];
  attentionOrRecommendationReference?: Readonly<ExactOwnerReferenceV1>;
  destinationReference?: Readonly<TrademarkLifecycleDestinationV1>;
}

export interface MilestoneV1 extends TrademarkLifecycleNodeBaseV1 {
  milestoneCode: string;
}

export interface StageV1 extends TrademarkLifecycleNodeBaseV1 {
  stageCode: string;
  milestones: readonly Readonly<MilestoneV1>[];
}

export interface TrademarkLifecycleSupportedStagePositionV1 {
  supportState: 'SUPPORTED';
  currentGranularity: 'STAGE_ONLY';
  currentStageCode: string;
  currentMilestoneCode: null;
  reasonCodes: readonly string[];
}

export interface TrademarkLifecycleSupportedMilestonePositionV1 {
  supportState: 'SUPPORTED';
  currentGranularity: 'MILESTONE';
  currentStageCode: string;
  currentMilestoneCode: string;
  reasonCodes: readonly string[];
}

export interface TrademarkLifecycleUnsupportedCurrentPositionV1 {
  supportState: 'UNKNOWN' | 'CONFLICTING';
  currentGranularity: null;
  currentStageCode: null;
  currentMilestoneCode: null;
  reasonCodes: readonly string[];
}

export type CurrentPositionV1 =
  | TrademarkLifecycleSupportedStagePositionV1
  | TrademarkLifecycleSupportedMilestonePositionV1
  | TrademarkLifecycleUnsupportedCurrentPositionV1;

export interface TrademarkLifecycleHistoricalPositionV1 {
  stageCode: string;
  milestoneCode: string | null;
  asOf: string;
}

export interface TrademarkLifecyclePresentEvaluationV1<T> {
  state: 'PRESENT';
  evaluatedAt: string;
  scopeFingerprintSha256: string;
  reasonCodes: readonly string[];
  limitationCodes: readonly [];
  dependencyReasonCodes: readonly [];
  target: Readonly<T>;
}

export interface TrademarkLifecycleCompleteNoneEvaluationV1 {
  state: 'COMPLETE_NONE';
  evaluatedAt: string;
  scopeFingerprintSha256: string;
  reasonCodes: readonly string[];
  limitationCodes: readonly [];
  dependencyReasonCodes: readonly [];
  target: null;
}

export interface TrademarkLifecyclePartialEvaluationV1 {
  state: 'PARTIAL';
  evaluatedAt: string;
  scopeFingerprintSha256: string;
  reasonCodes: readonly string[];
  limitationCodes: readonly string[];
  dependencyReasonCodes: readonly [];
  target: null;
}

export interface TrademarkLifecycleUnavailableEvaluationV1 {
  state: 'UNAVAILABLE';
  evaluatedAt: string;
  scopeFingerprintSha256: string;
  reasonCodes: readonly string[];
  limitationCodes: readonly [];
  dependencyReasonCodes: readonly string[];
  target: null;
}

export type EvaluationV1<T> =
  | TrademarkLifecyclePresentEvaluationV1<T>
  | TrademarkLifecycleCompleteNoneEvaluationV1
  | TrademarkLifecyclePartialEvaluationV1
  | TrademarkLifecycleUnavailableEvaluationV1;

export type TrademarkLifecycleNodeReferenceV1 =
  | Readonly<{ kind: 'STAGE'; stageCode: string; milestoneCode: null }>
  | Readonly<{ kind: 'MILESTONE'; stageCode: string; milestoneCode: string }>;

export interface TrademarkLifecycleTimeAssertionReferenceV1 {
  timeAssertionId: string;
}

export const trademarkLifecycleConflictTargetKinds = [
  'FIELD',
  'STAGE',
  'MILESTONE',
  'TIME_ASSERTION'
] as const;
export type TrademarkLifecycleConflictTargetKind =
  (typeof trademarkLifecycleConflictTargetKinds)[number];

export interface ConflictV1 {
  conflictId: string;
  state: 'RESOLVED' | 'UNRESOLVED';
  targetKind: TrademarkLifecycleConflictTargetKind;
  targetReference: string;
  competingReferences: readonly Readonly<ExactOwnerReferenceV1>[];
  resolutionOwner: string;
  resolutionReference: Readonly<ExactOwnerReferenceV1> | null;
  reasonCodes: readonly string[];
}

export const noTrademarkLifecycleAuthorityConsequencesV1 = Object.freeze({
  officialTruthCreated: false,
  legalDeadlineCertified: false,
  executionAuthorized: false
});
export type TrademarkLifecycleAuthorityConsequencesV1 =
  typeof noTrademarkLifecycleAuthorityConsequencesV1;

export const trademarkLifecycleRulePackAdmissionGateCodesV1 = [
  'APPLICABILITY',
  'EXECUTABLE_METHOD',
  'LEGAL_SOURCE_PROVENANCE',
  'FACT_PATH',
  'DETERMINISTIC_CONTRACT',
  'PROFESSIONAL_RESPONSIBILITY',
  'FIXTURE_MATRIX',
  'CURRENT_PRODUCTION_ADMISSION',
  'DEGRADATION',
  'FULL_USABLE_OUTPUT_COST'
] as const;
export type TrademarkLifecycleRulePackAdmissionGateCodeV1 =
  (typeof trademarkLifecycleRulePackAdmissionGateCodesV1)[number];

export const trademarkLifecycleRulePackAdmissionEvidenceStatesV1 = [
  'EVIDENCE_AVAILABLE',
  'EVIDENCE_MISSING',
  'EVIDENCE_REJECTED',
  'DEPENDENCY_UNAVAILABLE'
] as const;
export type TrademarkLifecycleRulePackAdmissionEvidenceStateV1 =
  (typeof trademarkLifecycleRulePackAdmissionEvidenceStatesV1)[number];

export interface TrademarkLifecycleRulePackAdmissionGateV1 {
  gateCode: TrademarkLifecycleRulePackAdmissionGateCodeV1;
  state: TrademarkLifecycleRulePackAdmissionEvidenceStateV1;
  evidenceReferences: readonly Readonly<ExactOwnerReferenceV1>[];
  reasonCodes: readonly string[];
}

export const trademarkLifecycleRulePackAdmissionReadinessStatusesV1 = [
  'INCOMPLETE',
  'READY_FOR_INDEPENDENT_ADMISSION_REVIEW'
] as const;
export type TrademarkLifecycleRulePackAdmissionReadinessStatusV1 =
  (typeof trademarkLifecycleRulePackAdmissionReadinessStatusesV1)[number];

export const noTrademarkLifecycleRulePackAdmissionReadinessAuthorityV1 = Object.freeze({
  rulePackAdmitted: false,
  sourceUsePromoted: false,
  methodActivated: false,
  capabilityVerified: false,
  projectionPersistenceAuthorized: false,
  productBusinessStateCreated: false,
  officialTruthCreated: false,
  legalDeadlineCertified: false,
  executionAuthorized: false
});
export type TrademarkLifecycleRulePackAdmissionReadinessAuthorityV1 =
  typeof noTrademarkLifecycleRulePackAdmissionReadinessAuthorityV1;

export interface TrademarkLifecycleRulePackAdmissionReadinessV1 {
  schemaVersion: 1;
  assessedAt: string;
  applicability: Readonly<MethodApplicabilityV1>;
  applicabilityFingerprintSha256: string;
  gates: readonly Readonly<TrademarkLifecycleRulePackAdmissionGateV1>[];
  status: TrademarkLifecycleRulePackAdmissionReadinessStatusV1;
  assessmentFingerprintSha256: string;
  authority: Readonly<TrademarkLifecycleRulePackAdmissionReadinessAuthorityV1>;
}

export type TrademarkLifecycleRulePackAdmissionReadinessFingerprintMaterialV1 = Omit<
  TrademarkLifecycleRulePackAdmissionReadinessV1,
  'assessmentFingerprintSha256'
>;

export interface TrademarkLifecycleProjectionV1 {
  schemaVersion: 1;
  projectionId: TrademarkLifecycleProjectionId;
  version: number;
  projectionFingerprintSha256: string;
  workspaceId: string;
  asset: Readonly<AssetReferenceV1>;
  normalizedInputFingerprintSha256: string;
  generatedAt: string;
  asOf: string;
  track: Readonly<TrackIdentityV1>;
  coverage: Readonly<TrademarkLifecycleCoverage>;
  currentness: Readonly<TrademarkLifecycleCurrentness>;
  conflictState: TrademarkLifecycleConflictState;
  currentPosition: Readonly<CurrentPositionV1>;
  lastUndisputedPosition: Readonly<TrademarkLifecycleHistoricalPositionV1> | null;
  stages: readonly Readonly<StageV1>[];
  sourceReads: readonly Readonly<SourceReadV1>[];
  conflicts: readonly Readonly<ConflictV1>[];
  missingInputCodes: readonly string[];
  limitationCodes: readonly string[];
  semanticGlossary: readonly Readonly<TrademarkLifecycleSemanticGlossaryEntryV1>[];
  methodPackageReference: Readonly<ExactOwnerReferenceV1>;
  materializedReferenceDependencies: readonly Readonly<ExactOwnerReferenceV1>[];
  capabilityExecution?: Readonly<ExactOwnerReferenceV1>;
  nextItemEvaluation: Readonly<EvaluationV1<TrademarkLifecycleNodeReferenceV1>>;
  recommendationEvaluation: Readonly<EvaluationV1<ExactOwnerReferenceV1>>;
  primaryTimeEvaluation: Readonly<EvaluationV1<TrademarkLifecycleTimeAssertionReferenceV1>>;
  authority: Readonly<TrademarkLifecycleAuthorityConsequencesV1>;
}

export const trademarkLifecycleSelectionStates = [
  'SELECTED',
  'MULTIPLE_CANDIDATES',
  'MISSING_INPUT',
  'UNSUPPORTED'
] as const;
export type TrademarkLifecycleSelectionState = (typeof trademarkLifecycleSelectionStates)[number];

export interface TrademarkLifecycleTrackSelectionV1 {
  state: TrademarkLifecycleSelectionState;
  candidates: readonly Readonly<TrackIdentityV1>[];
  selectedTrackFingerprintSha256: string | null;
  reasonCodes: readonly string[];
  missingInputCodes: readonly string[];
}

export const trademarkLifecycleDependencyStates = ['AVAILABLE', 'DEGRADED', 'UNAVAILABLE'] as const;
export type TrademarkLifecycleDependencyState = (typeof trademarkLifecycleDependencyStates)[number];

export const trademarkLifecycleProjectionAvailabilityStates = [
  'AVAILABLE',
  'NO_PROJECTION'
] as const;
export type TrademarkLifecycleProjectionAvailability =
  (typeof trademarkLifecycleProjectionAvailabilityStates)[number];

export const trademarkLifecycleInteractionAccessStates = [
  'ALLOWED',
  'DENIED',
  'REAUTH_REQUIRED',
  'REFRESH_REQUIRED',
  'DEPENDENCY_UNAVAILABLE'
] as const;
export type TrademarkLifecycleInteractionAccessState =
  (typeof trademarkLifecycleInteractionAccessStates)[number];

export const trademarkLifecycleInteractionOperations = [
  'INSPECT_EVIDENCE',
  'OPEN_EXISTING_WORKBENCH',
  'BEGIN_REVIEWABLE_HANDOFF'
] as const;
export type TrademarkLifecycleInteractionOperation =
  (typeof trademarkLifecycleInteractionOperations)[number];
export const trademarkLifecycleDestinationKindByOperation = Object.freeze({
  INSPECT_EVIDENCE: 'EVIDENCE_INSPECTION',
  OPEN_EXISTING_WORKBENCH: 'EXISTING_WORKBENCH',
  BEGIN_REVIEWABLE_HANDOFF: 'REVIEWABLE_HANDOFF'
} as const satisfies Readonly<
  Record<TrademarkLifecycleInteractionOperation, TrademarkLifecycleDestinationV1['kind']>
>);

export type TrademarkLifecycleInteractionTargetV1 =
  | Readonly<{
      kind: 'MILESTONE';
      stageCode: string;
      milestoneCode: string;
      ownerReference: null;
    }>
  | Readonly<{
      kind: 'RECOMMENDATION' | 'OWNER_EVIDENCE';
      stageCode: null;
      milestoneCode: null;
      ownerReference: Readonly<ExactOwnerReferenceV1>;
    }>
  | Readonly<{
      kind: 'SOURCE_EVIDENCE';
      stageCode: null;
      milestoneCode: null;
      sourceReference: Readonly<TrademarkAssetSourceReference>;
    }>;

export interface TrademarkLifecycleInteractionAccessV1 {
  interactionId: string;
  projectionReference: Readonly<{
    projectionId: TrademarkLifecycleProjectionId;
    version: number;
    projectionFingerprintSha256: string;
  }>;
  trackFingerprintSha256: string;
  target: Readonly<TrademarkLifecycleInteractionTargetV1>;
  destination: Readonly<TrademarkLifecycleDestinationV1>;
  intendedOperation: TrademarkLifecycleInteractionOperation;
  accessState: TrademarkLifecycleInteractionAccessState;
  reasonCodes: readonly string[];
  evaluatedAt: string;
  permissionPolicyVersion: string;
  entitlementPolicyVersion: string;
  executionAuthorized: false;
}

export interface TrademarkLifecycleAuthorizedReadV1 {
  schemaVersion: 1;
  status: 'AUTHORIZED_FOUND';
  evaluatedAt: string;
  workspaceId: string;
  asset: Readonly<AssetReferenceV1>;
  dependencyState: TrademarkLifecycleDependencyState;
  dependencyReasonCodes: readonly string[];
  currentness: Readonly<TrademarkLifecycleCurrentness>;
  readSemanticGlossary: readonly Readonly<TrademarkLifecycleSemanticGlossaryEntryV1>[];
  selection: Readonly<TrademarkLifecycleTrackSelectionV1>;
  projectionAvailability: TrademarkLifecycleProjectionAvailability;
  coverage: Readonly<TrademarkLifecycleCoverage>;
  projection: Readonly<TrademarkLifecycleProjectionV1> | null;
  interactionAccess: readonly Readonly<TrademarkLifecycleInteractionAccessV1>[];
}

export type TrademarkLifecycleReadResultV1 = TrademarkLifecycleAuthorizedReadV1;

export const trademarkLifecyclePrivateFailureStatuses = [
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'TRANSPORT_ERROR'
] as const;
export type TrademarkLifecyclePrivateFailureStatus =
  (typeof trademarkLifecyclePrivateFailureStatuses)[number];

export const trademarkLifecycleSafePublicReasonCodeByStatus = Object.freeze({
  UNAUTHENTICATED: 'AUTHENTICATION_REQUIRED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  FORBIDDEN: 'RESOURCE_NOT_AVAILABLE',
  NOT_FOUND: 'RESOURCE_NOT_AVAILABLE',
  TRANSPORT_ERROR: 'TEMPORARILY_UNAVAILABLE'
} as const satisfies Readonly<Record<TrademarkLifecyclePrivateFailureStatus, string>>);
export type TrademarkLifecycleSafePublicReasonCode =
  (typeof trademarkLifecycleSafePublicReasonCodeByStatus)[TrademarkLifecyclePrivateFailureStatus];

export interface TrademarkLifecyclePrivateFailureV1 {
  schemaVersion: 1;
  status: TrademarkLifecyclePrivateFailureStatus;
  evaluatedAt: string;
  retryable: boolean;
  publicReasonCode: TrademarkLifecycleSafePublicReasonCode;
}

export type TrademarkLifecycleExternalReadResponseV1 =
  TrademarkLifecycleAuthorizedReadV1 | TrademarkLifecyclePrivateFailureV1;

export class TrademarkLifecycleContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'TrademarkLifecycleContractError';
  }
}

type JsonRecord = Record<string, unknown>;
const SHA256 = /^[0-9a-f]{64}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PROJECTION_ID = /^trademark-lifecycle-projection_[A-Za-z0-9_-]+$/u;
const ASSET_ID = /^trademark-asset_[A-Za-z0-9_-]+$/u;
const STABLE_CODE = /^[A-Z][A-Z0-9_.-]{0,119}$/u;
const PLAIN_TEXT_MARKUP = /<\/?[A-Za-z][^>]*>|```|!\[[^\]]*\]\(|\[[^\]]+\]\([^)]*\)/u;

function object(value: unknown, field: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TrademarkLifecycleContractError(`${field} must be an object.`);
  }
  return value as JsonRecord;
}

function exactKeys(value: JsonRecord, expected: readonly string[], field: string): void {
  if (Object.keys(value).sort().join(',') !== [...expected].sort().join(',')) {
    throw new TrademarkLifecycleContractError(
      `${field} must contain exactly the bounded V1 fields.`
    );
  }
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string') {
    throw new TrademarkLifecycleContractError(`${field} must be a string.`);
  }
  const normalized = value.trim();
  const hasControlCharacter = [...normalized].some((character) => {
    const characterCode = character.charCodeAt(0);
    return characterCode <= 31 || characterCode === 127;
  });
  if (!normalized || normalized.length > maximum || hasControlCharacter) {
    throw new TrademarkLifecycleContractError(`${field} must be bounded non-empty text.`);
  }
  return normalized;
}

function plainText(value: unknown, field: string, maximum = 500): string {
  const normalized = text(value, field, maximum);
  if (PLAIN_TEXT_MARKUP.test(normalized)) {
    throw new TrademarkLifecycleContractError(`${field} must be plain text without markup.`);
  }
  return normalized;
}

function code(value: unknown, field: string): string {
  const normalized = text(value, field, 120);
  if (!STABLE_CODE.test(normalized)) {
    throw new TrademarkLifecycleContractError(`${field} must be a stable uppercase code.`);
  }
  return normalized;
}

function oneOf<T extends string>(value: unknown, values: readonly T[], field: string): T {
  const match =
    typeof value === 'string' ? values.find((candidate) => candidate === value) : undefined;
  if (!match) throw new TrademarkLifecycleContractError(`${field} is invalid.`);
  return match;
}

function integer(value: unknown, field: string, minimum = 1): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum) {
    throw new TrademarkLifecycleContractError(`${field} must be a safe integer >= ${minimum}.`);
  }
  return Number(value);
}

function sha256(value: unknown, field: string): string {
  if (typeof value !== 'string' || !SHA256.test(value)) {
    throw new TrademarkLifecycleContractError(`${field} must be lowercase SHA-256 hex.`);
  }
  return value;
}

function timestamp(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new TrademarkLifecycleContractError(`${field} must be a canonical ISO timestamp.`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new TrademarkLifecycleContractError(`${field} must be a canonical ISO timestamp.`);
  }
  return value;
}

function uniqueCodes(
  value: unknown,
  field: string,
  options: Readonly<{ minimum?: number; maximum?: number }> = {}
): readonly string[] {
  const minimum = options.minimum ?? 0;
  const maximum = options.maximum ?? 50;
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    throw new TrademarkLifecycleContractError(
      `${field} must contain between ${minimum} and ${maximum} codes.`
    );
  }
  const parsed = value.map((entry, index) => code(entry, `${field}[${index}]`));
  if (new Set(parsed).size !== parsed.length) {
    throw new TrademarkLifecycleContractError(`${field} must not contain duplicates.`);
  }
  return parsed;
}

function bilingual(value: unknown, field: string): BilingualTextV1 {
  const item = object(value, field);
  exactKeys(item, ['zhCN', 'en'], field);
  return {
    zhCN: plainText(item.zhCN, `${field}.zhCN`, 1_000),
    en: plainText(item.en, `${field}.en`, 1_000)
  };
}

function semanticGlossary(
  value: unknown,
  field: string
): readonly TrademarkLifecycleSemanticGlossaryEntryV1[] {
  const entries = array(value, field, 0, 300).map((entry, index) => {
    const item = object(entry, `${field}[${index}]`);
    exactKeys(item, ['code', 'text'], `${field}[${index}]`);
    return {
      code: code(item.code, `${field}[${index}].code`),
      text: bilingual(item.text, `${field}[${index}].text`)
    };
  });
  if (new Set(entries.map((entry) => entry.code)).size !== entries.length) {
    throw new TrademarkLifecycleContractError(`${field} must contain unique semantic codes.`);
  }
  return entries;
}

function validateExactSemanticCoverage(
  glossary: readonly TrademarkLifecycleSemanticGlossaryEntryV1[],
  usedCodes: Iterable<string>,
  field: string
): void {
  const used = new Set(usedCodes);
  const supplied = new Set(glossary.map((entry) => entry.code));
  if (
    [...used].some((entry) => !supplied.has(entry)) ||
    [...supplied].some((entry) => !used.has(entry))
  ) {
    throw new TrademarkLifecycleContractError(
      `${field} must resolve every used semantic code exactly once and contain no orphan code.`
    );
  }
}

function exactOwnerReference(value: unknown, field: string): ExactOwnerReferenceV1 {
  const item = object(value, field);
  exactKeys(
    item,
    [
      'owner',
      'kind',
      'id',
      'version',
      ...(item.fingerprintSha256 === undefined ? [] : ['fingerprintSha256'])
    ],
    field
  );
  const version = item.version;
  if (!(
    (Number.isSafeInteger(version) && Number(version) >= 1) ||
    (typeof version === 'string' && version.trim().length > 0 && version.trim().length <= 200)
  )) {
    throw new TrademarkLifecycleContractError(`${field}.version is invalid.`);
  }
  return {
    owner: text(item.owner, `${field}.owner`, 120),
    kind: text(item.kind, `${field}.kind`, 160),
    id: text(item.id, `${field}.id`, 500),
    version: typeof version === 'string' ? version.trim() : Number(version),
    ...(item.fingerprintSha256 === undefined
      ? {}
      : { fingerprintSha256: sha256(item.fingerprintSha256, `${field}.fingerprintSha256`) })
  };
}

function exactOwnerReferences(
  value: unknown,
  field: string,
  options: Readonly<{ minimum?: number; maximum?: number }> = {}
): readonly ExactOwnerReferenceV1[] {
  const minimum = options.minimum ?? 0;
  const maximum = options.maximum ?? 50;
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    throw new TrademarkLifecycleContractError(
      `${field} must contain between ${minimum} and ${maximum} references.`
    );
  }
  const parsed = value.map((entry, index) => exactOwnerReference(entry, `${field}[${index}]`));
  const identities = parsed.map(
    (entry) => `${entry.owner}:${entry.kind}:${entry.id}:${String(entry.version)}`
  );
  if (new Set(identities).size !== identities.length) {
    throw new TrademarkLifecycleContractError(`${field} contains duplicate exact references.`);
  }
  return parsed;
}

function lifecycleDestination(value: unknown, field: string): TrademarkLifecycleDestinationV1 {
  const item = object(value, field);
  exactKeys(item, ['kind', 'reference'], field);
  return {
    kind: oneOf(
      item.kind,
      ['EVIDENCE_INSPECTION', 'EXISTING_WORKBENCH', 'REVIEWABLE_HANDOFF'] as const,
      `${field}.kind`
    ),
    reference: exactOwnerReference(item.reference, `${field}.reference`)
  };
}

function trademarkAssetSourceVersionIdentity(
  reference: Readonly<TrademarkAssetSourceReference>
): string {
  return stableSerialize({
    owner: reference.owner,
    kind: reference.kind,
    sourceId: reference.sourceId,
    sourceVersion: reference.sourceVersion
  });
}

function trademarkAssetSourceReferences(
  value: unknown,
  field: string,
  options: Readonly<{ minimum?: number; maximum?: number }> = {}
): readonly TrademarkAssetSourceReference[] {
  const minimum = options.minimum ?? 0;
  const maximum = options.maximum ?? 50;
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    throw new TrademarkLifecycleContractError(
      `${field} must contain between ${minimum} and ${maximum} references.`
    );
  }
  const parsed = value.map((entry, index) => {
    try {
      return parseTrademarkAssetSourceReference(entry);
    } catch (error) {
      throw new TrademarkLifecycleContractError(
        `${field}[${index}] must be an exact Trademark Asset source reference: ${
          error instanceof Error ? error.message : 'invalid reference'
        }`
      );
    }
  });
  const identities = parsed.map(trademarkAssetSourceVersionIdentity);
  if (new Set(identities).size !== identities.length) {
    throw new TrademarkLifecycleContractError(
      `${field} contains duplicate exact source references.`
    );
  }
  return parsed;
}

function assetReference(value: unknown, field: string): AssetReferenceV1 {
  const item = object(value, field);
  exactKeys(item, ['id', 'version'], field);
  const id = text(item.id, `${field}.id`, 300);
  if (!ASSET_ID.test(id)) {
    throw new TrademarkLifecycleContractError(`${field}.id is invalid.`);
  }
  return {
    id: id as TrademarkAssetId,
    version: integer(item.version, `${field}.version`)
  };
}

function trackIdentity(value: unknown, field: string): TrackIdentityV1 {
  const item = object(value, field);
  exactKeys(
    item,
    [
      'jurisdiction',
      'authority',
      'objectType',
      'procedure',
      ...(item.applicationOrRegistrationBasis === undefined
        ? []
        : ['applicationOrRegistrationBasis']),
      'trackFingerprintSha256',
      'relatedOwnerReferences'
    ],
    field
  );
  return {
    jurisdiction: text(item.jurisdiction, `${field}.jurisdiction`, 80),
    authority: text(item.authority, `${field}.authority`, 160),
    objectType: text(item.objectType, `${field}.objectType`, 120),
    procedure: text(item.procedure, `${field}.procedure`, 160),
    ...(item.applicationOrRegistrationBasis === undefined
      ? {}
      : {
          applicationOrRegistrationBasis: text(
            item.applicationOrRegistrationBasis,
            `${field}.applicationOrRegistrationBasis`,
            160
          )
        }),
    trackFingerprintSha256: sha256(item.trackFingerprintSha256, `${field}.trackFingerprintSha256`),
    relatedOwnerReferences: exactOwnerReferences(
      item.relatedOwnerReferences,
      `${field}.relatedOwnerReferences`,
      { maximum: 30 }
    )
  };
}

function coverage(value: unknown, field: string): TrademarkLifecycleCoverage {
  const item = object(value, field);
  exactKeys(
    item,
    [
      'coverageEvaluationId',
      'state',
      'scopeFingerprintSha256',
      'evaluatedAt',
      'reasonCodes',
      'coverageFingerprintSha256'
    ],
    field
  );
  const state = oneOf(item.state, trademarkLifecycleCoverageStates, `${field}.state`);
  const reasonCodes = uniqueCodes(item.reasonCodes, `${field}.reasonCodes`);
  if (state !== 'FULL' && reasonCodes.length === 0) {
    throw new TrademarkLifecycleContractError(`${field} non-FULL coverage requires a reason.`);
  }
  return {
    coverageEvaluationId: text(item.coverageEvaluationId, `${field}.coverageEvaluationId`, 240),
    state,
    scopeFingerprintSha256: sha256(item.scopeFingerprintSha256, `${field}.scopeFingerprintSha256`),
    evaluatedAt: timestamp(item.evaluatedAt, `${field}.evaluatedAt`),
    reasonCodes,
    coverageFingerprintSha256: sha256(
      item.coverageFingerprintSha256,
      `${field}.coverageFingerprintSha256`
    )
  };
}

function currentness(value: unknown, field: string): TrademarkLifecycleCurrentness {
  const item = object(value, field);
  exactKeys(item, ['state', 'evaluatedAt', 'reasonCodes'], field);
  const state = oneOf(item.state, trademarkLifecycleCurrentnessStates, `${field}.state`);
  const reasonCodes = uniqueCodes(item.reasonCodes, `${field}.reasonCodes`);
  if (state !== 'CURRENT' && reasonCodes.length === 0) {
    throw new TrademarkLifecycleContractError(`${field} non-CURRENT state requires a reason.`);
  }
  return {
    state,
    evaluatedAt: timestamp(item.evaluatedAt, `${field}.evaluatedAt`),
    reasonCodes
  };
}

function sourceRead(value: unknown, field: string): SourceReadV1 {
  const item = object(value, field);
  exactKeys(item, ['scopeId', 'owner', 'state', 'asOf', 'sourceReferences'], field);
  const owner = oneOf(item.owner, trademarkAssetSourceOwners, `${field}.owner`);
  const state = parseTrademarkAssetSourceReadState(item.state);
  if (state === 'EMPTY') {
    throw new TrademarkLifecycleContractError(
      `${field} EMPTY is not admitted until the source owner exposes a typed complete exact-scope read receipt.`
    );
  }
  const sourceReferences = trademarkAssetSourceReferences(
    item.sourceReferences,
    `${field}.sourceReferences`,
    { minimum: state === 'OBSERVED' ? 1 : 0, maximum: 30 }
  );
  if (sourceReferences.some((reference) => reference.owner !== owner)) {
    throw new TrademarkLifecycleContractError(
      `${field}.sourceReferences must retain the source owner's exact references.`
    );
  }
  if (state !== 'OBSERVED' && sourceReferences.length > 0) {
    throw new TrademarkLifecycleContractError(
      `${field} ${state} cannot carry positive source references.`
    );
  }
  const asOf = timestamp(item.asOf, `${field}.asOf`);
  if (sourceReferences.some((reference) => reference.observedAt > asOf)) {
    throw new TrademarkLifecycleContractError(
      `${field}.sourceReferences cannot be observed after the exact source read.`
    );
  }
  return {
    scopeId: text(item.scopeId, `${field}.scopeId`, 240),
    owner,
    state,
    asOf,
    sourceReferences
  };
}

function temporalValue(value: unknown, precision: TrademarkLifecycleTimePrecision, field: string) {
  if (typeof value !== 'string') {
    throw new TrademarkLifecycleContractError(`${field} must match its declared precision.`);
  }
  const valid =
    (precision === 'SECOND' &&
      !Number.isNaN(new Date(value).getTime()) &&
      new Date(value).toISOString() === value) ||
    (precision === 'DAY' && /^\d{4}-\d{2}-\d{2}$/u.test(value)) ||
    (precision === 'MONTH' && /^\d{4}-\d{2}$/u.test(value)) ||
    (precision === 'YEAR' && /^\d{4}$/u.test(value));
  if (!valid) {
    throw new TrademarkLifecycleContractError(`${field} must match its declared precision.`);
  }
  if (precision === 'DAY') {
    const parsedDay = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsedDay.getTime()) || parsedDay.toISOString().slice(0, 10) !== value) {
      throw new TrademarkLifecycleContractError(`${field} must be a valid calendar day.`);
    }
  }
  if (precision === 'MONTH') {
    const month = Number(value.slice(5));
    if (month < 1 || month > 12) {
      throw new TrademarkLifecycleContractError(`${field} must be a valid calendar month.`);
    }
  }
  return value;
}

function timeZone(value: unknown, field: string): string {
  const result = text(value, field, 100);
  try {
    new Intl.DateTimeFormat('en', { timeZone: result });
  } catch {
    throw new TrademarkLifecycleContractError(`${field} must be a valid IANA time zone.`);
  }
  return result;
}

function timeValue(value: unknown, field: string): TrademarkLifecycleTimeValueV1 {
  const item = object(value, field);
  if (item.kind === 'POINT') {
    exactKeys(item, ['kind', 'value', 'precision', 'jurisdictionTimeZone'], field);
    const precision = oneOf(item.precision, trademarkLifecycleTimePrecisions, `${field}.precision`);
    return {
      kind: 'POINT',
      value: temporalValue(item.value, precision, `${field}.value`),
      precision,
      jurisdictionTimeZone: timeZone(item.jurisdictionTimeZone, `${field}.jurisdictionTimeZone`)
    };
  }
  if (item.kind === 'INTERVAL') {
    exactKeys(
      item,
      [
        'kind',
        'start',
        'end',
        'precision',
        'jurisdictionTimeZone',
        'startInclusive',
        'endInclusive'
      ],
      field
    );
    const precision = oneOf(item.precision, trademarkLifecycleTimePrecisions, `${field}.precision`);
    const start = temporalValue(item.start, precision, `${field}.start`);
    const end = temporalValue(item.end, precision, `${field}.end`);
    if (start > end) {
      throw new TrademarkLifecycleContractError(`${field}.start must not be after end.`);
    }
    if (typeof item.startInclusive !== 'boolean' || typeof item.endInclusive !== 'boolean') {
      throw new TrademarkLifecycleContractError(`${field} interval endpoints must be booleans.`);
    }
    return {
      kind: 'INTERVAL',
      start,
      end,
      precision,
      jurisdictionTimeZone: timeZone(item.jurisdictionTimeZone, `${field}.jurisdictionTimeZone`),
      startInclusive: item.startInclusive,
      endInclusive: item.endInclusive
    };
  }
  if (item.kind === 'DURATION_RANGE') {
    exactKeys(item, ['kind', 'minimumDays', 'maximumDays', 'dayBasis'], field);
    const minimumDays = integer(item.minimumDays, `${field}.minimumDays`, 0);
    const maximumDays = integer(item.maximumDays, `${field}.maximumDays`, 0);
    if (maximumDays < minimumDays) {
      throw new TrademarkLifecycleContractError(
        `${field}.maximumDays must not be less than minimumDays.`
      );
    }
    return {
      kind: 'DURATION_RANGE',
      minimumDays,
      maximumDays,
      dayBasis: oneOf(
        item.dayBasis,
        ['CALENDAR_DAYS', 'BUSINESS_DAYS'] as const,
        `${field}.dayBasis`
      )
    };
  }
  throw new TrademarkLifecycleContractError(`${field}.kind is invalid.`);
}

function calibratedConfidence(value: unknown, field: string): CalibratedConfidenceV1 {
  const item = object(value, field);
  exactKeys(
    item,
    ['probability', 'calibrationMethodReference', 'evaluationState', 'evaluatedAt'],
    field
  );
  if (
    typeof item.probability !== 'number' ||
    !Number.isFinite(item.probability) ||
    item.probability < 0 ||
    item.probability > 1
  ) {
    throw new TrademarkLifecycleContractError(`${field}.probability must be between 0 and 1.`);
  }
  if (item.evaluationState !== 'ADMITTED') {
    throw new TrademarkLifecycleContractError(`${field}.evaluationState must be ADMITTED.`);
  }
  return {
    probability: item.probability,
    calibrationMethodReference: exactOwnerReference(
      item.calibrationMethodReference,
      `${field}.calibrationMethodReference`
    ),
    evaluationState: 'ADMITTED',
    evaluatedAt: timestamp(item.evaluatedAt, `${field}.evaluatedAt`)
  };
}

function timeAssertion(value: unknown, field: string): TimeAssertionV1 {
  const item = object(value, field);
  const valueState = oneOf(
    item.valueState,
    trademarkLifecycleTimeValueStates,
    `${field}.valueState`
  );
  const expected = [
    'timeAssertionId',
    'semanticRole',
    'labelCode',
    'timeClass',
    'presentationMeaning',
    'valueState',
    'value',
    'confidence',
    ...(valueState === 'CONFLICTING' ? ['conflictIds'] : []),
    'asOf',
    'currentness',
    'sourceReferences',
    'ruleReferences',
    'reasonCodes',
    'legalDeadlineCertified'
  ];
  exactKeys(item, expected, field);
  const timeClass = oneOf(item.timeClass, trademarkLifecycleTimeClasses, `${field}.timeClass`);
  const presentationMeaning = oneOf(
    item.presentationMeaning,
    trademarkLifecycleTimePresentationMeanings,
    `${field}.presentationMeaning`
  );
  if (presentationMeaning !== trademarkLifecyclePresentationMeaningByTimeClass[timeClass]) {
    throw new TrademarkLifecycleContractError(
      `${field}.presentationMeaning must match its exact timeClass authority boundary.`
    );
  }
  if (timeClass === 'REVIEWED_TIMING') {
    throw new TrademarkLifecycleContractError(
      `${field} REVIEWED_TIMING is not admitted until an exact professional-review receipt owner contract exists.`
    );
  }
  if (item.legalDeadlineCertified !== false) {
    throw new TrademarkLifecycleContractError(
      `${field}.legalDeadlineCertified must remain false; certified deadline authority is not admitted.`
    );
  }
  const common = {
    timeAssertionId: text(item.timeAssertionId, `${field}.timeAssertionId`, 240),
    semanticRole: code(item.semanticRole, `${field}.semanticRole`),
    labelCode: code(item.labelCode, `${field}.labelCode`),
    timeClass,
    presentationMeaning,
    asOf: timestamp(item.asOf, `${field}.asOf`),
    currentness: oneOf(
      item.currentness,
      trademarkLifecycleCurrentnessStates,
      `${field}.currentness`
    ),
    sourceReferences: trademarkAssetSourceReferences(
      item.sourceReferences,
      `${field}.sourceReferences`,
      {
        minimum: 1,
        maximum: 30
      }
    ),
    ruleReferences: exactOwnerReferences(item.ruleReferences, `${field}.ruleReferences`, {
      maximum: 30
    }),
    reasonCodes: uniqueCodes(item.reasonCodes, `${field}.reasonCodes`),
    legalDeadlineCertified: false as const
  };
  if (timeClass !== 'SOURCE_RECORDED' && common.ruleReferences.length === 0) {
    throw new TrademarkLifecycleContractError(
      `${field} ${timeClass} requires an exact rule or method reference.`
    );
  }
  if (valueState === 'AVAILABLE') {
    const parsedValue = timeValue(item.value, `${field}.value`);
    if (item.confidence !== null) {
      calibratedConfidence(item.confidence, `${field}.confidence`);
      throw new TrademarkLifecycleContractError(
        `${field}.confidence is not admitted until exact calibration-method and evaluation-receipt owner contracts exist.`
      );
    }
    const confidence = null;
    if (timeClass === 'TYPICAL_RANGE' && parsedValue.kind !== 'DURATION_RANGE') {
      throw new TrademarkLifecycleContractError(
        `${field} TYPICAL_RANGE requires a DURATION_RANGE value.`
      );
    }
    if (timeClass === 'RULE_WINDOW' && parsedValue.kind !== 'INTERVAL') {
      throw new TrademarkLifecycleContractError(`${field} RULE_WINDOW requires an INTERVAL value.`);
    }
    return { ...common, valueState: 'AVAILABLE', value: parsedValue, confidence };
  }
  if (item.value !== null || item.confidence !== null) {
    throw new TrademarkLifecycleContractError(
      `${field} ${valueState} must not carry a time value or confidence.`
    );
  }
  if (common.reasonCodes.length === 0) {
    throw new TrademarkLifecycleContractError(`${field} ${valueState} requires a reason code.`);
  }
  if (valueState === 'UNKNOWN') {
    return { ...common, valueState: 'UNKNOWN', value: null, confidence: null };
  }
  const conflictIds = uniqueCodes(item.conflictIds, `${field}.conflictIds`, { minimum: 1 });
  return {
    ...common,
    valueState: 'CONFLICTING',
    value: null,
    confidence: null,
    conflictIds
  };
}

interface ParsedNodeBaseV1 {
  order: number;
  name: BilingualTextV1;
  summary: BilingualTextV1;
  processState: TrademarkLifecycleProcessState;
  timeAssertions: readonly TimeAssertionV1[];
  sourceReferences: readonly TrademarkAssetSourceReference[];
  ruleReferences: readonly ExactOwnerReferenceV1[];
  reasonCodes: readonly string[];
  limitationCodes: readonly string[];
  attentionOrRecommendationReference?: ExactOwnerReferenceV1;
  destinationReference?: TrademarkLifecycleDestinationV1;
}

function nodeBase(value: JsonRecord, field: string): ParsedNodeBaseV1 {
  const processState = oneOf(
    value.processState,
    trademarkLifecycleProcessStates,
    `${field}.processState`
  );
  const parsed: ParsedNodeBaseV1 = {
    order: integer(value.order, `${field}.order`),
    name: bilingual(value.name, `${field}.name`),
    summary: bilingual(value.summary, `${field}.summary`),
    processState,
    timeAssertions: array(value.timeAssertions, `${field}.timeAssertions`, 0, 30).map(
      (entry, index) => timeAssertion(entry, `${field}.timeAssertions[${index}]`)
    ),
    sourceReferences: trademarkAssetSourceReferences(
      value.sourceReferences,
      `${field}.sourceReferences`,
      {
        minimum: 1,
        maximum: 30
      }
    ),
    ruleReferences: exactOwnerReferences(value.ruleReferences, `${field}.ruleReferences`, {
      minimum: 1,
      maximum: 30
    }),
    reasonCodes: uniqueCodes(value.reasonCodes, `${field}.reasonCodes`),
    limitationCodes: uniqueCodes(value.limitationCodes, `${field}.limitationCodes`),
    ...(value.attentionOrRecommendationReference === undefined
      ? {}
      : {
          attentionOrRecommendationReference: exactOwnerReference(
            value.attentionOrRecommendationReference,
            `${field}.attentionOrRecommendationReference`
          )
        }),
    ...(value.destinationReference === undefined
      ? {}
      : {
          destinationReference: lifecycleDestination(
            value.destinationReference,
            `${field}.destinationReference`
          )
        })
  };
  if (
    processState === 'NOT_APPLICABLE' &&
    (parsed.attentionOrRecommendationReference !== undefined ||
      parsed.destinationReference !== undefined)
  ) {
    throw new TrademarkLifecycleContractError(
      `${field} NOT_APPLICABLE nodes cannot carry recommendation or destination references.`
    );
  }
  return parsed;
}

function array(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number
): readonly unknown[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    throw new TrademarkLifecycleContractError(
      `${field} must contain between ${minimum} and ${maximum} items.`
    );
  }
  return value;
}

function milestone(value: unknown, field: string): MilestoneV1 {
  const item = object(value, field);
  exactKeys(
    item,
    [
      'milestoneCode',
      'order',
      'name',
      'summary',
      'processState',
      'timeAssertions',
      'sourceReferences',
      'ruleReferences',
      'reasonCodes',
      'limitationCodes',
      ...(item.attentionOrRecommendationReference === undefined
        ? []
        : ['attentionOrRecommendationReference']),
      ...(item.destinationReference === undefined ? [] : ['destinationReference'])
    ],
    field
  );
  return {
    milestoneCode: code(item.milestoneCode, `${field}.milestoneCode`),
    ...nodeBase(item, field)
  };
}

function stage(value: unknown, field: string): StageV1 {
  const item = object(value, field);
  exactKeys(
    item,
    [
      'stageCode',
      'order',
      'name',
      'summary',
      'processState',
      'timeAssertions',
      'sourceReferences',
      'ruleReferences',
      'reasonCodes',
      'limitationCodes',
      ...(item.attentionOrRecommendationReference === undefined
        ? []
        : ['attentionOrRecommendationReference']),
      ...(item.destinationReference === undefined ? [] : ['destinationReference']),
      'milestones'
    ],
    field
  );
  const milestones = array(item.milestones, `${field}.milestones`, 0, 100).map((entry, index) =>
    milestone(entry, `${field}.milestones[${index}]`)
  );
  assertUniqueOrdered(
    milestones,
    (entry) => entry.milestoneCode,
    (entry) => entry.order,
    `${field}.milestones`
  );
  const parsed = {
    stageCode: code(item.stageCode, `${field}.stageCode`),
    ...nodeBase(item, field),
    milestones
  };
  if (
    parsed.processState === 'NOT_APPLICABLE' &&
    parsed.milestones.some((entry) => entry.processState !== 'NOT_APPLICABLE')
  ) {
    throw new TrademarkLifecycleContractError(
      `${field} NOT_APPLICABLE stage may contain only NOT_APPLICABLE milestones.`
    );
  }
  return parsed;
}

function assertUniqueOrdered<T>(
  values: readonly T[],
  identity: (value: T) => string,
  order: (value: T) => number,
  field: string
): void {
  const identities = values.map(identity);
  const orders = values.map(order);
  if (new Set(identities).size !== identities.length) {
    throw new TrademarkLifecycleContractError(`${field} codes must be unique.`);
  }
  if (new Set(orders).size !== orders.length) {
    throw new TrademarkLifecycleContractError(`${field} orders must be unique.`);
  }
  if (orders.some((entry, index) => index > 0 && entry <= (orders[index - 1] ?? 0))) {
    throw new TrademarkLifecycleContractError(`${field} must be strictly ordered by order.`);
  }
}

function currentPosition(value: unknown, field: string): CurrentPositionV1 {
  const item = object(value, field);
  exactKeys(
    item,
    [
      'supportState',
      'currentGranularity',
      'currentStageCode',
      'currentMilestoneCode',
      'reasonCodes'
    ],
    field
  );
  const supportState = oneOf(
    item.supportState,
    ['SUPPORTED', 'UNKNOWN', 'CONFLICTING'] as const,
    `${field}.supportState`
  );
  const reasonCodes = uniqueCodes(item.reasonCodes, `${field}.reasonCodes`);
  if (supportState === 'SUPPORTED') {
    const currentGranularity = oneOf(
      item.currentGranularity,
      ['STAGE_ONLY', 'MILESTONE'] as const,
      `${field}.currentGranularity`
    );
    const currentStageCode = code(item.currentStageCode, `${field}.currentStageCode`);
    if (currentGranularity === 'STAGE_ONLY') {
      if (item.currentMilestoneCode !== null) {
        throw new TrademarkLifecycleContractError(
          `${field} STAGE_ONLY position requires currentMilestoneCode null.`
        );
      }
      return {
        supportState: 'SUPPORTED',
        currentGranularity: 'STAGE_ONLY',
        currentStageCode,
        currentMilestoneCode: null,
        reasonCodes
      };
    }
    return {
      supportState: 'SUPPORTED',
      currentGranularity: 'MILESTONE',
      currentStageCode,
      currentMilestoneCode: code(item.currentMilestoneCode, `${field}.currentMilestoneCode`),
      reasonCodes
    };
  }
  if (
    item.currentGranularity !== null ||
    item.currentStageCode !== null ||
    item.currentMilestoneCode !== null ||
    reasonCodes.length === 0
  ) {
    throw new TrademarkLifecycleContractError(
      `${field} ${supportState} must have null current references and at least one reason.`
    );
  }
  return {
    supportState,
    currentGranularity: null,
    currentStageCode: null,
    currentMilestoneCode: null,
    reasonCodes
  };
}

function historicalPosition(value: unknown, field: string): TrademarkLifecycleHistoricalPositionV1 {
  const item = object(value, field);
  exactKeys(item, ['stageCode', 'milestoneCode', 'asOf'], field);
  return {
    stageCode: code(item.stageCode, `${field}.stageCode`),
    milestoneCode:
      item.milestoneCode === null ? null : code(item.milestoneCode, `${field}.milestoneCode`),
    asOf: timestamp(item.asOf, `${field}.asOf`)
  };
}

function nodeReference(value: unknown, field: string): TrademarkLifecycleNodeReferenceV1 {
  const item = object(value, field);
  exactKeys(item, ['kind', 'stageCode', 'milestoneCode'], field);
  if (item.kind === 'STAGE') {
    if (item.milestoneCode !== null) {
      throw new TrademarkLifecycleContractError(`${field} STAGE target requires null milestone.`);
    }
    return {
      kind: 'STAGE',
      stageCode: code(item.stageCode, `${field}.stageCode`),
      milestoneCode: null
    };
  }
  if (item.kind === 'MILESTONE') {
    return {
      kind: 'MILESTONE',
      stageCode: code(item.stageCode, `${field}.stageCode`),
      milestoneCode: code(item.milestoneCode, `${field}.milestoneCode`)
    };
  }
  throw new TrademarkLifecycleContractError(`${field}.kind is invalid.`);
}

function timeAssertionReference(
  value: unknown,
  field: string
): TrademarkLifecycleTimeAssertionReferenceV1 {
  const item = object(value, field);
  exactKeys(item, ['timeAssertionId'], field);
  return { timeAssertionId: text(item.timeAssertionId, `${field}.timeAssertionId`, 240) };
}

function evaluation<T>(
  value: unknown,
  field: string,
  parseTarget: (value: unknown, field: string) => T
): EvaluationV1<T> {
  const item = object(value, field);
  exactKeys(
    item,
    [
      'state',
      'evaluatedAt',
      'scopeFingerprintSha256',
      'reasonCodes',
      'limitationCodes',
      'dependencyReasonCodes',
      'target'
    ],
    field
  );
  const state = oneOf(item.state, trademarkLifecycleEvaluationStates, `${field}.state`);
  const common = {
    evaluatedAt: timestamp(item.evaluatedAt, `${field}.evaluatedAt`),
    scopeFingerprintSha256: sha256(item.scopeFingerprintSha256, `${field}.scopeFingerprintSha256`),
    reasonCodes: uniqueCodes(item.reasonCodes, `${field}.reasonCodes`)
  };
  const limitationCodes = uniqueCodes(item.limitationCodes, `${field}.limitationCodes`);
  const dependencyReasonCodes = uniqueCodes(
    item.dependencyReasonCodes,
    `${field}.dependencyReasonCodes`
  );
  if (state === 'PRESENT') {
    if (limitationCodes.length > 0 || dependencyReasonCodes.length > 0 || item.target === null) {
      throw new TrademarkLifecycleContractError(
        `${field} PRESENT requires a target and no limitation/dependency reasons.`
      );
    }
    return {
      state: 'PRESENT',
      ...common,
      limitationCodes: [],
      dependencyReasonCodes: [],
      target: parseTarget(item.target, `${field}.target`)
    };
  }
  if (item.target !== null) {
    throw new TrademarkLifecycleContractError(`${field} ${state} requires target null.`);
  }
  if (state === 'COMPLETE_NONE') {
    if (limitationCodes.length > 0 || dependencyReasonCodes.length > 0) {
      throw new TrademarkLifecycleContractError(
        `${field} COMPLETE_NONE cannot carry limitation/dependency reasons.`
      );
    }
    return {
      state: 'COMPLETE_NONE',
      ...common,
      limitationCodes: [],
      dependencyReasonCodes: [],
      target: null
    };
  }
  if (state === 'PARTIAL') {
    if (limitationCodes.length === 0 || dependencyReasonCodes.length > 0) {
      throw new TrademarkLifecycleContractError(
        `${field} PARTIAL requires limitations and no dependency reasons.`
      );
    }
    return {
      state: 'PARTIAL',
      ...common,
      limitationCodes,
      dependencyReasonCodes: [],
      target: null
    };
  }
  if (dependencyReasonCodes.length === 0 || limitationCodes.length > 0) {
    throw new TrademarkLifecycleContractError(
      `${field} UNAVAILABLE requires dependency reasons and no limitations.`
    );
  }
  return {
    state: 'UNAVAILABLE',
    ...common,
    limitationCodes: [],
    dependencyReasonCodes,
    target: null
  };
}

function conflict(value: unknown, field: string): ConflictV1 {
  const item = object(value, field);
  exactKeys(
    item,
    [
      'conflictId',
      'state',
      'targetKind',
      'targetReference',
      'competingReferences',
      'resolutionOwner',
      'resolutionReference',
      'reasonCodes'
    ],
    field
  );
  const state = oneOf(item.state, ['RESOLVED', 'UNRESOLVED'] as const, `${field}.state`);
  const resolutionReference =
    item.resolutionReference === null
      ? null
      : exactOwnerReference(item.resolutionReference, `${field}.resolutionReference`);
  if ((state === 'RESOLVED') !== (resolutionReference !== null)) {
    throw new TrademarkLifecycleContractError(
      `${field} RESOLVED requires a resolution receipt and UNRESOLVED forbids one.`
    );
  }
  const reasonCodes = uniqueCodes(item.reasonCodes, `${field}.reasonCodes`, { minimum: 1 });
  return {
    conflictId: code(item.conflictId, `${field}.conflictId`),
    state,
    targetKind: oneOf(
      item.targetKind,
      trademarkLifecycleConflictTargetKinds,
      `${field}.targetKind`
    ),
    targetReference: text(item.targetReference, `${field}.targetReference`, 300),
    competingReferences: exactOwnerReferences(
      item.competingReferences,
      `${field}.competingReferences`,
      { minimum: 2, maximum: 20 }
    ),
    resolutionOwner: text(item.resolutionOwner, `${field}.resolutionOwner`, 120),
    resolutionReference,
    reasonCodes
  };
}

function authority(value: unknown): TrademarkLifecycleAuthorityConsequencesV1 {
  const item = object(value, 'projection.authority');
  exactKeys(item, Object.keys(noTrademarkLifecycleAuthorityConsequencesV1), 'projection.authority');
  for (const key of Object.keys(noTrademarkLifecycleAuthorityConsequencesV1) as Array<
    keyof TrademarkLifecycleAuthorityConsequencesV1
  >) {
    if (item[key] !== false) {
      throw new TrademarkLifecycleContractError(`projection.authority.${key} must remain false.`);
    }
  }
  return noTrademarkLifecycleAuthorityConsequencesV1;
}

export type TrademarkLifecycleProjectionFingerprintMaterialV1 = Omit<
  TrademarkLifecycleProjectionV1,
  'projectionFingerprintSha256'
>;

const PROJECTION_MATERIAL_KEYS = [
  'schemaVersion',
  'projectionId',
  'version',
  'workspaceId',
  'asset',
  'normalizedInputFingerprintSha256',
  'generatedAt',
  'asOf',
  'track',
  'coverage',
  'currentness',
  'conflictState',
  'currentPosition',
  'lastUndisputedPosition',
  'stages',
  'sourceReads',
  'conflicts',
  'missingInputCodes',
  'limitationCodes',
  'semanticGlossary',
  'methodPackageReference',
  'materializedReferenceDependencies',
  'nextItemEvaluation',
  'recommendationEvaluation',
  'primaryTimeEvaluation',
  'authority'
] as const;

function parseProjectionMaterial(
  value: unknown
): TrademarkLifecycleProjectionFingerprintMaterialV1 {
  const item = object(value, 'trademarkLifecycleProjection');
  exactKeys(
    item,
    [
      ...PROJECTION_MATERIAL_KEYS,
      ...(item.capabilityExecution === undefined ? [] : ['capabilityExecution'])
    ],
    'trademarkLifecycleProjection'
  );
  if (item.schemaVersion !== 1) {
    throw new TrademarkLifecycleContractError('Projection schemaVersion must be 1.');
  }
  const projectionId = text(item.projectionId, 'projection.projectionId', 300);
  if (!PROJECTION_ID.test(projectionId)) {
    throw new TrademarkLifecycleContractError('projection.projectionId is invalid.');
  }
  const workspaceId = text(item.workspaceId, 'projection.workspaceId', 80).toLowerCase();
  if (!UUID.test(workspaceId)) {
    throw new TrademarkLifecycleContractError(
      'projection.workspaceId must be a Core Workspace UUID.'
    );
  }
  const generatedAt = timestamp(item.generatedAt, 'projection.generatedAt');
  const asOf = timestamp(item.asOf, 'projection.asOf');
  if (generatedAt < asOf) {
    throw new TrademarkLifecycleContractError('projection.generatedAt must not precede asOf.');
  }
  const parsedTrack = trackIdentity(item.track, 'projection.track');
  const parsedStages = array(item.stages, 'projection.stages', 1, 30).map((entry, index) =>
    stage(entry, `projection.stages[${index}]`)
  );
  assertUniqueOrdered(
    parsedStages,
    (entry) => entry.stageCode,
    (entry) => entry.order,
    'projection.stages'
  );
  const allMilestones = parsedStages.flatMap((entry) => entry.milestones);
  if (new Set(allMilestones.map((entry) => entry.milestoneCode)).size !== allMilestones.length) {
    throw new TrademarkLifecycleContractError(
      'projection milestoneCode values must be unique across the exact track.'
    );
  }
  const allTimeAssertions = [
    ...parsedStages.flatMap((entry) => entry.timeAssertions),
    ...allMilestones.flatMap((entry) => entry.timeAssertions)
  ];
  if (
    new Set(allTimeAssertions.map((entry) => entry.timeAssertionId)).size !==
    allTimeAssertions.length
  ) {
    throw new TrademarkLifecycleContractError(
      'projection timeAssertionId values must be unique across the exact track.'
    );
  }
  const parsedCurrentPosition = currentPosition(item.currentPosition, 'projection.currentPosition');
  validateCurrentPosition(parsedCurrentPosition, parsedStages);
  const parsedLastPosition =
    item.lastUndisputedPosition === null
      ? null
      : historicalPosition(item.lastUndisputedPosition, 'projection.lastUndisputedPosition');
  if (parsedLastPosition !== null) {
    validateHistoricalPosition(parsedLastPosition, parsedStages);
    if (parsedCurrentPosition.supportState === 'SUPPORTED') {
      throw new TrademarkLifecycleContractError(
        'lastUndisputedPosition is reserved for UNKNOWN or CONFLICTING current position.'
      );
    }
  }
  const parsedConflicts = array(item.conflicts, 'projection.conflicts', 0, 50).map((entry, index) =>
    conflict(entry, `projection.conflicts[${index}]`)
  );
  if (new Set(parsedConflicts.map((entry) => entry.conflictId)).size !== parsedConflicts.length) {
    throw new TrademarkLifecycleContractError(
      'projection.conflicts conflictId values must be unique.'
    );
  }
  const conflictState = oneOf(
    item.conflictState,
    trademarkLifecycleConflictStates,
    'projection.conflictState'
  );
  validateConflicts(
    conflictState,
    parsedConflicts,
    parsedStages,
    allTimeAssertions,
    parsedCurrentPosition
  );
  if (parsedCurrentPosition.supportState === 'CONFLICTING' && conflictState !== 'UNRESOLVED') {
    throw new TrademarkLifecycleContractError(
      'CONFLICTING current position requires at least one unresolved conflict.'
    );
  }
  const parsedCoverage = coverage(item.coverage, 'projection.coverage');
  if (parsedCoverage.scopeFingerprintSha256 !== parsedTrack.trackFingerprintSha256) {
    throw new TrademarkLifecycleContractError(
      'projection.coverage must bind the exact selected track scope.'
    );
  }
  const parsedCurrentness = currentness(item.currentness, 'projection.currentness');
  const missingInputCodes = uniqueCodes(item.missingInputCodes, 'projection.missingInputCodes');
  const limitationCodes = uniqueCodes(item.limitationCodes, 'projection.limitationCodes');
  const parsedSemanticGlossary = semanticGlossary(
    item.semanticGlossary,
    'projection.semanticGlossary'
  );
  if (parsedCoverage.state === 'FULL' && missingInputCodes.length > 0) {
    throw new TrademarkLifecycleContractError(
      'FULL coverage cannot carry unresolved required missing inputs.'
    );
  }
  if (
    parsedCoverage.state === 'NOT_COVERED' &&
    (parsedCurrentness.state === 'CURRENT' || limitationCodes.length === 0)
  ) {
    throw new TrademarkLifecycleContractError(
      'A retained NOT_COVERED projection must be last-known and state its limitations.'
    );
  }
  const parsedSourceReads = array(item.sourceReads, 'projection.sourceReads', 1, 50).map(
    (entry, index) => sourceRead(entry, `projection.sourceReads[${index}]`)
  );
  const sourceScopeKeys = parsedSourceReads.map((entry) => `${entry.owner}:${entry.scopeId}`);
  if (new Set(sourceScopeKeys).size !== sourceScopeKeys.length) {
    throw new TrademarkLifecycleContractError(
      'projection.sourceReads must contain unique exact owner/scope reads.'
    );
  }
  const admittedSourceReferences = new Set(
    parsedSourceReads.flatMap((entry) => entry.sourceReferences).map(stableSerialize)
  );
  const carriedSourceReferences = parsedStages.flatMap((stageItem) => [
    ...stageItem.sourceReferences,
    ...stageItem.timeAssertions.flatMap((assertion) => assertion.sourceReferences),
    ...stageItem.milestones.flatMap((milestoneItem) => [
      ...milestoneItem.sourceReferences,
      ...milestoneItem.timeAssertions.flatMap((assertion) => assertion.sourceReferences)
    ])
  ]);
  if (
    carriedSourceReferences.some(
      (sourceReference) => !admittedSourceReferences.has(stableSerialize(sourceReference))
    )
  ) {
    throw new TrademarkLifecycleContractError(
      'Every node and time source reference must be admitted by an exact projection source read.'
    );
  }
  const nextItemEvaluation = evaluation(
    item.nextItemEvaluation,
    'projection.nextItemEvaluation',
    nodeReference
  );
  const recommendationEvaluation = evaluation(
    item.recommendationEvaluation,
    'projection.recommendationEvaluation',
    exactOwnerReference
  );
  const primaryTimeEvaluation = evaluation(
    item.primaryTimeEvaluation,
    'projection.primaryTimeEvaluation',
    timeAssertionReference
  );
  validateEvaluations(
    nextItemEvaluation,
    recommendationEvaluation,
    primaryTimeEvaluation,
    parsedStages,
    allTimeAssertions,
    parsedCoverage,
    parsedCoverage.scopeFingerprintSha256
  );
  const projectionSemanticCodes = [
    ...parsedCoverage.reasonCodes,
    ...parsedCurrentness.reasonCodes,
    ...parsedCurrentPosition.reasonCodes,
    ...missingInputCodes,
    ...limitationCodes,
    ...parsedConflicts.flatMap((entry) => entry.reasonCodes),
    ...parsedStages.flatMap((stageItem) => [
      ...stageItem.reasonCodes,
      ...stageItem.limitationCodes,
      ...stageItem.timeAssertions.flatMap((assertion) => [
        assertion.labelCode,
        ...assertion.reasonCodes
      ]),
      ...stageItem.milestones.flatMap((milestoneItem) => [
        ...milestoneItem.reasonCodes,
        ...milestoneItem.limitationCodes,
        ...milestoneItem.timeAssertions.flatMap((assertion) => [
          assertion.labelCode,
          ...assertion.reasonCodes
        ])
      ])
    ]),
    ...[nextItemEvaluation, recommendationEvaluation, primaryTimeEvaluation].flatMap((entry) => [
      ...entry.reasonCodes,
      ...entry.limitationCodes,
      ...entry.dependencyReasonCodes
    ])
  ];
  validateExactSemanticCoverage(
    parsedSemanticGlossary,
    projectionSemanticCodes,
    'projection.semanticGlossary'
  );
  validateProjectionTemporalBounds({
    generatedAt,
    asOf,
    coverage: parsedCoverage,
    currentness: parsedCurrentness,
    stages: parsedStages,
    sourceReads: parsedSourceReads,
    lastUndisputedPosition: parsedLastPosition,
    evaluations: [nextItemEvaluation, recommendationEvaluation, primaryTimeEvaluation]
  });
  const materializedReferenceDependencies = exactOwnerReferences(
    item.materializedReferenceDependencies,
    'projection.materializedReferenceDependencies',
    { minimum: 1, maximum: 50 }
  );
  const methodPackageReference = exactOwnerReference(
    item.methodPackageReference,
    'projection.methodPackageReference'
  );
  const admittedRuleReferences = [methodPackageReference, ...materializedReferenceDependencies];
  const carriedRuleReferences = parsedStages.flatMap((stageItem) => [
    ...stageItem.ruleReferences,
    ...stageItem.timeAssertions.flatMap((assertion) => assertion.ruleReferences),
    ...stageItem.milestones.flatMap((milestoneItem) => [
      ...milestoneItem.ruleReferences,
      ...milestoneItem.timeAssertions.flatMap((assertion) => assertion.ruleReferences)
    ])
  ]);
  if (
    carriedRuleReferences.some(
      (ruleReference) =>
        !admittedRuleReferences.some((entry) => sameOwnerReference(entry, ruleReference))
    )
  ) {
    throw new TrademarkLifecycleContractError(
      'Every node and time rule reference must match the Method package or an exact materialized dependency.'
    );
  }
  return {
    schemaVersion: 1,
    projectionId: projectionId as TrademarkLifecycleProjectionId,
    version: integer(item.version, 'projection.version'),
    workspaceId,
    asset: assetReference(item.asset, 'projection.asset'),
    normalizedInputFingerprintSha256: sha256(
      item.normalizedInputFingerprintSha256,
      'projection.normalizedInputFingerprintSha256'
    ),
    generatedAt,
    asOf,
    track: parsedTrack,
    coverage: parsedCoverage,
    currentness: parsedCurrentness,
    conflictState,
    currentPosition: parsedCurrentPosition,
    lastUndisputedPosition: parsedLastPosition,
    stages: parsedStages,
    sourceReads: parsedSourceReads,
    conflicts: parsedConflicts,
    missingInputCodes,
    limitationCodes,
    semanticGlossary: parsedSemanticGlossary,
    methodPackageReference,
    materializedReferenceDependencies,
    ...(item.capabilityExecution === undefined
      ? {}
      : {
          capabilityExecution: exactOwnerReference(
            item.capabilityExecution,
            'projection.capabilityExecution'
          )
        }),
    nextItemEvaluation,
    recommendationEvaluation,
    primaryTimeEvaluation,
    authority: authority(item.authority)
  };
}

function validateCurrentPosition(position: CurrentPositionV1, stages: readonly StageV1[]): void {
  const currentStages = stages.filter((entry) => entry.processState === 'CURRENT');
  const currentMilestones = stages.flatMap((stageItem) =>
    stageItem.milestones
      .filter((entry) => entry.processState === 'CURRENT')
      .map((entry) => ({ stage: stageItem, milestone: entry }))
  );
  if (position.supportState !== 'SUPPORTED') {
    if (currentStages.length > 0 || currentMilestones.length > 0) {
      throw new TrademarkLifecycleContractError(
        `${position.supportState} position cannot expose a CURRENT stage or milestone.`
      );
    }
    return;
  }
  if (currentStages.length !== 1 || currentStages[0]?.stageCode !== position.currentStageCode) {
    throw new TrademarkLifecycleContractError(
      'SUPPORTED position requires exactly one matching CURRENT stage.'
    );
  }
  if (position.currentGranularity === 'STAGE_ONLY') {
    if (currentMilestones.length !== 0) {
      throw new TrademarkLifecycleContractError(
        'STAGE_ONLY position requires zero CURRENT milestones.'
      );
    }
    return;
  }
  if (
    currentMilestones.length !== 1 ||
    currentMilestones[0]?.stage.stageCode !== position.currentStageCode ||
    currentMilestones[0]?.milestone.milestoneCode !== position.currentMilestoneCode
  ) {
    throw new TrademarkLifecycleContractError(
      'MILESTONE position requires exactly one matching CURRENT milestone inside the CURRENT stage.'
    );
  }
}

function validateHistoricalPosition(
  position: TrademarkLifecycleHistoricalPositionV1,
  stages: readonly StageV1[]
): void {
  const stageItem = stages.find((entry) => entry.stageCode === position.stageCode);
  if (!stageItem) {
    throw new TrademarkLifecycleContractError('lastUndisputedPosition has a dangling stageCode.');
  }
  if (
    position.milestoneCode !== null &&
    !stageItem.milestones.some((entry) => entry.milestoneCode === position.milestoneCode)
  ) {
    throw new TrademarkLifecycleContractError(
      'lastUndisputedPosition has a dangling milestoneCode.'
    );
  }
  const historicalNode =
    position.milestoneCode === null
      ? stageItem
      : stageItem.milestones.find((entry) => entry.milestoneCode === position.milestoneCode);
  if (historicalNode?.processState !== 'OCCURRED') {
    throw new TrademarkLifecycleContractError(
      'lastUndisputedPosition must reference an OCCURRED historical stage or milestone.'
    );
  }
}

function validateConflicts(
  state: TrademarkLifecycleConflictState,
  conflicts: readonly ConflictV1[],
  stages: readonly StageV1[],
  timeAssertions: readonly TimeAssertionV1[],
  position: CurrentPositionV1
): void {
  if (state === 'NONE' && conflicts.length !== 0) {
    throw new TrademarkLifecycleContractError(
      'NONE conflict state requires an empty conflict list.'
    );
  }
  if (
    state === 'RESOLVED' &&
    (conflicts.length === 0 || conflicts.some((x) => x.state !== 'RESOLVED'))
  ) {
    throw new TrademarkLifecycleContractError(
      'RESOLVED conflict state requires at least one conflict and all resolution receipts.'
    );
  }
  if (state === 'UNRESOLVED' && !conflicts.some((entry) => entry.state === 'UNRESOLVED')) {
    throw new TrademarkLifecycleContractError(
      'UNRESOLVED conflict state requires an unresolved conflict.'
    );
  }
  const stageCodes = new Set(stages.map((entry) => entry.stageCode));
  const milestoneReferences = new Set(
    stages.flatMap((entry) =>
      entry.milestones.map((milestoneItem) => `${entry.stageCode}/${milestoneItem.milestoneCode}`)
    )
  );
  const assertionIds = new Set(timeAssertions.map((entry) => entry.timeAssertionId));
  for (const item of conflicts) {
    if (item.targetKind === 'STAGE' && !stageCodes.has(item.targetReference)) {
      throw new TrademarkLifecycleContractError('Conflict has a dangling stage target.');
    }
    if (item.targetKind === 'MILESTONE' && !milestoneReferences.has(item.targetReference)) {
      throw new TrademarkLifecycleContractError('Conflict has a dangling milestone target.');
    }
    if (item.targetKind === 'TIME_ASSERTION' && !assertionIds.has(item.targetReference)) {
      throw new TrademarkLifecycleContractError('Conflict has a dangling time assertion target.');
    }
  }
  for (const assertion of timeAssertions) {
    const exactUnresolvedConflicts = conflicts.filter(
      (entry) =>
        entry.state === 'UNRESOLVED' &&
        entry.targetKind === 'TIME_ASSERTION' &&
        entry.targetReference === assertion.timeAssertionId
    );
    if (assertion.valueState === 'CONFLICTING') {
      if (
        assertion.conflictIds.some(
          (id) => !exactUnresolvedConflicts.some((entry) => entry.conflictId === id)
        )
      ) {
        throw new TrademarkLifecycleContractError(
          'A conflicting time assertion must reference only unresolved conflicts targeting itself.'
        );
      }
      if (
        exactUnresolvedConflicts.some((entry) => !assertion.conflictIds.includes(entry.conflictId))
      ) {
        throw new TrademarkLifecycleContractError(
          'Every unresolved time conflict must be carried by its exact conflicting assertion.'
        );
      }
    } else if (exactUnresolvedConflicts.length > 0) {
      throw new TrademarkLifecycleContractError(
        'An unresolved time conflict requires its exact assertion to be CONFLICTING.'
      );
    }
  }
  const currentPositionConflicts = conflicts.filter(
    (entry) =>
      entry.state === 'UNRESOLVED' &&
      entry.targetKind === 'FIELD' &&
      entry.targetReference === 'currentPosition'
  );
  if ((position.supportState === 'CONFLICTING') !== currentPositionConflicts.length > 0) {
    throw new TrademarkLifecycleContractError(
      'CONFLICTING current position must be backed by an unresolved conflict targeting currentPosition, and that conflict requires the CONFLICTING branch.'
    );
  }
  if (position.supportState === 'SUPPORTED') {
    const unresolvedCurrentStageConflict = conflicts.some(
      (entry) =>
        entry.state === 'UNRESOLVED' &&
        entry.targetKind === 'STAGE' &&
        entry.targetReference === position.currentStageCode
    );
    const unresolvedCurrentMilestoneConflict =
      position.currentGranularity === 'MILESTONE' &&
      conflicts.some(
        (entry) =>
          entry.state === 'UNRESOLVED' &&
          entry.targetKind === 'MILESTONE' &&
          entry.targetReference === `${position.currentStageCode}/${position.currentMilestoneCode}`
      );
    if (unresolvedCurrentStageConflict || unresolvedCurrentMilestoneConflict) {
      throw new TrademarkLifecycleContractError(
        'SUPPORTED current position cannot target a stage or milestone with an unresolved conflict.'
      );
    }
  }
}

function sameOwnerReference(left: ExactOwnerReferenceV1, right: ExactOwnerReferenceV1): boolean {
  return (
    left.owner === right.owner &&
    left.kind === right.kind &&
    left.id === right.id &&
    left.version === right.version &&
    left.fingerprintSha256 === right.fingerprintSha256
  );
}

function sameLifecycleDestination(
  left: TrademarkLifecycleDestinationV1,
  right: TrademarkLifecycleDestinationV1
): boolean {
  return left.kind === right.kind && sameOwnerReference(left.reference, right.reference);
}

function validateEvaluations(
  nextItem: EvaluationV1<TrademarkLifecycleNodeReferenceV1>,
  recommendation: EvaluationV1<ExactOwnerReferenceV1>,
  primaryTime: EvaluationV1<TrademarkLifecycleTimeAssertionReferenceV1>,
  stages: readonly StageV1[],
  timeAssertions: readonly TimeAssertionV1[],
  coverageValue: TrademarkLifecycleCoverage,
  evaluationScopeFingerprintSha256: string
): void {
  if (
    nextItem.scopeFingerprintSha256 !== evaluationScopeFingerprintSha256 ||
    recommendation.scopeFingerprintSha256 !== evaluationScopeFingerprintSha256 ||
    primaryTime.scopeFingerprintSha256 !== evaluationScopeFingerprintSha256
  ) {
    throw new TrademarkLifecycleContractError(
      'Every lifecycle evaluation must bind the exact selected track scope.'
    );
  }
  const upcomingStages = stages.filter((entry) => entry.processState === 'UPCOMING');
  const upcomingMilestones = stages.flatMap((stageItem) =>
    stageItem.milestones
      .filter((entry) => entry.processState === 'UPCOMING')
      .map((entry) => ({ stage: stageItem, milestone: entry }))
  );
  if (nextItem.state === 'PRESENT') {
    const target = nextItem.target;
    const stageItem = stages.find((entry) => entry.stageCode === target.stageCode);
    if (!stageItem) {
      throw new TrademarkLifecycleContractError('nextItemEvaluation has a dangling stage target.');
    }
    const targetNode =
      target.kind === 'STAGE'
        ? stageItem
        : stageItem.milestones.find((entry) => entry.milestoneCode === target.milestoneCode);
    if (!targetNode || targetNode.processState !== 'UPCOMING') {
      throw new TrademarkLifecycleContractError(
        'nextItemEvaluation PRESENT must reference an exact UPCOMING node.'
      );
    }
    const hasExactUpcomingSet =
      upcomingStages.length === 1 &&
      upcomingStages[0]?.stageCode === target.stageCode &&
      (target.kind === 'STAGE'
        ? upcomingMilestones.length === 0
        : upcomingMilestones.length === 1 &&
          upcomingMilestones[0]?.stage.stageCode === target.stageCode &&
          upcomingMilestones[0]?.milestone.milestoneCode === target.milestoneCode);
    if (!hasExactUpcomingSet) {
      throw new TrademarkLifecycleContractError(
        'UPCOMING nodes must exactly match the owner-selected nextItemEvaluation target.'
      );
    }
  } else if (upcomingStages.length > 0 || upcomingMilestones.length > 0) {
    throw new TrademarkLifecycleContractError(
      'A non-PRESENT nextItemEvaluation cannot expose UPCOMING nodes.'
    );
  }
  if (recommendation.state === 'PRESENT') {
    const recommendationReferences = stages.flatMap((stageItem) => [
      ...(stageItem.attentionOrRecommendationReference
        ? [stageItem.attentionOrRecommendationReference]
        : []),
      ...stageItem.milestones.flatMap((milestoneItem) =>
        milestoneItem.attentionOrRecommendationReference
          ? [milestoneItem.attentionOrRecommendationReference]
          : []
      )
    ]);
    if (
      !recommendationReferences.some((entry) => sameOwnerReference(entry, recommendation.target))
    ) {
      throw new TrademarkLifecycleContractError(
        'recommendationEvaluation PRESENT must reference an owner-backed node recommendation.'
      );
    }
  }
  if (
    primaryTime.state === 'PRESENT' &&
    !timeAssertions.some((entry) => entry.timeAssertionId === primaryTime.target.timeAssertionId)
  ) {
    throw new TrademarkLifecycleContractError(
      'primaryTimeEvaluation PRESENT has a dangling time assertion target.'
    );
  }
  const evaluations = [nextItem, recommendation, primaryTime] as const;
  if (
    evaluations.some((entry) => entry.state === 'COMPLETE_NONE') &&
    coverageValue.state !== 'FULL'
  ) {
    throw new TrademarkLifecycleContractError(
      'COMPLETE_NONE requires a completed FULL exact-scope evaluation.'
    );
  }
}

function validateProjectionTemporalBounds(
  input: Readonly<{
    generatedAt: string;
    asOf: string;
    coverage: TrademarkLifecycleCoverage;
    currentness: TrademarkLifecycleCurrentness;
    stages: readonly StageV1[];
    sourceReads: readonly SourceReadV1[];
    lastUndisputedPosition: TrademarkLifecycleHistoricalPositionV1 | null;
    evaluations: readonly Readonly<{ evaluatedAt: string }>[];
  }>
): void {
  if (
    input.coverage.evaluatedAt > input.generatedAt ||
    input.currentness.evaluatedAt > input.generatedAt ||
    input.evaluations.some((entry) => entry.evaluatedAt > input.generatedAt)
  ) {
    throw new TrademarkLifecycleContractError(
      'Projection evaluations cannot occur after projection.generatedAt.'
    );
  }
  if (input.lastUndisputedPosition !== null && input.lastUndisputedPosition.asOf > input.asOf) {
    throw new TrademarkLifecycleContractError(
      'lastUndisputedPosition.asOf cannot occur after projection.asOf.'
    );
  }
  if (input.sourceReads.some((entry) => entry.asOf > input.asOf)) {
    throw new TrademarkLifecycleContractError(
      'Source read asOf values cannot occur after projection.asOf.'
    );
  }
  const nodeSourceReferences = input.stages.flatMap((stageItem) => [
    ...stageItem.sourceReferences,
    ...stageItem.milestones.flatMap((milestoneItem) => milestoneItem.sourceReferences)
  ]);
  const assertions = input.stages.flatMap((stageItem) => [
    ...stageItem.timeAssertions,
    ...stageItem.milestones.flatMap((milestoneItem) => milestoneItem.timeAssertions)
  ]);
  if (nodeSourceReferences.some((entry) => entry.observedAt > input.asOf)) {
    throw new TrademarkLifecycleContractError(
      'Node source observations cannot occur after projection.asOf.'
    );
  }
  if (
    assertions.some(
      (assertion) =>
        assertion.asOf > input.asOf ||
        assertion.sourceReferences.some((entry) => entry.observedAt > assertion.asOf) ||
        (assertion.valueState === 'AVAILABLE' &&
          assertion.confidence !== null &&
          assertion.confidence.evaluatedAt > input.generatedAt)
    )
  ) {
    throw new TrademarkLifecycleContractError(
      'Time assertion evidence and evaluations cannot postdate their projection anchors.'
    );
  }
}

function compareCodeUnitStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonRecord)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => compareCodeUnitStrings(left, right))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
}

function stableSerialize(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function trademarkLifecycleProjectionFingerprintMaterialV1(
  value: TrademarkLifecycleProjectionFingerprintMaterialV1 | TrademarkLifecycleProjectionV1
): TrademarkLifecycleProjectionFingerprintMaterialV1 {
  const item = object(value, 'trademarkLifecycleProjection');
  const material =
    item.projectionFingerprintSha256 === undefined
      ? item
      : Object.fromEntries(
          Object.entries(item).filter(([key]) => key !== 'projectionFingerprintSha256')
        );
  return parseProjectionMaterial(material);
}

export function trademarkLifecycleProjectionFingerprintSha256V1(
  value: TrademarkLifecycleProjectionFingerprintMaterialV1 | TrademarkLifecycleProjectionV1
): string {
  const material = trademarkLifecycleProjectionFingerprintMaterialV1(value);
  return createHash('sha256').update(stableSerialize(material)).digest('hex');
}

export function parseTrademarkLifecycleProjectionV1(
  value: unknown
): TrademarkLifecycleProjectionV1 {
  const item = object(value, 'trademarkLifecycleProjection');
  exactKeys(
    item,
    [
      ...PROJECTION_MATERIAL_KEYS,
      ...(item.capabilityExecution === undefined ? [] : ['capabilityExecution']),
      'projectionFingerprintSha256'
    ],
    'trademarkLifecycleProjection'
  );
  const material = Object.fromEntries(
    Object.entries(item).filter(([key]) => key !== 'projectionFingerprintSha256')
  );
  const parsed = parseProjectionMaterial(material);
  const expected = trademarkLifecycleProjectionFingerprintSha256V1(parsed);
  if (
    sha256(item.projectionFingerprintSha256, 'projection.projectionFingerprintSha256') !== expected
  ) {
    throw new TrademarkLifecycleContractError(
      'Projection fingerprint does not match its material.'
    );
  }
  return { ...parsed, projectionFingerprintSha256: expected };
}

function selection(value: unknown, field: string): TrademarkLifecycleTrackSelectionV1 {
  const item = object(value, field);
  exactKeys(
    item,
    ['state', 'candidates', 'selectedTrackFingerprintSha256', 'reasonCodes', 'missingInputCodes'],
    field
  );
  const state = oneOf(item.state, trademarkLifecycleSelectionStates, `${field}.state`);
  const candidates = array(item.candidates, `${field}.candidates`, 0, 20).map((entry, index) =>
    trackIdentity(entry, `${field}.candidates[${index}]`)
  );
  if (new Set(candidates.map((entry) => entry.trackFingerprintSha256)).size !== candidates.length) {
    throw new TrademarkLifecycleContractError(`${field}.candidates must be distinct exact tracks.`);
  }
  const reasonCodes = uniqueCodes(item.reasonCodes, `${field}.reasonCodes`);
  const missingInputCodes = uniqueCodes(item.missingInputCodes, `${field}.missingInputCodes`);
  const selectedTrackFingerprintSha256 =
    item.selectedTrackFingerprintSha256 === null
      ? null
      : sha256(item.selectedTrackFingerprintSha256, `${field}.selectedTrackFingerprintSha256`);
  if (state === 'SELECTED') {
    if (
      candidates.length < 1 ||
      selectedTrackFingerprintSha256 === null ||
      candidates.filter((entry) => entry.trackFingerprintSha256 === selectedTrackFingerprintSha256)
        .length !== 1 ||
      missingInputCodes.length > 0
    ) {
      throw new TrademarkLifecycleContractError(
        `${field} SELECTED requires one exact selected candidate and no missing input.`
      );
    }
  } else {
    if (selectedTrackFingerprintSha256 !== null || reasonCodes.length === 0) {
      throw new TrademarkLifecycleContractError(
        `${field} ${state} requires null selected track and at least one reason.`
      );
    }
    if (
      state === 'MULTIPLE_CANDIDATES' &&
      (candidates.length < 2 || missingInputCodes.length > 0)
    ) {
      throw new TrademarkLifecycleContractError(
        `${field} MULTIPLE_CANDIDATES requires at least two candidates and no missing-input code.`
      );
    }
    if (state === 'MISSING_INPUT' && missingInputCodes.length === 0) {
      throw new TrademarkLifecycleContractError(
        `${field} MISSING_INPUT requires at least one missing-input code.`
      );
    }
    if (state === 'UNSUPPORTED' && (candidates.length < 1 || missingInputCodes.length > 0)) {
      throw new TrademarkLifecycleContractError(
        `${field} UNSUPPORTED requires the exact requested track and no missing-input code.`
      );
    }
  }
  return {
    state,
    candidates,
    selectedTrackFingerprintSha256,
    reasonCodes,
    missingInputCodes
  };
}

function interactionTarget(value: unknown, field: string): TrademarkLifecycleInteractionTargetV1 {
  const item = object(value, field);
  if (item.kind === 'MILESTONE') {
    exactKeys(item, ['kind', 'stageCode', 'milestoneCode', 'ownerReference'], field);
    if (item.ownerReference !== null) {
      throw new TrademarkLifecycleContractError(
        `${field} MILESTONE target forbids ownerReference.`
      );
    }
    return {
      kind: 'MILESTONE',
      stageCode: code(item.stageCode, `${field}.stageCode`),
      milestoneCode: code(item.milestoneCode, `${field}.milestoneCode`),
      ownerReference: null
    };
  }
  if (item.kind === 'RECOMMENDATION' || item.kind === 'OWNER_EVIDENCE') {
    exactKeys(item, ['kind', 'stageCode', 'milestoneCode', 'ownerReference'], field);
    if (item.stageCode !== null || item.milestoneCode !== null) {
      throw new TrademarkLifecycleContractError(
        `${field} ${item.kind} target requires null stage/milestone codes.`
      );
    }
    return {
      kind: item.kind,
      stageCode: null,
      milestoneCode: null,
      ownerReference: exactOwnerReference(item.ownerReference, `${field}.ownerReference`)
    };
  }
  if (item.kind === 'SOURCE_EVIDENCE') {
    exactKeys(item, ['kind', 'stageCode', 'milestoneCode', 'sourceReference'], field);
    if (item.stageCode !== null || item.milestoneCode !== null) {
      throw new TrademarkLifecycleContractError(
        `${field} SOURCE_EVIDENCE target requires null stage/milestone codes.`
      );
    }
    let sourceReference: TrademarkAssetSourceReference;
    try {
      sourceReference = parseTrademarkAssetSourceReference(item.sourceReference);
    } catch (error) {
      throw new TrademarkLifecycleContractError(
        `${field}.sourceReference must be an exact Trademark Asset source reference: ${
          error instanceof Error ? error.message : 'invalid reference'
        }`
      );
    }
    return {
      kind: 'SOURCE_EVIDENCE',
      stageCode: null,
      milestoneCode: null,
      sourceReference
    };
  }
  throw new TrademarkLifecycleContractError(`${field}.kind is invalid.`);
}

function interactionAccess(value: unknown, field: string): TrademarkLifecycleInteractionAccessV1 {
  const item = object(value, field);
  exactKeys(
    item,
    [
      'interactionId',
      'projectionReference',
      'trackFingerprintSha256',
      'target',
      'destination',
      'intendedOperation',
      'accessState',
      'reasonCodes',
      'evaluatedAt',
      'permissionPolicyVersion',
      'entitlementPolicyVersion',
      'executionAuthorized'
    ],
    field
  );
  const projectionReferenceInput = object(item.projectionReference, `${field}.projectionReference`);
  exactKeys(
    projectionReferenceInput,
    ['projectionId', 'version', 'projectionFingerprintSha256'],
    `${field}.projectionReference`
  );
  const projectionId = text(
    projectionReferenceInput.projectionId,
    `${field}.projectionReference.projectionId`,
    300
  );
  if (!PROJECTION_ID.test(projectionId)) {
    throw new TrademarkLifecycleContractError(
      `${field}.projectionReference.projectionId is invalid.`
    );
  }
  const accessState = oneOf(
    item.accessState,
    trademarkLifecycleInteractionAccessStates,
    `${field}.accessState`
  );
  const reasonCodes = uniqueCodes(item.reasonCodes, `${field}.reasonCodes`, { minimum: 1 });
  if (item.executionAuthorized !== false) {
    throw new TrademarkLifecycleContractError(`${field}.executionAuthorized must remain false.`);
  }
  return {
    interactionId: text(item.interactionId, `${field}.interactionId`, 240),
    projectionReference: {
      projectionId: projectionId as TrademarkLifecycleProjectionId,
      version: integer(projectionReferenceInput.version, `${field}.projectionReference.version`),
      projectionFingerprintSha256: sha256(
        projectionReferenceInput.projectionFingerprintSha256,
        `${field}.projectionReference.projectionFingerprintSha256`
      )
    },
    trackFingerprintSha256: sha256(item.trackFingerprintSha256, `${field}.trackFingerprintSha256`),
    target: interactionTarget(item.target, `${field}.target`),
    destination: lifecycleDestination(item.destination, `${field}.destination`),
    intendedOperation: oneOf(
      item.intendedOperation,
      trademarkLifecycleInteractionOperations,
      `${field}.intendedOperation`
    ),
    accessState,
    reasonCodes,
    evaluatedAt: timestamp(item.evaluatedAt, `${field}.evaluatedAt`),
    permissionPolicyVersion: text(
      item.permissionPolicyVersion,
      `${field}.permissionPolicyVersion`,
      200
    ),
    entitlementPolicyVersion: text(
      item.entitlementPolicyVersion,
      `${field}.entitlementPolicyVersion`,
      200
    ),
    executionAuthorized: false
  };
}

function validateInteractionAccess(
  accesses: readonly TrademarkLifecycleInteractionAccessV1[],
  projection: TrademarkLifecycleProjectionV1 | null,
  dependencyState: TrademarkLifecycleDependencyState,
  readCurrentness: TrademarkLifecycleCurrentness,
  readEvaluatedAt: string
): void {
  if (!projection && accesses.length > 0) {
    throw new TrademarkLifecycleContractError(
      'interactionAccess requires an exact available projection.'
    );
  }
  if (!projection) return;
  const seen = new Set<string>();
  for (const access of accesses) {
    if (seen.has(access.interactionId)) {
      throw new TrademarkLifecycleContractError('interactionAccess IDs must be unique.');
    }
    seen.add(access.interactionId);
    const reference = access.projectionReference;
    if (
      reference.projectionId !== projection.projectionId ||
      reference.version !== projection.version ||
      reference.projectionFingerprintSha256 !== projection.projectionFingerprintSha256 ||
      access.trackFingerprintSha256 !== projection.track.trackFingerprintSha256
    ) {
      throw new TrademarkLifecycleContractError(
        'interactionAccess must bind the exact projection and track.'
      );
    }
    if (access.evaluatedAt !== readEvaluatedAt) {
      throw new TrademarkLifecycleContractError(
        'interactionAccess must be evaluated in the exact current read response.'
      );
    }
    if (
      access.destination.kind !==
      trademarkLifecycleDestinationKindByOperation[access.intendedOperation]
    ) {
      throw new TrademarkLifecycleContractError(
        'interactionAccess destination kind must match its exact intended operation.'
      );
    }
    if (
      access.accessState === 'ALLOWED' &&
      (dependencyState !== 'AVAILABLE' || readCurrentness.state !== 'CURRENT')
    ) {
      throw new TrademarkLifecycleContractError(
        'Stale or unavailable read-time decisions cannot grant interaction access.'
      );
    }
    if (
      access.accessState === 'ALLOWED' &&
      access.intendedOperation === 'BEGIN_REVIEWABLE_HANDOFF'
    ) {
      throw new TrademarkLifecycleContractError(
        'BEGIN_REVIEWABLE_HANDOFF cannot be ALLOWED until an exact destination-owner handoff contract is admitted.'
      );
    }
    if (access.target.kind === 'MILESTONE') {
      const stageItem = projection.stages.find(
        (entry) => entry.stageCode === access.target.stageCode
      );
      const milestoneItem = stageItem?.milestones.find(
        (entry) => entry.milestoneCode === access.target.milestoneCode
      );
      if (!stageItem || !milestoneItem || milestoneItem.processState === 'NOT_APPLICABLE') {
        throw new TrademarkLifecycleContractError(
          'interactionAccess has a dangling or NOT_APPLICABLE milestone target.'
        );
      }
      if (
        milestoneItem.destinationReference === undefined ||
        !sameLifecycleDestination(milestoneItem.destinationReference, access.destination)
      ) {
        throw new TrademarkLifecycleContractError(
          'Milestone interaction destination must equal the exact destination carried by that milestone.'
        );
      }
      if (
        access.accessState === 'ALLOWED' &&
        unresolvedConflictAffectsNode(projection, stageItem, milestoneItem)
      ) {
        throw new TrademarkLifecycleContractError(
          'An unresolved conflict affecting the exact milestone blocks its interaction only.'
        );
      }
      continue;
    }
    if (access.target.kind === 'RECOMMENDATION') {
      const recommendationReference = access.target.ownerReference;
      if (recommendationReference === null) {
        throw new TrademarkLifecycleContractError(
          'Recommendation interaction requires an exact owner reference.'
        );
      }
      if (
        projection.recommendationEvaluation.state !== 'PRESENT' ||
        !sameOwnerReference(projection.recommendationEvaluation.target, recommendationReference)
      ) {
        throw new TrademarkLifecycleContractError(
          'Recommendation interaction must target the projection recommendation evaluation.'
        );
      }
      const matchingNodes = projection.stages.flatMap((stageItem) => [
        ...(stageItem.attentionOrRecommendationReference &&
        sameOwnerReference(stageItem.attentionOrRecommendationReference, recommendationReference)
          ? [{ stage: stageItem, milestone: null, node: stageItem }]
          : []),
        ...stageItem.milestones.flatMap((milestoneItem) =>
          milestoneItem.attentionOrRecommendationReference &&
          sameOwnerReference(
            milestoneItem.attentionOrRecommendationReference,
            recommendationReference
          )
            ? [{ stage: stageItem, milestone: milestoneItem, node: milestoneItem }]
            : []
        )
      ]);
      const match = matchingNodes[0];
      if (
        matchingNodes.length !== 1 ||
        !match ||
        match.node.destinationReference === undefined ||
        !sameLifecycleDestination(match.node.destinationReference, access.destination)
      ) {
        throw new TrademarkLifecycleContractError(
          'Recommendation interaction must bind one exact owner-backed node and its destination.'
        );
      }
      if (
        access.accessState === 'ALLOWED' &&
        unresolvedConflictAffectsNode(projection, match.stage, match.milestone)
      ) {
        throw new TrademarkLifecycleContractError(
          'An unresolved conflict affecting the recommendation node blocks its interaction only.'
        );
      }
      continue;
    }
    if (access.target.kind === 'OWNER_EVIDENCE') {
      const evidenceReference = access.target.ownerReference;
      if (
        evidenceReference === null ||
        access.intendedOperation !== 'INSPECT_EVIDENCE' ||
        !projection.materializedReferenceDependencies.some((entry) =>
          sameOwnerReference(entry, evidenceReference)
        ) ||
        !sameOwnerReference(evidenceReference, access.destination.reference)
      ) {
        throw new TrademarkLifecycleContractError(
          'Owner evidence interaction must inspect an exact materialized owner reference carried by the projection.'
        );
      }
      continue;
    }
    if (!('sourceReference' in access.target)) {
      throw new TrademarkLifecycleContractError(
        'Source evidence interaction requires an exact source reference.'
      );
    }
    const sourceEvidenceReference = access.target.sourceReference;
    const matchingSourceNodes = projection.stages.flatMap((stageItem) => [
      ...(stageItem.sourceReferences.some((entry) =>
        sameTrademarkAssetSourceReference(entry, sourceEvidenceReference)
      )
        ? [stageItem]
        : []),
      ...stageItem.milestones.filter((milestoneItem) =>
        milestoneItem.sourceReferences.some((entry) =>
          sameTrademarkAssetSourceReference(entry, sourceEvidenceReference)
        )
      )
    ]);
    if (
      access.intendedOperation !== 'INSPECT_EVIDENCE' ||
      !projection.sourceReads.some((entry) =>
        entry.sourceReferences.some((sourceReference) =>
          sameTrademarkAssetSourceReference(sourceReference, sourceEvidenceReference)
        )
      ) ||
      !matchingSourceNodes.some(
        (node) =>
          node.destinationReference !== undefined &&
          sameLifecycleDestination(node.destinationReference, access.destination)
      )
    ) {
      throw new TrademarkLifecycleContractError(
        'Source evidence interaction must bind an exact admitted source reference and a destination carried by a node using it.'
      );
    }
  }
}

function sameTrademarkAssetSourceReference(
  left: TrademarkAssetSourceReference,
  right: TrademarkAssetSourceReference
): boolean {
  return stableSerialize(left) === stableSerialize(right);
}

function unresolvedConflictAffectsNode(
  projection: TrademarkLifecycleProjectionV1,
  stageItem: StageV1,
  milestoneItem: MilestoneV1 | null
): boolean {
  const timeAssertionIds = new Set([
    ...stageItem.timeAssertions.map((entry) => entry.timeAssertionId),
    ...(milestoneItem?.timeAssertions.map((entry) => entry.timeAssertionId) ?? [])
  ]);
  const milestoneReference =
    milestoneItem === null ? null : `${stageItem.stageCode}/${milestoneItem.milestoneCode}`;
  return projection.conflicts.some(
    (entry) =>
      entry.state === 'UNRESOLVED' &&
      ((entry.targetKind === 'STAGE' && entry.targetReference === stageItem.stageCode) ||
        (entry.targetKind === 'MILESTONE' && entry.targetReference === milestoneReference) ||
        (entry.targetKind === 'TIME_ASSERTION' && timeAssertionIds.has(entry.targetReference)))
  );
}

export function parseTrademarkLifecycleReadResultV1(
  value: unknown
): TrademarkLifecycleReadResultV1 {
  const item = object(value, 'trademarkLifecycleReadResult');
  exactKeys(
    item,
    [
      'schemaVersion',
      'status',
      'evaluatedAt',
      'workspaceId',
      'asset',
      'dependencyState',
      'dependencyReasonCodes',
      'currentness',
      'readSemanticGlossary',
      'selection',
      'projectionAvailability',
      'coverage',
      'projection',
      'interactionAccess'
    ],
    'trademarkLifecycleReadResult'
  );
  if (item.schemaVersion !== 1 || item.status !== 'AUTHORIZED_FOUND') {
    throw new TrademarkLifecycleContractError('ReadResult must be the AUTHORIZED_FOUND V1 branch.');
  }
  const evaluatedAt = timestamp(item.evaluatedAt, 'readResult.evaluatedAt');
  const workspaceId = text(item.workspaceId, 'readResult.workspaceId', 80).toLowerCase();
  if (!UUID.test(workspaceId)) {
    throw new TrademarkLifecycleContractError(
      'readResult.workspaceId must be a Core Workspace UUID.'
    );
  }
  const asset = assetReference(item.asset, 'readResult.asset');
  const dependencyState = oneOf(
    item.dependencyState,
    trademarkLifecycleDependencyStates,
    'readResult.dependencyState'
  );
  const dependencyReasonCodes = uniqueCodes(
    item.dependencyReasonCodes,
    'readResult.dependencyReasonCodes'
  );
  if (
    (dependencyState === 'AVAILABLE' && dependencyReasonCodes.length > 0) ||
    (dependencyState !== 'AVAILABLE' && dependencyReasonCodes.length === 0)
  ) {
    throw new TrademarkLifecycleContractError(
      'AVAILABLE dependency state requires no reasons; DEGRADED/UNAVAILABLE requires explicit dependency reasons.'
    );
  }
  const readCurrentness = currentness(item.currentness, 'readResult.currentness');
  const parsedReadSemanticGlossary = semanticGlossary(
    item.readSemanticGlossary,
    'readResult.readSemanticGlossary'
  );
  if (readCurrentness.evaluatedAt !== evaluatedAt) {
    throw new TrademarkLifecycleContractError(
      'Read-time currentness must be evaluated in the exact current read response.'
    );
  }
  if (dependencyState !== 'AVAILABLE' && readCurrentness.state === 'CURRENT') {
    throw new TrademarkLifecycleContractError(
      'DEGRADED or UNAVAILABLE dependencies cannot claim CURRENT read-time currentness.'
    );
  }
  const parsedSelection = selection(item.selection, 'readResult.selection');
  const projectionAvailability = oneOf(
    item.projectionAvailability,
    trademarkLifecycleProjectionAvailabilityStates,
    'readResult.projectionAvailability'
  );
  const parsedCoverage = coverage(item.coverage, 'readResult.coverage');
  const projection =
    item.projection === null ? null : parseTrademarkLifecycleProjectionV1(item.projection);
  if ((projectionAvailability === 'AVAILABLE') !== (projection !== null)) {
    throw new TrademarkLifecycleContractError(
      'projectionAvailability must agree with the nullable projection.'
    );
  }
  if (
    projectionAvailability === 'NO_PROJECTION' &&
    parsedSelection.reasonCodes.length === 0 &&
    dependencyReasonCodes.length === 0
  ) {
    throw new TrademarkLifecycleContractError(
      'NO_PROJECTION requires an explicit selection or dependency reason.'
    );
  }
  if (parsedSelection.state !== 'SELECTED' && projection !== null) {
    throw new TrademarkLifecycleContractError('Only SELECTED may carry a projection.');
  }
  if (parsedSelection.state === 'UNSUPPORTED' && parsedCoverage.state !== 'NOT_COVERED') {
    throw new TrademarkLifecycleContractError('UNSUPPORTED requires NOT_COVERED coverage.');
  }
  if (
    parsedCoverage.state === 'NOT_COVERED' &&
    parsedSelection.state !== 'UNSUPPORTED' &&
    parsedSelection.state !== 'MISSING_INPUT'
  ) {
    throw new TrademarkLifecycleContractError(
      'NOT_COVERED requires UNSUPPORTED or MISSING_INPUT selection.'
    );
  }
  if (
    (parsedSelection.state === 'MULTIPLE_CANDIDATES' ||
      parsedSelection.state === 'MISSING_INPUT') &&
    parsedCoverage.state === 'FULL'
  ) {
    throw new TrademarkLifecycleContractError(
      `${parsedSelection.state} cannot claim FULL selected-scope coverage.`
    );
  }
  if (projection !== null) {
    if (
      projection.workspaceId !== workspaceId ||
      stableSerialize(projection.asset) !== stableSerialize(asset)
    ) {
      throw new TrademarkLifecycleContractError(
        'Projection must bind the exact authorized Workspace and Asset reference.'
      );
    }
    const selectedTrack = parsedSelection.candidates.find(
      (entry) => entry.trackFingerprintSha256 === parsedSelection.selectedTrackFingerprintSha256
    );
    if (!selectedTrack || stableSerialize(selectedTrack) !== stableSerialize(projection.track)) {
      throw new TrademarkLifecycleContractError(
        'Projection track must equal the exact selected track candidate.'
      );
    }
    if (stableSerialize(parsedCoverage) !== stableSerialize(projection.coverage)) {
      throw new TrademarkLifecycleContractError(
        'ReadResult coverage must exactly equal the projection coverage evaluation.'
      );
    }
    if (projection.generatedAt > evaluatedAt) {
      throw new TrademarkLifecycleContractError(
        'Projection generation cannot occur after readResult.evaluatedAt.'
      );
    }
    if (readCurrentness.evaluatedAt < projection.generatedAt) {
      throw new TrademarkLifecycleContractError(
        'Read-time currentness cannot predate the selected projection generation.'
      );
    }
  }
  const interactions = array(item.interactionAccess, 'readResult.interactionAccess', 0, 50).map(
    (entry, index) => interactionAccess(entry, `readResult.interactionAccess[${index}]`)
  );
  validateInteractionAccess(
    interactions,
    projection,
    dependencyState,
    readCurrentness,
    evaluatedAt
  );
  const projectionGlossaryCodes = new Set(
    projection?.semanticGlossary.map((entry) => entry.code) ?? []
  );
  const readSemanticCodes = [
    ...dependencyReasonCodes,
    ...readCurrentness.reasonCodes,
    ...parsedSelection.reasonCodes,
    ...parsedSelection.missingInputCodes,
    ...parsedCoverage.reasonCodes,
    ...interactions.flatMap((entry) => entry.reasonCodes)
  ].filter((entry) => !projectionGlossaryCodes.has(entry));
  validateExactSemanticCoverage(
    parsedReadSemanticGlossary,
    readSemanticCodes,
    'readResult.readSemanticGlossary'
  );
  return {
    schemaVersion: 1,
    status: 'AUTHORIZED_FOUND',
    evaluatedAt,
    workspaceId,
    asset,
    dependencyState,
    dependencyReasonCodes,
    currentness: readCurrentness,
    readSemanticGlossary: parsedReadSemanticGlossary,
    selection: parsedSelection,
    projectionAvailability,
    coverage: parsedCoverage,
    projection,
    interactionAccess: interactions
  };
}

function parsePrivateFailure(value: unknown): TrademarkLifecyclePrivateFailureV1 {
  const item = object(value, 'trademarkLifecyclePrivateFailure');
  exactKeys(
    item,
    ['schemaVersion', 'status', 'evaluatedAt', 'retryable', 'publicReasonCode'],
    'trademarkLifecyclePrivateFailure'
  );
  if (item.schemaVersion !== 1) {
    throw new TrademarkLifecycleContractError('Private failure schemaVersion must be 1.');
  }
  const status = oneOf(
    item.status,
    trademarkLifecyclePrivateFailureStatuses,
    'privateFailure.status'
  );
  const expectedRetryable = status === 'TRANSPORT_ERROR';
  if (item.retryable !== expectedRetryable) {
    throw new TrademarkLifecycleContractError(
      `privateFailure.retryable must be ${String(expectedRetryable)} for ${status}.`
    );
  }
  const expectedPublicReasonCode = trademarkLifecycleSafePublicReasonCodeByStatus[status];
  if (item.publicReasonCode !== expectedPublicReasonCode) {
    throw new TrademarkLifecycleContractError(
      `privateFailure.publicReasonCode must use the non-resource-revealing ${expectedPublicReasonCode} code for ${status}.`
    );
  }
  return {
    schemaVersion: 1,
    status,
    evaluatedAt: timestamp(item.evaluatedAt, 'privateFailure.evaluatedAt'),
    retryable: expectedRetryable,
    publicReasonCode: expectedPublicReasonCode
  };
}

export function parseTrademarkLifecycleExternalReadResponseV1(
  value: unknown
): TrademarkLifecycleExternalReadResponseV1 {
  const item = object(value, 'trademarkLifecycleExternalReadResponse');
  return item.status === 'AUTHORIZED_FOUND'
    ? parseTrademarkLifecycleReadResultV1(item)
    : parsePrivateFailure(item);
}

export type TrademarkLifecycleSourceDateObservationV1 =
  | Readonly<{
      factCode: string;
      valueState: 'AVAILABLE';
      candidate: Readonly<TrademarkLifecycleSourceDateCandidateV1>;
      reasonCodes: readonly string[];
    }>
  | Readonly<{
      factCode: string;
      valueState: 'UNKNOWN';
      candidate: null;
      sourceReferences: readonly Readonly<TrademarkAssetSourceReference>[];
      reasonCodes: readonly string[];
    }>
  | Readonly<{
      factCode: string;
      valueState: 'CONFLICTING';
      candidates: readonly Readonly<TrademarkLifecycleSourceDateCandidateV1>[];
      conflictId: string;
      reasonCodes: readonly string[];
    }>;

export interface TrademarkLifecycleSourceDateCandidateV1 {
  value: string;
  precision: TrademarkLifecycleTimePrecision;
  jurisdictionTimeZone: string;
  sourceReferences: readonly Readonly<TrademarkAssetSourceReference>[];
}

export interface TrademarkLifecycleComputationInputV1 {
  schemaVersion: 1;
  workspaceId: string;
  asset: Readonly<AssetReferenceV1>;
  asOf: string;
  track: Readonly<TrackIdentityV1>;
  sourceReads: readonly Readonly<SourceReadV1>[];
  sourceDateObservations: readonly Readonly<TrademarkLifecycleSourceDateObservationV1>[];
  methodPackageReference: Readonly<ExactOwnerReferenceV1>;
  materializedReferenceDependencies: readonly Readonly<ExactOwnerReferenceV1>[];
  professionalReviewReceiptReference: Readonly<ExactOwnerReferenceV1>;
  normalizedInputFingerprintSha256: string;
}

export type TrademarkLifecycleComputationInputFingerprintMaterialV1 = Omit<
  TrademarkLifecycleComputationInputV1,
  'normalizedInputFingerprintSha256'
>;

export type TrademarkLifecycleComputationOutputV1 = Omit<
  TrademarkLifecycleProjectionV1,
  'projectionId' | 'version' | 'projectionFingerprintSha256' | 'generatedAt' | 'capabilityExecution'
> & {
  status: 'COMPUTED';
  computedAt: string;
  professionalReviewReceiptReference: Readonly<ExactOwnerReferenceV1>;
  outputFingerprintSha256: string;
};

export type TrademarkLifecycleComputationOutputFingerprintMaterialV1 = Omit<
  TrademarkLifecycleComputationOutputV1,
  'outputFingerprintSha256'
>;

const COMPUTATION_INPUT_MATERIAL_KEYS = [
  'schemaVersion',
  'workspaceId',
  'asset',
  'asOf',
  'track',
  'sourceReads',
  'sourceDateObservations',
  'methodPackageReference',
  'materializedReferenceDependencies',
  'professionalReviewReceiptReference'
] as const;

const COMPUTATION_OUTPUT_MATERIAL_KEYS = [
  'schemaVersion',
  'status',
  'workspaceId',
  'asset',
  'normalizedInputFingerprintSha256',
  'computedAt',
  'asOf',
  'track',
  'coverage',
  'currentness',
  'conflictState',
  'currentPosition',
  'lastUndisputedPosition',
  'stages',
  'sourceReads',
  'conflicts',
  'missingInputCodes',
  'limitationCodes',
  'semanticGlossary',
  'methodPackageReference',
  'materializedReferenceDependencies',
  'professionalReviewReceiptReference',
  'nextItemEvaluation',
  'recommendationEvaluation',
  'primaryTimeEvaluation',
  'authority'
] as const;

function compareStableSerialized(left: unknown, right: unknown): number {
  return compareCodeUnitStrings(stableSerialize(left), stableSerialize(right));
}

function sortOwnerReferences(
  references: readonly Readonly<ExactOwnerReferenceV1>[]
): readonly ExactOwnerReferenceV1[] {
  return [...references].sort(compareStableSerialized);
}

function sortSourceReferences(
  references: readonly Readonly<TrademarkAssetSourceReference>[]
): readonly TrademarkAssetSourceReference[] {
  return [...references].sort(compareStableSerialized);
}

function sourceDateCandidate(
  value: unknown,
  field: string
): TrademarkLifecycleSourceDateCandidateV1 {
  const item = object(value, field);
  exactKeys(item, ['value', 'precision', 'jurisdictionTimeZone', 'sourceReferences'], field);
  const precision = oneOf(item.precision, trademarkLifecycleTimePrecisions, `${field}.precision`);
  return {
    value: temporalValue(item.value, precision, `${field}.value`),
    precision,
    jurisdictionTimeZone: timeZone(item.jurisdictionTimeZone, `${field}.jurisdictionTimeZone`),
    sourceReferences: sortSourceReferences(
      trademarkAssetSourceReferences(item.sourceReferences, `${field}.sourceReferences`, {
        minimum: 1,
        maximum: 30
      })
    )
  };
}

function sourceDateObservation(
  value: unknown,
  field: string
): TrademarkLifecycleSourceDateObservationV1 {
  const item = object(value, field);
  const valueState = oneOf(
    item.valueState,
    trademarkLifecycleTimeValueStates,
    `${field}.valueState`
  );
  const factCode = code(item.factCode, `${field}.factCode`);
  const reasonCodes = [...uniqueCodes(item.reasonCodes, `${field}.reasonCodes`)].sort();
  if (valueState === 'AVAILABLE') {
    exactKeys(item, ['factCode', 'valueState', 'candidate', 'reasonCodes'], field);
    return {
      factCode,
      valueState,
      candidate: sourceDateCandidate(item.candidate, `${field}.candidate`),
      reasonCodes
    };
  }
  if (valueState === 'UNKNOWN') {
    exactKeys(
      item,
      ['factCode', 'valueState', 'candidate', 'sourceReferences', 'reasonCodes'],
      field
    );
    if (item.candidate !== null || reasonCodes.length === 0) {
      throw new TrademarkLifecycleContractError(
        `${field} UNKNOWN requires a null candidate and at least one reason.`
      );
    }
    return {
      factCode,
      valueState,
      candidate: null,
      sourceReferences: sortSourceReferences(
        trademarkAssetSourceReferences(item.sourceReferences, `${field}.sourceReferences`, {
          maximum: 30
        })
      ),
      reasonCodes
    };
  }
  exactKeys(item, ['factCode', 'valueState', 'candidates', 'conflictId', 'reasonCodes'], field);
  const candidates = array(item.candidates, `${field}.candidates`, 2, 10)
    .map((candidateValue, index) =>
      sourceDateCandidate(candidateValue, `${field}.candidates[${index}]`)
    )
    .sort(compareStableSerialized);
  if (
    new Set(
      candidates.map((candidateValue) =>
        stableSerialize({
          value: candidateValue.value,
          precision: candidateValue.precision,
          jurisdictionTimeZone: candidateValue.jurisdictionTimeZone
        })
      )
    ).size !== candidates.length ||
    reasonCodes.length === 0
  ) {
    throw new TrademarkLifecycleContractError(
      `${field} CONFLICTING requires distinct temporal candidates and at least one reason.`
    );
  }
  const competingSourceReferences = candidates.flatMap(
    (candidateValue) => candidateValue.sourceReferences
  );
  if (new Set(competingSourceReferences.map(trademarkAssetSourceVersionIdentity)).size < 2) {
    throw new TrademarkLifecycleContractError(
      `${field} CONFLICTING requires at least two distinct exact source references.`
    );
  }
  return {
    factCode,
    valueState,
    candidates,
    conflictId: text(item.conflictId, `${field}.conflictId`, 240),
    reasonCodes
  };
}

function observationSourceReferences(
  observation: Readonly<TrademarkLifecycleSourceDateObservationV1>
): readonly Readonly<TrademarkAssetSourceReference>[] {
  if (observation.valueState === 'AVAILABLE') return observation.candidate.sourceReferences;
  if (observation.valueState === 'UNKNOWN') return observation.sourceReferences;
  return observation.candidates.flatMap((candidate) => candidate.sourceReferences);
}

function parseComputationInputMaterial(
  value: unknown
): TrademarkLifecycleComputationInputFingerprintMaterialV1 {
  const item = object(value, 'trademarkLifecycleComputationInput');
  exactKeys(item, COMPUTATION_INPUT_MATERIAL_KEYS, 'trademarkLifecycleComputationInput');
  if (item.schemaVersion !== 1) {
    throw new TrademarkLifecycleContractError('Computation input schemaVersion must be 1.');
  }
  const workspaceId = text(item.workspaceId, 'computationInput.workspaceId', 80).toLowerCase();
  if (!UUID.test(workspaceId)) {
    throw new TrademarkLifecycleContractError(
      'computationInput.workspaceId must be a Core Workspace UUID.'
    );
  }
  const asOf = timestamp(item.asOf, 'computationInput.asOf');
  const sourceReads = array(item.sourceReads, 'computationInput.sourceReads', 1, 50)
    .map((entry, index) => {
      const parsed = sourceRead(entry, `computationInput.sourceReads[${index}]`);
      return { ...parsed, sourceReferences: sortSourceReferences(parsed.sourceReferences) };
    })
    .sort((left, right) =>
      compareCodeUnitStrings(`${left.owner}:${left.scopeId}`, `${right.owner}:${right.scopeId}`)
    );
  const sourceScopeKeys = sourceReads.map((entry) => `${entry.owner}:${entry.scopeId}`);
  if (new Set(sourceScopeKeys).size !== sourceScopeKeys.length) {
    throw new TrademarkLifecycleContractError(
      'computationInput.sourceReads must contain unique exact owner/scope reads.'
    );
  }
  if (sourceReads.some((entry) => entry.asOf > asOf)) {
    throw new TrademarkLifecycleContractError(
      'Computation input source reads cannot occur after computationInput.asOf.'
    );
  }
  const admittedSourceReferences = new Set(
    sourceReads.flatMap((entry) => entry.sourceReferences).map(stableSerialize)
  );
  const sourceDateObservations = array(
    item.sourceDateObservations,
    'computationInput.sourceDateObservations',
    0,
    100
  )
    .map((entry, index) =>
      sourceDateObservation(entry, `computationInput.sourceDateObservations[${index}]`)
    )
    .sort((left, right) => compareCodeUnitStrings(left.factCode, right.factCode));
  if (
    new Set(sourceDateObservations.map((entry) => entry.factCode)).size !==
    sourceDateObservations.length
  ) {
    throw new TrademarkLifecycleContractError(
      'computationInput.sourceDateObservations must contain unique factCode values.'
    );
  }
  const observationReferences = sourceDateObservations.flatMap(observationSourceReferences);
  if (
    observationReferences.some(
      (sourceReference) => !admittedSourceReferences.has(stableSerialize(sourceReference))
    )
  ) {
    throw new TrademarkLifecycleContractError(
      'Every source-date observation reference must be admitted by an exact computation input source read.'
    );
  }
  if (observationReferences.some((sourceReference) => sourceReference.observedAt > asOf)) {
    throw new TrademarkLifecycleContractError(
      'Computation input source-date observations cannot occur after computationInput.asOf.'
    );
  }
  const materializedReferenceDependencies = sortOwnerReferences(
    exactOwnerReferences(
      item.materializedReferenceDependencies,
      'computationInput.materializedReferenceDependencies',
      { minimum: 1, maximum: 50 }
    )
  );
  const professionalReviewReceiptReference = exactOwnerReference(
    item.professionalReviewReceiptReference,
    'computationInput.professionalReviewReceiptReference'
  );
  if (
    !materializedReferenceDependencies.some((entry) =>
      sameOwnerReference(entry, professionalReviewReceiptReference)
    )
  ) {
    throw new TrademarkLifecycleContractError(
      'Computation input professional-review receipt must be an exact materialized dependency.'
    );
  }
  const parsedTrack = trackIdentity(item.track, 'computationInput.track');
  return {
    schemaVersion: 1,
    workspaceId,
    asset: assetReference(item.asset, 'computationInput.asset'),
    asOf,
    track: {
      ...parsedTrack,
      relatedOwnerReferences: sortOwnerReferences(parsedTrack.relatedOwnerReferences)
    },
    sourceReads,
    sourceDateObservations,
    methodPackageReference: exactOwnerReference(
      item.methodPackageReference,
      'computationInput.methodPackageReference'
    ),
    materializedReferenceDependencies,
    professionalReviewReceiptReference
  };
}

export function trademarkLifecycleComputationInputFingerprintMaterialV1(
  value:
    TrademarkLifecycleComputationInputFingerprintMaterialV1 | TrademarkLifecycleComputationInputV1
): TrademarkLifecycleComputationInputFingerprintMaterialV1 {
  const item = object(value, 'trademarkLifecycleComputationInput');
  const material =
    item.normalizedInputFingerprintSha256 === undefined
      ? item
      : Object.fromEntries(
          Object.entries(item).filter(([key]) => key !== 'normalizedInputFingerprintSha256')
        );
  return parseComputationInputMaterial(material);
}

export function trademarkLifecycleComputationInputFingerprintSha256V1(
  value:
    TrademarkLifecycleComputationInputFingerprintMaterialV1 | TrademarkLifecycleComputationInputV1
): string {
  return createHash('sha256')
    .update(stableSerialize(trademarkLifecycleComputationInputFingerprintMaterialV1(value)))
    .digest('hex');
}

export function parseTrademarkLifecycleComputationInputV1(
  value: unknown
): TrademarkLifecycleComputationInputV1 {
  const item = object(value, 'trademarkLifecycleComputationInput');
  exactKeys(
    item,
    [...COMPUTATION_INPUT_MATERIAL_KEYS, 'normalizedInputFingerprintSha256'],
    'trademarkLifecycleComputationInput'
  );
  const material = parseComputationInputMaterial(
    Object.fromEntries(
      Object.entries(item).filter(([key]) => key !== 'normalizedInputFingerprintSha256')
    )
  );
  const expected = trademarkLifecycleComputationInputFingerprintSha256V1(material);
  if (
    sha256(
      item.normalizedInputFingerprintSha256,
      'computationInput.normalizedInputFingerprintSha256'
    ) !== expected
  ) {
    throw new TrademarkLifecycleContractError(
      'Computation input fingerprint does not match its normalized exact snapshot.'
    );
  }
  return { ...material, normalizedInputFingerprintSha256: expected };
}

function parseComputationOutputMaterial(
  value: unknown
): TrademarkLifecycleComputationOutputFingerprintMaterialV1 {
  const item = object(value, 'trademarkLifecycleComputationOutput');
  exactKeys(item, COMPUTATION_OUTPUT_MATERIAL_KEYS, 'trademarkLifecycleComputationOutput');
  if (item.schemaVersion !== 1 || item.status !== 'COMPUTED') {
    throw new TrademarkLifecycleContractError(
      'Computation output must be the strict COMPUTED V1 branch.'
    );
  }
  const computedAt = timestamp(item.computedAt, 'computationOutput.computedAt');
  const professionalReviewReceiptReference = exactOwnerReference(
    item.professionalReviewReceiptReference,
    'computationOutput.professionalReviewReceiptReference'
  );
  const surrogateMaterial: TrademarkLifecycleProjectionFingerprintMaterialV1 = {
    schemaVersion: 1,
    projectionId: 'trademark-lifecycle-projection_transient-computation-validation',
    version: 1,
    workspaceId: item.workspaceId as string,
    asset: item.asset as AssetReferenceV1,
    normalizedInputFingerprintSha256: item.normalizedInputFingerprintSha256 as string,
    generatedAt: computedAt,
    asOf: item.asOf as string,
    track: item.track as TrackIdentityV1,
    coverage: item.coverage as TrademarkLifecycleCoverage,
    currentness: item.currentness as TrademarkLifecycleCurrentness,
    conflictState: item.conflictState as TrademarkLifecycleConflictState,
    currentPosition: item.currentPosition as CurrentPositionV1,
    lastUndisputedPosition:
      item.lastUndisputedPosition as TrademarkLifecycleHistoricalPositionV1 | null,
    stages: item.stages as readonly StageV1[],
    sourceReads: item.sourceReads as readonly SourceReadV1[],
    conflicts: item.conflicts as readonly ConflictV1[],
    missingInputCodes: item.missingInputCodes as readonly string[],
    limitationCodes: item.limitationCodes as readonly string[],
    semanticGlossary: item.semanticGlossary as readonly TrademarkLifecycleSemanticGlossaryEntryV1[],
    methodPackageReference: item.methodPackageReference as ExactOwnerReferenceV1,
    materializedReferenceDependencies:
      item.materializedReferenceDependencies as readonly ExactOwnerReferenceV1[],
    nextItemEvaluation: item.nextItemEvaluation as EvaluationV1<TrademarkLifecycleNodeReferenceV1>,
    recommendationEvaluation: item.recommendationEvaluation as EvaluationV1<ExactOwnerReferenceV1>,
    primaryTimeEvaluation:
      item.primaryTimeEvaluation as EvaluationV1<TrademarkLifecycleTimeAssertionReferenceV1>,
    authority: item.authority as TrademarkLifecycleAuthorityConsequencesV1
  };
  const parsedProjection = parseTrademarkLifecycleProjectionV1({
    ...surrogateMaterial,
    projectionFingerprintSha256: trademarkLifecycleProjectionFingerprintSha256V1(surrogateMaterial)
  });
  if (
    !parsedProjection.materializedReferenceDependencies.some((entry) =>
      sameOwnerReference(entry, professionalReviewReceiptReference)
    )
  ) {
    throw new TrademarkLifecycleContractError(
      'Computation output professional-review receipt must be an exact materialized dependency.'
    );
  }
  return {
    schemaVersion: 1,
    status: 'COMPUTED',
    workspaceId: parsedProjection.workspaceId,
    asset: parsedProjection.asset,
    normalizedInputFingerprintSha256: parsedProjection.normalizedInputFingerprintSha256,
    computedAt,
    asOf: parsedProjection.asOf,
    track: parsedProjection.track,
    coverage: parsedProjection.coverage,
    currentness: parsedProjection.currentness,
    conflictState: parsedProjection.conflictState,
    currentPosition: parsedProjection.currentPosition,
    lastUndisputedPosition: parsedProjection.lastUndisputedPosition,
    stages: parsedProjection.stages,
    sourceReads: parsedProjection.sourceReads,
    conflicts: parsedProjection.conflicts,
    missingInputCodes: parsedProjection.missingInputCodes,
    limitationCodes: parsedProjection.limitationCodes,
    semanticGlossary: parsedProjection.semanticGlossary,
    methodPackageReference: parsedProjection.methodPackageReference,
    materializedReferenceDependencies: parsedProjection.materializedReferenceDependencies,
    professionalReviewReceiptReference,
    nextItemEvaluation: parsedProjection.nextItemEvaluation,
    recommendationEvaluation: parsedProjection.recommendationEvaluation,
    primaryTimeEvaluation: parsedProjection.primaryTimeEvaluation,
    authority: parsedProjection.authority
  };
}

export function trademarkLifecycleComputationOutputFingerprintMaterialV1(
  value:
    TrademarkLifecycleComputationOutputFingerprintMaterialV1 | TrademarkLifecycleComputationOutputV1
): TrademarkLifecycleComputationOutputFingerprintMaterialV1 {
  const item = object(value, 'trademarkLifecycleComputationOutput');
  const material =
    item.outputFingerprintSha256 === undefined
      ? item
      : Object.fromEntries(
          Object.entries(item).filter(([key]) => key !== 'outputFingerprintSha256')
        );
  return parseComputationOutputMaterial(material);
}

export function trademarkLifecycleComputationOutputFingerprintSha256V1(
  value:
    TrademarkLifecycleComputationOutputFingerprintMaterialV1 | TrademarkLifecycleComputationOutputV1
): string {
  return createHash('sha256')
    .update(stableSerialize(trademarkLifecycleComputationOutputFingerprintMaterialV1(value)))
    .digest('hex');
}

function assertComputationOutputMatchesInput(
  output: Readonly<TrademarkLifecycleComputationOutputFingerprintMaterialV1>,
  input: Readonly<TrademarkLifecycleComputationInputV1>
): void {
  const mismatchedBindings: string[] = [];
  if (output.workspaceId !== input.workspaceId) mismatchedBindings.push('workspaceId');
  if (stableSerialize(output.asset) !== stableSerialize(input.asset)) {
    mismatchedBindings.push('asset');
  }
  if (output.normalizedInputFingerprintSha256 !== input.normalizedInputFingerprintSha256) {
    mismatchedBindings.push('normalizedInputFingerprintSha256');
  }
  if (output.asOf !== input.asOf) mismatchedBindings.push('asOf');
  if (stableSerialize(output.track) !== stableSerialize(input.track)) {
    mismatchedBindings.push('track');
  }
  if (stableSerialize(output.sourceReads) !== stableSerialize(input.sourceReads)) {
    mismatchedBindings.push('sourceReads');
  }
  if (!sameOwnerReference(output.methodPackageReference, input.methodPackageReference)) {
    mismatchedBindings.push('methodPackageReference');
  }
  if (
    stableSerialize(output.materializedReferenceDependencies) !==
    stableSerialize(input.materializedReferenceDependencies)
  ) {
    mismatchedBindings.push('materializedReferenceDependencies');
  }
  if (
    !sameOwnerReference(
      output.professionalReviewReceiptReference,
      input.professionalReviewReceiptReference
    )
  ) {
    mismatchedBindings.push('professionalReviewReceiptReference');
  }
  if (mismatchedBindings.length > 0) {
    throw new TrademarkLifecycleContractError(
      `Computation output does not match its paired normalized input snapshot: ${mismatchedBindings.join(', ')}.`
    );
  }
}

export function parseTrademarkLifecycleComputationOutputV1(
  value: unknown,
  inputValue: unknown
): TrademarkLifecycleComputationOutputV1 {
  const input = parseTrademarkLifecycleComputationInputV1(inputValue);
  const item = object(value, 'trademarkLifecycleComputationOutput');
  exactKeys(
    item,
    [...COMPUTATION_OUTPUT_MATERIAL_KEYS, 'outputFingerprintSha256'],
    'trademarkLifecycleComputationOutput'
  );
  const material = parseComputationOutputMaterial(
    Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'outputFingerprintSha256'))
  );
  const expected = trademarkLifecycleComputationOutputFingerprintSha256V1(material);
  if (
    sha256(item.outputFingerprintSha256, 'computationOutput.outputFingerprintSha256') !== expected
  ) {
    throw new TrademarkLifecycleContractError(
      'Computation output fingerprint does not match its exact transient result.'
    );
  }
  assertComputationOutputMatchesInput(material, input);
  return { ...material, outputFingerprintSha256: expected };
}

const trademarkLifecycleRulePackAdmissionReadinessAuthorityKeysV1 = [
  'rulePackAdmitted',
  'sourceUsePromoted',
  'methodActivated',
  'capabilityVerified',
  'projectionPersistenceAuthorized',
  'productBusinessStateCreated',
  'officialTruthCreated',
  'legalDeadlineCertified',
  'executionAuthorized'
] as const;

const trademarkLifecycleRulePackAdmissionReadinessMaterialKeysV1 = [
  'schemaVersion',
  'assessedAt',
  'applicability',
  'applicabilityFingerprintSha256',
  'gates',
  'status',
  'authority'
] as const;

const trademarkLifecycleRulePackExactBranchApplicabilityAxesV1 = [
  'jurisdictions',
  'authorities',
  'procedures',
  'filingBases'
] as const;

function parseTrademarkLifecycleRulePackAdmissionReadinessAuthorityV1(
  value: unknown
): TrademarkLifecycleRulePackAdmissionReadinessAuthorityV1 {
  const authority = object(value, 'rulePackAdmissionReadiness.authority');
  exactKeys(
    authority,
    trademarkLifecycleRulePackAdmissionReadinessAuthorityKeysV1,
    'rulePackAdmissionReadiness.authority'
  );
  for (const field of trademarkLifecycleRulePackAdmissionReadinessAuthorityKeysV1) {
    if (authority[field] !== false) {
      throw new TrademarkLifecycleContractError(
        `rulePackAdmissionReadiness.authority.${field} must remain false.`
      );
    }
  }
  return noTrademarkLifecycleRulePackAdmissionReadinessAuthorityV1;
}

function parseTrademarkLifecycleRulePackAdmissionGateV1(
  value: unknown,
  field: string
): TrademarkLifecycleRulePackAdmissionGateV1 {
  const gate = object(value, field);
  exactKeys(gate, ['gateCode', 'state', 'evidenceReferences', 'reasonCodes'], field);
  const state = oneOf(
    gate.state,
    trademarkLifecycleRulePackAdmissionEvidenceStatesV1,
    `${field}.state`
  );
  const evidenceReferences = [
    ...exactOwnerReferences(gate.evidenceReferences, `${field}.evidenceReferences`, {
      maximum: 50
    })
  ].sort(compareStableSerialized);
  const reasonCodes = [
    ...uniqueCodes(gate.reasonCodes, `${field}.reasonCodes`, { maximum: 50 })
  ].sort(compareCodeUnitStrings);
  if (state === 'EVIDENCE_AVAILABLE') {
    if (evidenceReferences.length === 0 || reasonCodes.length !== 0) {
      throw new TrademarkLifecycleContractError(
        `${field} EVIDENCE_AVAILABLE requires exact evidence and no blocking reason.`
      );
    }
  } else if (reasonCodes.length === 0) {
    throw new TrademarkLifecycleContractError(
      `${field} ${state} requires at least one explicit blocking reason.`
    );
  }
  return {
    gateCode: oneOf(
      gate.gateCode,
      trademarkLifecycleRulePackAdmissionGateCodesV1,
      `${field}.gateCode`
    ),
    state,
    evidenceReferences,
    reasonCodes
  };
}

export function trademarkLifecycleRulePackApplicabilityFingerprintSha256V1(
  value: Readonly<MethodApplicabilityV1>
): string {
  const applicability = parseTrademarkLifecycleRulePackExactBranchApplicabilityV1(value);
  return createHash('sha256').update(stableSerialize(applicability)).digest('hex');
}

function parseTrademarkLifecycleRulePackExactBranchApplicabilityV1(
  value: unknown
): MethodApplicabilityV1 {
  const applicability = parseMethodApplicabilityV1(value);
  for (const axis of trademarkLifecycleRulePackExactBranchApplicabilityAxesV1) {
    if (applicability[axis].length !== 1) {
      throw new TrademarkLifecycleContractError(
        `rulePackAdmissionReadiness.applicability.${axis} must identify exactly one Rule Pack branch value.`
      );
    }
  }
  return applicability;
}

function normalizeTrademarkLifecycleRulePackAdmissionReadinessMaterialV1(
  value: unknown
): TrademarkLifecycleRulePackAdmissionReadinessFingerprintMaterialV1 {
  const readiness = object(value, 'rulePackAdmissionReadiness');
  exactKeys(
    readiness,
    trademarkLifecycleRulePackAdmissionReadinessMaterialKeysV1,
    'rulePackAdmissionReadiness'
  );
  if (readiness.schemaVersion !== 1) {
    throw new TrademarkLifecycleContractError(
      'rulePackAdmissionReadiness.schemaVersion must be 1.'
    );
  }
  const assessedAt = timestamp(readiness.assessedAt, 'rulePackAdmissionReadiness.assessedAt');
  const applicability = parseTrademarkLifecycleRulePackExactBranchApplicabilityV1(
    readiness.applicability
  );
  const applicabilityFingerprintSha256 = sha256(
    readiness.applicabilityFingerprintSha256,
    'rulePackAdmissionReadiness.applicabilityFingerprintSha256'
  );
  const expectedApplicabilityFingerprint =
    trademarkLifecycleRulePackApplicabilityFingerprintSha256V1(applicability);
  if (applicabilityFingerprintSha256 !== expectedApplicabilityFingerprint) {
    throw new TrademarkLifecycleContractError(
      'Rule Pack readiness applicability fingerprint does not match its exact normalized scope.'
    );
  }
  const parsedGates = array(
    readiness.gates,
    'rulePackAdmissionReadiness.gates',
    trademarkLifecycleRulePackAdmissionGateCodesV1.length,
    trademarkLifecycleRulePackAdmissionGateCodesV1.length
  ).map((gate, index) =>
    parseTrademarkLifecycleRulePackAdmissionGateV1(
      gate,
      `rulePackAdmissionReadiness.gates[${index}]`
    )
  );
  const gateCodeSet = new Set(parsedGates.map((gate) => gate.gateCode));
  if (
    gateCodeSet.size !== trademarkLifecycleRulePackAdmissionGateCodesV1.length ||
    trademarkLifecycleRulePackAdmissionGateCodesV1.some((gateCode) => !gateCodeSet.has(gateCode))
  ) {
    throw new TrademarkLifecycleContractError(
      'Rule Pack readiness must evaluate every A0 admission gate exactly once.'
    );
  }
  const gateOrder = new Map(
    trademarkLifecycleRulePackAdmissionGateCodesV1.map((gateCode, index) => [gateCode, index])
  );
  const gates = [...parsedGates].sort(
    (left, right) => gateOrder.get(left.gateCode)! - gateOrder.get(right.gateCode)!
  );
  const expectedStatus = gates.every((gate) => gate.state === 'EVIDENCE_AVAILABLE')
    ? 'READY_FOR_INDEPENDENT_ADMISSION_REVIEW'
    : 'INCOMPLETE';
  const status = oneOf(
    readiness.status,
    trademarkLifecycleRulePackAdmissionReadinessStatusesV1,
    'rulePackAdmissionReadiness.status'
  );
  if (status !== expectedStatus) {
    throw new TrademarkLifecycleContractError(
      `rulePackAdmissionReadiness.status must be ${expectedStatus} for the exact gate states.`
    );
  }
  return {
    schemaVersion: 1,
    assessedAt,
    applicability,
    applicabilityFingerprintSha256,
    gates,
    status,
    authority: parseTrademarkLifecycleRulePackAdmissionReadinessAuthorityV1(readiness.authority)
  };
}

export function trademarkLifecycleRulePackAdmissionReadinessFingerprintSha256V1(
  value: Readonly<TrademarkLifecycleRulePackAdmissionReadinessFingerprintMaterialV1>
): string {
  return createHash('sha256')
    .update(stableSerialize(normalizeTrademarkLifecycleRulePackAdmissionReadinessMaterialV1(value)))
    .digest('hex');
}

export function parseTrademarkLifecycleRulePackAdmissionReadinessV1(
  value: unknown
): TrademarkLifecycleRulePackAdmissionReadinessV1 {
  const readiness = object(value, 'rulePackAdmissionReadiness');
  exactKeys(
    readiness,
    [...trademarkLifecycleRulePackAdmissionReadinessMaterialKeysV1, 'assessmentFingerprintSha256'],
    'rulePackAdmissionReadiness'
  );
  const material = normalizeTrademarkLifecycleRulePackAdmissionReadinessMaterialV1(
    Object.fromEntries(
      Object.entries(readiness).filter(([key]) => key !== 'assessmentFingerprintSha256')
    )
  );
  const expectedFingerprint =
    trademarkLifecycleRulePackAdmissionReadinessFingerprintSha256V1(material);
  if (
    sha256(
      readiness.assessmentFingerprintSha256,
      'rulePackAdmissionReadiness.assessmentFingerprintSha256'
    ) !== expectedFingerprint
  ) {
    throw new TrademarkLifecycleContractError(
      'Rule Pack readiness fingerprint does not match its normalized assessment.'
    );
  }
  return {
    ...material,
    assessmentFingerprintSha256: expectedFingerprint
  };
}
