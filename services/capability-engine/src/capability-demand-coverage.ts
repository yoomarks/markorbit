import { createHash } from 'node:crypto';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import {
  capabilityRiskClasses,
  type CapabilityRiskClass,
  type ImplementationProfile
} from '@markorbit/contracts/capability-runtime';
import type { CapabilitySourceAdmissionDecision } from './current-source-admission.js';

const RISK_RANK: Readonly<Record<CapabilityRiskClass, number>> = Object.freeze({
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
  PROTECTED: 3
});

export type CapabilityDemandCoverageStatus =
  | 'PRODUCTION_COVERED'
  | 'RUNTIME_COVERED'
  | 'MISSING_RUNTIME_CAPABILITY'
  | 'NO_APPROVED_IMPLEMENTATION'
  | 'AMBIGUOUS_CURRENT_IMPLEMENTATION'
  | 'RUNTIME_COVERED_SOURCE_UNPROVEN'
  | 'SOURCE_ADMISSION_DENIED'
  | 'SOURCE_PROOF_NOT_CURRENT'
  | 'COVERAGE_AUDIT_UNAVAILABLE';

export interface ProductCapabilityDemandV1 {
  schemaVersion: 1;
  demandKey: string;
  consumerProduct: string;
  capabilityId: string;
  inputSchemaId: string;
  outputSchemaId: string;
  riskClass: CapabilityRiskClass;
  requiredImplementationKey?: string;
  requiresProductionAdmissibleSource: boolean;
}

export interface ProductCapabilityDemandIdentityV1 extends ProductCapabilityDemandV1 {
  demandId: `capability-demand_${string}`;
  demandFingerprintSha256: string;
}

export interface CapabilityDemandCoverageNoAuthorityV1 {
  brainGapCreated: false;
  methodImprovementTriggerCreated: false;
  researchMissionCreated: false;
  productStateCreated: false;
  officialTruthCreated: false;
  automaticRemediationExecuted: false;
}

export const capabilityDemandCoverageNoAuthority = Object.freeze({
  brainGapCreated: false,
  methodImprovementTriggerCreated: false,
  researchMissionCreated: false,
  productStateCreated: false,
  officialTruthCreated: false,
  automaticRemediationExecuted: false
}) satisfies Readonly<CapabilityDemandCoverageNoAuthorityV1>;

export interface CurrentCapabilityCoverageEvidenceV1 {
  runtimeCapabilityDefinitionId: string;
  version: number;
  capabilityId: string;
  capabilityVersion: string;
  canonReference: Readonly<{
    canonId: string;
    canonVersion: string;
    sourceFingerprintSha256: string;
  }>;
}

export interface CurrentImplementationCoverageEvidenceV1 {
  implementationProfileId: string;
  version: number;
  capabilityId: string;
  capabilityVersion: string;
  implementationKey: string;
  kind: ImplementationProfile['kind'];
  status: 'APPROVED';
  inputSchemaId: string;
  outputSchemaId: string;
  maximumRiskClass: CapabilityRiskClass;
  allowedCallerProducts: readonly string[];
}

export type CapabilitySourceProofSummaryV1 =
  | Readonly<{
      decision: 'PRODUCTION_ADMISSIBLE';
      capability: Readonly<{
        runtimeCapabilityDefinitionId: string;
        version: number;
        capabilityId: string;
        capabilityVersion: string;
      }>;
      implementation: Readonly<{
        implementationProfileId: string;
        version: number;
        implementationKey: string;
        status: 'APPROVED';
      }>;
    }>
  | Readonly<{
      decision: 'DENIED';
      denialCode: string;
    }>;

export interface CapabilityDemandCoverageEvidenceV1 {
  currentCapability?: Readonly<CurrentCapabilityCoverageEvidenceV1>;
  qualifyingImplementations: readonly Readonly<CurrentImplementationCoverageEvidenceV1>[];
  selectedImplementation?: Readonly<CurrentImplementationCoverageEvidenceV1>;
  sourceProof?: Readonly<CapabilitySourceProofSummaryV1>;
}

export interface CapabilityCoverageGapCandidateV1 {
  schemaVersion: 1;
  candidateId: `capability-coverage-gap-candidate_${string}`;
  candidateFingerprintSha256: string;
  admissionStatus: 'NOT_ADMITTED';
  demandId: ProductCapabilityDemandIdentityV1['demandId'];
  demandFingerprintSha256: string;
  reasonCode: Exclude<
    CapabilityDemandCoverageStatus,
    'PRODUCTION_COVERED' | 'RUNTIME_COVERED' | 'COVERAGE_AUDIT_UNAVAILABLE'
  >;
  evidence: Readonly<CapabilityDemandCoverageEvidenceV1>;
  authority: Readonly<CapabilityDemandCoverageNoAuthorityV1>;
}

