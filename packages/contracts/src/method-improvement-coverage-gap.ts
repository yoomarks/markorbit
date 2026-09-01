import { createHash } from 'node:crypto';
import { parseBrainResearchMissionV1, type BrainResearchMissionV1 } from './brain-method.js';
import {
  parseMethodImprovementPredecessorV1,
  parseMethodImprovementTriggerV1,
  type MethodImprovementPredecessorV1,
  type MethodImprovementResearchMissionId,
  type MethodImprovementTriggerId,
  type MethodImprovementTriggerV1
} from './method-improvement.js';

export const methodImprovementCoverageGapStatuses = [
  'MISSING_RUNTIME_CAPABILITY',
  'NO_APPROVED_IMPLEMENTATION',
  'AMBIGUOUS_CURRENT_IMPLEMENTATION',
  'RUNTIME_COVERED_SOURCE_UNPROVEN',
  'SOURCE_ADMISSION_DENIED',
  'SOURCE_PROOF_NOT_CURRENT'
] as const;
export type MethodImprovementCoverageGapStatusV1 =
  (typeof methodImprovementCoverageGapStatuses)[number];

export const methodImprovementCoverageGapResearchEligibleStatuses = [
  'MISSING_RUNTIME_CAPABILITY',
  'NO_APPROVED_IMPLEMENTATION',
  'AMBIGUOUS_CURRENT_IMPLEMENTATION'
] as const;
export type MethodImprovementCoverageGapResearchEligibleStatusV1 =
  (typeof methodImprovementCoverageGapResearchEligibleStatuses)[number];

export const methodImprovementCoverageGapSourceGovernanceStatuses = [
  'RUNTIME_COVERED_SOURCE_UNPROVEN',
  'SOURCE_ADMISSION_DENIED',
  'SOURCE_PROOF_NOT_CURRENT'
] as const;

export type CapabilityCoverageGapEvidenceIdV1 = `capability-coverage-gap-evidence_${string}`;
export type CapabilityCoverageGapCandidateIdV1 = `capability-coverage-gap-candidate_${string}`;
export type CapabilityDemandIdV1 = `capability-demand_${string}`;

export interface MethodImprovementCoverageGapEvidenceSourceV1 {
  kind: 'CAPABILITY_COVERAGE_GAP_EVIDENCE_V1';
  classification: 'COVERAGE_GAP_EVIDENCE';
  phase7AdmissionStatus: 'NOT_ADMITTED';
  sourceKind: 'CAPABILITY_DEMAND_COVERAGE_AUDIT_V1';
  evidenceId: CapabilityCoverageGapEvidenceIdV1;
  evidenceFingerprintSha256: string;
  sourceAuditFingerprintSha256: string;
  candidateId: CapabilityCoverageGapCandidateIdV1;
  candidateFingerprintSha256: string;
  coverageStatus: MethodImprovementCoverageGapStatusV1;
  demandId: CapabilityDemandIdV1;
  demandFingerprintSha256: string;
}

export type MethodImprovementCoverageGapTargetV1 =
  | Readonly<{
      kind: 'EXISTING_METHOD';
      predecessor: Readonly<MethodImprovementPredecessorV1>;
    }>
  | Readonly<{
      kind: 'NEW_CAPABILITY_METHOD_DEMAND';
      demandId: CapabilityDemandIdV1;
      demandFingerprintSha256: string;
    }>;

export interface MethodImprovementCoverageGapAdmissionV1 {
  kind: 'EXPLICIT_CORE_GOVERNANCE_ADMISSION';
  idempotencyKey: string;
  sourceEvidenceResolution: 'EXACT_EVIDENCE_VERIFIED';
  replayKeyFingerprintSha256: string;
}

export interface MethodImprovementCoverageGapAuthorityConsequencesV1 {
  methodImprovementTriggerRecorded: true;
  coverageEvidenceAdmissionStatusMutated: false;
  researchMissionCreated: false;
  methodImprovementCandidateCreated: false;
  methodActivated: false;
  runtimeCapabilityCreated: false;
  implementationApproved: false;
  arbitraryAiExecutionAuthorized: false;
  productStateCreated: false;
  officialTruthCreated: false;
  filingAuthorized: false;
  paymentAuthorized: false;
  providerAuthorityCreated: false;
}

