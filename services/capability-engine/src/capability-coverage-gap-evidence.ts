import { createHash } from 'node:crypto';
import type {
  CapabilityRiskClass,
  ImplementationProfile
} from '@markorbit/contracts/capability-runtime';
import {
  capabilityDemandCoverageNoAuthority,
  productCapabilityDemandIdentityV1,
  type CapabilityCoverageGapCandidateV1,
  type CapabilityDemandCoverageAuditResultV1,
  type CapabilityDemandCoverageEvidenceV1,
  type CapabilityDemandCoverageStatus,
  type CurrentCapabilityCoverageEvidenceV1,
  type CurrentImplementationCoverageEvidenceV1,
  type ProductCapabilityDemandIdentityV1
} from './capability-demand-coverage.js';

const SHA256 = /^[0-9a-f]{64}$/u;
const GAP_STATUSES = new Set<CapabilityCoverageGapCandidateV1['reasonCode']>([
  'MISSING_RUNTIME_CAPABILITY',
  'NO_APPROVED_IMPLEMENTATION',
  'AMBIGUOUS_CURRENT_IMPLEMENTATION',
  'RUNTIME_COVERED_SOURCE_UNPROVEN',
  'SOURCE_ADMISSION_DENIED',
  'SOURCE_PROOF_NOT_CURRENT'
]);
const COVERED_STATUSES = new Set<CapabilityDemandCoverageStatus>([
  'PRODUCTION_COVERED',
  'RUNTIME_COVERED'
]);

export type CapabilityCoverageGapEvidenceErrorCode =
  'INVALID_COVERAGE_AUDIT' | 'COVERAGE_EVIDENCE_DRIFT';

export class CapabilityCoverageGapEvidenceError extends Error {
  constructor(
    readonly code: CapabilityCoverageGapEvidenceErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'CapabilityCoverageGapEvidenceError';
  }
}

export interface CapabilityCoverageGapEvidenceNoAuthorityV1 {
  brainGapCreated: false;
  methodImprovementTriggerCreated: false;
  researchMissionCreated: false;
  productStateCreated: false;
  officialTruthCreated: false;
  automaticRemediationExecuted: false;
  productionSourceAdmitted: false;
  methodLifecycleChanged: false;
}

export const capabilityCoverageGapEvidenceNoAuthority = Object.freeze({
  ...capabilityDemandCoverageNoAuthority,
  productionSourceAdmitted: false,
  methodLifecycleChanged: false
}) satisfies Readonly<CapabilityCoverageGapEvidenceNoAuthorityV1>;

export interface CapabilityCoverageGapEvidenceV1 {
  schemaVersion: 1;
  evidenceId: `capability-coverage-gap-evidence_${string}`;
  evidenceFingerprintSha256: string;
  classification: 'COVERAGE_GAP_EVIDENCE';
  phase7AdmissionStatus: 'NOT_ADMITTED';
  sourceKind: 'CAPABILITY_DEMAND_COVERAGE_AUDIT_V1';
  sourceAuditFingerprintSha256: string;
  candidateId: CapabilityCoverageGapCandidateV1['candidateId'];
  candidateFingerprintSha256: string;
  coverageStatus: CapabilityCoverageGapCandidateV1['reasonCode'];
  demand: Readonly<ProductCapabilityDemandIdentityV1>;
  evidence: Readonly<CapabilityDemandCoverageEvidenceV1>;
  authority: Readonly<CapabilityCoverageGapEvidenceNoAuthorityV1>;
}

type RecordValue = Record<string, unknown>;

type ParsedResolvedAudit = Readonly<{
  schemaVersion: 1;
  status: Exclude<CapabilityDemandCoverageStatus, 'COVERAGE_AUDIT_UNAVAILABLE'>;
  demand: Readonly<ProductCapabilityDemandIdentityV1>;
  evidence: Readonly<CapabilityDemandCoverageEvidenceV1>;
  gapCandidate?: Readonly<CapabilityCoverageGapCandidateV1>;
  authority: typeof capabilityDemandCoverageNoAuthority;
}>;

function invalid(message: string): never {
  throw new CapabilityCoverageGapEvidenceError('INVALID_COVERAGE_AUDIT', message);
}

function drift(message: string): never {
  throw new CapabilityCoverageGapEvidenceError('COVERAGE_EVIDENCE_DRIFT', message);
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

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    return invalid(`${field} must be a positive safe integer.`);
  return Number(value);
}

