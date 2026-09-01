import { isDeepStrictEqual } from 'node:util';

import {
  canonicalJsonSha256V1,
  resolveCapabilitySourceOutputIdentityV1,
  validCapabilitySourceOutputIdentityV1,
  type CapabilitySourceOutputIdentityV1
} from './capability-source-output-identity.js';
import {
  CurrentCapabilitySourceAdmissionEvaluator,
  capabilitySourceAdmissionNoAuthorityConsequences,
  type CapabilitySourceAdmissionDecision,
  type CapabilitySourceAdmissionPolicyInput,
  type CapabilitySourceAdmissionPolicyResult,
  type CurrentCapabilitySourceAdmissionEvaluatorOptions
} from './current-source-admission.js';
import {
  materializeCapabilitySourceAdmissionEvidenceV2,
  type CapabilitySourceAdmissionEvidenceV2
} from './current-source-admission-evidence-v2.js';
import {
  materializeCapabilitySourceAdmissionEvidenceV3,
  type CapabilitySourceAdmissionEvidenceV3,
  type CapabilitySourceUseContextAuthorityV1,
  type CapabilitySourceUseContextResolutionV1,
  type CapabilitySourceUseContextV1
} from './current-source-admission-evidence-v3.js';
import type {
  CapabilitySourceAdmissionPolicyIdentityV1,
  CapabilitySourceAdmissionPolicyProvenanceAuthorityV1,
  CapabilitySourceAdmissionPolicyResultWithProvenanceV1
} from './source-admission-policy-provenance.js';

const SHA256 = /^[0-9a-f]{64}$/;

export type CapabilitySourceAdmissionPolicyTrackingErrorCode =
  'ADMISSION_POLICY_PROVENANCE_UNAVAILABLE';

export class CapabilitySourceAdmissionPolicyTrackingError extends Error {
  constructor(
    readonly code: CapabilitySourceAdmissionPolicyTrackingErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'CapabilitySourceAdmissionPolicyTrackingError';
  }
}

export type CapabilitySourceAdmissionEvaluationWithPolicyV1 =
  | Readonly<{
      decision: Extract<CapabilitySourceAdmissionDecision, { decision: 'PRODUCTION_ADMISSIBLE' }>;
      admissionPolicy: Readonly<CapabilitySourceAdmissionPolicyIdentityV1>;
    }>
  | Readonly<{
      decision: Extract<CapabilitySourceAdmissionDecision, { decision: 'DENIED' }>;
    }>;

export interface CapabilitySourceAdmissionEvaluatorWithPolicyAuthorityV1 {
  evaluate(value: unknown): Promise<CapabilitySourceAdmissionEvaluationWithPolicyV1>;
}

export interface CurrentCapabilitySourceAdmissionPolicyTrackingEvaluatorOptionsV1 {
  readonly admission: Omit<CurrentCapabilitySourceAdmissionEvaluatorOptions, 'policy'>;
  readonly policy: Readonly<CapabilitySourceAdmissionPolicyProvenanceAuthorityV1>;
}

export class CurrentCapabilitySourceAdmissionPolicyTrackingEvaluatorV1 implements CapabilitySourceAdmissionEvaluatorWithPolicyAuthorityV1 {
  constructor(
    private readonly options: Readonly<CurrentCapabilitySourceAdmissionPolicyTrackingEvaluatorOptionsV1>
  ) {}

  async evaluate(value: unknown): Promise<CapabilitySourceAdmissionEvaluationWithPolicyV1> {
    let captured: CapabilitySourceAdmissionPolicyResultWithProvenanceV1 | undefined;
    const policy = {
      evaluate: async (
        input: Readonly<CapabilitySourceAdmissionPolicyInput>
      ): Promise<CapabilitySourceAdmissionPolicyResult> => {
        const result = await this.options.policy.evaluate(input);
        captured = result;
        return result;
      }
    };
    const evaluator = new CurrentCapabilitySourceAdmissionEvaluator({
      ...this.options.admission,
      policy
    });
    const decision = await evaluator.evaluate(value);

    if (decision.decision === 'DENIED') return Object.freeze({ decision });
    if (!captured || captured.applicability !== 'SUPPORTED') {
      throw new CapabilitySourceAdmissionPolicyTrackingError(
        'ADMISSION_POLICY_PROVENANCE_UNAVAILABLE',
        'A production-admissible Capability decision must preserve the exact supported admission-policy identity from the same evaluation.'
      );
    }

    return Object.freeze({
      decision,
      admissionPolicy: structuredClone(captured.policy)
    });
  }
}

