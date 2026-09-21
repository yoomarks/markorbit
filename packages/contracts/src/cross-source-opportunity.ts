import { createHash } from 'node:crypto';
import { parseBrainEvidenceRef, type BrainEvidenceRef } from './brain.js';
import type { BrainMethodVersionId } from './brain-method.js';

export const crossSourceOpportunityStatesV1 = [
  'SUPPORTED_CANDIDATE',
  'REVIEW_REQUIRED',
  'NOT_SUPPORTED',
  'INSUFFICIENT_DATA'
] as const;
export type CrossSourceOpportunityStateV1 = (typeof crossSourceOpportunityStatesV1)[number];

export const maintenanceLifecycleStatesV1 = ['WINDOW_OPEN', 'NOT_IN_WINDOW', 'UNKNOWN'] as const;
export type MaintenanceLifecycleStateV1 = (typeof maintenanceLifecycleStatesV1)[number];

export const subjectOperatingStatesV1 = ['ACTIVE', 'INACTIVE_OR_DISSOLVED', 'UNKNOWN'] as const;
export type SubjectOperatingStateV1 = (typeof subjectOperatingStatesV1)[number];

export const holderContinuityStatesV1 = [
  'CONFIRMED',
  'RENAMED_OR_SUCCESSOR_EVIDENCE',
  'CHANGED_OR_CONFLICTING',
  'UNKNOWN'
] as const;
export type HolderContinuityStateV1 = (typeof holderContinuityStatesV1)[number];

export const workspaceRelationshipStatesV1 = ['CURRENT', 'HISTORICAL', 'NONE', 'UNKNOWN'] as const;
export type WorkspaceRelationshipStateV1 = (typeof workspaceRelationshipStatesV1)[number];

export const maintenanceOpportunityReasonCodesV1 = [
  'MAINTENANCE_WINDOW_NOT_OPEN',
  'MAINTENANCE_WINDOW_UNKNOWN',
  'HOLDER_CONTINUITY_CONFLICT',
  'RENAME_OR_SUCCESSOR_EVIDENCE',
  'SUBJECT_INACTIVE_OR_DISSOLVED',
  'SUBJECT_OR_HOLDER_CURRENTNESS_UNKNOWN',
  'WORKSPACE_RELATIONSHIP_HISTORICAL',
  'WORKSPACE_RELATIONSHIP_NOT_CONFIRMED',
  'MAINTENANCE_WINDOW_WITH_ACTIVE_SUBJECT_AND_CURRENT_HOLDER'
] as const;
export type MaintenanceOpportunityReasonCodeV1 =
  (typeof maintenanceOpportunityReasonCodesV1)[number];

export interface OpportunityEvidenceSignalV1<T extends string> {
  value: T;
  evidenceRefs: readonly Readonly<BrainEvidenceRef>[];
}

export interface MaintenanceOpportunityInputV1 {
  schemaVersion: 1;
  methodVersionId: BrainMethodVersionId;
  trademarkRef: Readonly<{
    owner: 'DATA_ENGINE' | 'LITE';
    kind: string;
    id: string;
    version: string | number;
    fingerprintSha256: string;
    observedAt: string;
  }>;
  lifecycle: Readonly<OpportunityEvidenceSignalV1<MaintenanceLifecycleStateV1>>;
  subjectOperatingState: Readonly<OpportunityEvidenceSignalV1<SubjectOperatingStateV1>>;
  holderContinuity: Readonly<OpportunityEvidenceSignalV1<HolderContinuityStateV1>>;
  workspaceRelationship: Readonly<OpportunityEvidenceSignalV1<WorkspaceRelationshipStateV1>>;
  evaluatedAt: string;
}

export const noCrossSourceOpportunityAuthorityConsequencesV1 = Object.freeze({
  customerDemandEstablished: false,
  opportunityQualified: false,
  legalSuccessionEstablished: false,
  trademarkOwnershipEstablished: false,
  outreachAuthorized: false,
  externalActionAuthorized: false
});

export interface CrossSourceOpportunityAssessmentV1 {
  schemaVersion: 1;
  assessmentId: `cross-source-opportunity_${string}`;
  family: 'MAINTENANCE';
  methodVersionId: BrainMethodVersionId;
  trademarkRef: MaintenanceOpportunityInputV1['trademarkRef'];
  state: CrossSourceOpportunityStateV1;
  reasonCodes: readonly MaintenanceOpportunityReasonCodeV1[];
  suggestedReviewKinds: readonly (
    'MAINTENANCE_REVIEW' | 'OWNERSHIP_OR_SUCCESSION_REVIEW' | 'CUSTOMER_RELATIONSHIP_REVIEW'
  )[];
  evidenceRefs: readonly Readonly<BrainEvidenceRef>[];
  explanation: string;
  evaluatedAt: string;
  authorityConsequences: typeof noCrossSourceOpportunityAuthorityConsequencesV1;
  assessmentFingerprintSha256: string;
}

