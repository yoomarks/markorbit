type JsonObject = Record<string, unknown>;

export type CognitiveDependencyOwner = 'CORE' | 'CAPABILITY_ENGINE';
export type CognitiveDependencyKind = 'BLOCKER' | 'LIMITATION' | 'FINDING' | 'DEPENDENCY' | 'UNKNOWN';

export interface CognitiveDependencyEvidence {
  label: string;
  value: string;
}

export interface CognitiveDependencyPath {
  id: string;
  owner: CognitiveDependencyOwner;
  kind: CognitiveDependencyKind;
  title: string;
  currentState: string;
  why: string;
  affects: string;
  dependency: string;
  evidence: readonly CognitiveDependencyEvidence[];
}

export const CAPABILITY_INTEGRITY_BOUNDARY =
  'Structural integrity is owner audit truth only. Healthy integrity does not establish source currentness, method correctness, Recommendation suitability, product readiness, legal correctness or Official Truth.';

function object(value: unknown): JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function objects(value: unknown): readonly JsonObject[] {
  return Array.isArray(value) ? value.map(object) : [];
}

function text(value: unknown, fallback = 'Unavailable'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function scalar(value: unknown, fallback = 'Unavailable'): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
}

function evidence(label: string, value: unknown): CognitiveDependencyEvidence | null {
  if (typeof value === 'string' && value.trim()) return { label, value };
  if (typeof value === 'number' && Number.isFinite(value)) return { label, value: String(value) };
  return null;
}

function evidenceList(
  items: readonly (CognitiveDependencyEvidence | null)[]
): readonly CognitiveDependencyEvidence[] {
  return items.filter((item): item is CognitiveDependencyEvidence => item !== null);
}

function sorted(values: readonly JsonObject[], key: (value: JsonObject) => string): readonly JsonObject[] {
  return [...values].sort((left, right) => key(left).localeCompare(key(right)));
}

function sourceEvidence(source: JsonObject): readonly CognitiveDependencyEvidence[] {
  const watermark = object(source.watermark);
  return evidenceList([
    evidence('Source kind', source.kind),
    evidence('Report fingerprint', source.reportFingerprintSha256),
    evidence('Coverage status', source.coverageStatus),
    evidence('Evidence id', source.evidenceId),
    evidence('Evidence fingerprint', source.evidenceFingerprintSha256),
    evidence('Source audit fingerprint', source.sourceAuditFingerprintSha256),
    evidence('Demand id', source.demandId),
    evidence('Demand fingerprint', source.demandFingerprintSha256),
    evidence('Admission sequence', watermark.admissionSequence),
    evidence('Method outcome evidence id', watermark.methodOutcomeEvidenceId)
  ]);
}

function buildBrainGapPaths(value: JsonObject): readonly CognitiveDependencyPath[] {
  const buildRuns = object(value.brainBuildRuns);
  return sorted(
    objects(value.brainGaps).filter((gap) => gap.status === 'OPEN'),
    (gap) => text(gap.brainGapRegistryKey, '')
  ).map((gap) => {
    const key = text(gap.brainGapRegistryKey);
    const relatedBuildRunId = optionalText(gap.relatedBrainBuildRunId);
    const buildAvailability = optionalText(buildRuns.availability);
    return {
      id: `core-gap:${key}`,
      owner: 'CORE' as const,
      kind: 'BLOCKER' as const,
      title: `Open BrainGap · ${key}`,
      currentState: `Core reports BrainGap ${key} as OPEN with reason ${text(gap.reasonCode)}.`,
      why: `Owner business impact: ${text(gap.businessImpact)}. Target module: ${text(gap.targetModule)}.`,
      affects:
        'Impact is bounded to the owner-supplied BrainGap target/scope. No Method Improvement admission, candidate, readiness or product consequence is inferred from the gap alone.',
      dependency: relatedBuildRunId
        ? `Core explicitly references Brain Build Run ${relatedBuildRunId}. Durable Brain Build Run inventory is ${buildAvailability ?? 'not established in this projection'}; no additional Method Improvement relationship is inferred.`
        : 'No Method Improvement admission dependency is established for this BrainGap in the current owner projection.',
      evidence: evidenceList([
        evidence('BrainGap registry key', gap.brainGapRegistryKey),
        evidence('Identity fingerprint', gap.identityFingerprintSha256),
        evidence('Gap type', gap.gapType),
        evidence('Severity', gap.severity),
        evidence('Detection source', gap.detectionSource),
        evidence('Reason code', gap.reasonCode),
        evidence('Target module', gap.targetModule),
        evidence('First detected', gap.firstDetectedAt),
        evidence('Last detected', gap.lastDetectedAt),
        evidence('Occurrences', gap.occurrenceCount),
        evidence('Related Brain Build Run', gap.relatedBrainBuildRunId),
        evidence('Related Brain Asset version', gap.relatedBrainAssetVersionId)
      ])
    };
  });
}

