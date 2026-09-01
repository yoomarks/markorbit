import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  capabilitySourceAdmissionNoAuthorityConsequences,
  type CapabilitySourceAdmissionDecision
} from './current-source-admission.js';

const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

export type CapabilitySourceAdmissionEvidenceErrorCode =
  | 'INVALID_EVALUATED_AT'
  | 'INVALID_ADMISSION_DECISION';

export class CapabilitySourceAdmissionEvidenceError extends Error {
  constructor(
    readonly code: CapabilitySourceAdmissionEvidenceErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'CapabilitySourceAdmissionEvidenceError';
  }
}

export interface CapabilitySourceAdmissionEvidenceV1 {
  readonly schemaVersion: 1;
  readonly producer: 'CAPABILITY_ENGINE';
  readonly evidenceId: `capability-source-admission-evidence_${string}`;
  readonly evidenceVersion: 1;
  readonly evaluatedAt: string;
  readonly decisionFingerprintSha256: string;
  readonly evidenceFingerprintSha256: string;
  readonly decision: Readonly<CapabilitySourceAdmissionDecision>;
  readonly authority: Readonly<typeof capabilitySourceAdmissionNoAuthorityConsequences>;
}

export interface CapabilitySourceAdmissionEvaluatorAuthorityV1 {
  evaluate(value: unknown): Promise<CapabilitySourceAdmissionDecision>;
}

export interface CurrentCapabilitySourceAdmissionEvidenceMaterializerOptionsV1 {
  readonly evaluator: Readonly<CapabilitySourceAdmissionEvaluatorAuthorityV1>;
  readonly now: () => string;
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

function normalizedEvaluatedAt(value: string): string {
  if (typeof value !== 'string' || !RFC3339.test(value)) {
    throw new CapabilitySourceAdmissionEvidenceError(
      'INVALID_EVALUATED_AT',
      'Capability source-admission evidence requires an explicit RFC3339 evaluation time.'
    );
  }
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) {
    throw new CapabilitySourceAdmissionEvidenceError(
      'INVALID_EVALUATED_AT',
      'Capability source-admission evidence evaluation time is not a valid instant.'
    );
  }
  return instant.toISOString();
}

function validDecision(decision: unknown): decision is CapabilitySourceAdmissionDecision {
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) return false;
  const value = decision as Partial<CapabilitySourceAdmissionDecision>;
  return (
    value.schemaVersion === 1 &&
    value.producer === 'CAPABILITY_ENGINE' &&
    (value.decision === 'PRODUCTION_ADMISSIBLE' || value.decision === 'DENIED') &&
    isDeepStrictEqual(value.authority, capabilitySourceAdmissionNoAuthorityConsequences)
  );
}

export function materializeCapabilitySourceAdmissionEvidenceV1(
  decisionValue: Readonly<CapabilitySourceAdmissionDecision>,
  evaluatedAtValue: string
): Readonly<CapabilitySourceAdmissionEvidenceV1> {
  if (!validDecision(decisionValue)) {
    throw new CapabilitySourceAdmissionEvidenceError(
      'INVALID_ADMISSION_DECISION',
      'Capability source-admission evidence can only materialize an exact producer decision.'
    );
  }

  const evaluatedAt = normalizedEvaluatedAt(evaluatedAtValue);
  const decision = structuredClone(decisionValue);
  const decisionFingerprintSha256 = sha256(decision);
  const evidenceBasis = {
    schemaVersion: 1 as const,
    producer: 'CAPABILITY_ENGINE' as const,
    evidenceVersion: 1 as const,
    evaluatedAt,
    decisionFingerprintSha256,
    decision,
    authority: capabilitySourceAdmissionNoAuthorityConsequences
  };
  const evidenceFingerprintSha256 = sha256(evidenceBasis);

  return {
    ...evidenceBasis,
    evidenceId: `capability-source-admission-evidence_${evidenceFingerprintSha256}`,
    evidenceFingerprintSha256
  };
}

export class CurrentCapabilitySourceAdmissionEvidenceMaterializerV1 {
  constructor(
    private readonly options: Readonly<CurrentCapabilitySourceAdmissionEvidenceMaterializerOptionsV1>
  ) {}

  async evaluateAndMaterialize(
    runtimeExecution: unknown
  ): Promise<Readonly<CapabilitySourceAdmissionEvidenceV1>> {
    const decision = await this.options.evaluator.evaluate(runtimeExecution);
    return materializeCapabilitySourceAdmissionEvidenceV1(decision, this.options.now());
  }
}
