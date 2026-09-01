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
  type CapabilitySourceUseContextAuthorityV1,
  type CapabilitySourceUseContextResolutionV1,
  type CapabilitySourceUseContextV1
} from './current-source-admission-evidence-v3.js';
import {
  materializeCapabilitySourceAdmissionEvidenceV4,
  validCapabilitySourceAdmissionEvidenceV4,
  type CapabilitySourceAdmissionEvidenceV4
} from './current-source-admission-evidence-v4.js';
import {
  validCapabilitySourceAdmissionPolicyContentIdentityV1,
  type CapabilitySourceAdmissionPolicyContentIdentityV1,
  type CapabilitySourceAdmissionPolicyContentProvenanceAuthorityV1,
  type CapabilitySourceAdmissionPolicyResultWithContentProvenanceV1
} from './source-admission-policy-content-provenance.js';

const SHA256 = /^[0-9a-f]{64}$/;

export type CapabilitySourceAdmissionPolicyContentTrackingErrorCode =
  'ADMISSION_POLICY_CONTENT_PROVENANCE_UNAVAILABLE';

export class CapabilitySourceAdmissionPolicyContentTrackingError extends Error {
  constructor(
    readonly code: CapabilitySourceAdmissionPolicyContentTrackingErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'CapabilitySourceAdmissionPolicyContentTrackingError';
  }
}

export type CapabilitySourceAdmissionEvaluationWithPolicyContentV1 =
  | Readonly<{
      decision: Extract<CapabilitySourceAdmissionDecision, { decision: 'PRODUCTION_ADMISSIBLE' }>;
      admissionPolicy: Readonly<CapabilitySourceAdmissionPolicyContentIdentityV1>;
    }>
  | Readonly<{
      decision: Extract<CapabilitySourceAdmissionDecision, { decision: 'DENIED' }>;
    }>;

export interface CapabilitySourceAdmissionEvaluatorWithPolicyContentAuthorityV1 {
  evaluate(value: unknown): Promise<CapabilitySourceAdmissionEvaluationWithPolicyContentV1>;
}

export interface CurrentCapabilitySourceAdmissionPolicyContentTrackingEvaluatorOptionsV1 {
  readonly admission: Omit<CurrentCapabilitySourceAdmissionEvaluatorOptions, 'policy'>;
  readonly policy: Readonly<CapabilitySourceAdmissionPolicyContentProvenanceAuthorityV1>;
}

export class CurrentCapabilitySourceAdmissionPolicyContentTrackingEvaluatorV1 implements CapabilitySourceAdmissionEvaluatorWithPolicyContentAuthorityV1 {
  constructor(
    private readonly options: Readonly<CurrentCapabilitySourceAdmissionPolicyContentTrackingEvaluatorOptionsV1>
  ) {}

  async evaluate(value: unknown): Promise<CapabilitySourceAdmissionEvaluationWithPolicyContentV1> {
    let captured: CapabilitySourceAdmissionPolicyResultWithContentProvenanceV1 | undefined;
    const policy = {
      evaluate: async (
        input: Readonly<CapabilitySourceAdmissionPolicyInput>
      ): Promise<CapabilitySourceAdmissionPolicyResult> => {
        const result = await this.options.policy.evaluate(input);
        captured = result;
        if (result.applicability !== 'SUPPORTED') return result;
        return {
          applicability: 'SUPPORTED',
          methodCurrentness: result.methodCurrentness,
          referenceCurrentness: result.referenceCurrentness
        };
      }
    };
    const evaluator = new CurrentCapabilitySourceAdmissionEvaluator({
      ...this.options.admission,
      policy
    });
    const decision = await evaluator.evaluate(value);

    if (decision.decision === 'DENIED') return Object.freeze({ decision });
    if (
      !captured ||
      captured.applicability !== 'SUPPORTED' ||
      !validCapabilitySourceAdmissionPolicyContentIdentityV1(captured.policy)
    ) {
      throw new CapabilitySourceAdmissionPolicyContentTrackingError(
        'ADMISSION_POLICY_CONTENT_PROVENANCE_UNAVAILABLE',
        'A production-admissible Capability decision must preserve the exact content-addressed admission-policy identity from the same evaluation.'
      );
    }

    return Object.freeze({
      decision,
      admissionPolicy: structuredClone(captured.policy)
    });
  }
}