export const methodImprovementCoverageGapNoDownstreamAuthority = Object.freeze({
  methodImprovementTriggerRecorded: true,
  coverageEvidenceAdmissionStatusMutated: false,
  researchMissionCreated: false,
  methodImprovementCandidateCreated: false,
  methodActivated: false,
  runtimeCapabilityCreated: false,
  implementationApproved: false,
  arbitraryAiExecutionAuthorized: false,
  productStateCreated: false,
  officialTruthCreated: false,
  filingAuthorized: false,
  paymentAuthorized: false,
  providerAuthorityCreated: false
}) satisfies Readonly<MethodImprovementCoverageGapAuthorityConsequencesV1>;

export interface MethodImprovementCoverageGapTriggerV1 {
  schemaVersion: 1;
  triggerId: MethodImprovementTriggerId;
  workspaceId: string;
  triggerType: 'COVERAGE_GAP';
  target: Readonly<MethodImprovementCoverageGapTargetV1>;
  source: Readonly<MethodImprovementCoverageGapEvidenceSourceV1>;
  admission: Readonly<MethodImprovementCoverageGapAdmissionV1>;
  reason: string;
  createdByPrincipalId: string;
  authorityConsequences: Readonly<MethodImprovementCoverageGapAuthorityConsequencesV1>;
  triggerFingerprintSha256: string;
  admittedAt: string;
}

export interface MethodImprovementCoverageGapResearchMissionV1 {
  schemaVersion: 1;
  researchMissionId: MethodImprovementResearchMissionId;
  workspaceId: string;
  triggerId: MethodImprovementTriggerId;
  triggerFingerprintSha256: string;
  target: Readonly<MethodImprovementCoverageGapTargetV1>;
  source: Readonly<MethodImprovementCoverageGapEvidenceSourceV1>;
  mission: Readonly<BrainResearchMissionV1>;
  missionFingerprintSha256: string;
  createdByPrincipalId: string;
  createdAt: string;
}

export type MethodImprovementAnyTriggerV1 =
  MethodImprovementTriggerV1 | MethodImprovementCoverageGapTriggerV1;

export class MethodImprovementCoverageGapContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MethodImprovementCoverageGapContractError';
  }
}

type RecordValue = Record<string, unknown>;
type CoverageGapReplayFingerprintInputV1 = Readonly<{
  workspaceId: string;
  evidenceId: CapabilityCoverageGapEvidenceIdV1;
  evidenceFingerprintSha256: string;
  idempotencyKey: string;
  createdByPrincipalId: string;
}>;
type CoverageGapTriggerFingerprintInputV1 = Omit<
  MethodImprovementCoverageGapTriggerV1,
  'triggerId' | 'triggerFingerprintSha256' | 'admittedAt'
>;
type CoverageGapMissionFingerprintInputV1 = Omit<
  MethodImprovementCoverageGapResearchMissionV1,
  'researchMissionId' | 'missionFingerprintSha256'
>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;
const COVERAGE_GAP_STATUSES = new Set<string>(methodImprovementCoverageGapStatuses);
const RESEARCH_ELIGIBLE_STATUSES = new Set<string>(
  methodImprovementCoverageGapResearchEligibleStatuses
);

function invalid(message: string): never {
  throw new MethodImprovementCoverageGapContractError(message);
}

function record(value: unknown, field: string): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid(`${field} must be an object.`);
  return value as RecordValue;
}

function exactKeys(value: RecordValue, allowed: readonly string[], field: string): void {
  const accepted = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !accepted.has(key));
  if (unknown.length > 0) invalid(`${field} contains unsupported fields: ${unknown.join(', ')}.`);
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string') return invalid(`${field} must be a string.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    return invalid(`${field} must contain between 1 and ${maximum} characters.`);
  return cleaned;
}

function sha256(value: unknown, field: string): string {
  const cleaned = text(value, field, 64).toLowerCase();
  if (!SHA256.test(cleaned)) return invalid(`${field} must be a lowercase SHA-256 digest.`);
  return cleaned;
}

