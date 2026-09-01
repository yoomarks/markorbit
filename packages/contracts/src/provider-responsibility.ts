import type { MarkOrbitId } from './index.js';
import type { ProviderId } from './provider-execution.js';

/**
 * Provider Responsibility V1 is the canonical MGSN network disclosure boundary for
 * Direct-to-Executor / No Rebrokering. It does not replace Provider Registry identity or
 * operational state and creates no Selection, Allocation, Acceptance, appointment, contact,
 * Filing, Payment or Official Truth authority.
 */
export type ProviderResponsibilityProfileId = `provider-responsibility_${string}`;

export const providerResponsibilityProfileStatuses = ['CURRENT', 'SUSPENDED', 'REVOKED'] as const;
export type ProviderResponsibilityProfileStatus =
  (typeof providerResponsibilityProfileStatuses)[number];

export const providerResponsibilityAuthorityStates = [
  'CURRENT',
  'STALE',
  'AMBIGUOUS',
  'UNAVAILABLE'
] as const;
export type ProviderResponsibilityAuthorityState =
  (typeof providerResponsibilityAuthorityStates)[number];

export const providerFinalExecutorStatuses = [
  'UNKNOWN',
  'PROVIDER_IS_FINAL_EXECUTOR',
  'PROVIDER_IS_NOT_FINAL_EXECUTOR'
] as const;
export type ProviderFinalExecutorStatus = (typeof providerFinalExecutorStatuses)[number];

export const providerDirectResponsibilityStatuses = [
  'UNKNOWN',
  'ATTESTED',
  'VERIFIED',
  'DENIED',
  'DISPUTED'
] as const;
export type ProviderDirectResponsibilityStatus =
  (typeof providerDirectResponsibilityStatuses)[number];

export const noRebrokeringCommitmentStates = [
  'UNKNOWN',
  'COMMITTED',
  'SUSPENDED',
  'REVOKED',
  'VIOLATION_RECORDED'
] as const;
export type NoRebrokeringCommitmentState = (typeof noRebrokeringCommitmentStates)[number];

export const providerIntermediaryDisclosureStates = [
  'UNKNOWN',
  'NO_INTERMEDIARY_DISCLOSED',
  'LEGALLY_REQUIRED_SIGNER_ONLY',
  'REBROKERING_OR_SUBAGENT_DISCLOSED'
] as const;
export type ProviderIntermediaryDisclosureState =
  (typeof providerIntermediaryDisclosureStates)[number];

export const providerResponsibilityEvidenceAuthorityClasses = [
  'PROVIDER_ATTESTATION',
  'ORGANIZATION_ATTESTATION',
  'MGSN_VERIFIED_REFERENCE',
  'CANONICAL_OWNER_REFERENCE',
  'LEGAL_REQUIREMENT_REFERENCE'
] as const;
export type ProviderResponsibilityEvidenceAuthorityClass =
  (typeof providerResponsibilityEvidenceAuthorityClasses)[number];

export const providerResponsibilityEvidenceVerificationStates = [
  'CLAIM_ONLY',
  'INDEPENDENTLY_VERIFIED',
  'DISPUTED',
  'REVOKED'
] as const;
export type ProviderResponsibilityEvidenceVerificationState =
  (typeof providerResponsibilityEvidenceVerificationStates)[number];

export type ProviderResponsibilityEvidenceSourceOwner =
  | 'CORE'
  | 'MGSN'
  | 'EXECUTION'
  | 'KNOWLEDGE'
  | 'CAPABILITY_ENGINE'
  | 'OTHER_CANONICAL_OWNER';

/** Evidence reference visibility never grants retrieval of an underlying private artifact. */
export interface ProviderResponsibilityEvidenceReferenceV1 {
  evidenceReference: string;
  sourceOwner: ProviderResponsibilityEvidenceSourceOwner;
  sourceType: string;
  sourceId: string;
  sourceVersion: number | string;
  sourceFingerprintSha256: string;
  authorityClass: ProviderResponsibilityEvidenceAuthorityClass;
  verificationState: ProviderResponsibilityEvidenceVerificationState;
  observedAt: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
  artifactAccessAuthorized: false;
}

/** Bounded team reference only. Contacts, client relationships and whole organization records stay out. */
export interface ProviderResponsibilityExecutionTeamReferenceV1 {
  teamReference: string;
  roleReference: string;
  identityAuthorityReference: string;
  contactDataEmbedded: false;
}

export type ProviderLegallyRequiredDistinctSignerV1 =
  | Readonly<{
      kind: 'NONE';
      distinctSignerRequired: false;
    }>
  | Readonly<{
      kind: 'REQUIRED';
      distinctSignerRequired: true;
      signerReference: string;
      signerIdentityAuthorityReference: string;
      legalBasisReference: string;
      jurisdiction: string;
      function: 'SIGNING_OR_FILING_ONLY';
      transparentlyDisclosed: true;
      receivesHandoffDataByDefault: false;
      doesNotReplaceFinalExecutionProvider: true;
    }>;