function buildMethodImprovementPaths(value: JsonObject): readonly CognitiveDependencyPath[] {
  const buildRuns = object(value.brainBuildRuns);
  const buildAvailability = optionalText(buildRuns.availability);
  const buildReason = optionalText(buildRuns.reasonCode);

  return sorted(objects(value.methodImprovements), (item) => {
    const trigger = object(item.trigger);
    return `${text(trigger.admittedAt, '')}:${text(trigger.triggerId, '')}`;
  }).map((item) => {
    const trigger = object(item.trigger);
    const mission = object(item.researchMission);
    const triggerId = optionalText(trigger.triggerId);
    const triggerFingerprint = optionalText(trigger.triggerFingerprintSha256);
    const missionTriggerId = optionalText(mission.triggerId);
    const missionTriggerFingerprint = optionalText(mission.triggerFingerprintSha256);
    const bound =
      triggerId !== undefined &&
      triggerFingerprint !== undefined &&
      missionTriggerId === triggerId &&
      missionTriggerFingerprint === triggerFingerprint;
    const missionId = text(mission.researchMissionId);
    const source = object(trigger.source);
    const predecessor = object(trigger.predecessor);
    const target = object(trigger.target);
    const targetPredecessor = object(target.predecessor);

    if (!bound) {
      return {
        id: `core-method-unestablished:${triggerId ?? missionId}`,
        owner: 'CORE' as const,
        kind: 'UNKNOWN' as const,
        title: 'Method Improvement dependency is not established',
        currentState:
          'The current owner payload does not provide a valid exact triggerId + triggerFingerprint binding between this admission and Research Mission.',
        why: 'The console refuses to join incomplete or mismatched lineage.',
        affects:
          'No Research Mission, candidate, evaluation, shadow/pilot, governance or activation consequence is inferred from this record.',
        dependency: 'Core owner truth must establish the trigger-to-mission binding before the path can be connected.',
        evidence: evidenceList([
          evidence('Trigger id', trigger.triggerId),
          evidence('Trigger fingerprint', trigger.triggerFingerprintSha256),
          evidence('Mission id', mission.researchMissionId),
          evidence('Mission trigger id', mission.triggerId),
          evidence('Mission trigger fingerprint', mission.triggerFingerprintSha256)
        ])
      };
    }

    const buildDependency =
      buildAvailability === 'NOT_DURABLY_RECORDED'
        ? `Durable Brain Build Run inventory is NOT_DURABLY_RECORDED${buildReason ? ` (${buildReason})` : ''}. Downstream build-run state cannot be established from this read plane.`
        : buildAvailability
          ? `Core reports Brain Build Run availability as ${buildAvailability}. No per-mission build relationship is inferred unless the owner supplies one.`
          : 'Brain Build Run dependency is not established in the current owner projection.';

    return {
      id: `core-method:${triggerId}`,
      owner: 'CORE' as const,
      kind: buildAvailability === 'NOT_DURABLY_RECORDED' ? ('LIMITATION' as const) : ('DEPENDENCY' as const),
      title: `${text(trigger.triggerType)} admission → Research Mission`,
      currentState: `Core bound trigger ${triggerId} to Research Mission ${missionId} by exact trigger id and fingerprint.`,
      why: `The Method Improvement admission exists and was admitted at ${text(trigger.admittedAt)}.`,
      affects:
        'This establishes admitted research lineage only. Research Mission existence does not establish a candidate method, evaluation, shadow/pilot, governance decision or activation.',
      dependency: buildDependency,
      evidence: evidenceList([
        evidence('Trigger id', trigger.triggerId),
        evidence('Trigger type', trigger.triggerType),
        evidence('Trigger fingerprint', trigger.triggerFingerprintSha256),
        evidence('Admitted at', trigger.admittedAt),
        evidence('Research Mission id', mission.researchMissionId),
        evidence('Mission fingerprint', mission.missionFingerprintSha256),
        evidence('Mission created at', mission.createdAt),
        evidence('Predecessor method package', predecessor.methodPackageRef),
        evidence('Predecessor method', predecessor.methodRef),
        evidence('Predecessor method version', predecessor.methodVersionRef),
        evidence('Predecessor evaluation', predecessor.evaluationRef),
        evidence('Predecessor package fingerprint', predecessor.packageFingerprintSha256),
        evidence('Target kind', target.kind),
        evidence('Target demand id', target.demandId),
        evidence('Target demand fingerprint', target.demandFingerprintSha256),
        evidence('Target predecessor method package', targetPredecessor.methodPackageRef),
        ...sourceEvidence(source)
      ])
    };
  });
}