function prefixed<T extends string>(value: unknown, prefix: string, field: string): T {
  const cleaned = text(value, field);
  if (!cleaned.startsWith(prefix) || cleaned === prefix)
    return invalid(`${field} must start with ${prefix}.`);
  return cleaned as T;
}

function workspace(value: unknown, field = 'workspaceId'): string {
  const cleaned = text(value, field, 36).toLowerCase();
  if (!UUID.test(cleaned)) return invalid(`${field} must be a canonical UUID.`);
  return cleaned;
}

function instant(value: unknown, field: string): string {
  const cleaned = text(value, field, 64);
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== cleaned)
    return invalid(`${field} must be a canonical ISO-8601 instant.`);
  return cleaned;
}

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

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function parseAuthority(
  value: unknown
): Readonly<MethodImprovementCoverageGapAuthorityConsequencesV1> {
  const authority = record(value, 'authorityConsequences');
  exactKeys(
    authority,
    Object.keys(methodImprovementCoverageGapNoDownstreamAuthority),
    'authorityConsequences'
  );
  if (!same(authority, methodImprovementCoverageGapNoDownstreamAuthority))
    invalid('authorityConsequences must preserve the frozen no-downstream-authority boundary.');
  return methodImprovementCoverageGapNoDownstreamAuthority;
}

export function parseMethodImprovementCoverageGapEvidenceSourceV1(
  value: unknown
): MethodImprovementCoverageGapEvidenceSourceV1 {
  const source = record(value, 'coverageGapSource');
  exactKeys(
    source,
    [
      'kind',
      'classification',
      'phase7AdmissionStatus',
      'sourceKind',
      'evidenceId',
      'evidenceFingerprintSha256',
      'sourceAuditFingerprintSha256',
      'candidateId',
      'candidateFingerprintSha256',
      'coverageStatus',
      'demandId',
      'demandFingerprintSha256'
    ],
    'coverageGapSource'
  );
  if (source.kind !== 'CAPABILITY_COVERAGE_GAP_EVIDENCE_V1')
    invalid('coverageGapSource.kind must be CAPABILITY_COVERAGE_GAP_EVIDENCE_V1.');
  if (source.classification !== 'COVERAGE_GAP_EVIDENCE')
    invalid('coverageGapSource.classification must be COVERAGE_GAP_EVIDENCE.');
  if (source.phase7AdmissionStatus !== 'NOT_ADMITTED')
    invalid('coverageGapSource.phase7AdmissionStatus must remain NOT_ADMITTED.');
  if (source.sourceKind !== 'CAPABILITY_DEMAND_COVERAGE_AUDIT_V1')
    invalid('coverageGapSource.sourceKind must be CAPABILITY_DEMAND_COVERAGE_AUDIT_V1.');
  if (
    typeof source.coverageStatus !== 'string' ||
    !COVERAGE_GAP_STATUSES.has(source.coverageStatus)
  )
    invalid('coverageGapSource.coverageStatus is not an eligible governed Coverage Gap status.');

  const evidenceFingerprintSha256 = sha256(
    source.evidenceFingerprintSha256,
    'coverageGapSource.evidenceFingerprintSha256'
  );
  const candidateFingerprintSha256 = sha256(
    source.candidateFingerprintSha256,
    'coverageGapSource.candidateFingerprintSha256'
  );
  const demandFingerprintSha256 = sha256(
    source.demandFingerprintSha256,
    'coverageGapSource.demandFingerprintSha256'
  );
  const evidenceId = prefixed<CapabilityCoverageGapEvidenceIdV1>(
    source.evidenceId,
    'capability-coverage-gap-evidence_',
    'coverageGapSource.evidenceId'
  );
  const candidateId = prefixed<CapabilityCoverageGapCandidateIdV1>(
    source.candidateId,
    'capability-coverage-gap-candidate_',
    'coverageGapSource.candidateId'
  );
  const demandId = prefixed<CapabilityDemandIdV1>(
    source.demandId,
    'capability-demand_',
    'coverageGapSource.demandId'
  );
  if (evidenceId !== `capability-coverage-gap-evidence_${evidenceFingerprintSha256}`)
    invalid('coverageGapSource.evidenceId must bind the exact evidence fingerprint.');
  if (candidateId !== `capability-coverage-gap-candidate_${candidateFingerprintSha256}`)
    invalid('coverageGapSource.candidateId must bind the exact candidate fingerprint.');
  if (demandId !== `capability-demand_${demandFingerprintSha256}`)
    invalid('coverageGapSource.demandId must bind the exact demand fingerprint.');

  return {
    kind: 'CAPABILITY_COVERAGE_GAP_EVIDENCE_V1',
    classification: 'COVERAGE_GAP_EVIDENCE',
    phase7AdmissionStatus: 'NOT_ADMITTED',
    sourceKind: 'CAPABILITY_DEMAND_COVERAGE_AUDIT_V1',
    evidenceId,
    evidenceFingerprintSha256,
    sourceAuditFingerprintSha256: sha256(
      source.sourceAuditFingerprintSha256,
      'coverageGapSource.sourceAuditFingerprintSha256'
    ),
    candidateId,
    candidateFingerprintSha256,
    coverageStatus: source.coverageStatus as MethodImprovementCoverageGapStatusV1,
    demandId,
    demandFingerprintSha256
  };
}

