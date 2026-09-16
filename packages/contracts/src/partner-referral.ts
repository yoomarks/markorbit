import { createHash } from 'node:crypto';
import type {
  BusinessAttributionLinkIdV1,
  BusinessAttributionReferenceV1
} from './business-attribution.js';
import type { WorkspaceDirectoryEntryId } from './workspace-directory.js';

export type PartnerReferralProgramIdV1 = `partner-referral-program_${string}`;
export type PartnerReferralPolicyIdV1 = `partner-referral-policy_${string}`;
export type PartnerCommissionEligibilityCandidateIdV1 = `partner-commission-eligibility_${string}`;

export interface PartnerReferralDirectoryReferenceV1 {
  owner: 'LITE';
  kind: 'WORKSPACE_DIRECTORY_ENTRY';
  id: WorkspaceDirectoryEntryId;
  version: number;
  fingerprintSha256: string;
}

export interface PartnerReferralEligibilityPolicyV1 {
  partnerReferralPolicyId: PartnerReferralPolicyIdV1;
  version: 1;
  requiredAttributionState: 'ATTRIBUTED';
  requiredEvidenceBasis: 'EXACT_LINEAGE';
  qualifyingDownstreamOwner: 'MARKREG';
  qualifyingDownstreamKind: 'FORMAL_MATTER';
  effectiveAt: string;
  ratePolicy: Readonly<{
    owner: 'CORE';
    kind: 'REFERRAL_COMMISSION';
    id: string;
    version: number;
    fingerprintSha256: string;
  }>;
  policyFingerprintSha256: string;
}

export const noPartnerReferralProgramAuthorityConsequencesV1 = Object.freeze({
  legalIdentityVerified: false,
  partnerEnrolledAutonomously: false,
  customerDataAccessGranted: false,
  paymentAuthorized: false,
  settlementCreated: false,
  payoutCreated: false
});

export interface PartnerReferralProgramV1 {
  schemaVersion: 1;
  partnerReferralProgramId: PartnerReferralProgramIdV1;
  workspaceId: string;
  version: 1;
  referralCode: string;
  partner: Readonly<PartnerReferralDirectoryReferenceV1>;
  policy: Readonly<PartnerReferralEligibilityPolicyV1>;
  status: 'ACTIVE';
  createdByPrincipalId: string;
  createdAt: string;
  programFingerprintSha256: string;
  authorityConsequences: typeof noPartnerReferralProgramAuthorityConsequencesV1;
}

export const noPartnerCommissionEligibilityAuthorityConsequencesV1 = Object.freeze({
  conversionCreated: false,
  commissionAmountCalculated: false,
  paymentSuccessClaimed: false,
  settlementClaimed: false,
  payoutCompleted: false,
  customerDataAccessGranted: false
});

export interface PartnerCommissionEligibilityCandidateV1 {
  schemaVersion: 1;
  partnerCommissionEligibilityCandidateId: PartnerCommissionEligibilityCandidateIdV1;
  workspaceId: string;
  version: 1;
  program: Readonly<{
    id: PartnerReferralProgramIdV1;
    version: 1;
    fingerprintSha256: string;
  }>;
  partner: Readonly<PartnerReferralDirectoryReferenceV1>;
  policy: Readonly<{
    id: PartnerReferralPolicyIdV1;
    version: 1;
    fingerprintSha256: string;
  }>;
  siteInboundAttribution: Readonly<{
    id: BusinessAttributionLinkIdV1;
    version: 1;
    fingerprintSha256: string;
  }>;
  downstreamRef: Readonly<BusinessAttributionReferenceV1>;
  outcome: 'ELIGIBLE_FOR_COMMISSION_REVIEW';
  evaluatedByPrincipalId: string;
  evaluatedAt: string;
  eligibilityFingerprintSha256: string;
  authorityConsequences: typeof noPartnerCommissionEligibilityAuthorityConsequencesV1;
}

export class PartnerReferralValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'PartnerReferralValidationError';
  }
}

type JsonObject = Record<string, unknown>;
const SHA256 = /^[0-9a-f]{64}$/u;
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,79}$/u;
const PROGRAM_ID = /^partner-referral-program_[A-Za-z0-9_-]+$/u;
const POLICY_ID = /^partner-referral-policy_[A-Za-z0-9_-]+$/u;
const CANDIDATE_ID = /^partner-commission-eligibility_[A-Za-z0-9_-]+$/u;
const DIRECTORY_ID = /^workspace-directory-entry_[A-Za-z0-9_-]+$/u;
const ATTRIBUTION_ID = /^business-attribution_[A-Za-z0-9_-]+$/u;