function buildBrainBuildRunPath(value: JsonObject): readonly CognitiveDependencyPath[] {
  const buildRuns = object(value.brainBuildRuns);
  if (buildRuns.availability === 'NOT_DURABLY_RECORDED' && buildRuns.inventory === null) {
    return [
      {
        id: 'core-build-runs:not-durably-recorded',
        owner: 'CORE',
        kind: 'LIMITATION',
        title: 'Durable Brain Build Run inventory is not recorded',
        currentState:
          'Core explicitly reports Brain Build Run availability as NOT_DURABLY_RECORDED with inventory=null.',
        why: `Owner reason: ${text(buildRuns.reasonCode)}.`,
        affects:
          'The read plane cannot establish zero runs, complete history, build completion, health or readiness from the absence of durable inventory.',
        dependency:
          'A durable Core owner Brain Build Run recording source is required before this surface can establish durable build-run inventory.',
        evidence: evidenceList([
          evidence('Availability', buildRuns.availability),
          evidence('Reason code', buildRuns.reasonCode)
        ])
      }
    ];
  }
  if (optionalText(buildRuns.availability) === undefined) {
    return [
      {
        id: 'core-build-runs:unestablished',
        owner: 'CORE',
        kind: 'UNKNOWN',
        title: 'Brain Build Run dependency is not established',
        currentState: 'No valid Brain Build Run availability field is present in the current Core projection.',
        why: 'The console does not reinterpret missing owner state as an empty inventory.',
        affects: 'Build-run history, completion and readiness remain unknown.',
        dependency: 'Core owner truth must provide a bounded availability state.',
        evidence: []
      }
    ];
  }
  return [];
}

export function buildCoreDependencyPaths(value: unknown): readonly CognitiveDependencyPath[] {
  const root = object(value);
  return [
    ...buildBrainGapPaths(root),
    ...buildMethodImprovementPaths(root),
    ...buildBrainBuildRunPath(root)
  ];
}

