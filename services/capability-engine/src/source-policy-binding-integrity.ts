import { createHash } from 'node:crypto';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type { ImplementationProfile } from '@markorbit/contracts/capability-runtime';
import type { CapabilitySourceAdmissionPolicyEntryV1 } from './source-admission-policy-catalog.js';
import { materializeCapabilitySourceAdmissionPolicyContentIdentityV1 } from './source-admission-policy-content-provenance.js';

export type CapabilitySourcePolicyBindingIntegrityStatusV1 =
  | 'SOURCE_POLICY_BINDINGS_HEALTHY'
  | 'SOURCE_POLICY_BINDING_FINDINGS'
  | 'SOURCE_POLICY_BINDING_AUDIT_UNAVAILABLE';

export type CapabilitySourcePolicyBindingFindingCodeV1 =
  | 'ORPHAN_SOURCE_POLICY_CAPABILITY'
  | 'STALE_SOURCE_POLICY_CAPABILITY_VERSION'
  | 'ORPHAN_SOURCE_POLICY_IMPLEMENTATION'
  | 'STALE_SOURCE_POLICY_IMPLEMENTATION_VERSION'
  | 'SOURCE_POLICY_IMPLEMENTATION_BINDING_MISMATCH'
  | 'SOURCE_POLICY_IMPLEMENTATION_NOT_APPROVED';

export interface CapabilitySourcePolicyBindingIntegrityNoAuthorityV1 {
  productionSourceAdmitted: false;
  sourceAdmissionEvaluated: false;
  methodCurrentnessEvaluated: false;
  referenceCurrentnessEvaluated: false;
  implementationSelected: false;
  policyMutated: false;
  productStateCreated: false;
  brainGapCreated: false;
  methodImprovementTriggerCreated: false;
  researchMissionCreated: false;
  officialTruthCreated: false;
  automaticRemediationExecuted: false;
}

export const capabilitySourcePolicyBindingIntegrityNoAuthority = Object.freeze({
  productionSourceAdmitted: false,
  sourceAdmissionEvaluated: false,
  methodCurrentnessEvaluated: false,
  referenceCurrentnessEvaluated: false,
  implementationSelected: false,
  policyMutated: false,
  productStateCreated: false,
  brainGapCreated: false,
  methodImprovementTriggerCreated: false,
  researchMissionCreated: false,
  officialTruthCreated: false,
  automaticRemediationExecuted: false
}) satisfies Readonly<CapabilitySourcePolicyBindingIntegrityNoAuthorityV1>;

export interface CurrentSourcePolicyBindingCapabilityV1 {
  runtimeCapabilityDefinitionId: string;
  version: number;
  capabilityId: string;
  capabilityVersion: string;
}

export interface CurrentSourcePolicyBindingImplementationV1 {
  implementationProfileId: string;
  version: number;
  status: ImplementationProfile['status'];
  capabilityId: string;
  capabilityVersion: string;
  implementationKey: string;
  inputSchemaId: string;
  outputSchemaId: string;
}

export interface CurrentSourcePolicyBindingPolicyV1 {
  policyId: string;
  policyVersion: number;
  policyFingerprintSha256: string;
  maturityClass: CapabilitySourceAdmissionPolicyEntryV1['maturityClass'];
  capabilityId: string;
  capabilityVersion: string;
  implementationProfileId: string;
  implementationProfileVersion: number;
  implementationKey: string;
  inputSchemaId: string;
  outputSchemaId: string;
}

export interface CapabilitySourcePolicyBindingIntegritySnapshotV1 {
  schemaVersion: 1;
  currentCapabilities: readonly Readonly<CurrentSourcePolicyBindingCapabilityV1>[];
  currentImplementationProfiles: readonly Readonly<CurrentSourcePolicyBindingImplementationV1>[];
  sourceAdmissionPolicies: readonly Readonly<CurrentSourcePolicyBindingPolicyV1>[];
  snapshotFingerprintSha256: string;
}

export interface CapabilitySourcePolicyBindingIntegrityFindingV1 {
  schemaVersion: 1;
  findingId: `capability-source-policy-binding-finding_${string}`;
  findingFingerprintSha256: string;
  code: CapabilitySourcePolicyBindingFindingCodeV1;
  policy: Readonly<CurrentSourcePolicyBindingPolicyV1>;
  currentRuntimeCapability?: Readonly<CurrentSourcePolicyBindingCapabilityV1>;
  currentImplementationProfile?: Readonly<CurrentSourcePolicyBindingImplementationV1>;
}

