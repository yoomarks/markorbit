import { createHash } from 'node:crypto';
import type { BusinessAttributionReferenceV1 } from './business-attribution.js';

export type PartnerCandidateIdV1 = `partner-candidate_${string}`;
export type PartnerQualificationDecisionIdV1 = `partner-qualification_${string}`;
export const partnerQualificationOutcomesV1 = ['QUALIFIED', 'REJECTED', 'DEFERRED'] as const;
export type PartnerQualificationOutcomeV1 = (typeof partnerQualificationOutcomesV1)[number];

export interface PartnerBriefV1 {
  entityKind: 'FIRM' | 'PROFESSIONAL';
  displayName: string;
  jurisdiction: string;
  serviceFocus: readonly string[];
  observedPublicTrademarkWork: readonly string[];
  chinaInternationalRelevance: string;
  existingWorkspaceHistory: string | null;
  cooperationHypothesis: string;
  uncertainty: readonly string[];
  suggestedOutreach: Readonly<{ subject: string; body: string }>;
}

export const noPartnerCandidateAuthorityConsequencesV1 = Object.freeze({
  providerCreated: false,
  providerCapabilityVerified: false,
  directoryEntryCreated: false,
  contactPermissionGranted: false,
  externalMessageSent: false,
  customerRelationshipCreated: false,
  professionalAppointed: false,
  officialTruthCreated: false
});

export interface PartnerCandidateV1 {
  schemaVersion: 1;
  partnerCandidateId: PartnerCandidateIdV1;
  workspaceId: string;
  version: 1;
  status: 'OPEN_FOR_HUMAN_QUALIFICATION';
  evidenceRefs: readonly Readonly<BusinessAttributionReferenceV1>[];
  brief: Readonly<PartnerBriefV1>;
  admittedByPrincipalId: string;
  admittedAt: string;
  partnerCandidateFingerprintSha256: string;
  authorityConsequences: typeof noPartnerCandidateAuthorityConsequencesV1;
}

export const noPartnerQualificationAuthorityConsequencesV1 = Object.freeze({
  providerCreated: false,
  providerCapabilityVerified: false,
  directoryEntryCreated: false,
  contactPermissionGranted: false,
  externalMessageSent: false,
  professionalAppointed: false,
  officialTruthCreated: false
});

export interface PartnerQualificationDecisionV1 {
  schemaVersion: 1;
  partnerQualificationDecisionId: PartnerQualificationDecisionIdV1;
  workspaceId: string;
  version: 1;
  partnerCandidateId: PartnerCandidateIdV1;
  partnerCandidateVersion: 1;
  partnerCandidateFingerprintSha256: string;
  outcome: PartnerQualificationOutcomeV1;
  rationale: string;
  decidedByPrincipalId: string;
  decidedAt: string;
  partnerQualificationFingerprintSha256: string;
  authorityConsequences: typeof noPartnerQualificationAuthorityConsequencesV1;
}

export class PartnerIntelligenceValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'PartnerIntelligenceValidationError';
  }
}

const SHA = /^[0-9a-f]{64}$/u;
const CANDIDATE = /^partner-candidate_[A-Za-z0-9_-]+$/u;
const DECISION = /^partner-qualification_[A-Za-z0-9_-]+$/u;
const record = (value: unknown, field: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new PartnerIntelligenceValidationError(`${field} must be an object.`);
  return value as Record<string, unknown>;
};
const exact = (value: Record<string, unknown>, fields: readonly string[], name: string) => {
  if (Object.keys(value).sort().join(',') !== [...fields].sort().join(','))
    throw new PartnerIntelligenceValidationError(`${name} must contain exactly the V1 fields.`);
};
const text = (value: unknown, field: string, maximum = 1000): string => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum)
    throw new PartnerIntelligenceValidationError(`${field} is invalid.`);
  return value.trim();
};
const timestamp = (value: unknown, field: string): string => {
  const normalized = text(value, field, 80);
  if (!Number.isFinite(Date.parse(normalized)))
    throw new PartnerIntelligenceValidationError(`${field} must be an ISO timestamp.`);
  return new Date(normalized).toISOString();
};
const sha = (value: unknown, field: string): string => {
  const normalized = text(value, field, 64);
  if (!SHA.test(normalized))
    throw new PartnerIntelligenceValidationError(`${field} must be lowercase SHA-256.`);
  return normalized;
};
const strings = (value: unknown, field: string, required = false): string[] => {
  if (!Array.isArray(value) || value.length > 20 || (required && value.length === 0))
    throw new PartnerIntelligenceValidationError(`${field} must be a bounded array.`);
  const parsed = value.map((item, index) => text(item, `${field}[${index}]`, 1000));
  if (new Set(parsed).size !== parsed.length)
    throw new PartnerIntelligenceValidationError(`${field} must not contain duplicates.`);
  return parsed;
};
const stable = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .filter(([, item]) => item !== undefined)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, item]) => [key, stable(item)])
        )
      : value;