function object(value: unknown, field: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new PartnerReferralValidationError(`${field} must be an object.`);
  return value as JsonObject;
}

function exact(value: JsonObject, fields: readonly string[], field: string): void {
  if (Object.keys(value).sort().join(',') !== [...fields].sort().join(','))
    throw new PartnerReferralValidationError(`${field} must contain exactly the V1 fields.`);
}

function text(value: unknown, field: string, maximum = 300): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum)
    throw new PartnerReferralValidationError(`${field} is invalid.`);
  return value.trim();
}

function timestamp(value: unknown, field: string): string {
  const normalized = text(value, field, 80);
  if (!Number.isFinite(Date.parse(normalized)))
    throw new PartnerReferralValidationError(`${field} must be an ISO timestamp.`);
  return new Date(normalized).toISOString();
}

function sha(value: unknown, field: string): string {
  const normalized = text(value, field, 64);
  if (!SHA256.test(normalized))
    throw new PartnerReferralValidationError(`${field} must be lowercase SHA-256.`);
  return normalized;
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

function directoryReference(value: unknown): PartnerReferralDirectoryReferenceV1 {
  const input = object(value, 'partner');
  exact(input, ['owner', 'kind', 'id', 'version', 'fingerprintSha256'], 'partner');
  const id = text(input.id, 'partner.id');
  if (
    input.owner !== 'LITE' ||
    input.kind !== 'WORKSPACE_DIRECTORY_ENTRY' ||
    !DIRECTORY_ID.test(id) ||
    !Number.isSafeInteger(input.version) ||
    Number(input.version) < 1
  )
    throw new PartnerReferralValidationError('partner reference is invalid.');
  return {
    owner: 'LITE',
    kind: 'WORKSPACE_DIRECTORY_ENTRY',
    id: id as WorkspaceDirectoryEntryId,
    version: Number(input.version),
    fingerprintSha256: sha(input.fingerprintSha256, 'partner.fingerprintSha256')
  };
}

export function partnerReferralPolicyFingerprintSha256V1(
  value: Omit<PartnerReferralEligibilityPolicyV1, 'policyFingerprintSha256'>
): string {
  return fingerprint(value);
}

function policy(value: unknown): PartnerReferralEligibilityPolicyV1 {
  const input = object(value, 'policy');
  exact(
    input,
    [
      'partnerReferralPolicyId',
      'version',
      'requiredAttributionState',
      'requiredEvidenceBasis',
      'qualifyingDownstreamOwner',
      'qualifyingDownstreamKind',
      'effectiveAt',
      'ratePolicy',
      'policyFingerprintSha256'
    ],
    'policy'
  );
  const id = text(input.partnerReferralPolicyId, 'policy.partnerReferralPolicyId');
  if (
    !POLICY_ID.test(id) ||
    input.version !== 1 ||
    input.requiredAttributionState !== 'ATTRIBUTED' ||
    input.requiredEvidenceBasis !== 'EXACT_LINEAGE' ||
    input.qualifyingDownstreamOwner !== 'MARKREG' ||
    input.qualifyingDownstreamKind !== 'FORMAL_MATTER'
  )
    throw new PartnerReferralValidationError('policy eligibility rule is invalid.');
  const parsed = {
    partnerReferralPolicyId: id as PartnerReferralPolicyIdV1,
    version: 1 as const,
    requiredAttributionState: 'ATTRIBUTED' as const,
    requiredEvidenceBasis: 'EXACT_LINEAGE' as const,
    qualifyingDownstreamOwner: 'MARKREG' as const,
    qualifyingDownstreamKind: 'FORMAL_MATTER' as const,
    effectiveAt: timestamp(input.effectiveAt, 'policy.effectiveAt'),
    ratePolicy: (() => {
      const ratePolicy = object(input.ratePolicy, 'policy.ratePolicy');
      exact(
        ratePolicy,
        ['owner', 'kind', 'id', 'version', 'fingerprintSha256'],
        'policy.ratePolicy'
      );
      if (
        ratePolicy.owner !== 'CORE' ||
        ratePolicy.kind !== 'REFERRAL_COMMISSION' ||
        !Number.isSafeInteger(ratePolicy.version) ||
        Number(ratePolicy.version) < 1
      )
        throw new PartnerReferralValidationError('policy.ratePolicy is invalid.');
      return {
        owner: 'CORE' as const,
        kind: 'REFERRAL_COMMISSION' as const,
        id: text(ratePolicy.id, 'policy.ratePolicy.id'),
        version: Number(ratePolicy.version),
        fingerprintSha256: sha(ratePolicy.fingerprintSha256, 'policy.ratePolicy.fingerprintSha256')
      };
    })()
  };
  const expected = partnerReferralPolicyFingerprintSha256V1(parsed);
  if (sha(input.policyFingerprintSha256, 'policy.policyFingerprintSha256') !== expected)
    throw new PartnerReferralValidationError('policy fingerprint mismatch.');
  return { ...parsed, policyFingerprintSha256: expected };
}

function authority(value: unknown, expected: Readonly<Record<string, false>>, field: string) {
  const input = object(value, field);
  exact(input, Object.keys(expected), field);
  if (Object.values(input).some((item) => item !== false))
    throw new PartnerReferralValidationError(`${field} must remain false.`);
  return expected;
}

export function partnerReferralProgramFingerprintSha256V1(
  value: Omit<PartnerReferralProgramV1, 'programFingerprintSha256'>
): string {
  return fingerprint(value);
}

export function parsePartnerReferralProgramV1(value: unknown): PartnerReferralProgramV1 {
  const input = object(value, 'partnerReferralProgram');
  exact(
    input,
    [
      'schemaVersion',
      'partnerReferralProgramId',
      'workspaceId',
      'version',
      'referralCode',
      'partner',
      'policy',
      'status',
      'createdByPrincipalId',
      'createdAt',
      'programFingerprintSha256',
      'authorityConsequences'
    ],
    'partnerReferralProgram'
  );
  const id = text(input.partnerReferralProgramId, 'partnerReferralProgramId');
  const referralCode = text(input.referralCode, 'referralCode', 80);
  if (
    input.schemaVersion !== 1 ||
    input.version !== 1 ||
    input.status !== 'ACTIVE' ||
    !PROGRAM_ID.test(id) ||
    !TOKEN.test(referralCode)
  )
    throw new PartnerReferralValidationError('Partner Referral Program identity/state is invalid.');
  const parsed = {
    schemaVersion: 1 as const,
    partnerReferralProgramId: id as PartnerReferralProgramIdV1,
    workspaceId: text(input.workspaceId, 'workspaceId', 80),
    version: 1 as const,
    referralCode,
    partner: directoryReference(input.partner),
    policy: policy(input.policy),
    status: 'ACTIVE' as const,
    createdByPrincipalId: text(input.createdByPrincipalId, 'createdByPrincipalId', 240),
    createdAt: timestamp(input.createdAt, 'createdAt'),
    authorityConsequences: authority(
      input.authorityConsequences,
      noPartnerReferralProgramAuthorityConsequencesV1,
      'authorityConsequences'
    ) as typeof noPartnerReferralProgramAuthorityConsequencesV1
  };
  const expected = partnerReferralProgramFingerprintSha256V1(parsed);
  if (sha(input.programFingerprintSha256, 'programFingerprintSha256') !== expected)
    throw new PartnerReferralValidationError('Partner Referral Program fingerprint mismatch.');
  return { ...parsed, programFingerprintSha256: expected };
}

function reference(value: unknown): BusinessAttributionReferenceV1 {
  const input = object(value, 'downstreamRef');
  exact(
    input,
    ['owner', 'kind', 'id', 'version', 'fingerprintSha256', 'observedAt'],
    'downstreamRef'
  );
  if (
    input.owner !== 'MARKREG' ||
    input.kind !== 'FORMAL_MATTER' ||
    !Number.isSafeInteger(input.version) ||
    Number(input.version) < 1
  )
    throw new PartnerReferralValidationError('downstreamRef must be an exact Formal Matter.');
  return {
    owner: 'MARKREG',
    kind: 'FORMAL_MATTER',
    id: text(input.id, 'downstreamRef.id'),
    version: Number(input.version),
    fingerprintSha256: sha(input.fingerprintSha256, 'downstreamRef.fingerprintSha256'),
    observedAt: timestamp(input.observedAt, 'downstreamRef.observedAt')
  };
}

export function partnerCommissionEligibilityFingerprintSha256V1(
  value: Omit<PartnerCommissionEligibilityCandidateV1, 'eligibilityFingerprintSha256'>
): string {
  return fingerprint(value);
}

export function parsePartnerCommissionEligibilityCandidateV1(
  value: unknown
): PartnerCommissionEligibilityCandidateV1 {
  const input = object(value, 'partnerCommissionEligibilityCandidate');
  exact(
    input,
    [
      'schemaVersion',
      'partnerCommissionEligibilityCandidateId',
      'workspaceId',
      'version',
      'program',
      'partner',
      'policy',
      'siteInboundAttribution',
      'downstreamRef',
      'outcome',
      'evaluatedByPrincipalId',
      'evaluatedAt',
      'eligibilityFingerprintSha256',
      'authorityConsequences'
    ],
    'partnerCommissionEligibilityCandidate'
  );
  const id = text(
    input.partnerCommissionEligibilityCandidateId,
    'partnerCommissionEligibilityCandidateId'
  );
  if (
    input.schemaVersion !== 1 ||
    input.version !== 1 ||
    input.outcome !== 'ELIGIBLE_FOR_COMMISSION_REVIEW' ||
    !CANDIDATE_ID.test(id)
  )
    throw new PartnerReferralValidationError('Commission Eligibility Candidate state is invalid.');
  const program = object(input.program, 'program');
  exact(program, ['id', 'version', 'fingerprintSha256'], 'program');
  const programId = text(program.id, 'program.id');
  const policyRef = object(input.policy, 'policy');
  exact(policyRef, ['id', 'version', 'fingerprintSha256'], 'policy');
  const policyId = text(policyRef.id, 'policy.id');
  const attribution = object(input.siteInboundAttribution, 'siteInboundAttribution');
  exact(attribution, ['id', 'version', 'fingerprintSha256'], 'siteInboundAttribution');
  const attributionId = text(attribution.id, 'siteInboundAttribution.id');
  if (
    !PROGRAM_ID.test(programId) ||
    program.version !== 1 ||
    !POLICY_ID.test(policyId) ||
    policyRef.version !== 1 ||
    !ATTRIBUTION_ID.test(attributionId) ||
    attribution.version !== 1
  )
    throw new PartnerReferralValidationError('Eligibility exact references are invalid.');
  const parsed = {
    schemaVersion: 1 as const,
    partnerCommissionEligibilityCandidateId: id as PartnerCommissionEligibilityCandidateIdV1,
    workspaceId: text(input.workspaceId, 'workspaceId', 80),
    version: 1 as const,
    program: {
      id: programId as PartnerReferralProgramIdV1,
      version: 1 as const,
      fingerprintSha256: sha(program.fingerprintSha256, 'program.fingerprintSha256')
    },
    partner: directoryReference(input.partner),
    policy: {
      id: policyId as PartnerReferralPolicyIdV1,
      version: 1 as const,
      fingerprintSha256: sha(policyRef.fingerprintSha256, 'policy.fingerprintSha256')
    },
    siteInboundAttribution: {
      id: attributionId as BusinessAttributionLinkIdV1,
      version: 1 as const,
      fingerprintSha256: sha(
        attribution.fingerprintSha256,
        'siteInboundAttribution.fingerprintSha256'
      )
    },
    downstreamRef: reference(input.downstreamRef),
    outcome: 'ELIGIBLE_FOR_COMMISSION_REVIEW' as const,
    evaluatedByPrincipalId: text(input.evaluatedByPrincipalId, 'evaluatedByPrincipalId', 240),
    evaluatedAt: timestamp(input.evaluatedAt, 'evaluatedAt'),
    authorityConsequences: authority(
      input.authorityConsequences,
      noPartnerCommissionEligibilityAuthorityConsequencesV1,
      'authorityConsequences'
    ) as typeof noPartnerCommissionEligibilityAuthorityConsequencesV1
  };
  const expected = partnerCommissionEligibilityFingerprintSha256V1(parsed);
  if (sha(input.eligibilityFingerprintSha256, 'eligibilityFingerprintSha256') !== expected)
    throw new PartnerReferralValidationError('Commission Eligibility fingerprint mismatch.');
  return { ...parsed, eligibilityFingerprintSha256: expected };
}