export type CapabilitySourcePolicyBindingIntegrityAvailableResultV1 = Readonly<{
  schemaVersion: 1;
  status: 'SOURCE_POLICY_BINDINGS_HEALTHY' | 'SOURCE_POLICY_BINDING_FINDINGS';
  snapshot: Readonly<CapabilitySourcePolicyBindingIntegritySnapshotV1>;
  findings: readonly Readonly<CapabilitySourcePolicyBindingIntegrityFindingV1>[];
  auditFingerprintSha256: string;
  authority: Readonly<CapabilitySourcePolicyBindingIntegrityNoAuthorityV1>;
}>;

export type CapabilitySourcePolicyBindingIntegrityUnavailableResultV1 = Readonly<{
  schemaVersion: 1;
  status: 'SOURCE_POLICY_BINDING_AUDIT_UNAVAILABLE';
  unavailableDependency:
    | 'CURRENT_CAPABILITY_CATALOG_AUTHORITY'
    | 'CURRENT_IMPLEMENTATION_CATALOG_AUTHORITY'
    | 'SOURCE_ADMISSION_POLICY_CATALOG_AUTHORITY';
  findings: readonly [];
  authority: Readonly<CapabilitySourcePolicyBindingIntegrityNoAuthorityV1>;
}>;

export type CapabilitySourcePolicyBindingIntegrityAuditResultV1 =
  | CapabilitySourcePolicyBindingIntegrityAvailableResultV1
  | CapabilitySourcePolicyBindingIntegrityUnavailableResultV1;

export interface CurrentSourcePolicyBindingCapabilityAuthorityV1 {
  listCurrent():
    | readonly Readonly<RuntimeCapabilityDefinition>[]
    | Promise<readonly Readonly<RuntimeCapabilityDefinition>[]>;
}

export interface CurrentSourcePolicyBindingImplementationAuthorityV1 {
  listCurrent(
    capabilityId?: string
  ):
    | readonly Readonly<ImplementationProfile>[]
    | Promise<readonly Readonly<ImplementationProfile>[]>;
}

export interface CurrentSourcePolicyBindingPolicyAuthorityV1 {
  list():
    | readonly Readonly<CapabilitySourceAdmissionPolicyEntryV1>[]
    | Promise<readonly Readonly<CapabilitySourceAdmissionPolicyEntryV1>[]>;
}

