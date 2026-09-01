import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  capabilitySourceAdmissionNoAuthorityConsequences,
  type CapabilitySourceAdmissionDecision
} from './current-source-admission.js';

const RFC3339 =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/;

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

function invalidEvaluatedAt(message: string): never {
  throw new CapabilitySourceAdmissionEvidenceError('INVALID_EVALUATED_AT', message);
}

function normalizedEvaluatedAt(value: string): string {
  const match = typeof value === 'string' ? RFC3339.exec(value) : null;
  if (!match) {
    return invalidEvaluatedAt(
      'Capability source-admission evidence requires an explicit RFC3339 evaluation time.'
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const millisecond = Number((match[7] ?? '').padEnd(3, '0'));
  const offsetHour = match[8] === 'Z' ? 0 : Number(match[10]);
  const offsetMinute = match[8] === 'Z' ? 0 : Number(match[11]);

  if (
    month < 1 ||
    month > 12 ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return invalidEvaluatedAt(
      'Capability source-admission evidence evaluation time contains an invalid date or offset.'
    );
  }

  const calendar = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  if (
    calendar.getUTCFullYear() !== year ||
    calendar.getUTCMonth() !== month - 1 ||
    calendar.getUTCDate() !== day ||
    calendar.getUTCHours() !== hour ||
    calendar.getUTCMinutes() !== minute ||
    calendar.getUTCSeconds() !== second ||
    calendar.getUTCMilliseconds() !== millisecond
  ) {
    return invalidEvaluatedAt(
      'Capability source-admission evidence evaluation time is not a valid calendar instant.'
    );
  }

  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) {
    return invalidEvaluatedAt(
      'Capability source-admission evidence evaluation time is not a valid instant.'
    );
  }
  return instant.toISOString();
}

function record(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function nonEmptyText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function positiveInteger(value: unknown): boolean {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function validDecision(decision: unknown): decision is CapabilitySourceAdmissionDecision {
  const value = record(decision);
  if (
    !value ||
    value.schemaVersion !== 1 ||
    value.producer !== 'CAPABILITY_ENGINE' ||
    !isDeepStrictEqual(value.authority, capabilitySourceAdmissionNoAuthorityConsequences)
  ) {
    return false;
  }

  const historical = record(value.historical);
  if (
    !historical ||
    !nonEmptyText(historical.capabilityRequestId) ||
    !nonEmptyText(historical.implementationBindingId) ||
    !nonEmptyText(historical.capabilityInvocationId) ||
    !nonEmptyText(historical.capabilityOutcomeId) ||
    !nonEmptyText(historical.capabilityReturnId) ||
    !nonEmptyText(historical.sessionReceiptId) ||
    typeof historical.replayed !== 'boolean'
  ) {
    return false;
  }

  if (value.decision === 'DENIED') {
    const denial = record(value.denial);
    return Boolean(denial && nonEmptyText(denial.code) && nonEmptyText(denial.reason));
  }
  if (value.decision !== 'PRODUCTION_ADMISSIBLE') return false;

  const current = record(value.current);
  const capability = record(current?.capability);
  const implementation = record(current?.implementation);
  return Boolean(
    capability &&
      implementation &&
      nonEmptyText(capability.runtimeCapabilityDefinitionId) &&
      positiveInteger(capability.version) &&
      nonEmptyText(capability.capabilityId) &&
      nonEmptyText(capability.capabilityVersion) &&
      nonEmptyText(implementation.implementationProfileId) &&
      positiveInteger(implementation.version) &&
      nonEmptyText(implementation.implementationKey) &&
      implementation.status === 'APPROVED'
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
