import { isDeepStrictEqual } from 'node:util';

import {
  canonicalJsonSha256V1,
  validCapabilitySourceOutputIdentityV1,
  type CapabilitySourceOutputIdentityV1
} from './capability-source-output-identity.js';
import {
  capabilitySourceAdmissionNoAuthorityConsequences,
  type CapabilitySourceAdmissionDecision
} from './current-source-admission.js';
import {
  CurrentCapabilitySourceAdmissionEvidenceMaterializerV2,
  type CapabilitySourceAdmissionEvaluatorAuthorityV2,
  type CapabilitySourceAdmissionEvidenceV2
} from './current-source-admission-evidence-v2.js';

const SHA256 = /^[0-9a-f]{64}$/;
const MAX_PROVENANCE_REFS = 64;
const MAX_ASSUMPTIONS = 32;
const MAX_LIMITATIONS = 32;

export type CapabilitySourceAdmissionEvidenceV3ErrorCode =
  | 'INVALID_PREDECESSOR_EVIDENCE'
  | 'SOURCE_NOT_PRODUCTION_ADMISSIBLE'
  | 'SOURCE_USE_CONTEXT_UNAVAILABLE'
  | 'INVALID_SOURCE_USE_CONTEXT';

export class CapabilitySourceAdmissionEvidenceV3Error extends Error {
  constructor(
    readonly code: CapabilitySourceAdmissionEvidenceV3ErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'CapabilitySourceAdmissionEvidenceV3Error';
  }
}

export interface CapabilitySourceUsePolicyIdentityV1 {
  readonly policyId: string;
  readonly policyVersion: number;
}

export interface CapabilitySourceUseResolvedContextV1 {
  readonly status: 'RESOLVED';
  readonly policy: Readonly<CapabilitySourceUsePolicyIdentityV1>;
  readonly provenanceRefs: readonly string[];
  readonly assumptions: readonly string[];
  readonly limitations: readonly string[];
}

export type CapabilitySourceUseContextResolutionV1 =
  | Readonly<CapabilitySourceUseResolvedContextV1>
  | Readonly<{
      status: 'UNSUPPORTED' | 'UNAVAILABLE';
      reason: string;
    }>;

export interface CapabilitySourceUseContextAuthorityV1 {
  resolve(
    input: Readonly<{
      runtimeExecution: unknown;
      evidence: Readonly<CapabilitySourceAdmissionEvidenceV2>;
    }>
  ): CapabilitySourceUseContextResolutionV1 | Promise<CapabilitySourceUseContextResolutionV1>;
}

export interface CapabilitySourceUseContextV1 {
  readonly schemaVersion: 1;
  readonly currentness: 'CURRENT';
  readonly currentnessCheckedAt: string;
  readonly policy: Readonly<CapabilitySourceUsePolicyIdentityV1>;
  readonly provenanceRefs: readonly string[];
  readonly assumptions: readonly string[];
  readonly limitations: readonly string[];
}

export interface CapabilitySourceAdmissionEvidenceV3 {
  readonly schemaVersion: 3;
  readonly producer: 'CAPABILITY_ENGINE';
  readonly evidenceId: `capability-source-admission-evidence_${string}`;
  readonly evidenceVersion: 3;
  readonly evaluatedAt: string;
  readonly decisionFingerprintSha256: string;
  readonly evidenceFingerprintSha256: string;
  readonly predecessorEvidence: Readonly<{
    evidenceId: CapabilitySourceAdmissionEvidenceV2['evidenceId'];
    evidenceVersion: 2;
    evidenceFingerprintSha256: string;
  }>;
  readonly decision: Readonly<
    Extract<CapabilitySourceAdmissionDecision, { decision: 'PRODUCTION_ADMISSIBLE' }>
  >;
  readonly sourceOutput: Readonly<CapabilitySourceOutputIdentityV1>;
  readonly sourceUse: Readonly<CapabilitySourceUseContextV1>;
  readonly authority: Readonly<typeof capabilitySourceAdmissionNoAuthorityConsequences>;
}

export interface CurrentCapabilitySourceAdmissionEvidenceMaterializerOptionsV3 {
  readonly evaluator: Readonly<CapabilitySourceAdmissionEvaluatorAuthorityV2>;
  readonly sourceUse: Readonly<CapabilitySourceUseContextAuthorityV1>;
  readonly now: () => string;
}

function evidenceV3Error(
  code: CapabilitySourceAdmissionEvidenceV3ErrorCode,
  message: string
): never {
  throw new CapabilitySourceAdmissionEvidenceV3Error(code, message);
}

function normalizedText(value: unknown, field: string, maximum = 2000): string {
  if (typeof value !== 'string') {
    return evidenceV3Error('INVALID_SOURCE_USE_CONTEXT', `${field} must be a string.`);
  }
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum) {
    return evidenceV3Error(
      'INVALID_SOURCE_USE_CONTEXT',
      `${field} must contain 1 to ${maximum} characters.`
    );
  }
  return cleaned;
}