export class CrossSourceOpportunityValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'CrossSourceOpportunityValidationError';
  }
}

type JsonObject = Record<string, unknown>;
const SHA256 = /^[0-9a-f]{64}$/u;

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum)
    throw new CrossSourceOpportunityValidationError(`${field} is invalid.`);
  return value.trim();
}

function at(value: unknown, field: string): string {
  const result = text(value, field, 80);
  if (!Number.isFinite(Date.parse(result)))
    throw new CrossSourceOpportunityValidationError(`${field} must be an ISO timestamp.`);
  return new Date(result).toISOString();
}

function sha(value: unknown, field: string): string {
  const result = text(value, field, 64);
  if (!SHA256.test(result))
    throw new CrossSourceOpportunityValidationError(`${field} must be lowercase SHA-256.`);
  return result;
}

function version(value: unknown, field: string): string | number {
  if (Number.isSafeInteger(value) && Number(value) >= 1) return Number(value);
  if (typeof value === 'string' && value.trim()) return value.trim();
  throw new CrossSourceOpportunityValidationError(`${field} is invalid.`);
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)])
    );
  return value;
}

function fingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

function uniqueEvidence(
  groups: readonly (readonly Readonly<BrainEvidenceRef>[])[],
  field: string
): BrainEvidenceRef[] {
  const parsed = groups.flatMap((group) => group.map((item) => parseBrainEvidenceRef(item)));
  if (parsed.length === 0)
    throw new CrossSourceOpportunityValidationError(`${field} must contain evidence.`);
  const keyed = new Map(
    parsed.map((item) => [
      [
        item.sourceOwner,
        item.sourceObjectId,
        item.sourceVersion,
        item.sourceFingerprintSha256
      ].join(':'),
      item
    ])
  );
  return [...keyed.values()];
}

function assertSignalEvidence<T extends string>(
  signal: OpportunityEvidenceSignalV1<T>,
  field: string
): void {
  if (!Array.isArray(signal.evidenceRefs) || signal.evidenceRefs.length === 0)
    throw new CrossSourceOpportunityValidationError(`${field}.evidenceRefs must be non-empty.`);
  signal.evidenceRefs.forEach((item) => parseBrainEvidenceRef(item));
}

export function crossSourceOpportunityAssessmentFingerprintSha256V1(
  value: Omit<CrossSourceOpportunityAssessmentV1, 'assessmentFingerprintSha256'>
): string {
  return fingerprint(value);
}