const fingerprint = (value: unknown): string =>
  createHash('sha256')
    .update(JSON.stringify(stable(value)))
    .digest('hex');

function evidence(value: unknown, field: string): BusinessAttributionReferenceV1 {
  const input = record(value, field);
  exact(input, ['owner', 'kind', 'id', 'version', 'fingerprintSha256', 'observedAt'], field);
  const version = input.version;
  if (!(
    (Number.isSafeInteger(version) && Number(version) >= 1) ||
    (typeof version === 'string' && version.trim())
  ))
    throw new PartnerIntelligenceValidationError(`${field}.version is invalid.`);
  return {
    owner: text(input.owner, `${field}.owner`, 120),
    kind: text(input.kind, `${field}.kind`, 160),
    id: text(input.id, `${field}.id`, 500),
    version: typeof version === 'string' ? version.trim() : Number(version),
    fingerprintSha256: sha(input.fingerprintSha256, `${field}.fingerprintSha256`),
    observedAt: timestamp(input.observedAt, `${field}.observedAt`)
  };
}

function brief(value: unknown): PartnerBriefV1 {
  const input = record(value, 'brief');
  exact(
    input,
    [
      'entityKind',
      'displayName',
      'jurisdiction',
      'serviceFocus',
      'observedPublicTrademarkWork',
      'chinaInternationalRelevance',
      'existingWorkspaceHistory',
      'cooperationHypothesis',
      'uncertainty',
      'suggestedOutreach'
    ],
    'brief'
  );
  const outreach = record(input.suggestedOutreach, 'brief.suggestedOutreach');
  exact(outreach, ['subject', 'body'], 'brief.suggestedOutreach');
  if (input.entityKind !== 'FIRM' && input.entityKind !== 'PROFESSIONAL')
    throw new PartnerIntelligenceValidationError('brief.entityKind is invalid.');
  if (input.existingWorkspaceHistory !== null && typeof input.existingWorkspaceHistory !== 'string')
    throw new PartnerIntelligenceValidationError('brief.existingWorkspaceHistory is invalid.');
  return {
    entityKind: input.entityKind,
    displayName: text(input.displayName, 'brief.displayName', 300),
    jurisdiction: text(input.jurisdiction, 'brief.jurisdiction', 120),
    serviceFocus: strings(input.serviceFocus, 'brief.serviceFocus', true),
    observedPublicTrademarkWork: strings(
      input.observedPublicTrademarkWork,
      'brief.observedPublicTrademarkWork',
      true
    ),
    chinaInternationalRelevance: text(
      input.chinaInternationalRelevance,
      'brief.chinaInternationalRelevance',
      2000
    ),
    existingWorkspaceHistory:
      input.existingWorkspaceHistory === null
        ? null
        : text(input.existingWorkspaceHistory, 'brief.existingWorkspaceHistory', 2000),
    cooperationHypothesis: text(input.cooperationHypothesis, 'brief.cooperationHypothesis', 2000),
    uncertainty: strings(input.uncertainty, 'brief.uncertainty', true),
    suggestedOutreach: {
      subject: text(outreach.subject, 'brief.suggestedOutreach.subject', 300),
      body: text(outreach.body, 'brief.suggestedOutreach.body', 10_000)
    }
  };
}

export function partnerCandidateFingerprintSha256V1(
  value: Omit<PartnerCandidateV1, 'partnerCandidateFingerprintSha256'>
): string {
  return fingerprint(value);
}