export interface CapabilitySourceAdmissionEvidenceV4 {
  readonly schemaVersion: 4;
  readonly producer: 'CAPABILITY_ENGINE';
  readonly evidenceId: `capability-source-admission-evidence_${string}`;
  readonly evidenceVersion: 4;
  readonly evaluatedAt: string;
  readonly decisionFingerprintSha256: string;
  readonly evidenceFingerprintSha256: string;
  readonly predecessorEvidence: Readonly<{
    evidenceId: CapabilitySourceAdmissionEvidenceV3['evidenceId'];
    evidenceVersion: 3;
    evidenceFingerprintSha256: string;
  }>;
  readonly admissionPolicy: Readonly<CapabilitySourceAdmissionPolicyIdentityV1>;
  readonly decision: Extract<
    CapabilitySourceAdmissionDecision,
    { decision: 'PRODUCTION_ADMISSIBLE' }
  >;
  readonly sourceOutput: Readonly<CapabilitySourceOutputIdentityV1>;
  readonly sourceUse: Readonly<CapabilitySourceUseContextV1>;
  readonly authority: Readonly<typeof capabilitySourceAdmissionNoAuthorityConsequences>;
}

export type CapabilitySourceAdmissionEvidenceV4ErrorCode =
  | 'SOURCE_NOT_PRODUCTION_ADMISSIBLE'
  | 'INVALID_ADMISSION_POLICY_PROVENANCE'
  | 'INVALID_PREDECESSOR_EVIDENCE'
  | 'INVALID_SOURCE_OUTPUT'
  | 'SOURCE_USE_CONTEXT_UNAVAILABLE';

export class CapabilitySourceAdmissionEvidenceV4Error extends Error {
  constructor(
    readonly code: CapabilitySourceAdmissionEvidenceV4ErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'CapabilitySourceAdmissionEvidenceV4Error';
  }
}

export interface CurrentCapabilitySourceAdmissionEvidenceMaterializerOptionsV4 {
  readonly evaluator: Readonly<CapabilitySourceAdmissionEvaluatorWithPolicyAuthorityV1>;
  readonly sourceUse: Readonly<CapabilitySourceUseContextAuthorityV1>;
  readonly now: () => string;
}

function v4Error(code: CapabilitySourceAdmissionEvidenceV4ErrorCode, message: string): never {
  throw new CapabilitySourceAdmissionEvidenceV4Error(code, message);
}

function nonEmptyText(value: unknown, maximum = 1000): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maximum;
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function validPolicyIdentity(value: unknown): value is CapabilitySourceAdmissionPolicyIdentityV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const policy = value as Record<string, unknown>;
  return nonEmptyText(policy.policyId, 500) && positiveInteger(policy.policyVersion);
}

function validIsoInstant(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function validTextList(value: unknown, maximumItems: number): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length <= maximumItems &&
    value.every((item) => nonEmptyText(item, 2000)) &&
    new Set(value).size === value.length
  );
}

function validSourceUse(
  value: unknown,
  evaluatedAt: string
): value is CapabilitySourceUseContextV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const sourceUse = value as Record<string, unknown>;
  return (
    sourceUse.schemaVersion === 1 &&
    sourceUse.currentness === 'CURRENT' &&
    sourceUse.currentnessCheckedAt === evaluatedAt &&
    validPolicyIdentity(sourceUse.policy) &&
    validTextList(sourceUse.provenanceRefs, 64) &&
    validTextList(sourceUse.assumptions, 32) &&
    validTextList(sourceUse.limitations, 32)
  );
}

function predecessorV3Basis(value: Readonly<CapabilitySourceAdmissionEvidenceV3>) {
  return {
    schemaVersion: 3 as const,
    producer: 'CAPABILITY_ENGINE' as const,
    evidenceVersion: 3 as const,
    evaluatedAt: value.evaluatedAt,
    decisionFingerprintSha256: value.decisionFingerprintSha256,
    predecessorEvidence: value.predecessorEvidence,
    decision: value.decision,
    sourceOutput: value.sourceOutput,
    sourceUse: value.sourceUse,
    authority: capabilitySourceAdmissionNoAuthorityConsequences
  };
}

