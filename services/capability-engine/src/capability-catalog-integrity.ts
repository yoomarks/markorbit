import { createHash } from 'node:crypto';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type { ImplementationProfile } from '@markorbit/contracts/capability-runtime';

export type CapabilityCatalogIntegrityStatus =
  | 'CATALOG_HEALTHY'
  | 'CATALOG_INTEGRITY_FINDINGS'
  | 'CATALOG_AUDIT_UNAVAILABLE';

export type CapabilityCatalogIntegrityFindingCode =
  | 'INVALID_CURRENT_CAPABILITY_PROJECTION'
  | 'ORPHAN_IMPLEMENTATION_PROFILE'
  | 'STALE_CAPABILITY_VERSION'
  | 'NO_CURRENT_IMPLEMENTATION_PROFILE'
  | 'NO_APPROVED_CURRENT_IMPLEMENTATION';

export interface CapabilityCatalogIntegrityNoAuthorityV1 {
  productionSourceAdmitted: false;
  implementationSelected: false;
  productStateCreated: false;
  brainGapCreated: false;
  methodImprovementTriggerCreated: false;
  researchMissionCreated: false;
  officialTruthCreated: false;
  automaticRemediationExecuted: false;
}

export const capabilityCatalogIntegrityNoAuthority = Object.freeze({
  productionSourceAdmitted: false,
  implementationSelected: false,
  productStateCreated: false,
  brainGapCreated: false,
  methodImprovementTriggerCreated: false,
  researchMissionCreated: false,
  officialTruthCreated: false,
  automaticRemediationExecuted: false
}) satisfies Readonly<CapabilityCatalogIntegrityNoAuthorityV1>;

export interface CurrentCapabilityCatalogEntryV1 {
  runtimeCapabilityDefinitionId: string;
  version: number;
  capabilityId: string;
  capabilityVersion: string;
  canonReference: Readonly<{
    canonId: string;
    canonVersion: string;
    sourceFingerprintSha256: string;
  }>;
  acceptedCanonProjection: boolean;
  createdFromWorkEvidence: boolean;
  createdFromAiOutput: boolean;
}

export interface CurrentImplementationCatalogEntryV1 {
  implementationProfileId: string;
  version: number;
  capabilityId: string;
  capabilityVersion: string;
  kind: ImplementationProfile['kind'];
  status: ImplementationProfile['status'];
  implementationKey: string;
  inputSchemaId: string;
  outputSchemaId: string;
  allowedCallerProducts: readonly string[];
  maximumRiskClass: ImplementationProfile['maximumRiskClass'];
  approvalPolicyVersion: string;
}

export interface CapabilityCatalogIntegritySnapshotV1 {
  schemaVersion: 1;
  currentCapabilities: readonly Readonly<CurrentCapabilityCatalogEntryV1>[];
  currentImplementationProfiles: readonly Readonly<CurrentImplementationCatalogEntryV1>[];
  snapshotFingerprintSha256: string;
}

export interface CapabilityCatalogIntegrityFindingV1 {
  schemaVersion: 1;
  findingId: `capability-catalog-finding_${string}`;
  findingFingerprintSha256: string;
  code: CapabilityCatalogIntegrityFindingCode;
  capabilityId: string;
  runtimeCapability?: Readonly<CurrentCapabilityCatalogEntryV1>;
  implementationProfiles: readonly Readonly<CurrentImplementationCatalogEntryV1>[];
}

export type CapabilityCatalogIntegrityAvailableResultV1 = Readonly<{
  schemaVersion: 1;
  status: 'CATALOG_HEALTHY' | 'CATALOG_INTEGRITY_FINDINGS';
  snapshot: Readonly<CapabilityCatalogIntegritySnapshotV1>;
  findings: readonly Readonly<CapabilityCatalogIntegrityFindingV1>[];
  auditFingerprintSha256: string;
  authority: Readonly<CapabilityCatalogIntegrityNoAuthorityV1>;
}>;

export type CapabilityCatalogIntegrityUnavailableResultV1 = Readonly<{
  schemaVersion: 1;
  status: 'CATALOG_AUDIT_UNAVAILABLE';
  unavailableDependency: 'CURRENT_CAPABILITY_CATALOG_AUTHORITY' | 'CURRENT_IMPLEMENTATION_CATALOG_AUTHORITY';
  findings: readonly [];
  authority: Readonly<CapabilityCatalogIntegrityNoAuthorityV1>;
}>;