export interface CapabilitySourceAdmissionEvidenceV5 {
  readonly schemaVersion: 5;
  readonly producer: 'CAPABILITY_ENGINE';
  readonly evidenceId: `capability-source-admission-evidence_${string}`;
  readonly evidenceVersion: 5;
  readonly evaluatedAt: string;
  readonly decisionFingerprintSha256: string;
  readonly evidenceFingerprintSha256: string;
  readonly predecessorEvidence: Readonly<{
    evidenceId: CapabilitySourceAdmissionEvidenceV4['evidenceId'];
    evidenceVersion: 4;
    evidenceFingerprintSha256: string;
  }>;
  readonly admissionPolicy: Readonly<CapabilitySourceAdmissionPolicyContentIdentityV1>;
  readonly decision: Extract<
    CapabilitySourceAdmissionDecision,
    { decision: 'PRODUCTION_ADMISSIBLE' }
  >;
  readonly sourceOutput: Readonly<CapabilitySourceOutputIdentityV1>;
  readonly sourceUse: Readonly<CapabilitySourceUseContextV1>;
  readonly authority: Readonly<typeof capabilitySourceAdmissionNoAuthorityConsequences>;
}

export type CapabilitySourceAdmissionEvidenceV5ErrorCode =
  | 'SOURCE_NOT_PRODUCTION_ADMISSIBLE'
  | 'INVALID_ADMISSION_POLICY_CONTENT_PROVENANCE'
  | 'INVALID_PREDECESSOR_EVIDENCE'
  | 'INVALID_SOURCE_OUTPUT'
  | 'SOURCE_USE_CONTEXT_UNAVAILABLE';

export class CapabilitySourceAdmissionEvidenceV5Error extends Error {
  constructor(
    readonly code: CapabilitySourceAdmissionEvidenceV5ErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'CapabilitySourceAdmissionEvidenceV5Error';
  }
}

export interface CurrentCapabilitySourceAdmissionEvidenceMaterializerOptionsV5 {
  readonly evaluator: Readonly<CapabilitySourceAdmissionEvaluatorWithPolicyContentAuthorityV1>;
  readonly sourceUse: Readonly<CapabilitySourceUseContextAuthorityV1>;
  readonly now: () => string;
}

function v5Error(code: CapabilitySourceAdmissionEvidenceV5ErrorCode, message: string): never {
  throw new CapabilitySourceAdmissionEvidenceV5Error(code, message);
}

function nonEmptyText(value: unknown, maximum = 1000): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maximum;
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
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
  const policy = sourceUse.policy;
  return (
    sourceUse.schemaVersion === 1 &&
    sourceUse.currentness === 'CURRENT' &&
    sourceUse.currentnessCheckedAt === evaluatedAt &&
    !!policy &&
    typeof policy === 'object' &&
    !Array.isArray(policy) &&
    nonEmptyText((policy as Record<string, unknown>).policyId, 500) &&
    positiveInteger((policy as Record<string, unknown>).policyVersion) &&
    validTextList(sourceUse.provenanceRefs, 64) &&
    validTextList(sourceUse.assumptions, 32) &&
    validTextList(sourceUse.limitations, 32)
  );
}

