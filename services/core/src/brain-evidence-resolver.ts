import { createHash } from 'node:crypto';
import {
  brainEvidenceAuthorityClasses,
  parseBrainEvidenceAssertion,
  type BrainEvidenceAssertion,
  type BrainEvidenceAuthorityClass,
  type BrainEvidenceResolutionAssertionSummary,
  type BrainEvidenceResolutionCandidate
} from '@markorbit/contracts/brain-evidence';

export interface BrainEvidenceResolutionQuery {
  domain: string;
  jurisdiction?: string;
  concept: string;
  asOf: string;
}

const authorityRank = new Map<BrainEvidenceAuthorityClass, number>(
  brainEvidenceAuthorityClasses.map((authorityClass, index) => [authorityClass, index])
);

function normalized(value: string | undefined): string | undefined {
  return value?.trim().toUpperCase();
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return JSON.stringify(value);
  if (typeof value === 'number') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right)
  );
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`).join(',')}}`;
}

function valueFingerprint(assertion: BrainEvidenceAssertion): string {
  return createHash('sha256')
    .update(`${assertion.valueKind}:${canonicalize(assertion.value)}`)
    .digest('hex');
}

function summary(assertion: BrainEvidenceAssertion): BrainEvidenceResolutionAssertionSummary {
  return {
    evidenceRef: structuredClone(assertion.evidenceRef),
    authorityClass: assertion.authorityClass,
    valueKind: assertion.valueKind,
    valueFingerprintSha256: valueFingerprint(assertion)
  };
}

function effectiveAt(assertion: BrainEvidenceAssertion, asOf: number): boolean {
  const from = Date.parse(assertion.scope.effectiveFrom);
  const to = assertion.scope.effectiveTo
    ? Date.parse(assertion.scope.effectiveTo)
    : Number.POSITIVE_INFINITY;
  return from <= asOf && asOf < to;
}

function applicable(assertion: BrainEvidenceAssertion, query: BrainEvidenceResolutionQuery): boolean {
  const asOf = Date.parse(query.asOf);
  return (
    assertion.scope.domain === query.domain &&
    normalized(assertion.scope.jurisdiction) === normalized(query.jurisdiction) &&
    assertion.scope.concept === query.concept &&
    effectiveAt(assertion, asOf)
  );
}

function sameValue(left: BrainEvidenceAssertion, right: BrainEvidenceAssertion): boolean {
  return left.valueKind === right.valueKind && valueFingerprint(left) === valueFingerprint(right);
}

export function resolveBrainEvidence(
  input: readonly unknown[],
  query: BrainEvidenceResolutionQuery
): Readonly<BrainEvidenceResolutionCandidate> {
  const asOf = Date.parse(query.asOf);
  if (Number.isNaN(asOf)) throw new TypeError('query.asOf must be an ISO date/time.');
  const assertions = input.map(parseBrainEvidenceAssertion);
  const relevant = assertions.filter((assertion) => applicable(assertion, query));
  const excludedAssertionCount = assertions.length - relevant.length;
  const common = {
    schemaVersion: 1 as const,
    domain: query.domain,
    ...(query.jurisdiction === undefined ? {} : { jurisdiction: normalized(query.jurisdiction)! }),
    concept: query.concept,
    asOf: query.asOf,
    excludedAssertionCount
  };

  if (!relevant.length)
    return {
      ...common,
      status: 'NO_EVIDENCE',
      supportingAssertions: [],
      conflictingAssertions: [],
      explanation: 'No applicable evidence assertion exists for the requested scope and effective time.'
    };

  const highestRank = Math.min(
    ...relevant.map((assertion) => authorityRank.get(assertion.authorityClass) ?? Number.MAX_SAFE_INTEGER)
  );
  const highest = relevant.filter(
    (assertion) => authorityRank.get(assertion.authorityClass) === highestRank
  );
  const selected = highest[0]!;
  const highestConflicts = highest.filter((assertion) => !sameValue(assertion, selected));

  if (highestConflicts.length)
    return {
      ...common,
      status: 'CONFLICTED',
      selectedAuthorityClass: selected.authorityClass,
      supportingAssertions: highest.filter((assertion) => sameValue(assertion, selected)).map(summary),
      conflictingAssertions: highestConflicts.map(summary),
      explanation:
        'Applicable evidence at the highest available authority class materially conflicts; no value is selected.'
    };

  const supporting = relevant.filter((assertion) => sameValue(assertion, selected));
  const conflicting = relevant.filter((assertion) => !sameValue(assertion, selected));
  const status = supporting.length >= 2 && conflicting.length === 0 ? 'CONSENSUS' : 'SUPPORTED';

  return {
    ...common,
    status,
    selectedAuthorityClass: selected.authorityClass,
    selectedValueKind: selected.valueKind,
    selectedValue: structuredClone(selected.value),
    supportingAssertions: supporting.map(summary),
    conflictingAssertions: conflicting.map(summary),
    explanation:
      status === 'CONSENSUS'
        ? 'All applicable evidence assertions agree with the highest-authority selected value.'
        : conflicting.length
          ? 'The highest-authority evidence selects the value; lower-authority disagreement is preserved for later confidence evaluation.'
          : 'One applicable evidence assertion supports the selected value.'
  };
}