export interface ProviderResponsibilityAuthorityConsequencesV1 {
  providerSelected: false;
  providerAllocated: false;
  providerAccepted: false;
  providerEngaged: false;
  professionalAppointmentCreated: false;
  externalContactAuthorized: false;
  protectedActionReleased: false;
  filingAuthorized: false;
  filingSubmitted: false;
  paymentAuthorized: false;
  officialTruthCreated: false;
}

export const noProviderResponsibilityAuthorityConsequences = Object.freeze({
  providerSelected: false,
  providerAllocated: false,
  providerAccepted: false,
  providerEngaged: false,
  professionalAppointmentCreated: false,
  externalContactAuthorized: false,
  protectedActionReleased: false,
  filingAuthorized: false,
  filingSubmitted: false,
  paymentAuthorized: false,
  officialTruthCreated: false
}) satisfies Readonly<ProviderResponsibilityAuthorityConsequencesV1>;

/**
 * Independent responsibility/disclosure truth. Provider operational status, Network Participation
 * and Visibility Policy remain separate authorities and are intentionally not fields of this record.
 */
export interface ProviderResponsibilityProfileV1 {
  schemaVersion: 1;
  providerResponsibilityProfileId: ProviderResponsibilityProfileId;
  providerId: ProviderId;
  providerWorkspaceId: string;
  status: ProviderResponsibilityProfileStatus;
  finalExecutorStatus: ProviderFinalExecutorStatus;
  directResponsibilityStatus: ProviderDirectResponsibilityStatus;
  noRebrokeringCommitmentState: NoRebrokeringCommitmentState;
  intermediaryDisclosureState: ProviderIntermediaryDisclosureState;
  executionTeamReferences: ReadonlyArray<ProviderResponsibilityExecutionTeamReferenceV1>;
  legallyRequiredDistinctSigner: ProviderLegallyRequiredDistinctSignerV1;
  evidenceReferences: ReadonlyArray<ProviderResponsibilityEvidenceReferenceV1>;
  authorityState: ProviderResponsibilityAuthorityState;
  effectiveFrom: string;
  effectiveUntil?: string;
  checkedAt: string;
  version: number;
  profileFingerprintSha256: string;
  correlationId: MarkOrbitId;
  authorityConsequences: Readonly<ProviderResponsibilityAuthorityConsequencesV1>;
}

export interface ProviderResponsibilityProfileReferenceV1 {
  providerResponsibilityProfileId: ProviderResponsibilityProfileId;
  version: number;
  profileFingerprintSha256: string;
}

export const providerDirectExecutorAssessmentStates = [
  'DIRECT_FINAL_EXECUTOR_ESTABLISHED',
  'DIRECT_EXECUTOR_WITH_REQUIRED_SIGNER_ESTABLISHED',
  'UNKNOWN_OR_UNPROVEN',
  'PROVIDER_NOT_FINAL_EXECUTOR',
  'REBROKERING_OR_SUBAGENT_DISCLOSED',
  'NO_REBROKERING_COMMITMENT_NOT_CURRENT',
  'RESPONSIBILITY_DISPUTED',
  'PROFILE_SUSPENDED',
  'PROFILE_REVOKED',
  'AUTHORITY_NOT_CURRENT',
  'AUTHORITY_UNAVAILABLE'
] as const;
export type ProviderDirectExecutorAssessmentState =
  (typeof providerDirectExecutorAssessmentStates)[number];

interface ProviderDirectExecutorAssessmentBaseV1 {
  schemaVersion: 1;
  provider: Readonly<{
    providerId: ProviderId;
    providerWorkspaceId: string;
  }>;
  profile: Readonly<ProviderResponsibilityProfileReferenceV1>;
  evidenceReferences: readonly string[];
  checkedAt: string;
  assessmentPolicyVersion: string;
  assessmentFingerprintSha256: string;
  hiddenIntermediaryAllowed: false;
  currentAuthorityRevalidationRequiredBeforeUse: true;
  authorityConsequences: Readonly<ProviderResponsibilityAuthorityConsequencesV1>;
}