export function parseMethodImprovementCoverageGapTargetV1(
  value: unknown
): MethodImprovementCoverageGapTargetV1 {
  const target = record(value, 'coverageGapTarget');
  if (target.kind === 'EXISTING_METHOD') {
    exactKeys(target, ['kind', 'predecessor'], 'coverageGapTarget');
    return {
      kind: 'EXISTING_METHOD',
      predecessor: parseMethodImprovementPredecessorV1(target.predecessor)
    };
  }
  if (target.kind !== 'NEW_CAPABILITY_METHOD_DEMAND')
    return invalid('coverageGapTarget.kind is invalid.');
  exactKeys(target, ['kind', 'demandId', 'demandFingerprintSha256'], 'coverageGapTarget');
  const demandFingerprintSha256 = sha256(
    target.demandFingerprintSha256,
    'coverageGapTarget.demandFingerprintSha256'
  );
  const demandId = prefixed<CapabilityDemandIdV1>(
    target.demandId,
    'capability-demand_',
    'coverageGapTarget.demandId'
  );
  if (demandId !== `capability-demand_${demandFingerprintSha256}`)
    invalid('coverageGapTarget.demandId must bind the exact demand fingerprint.');
  return { kind: 'NEW_CAPABILITY_METHOD_DEMAND', demandId, demandFingerprintSha256 };
}

function parseAdmission(value: unknown): MethodImprovementCoverageGapAdmissionV1 {
  const admission = record(value, 'coverageGapAdmission');
  exactKeys(
    admission,
    ['kind', 'idempotencyKey', 'sourceEvidenceResolution', 'replayKeyFingerprintSha256'],
    'coverageGapAdmission'
  );
  if (admission.kind !== 'EXPLICIT_CORE_GOVERNANCE_ADMISSION')
    invalid('coverageGapAdmission.kind must be EXPLICIT_CORE_GOVERNANCE_ADMISSION.');
  if (admission.sourceEvidenceResolution !== 'EXACT_EVIDENCE_VERIFIED')
    invalid('coverageGapAdmission.sourceEvidenceResolution must be EXACT_EVIDENCE_VERIFIED.');
  return {
    kind: 'EXPLICIT_CORE_GOVERNANCE_ADMISSION',
    idempotencyKey: text(admission.idempotencyKey, 'coverageGapAdmission.idempotencyKey', 300),
    sourceEvidenceResolution: 'EXACT_EVIDENCE_VERIFIED',
    replayKeyFingerprintSha256: sha256(
      admission.replayKeyFingerprintSha256,
      'coverageGapAdmission.replayKeyFingerprintSha256'
    )
  };
}

export function methodImprovementCoverageGapReplayKeyFingerprintV1(
  value: CoverageGapReplayFingerprintInputV1
): string {
  return fingerprint({
    workspaceId: value.workspaceId.trim().toLowerCase(),
    evidenceId: value.evidenceId,
    evidenceFingerprintSha256: value.evidenceFingerprintSha256,
    idempotencyKey: value.idempotencyKey.trim(),
    createdByPrincipalId: value.createdByPrincipalId.trim()
  });
}

