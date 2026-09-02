import {
  capabilitySourceAdmissionNoAuthorityConsequences,
  type CapabilitySourceAdmissionAuthorityConsequences,
  type ExactMethodSourceIdentity,
  type ExactReferenceSourceIdentity
} from './current-source-admission.js';
import type { CapabilitySourceOutputIdentityV1 } from './capability-source-output-identity.js';
import type {
  CapabilitySourceUseContextV1,
  CapabilitySourceUsePolicyIdentityV1
} from './current-source-admission-evidence-v3.js';
import {
  validCapabilitySourceAdmissionEvidenceV5,
  type CapabilitySourceAdmissionEvidenceV5
} from './current-source-admission-evidence-v5.js';
import type { CapabilitySourceAdmissionPolicyContentIdentityV1 } from './source-admission-policy-content-provenance.js';

export type CapabilityProductionSourceExplainabilityErrorCode =
  'INVALID_PRODUCTION_SOURCE_EVIDENCE';

export class CapabilityProductionSourceExplainabilityError extends Error {
  constructor(
    readonly code: CapabilityProductionSourceExplainabilityErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'CapabilityProductionSourceExplainabilityError';
  }
}

export interface CapabilityProductionSourceExplainabilityV1 {
  readonly schemaVersion: 1;
  readonly producer: 'CAPABILITY_ENGINE';
  readonly admission: 'PRODUCTION_ADMISSIBLE';
  readonly evidence: Readonly<{
    evidenceId: CapabilitySourceAdmissionEvidenceV5['evidenceId'];
    evidenceVersion: 5;
    evidenceFingerprintSha256: string;
    evaluatedAt: string;
  }>;
  readonly current: CapabilitySourceAdmissionEvidenceV5['decision']['current'];
  readonly methodSource?: Readonly<ExactMethodSourceIdentity>;
  readonly referenceSources: readonly Readonly<ExactReferenceSourceIdentity>[];
  readonly admissionPolicy: Readonly<CapabilitySourceAdmissionPolicyContentIdentityV1>;
  readonly sourceUse: Readonly<{
    currentness: 'CURRENT';
    currentnessCheckedAt: string;
    policy: Readonly<CapabilitySourceUsePolicyIdentityV1>;
    provenanceRefs: readonly string[];
    assumptions: readonly string[];
    limitations: readonly string[];
  }>;
  readonly sourceOutput: Readonly<CapabilitySourceOutputIdentityV1>;
  readonly authority: Readonly<CapabilitySourceAdmissionAuthorityConsequences>;
}

function invalidEvidence(): never {
  throw new CapabilityProductionSourceExplainabilityError(
    'INVALID_PRODUCTION_SOURCE_EVIDENCE',
    'Production-source explainability requires one exact valid Capability source-admission V5 proof.'
  );
}

function cloneSourceUse(
  value: Readonly<CapabilitySourceUseContextV1>
): CapabilityProductionSourceExplainabilityV1['sourceUse'] {
  return {
    currentness: 'CURRENT',
    currentnessCheckedAt: value.currentnessCheckedAt,
    policy: structuredClone(value.policy),
    provenanceRefs: [...value.provenanceRefs],
    assumptions: [...value.assumptions],
    limitations: [...value.limitations]
  };
}

/**
 * Projects one already-valid V5 producer proof into a bounded consumer-facing explanation.
 *
 * The projection intentionally excludes the raw Capability request/input/output and all source
 * document/package bodies. V5 remains the proof anchor; this function creates no new evidence
 * version, maturity decision, Recommendation, authorization, action authority or Official Truth.
 */
export function projectCapabilityProductionSourceExplainabilityV1(
  value: unknown
): Readonly<CapabilityProductionSourceExplainabilityV1> {
  if (!validCapabilitySourceAdmissionEvidenceV5(value)) return invalidEvidence();

  const evidence = value;
  const projected: CapabilityProductionSourceExplainabilityV1 = {
    schemaVersion: 1,
    producer: 'CAPABILITY_ENGINE',
    admission: 'PRODUCTION_ADMISSIBLE',
    evidence: {
      evidenceId: evidence.evidenceId,
      evidenceVersion: 5,
      evidenceFingerprintSha256: evidence.evidenceFingerprintSha256,
      evaluatedAt: evidence.evaluatedAt
    },
    current: structuredClone(evidence.decision.current),
    ...(evidence.decision.methodSource === undefined
      ? {}
      : { methodSource: structuredClone(evidence.decision.methodSource) }),
    referenceSources: structuredClone(evidence.decision.referenceSources ?? []),
    admissionPolicy: structuredClone(evidence.admissionPolicy),
    sourceUse: cloneSourceUse(evidence.sourceUse),
    sourceOutput: structuredClone(evidence.sourceOutput),
    authority: structuredClone(capabilitySourceAdmissionNoAuthorityConsequences)
  };

  return Object.freeze(projected);
}