export interface CapabilityDemandCoverageAuditResultV1 {
  schemaVersion: 1;
  status: CapabilityDemandCoverageStatus;
  demand: Readonly<ProductCapabilityDemandIdentityV1>;
  evidence: Readonly<CapabilityDemandCoverageEvidenceV1>;
  gapCandidate?: Readonly<CapabilityCoverageGapCandidateV1>;
  unavailableDependency?: 'CURRENT_CAPABILITY_AUTHORITY' | 'CURRENT_IMPLEMENTATION_AUTHORITY';
  authority: Readonly<CapabilityDemandCoverageNoAuthorityV1>;
}

export interface CurrentRuntimeCapabilityCoverageAuthorityV1 {
  findCurrent(
    capabilityId: string
  ):
    | Readonly<RuntimeCapabilityDefinition>
    | undefined
    | Promise<Readonly<RuntimeCapabilityDefinition> | undefined>;
}

export interface CurrentImplementationCoverageAuthorityV1 {
  listCurrent(
    capabilityId?: string
  ):
    | readonly Readonly<ImplementationProfile>[]
    | Promise<readonly Readonly<ImplementationProfile>[]>;
}

export interface CapabilityDemandCoverageAuditorOptionsV1 {
  capabilities: Readonly<CurrentRuntimeCapabilityCoverageAuthorityV1>;
  implementations: Readonly<CurrentImplementationCoverageAuthorityV1>;
}

type RecordValue = Record<string, unknown>;

function invalid(message: string): never {
  throw new Error(`Invalid Product Capability demand: ${message}`);
}

function record(value: unknown): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid('must be an object.');
  return value as RecordValue;
}

function exactKeys(value: RecordValue, allowed: readonly string[]): void {
  const accepted = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !accepted.has(key));
  if (unknown.length > 0) invalid(`unsupported fields: ${unknown.join(', ')}.`);
}