export type ProviderDirectExecutorAssessmentV1 = Readonly<
  ProviderDirectExecutorAssessmentBaseV1 &
    (
      | {
          state: 'DIRECT_FINAL_EXECUTOR_ESTABLISHED';
          directExecutorEstablished: true;
          profileAuthorityState: 'CURRENT';
          finalExecutionProviderId: ProviderId;
          finalExecutionProviderWorkspaceId: string;
          legallyRequiredDistinctSigner: Readonly<{
            kind: 'NONE';
            distinctSignerRequired: false;
          }>;
        }
      | {
          state: 'DIRECT_EXECUTOR_WITH_REQUIRED_SIGNER_ESTABLISHED';
          directExecutorEstablished: true;
          profileAuthorityState: 'CURRENT';
          finalExecutionProviderId: ProviderId;
          finalExecutionProviderWorkspaceId: string;
          legallyRequiredDistinctSigner: Extract<
            ProviderLegallyRequiredDistinctSignerV1,
            { kind: 'REQUIRED' }
          >;
        }
      | {
          state: Exclude<
            ProviderDirectExecutorAssessmentState,
            | 'DIRECT_FINAL_EXECUTOR_ESTABLISHED'
            | 'DIRECT_EXECUTOR_WITH_REQUIRED_SIGNER_ESTABLISHED'
          >;
          directExecutorEstablished: false;
          profileAuthorityState: ProviderResponsibilityAuthorityState;
          publicReason: string;
        }
    )
>;

/**
 * Missing, negative, stale or ambiguous responsibility proof is fail-closed for a discovery path
 * that requires established Direct-to-Executor responsibility. A positive historical assessment
 * still requires current authority revalidation before reuse.
 */
export function directExecutorAssessmentEstablishesResponsibilityV1(
  assessment: ProviderDirectExecutorAssessmentV1 | null | undefined
): assessment is Extract<ProviderDirectExecutorAssessmentV1, { directExecutorEstablished: true }> {
  return assessment?.directExecutorEstablished === true && assessment.profileAuthorityState === 'CURRENT';
}

const responsibilityFixtureProviderId = 'provider_fixture-375' as const satisfies ProviderId;
const responsibilityFixtureWorkspaceId = '018f0000-0000-7000-8000-000000000375';
const responsibilityFixtureAt = '2026-09-01T12:40:00.000Z';
const responsibilityFixtureProfileId =
  'provider-responsibility_fixture-375' as const satisfies ProviderResponsibilityProfileId;

export const providerResponsibilityUnknownFixtureV1 = Object.freeze({
  schemaVersion: 1,
  providerResponsibilityProfileId: responsibilityFixtureProfileId,
  providerId: responsibilityFixtureProviderId,
  providerWorkspaceId: responsibilityFixtureWorkspaceId,
  status: 'CURRENT',
  finalExecutorStatus: 'UNKNOWN',
  directResponsibilityStatus: 'UNKNOWN',
  noRebrokeringCommitmentState: 'UNKNOWN',
  intermediaryDisclosureState: 'UNKNOWN',
  executionTeamReferences: [],
  legallyRequiredDistinctSigner: { kind: 'NONE', distinctSignerRequired: false },
  evidenceReferences: [],
  authorityState: 'CURRENT',
  effectiveFrom: responsibilityFixtureAt,
  checkedAt: responsibilityFixtureAt,
  version: 1,
  profileFingerprintSha256: '1'.repeat(64),
  correlationId: 'correlation_provider_responsibility_375',
  authorityConsequences: noProviderResponsibilityAuthorityConsequences
}) satisfies Readonly<ProviderResponsibilityProfileV1>;

export const providerResponsibilityDirectFixtureV1 = Object.freeze({
  ...providerResponsibilityUnknownFixtureV1,
  finalExecutorStatus: 'PROVIDER_IS_FINAL_EXECUTOR',
  directResponsibilityStatus: 'VERIFIED',
  noRebrokeringCommitmentState: 'COMMITTED',
  intermediaryDisclosureState: 'NO_INTERMEDIARY_DISCLOSED',
  evidenceReferences: [
    {
      evidenceReference: 'provider-responsibility-evidence:fixture-375',
      sourceOwner: 'MGSN',
      sourceType: 'DIRECT_EXECUTOR_VERIFICATION',
      sourceId: 'responsibility-verification_fixture-375',
      sourceVersion: 2,
      sourceFingerprintSha256: '2'.repeat(64),
      authorityClass: 'MGSN_VERIFIED_REFERENCE',
      verificationState: 'INDEPENDENTLY_VERIFIED',
      observedAt: responsibilityFixtureAt,
      artifactAccessAuthorized: false
    }
  ],
  version: 2,
  profileFingerprintSha256: '3'.repeat(64)
}) satisfies Readonly<ProviderResponsibilityProfileV1>;

export const providerResponsibilityRequiredSignerFixtureV1 = Object.freeze({
  ...providerResponsibilityDirectFixtureV1,
  intermediaryDisclosureState: 'LEGALLY_REQUIRED_SIGNER_ONLY',
  legallyRequiredDistinctSigner: {
    kind: 'REQUIRED',
    distinctSignerRequired: true,
    signerReference: 'organization:licensed-filing-entity-375',
    signerIdentityAuthorityReference: 'core-organization:licensed-filing-entity-375',
    legalBasisReference: 'legal-basis:jurisdiction-signing-rule-375',
    jurisdiction: 'US',
    function: 'SIGNING_OR_FILING_ONLY',
    transparentlyDisclosed: true,
    receivesHandoffDataByDefault: false,
    doesNotReplaceFinalExecutionProvider: true
  },
  version: 3,
  profileFingerprintSha256: '4'.repeat(64)
}) satisfies Readonly<ProviderResponsibilityProfileV1>;