function catalogIntegrityPaths(value: JsonObject): readonly CognitiveDependencyPath[] {
  const integrity = object(value.catalogIntegrity);
  if (integrity.status === 'CATALOG_AUDIT_UNAVAILABLE') {
    return [
      {
        id: 'capability-catalog:audit-unavailable',
        owner: 'CAPABILITY_ENGINE',
        kind: 'LIMITATION',
        title: 'Capability catalog integrity audit is unavailable',
        currentState: 'Capability Engine explicitly reports CATALOG_AUDIT_UNAVAILABLE.',
        why: `Unavailable dependency: ${text(integrity.unavailableDependency)}.`,
        affects:
          'Catalog structural integrity cannot be established from this projection. Unavailable is not empty, healthy or known absent.',
        dependency: `Capability Engine dependency ${text(integrity.unavailableDependency)} must become available before the owner audit can establish catalog integrity.`,
        evidence: evidenceList([
          evidence('Status', integrity.status),
          evidence('Unavailable dependency', integrity.unavailableDependency)
        ])
      }
    ];
  }
  if (integrity.status === 'CATALOG_INTEGRITY_FINDINGS') {
    return sorted(objects(integrity.findings), (finding) => text(finding.findingId, '')).map(
      (finding) => {
        const runtime = object(finding.runtimeCapability);
        const profiles = objects(finding.implementationProfiles);
        const affected = [
          optionalText(finding.capabilityId) ? `capability ${text(finding.capabilityId)}` : null,
          optionalText(runtime.runtimeCapabilityDefinitionId)
            ? `runtime ${text(runtime.runtimeCapabilityDefinitionId)} v${scalar(runtime.version)}`
            : null,
          ...profiles.map(
            (profile) =>
              `profile ${text(profile.implementationProfileId)} v${scalar(profile.version)} (${text(profile.status)})`
          )
        ].filter((item): item is string => item !== null);
        return {
          id: `capability-catalog:${text(finding.findingId)}`,
          owner: 'CAPABILITY_ENGINE' as const,
          kind: 'FINDING' as const,
          title: `Catalog integrity finding · ${text(finding.code)}`,
          currentState: `Capability Engine owner audit returned finding ${text(finding.findingId)}.`,
          why: `Owner finding code: ${text(finding.code)}.`,
          affects:
            affected.length > 0
              ? `Owner finding explicitly references ${affected.join(', ')}. No source-currentness, method-correctness or product-readiness consequence is inferred.`
              : 'The owner finding does not establish an affected Runtime Capability/Profile identity in this payload.',
          dependency:
            'Resolution belongs to the Capability Engine owner records referenced by the finding; this Control Center surface has no remediation authority.',
          evidence: evidenceList([
            evidence('Finding id', finding.findingId),
            evidence('Finding code', finding.code),
            evidence('Finding fingerprint', finding.findingFingerprintSha256),
            evidence('Capability id', finding.capabilityId),
            evidence('Runtime definition id', runtime.runtimeCapabilityDefinitionId),
            evidence('Runtime version', runtime.version),
            ...profiles.flatMap((profile, index) =>
              evidenceList([
                evidence(`Profile ${index + 1} id`, profile.implementationProfileId),
                evidence(`Profile ${index + 1} version`, profile.version),
                evidence(`Profile ${index + 1} status`, profile.status),
                evidence(`Profile ${index + 1} implementation key`, profile.implementationKey)
              ])
            )
          ])
        };
      }
    );
  }
  if (integrity.status === 'CATALOG_HEALTHY') return [];
  return [
    {
      id: 'capability-catalog:unestablished',
      owner: 'CAPABILITY_ENGINE',
      kind: 'UNKNOWN',
      title: 'Capability catalog integrity dependency is not established',
      currentState: 'No recognized catalogIntegrity owner status is present in the current projection.',
      why: 'The console refuses to infer healthy or empty catalog state from missing/malformed owner truth.',
      affects: 'Catalog structural integrity remains unknown.',
      dependency: 'Capability Engine owner truth must provide a bounded catalogIntegrity status.',
      evidence: evidenceList([evidence('Raw owner status', integrity.status)])
    }
  ];
}