function text(value: unknown, field: string, maximum = 300): string {
  if (typeof value !== 'string') return invalid(`${field} must be a string.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    return invalid(`${field} must contain between 1 and ${maximum} characters.`);
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

function sha256(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

export function normalizeProductCapabilityDemandV1(value: unknown): ProductCapabilityDemandV1 {
  const demand = record(value);
  exactKeys(demand, [
    'schemaVersion',
    'demandKey',
    'consumerProduct',
    'capabilityId',
    'inputSchemaId',
    'outputSchemaId',
    'riskClass',
    'requiredImplementationKey',
    'requiresProductionAdmissibleSource'
  ]);
  if (demand.schemaVersion !== 1) invalid('schemaVersion must be 1.');
  if (
    typeof demand.riskClass !== 'string' ||
    !(capabilityRiskClasses as readonly string[]).includes(demand.riskClass)
  ) {
    invalid('riskClass is invalid.');
  }
  if (typeof demand.requiresProductionAdmissibleSource !== 'boolean')
    invalid('requiresProductionAdmissibleSource must be boolean.');
  return {
    schemaVersion: 1,
    demandKey: text(demand.demandKey, 'demandKey'),
    consumerProduct: text(demand.consumerProduct, 'consumerProduct', 120),
    capabilityId: text(demand.capabilityId, 'capabilityId'),
    inputSchemaId: text(demand.inputSchemaId, 'inputSchemaId'),
    outputSchemaId: text(demand.outputSchemaId, 'outputSchemaId'),
    riskClass: demand.riskClass as CapabilityRiskClass,
    ...(demand.requiredImplementationKey === undefined
      ? {}
      : {
          requiredImplementationKey: text(
            demand.requiredImplementationKey,
            'requiredImplementationKey',
            500
          )
        }),
    requiresProductionAdmissibleSource: demand.requiresProductionAdmissibleSource
  };
}

export function productCapabilityDemandIdentityV1(
  value: unknown
): ProductCapabilityDemandIdentityV1 {
  const demand = normalizeProductCapabilityDemandV1(value);
  const demandFingerprintSha256 = sha256(demand);
  return {
    ...demand,
    demandId: `capability-demand_${demandFingerprintSha256}`,
    demandFingerprintSha256
  };
}

function currentCapabilityEvidence(
  definition: Readonly<RuntimeCapabilityDefinition>
): CurrentCapabilityCoverageEvidenceV1 {
  return {
    runtimeCapabilityDefinitionId: definition.runtimeCapabilityDefinitionId,
    version: definition.version,
    capabilityId: definition.capabilityId,
    capabilityVersion: definition.capabilityVersion,
    canonReference: structuredClone(definition.canonReference)
  };
}

function implementationEvidence(
  profile: Readonly<ImplementationProfile>
): CurrentImplementationCoverageEvidenceV1 {
  return {
    implementationProfileId: profile.implementationProfileId,
    version: profile.version,
    capabilityId: profile.capabilityId,
    capabilityVersion: profile.capabilityVersion,
    implementationKey: profile.implementationKey,
    kind: profile.kind,
    status: 'APPROVED',
    inputSchemaId: profile.inputSchemaId,
    outputSchemaId: profile.outputSchemaId,
    maximumRiskClass: profile.maximumRiskClass,
    allowedCallerProducts: [...profile.allowedCallerProducts]
  };
}

function callerAllowed(profile: Readonly<ImplementationProfile>, consumerProduct: string): boolean {
  return (
    profile.allowedCallerProducts.includes('*') ||
    profile.allowedCallerProducts.includes(consumerProduct)
  );
}

function profileQualifies(
  profile: Readonly<ImplementationProfile>,
  currentCapability: Readonly<RuntimeCapabilityDefinition>,
  demand: Readonly<ProductCapabilityDemandIdentityV1>
): boolean {
  return (
    profile.status === 'APPROVED' &&
    profile.capabilityId === currentCapability.capabilityId &&
    profile.capabilityVersion === currentCapability.capabilityVersion &&
    profile.inputSchemaId === demand.inputSchemaId &&
    profile.outputSchemaId === demand.outputSchemaId &&
    callerAllowed(profile, demand.consumerProduct) &&
    RISK_RANK[demand.riskClass] <= RISK_RANK[profile.maximumRiskClass] &&
    (demand.requiredImplementationKey === undefined ||
      profile.implementationKey === demand.requiredImplementationKey)
  );
}

function sourceProofSummary(
  decision: Readonly<CapabilitySourceAdmissionDecision>
): CapabilitySourceProofSummaryV1 {
  if (decision.decision === 'DENIED') {
    return {
      decision: 'DENIED',
      denialCode: decision.denial.code
    };
  }
  return {
    decision: 'PRODUCTION_ADMISSIBLE',
    capability: structuredClone(decision.current.capability),
    implementation: structuredClone(decision.current.implementation)
  };
}

function sourceProofMatches(
  decision: Readonly<CapabilitySourceAdmissionDecision>,
  currentCapability: Readonly<RuntimeCapabilityDefinition>,
  selected: Readonly<ImplementationProfile>
): boolean {
  if (decision.decision !== 'PRODUCTION_ADMISSIBLE') return false;
  const capability = decision.current.capability;
  const implementation = decision.current.implementation;
  return (
    capability.runtimeCapabilityDefinitionId === currentCapability.runtimeCapabilityDefinitionId &&
    capability.version === currentCapability.version &&
    capability.capabilityId === currentCapability.capabilityId &&
    capability.capabilityVersion === currentCapability.capabilityVersion &&
    implementation.implementationProfileId === selected.implementationProfileId &&
    implementation.version === selected.version &&
    implementation.implementationKey === selected.implementationKey &&
    implementation.status === 'APPROVED'
  );
}

function evidence(
  currentCapability: Readonly<RuntimeCapabilityDefinition> | undefined,
  qualifying: readonly Readonly<ImplementationProfile>[],
  selected?: Readonly<ImplementationProfile>,
  sourceAdmission?: Readonly<CapabilitySourceAdmissionDecision>
): CapabilityDemandCoverageEvidenceV1 {
  return {
    ...(currentCapability === undefined
      ? {}
      : { currentCapability: currentCapabilityEvidence(currentCapability) }),
    qualifyingImplementations: qualifying.map(implementationEvidence),
    ...(selected === undefined ? {} : { selectedImplementation: implementationEvidence(selected) }),
    ...(sourceAdmission === undefined ? {} : { sourceProof: sourceProofSummary(sourceAdmission) })
  };
}

function gapCandidate(
  demand: Readonly<ProductCapabilityDemandIdentityV1>,
  reasonCode: CapabilityCoverageGapCandidateV1['reasonCode'],
  auditEvidence: Readonly<CapabilityDemandCoverageEvidenceV1>
): CapabilityCoverageGapCandidateV1 {
  const basis = {
    admissionStatus: 'NOT_ADMITTED' as const,
    demandId: demand.demandId,
    demandFingerprintSha256: demand.demandFingerprintSha256,
    reasonCode,
    evidence: auditEvidence,
    authority: capabilityDemandCoverageNoAuthority
  };
  const candidateFingerprintSha256 = sha256(basis);
  return {
    schemaVersion: 1,
    candidateId: `capability-coverage-gap-candidate_${candidateFingerprintSha256}`,
    candidateFingerprintSha256,
    ...structuredClone(basis)
  };
}

function resolvedResult(
  status: Exclude<CapabilityDemandCoverageStatus, 'COVERAGE_AUDIT_UNAVAILABLE'>,
  demand: Readonly<ProductCapabilityDemandIdentityV1>,
  auditEvidence: Readonly<CapabilityDemandCoverageEvidenceV1>
): CapabilityDemandCoverageAuditResultV1 {
  const covered = status === 'PRODUCTION_COVERED' || status === 'RUNTIME_COVERED';
  return {
    schemaVersion: 1,
    status,
    demand: structuredClone(demand),
    evidence: structuredClone(auditEvidence),
    ...(covered ? {} : { gapCandidate: gapCandidate(demand, status, auditEvidence) }),
    authority: capabilityDemandCoverageNoAuthority
  };
}

function unavailableResult(
  demand: Readonly<ProductCapabilityDemandIdentityV1>,
  dependency: NonNullable<CapabilityDemandCoverageAuditResultV1['unavailableDependency']>
): CapabilityDemandCoverageAuditResultV1 {
  return {
    schemaVersion: 1,
    status: 'COVERAGE_AUDIT_UNAVAILABLE',
    demand: structuredClone(demand),
    evidence: { qualifyingImplementations: [] },
    unavailableDependency: dependency,
    authority: capabilityDemandCoverageNoAuthority
  };
}

export class CapabilityDemandCoverageAuditorV1 {
  constructor(private readonly options: Readonly<CapabilityDemandCoverageAuditorOptionsV1>) {}

  async audit(
    demandValue: unknown,
    sourceAdmission?: Readonly<CapabilitySourceAdmissionDecision>
  ): Promise<CapabilityDemandCoverageAuditResultV1> {
    const demand = productCapabilityDemandIdentityV1(demandValue);
    let currentCapability: Readonly<RuntimeCapabilityDefinition> | undefined;
    try {
      currentCapability = await this.options.capabilities.findCurrent(demand.capabilityId);
    } catch {
      return unavailableResult(demand, 'CURRENT_CAPABILITY_AUTHORITY');
    }

    if (
      currentCapability === undefined ||
      currentCapability.acceptedCanonProjection !== true ||
      currentCapability.createdFromWorkEvidence !== false ||
      currentCapability.createdFromAiOutput !== false
    ) {
      return resolvedResult('MISSING_RUNTIME_CAPABILITY', demand, evidence(undefined, []));
    }

    let currentProfiles: readonly Readonly<ImplementationProfile>[];
    try {
      currentProfiles = await this.options.implementations.listCurrent(demand.capabilityId);
    } catch {
      return unavailableResult(demand, 'CURRENT_IMPLEMENTATION_AUTHORITY');
    }

    const qualifying = currentProfiles
      .filter((profile) => profileQualifies(profile, currentCapability, demand))
      .sort((left, right) =>
        left.implementationProfileId.localeCompare(right.implementationProfileId)
      );

    if (qualifying.length === 0) {
      return resolvedResult('NO_APPROVED_IMPLEMENTATION', demand, evidence(currentCapability, []));
    }
    if (qualifying.length > 1) {
      return resolvedResult(
        'AMBIGUOUS_CURRENT_IMPLEMENTATION',
        demand,
        evidence(currentCapability, qualifying)
      );
    }

    const selected = qualifying[0]!;
    if (!demand.requiresProductionAdmissibleSource) {
      return resolvedResult(
        'RUNTIME_COVERED',
        demand,
        evidence(currentCapability, qualifying, selected)
      );
    }
    if (sourceAdmission === undefined) {
      return resolvedResult(
        'RUNTIME_COVERED_SOURCE_UNPROVEN',
        demand,
        evidence(currentCapability, qualifying, selected)
      );
    }
    if (sourceAdmission.decision === 'DENIED') {
      return resolvedResult(
        'SOURCE_ADMISSION_DENIED',
        demand,
        evidence(currentCapability, qualifying, selected, sourceAdmission)
      );
    }
    if (!sourceProofMatches(sourceAdmission, currentCapability, selected)) {
      return resolvedResult(
        'SOURCE_PROOF_NOT_CURRENT',
        demand,
        evidence(currentCapability, qualifying, selected, sourceAdmission)
      );
    }
    return resolvedResult(
      'PRODUCTION_COVERED',
      demand,
      evidence(currentCapability, qualifying, selected, sourceAdmission)
    );
  }
}