function normalizedPolicy(
  value: Readonly<CapabilitySourceUsePolicyIdentityV1>
): CapabilitySourceUsePolicyIdentityV1 {
  if (!Number.isSafeInteger(value.policyVersion) || value.policyVersion < 1) {
    return evidenceV3Error(
      'INVALID_SOURCE_USE_CONTEXT',
      'sourceUse.policy.policyVersion must be a positive safe integer.'
    );
  }
  return {
    policyId: normalizedText(value.policyId, 'sourceUse.policy.policyId', 500),
    policyVersion: value.policyVersion
  };
}

function normalizedOrderedList(
  value: readonly string[],
  field: string,
  maximumItems: number
): readonly string[] {
  if (!Array.isArray(value) || value.length > maximumItems) {
    return evidenceV3Error(
      'INVALID_SOURCE_USE_CONTEXT',
      `${field} must contain at most ${maximumItems} items.`
    );
  }
  const normalized = value.map((item, index) => normalizedText(item, `${field}[${index}]`, 2000));
  if (new Set(normalized).size !== normalized.length) {
    return evidenceV3Error('INVALID_SOURCE_USE_CONTEXT', `${field} must not contain duplicates.`);
  }
  return normalized;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizedProvenanceRefs(values: readonly string[]): readonly string[] {
  if (!Array.isArray(values) || values.length > MAX_PROVENANCE_REFS) {
    return evidenceV3Error(
      'INVALID_SOURCE_USE_CONTEXT',
      `sourceUse.provenanceRefs must contain at most ${MAX_PROVENANCE_REFS} items before normalization.`
    );
  }
  const normalized = values.map((item, index) =>
    normalizedText(item, `sourceUse.provenanceRefs[${index}]`, 1000)
  );
  return [...new Set(normalized)].sort(compareText);
}

function validIsoInstant(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function predecessorEvidenceBasis(value: Readonly<CapabilitySourceAdmissionEvidenceV2>) {
  return {
    schemaVersion: 2 as const,
    producer: 'CAPABILITY_ENGINE' as const,
    evidenceVersion: 2 as const,
    evaluatedAt: value.evaluatedAt,
    decisionFingerprintSha256: value.decisionFingerprintSha256,
    decision: value.decision,
    ...(value.sourceOutput === undefined ? {} : { sourceOutput: value.sourceOutput }),
    authority: capabilitySourceAdmissionNoAuthorityConsequences
  };
}

function validProductionPredecessor(
  value: Readonly<CapabilitySourceAdmissionEvidenceV2>
): value is Readonly<
  CapabilitySourceAdmissionEvidenceV2 & {
    decision: Extract<CapabilitySourceAdmissionDecision, { decision: 'PRODUCTION_ADMISSIBLE' }>;
    sourceOutput: CapabilitySourceOutputIdentityV1;
  }
> {
  if (
    value.schemaVersion !== 2 ||
    value.producer !== 'CAPABILITY_ENGINE' ||
    value.evidenceVersion !== 2 ||
    value.decision.schemaVersion !== 1 ||
    value.decision.producer !== 'CAPABILITY_ENGINE' ||
    value.decision.decision !== 'PRODUCTION_ADMISSIBLE' ||
    value.sourceOutput === undefined ||
    !validCapabilitySourceOutputIdentityV1(value.sourceOutput) ||
    !validIsoInstant(value.evaluatedAt) ||
    !SHA256.test(value.decisionFingerprintSha256) ||
    !SHA256.test(value.evidenceFingerprintSha256) ||
    !isDeepStrictEqual(value.authority, capabilitySourceAdmissionNoAuthorityConsequences) ||
    !isDeepStrictEqual(value.decision.authority, capabilitySourceAdmissionNoAuthorityConsequences)
  ) {
    return false;
  }
  if (canonicalJsonSha256V1(value.decision) !== value.decisionFingerprintSha256) return false;
  if (canonicalJsonSha256V1(predecessorEvidenceBasis(value)) !== value.evidenceFingerprintSha256) {
    return false;
  }
  return (
    value.evidenceId === `capability-source-admission-evidence_${value.evidenceFingerprintSha256}`
  );
}

function requiredProducerProvenance(
  evidence: Readonly<
    CapabilitySourceAdmissionEvidenceV2 & {
      decision: Extract<CapabilitySourceAdmissionDecision, { decision: 'PRODUCTION_ADMISSIBLE' }>;
    }
  >
): readonly string[] {
  const refs = [
    `capability-source-admission-evidence:${evidence.evidenceId}:${evidence.evidenceFingerprintSha256}`
  ];
  if (evidence.decision.methodSource !== undefined) {
    refs.push(evidence.decision.methodSource.evidenceRef);
  }
  for (const reference of evidence.decision.referenceSources ?? []) {
    refs.push(reference.evidenceRef);
  }
  return refs;
}

export function materializeCapabilitySourceAdmissionEvidenceV3(
  predecessorValue: Readonly<CapabilitySourceAdmissionEvidenceV2>,
  sourceUseValue: Readonly<CapabilitySourceUseContextResolutionV1>
): Readonly<CapabilitySourceAdmissionEvidenceV3> {
  if (!validProductionPredecessor(predecessorValue)) {
    return evidenceV3Error(
      predecessorValue.decision?.decision === 'DENIED'
        ? 'SOURCE_NOT_PRODUCTION_ADMISSIBLE'
        : 'INVALID_PREDECESSOR_EVIDENCE',
      predecessorValue.decision?.decision === 'DENIED'
        ? 'Denied Capability source evidence cannot be materialized as production source-use evidence.'
        : 'Capability source-use evidence requires an exact production-admissible V2 predecessor.'
    );
  }
  if (sourceUseValue.status !== 'RESOLVED') {
    const reason = normalizedText(sourceUseValue.reason, 'sourceUse.reason', 1000);
    return evidenceV3Error(
      'SOURCE_USE_CONTEXT_UNAVAILABLE',
      `Capability source-use context is ${sourceUseValue.status.toLowerCase()}: ${reason}`
    );
  }

  const policy = normalizedPolicy(sourceUseValue.policy);
  const assumptions = normalizedOrderedList(
    sourceUseValue.assumptions,
    'sourceUse.assumptions',
    MAX_ASSUMPTIONS
  );
  const limitations = normalizedOrderedList(
    sourceUseValue.limitations,
    'sourceUse.limitations',
    MAX_LIMITATIONS
  );
  const provenanceRefs = normalizedProvenanceRefs([
    ...requiredProducerProvenance(predecessorValue),
    ...sourceUseValue.provenanceRefs
  ]);
  const sourceUse: CapabilitySourceUseContextV1 = {
    schemaVersion: 1,
    currentness: 'CURRENT',
    currentnessCheckedAt: predecessorValue.evaluatedAt,
    policy,
    provenanceRefs,
    assumptions,
    limitations
  };
  const predecessorEvidence = {
    evidenceId: predecessorValue.evidenceId,
    evidenceVersion: 2 as const,
    evidenceFingerprintSha256: predecessorValue.evidenceFingerprintSha256
  };
  const decision = structuredClone(predecessorValue.decision);
  const sourceOutput = structuredClone(predecessorValue.sourceOutput);
  const evidenceBasis = {
    schemaVersion: 3 as const,
    producer: 'CAPABILITY_ENGINE' as const,
    evidenceVersion: 3 as const,
    evaluatedAt: predecessorValue.evaluatedAt,
    decisionFingerprintSha256: predecessorValue.decisionFingerprintSha256,
    predecessorEvidence,
    decision,
    sourceOutput,
    sourceUse,
    authority: capabilitySourceAdmissionNoAuthorityConsequences
  };
  const evidenceFingerprintSha256 = canonicalJsonSha256V1(evidenceBasis);

  return Object.freeze({
    ...evidenceBasis,
    evidenceId: `capability-source-admission-evidence_${evidenceFingerprintSha256}`,
    evidenceFingerprintSha256
  });
}

export class CurrentCapabilitySourceAdmissionEvidenceMaterializerV3 {
  private readonly predecessor: CurrentCapabilitySourceAdmissionEvidenceMaterializerV2;

  constructor(
    private readonly options: Readonly<CurrentCapabilitySourceAdmissionEvidenceMaterializerOptionsV3>
  ) {
    this.predecessor = new CurrentCapabilitySourceAdmissionEvidenceMaterializerV2({
      evaluator: options.evaluator,
      now: options.now
    });
  }

  async evaluateAndMaterialize(
    runtimeExecution: unknown
  ): Promise<Readonly<CapabilitySourceAdmissionEvidenceV3>> {
    const evidence = await this.predecessor.evaluateAndMaterialize(runtimeExecution);
    if (evidence.decision.decision !== 'PRODUCTION_ADMISSIBLE') {
      return evidenceV3Error(
        'SOURCE_NOT_PRODUCTION_ADMISSIBLE',
        'Denied Capability source evidence cannot request production source-use context.'
      );
    }

    let sourceUse: CapabilitySourceUseContextResolutionV1;
    try {
      sourceUse = await this.options.sourceUse.resolve({ runtimeExecution, evidence });
    } catch {
      return evidenceV3Error(
        'SOURCE_USE_CONTEXT_UNAVAILABLE',
        'Capability source-use policy authority is unavailable.'
      );
    }
    return materializeCapabilitySourceAdmissionEvidenceV3(evidence, sourceUse);
  }
}