function sourcePolicyBindingPaths(value: JsonObject): readonly CognitiveDependencyPath[] {
  const integrity = object(value.sourcePolicyBindingIntegrity);
  if (integrity.status === 'SOURCE_POLICY_BINDING_AUDIT_UNAVAILABLE') {
    return [
      {
        id: 'capability-source-policy:audit-unavailable',
        owner: 'CAPABILITY_ENGINE',
        kind: 'LIMITATION',
        title: 'Source-policy binding audit is unavailable',
        currentState:
          'Capability Engine explicitly reports SOURCE_POLICY_BINDING_AUDIT_UNAVAILABLE.',
        why: `Unavailable dependency: ${text(integrity.unavailableDependency)}.`,
        affects:
          'Source-policy binding integrity cannot be established. This does not imply missing policies, healthy bindings or admissible production sources.',
        dependency: `Capability Engine dependency ${text(integrity.unavailableDependency)} must become available before the owner audit can establish binding integrity.`,
        evidence: evidenceList([
          evidence('Status', integrity.status),
          evidence('Unavailable dependency', integrity.unavailableDependency)
        ])
      }
    ];
  }
  if (integrity.status === 'SOURCE_POLICY_BINDING_FINDINGS') {
    return sorted(objects(integrity.findings), (finding) => text(finding.findingId, '')).map(
      (finding) => {
        const policy = object(finding.policy);
        const runtime = object(finding.currentRuntimeCapability);
        const profile = object(finding.currentImplementationProfile);
        return {
          id: `capability-source-policy:${text(finding.findingId)}`,
          owner: 'CAPABILITY_ENGINE' as const,
          kind: 'FINDING' as const,
          title: `Source-policy binding finding · ${text(finding.code)}`,
          currentState: `Capability Engine owner audit returned finding ${text(finding.findingId)} for policy ${text(policy.policyId)} v${scalar(policy.policyVersion)}.`,
          why: `Owner finding code: ${text(finding.code)}. Policy fingerprint is preserved exactly as supplied by the owner.`,
          affects: `Owner finding references capability ${text(policy.capabilityId)}@${text(policy.capabilityVersion)} and profile ${text(policy.implementationProfileId)} v${scalar(policy.implementationProfileVersion)}${optionalText(runtime.runtimeCapabilityDefinitionId) ? `; current runtime ${text(runtime.runtimeCapabilityDefinitionId)} v${scalar(runtime.version)}` : ''}${optionalText(profile.implementationProfileId) ? `; current profile ${text(profile.implementationProfileId)} v${scalar(profile.version)} (${text(profile.status)})` : ''}. No Method/Reference currentness, Recommendation suitability or product readiness is inferred.`,
          dependency:
            'Resolution belongs to the exact Capability Engine policy/catalog binding referenced by the owner finding; this read surface has no promotion or remediation authority.',
          evidence: evidenceList([
            evidence('Finding id', finding.findingId),
            evidence('Finding code', finding.code),
            evidence('Finding fingerprint', finding.findingFingerprintSha256),
            evidence('Policy id', policy.policyId),
            evidence('Policy version', policy.policyVersion),
            evidence('Policy fingerprint', policy.policyFingerprintSha256),
            evidence('Policy maturity', policy.maturityClass),
            evidence('Capability id', policy.capabilityId),
            evidence('Capability version', policy.capabilityVersion),
            evidence('Bound profile id', policy.implementationProfileId),
            evidence('Bound profile version', policy.implementationProfileVersion),
            evidence('Current runtime definition id', runtime.runtimeCapabilityDefinitionId),
            evidence('Current runtime version', runtime.version),
            evidence('Current profile id', profile.implementationProfileId),
            evidence('Current profile version', profile.version),
            evidence('Current profile status', profile.status),
            evidence('Current profile implementation key', profile.implementationKey)
          ])
        };
      }
    );
  }
  if (integrity.status === 'SOURCE_POLICY_BINDINGS_HEALTHY') return [];
  return [
    {
      id: 'capability-source-policy:unestablished',
      owner: 'CAPABILITY_ENGINE',
      kind: 'UNKNOWN',
      title: 'Source-policy binding dependency is not established',
      currentState:
        'No recognized sourcePolicyBindingIntegrity owner status is present in the current projection.',
      why: 'The console refuses to infer healthy or empty binding state from missing/malformed owner truth.',
      affects: 'Source-policy binding integrity and current affected references remain unknown.',
      dependency: 'Capability Engine owner truth must provide a bounded sourcePolicyBindingIntegrity status.',
      evidence: evidenceList([evidence('Raw owner status', integrity.status)])
    }
  ];
}

function exactProfilePolicies(profile: JsonObject, policies: readonly JsonObject[]): readonly JsonObject[] {
  const profileId = optionalText(profile.implementationProfileId);
  const profileVersion = scalar(profile.version, '');
  const capabilityId = optionalText(profile.capabilityId);
  const capabilityVersion = optionalText(profile.capabilityVersion);
  if (!profileId || !profileVersion || !capabilityId || !capabilityVersion) return [];
  return policies.filter(
    (policy) =>
      optionalText(policy.implementationProfileId) === profileId &&
      scalar(policy.implementationProfileVersion, '') === profileVersion &&
      optionalText(policy.capabilityId) === capabilityId &&
      optionalText(policy.capabilityVersion) === capabilityVersion
  );
}