export type CapabilityCatalogIntegrityAuditResultV1 =
  | CapabilityCatalogIntegrityAvailableResultV1
  | CapabilityCatalogIntegrityUnavailableResultV1;

export interface CurrentRuntimeCapabilityCatalogAuthorityV1 {
  listCurrent():
    | readonly Readonly<RuntimeCapabilityDefinition>[]
    | Promise<readonly Readonly<RuntimeCapabilityDefinition>[]>;
}

export interface CurrentImplementationCatalogAuthorityV1 {
  listCurrent(
    capabilityId?: string
  ):
    | readonly Readonly<ImplementationProfile>[]
    | Promise<readonly Readonly<ImplementationProfile>[]>;
}

export interface CapabilityCatalogIntegrityAuditorOptionsV1 {
  capabilities: Readonly<CurrentRuntimeCapabilityCatalogAuthorityV1>;
  implementations: Readonly<CurrentImplementationCatalogAuthorityV1>;
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
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function capabilityEntry(
  definition: Readonly<RuntimeCapabilityDefinition>
): CurrentCapabilityCatalogEntryV1 {
  return {
    runtimeCapabilityDefinitionId: definition.runtimeCapabilityDefinitionId,
    version: definition.version,
    capabilityId: definition.capabilityId,
    capabilityVersion: definition.capabilityVersion,
    canonReference: structuredClone(definition.canonReference),
    acceptedCanonProjection: definition.acceptedCanonProjection,
    createdFromWorkEvidence: definition.createdFromWorkEvidence,
    createdFromAiOutput: definition.createdFromAiOutput
  };
}

function implementationEntry(
  profile: Readonly<ImplementationProfile>
): CurrentImplementationCatalogEntryV1 {
  return {
    implementationProfileId: profile.implementationProfileId,
    version: profile.version,
    capabilityId: profile.capabilityId,
    capabilityVersion: profile.capabilityVersion,
    kind: profile.kind,
    status: profile.status,
    implementationKey: profile.implementationKey,
    inputSchemaId: profile.inputSchemaId,
    outputSchemaId: profile.outputSchemaId,
    allowedCallerProducts: [...profile.allowedCallerProducts].sort((left, right) =>
      left.localeCompare(right)
    ),
    maximumRiskClass: profile.maximumRiskClass,
    approvalPolicyVersion: profile.approvalPolicyVersion
  };
}

function sortCapabilities(
  definitions: readonly Readonly<RuntimeCapabilityDefinition>[]
): readonly Readonly<RuntimeCapabilityDefinition>[] {
  return [...definitions].sort(
    (left, right) =>
      left.capabilityId.localeCompare(right.capabilityId) ||
      left.runtimeCapabilityDefinitionId.localeCompare(right.runtimeCapabilityDefinitionId) ||
      left.version - right.version
  );
}

function sortProfiles(
  profiles: readonly Readonly<ImplementationProfile>[]
): readonly Readonly<ImplementationProfile>[] {
  return [...profiles].sort(
    (left, right) =>
      left.capabilityId.localeCompare(right.capabilityId) ||
      left.implementationProfileId.localeCompare(right.implementationProfileId) ||
      left.version - right.version
  );
}

function buildSnapshot(
  capabilities: readonly Readonly<RuntimeCapabilityDefinition>[],
  profiles: readonly Readonly<ImplementationProfile>[]
): CapabilityCatalogIntegritySnapshotV1 {
  const basis = {
    schemaVersion: 1 as const,
    currentCapabilities: sortCapabilities(capabilities).map(capabilityEntry),
    currentImplementationProfiles: sortProfiles(profiles).map(implementationEntry)
  };
  return {
    ...basis,
    snapshotFingerprintSha256: sha256(basis)
  };
}

function finding(
  code: CapabilityCatalogIntegrityFindingCode,
  capabilityId: string,
  runtimeCapability: Readonly<RuntimeCapabilityDefinition> | undefined,
  profiles: readonly Readonly<ImplementationProfile>[]
): CapabilityCatalogIntegrityFindingV1 {
  const basis = {
    code,
    capabilityId,
    ...(runtimeCapability === undefined
      ? {}
      : { runtimeCapability: capabilityEntry(runtimeCapability) }),
    implementationProfiles: sortProfiles(profiles).map(implementationEntry)
  };
  const findingFingerprintSha256 = sha256(basis);
  return {
    schemaVersion: 1,
    findingId: `capability-catalog-finding_${findingFingerprintSha256}`,
    findingFingerprintSha256,
    ...basis
  };
}

function unavailable(
  dependency: CapabilityCatalogIntegrityUnavailableResultV1['unavailableDependency']
): CapabilityCatalogIntegrityUnavailableResultV1 {
  return {
    schemaVersion: 1,
    status: 'CATALOG_AUDIT_UNAVAILABLE',
    unavailableDependency: dependency,
    findings: [],
    authority: capabilityCatalogIntegrityNoAuthority
  };
}

function findingSort(
  left: Readonly<CapabilityCatalogIntegrityFindingV1>,
  right: Readonly<CapabilityCatalogIntegrityFindingV1>
): number {
  return (
    left.capabilityId.localeCompare(right.capabilityId) ||
    left.code.localeCompare(right.code) ||
    left.findingFingerprintSha256.localeCompare(right.findingFingerprintSha256)
  );
}

export class CapabilityCatalogIntegrityAuditorV1 {
  constructor(private readonly options: Readonly<CapabilityCatalogIntegrityAuditorOptionsV1>) {}