function validProductionPredecessorV3(
  value: Readonly<CapabilitySourceAdmissionEvidenceV3>
): value is Readonly<CapabilitySourceAdmissionEvidenceV3> {
  if (
    value.schemaVersion !== 3 ||
    value.producer !== 'CAPABILITY_ENGINE' ||
    value.evidenceVersion !== 3 ||
    value.decision.decision !== 'PRODUCTION_ADMISSIBLE' ||
    !validIsoInstant(value.evaluatedAt) ||
    !SHA256.test(value.decisionFingerprintSha256) ||
    !SHA256.test(value.evidenceFingerprintSha256) ||
    value.predecessorEvidence.evidenceVersion !== 2 ||
    !SHA256.test(value.predecessorEvidence.evidenceFingerprintSha256) ||
    !validCapabilitySourceOutputIdentityV1(value.sourceOutput) ||
    !validSourceUse(value.sourceUse, value.evaluatedAt) ||
    !isDeepStrictEqual(value.authority, capabilitySourceAdmissionNoAuthorityConsequences) ||
    !isDeepStrictEqual(value.decision.authority, capabilitySourceAdmissionNoAuthorityConsequences)
  ) {
    return false;
  }
  if (canonicalJsonSha256V1(value.decision) !== value.decisionFingerprintSha256) return false;
  if (canonicalJsonSha256V1(predecessorV3Basis(value)) !== value.evidenceFingerprintSha256) {
    return false;
  }
  return (
    value.evidenceId === `capability-source-admission-evidence_${value.evidenceFingerprintSha256}`
  );
}

function evidenceV4Basis(value: Readonly<CapabilitySourceAdmissionEvidenceV4>) {
  return {
    schemaVersion: 4 as const,
    producer: 'CAPABILITY_ENGINE' as const,
    evidenceVersion: 4 as const,
    evaluatedAt: value.evaluatedAt,
    decisionFingerprintSha256: value.decisionFingerprintSha256,
    predecessorEvidence: value.predecessorEvidence,
    admissionPolicy: value.admissionPolicy,
    decision: value.decision,
    sourceOutput: value.sourceOutput,
    sourceUse: value.sourceUse,
    authority: capabilitySourceAdmissionNoAuthorityConsequences
  };
}

export function validCapabilitySourceAdmissionEvidenceV4(
  value: unknown
): value is CapabilitySourceAdmissionEvidenceV4 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const evidence = value as CapabilitySourceAdmissionEvidenceV4;
  if (
    evidence.schemaVersion !== 4 ||
    evidence.producer !== 'CAPABILITY_ENGINE' ||
    evidence.evidenceVersion !== 4 ||
    evidence.decision.decision !== 'PRODUCTION_ADMISSIBLE' ||
    !validIsoInstant(evidence.evaluatedAt) ||
    !SHA256.test(evidence.decisionFingerprintSha256) ||
    !SHA256.test(evidence.evidenceFingerprintSha256) ||
    evidence.predecessorEvidence.evidenceVersion !== 3 ||
    !SHA256.test(evidence.predecessorEvidence.evidenceFingerprintSha256) ||
    !validPolicyIdentity(evidence.admissionPolicy) ||
    !validCapabilitySourceOutputIdentityV1(evidence.sourceOutput) ||
    !validSourceUse(evidence.sourceUse, evidence.evaluatedAt) ||
    !isDeepStrictEqual(evidence.authority, capabilitySourceAdmissionNoAuthorityConsequences) ||
    !isDeepStrictEqual(
      evidence.decision.authority,
      capabilitySourceAdmissionNoAuthorityConsequences
    )
  ) {
    return false;
  }
  if (canonicalJsonSha256V1(evidence.decision) !== evidence.decisionFingerprintSha256) return false;
  if (canonicalJsonSha256V1(evidenceV4Basis(evidence)) !== evidence.evidenceFingerprintSha256) {
    return false;
  }
  return (
    evidence.evidenceId ===
    `capability-source-admission-evidence_${evidence.evidenceFingerprintSha256}`
  );
}