function evidenceV5Basis(value: Readonly<CapabilitySourceAdmissionEvidenceV5>) {
  return {
    schemaVersion: 5 as const,
    producer: 'CAPABILITY_ENGINE' as const,
    evidenceVersion: 5 as const,
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

export function validCapabilitySourceAdmissionEvidenceV5(
  value: unknown
): value is CapabilitySourceAdmissionEvidenceV5 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const evidence = value as CapabilitySourceAdmissionEvidenceV5;
  if (
    evidence.schemaVersion !== 5 ||
    evidence.producer !== 'CAPABILITY_ENGINE' ||
    evidence.evidenceVersion !== 5 ||
    evidence.decision.decision !== 'PRODUCTION_ADMISSIBLE' ||
    !validIsoInstant(evidence.evaluatedAt) ||
    !SHA256.test(evidence.decisionFingerprintSha256) ||
    !SHA256.test(evidence.evidenceFingerprintSha256) ||
    evidence.predecessorEvidence.evidenceVersion !== 4 ||
    !SHA256.test(evidence.predecessorEvidence.evidenceFingerprintSha256) ||
    !validCapabilitySourceAdmissionPolicyContentIdentityV1(evidence.admissionPolicy) ||
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
  if (canonicalJsonSha256V1(evidenceV5Basis(evidence)) !== evidence.evidenceFingerprintSha256) {
    return false;
  }
  return (
    evidence.evidenceId ===
    `capability-source-admission-evidence_${evidence.evidenceFingerprintSha256}`
  );
}

export function materializeCapabilitySourceAdmissionEvidenceV5(
  predecessorValue: Readonly<CapabilitySourceAdmissionEvidenceV4>,
  admissionPolicyValue: Readonly<CapabilitySourceAdmissionPolicyContentIdentityV1>
): Readonly<CapabilitySourceAdmissionEvidenceV5> {
  if (!validCapabilitySourceAdmissionEvidenceV4(predecessorValue)) {
    return v5Error(
      'INVALID_PREDECESSOR_EVIDENCE',
      'Capability source-admission V5 evidence requires an exact production V4 predecessor.'
    );
  }
  if (!validCapabilitySourceAdmissionPolicyContentIdentityV1(admissionPolicyValue)) {
    return v5Error(
      'INVALID_ADMISSION_POLICY_CONTENT_PROVENANCE',
      'Capability source-admission V5 evidence requires an exact content-addressed producer admission-policy identity.'
    );
  }
  if (
    predecessorValue.admissionPolicy.policyId !== admissionPolicyValue.policyId ||
    predecessorValue.admissionPolicy.policyVersion !== admissionPolicyValue.policyVersion
  ) {
    return v5Error(
      'INVALID_ADMISSION_POLICY_CONTENT_PROVENANCE',
      'Capability source-admission V5 policy identity must extend the exact V4 policy id and version.'
    );
  }

  const predecessorEvidence = {
    evidenceId: predecessorValue.evidenceId,
    evidenceVersion: 4 as const,
    evidenceFingerprintSha256: predecessorValue.evidenceFingerprintSha256
  };
  const evidenceBasis = {
    schemaVersion: 5 as const,
    producer: 'CAPABILITY_ENGINE' as const,
    evidenceVersion: 5 as const,
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

export class CurrentCapabilitySourceAdmissionEvidenceMaterializerV5 {
  constructor(
    private readonly options: Readonly<CurrentCapabilitySourceAdmissionEvidenceMaterializerOptionsV5>
  ) {}

  async evaluateAndMaterialize(
    runtimeExecution: unknown
  ): Promise<Readonly<CapabilitySourceAdmissionEvidenceV5>> {
    const evaluation = await this.options.evaluator.evaluate(runtimeExecution);
    if (evaluation.decision.decision !== 'PRODUCTION_ADMISSIBLE') {
      return v5Error(
        'SOURCE_NOT_PRODUCTION_ADMISSIBLE',
        'Denied Capability source evidence cannot be materialized as a content-addressed policy production proof.'
      );
    }
    if (
      !('admissionPolicy' in evaluation) ||
      !validCapabilitySourceAdmissionPolicyContentIdentityV1(evaluation.admissionPolicy)
    ) {
      return v5Error(
        'INVALID_ADMISSION_POLICY_CONTENT_PROVENANCE',
        'Production Capability source proof requires exact content-addressed admission-policy provenance from the same evaluation.'
      );
    }
    const admissionPolicy = evaluation.admissionPolicy;

    let sourceOutput: Readonly<CapabilitySourceOutputIdentityV1> | undefined;
    try {
      sourceOutput = resolveCapabilitySourceOutputIdentityV1(runtimeExecution);
    } catch {
      return v5Error(
        'INVALID_SOURCE_OUTPUT',
        'Production Capability source output is inconsistent or not safely canonicalizable.'
      );
    }
    if (!sourceOutput) {
      return v5Error(
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
      return v5Error(
        'SOURCE_USE_CONTEXT_UNAVAILABLE',
        'Capability source-use policy authority is unavailable.'
      );
    }
    const v3 = materializeCapabilitySourceAdmissionEvidenceV3(v2, sourceUse);
    const v4 = materializeCapabilitySourceAdmissionEvidenceV4(v3, {
      policyId: admissionPolicy.policyId,
      policyVersion: admissionPolicy.policyVersion
    });
    return materializeCapabilitySourceAdmissionEvidenceV5(v4, admissionPolicy);
  }
}