export function methodImprovementCoverageGapTriggerFingerprintV1(
  value: CoverageGapTriggerFingerprintInputV1
): string {
  return fingerprint(value);
}

export function methodImprovementCoverageGapMissionFingerprintV1(
  value: CoverageGapMissionFingerprintInputV1
): string {
  return fingerprint(value);
}

function assertCoverageGapAdmissionEligibility(
  source: Readonly<MethodImprovementCoverageGapEvidenceSourceV1>,
  target: Readonly<MethodImprovementCoverageGapTargetV1>
): void {
  if (!RESEARCH_ELIGIBLE_STATUSES.has(source.coverageStatus))
    invalid(
      `Coverage Gap status ${source.coverageStatus} requires source-governance/currentness revalidation and cannot be admitted as Method Improvement research.`
    );
  if (
    source.coverageStatus === 'MISSING_RUNTIME_CAPABILITY' &&
    target.kind !== 'NEW_CAPABILITY_METHOD_DEMAND'
  )
    invalid('MISSING_RUNTIME_CAPABILITY requires an explicit new capability/method demand target.');
  if (target.kind === 'NEW_CAPABILITY_METHOD_DEMAND') {
    if (
      target.demandId !== source.demandId ||
      target.demandFingerprintSha256 !== source.demandFingerprintSha256
    )
      invalid('New capability/method demand target must match the exact source demand identity.');
  }
}

export function parseMethodImprovementCoverageGapTriggerV1(
  value: unknown
): MethodImprovementCoverageGapTriggerV1 {
  const trigger = record(value, 'coverageGapTrigger');
  exactKeys(
    trigger,
    [
      'schemaVersion',
      'triggerId',
      'workspaceId',
      'triggerType',
      'target',
      'source',
      'admission',
      'reason',
      'createdByPrincipalId',
      'authorityConsequences',
      'triggerFingerprintSha256',
      'admittedAt'
    ],
    'coverageGapTrigger'
  );
  if (trigger.schemaVersion !== 1) invalid('coverageGapTrigger.schemaVersion must be 1.');
  if (trigger.triggerType !== 'COVERAGE_GAP')
    invalid('coverageGapTrigger.triggerType must be COVERAGE_GAP.');

  const workspaceId = workspace(trigger.workspaceId);
  const target = parseMethodImprovementCoverageGapTargetV1(trigger.target);
  const source = parseMethodImprovementCoverageGapEvidenceSourceV1(trigger.source);
  const admission = parseAdmission(trigger.admission);
  const createdByPrincipalId = text(
    trigger.createdByPrincipalId,
    'coverageGapTrigger.createdByPrincipalId',
    300
  );
  assertCoverageGapAdmissionEligibility(source, target);

  const expectedReplayKeyFingerprint = methodImprovementCoverageGapReplayKeyFingerprintV1({
    workspaceId,
    evidenceId: source.evidenceId,
    evidenceFingerprintSha256: source.evidenceFingerprintSha256,
    idempotencyKey: admission.idempotencyKey,
    createdByPrincipalId
  });
  if (admission.replayKeyFingerprintSha256 !== expectedReplayKeyFingerprint)
    invalid(
      'coverageGapAdmission replay key fingerprint does not match its exact admission identity.'
    );

  const base: CoverageGapTriggerFingerprintInputV1 = {
    schemaVersion: 1,
    workspaceId,
    triggerType: 'COVERAGE_GAP',
    target,
    source,
    admission,
    reason: text(trigger.reason, 'coverageGapTrigger.reason', 1000),
    createdByPrincipalId,
    authorityConsequences: parseAuthority(trigger.authorityConsequences)
  };
  const triggerFingerprintSha256 = sha256(
    trigger.triggerFingerprintSha256,
    'coverageGapTrigger.triggerFingerprintSha256'
  );
  if (triggerFingerprintSha256 !== methodImprovementCoverageGapTriggerFingerprintV1(base))
    invalid('coverageGapTrigger.triggerFingerprintSha256 does not match its bounded contents.');

  return {
    ...base,
    triggerId: prefixed<MethodImprovementTriggerId>(
      trigger.triggerId,
      'method-improvement-trigger_',
      'coverageGapTrigger.triggerId'
    ),
    triggerFingerprintSha256,
    admittedAt: instant(trigger.admittedAt, 'coverageGapTrigger.admittedAt')
  };
}