function exactProfileRuntimes(profile: JsonObject, runtimes: readonly JsonObject[]): readonly JsonObject[] {
  const capabilityId = optionalText(profile.capabilityId);
  const capabilityVersion = optionalText(profile.capabilityVersion);
  if (!capabilityId || !capabilityVersion) return [];
  return runtimes.filter(
    (runtime) =>
      optionalText(runtime.capabilityId) === capabilityId &&
      optionalText(runtime.capabilityVersion) === capabilityVersion
  );
}

function structuralCapabilityPaths(value: JsonObject): readonly CognitiveDependencyPath[] {
  const runtimes = objects(value.runtimeCapabilities);
  const policies = objects(value.sourceAdmissionPolicies);
  return sorted(objects(value.implementationProfiles), (profile) =>
    `${text(profile.implementationProfileId, '')}:${scalar(profile.version, '')}`
  ).map((profile) => {
    const profileId = text(profile.implementationProfileId);
    const profileVersion = scalar(profile.version);
    const matchingRuntimes = exactProfileRuntimes(profile, runtimes);
    const matchingPolicies = exactProfilePolicies(profile, policies);
    const runtimeEstablished = matchingRuntimes.length > 0;
    const policyEstablished = matchingPolicies.length > 0;
    const currentState = runtimeEstablished
      ? `Implementation Profile ${profileId} v${profileVersion} carries capability identity ${text(profile.capabilityId)}@${text(profile.capabilityVersion)}, with ${matchingRuntimes.length} exact Runtime Capability record(s) on that owner identity.`
      : `Implementation Profile ${profileId} v${profileVersion} references capability ${text(profile.capabilityId)}@${text(profile.capabilityVersion)}, but no exact Runtime Capability record is present in the current projection.`;
    const dependency = policyEstablished
      ? `${matchingPolicies.length} source-admission policy record(s) explicitly bind to profile ${profileId} v${profileVersion} by exact profile id/version and capability id/version.`
      : `No source-admission policy binding is established for profile ${profileId} v${profileVersion} in the current owner projection.`;

    return {
      id: `capability-chain:${profileId}:${profileVersion}`,
      owner: 'CAPABILITY_ENGINE',
      kind: runtimeEstablished && policyEstablished ? 'DEPENDENCY' : 'UNKNOWN',
      title: 'Runtime Capability → Implementation Profile → source-admission policy',
      currentState,
      why:
        'This path uses only exact owner-supplied capability/profile identity fields and exact policy profile bindings; it does not join records by title, timing or similarity.',
      affects:
        'The path establishes structural registry binding only. APPROVED profile status is not source admission; PRODUCTION_ADMISSIBLE policy maturity is not Method/Reference currentness, Recommendation authority, legal correctness or product readiness.',
      dependency,
      evidence: evidenceList([
        evidence('Implementation Profile id', profile.implementationProfileId),
        evidence('Implementation Profile version', profile.version),
        evidence('Implementation Profile status', profile.status),
        evidence('Capability id', profile.capabilityId),
        evidence('Capability version', profile.capabilityVersion),
        evidence('Implementation key', profile.implementationKey),
        ...matchingRuntimes.flatMap((runtime, index) =>
          evidenceList([
            evidence(`Runtime ${index + 1} definition id`, runtime.runtimeCapabilityDefinitionId),
            evidence(`Runtime ${index + 1} version`, runtime.version),
            evidence(`Runtime ${index + 1} canon fingerprint`, object(runtime.canonReference).sourceFingerprintSha256)
          ])
        ),
        ...matchingPolicies.flatMap((policy, index) =>
          evidenceList([
            evidence(`Policy ${index + 1} id`, policy.policyId),
            evidence(`Policy ${index + 1} version`, policy.policyVersion),
            evidence(`Policy ${index + 1} fingerprint`, policy.policyFingerprintSha256),
            evidence(`Policy ${index + 1} maturity`, policy.maturityClass)
          ])
        )
      ])
    };
  });
}

export function buildCapabilityDependencyPaths(value: unknown): readonly CognitiveDependencyPath[] {
  const root = object(value);
  return [
    ...catalogIntegrityPaths(root),
    ...sourcePolicyBindingPaths(root),
    ...structuralCapabilityPaths(root)
  ];
}
