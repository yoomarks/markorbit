import { createHash } from 'node:crypto';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type {
  CapabilityOutcome,
  ImplementationBinding,
  ImplementationProfile
} from '@markorbit/contracts/capability-runtime';

export const capabilityProducerSourceAdmissionClasses = [
  'PRODUCTION_ADMISSIBLE',
  'PILOT_OR_FIXTURE',
  'UNSUPPORTED'
] as const;
export type CapabilityProducerSourceAdmissionClass =
  (typeof capabilityProducerSourceAdmissionClasses)[number];

export const capabilityProducerSourceCurrentnessStates = ['CURRENT', 'STALE', 'UNKNOWN'] as const;
export type CapabilityProducerSourceCurrentness =
  (typeof capabilityProducerSourceCurrentnessStates)[number];

export interface CapabilityProducerSourceAuthorityConsequencesV1 {
  recommendationAuthorityCreated: false;
  professionalApprovalCreated: false;
  legalConclusionCreated: false;
  customerSelectionCreated: false;
  filingAuthorizationCreated: false;
  protectedActionMutationAuthorized: false;
  officialTruthCreated: false;
}

export const capabilityProducerSourceNoAuthorityConsequencesV1 = Object.freeze({
  recommendationAuthorityCreated: false,
  professionalApprovalCreated: false,
  legalConclusionCreated: false,
  customerSelectionCreated: false,
  filingAuthorizationCreated: false,
  protectedActionMutationAuthorized: false,
  officialTruthCreated: false
}) satisfies Readonly<CapabilityProducerSourceAuthorityConsequencesV1>;

export interface CapabilityProducerSourceAdmissionPolicyV1 {
  schemaVersion: 1;
  policyVersion: string;
  admissionClass: CapabilityProducerSourceAdmissionClass;
  runtimeCapability: Readonly<{
    id: string;
    version: number;
    capabilityId: string;
    capabilityVersion: string;
    canonSourceFingerprintSha256: string;
  }>;
  implementation: Readonly<{
    id: string;
    version: number;
    implementationKey: string;
    kind: ImplementationProfile['kind'];
  }>;
  selectionPolicyVersion: string;
  outputSchemaId: string;
  assumptions: readonly string[];
  limitations: readonly string[];
  unknowns: readonly string[];
}

export interface CapabilityProducerSourceAdmissionPolicyContextV1 {
  definition: Readonly<RuntimeCapabilityDefinition>;
  profile: Readonly<ImplementationProfile>;
  binding: Readonly<ImplementationBinding>;
}

export interface CapabilityProducerSourceAdmissionPolicyResolverV1 {
  resolve(
    context: Readonly<CapabilityProducerSourceAdmissionPolicyContextV1>
  ): Readonly<CapabilityProducerSourceAdmissionPolicyV1> | undefined;
}

export interface CapabilityProducerSourceAssessmentV1 {
  schemaVersion: 1;
  admissionClass: CapabilityProducerSourceAdmissionClass;
  currentness: CapabilityProducerSourceCurrentness;
  reason:
    | 'NO_EXPLICIT_ADMISSION'
    | 'POLICY_LINEAGE_STALE'
    | 'EXECUTION_NOT_SUCCESSFUL'
    | 'EXPLICIT_POLICY';
  sourceFingerprintSha256: string;
  assessmentFingerprintSha256: string;
  outputFingerprintSha256: string;
  lineage: Readonly<{
    capabilityId: string;
    capabilityVersion: string;
    runtimeCapabilityDefinitionId: string;
    runtimeCapabilityDefinitionVersion: number;
    canonSourceFingerprintSha256: string;
    implementationProfileId: string;
    implementationProfileVersion: number;
    implementationKey: string;
    implementationKind: ImplementationProfile['kind'];
    selectionPolicyVersion: string;
    outputSchemaId: string;
    evidenceRefs: readonly string[];
  }>;
  policyVersion?: string;
  assumptions: readonly string[];
  limitations: readonly string[];
  unknowns: readonly string[];
  authority: Readonly<CapabilityProducerSourceAuthorityConsequencesV1>;
}

export interface CapabilityProducerSourceAssessmentInputV1 {
  definition: Readonly<RuntimeCapabilityDefinition>;
  profile: Readonly<ImplementationProfile>;
  binding: Readonly<ImplementationBinding>;
  outcome: Readonly<CapabilityOutcome>;
  policy?: Readonly<CapabilityProducerSourceAdmissionPolicyV1>;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

function sha256(value: unknown): string {
  const serialized = JSON.stringify(canonicalize(value)) ?? 'undefined';
  return createHash('sha256').update(serialized).digest('hex');
}

function normalizedTextSet(values: readonly string[]): readonly string[] {
  return Object.freeze(
    [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) =>
      left.localeCompare(right)
    )
  );
}