function sha256Text(value: unknown, field: string): string {
  const cleaned = text(value, field, 64).toLowerCase();
  if (!SHA256.test(cleaned)) return invalid(`${field} must be a lowercase SHA-256 digest.`);
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

function parseAuditAuthority(
  value: unknown,
  field: string
): typeof capabilityDemandCoverageNoAuthority {
  const authority = record(value, field);
  const expected = capabilityDemandCoverageNoAuthority;
  exactKeys(authority, Object.keys(expected), field);
  if (!same(authority, expected))
    drift(`${field} must retain all demand-audit no-authority flags.`);
  return expected;
}

function parseDemand(value: unknown): ProductCapabilityDemandIdentityV1 {
  const demand = record(value, 'coverageAudit.demand');
  exactKeys(
    demand,
    [
      'schemaVersion',
      'demandKey',
      'consumerProduct',
      'capabilityId',
      'inputSchemaId',
      'outputSchemaId',
      'riskClass',
      'requiredImplementationKey',
      'requiresProductionAdmissibleSource',
      'demandId',
      'demandFingerprintSha256'
    ],
    'coverageAudit.demand'
  );
  const base = {
    schemaVersion: demand.schemaVersion,
    demandKey: demand.demandKey,
    consumerProduct: demand.consumerProduct,
    capabilityId: demand.capabilityId,
    inputSchemaId: demand.inputSchemaId,
    outputSchemaId: demand.outputSchemaId,
    riskClass: demand.riskClass,
    ...(demand.requiredImplementationKey === undefined
      ? {}
      : { requiredImplementationKey: demand.requiredImplementationKey }),
    requiresProductionAdmissibleSource: demand.requiresProductionAdmissibleSource
  };
  let expected: ProductCapabilityDemandIdentityV1;
  try {
    expected = productCapabilityDemandIdentityV1(base);
  } catch (error) {
    return invalid(error instanceof Error ? error.message : 'coverageAudit.demand is invalid.');
  }
  if (!same(demand, expected))
    drift('coverageAudit.demand identity/fingerprint does not match its bounded demand.');
  return expected;
}

function parseCurrentCapability(value: unknown): CurrentCapabilityCoverageEvidenceV1 {
  const current = record(value, 'coverageAudit.evidence.currentCapability');
  exactKeys(
    current,
    [
      'runtimeCapabilityDefinitionId',
      'version',
      'capabilityId',
      'capabilityVersion',
      'canonReference'
    ],
    'coverageAudit.evidence.currentCapability'
  );
  const canonReference = record(
    current.canonReference,
    'coverageAudit.evidence.currentCapability.canonReference'
  );
  exactKeys(
    canonReference,
    ['canonId', 'canonVersion', 'sourceFingerprintSha256'],
    'coverageAudit.evidence.currentCapability.canonReference'
  );
  return {
    runtimeCapabilityDefinitionId: text(
      current.runtimeCapabilityDefinitionId,
      'coverageAudit.evidence.currentCapability.runtimeCapabilityDefinitionId'
    ),
    version: positiveInteger(current.version, 'coverageAudit.evidence.currentCapability.version'),
    capabilityId: text(
      current.capabilityId,
      'coverageAudit.evidence.currentCapability.capabilityId'
    ),
    capabilityVersion: text(
      current.capabilityVersion,
      'coverageAudit.evidence.currentCapability.capabilityVersion'
    ),
    canonReference: {
      canonId: text(
        canonReference.canonId,
        'coverageAudit.evidence.currentCapability.canonReference.canonId'
      ),
      canonVersion: text(
        canonReference.canonVersion,
        'coverageAudit.evidence.currentCapability.canonReference.canonVersion'
      ),
      sourceFingerprintSha256: sha256Text(
        canonReference.sourceFingerprintSha256,
        'coverageAudit.evidence.currentCapability.canonReference.sourceFingerprintSha256'
      )
    }
  };
}

function parseImplementation(
  value: unknown,
  field: string
): CurrentImplementationCoverageEvidenceV1 {
  const profile = record(value, field);
  exactKeys(
    profile,
    [
      'implementationProfileId',
      'version',
      'capabilityId',
      'capabilityVersion',
      'implementationKey',
      'kind',
      'status',
      'inputSchemaId',
      'outputSchemaId',
      'maximumRiskClass',
      'allowedCallerProducts'
    ],
    field
  );
  if (profile.status !== 'APPROVED') invalid(`${field}.status must be APPROVED.`);
  if (!Array.isArray(profile.allowedCallerProducts))
    invalid(`${field}.allowedCallerProducts must be an array.`);
  return {
    implementationProfileId: text(
      profile.implementationProfileId,
      `${field}.implementationProfileId`
    ),
    version: positiveInteger(profile.version, `${field}.version`),
    capabilityId: text(profile.capabilityId, `${field}.capabilityId`),
    capabilityVersion: text(profile.capabilityVersion, `${field}.capabilityVersion`),
    implementationKey: text(profile.implementationKey, `${field}.implementationKey`),
    kind: text(profile.kind, `${field}.kind`) as ImplementationProfile['kind'],
    status: 'APPROVED',
    inputSchemaId: text(profile.inputSchemaId, `${field}.inputSchemaId`),
    outputSchemaId: text(profile.outputSchemaId, `${field}.outputSchemaId`),
    maximumRiskClass: text(
      profile.maximumRiskClass,
      `${field}.maximumRiskClass`
    ) as CapabilityRiskClass,
    allowedCallerProducts: profile.allowedCallerProducts.map((item, index) =>
      text(item, `${field}.allowedCallerProducts[${index}]`, 120)
    )
  };
}

function parseSourceProof(
  value: unknown
): NonNullable<CapabilityDemandCoverageEvidenceV1['sourceProof']> {
  const proof = record(value, 'coverageAudit.evidence.sourceProof');
  if (proof.decision === 'DENIED') {
    exactKeys(proof, ['decision', 'denialCode'], 'coverageAudit.evidence.sourceProof');
    return {
      decision: 'DENIED',
      denialCode: text(proof.denialCode, 'coverageAudit.evidence.sourceProof.denialCode', 120)
    };
  }
  if (proof.decision !== 'PRODUCTION_ADMISSIBLE')
    invalid('coverageAudit.evidence.sourceProof.decision is invalid.');
  exactKeys(
    proof,
    ['decision', 'capability', 'implementation'],
    'coverageAudit.evidence.sourceProof'
  );
  const capability = record(proof.capability, 'coverageAudit.evidence.sourceProof.capability');
  exactKeys(
    capability,
    ['runtimeCapabilityDefinitionId', 'version', 'capabilityId', 'capabilityVersion'],
    'coverageAudit.evidence.sourceProof.capability'
  );
  const implementation = record(
    proof.implementation,
    'coverageAudit.evidence.sourceProof.implementation'
  );
  exactKeys(
    implementation,
    ['implementationProfileId', 'version', 'implementationKey', 'status'],
    'coverageAudit.evidence.sourceProof.implementation'
  );
  if (implementation.status !== 'APPROVED')
    invalid('coverageAudit.evidence.sourceProof.implementation.status must be APPROVED.');
  return {
    decision: 'PRODUCTION_ADMISSIBLE',
    capability: {
      runtimeCapabilityDefinitionId: text(
        capability.runtimeCapabilityDefinitionId,
        'coverageAudit.evidence.sourceProof.capability.runtimeCapabilityDefinitionId'
      ),
      version: positiveInteger(
        capability.version,
        'coverageAudit.evidence.sourceProof.capability.version'
      ),
      capabilityId: text(
        capability.capabilityId,
        'coverageAudit.evidence.sourceProof.capability.capabilityId'
      ),
      capabilityVersion: text(
        capability.capabilityVersion,
        'coverageAudit.evidence.sourceProof.capability.capabilityVersion'
      )
    },
    implementation: {
      implementationProfileId: text(
        implementation.implementationProfileId,
        'coverageAudit.evidence.sourceProof.implementation.implementationProfileId'
      ),
      version: positiveInteger(
        implementation.version,
        'coverageAudit.evidence.sourceProof.implementation.version'
      ),
      implementationKey: text(
        implementation.implementationKey,
        'coverageAudit.evidence.sourceProof.implementation.implementationKey'
      ),
      status: 'APPROVED'
    }
  };
}

function parseEvidence(value: unknown): CapabilityDemandCoverageEvidenceV1 {
  const evidence = record(value, 'coverageAudit.evidence');
  exactKeys(
    evidence,
    ['currentCapability', 'qualifyingImplementations', 'selectedImplementation', 'sourceProof'],
    'coverageAudit.evidence'
  );
  if (!Array.isArray(evidence.qualifyingImplementations))
    invalid('coverageAudit.evidence.qualifyingImplementations must be an array.');
  return {
    ...(evidence.currentCapability === undefined
      ? {}
      : { currentCapability: parseCurrentCapability(evidence.currentCapability) }),
    qualifyingImplementations: evidence.qualifyingImplementations.map((profile, index) =>
      parseImplementation(profile, `coverageAudit.evidence.qualifyingImplementations[${index}]`)
    ),
    ...(evidence.selectedImplementation === undefined
      ? {}
      : {
          selectedImplementation: parseImplementation(
            evidence.selectedImplementation,
            'coverageAudit.evidence.selectedImplementation'
          )
        }),
    ...(evidence.sourceProof === undefined
      ? {}
      : { sourceProof: parseSourceProof(evidence.sourceProof) })
  };
}

function parseCandidate(
  value: unknown,
  demand: Readonly<ProductCapabilityDemandIdentityV1>,
  evidence: Readonly<CapabilityDemandCoverageEvidenceV1>,
  status: CapabilityCoverageGapCandidateV1['reasonCode']
): CapabilityCoverageGapCandidateV1 {
  const candidate = record(value, 'coverageAudit.gapCandidate');
  exactKeys(
    candidate,
    [
      'schemaVersion',
      'candidateId',
      'candidateFingerprintSha256',
      'admissionStatus',
      'demandId',
      'demandFingerprintSha256',
      'reasonCode',
      'evidence',
      'authority'
    ],
    'coverageAudit.gapCandidate'
  );
  if (candidate.schemaVersion !== 1) invalid('coverageAudit.gapCandidate.schemaVersion must be 1.');
  if (candidate.admissionStatus !== 'NOT_ADMITTED')
    drift('coverageAudit.gapCandidate must remain NOT_ADMITTED.');
  if (candidate.reasonCode !== status)
    drift('coverageAudit.gapCandidate.reasonCode must match coverage audit status.');
  if (
    candidate.demandId !== demand.demandId ||
    candidate.demandFingerprintSha256 !== demand.demandFingerprintSha256
  )
    drift('coverageAudit.gapCandidate demand identity must match coverage audit demand.');
  const candidateEvidence = parseEvidence(candidate.evidence);
  if (!same(candidateEvidence, evidence))
    drift('coverageAudit.gapCandidate evidence must match coverage audit evidence exactly.');
  const authority = parseAuditAuthority(
    candidate.authority,
    'coverageAudit.gapCandidate.authority'
  );
  const basis = {
    admissionStatus: 'NOT_ADMITTED' as const,
    demandId: demand.demandId,
    demandFingerprintSha256: demand.demandFingerprintSha256,
    reasonCode: status,
    evidence,
    authority
  };
  const expectedFingerprint = fingerprint(basis);
  const actualFingerprint = sha256Text(
    candidate.candidateFingerprintSha256,
    'coverageAudit.gapCandidate.candidateFingerprintSha256'
  );
  if (actualFingerprint !== expectedFingerprint)
    drift('coverageAudit.gapCandidate fingerprint does not match its bounded contents.');
  const expectedId = `capability-coverage-gap-candidate_${expectedFingerprint}` as const;
  if (candidate.candidateId !== expectedId)
    drift('coverageAudit.gapCandidate candidateId does not match its fingerprint.');
  return {
    schemaVersion: 1,
    candidateId: expectedId,
    candidateFingerprintSha256: expectedFingerprint,
    admissionStatus: 'NOT_ADMITTED',
    demandId: demand.demandId,
    demandFingerprintSha256: demand.demandFingerprintSha256,
    reasonCode: status,
    evidence: structuredClone(evidence),
    authority
  };
}

function parseAudit(value: unknown):
  | ParsedResolvedAudit
  | Readonly<{
      schemaVersion: 1;
      status: 'COVERAGE_AUDIT_UNAVAILABLE';
      demand: Readonly<ProductCapabilityDemandIdentityV1>;
      evidence: Readonly<CapabilityDemandCoverageEvidenceV1>;
      unavailableDependency: 'CURRENT_CAPABILITY_AUTHORITY' | 'CURRENT_IMPLEMENTATION_AUTHORITY';
      authority: typeof capabilityDemandCoverageNoAuthority;
    }> {
  const audit = record(value, 'coverageAudit');
  exactKeys(
    audit,
    [
      'schemaVersion',
      'status',
      'demand',
      'evidence',
      'gapCandidate',
      'unavailableDependency',
      'authority'
    ],
    'coverageAudit'
  );
  if (audit.schemaVersion !== 1) invalid('coverageAudit.schemaVersion must be 1.');
  const demand = parseDemand(audit.demand);
  const evidence = parseEvidence(audit.evidence);
  const authority = parseAuditAuthority(audit.authority, 'coverageAudit.authority');
  if (audit.status === 'COVERAGE_AUDIT_UNAVAILABLE') {
    if (audit.gapCandidate !== undefined)
      drift('Unavailable coverage audit must not fabricate a gap candidate.');
    if (
      audit.unavailableDependency !== 'CURRENT_CAPABILITY_AUTHORITY' &&
      audit.unavailableDependency !== 'CURRENT_IMPLEMENTATION_AUTHORITY'
    )
      invalid('coverageAudit.unavailableDependency is invalid.');
    return {
      schemaVersion: 1,
      status: 'COVERAGE_AUDIT_UNAVAILABLE',
      demand,
      evidence,
      unavailableDependency: audit.unavailableDependency,
      authority
    };
  }
  if (typeof audit.status !== 'string') invalid('coverageAudit.status is invalid.');
  const status = audit.status as CapabilityDemandCoverageStatus;
  if (!COVERED_STATUSES.has(status) && !GAP_STATUSES.has(status as never))
    invalid('coverageAudit.status is invalid.');
  if (audit.unavailableDependency !== undefined)
    drift('Resolved coverage audit must not include unavailableDependency.');
  if (COVERED_STATUSES.has(status)) {
    if (audit.gapCandidate !== undefined)
      drift('Covered demand audit must not contain a gap candidate.');
    return {
      schemaVersion: 1,
      status: status as 'PRODUCTION_COVERED' | 'RUNTIME_COVERED',
      demand,
      evidence,
      authority
    };
  }
  if (audit.gapCandidate === undefined)
    drift('Uncovered demand audit requires the governed NOT_ADMITTED gap candidate.');
  const gapStatus = status as CapabilityCoverageGapCandidateV1['reasonCode'];
  return {
    schemaVersion: 1,
    status: gapStatus,
    demand,
    evidence,
    gapCandidate: parseCandidate(audit.gapCandidate, demand, evidence, gapStatus),
    authority
  };
}

export function materializeCapabilityCoverageGapEvidenceV1(
  auditValue: unknown
): CapabilityCoverageGapEvidenceV1 | undefined {
  const audit = parseAudit(auditValue);
  if (audit.status === 'COVERAGE_AUDIT_UNAVAILABLE' || COVERED_STATUSES.has(audit.status))
    return undefined;
  if (!audit.gapCandidate) drift('Uncovered demand audit requires a gap candidate.');

  const sourceAuditFingerprintSha256 = fingerprint({
    schemaVersion: audit.schemaVersion,
    status: audit.status,
    demand: audit.demand,
    evidence: audit.evidence,
    gapCandidate: audit.gapCandidate,
    authority: audit.authority
  } satisfies CapabilityDemandCoverageAuditResultV1);
  const basis = {
    schemaVersion: 1 as const,
    classification: 'COVERAGE_GAP_EVIDENCE' as const,
    phase7AdmissionStatus: 'NOT_ADMITTED' as const,
    sourceKind: 'CAPABILITY_DEMAND_COVERAGE_AUDIT_V1' as const,
    sourceAuditFingerprintSha256,
    candidateId: audit.gapCandidate.candidateId,
    candidateFingerprintSha256: audit.gapCandidate.candidateFingerprintSha256,
    coverageStatus: audit.status as CapabilityCoverageGapCandidateV1['reasonCode'],
    demand: audit.demand,
    evidence: audit.evidence,
    authority: capabilityCoverageGapEvidenceNoAuthority
  };
  const evidenceFingerprintSha256 = fingerprint(basis);
  return {
    ...structuredClone(basis),
    evidenceId: `capability-coverage-gap-evidence_${evidenceFingerprintSha256}`,
    evidenceFingerprintSha256
  };
}
