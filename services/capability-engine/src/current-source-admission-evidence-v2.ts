import {
  capabilitySourceAdmissionNoAuthorityConsequences,
  type CapabilitySourceAdmissionDecision
} from './current-source-admission.js';
import { materializeCapabilitySourceAdmissionEvidenceV1 } from './current-source-admission-evidence.js';
import {
  canonicalJsonSha256V1,
  resolveCapabilitySourceOutputIdentityV1,
  validCapabilitySourceOutputIdentityV1,
  type CapabilitySourceOutputIdentityV1
} from './capability-source-output-identity.js';

export type CapabilitySourceAdmissionEvidenceV2ErrorCode = 'INVALID_SOURCE_OUTPUT';

export class CapabilitySourceAdmissionEvidenceV2Error extends Error {
  constructor(
    readonly code: CapabilitySourceAdmissionEvidenceV2ErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'CapabilitySourceAdmissionEvidenceV2Error';
  }
}

export interface CapabilitySourceAdmissionEvidenceV2 {
  readonly schemaVersion: 2;
  readonly producer: 'CAPABILITY_ENGINE';
  readonly evidenceId: `capability-source-admission-evidence_${string}`;
  readonly evidenceVersion: 2;
  readonly evaluatedAt: string;
  readonly decisionFingerprintSha256: string;
  readonly evidenceFingerprintSha256: string;
  readonly decision: Readonly<CapabilitySourceAdmissionDecision>;
  readonly sourceOutput?: Readonly<CapabilitySourceOutputIdentityV1>;
  readonly authority: Readonly<typeof capabilitySourceAdmissionNoAuthorityConsequences>;
}

export interface CapabilitySourceAdmissionEvaluatorAuthorityV2 {
  evaluate(value: unknown): Promise<CapabilitySourceAdmissionDecision>;
}

export interface CurrentCapabilitySourceAdmissionEvidenceMaterializerOptionsV2 {
  readonly evaluator: Readonly<CapabilitySourceAdmissionEvaluatorAuthorityV2>;
  readonly now: () => string;
}

function invalidSourceOutput(message: string): never {
  throw new CapabilitySourceAdmissionEvidenceV2Error('INVALID_SOURCE_OUTPUT', message);
}

export function materializeCapabilitySourceAdmissionEvidenceV2(
  decisionValue: Readonly<CapabilitySourceAdmissionDecision>,
  evaluatedAtValue: string,
  sourceOutputValue?: Readonly<CapabilitySourceOutputIdentityV1>
): Readonly<CapabilitySourceAdmissionEvidenceV2> {
  const v1 = materializeCapabilitySourceAdmissionEvidenceV1(decisionValue, evaluatedAtValue);
  if (sourceOutputValue !== undefined && !validCapabilitySourceOutputIdentityV1(sourceOutputValue)) {
    return invalidSourceOutput(
      'Capability source-admission V2 evidence requires a valid exact source-output identity.'
    );
  }
  if (v1.decision.decision === 'PRODUCTION_ADMISSIBLE' && sourceOutputValue === undefined) {
    return invalidSourceOutput(
      'Production-admissible Capability source evidence requires an exact source-output identity.'
    );
  }

  const sourceOutput = sourceOutputValue ? structuredClone(sourceOutputValue) : undefined;
  const evidenceBasis = {
    schemaVersion: 2 as const,
    producer: 'CAPABILITY_ENGINE' as const,
    evidenceVersion: 2 as const,
    evaluatedAt: v1.evaluatedAt,
    decisionFingerprintSha256: v1.decisionFingerprintSha256,
    decision: structuredClone(v1.decision),
    ...(sourceOutput ? { sourceOutput } : {}),
    authority: capabilitySourceAdmissionNoAuthorityConsequences
  };
  const evidenceFingerprintSha256 = canonicalJsonSha256V1(evidenceBasis);

  return Object.freeze({
    ...evidenceBasis,
    evidenceId: `capability-source-admission-evidence_${evidenceFingerprintSha256}`,
    evidenceFingerprintSha256
  });
}

export class CurrentCapabilitySourceAdmissionEvidenceMaterializerV2 {
  constructor(
    private readonly options: Readonly<CurrentCapabilitySourceAdmissionEvidenceMaterializerOptionsV2>
  ) {}

  async evaluateAndMaterialize(
    runtimeExecution: unknown
  ): Promise<Readonly<CapabilitySourceAdmissionEvidenceV2>> {
    const decision = await this.options.evaluator.evaluate(runtimeExecution);
    let sourceOutput: Readonly<CapabilitySourceOutputIdentityV1> | undefined;
    try {
      sourceOutput = resolveCapabilitySourceOutputIdentityV1(runtimeExecution);
    } catch {
      return invalidSourceOutput(
        'Successful governed runtime output is inconsistent or not safely canonicalizable.'
      );
    }
    return materializeCapabilitySourceAdmissionEvidenceV2(
      decision,
      this.options.now(),
      sourceOutput
    );
  }
}