function policyMatchesExactLineage(
  input: Readonly<CapabilityProducerSourceAssessmentInputV1>,
  policy: Readonly<CapabilityProducerSourceAdmissionPolicyV1>
): boolean {
  const { definition, profile, binding, outcome } = input;
  return (
    policy.runtimeCapability.id === definition.runtimeCapabilityDefinitionId &&
    policy.runtimeCapability.version === definition.version &&
    policy.runtimeCapability.capabilityId === definition.capabilityId &&
    policy.runtimeCapability.capabilityVersion === definition.capabilityVersion &&
    policy.runtimeCapability.canonSourceFingerprintSha256 ===
      definition.canonReference.sourceFingerprintSha256 &&
    policy.implementation.id === profile.implementationProfileId &&
    policy.implementation.version === profile.version &&
    policy.implementation.implementationKey === profile.implementationKey &&
    policy.implementation.kind === profile.kind &&
    policy.selectionPolicyVersion === binding.selectionPolicyVersion &&
    policy.outputSchemaId === outcome.outputSchemaId
  );
}

export function assessCapabilityProducerSourceV1(
  input: Readonly<CapabilityProducerSourceAssessmentInputV1>
): Readonly<CapabilityProducerSourceAssessmentV1> {
  const evidenceRefs = Object.freeze([...input.outcome.evidenceRefs].sort((left, right) => left.localeCompare(right)));
  const assumptions = normalizedTextSet(input.policy?.assumptions ?? []);
  const limitations = normalizedTextSet(input.policy?.limitations ?? []);
  const unknowns = normalizedTextSet(input.policy?.unknowns ?? []);
  const outputFingerprintSha256 = sha256({
    outputSchemaId: input.outcome.outputSchemaId,
    output: input.outcome.output
  });
  const lineage = Object.freeze({
    capabilityId: input.definition.capabilityId,
    capabilityVersion: input.definition.capabilityVersion,
    runtimeCapabilityDefinitionId: input.definition.runtimeCapabilityDefinitionId,
    runtimeCapabilityDefinitionVersion: input.definition.version,
    canonSourceFingerprintSha256: input.definition.canonReference.sourceFingerprintSha256,
    implementationProfileId: input.profile.implementationProfileId,
    implementationProfileVersion: input.profile.version,
    implementationKey: input.profile.implementationKey,
    implementationKind: input.profile.kind,
    selectionPolicyVersion: input.binding.selectionPolicyVersion,
    outputSchemaId: input.outcome.outputSchemaId,
    evidenceRefs
  });
  const sourceFingerprintSha256 = sha256({ lineage, outputFingerprintSha256 });

  let admissionClass: CapabilityProducerSourceAdmissionClass = 'UNSUPPORTED';
  let currentness: CapabilityProducerSourceCurrentness = 'UNKNOWN';
  let reason: CapabilityProducerSourceAssessmentV1['reason'] = 'NO_EXPLICIT_ADMISSION';

  if (input.policy) {
    if (!policyMatchesExactLineage(input, input.policy)) {
      currentness = 'STALE';
      reason = 'POLICY_LINEAGE_STALE';
    } else if (input.outcome.status !== 'SUCCEEDED') {
      currentness = 'CURRENT';
      reason = 'EXECUTION_NOT_SUCCESSFUL';
    } else {
      admissionClass = input.policy.admissionClass;
      currentness = 'CURRENT';
      reason = 'EXPLICIT_POLICY';
    }
  }

  const assessmentFingerprintSha256 = sha256({
    admissionClass,
    currentness,
    reason,
    sourceFingerprintSha256,
    policyVersion: input.policy?.policyVersion ?? null,
    assumptions,
    limitations,
    unknowns
  });

  return Object.freeze({
    schemaVersion: 1,
    admissionClass,
    currentness,
    reason,
    sourceFingerprintSha256,
    assessmentFingerprintSha256,
    outputFingerprintSha256,
    lineage,
    ...(input.policy ? { policyVersion: input.policy.policyVersion } : {}),
    assumptions,
    limitations,
    unknowns,
    authority: capabilityProducerSourceNoAuthorityConsequencesV1
  });
}