export function parsePartnerCandidateV1(value: unknown): PartnerCandidateV1 {
  const input = record(value, 'partnerCandidate');
  exact(
    input,
    [
      'schemaVersion',
      'partnerCandidateId',
      'workspaceId',
      'version',
      'status',
      'evidenceRefs',
      'brief',
      'admittedByPrincipalId',
      'admittedAt',
      'partnerCandidateFingerprintSha256',
      'authorityConsequences'
    ],
    'partnerCandidate'
  );
  if (
    input.schemaVersion !== 1 ||
    input.version !== 1 ||
    input.status !== 'OPEN_FOR_HUMAN_QUALIFICATION'
  )
    throw new PartnerIntelligenceValidationError(
      'Partner Candidate schema, version, or status is invalid.'
    );
  const id = text(input.partnerCandidateId, 'partnerCandidateId', 240);
  if (!CANDIDATE.test(id))
    throw new PartnerIntelligenceValidationError('partnerCandidateId is invalid.');
  if (
    !Array.isArray(input.evidenceRefs) ||
    input.evidenceRefs.length < 2 ||
    input.evidenceRefs.length > 20
  )
    throw new PartnerIntelligenceValidationError(
      'evidenceRefs must contain bounded public and Knowledge evidence.'
    );
  const evidenceRefs = input.evidenceRefs.map((item, index) =>
    evidence(item, `evidenceRefs[${index}]`)
  );
  if (
    !evidenceRefs.some(
      (item) => item.owner === 'CORE' && item.kind === 'KNOWLEDGE_READY_PACKAGE'
    ) ||
    !evidenceRefs.some((item) => item.owner === 'PUBLIC_SOURCE')
  )
    throw new PartnerIntelligenceValidationError(
      'Partner Candidate requires exact public evidence and an accepted Knowledge ReadyPackage.'
    );
  const consequences = record(input.authorityConsequences, 'authorityConsequences');
  exact(
    consequences,
    Object.keys(noPartnerCandidateAuthorityConsequencesV1),
    'authorityConsequences'
  );
  if (Object.values(consequences).some((item) => item !== false))
    throw new PartnerIntelligenceValidationError(
      'Partner Candidate authority consequences must remain false.'
    );
  const parsed = {
    schemaVersion: 1 as const,
    partnerCandidateId: id as PartnerCandidateIdV1,
    workspaceId: text(input.workspaceId, 'workspaceId', 80),
    version: 1 as const,
    status: 'OPEN_FOR_HUMAN_QUALIFICATION' as const,
    evidenceRefs,
    brief: brief(input.brief),
    admittedByPrincipalId: text(input.admittedByPrincipalId, 'admittedByPrincipalId', 240),
    admittedAt: timestamp(input.admittedAt, 'admittedAt'),
    authorityConsequences: noPartnerCandidateAuthorityConsequencesV1
  };
  const expected = partnerCandidateFingerprintSha256V1(parsed);
  if (
    sha(input.partnerCandidateFingerprintSha256, 'partnerCandidateFingerprintSha256') !== expected
  )
    throw new PartnerIntelligenceValidationError('Partner Candidate fingerprint mismatch.');
  return { ...parsed, partnerCandidateFingerprintSha256: expected };
}

export function partnerQualificationFingerprintSha256V1(
  value: Omit<PartnerQualificationDecisionV1, 'partnerQualificationFingerprintSha256'>
): string {
  return fingerprint(value);
}

export function parsePartnerQualificationDecisionV1(
  value: unknown
): PartnerQualificationDecisionV1 {
  const input = record(value, 'partnerQualificationDecision');
  exact(
    input,
    [
      'schemaVersion',
      'partnerQualificationDecisionId',
      'workspaceId',
      'version',
      'partnerCandidateId',
      'partnerCandidateVersion',
      'partnerCandidateFingerprintSha256',
      'outcome',
      'rationale',
      'decidedByPrincipalId',
      'decidedAt',
      'partnerQualificationFingerprintSha256',
      'authorityConsequences'
    ],
    'partnerQualificationDecision'
  );
  if (input.schemaVersion !== 1 || input.version !== 1 || input.partnerCandidateVersion !== 1)
    throw new PartnerIntelligenceValidationError(
      'Partner Qualification schema/version is invalid.'
    );
  const id = text(input.partnerQualificationDecisionId, 'partnerQualificationDecisionId', 240);
  const candidateId = text(input.partnerCandidateId, 'partnerCandidateId', 240);
  if (!DECISION.test(id) || !CANDIDATE.test(candidateId))
    throw new PartnerIntelligenceValidationError('Partner Qualification identity is invalid.');
  if (
    typeof input.outcome !== 'string' ||
    !partnerQualificationOutcomesV1.includes(input.outcome as PartnerQualificationOutcomeV1)
  )
    throw new PartnerIntelligenceValidationError('Partner Qualification outcome is invalid.');
  const consequences = record(input.authorityConsequences, 'authorityConsequences');
  exact(
    consequences,
    Object.keys(noPartnerQualificationAuthorityConsequencesV1),
    'authorityConsequences'
  );
  if (Object.values(consequences).some((item) => item !== false))
    throw new PartnerIntelligenceValidationError(
      'Partner Qualification authority consequences must remain false.'
    );
  const parsed = {
    schemaVersion: 1 as const,
    partnerQualificationDecisionId: id as PartnerQualificationDecisionIdV1,
    workspaceId: text(input.workspaceId, 'workspaceId', 80),
    version: 1 as const,
    partnerCandidateId: candidateId as PartnerCandidateIdV1,
    partnerCandidateVersion: 1 as const,
    partnerCandidateFingerprintSha256: sha(
      input.partnerCandidateFingerprintSha256,
      'partnerCandidateFingerprintSha256'
    ),
    outcome: input.outcome as PartnerQualificationOutcomeV1,
    rationale: text(input.rationale, 'rationale', 3000),
    decidedByPrincipalId: text(input.decidedByPrincipalId, 'decidedByPrincipalId', 240),
    decidedAt: timestamp(input.decidedAt, 'decidedAt'),
    authorityConsequences: noPartnerQualificationAuthorityConsequencesV1
  };
  const expected = partnerQualificationFingerprintSha256V1(parsed);
  if (
    sha(input.partnerQualificationFingerprintSha256, 'partnerQualificationFingerprintSha256') !==
    expected
  )
    throw new PartnerIntelligenceValidationError('Partner Qualification fingerprint mismatch.');
  return { ...parsed, partnerQualificationFingerprintSha256: expected };
}