export function parseMethodImprovementCoverageGapResearchMissionV1(
  value: unknown
): MethodImprovementCoverageGapResearchMissionV1 {
  const wrapper = record(value, 'coverageGapResearchMission');
  exactKeys(
    wrapper,
    [
      'schemaVersion',
      'researchMissionId',
      'workspaceId',
      'triggerId',
      'triggerFingerprintSha256',
      'target',
      'source',
      'mission',
      'missionFingerprintSha256',
      'createdByPrincipalId',
      'createdAt'
    ],
    'coverageGapResearchMission'
  );
  if (wrapper.schemaVersion !== 1) invalid('coverageGapResearchMission.schemaVersion must be 1.');
  const target = parseMethodImprovementCoverageGapTargetV1(wrapper.target);
  const source = parseMethodImprovementCoverageGapEvidenceSourceV1(wrapper.source);
  assertCoverageGapAdmissionEligibility(source, target);
  const mission = parseBrainResearchMissionV1(wrapper.mission);
  const createdAt = instant(wrapper.createdAt, 'coverageGapResearchMission.createdAt');
  if (mission.createdAt !== createdAt)
    invalid('coverageGapResearchMission mission.createdAt must match wrapper createdAt.');

  const base: CoverageGapMissionFingerprintInputV1 = {
    schemaVersion: 1,
    workspaceId: workspace(wrapper.workspaceId),
    triggerId: prefixed<MethodImprovementTriggerId>(
      wrapper.triggerId,
      'method-improvement-trigger_',
      'coverageGapResearchMission.triggerId'
    ),
    triggerFingerprintSha256: sha256(
      wrapper.triggerFingerprintSha256,
      'coverageGapResearchMission.triggerFingerprintSha256'
    ),
    target,
    source,
    mission,
    createdByPrincipalId: text(
      wrapper.createdByPrincipalId,
      'coverageGapResearchMission.createdByPrincipalId',
      300
    ),
    createdAt
  };
  const missionFingerprintSha256 = sha256(
    wrapper.missionFingerprintSha256,
    'coverageGapResearchMission.missionFingerprintSha256'
  );
  if (missionFingerprintSha256 !== methodImprovementCoverageGapMissionFingerprintV1(base))
    invalid(
      'coverageGapResearchMission.missionFingerprintSha256 does not match its bounded contents.'
    );

  return {
    ...base,
    researchMissionId: prefixed<MethodImprovementResearchMissionId>(
      wrapper.researchMissionId,
      'method-improvement-research-mission_',
      'coverageGapResearchMission.researchMissionId'
    ),
    missionFingerprintSha256
  };
}

export function assertMethodImprovementCoverageGapMissionBinding(
  trigger: Readonly<MethodImprovementCoverageGapTriggerV1>,
  mission: Readonly<MethodImprovementCoverageGapResearchMissionV1>
): void {
  if (
    mission.workspaceId !== trigger.workspaceId ||
    mission.triggerId !== trigger.triggerId ||
    mission.triggerFingerprintSha256 !== trigger.triggerFingerprintSha256 ||
    mission.createdByPrincipalId !== trigger.createdByPrincipalId ||
    !same(mission.target, trigger.target) ||
    !same(mission.source, trigger.source)
  )
    invalid(
      'Coverage Gap research mission does not match its immutable Method Improvement trigger.'
    );
}

export function parseMethodImprovementAnyTriggerV1(value: unknown): MethodImprovementAnyTriggerV1 {
  const trigger = record(value, 'methodImprovementAnyTrigger');
  return trigger.triggerType === 'COVERAGE_GAP'
    ? parseMethodImprovementCoverageGapTriggerV1(value)
    : parseMethodImprovementTriggerV1(value);
}