  async audit(): Promise<CapabilityCatalogIntegrityAuditResultV1> {
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

    const sortedCapabilities = sortCapabilities(capabilities);
    const sortedProfiles = sortProfiles(profiles);
    const capabilityById = new Map(
      sortedCapabilities.map((definition) => [definition.capabilityId, definition] as const)
    );
    const profilesByCapability = new Map<string, Readonly<ImplementationProfile>[]>();
    for (const profile of sortedProfiles) {
      const current = profilesByCapability.get(profile.capabilityId) ?? [];
      current.push(profile);
      profilesByCapability.set(profile.capabilityId, current);
    }

    const findings: CapabilityCatalogIntegrityFindingV1[] = [];

    for (const definition of sortedCapabilities) {
      const currentProfiles = profilesByCapability.get(definition.capabilityId) ?? [];
      if (
        definition.acceptedCanonProjection !== true ||
        definition.createdFromWorkEvidence !== false ||
        definition.createdFromAiOutput !== false
      ) {
        findings.push(
          finding(
            'INVALID_CURRENT_CAPABILITY_PROJECTION',
            definition.capabilityId,
            definition,
            currentProfiles
          )
        );
      }

      if (currentProfiles.length === 0) {
        findings.push(
          finding('NO_CURRENT_IMPLEMENTATION_PROFILE', definition.capabilityId, definition, [])
        );
        continue;
      }

      for (const profile of currentProfiles) {
        if (profile.capabilityVersion !== definition.capabilityVersion) {
          findings.push(
            finding('STALE_CAPABILITY_VERSION', definition.capabilityId, definition, [profile])
          );
        }
      }

      const approvedCurrent = currentProfiles.some(
        (profile) =>
          profile.status === 'APPROVED' &&
          profile.capabilityVersion === definition.capabilityVersion
      );
      if (!approvedCurrent) {
        findings.push(
          finding(
            'NO_APPROVED_CURRENT_IMPLEMENTATION',
            definition.capabilityId,
            definition,
            currentProfiles
          )
        );
      }
    }

    for (const profile of sortedProfiles) {
      if (!capabilityById.has(profile.capabilityId)) {
        findings.push(
          finding('ORPHAN_IMPLEMENTATION_PROFILE', profile.capabilityId, undefined, [profile])
        );
      }
    }

    findings.sort(findingSort);
    const snapshot = buildSnapshot(sortedCapabilities, sortedProfiles);
    const status = findings.length === 0 ? 'CATALOG_HEALTHY' : 'CATALOG_INTEGRITY_FINDINGS';
    const auditFingerprintSha256 = sha256({
      status,
      snapshotFingerprintSha256: snapshot.snapshotFingerprintSha256,
      findingFingerprints: findings.map((item) => item.findingFingerprintSha256),
      authority: capabilityCatalogIntegrityNoAuthority
    });

    return {
      schemaVersion: 1,
      status,
      snapshot,
      findings: structuredClone(findings),
      auditFingerprintSha256,
      authority: capabilityCatalogIntegrityNoAuthority
    };
  }
}