export const providerResponsibilityRebrokeringFixtureV1 = Object.freeze({
  ...providerResponsibilityDirectFixtureV1,
  finalExecutorStatus: 'PROVIDER_IS_NOT_FINAL_EXECUTOR',
  directResponsibilityStatus: 'DENIED',
  noRebrokeringCommitmentState: 'VIOLATION_RECORDED',
  intermediaryDisclosureState: 'REBROKERING_OR_SUBAGENT_DISCLOSED',
  version: 4,
  profileFingerprintSha256: '5'.repeat(64)
}) satisfies Readonly<ProviderResponsibilityProfileV1>;

export const providerDirectExecutorEstablishedFixtureV1 = Object.freeze({
  schemaVersion: 1,
  provider: {
    providerId: responsibilityFixtureProviderId,
    providerWorkspaceId: responsibilityFixtureWorkspaceId
  },
  profile: {
    providerResponsibilityProfileId: responsibilityFixtureProfileId,
    version: providerResponsibilityDirectFixtureV1.version,
    profileFingerprintSha256: providerResponsibilityDirectFixtureV1.profileFingerprintSha256
  },
  state: 'DIRECT_FINAL_EXECUTOR_ESTABLISHED',
  directExecutorEstablished: true,
  profileAuthorityState: 'CURRENT',
  finalExecutionProviderId: responsibilityFixtureProviderId,
  finalExecutionProviderWorkspaceId: responsibilityFixtureWorkspaceId,
  legallyRequiredDistinctSigner: { kind: 'NONE', distinctSignerRequired: false },
  evidenceReferences: providerResponsibilityDirectFixtureV1.evidenceReferences.map(
    (evidence) => evidence.evidenceReference
  ),
  checkedAt: responsibilityFixtureAt,
  assessmentPolicyVersion: 'mgsn-provider-responsibility-v1',
  assessmentFingerprintSha256: '6'.repeat(64),
  hiddenIntermediaryAllowed: false,
  currentAuthorityRevalidationRequiredBeforeUse: true,
  authorityConsequences: noProviderResponsibilityAuthorityConsequences
}) satisfies Readonly<ProviderDirectExecutorAssessmentV1>;

export const providerDirectExecutorRequiredSignerFixtureV1 = Object.freeze({
  ...providerDirectExecutorEstablishedFixtureV1,
  profile: {
    providerResponsibilityProfileId: responsibilityFixtureProfileId,
    version: providerResponsibilityRequiredSignerFixtureV1.version,
    profileFingerprintSha256: providerResponsibilityRequiredSignerFixtureV1.profileFingerprintSha256
  },
  state: 'DIRECT_EXECUTOR_WITH_REQUIRED_SIGNER_ESTABLISHED',
  legallyRequiredDistinctSigner: providerResponsibilityRequiredSignerFixtureV1.legallyRequiredDistinctSigner,
  assessmentFingerprintSha256: '7'.repeat(64)
}) satisfies Readonly<ProviderDirectExecutorAssessmentV1>;

export const providerDirectExecutorRebrokeringDeniedFixtureV1 = Object.freeze({
  schemaVersion: 1,
  provider: {
    providerId: responsibilityFixtureProviderId,
    providerWorkspaceId: responsibilityFixtureWorkspaceId
  },
  profile: {
    providerResponsibilityProfileId: responsibilityFixtureProfileId,
    version: providerResponsibilityRebrokeringFixtureV1.version,
    profileFingerprintSha256: providerResponsibilityRebrokeringFixtureV1.profileFingerprintSha256
  },
  state: 'REBROKERING_OR_SUBAGENT_DISCLOSED',
  directExecutorEstablished: false,
  profileAuthorityState: 'CURRENT',
  publicReason: 'The current responsibility disclosure does not establish direct execution.',
  evidenceReferences: providerResponsibilityRebrokeringFixtureV1.evidenceReferences.map(
    (evidence) => evidence.evidenceReference
  ),
  checkedAt: responsibilityFixtureAt,
  assessmentPolicyVersion: 'mgsn-provider-responsibility-v1',
  assessmentFingerprintSha256: '8'.repeat(64),
  hiddenIntermediaryAllowed: false,
  currentAuthorityRevalidationRequiredBeforeUse: true,
  authorityConsequences: noProviderResponsibilityAuthorityConsequences
}) satisfies Readonly<ProviderDirectExecutorAssessmentV1>;