export function materializeCapabilitySourceAdmissionEvidenceV4(
  predecessorValue: Readonly<CapabilitySourceAdmissionEvidenceV3>,
  admissionPolicyValue: Readonly<CapabilitySourceAdmissionPolicyIdentityV1>
): Readonly<CapabilitySourceAdmissionEvidenceV4> {
  if (!validProductionPredecessorV3(predecessorValue)) {
    return v4Error(
      'INVALID_PREDECESSOR_EVIDENCE',
      'Capability source-admission V4 evidence requires an exact production V3 predecessor.'
    );
  }
  if (!validPolicyIdentity(admissionPolicyValue)) {
    return v4Error(
      'INVALID_ADMISSION_POLICY_PROVENANCE',
      'Capability source-admission V4 evidence requires an exact producer admission-policy identity.'
    );
  }

  const predecessorEvidence = {
    evidenceId: predecessorValue.evidenceId,
    evidenceVersion: 3 as const,
    evidenceFingerprintSha256: predecessorValue.evidenceFingerprintSha256
  };
  const evidenceBasis = {
    schemaVersion: 4 as const,
    producer: 'CAPABILITY_ENGINE' as const,
    evidenceVersion: 4 as const,
    evaluatedAt: predecessorValue.evaluatedAt,
    decisionFingerprintSha256: predecessorValue.decisionFingerprintSha256,
    predecessorEvidence,
    admissionPolicy: structuredClone(admissionPolicyValue),
    decision: structuredClone(predecessorValue.decision),
    sourceOutput: structuredClone(predecessorValue.sourceOutput),
    sourceUse: structuredClone(predecessorValue.sourceUse),
    authority: capabilitySourceAdmissionNoAuthorityConsequences
  };
  const evidenceFingerprintSha256 = canonicalJsonSha256V1(evidenceBasis);

  return Object.freeze({
    ...evidenceBasis,
    evidenceId: `capability-source-admission-evidence_${evidenceFingerprintSha256}`,
    evidenceFingerprintSha256
  });
}

export class CurrentCapabilitySourceAdmissionEvidenceMaterializerV4 {
  constructor(
    private readonly options: Readonly<CurrentCapabilitySourceAdmissionEvidenceMaterializerOptionsV4>
  ) {}

  async evaluateAndMaterialize(
    runtimeExecution: unknown
  ): Promise<Readonly<CapabilitySourceAdmissionEvidenceV4>> {
    const evaluation = await this.options.evaluator.evaluate(runtimeExecution);
    if (evaluation.decision.decision !== 'PRODUCTION_ADMISSIBLE') {
      return v4Error(
        'SOURCE_NOT_PRODUCTION_ADMISSIBLE',
        'Denied Capability source evidence cannot be materialized as an admission-policy-bound production proof.'
      );
    }
    if (!('admissionPolicy' in evaluation) || !validPolicyIdentity(evaluation.admissionPolicy)) {
      return v4Error(
        'INVALID_ADMISSION_POLICY_PROVENANCE',
        'Production Capability source proof requires exact admission-policy provenance from the same evaluation.'
      );
    }
    const admissionPolicy = evaluation.admissionPolicy;

    let sourceOutput: Readonly<CapabilitySourceOutputIdentityV1> | undefined;
    try {
      sourceOutput = resolveCapabilitySourceOutputIdentityV1(runtimeExecution);
    } catch {
      return v4Error(
        'INVALID_SOURCE_OUTPUT',
        'Production Capability source output is inconsistent or not safely canonicalizable.'
      );
    }
    if (!sourceOutput) {
      return v4Error(
        'INVALID_SOURCE_OUTPUT',
        'Production Capability source proof requires an exact successful source-output identity.'
      );
    }

    const evaluatedAt = this.options.now();
    const v2: Readonly<CapabilitySourceAdmissionEvidenceV2> =
      materializeCapabilitySourceAdmissionEvidenceV2(
        evaluation.decision,
        evaluatedAt,
        sourceOutput
      );

    let sourceUse: CapabilitySourceUseContextResolutionV1;
    try {
      sourceUse = await this.options.sourceUse.resolve({ runtimeExecution, evidence: v2 });
    } catch {
      return v4Error(
        'SOURCE_USE_CONTEXT_UNAVAILABLE',
        'Capability source-use policy authority is unavailable.'
      );
    }
    const v3 = materializeCapabilitySourceAdmissionEvidenceV3(v2, sourceUse);
    return materializeCapabilitySourceAdmissionEvidenceV4(v3, admissionPolicy);
  }
}