export interface CapabilitySourcePolicyBindingIntegrityAuditorOptionsV1 {
  capabilities: Readonly<CurrentSourcePolicyBindingCapabilityAuthorityV1>;
  implementations: Readonly<CurrentSourcePolicyBindingImplementationAuthorityV1>;
  policies: Readonly<CurrentSourcePolicyBindingPolicyAuthorityV1>;
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

function sha256(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function capabilityEntry(
  definition: Readonly<RuntimeCapabilityDefinition>
): CurrentSourcePolicyBindingCapabilityV1 {
  return {
    runtimeCapabilityDefinitionId: definition.runtimeCapabilityDefinitionId,
    version: definition.version,
    capabilityId: definition.capabilityId,
    capabilityVersion: definition.capabilityVersion
  };
}

function implementationEntry(
  profile: Readonly<ImplementationProfile>
): CurrentSourcePolicyBindingImplementationV1 {
  return {
    implementationProfileId: profile.implementationProfileId,
    version: profile.version,
    status: profile.status,
    capabilityId: profile.capabilityId,
    capabilityVersion: profile.capabilityVersion,
    implementationKey: profile.implementationKey,
    inputSchemaId: profile.inputSchemaId,
    outputSchemaId: profile.outputSchemaId
  };
}

function policyEntry(
  policy: Readonly<CapabilitySourceAdmissionPolicyEntryV1>
): CurrentSourcePolicyBindingPolicyV1 {
  const identity = materializeCapabilitySourceAdmissionPolicyContentIdentityV1(policy);
  return {
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    policyFingerprintSha256: identity.policyFingerprintSha256,
    maturityClass: policy.maturityClass,
    capabilityId: policy.capabilityId,
    capabilityVersion: policy.capabilityVersion,
    implementationProfileId: policy.implementationProfileId,
    implementationProfileVersion: policy.implementationProfileVersion,
    implementationKey: policy.implementationKey,
    inputSchemaId: policy.inputSchemaId,
    outputSchemaId: policy.outputSchemaId
  };
}

function sortCapabilities(
  capabilities: readonly Readonly<RuntimeCapabilityDefinition>[]
): readonly Readonly<RuntimeCapabilityDefinition>[] {
  return [...capabilities].sort(
    (left, right) =>
      left.capabilityId.localeCompare(right.capabilityId) ||
      left.runtimeCapabilityDefinitionId.localeCompare(right.runtimeCapabilityDefinitionId) ||
      left.version - right.version
  );
}

function sortImplementations(
  profiles: readonly Readonly<ImplementationProfile>[]
): readonly Readonly<ImplementationProfile>[] {
  return [...profiles].sort(
    (left, right) =>
      left.implementationProfileId.localeCompare(right.implementationProfileId) ||
      left.version - right.version
  );
}

function sortPolicies(
  policies: readonly Readonly<CapabilitySourceAdmissionPolicyEntryV1>[]
): readonly Readonly<CapabilitySourceAdmissionPolicyEntryV1>[] {
  return [...policies].sort(
    (left, right) =>
      left.policyId.localeCompare(right.policyId) || left.policyVersion - right.policyVersion
  );
}

function snapshot(
  capabilities: readonly Readonly<RuntimeCapabilityDefinition>[],
  profiles: readonly Readonly<ImplementationProfile>[],
  policies: readonly Readonly<CapabilitySourceAdmissionPolicyEntryV1>[]
): CapabilitySourcePolicyBindingIntegritySnapshotV1 {
  const basis = {
    schemaVersion: 1 as const,
    currentCapabilities: sortCapabilities(capabilities).map(capabilityEntry),
    currentImplementationProfiles: sortImplementations(profiles).map(implementationEntry),
    sourceAdmissionPolicies: sortPolicies(policies).map(policyEntry)
  };
  return {
    ...basis,
    snapshotFingerprintSha256: sha256(basis)
  };
}

function finding(
  code: CapabilitySourcePolicyBindingFindingCodeV1,
  policy: Readonly<CapabilitySourceAdmissionPolicyEntryV1>,
  currentRuntimeCapability?: Readonly<RuntimeCapabilityDefinition>,
  currentImplementationProfile?: Readonly<ImplementationProfile>
): CapabilitySourcePolicyBindingIntegrityFindingV1 {
  const basis = {
    code,
    policy: policyEntry(policy),
    ...(currentRuntimeCapability === undefined
      ? {}
      : { currentRuntimeCapability: capabilityEntry(currentRuntimeCapability) }),
    ...(currentImplementationProfile === undefined
      ? {}
      : { currentImplementationProfile: implementationEntry(currentImplementationProfile) })
  };
  const findingFingerprintSha256 = sha256(basis);
  return {
    schemaVersion: 1,
    findingId: `capability-source-policy-binding-finding_${findingFingerprintSha256}`,
    findingFingerprintSha256,
    ...basis
  };
}

function unavailable(
  dependency: CapabilitySourcePolicyBindingIntegrityUnavailableResultV1['unavailableDependency']
): CapabilitySourcePolicyBindingIntegrityUnavailableResultV1 {
  return {
    schemaVersion: 1,
    status: 'SOURCE_POLICY_BINDING_AUDIT_UNAVAILABLE',
    unavailableDependency: dependency,
    findings: [],
    authority: capabilitySourcePolicyBindingIntegrityNoAuthority
  };
}

function bindingMatches(
  policy: Readonly<CapabilitySourceAdmissionPolicyEntryV1>,
  profile: Readonly<ImplementationProfile>
): boolean {
  return (
    policy.capabilityId === profile.capabilityId &&
    policy.capabilityVersion === profile.capabilityVersion &&
    policy.implementationKey === profile.implementationKey &&
    policy.inputSchemaId === profile.inputSchemaId &&
    policy.outputSchemaId === profile.outputSchemaId
  );
}

function findingSort(
  left: Readonly<CapabilitySourcePolicyBindingIntegrityFindingV1>,
  right: Readonly<CapabilitySourcePolicyBindingIntegrityFindingV1>
): number {
  return (
    left.policy.policyId.localeCompare(right.policy.policyId) ||
    left.policy.policyVersion - right.policy.policyVersion ||
    left.code.localeCompare(right.code) ||
    left.findingFingerprintSha256.localeCompare(right.findingFingerprintSha256)
  );
}

export class CapabilitySourcePolicyBindingIntegrityAuditorV1 {
  constructor(
    private readonly options: Readonly<CapabilitySourcePolicyBindingIntegrityAuditorOptionsV1>
  ) {}

  async audit(): Promise<CapabilitySourcePolicyBindingIntegrityAuditResultV1> {
    let capabilities: readonly Readonly<RuntimeCapabilityDefinition>[];
    try {
      capabilities = await this.options.capabilities.listCurrent();
    } catch {
      return unavailable('CURRENT_CAPABILITY_CATALOG_AUTHORITY');
    }

    let profiles: readonly Readonly<ImplementationProfile>[];
    try {
      profiles = await this.options.implementations.listCurrent();
    } catch {
      return unavailable('CURRENT_IMPLEMENTATION_CATALOG_AUTHORITY');
    }

    let policies: readonly Readonly<CapabilitySourceAdmissionPolicyEntryV1>[];
    try {
      policies = await this.options.policies.list();
      for (const policy of policies) policyEntry(policy);
    } catch {
      return unavailable('SOURCE_ADMISSION_POLICY_CATALOG_AUTHORITY');
    }

    const sortedCapabilities = sortCapabilities(capabilities);
    const sortedProfiles = sortImplementations(profiles);
    const sortedPolicies = sortPolicies(policies);
    const capabilityById = new Map(
      sortedCapabilities.map((capability) => [capability.capabilityId, capability] as const)
    );
    const profileById = new Map<string, Readonly<ImplementationProfile>>(
      sortedProfiles.map((profile) => [profile.implementationProfileId, profile] as const)
    );
    const findings: CapabilitySourcePolicyBindingIntegrityFindingV1[] = [];

    for (const policy of sortedPolicies) {
      const currentCapability = capabilityById.get(policy.capabilityId);
      if (!currentCapability) {
        findings.push(finding('ORPHAN_SOURCE_POLICY_CAPABILITY', policy));
      } else if (currentCapability.capabilityVersion !== policy.capabilityVersion) {
        findings.push(finding('STALE_SOURCE_POLICY_CAPABILITY_VERSION', policy, currentCapability));
      }

      const currentProfile = profileById.get(policy.implementationProfileId);
      if (!currentProfile) {
        findings.push(finding('ORPHAN_SOURCE_POLICY_IMPLEMENTATION', policy, currentCapability));
        continue;
      }
      if (currentProfile.version !== policy.implementationProfileVersion) {
        findings.push(
          finding(
            'STALE_SOURCE_POLICY_IMPLEMENTATION_VERSION',
            policy,
            currentCapability,
            currentProfile
          )
        );
        continue;
      }
      if (!bindingMatches(policy, currentProfile)) {
        findings.push(
          finding(
            'SOURCE_POLICY_IMPLEMENTATION_BINDING_MISMATCH',
            policy,
            currentCapability,
            currentProfile
          )
        );
        continue;
      }
      if (currentProfile.status !== 'APPROVED') {
        findings.push(
          finding(
            'SOURCE_POLICY_IMPLEMENTATION_NOT_APPROVED',
            policy,
            currentCapability,
            currentProfile
          )
        );
      }
    }

    findings.sort(findingSort);
    let currentSnapshot: CapabilitySourcePolicyBindingIntegritySnapshotV1;
    try {
      currentSnapshot = snapshot(sortedCapabilities, sortedProfiles, sortedPolicies);
    } catch {
      return unavailable('SOURCE_ADMISSION_POLICY_CATALOG_AUTHORITY');
    }
    const status =
      findings.length === 0 ? 'SOURCE_POLICY_BINDINGS_HEALTHY' : 'SOURCE_POLICY_BINDING_FINDINGS';
    const auditFingerprintSha256 = sha256({
      status,
      snapshotFingerprintSha256: currentSnapshot.snapshotFingerprintSha256,
      findingFingerprints: findings.map((item) => item.findingFingerprintSha256),
      authority: capabilitySourcePolicyBindingIntegrityNoAuthority
    });

    return {
      schemaVersion: 1,
      status,
      snapshot: currentSnapshot,
      findings: structuredClone(findings),
      auditFingerprintSha256,
      authority: capabilitySourcePolicyBindingIntegrityNoAuthority
    };
  }
}