export function evaluateMaintenanceOpportunityV1(
  input: Readonly<MaintenanceOpportunityInputV1>,
  assessmentId: CrossSourceOpportunityAssessmentV1['assessmentId']
): CrossSourceOpportunityAssessmentV1 {
  if (input.schemaVersion !== 1)
    throw new CrossSourceOpportunityValidationError('input.schemaVersion must be 1.');
  if (!assessmentId.startsWith('cross-source-opportunity_'))
    throw new CrossSourceOpportunityValidationError('assessmentId is invalid.');
  if (!input.methodVersionId.startsWith('brain-method-version_'))
    throw new CrossSourceOpportunityValidationError('methodVersionId is invalid.');

  assertSignalEvidence(input.lifecycle, 'lifecycle');
  assertSignalEvidence(input.subjectOperatingState, 'subjectOperatingState');
  assertSignalEvidence(input.holderContinuity, 'holderContinuity');
  assertSignalEvidence(input.workspaceRelationship, 'workspaceRelationship');

  const evidenceRefs = uniqueEvidence(
    [
      input.lifecycle.evidenceRefs,
      input.subjectOperatingState.evidenceRefs,
      input.holderContinuity.evidenceRefs,
      input.workspaceRelationship.evidenceRefs
    ],
    'maintenance opportunity'
  );

  let state: CrossSourceOpportunityStateV1;
  let reasonCodes: MaintenanceOpportunityReasonCodeV1[];
  let suggestedReviewKinds: CrossSourceOpportunityAssessmentV1['suggestedReviewKinds'];
  let explanation: string;

  if (input.lifecycle.value === 'NOT_IN_WINDOW') {
    state = 'NOT_SUPPORTED';
    reasonCodes = ['MAINTENANCE_WINDOW_NOT_OPEN'];
    suggestedReviewKinds = [];
    explanation = 'Current lifecycle evidence does not support a maintenance-window opportunity.';
  } else if (input.lifecycle.value === 'UNKNOWN') {
    state = 'INSUFFICIENT_DATA';
    reasonCodes = ['MAINTENANCE_WINDOW_UNKNOWN'];
    suggestedReviewKinds = ['MAINTENANCE_REVIEW'];
    explanation = 'Maintenance timing is not sufficiently established to form a service candidate.';
  } else if (input.holderContinuity.value === 'CHANGED_OR_CONFLICTING') {
    state = 'REVIEW_REQUIRED';
    reasonCodes = ['HOLDER_CONTINUITY_CONFLICT'];
    suggestedReviewKinds = ['OWNERSHIP_OR_SUCCESSION_REVIEW', 'MAINTENANCE_REVIEW'];
    explanation =
      'A maintenance window exists, but holder evidence conflicts. Ownership or succession should be reviewed before treating renewal as a service need.';
  } else if (input.holderContinuity.value === 'RENAMED_OR_SUCCESSOR_EVIDENCE') {
    state = 'REVIEW_REQUIRED';
    reasonCodes = ['RENAME_OR_SUCCESSOR_EVIDENCE'];
    suggestedReviewKinds = ['OWNERSHIP_OR_SUCCESSION_REVIEW', 'MAINTENANCE_REVIEW'];
    explanation =
      'A maintenance window exists with rename or successor evidence. Name-change, ownership cleanup and maintenance should be reviewed together; this evidence does not establish legal succession.';
  } else if (input.subjectOperatingState.value === 'INACTIVE_OR_DISSOLVED') {
    state = 'REVIEW_REQUIRED';
    reasonCodes = ['SUBJECT_INACTIVE_OR_DISSOLVED'];
    suggestedReviewKinds = ['OWNERSHIP_OR_SUCCESSION_REVIEW', 'MAINTENANCE_REVIEW'];
    explanation =
      'A maintenance window exists, but the observed subject is inactive or dissolved. The mark may still have value, so succession, assignment or ownership cleanup should be reviewed before a renewal approach.';
  } else if (
    input.holderContinuity.value === 'UNKNOWN' ||
    input.subjectOperatingState.value === 'UNKNOWN'
  ) {
    state = 'REVIEW_REQUIRED';
    reasonCodes = ['SUBJECT_OR_HOLDER_CURRENTNESS_UNKNOWN'];
    suggestedReviewKinds = ['OWNERSHIP_OR_SUCCESSION_REVIEW', 'MAINTENANCE_REVIEW'];
    explanation =
      'A maintenance window exists, but current subject or holder continuity is not sufficiently established.';
  } else if (input.workspaceRelationship.value === 'HISTORICAL') {
    state = 'REVIEW_REQUIRED';
    reasonCodes = ['WORKSPACE_RELATIONSHIP_HISTORICAL'];
    suggestedReviewKinds = ['CUSTOMER_RELATIONSHIP_REVIEW', 'MAINTENANCE_REVIEW'];
    explanation =
      'Historical representation is source evidence, not a current Customer Relationship. Current relationship must be reviewed before treating maintenance as a service candidate.';
  } else if (
    input.workspaceRelationship.value === 'NONE' ||
    input.workspaceRelationship.value === 'UNKNOWN'
  ) {
    state = 'REVIEW_REQUIRED';
    reasonCodes = ['WORKSPACE_RELATIONSHIP_NOT_CONFIRMED'];
    suggestedReviewKinds = ['CUSTOMER_RELATIONSHIP_REVIEW', 'MAINTENANCE_REVIEW'];
    explanation =
      'The maintenance need may exist, but the Workspace has not confirmed a current or historical customer relationship.';
  } else {
    state = 'SUPPORTED_CANDIDATE';
    reasonCodes = ['MAINTENANCE_WINDOW_WITH_ACTIVE_SUBJECT_AND_CURRENT_HOLDER'];
    suggestedReviewKinds = ['MAINTENANCE_REVIEW'];
    explanation =
      'Cross-source evidence supports a maintenance service candidate for human review. It does not establish customer demand or authorization.';
  }

  const base: Omit<CrossSourceOpportunityAssessmentV1, 'assessmentFingerprintSha256'> = {
    schemaVersion: 1,
    assessmentId,
    family: 'MAINTENANCE',
    methodVersionId: input.methodVersionId,
    trademarkRef: {
      owner: input.trademarkRef.owner,
      kind: text(input.trademarkRef.kind, 'trademarkRef.kind', 160),
      id: text(input.trademarkRef.id, 'trademarkRef.id', 300),
      version: version(input.trademarkRef.version, 'trademarkRef.version'),
      fingerprintSha256: sha(
        input.trademarkRef.fingerprintSha256,
        'trademarkRef.fingerprintSha256'
      ),
      observedAt: at(input.trademarkRef.observedAt, 'trademarkRef.observedAt')
    },
    state,
    reasonCodes,
    suggestedReviewKinds,
    evidenceRefs,
    explanation,
    evaluatedAt: at(input.evaluatedAt, 'evaluatedAt'),
    authorityConsequences: noCrossSourceOpportunityAuthorityConsequencesV1
  };
  return {
    ...base,
    assessmentFingerprintSha256: crossSourceOpportunityAssessmentFingerprintSha256V1(base)
  };
}
