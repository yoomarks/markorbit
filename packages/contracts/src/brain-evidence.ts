import {
  BrainContractError,
  parseBrainEvidenceRef,
  type BrainEvidenceRef,
  type BrainValueKind
} from './brain.js';

export const brainEvidenceAuthorityClasses = [
  'CURRENT_OFFICIAL_PRIMARY',
  'CURRENT_OFFICIAL_STATISTICAL',
  'INTERNAL_VERIFIED_DATA',
  'VERIFIED_PROFESSIONAL_SOURCE',
  'SECONDARY_PROFESSIONAL',
  'GENERAL_PUBLIC_SOURCE'
] as const;
export type BrainEvidenceAuthorityClass = (typeof brainEvidenceAuthorityClasses)[number];

export const brainEvidenceResolutionCandidateStatuses = [
  'NO_EVIDENCE',
  'SUPPORTED',
  'CONSENSUS',
  'CONFLICTED'
] as const;
export type BrainEvidenceResolutionCandidateStatus =
  (typeof brainEvidenceResolutionCandidateStatuses)[number];

export interface BrainEvidenceAssertionScope {
  domain: string;
  jurisdiction?: string;
  concept: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface BrainEvidenceAssertion {
  schemaVersion: 1;
  evidenceRef: Readonly<BrainEvidenceRef>;
  authorityClass: BrainEvidenceAuthorityClass;
  scope: Readonly<BrainEvidenceAssertionScope>;
  valueKind: Extract<BrainValueKind, 'EXACT' | 'STATISTICAL_RANGE' | 'MODEL_ESTIMATE' | 'DERIVED'>;
  value: unknown;
  assertedAt: string;
}

export interface BrainEvidenceResolutionAssertionSummary {
  evidenceRef: Readonly<BrainEvidenceRef>;
  authorityClass: BrainEvidenceAuthorityClass;
  valueKind: BrainEvidenceAssertion['valueKind'];
  valueFingerprintSha256: string;
}

export interface BrainEvidenceResolutionCandidate {
  schemaVersion: 1;
  domain: string;
  jurisdiction?: string;
  concept: string;
  asOf: string;
  status: BrainEvidenceResolutionCandidateStatus;
  selectedAuthorityClass?: BrainEvidenceAuthorityClass;
  selectedValueKind?: BrainEvidenceAssertion['valueKind'];
  selectedValue?: unknown;
  supportingAssertions: readonly Readonly<BrainEvidenceResolutionAssertionSummary>[];
  conflictingAssertions: readonly Readonly<BrainEvidenceResolutionAssertionSummary>[];
  excludedAssertionCount: number;
  explanation: string;
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new BrainContractError(`${field} must be an object.`);
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string
): void {
  const allow = new Set(allowed);
  const unsupported = Object.keys(value).filter((key) => !allow.has(key));
  if (unsupported.length)
    throw new BrainContractError(
      `${field} contains unsupported fields: ${unsupported.join(', ')}.`
    );
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string') throw new BrainContractError(`${field} must be a string.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    throw new BrainContractError(`${field} must contain 1 to ${maximum} characters.`);
  return cleaned;
}

function instant(value: unknown, field: string): string {
  const cleaned = text(value, field, 100);
  if (Number.isNaN(Date.parse(cleaned)))
    throw new BrainContractError(`${field} must be an ISO date/time.`);
  return cleaned;
}

function jsonValue(value: unknown, field: string): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new BrainContractError(`${field} must be finite JSON data.`);
    return value;
  }
  if (Array.isArray(value))
    return value.map((item, index) => jsonValue(item, `${field}[${index}]`));
  if (typeof value === 'object' && value !== null) {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item === undefined) throw new BrainContractError(`${field}.${key} cannot be undefined.`);
      output[key] = jsonValue(item, `${field}.${key}`);
    }
    return output;
  }
  throw new BrainContractError(`${field} must be JSON-compatible.`);
}

function authority(value: unknown): BrainEvidenceAuthorityClass {
  if (
    typeof value !== 'string' ||
    !(brainEvidenceAuthorityClasses as readonly string[]).includes(value)
  )
    throw new BrainContractError('authorityClass is invalid.');
  return value as BrainEvidenceAuthorityClass;
}

function valueKind(value: unknown): BrainEvidenceAssertion['valueKind'] {
  const allowed = ['EXACT', 'STATISTICAL_RANGE', 'MODEL_ESTIMATE', 'DERIVED'] as const;
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value))
    throw new BrainContractError('valueKind is invalid for an evidence assertion.');
  return value as BrainEvidenceAssertion['valueKind'];
}

export function parseBrainEvidenceAssertion(value: unknown): BrainEvidenceAssertion {
  const assertion = record(value, 'brainEvidenceAssertion');
  exactKeys(
    assertion,
    ['schemaVersion', 'evidenceRef', 'authorityClass', 'scope', 'valueKind', 'value', 'assertedAt'],
    'brainEvidenceAssertion'
  );
  if (assertion.schemaVersion !== 1) throw new BrainContractError('schemaVersion must be 1.');
  const scope = record(assertion.scope, 'brainEvidenceAssertion.scope');
  exactKeys(
    scope,
    ['domain', 'jurisdiction', 'concept', 'effectiveFrom', 'effectiveTo'],
    'brainEvidenceAssertion.scope'
  );
  const effectiveFrom = instant(scope.effectiveFrom, 'brainEvidenceAssertion.scope.effectiveFrom');
  const effectiveTo =
    scope.effectiveTo === undefined
      ? undefined
      : instant(scope.effectiveTo, 'brainEvidenceAssertion.scope.effectiveTo');
  if (effectiveTo && Date.parse(effectiveTo) <= Date.parse(effectiveFrom))
    throw new BrainContractError(
      'brainEvidenceAssertion.scope.effectiveTo must be after effectiveFrom.'
    );
  return {
    schemaVersion: 1,
    evidenceRef: parseBrainEvidenceRef(assertion.evidenceRef),
    authorityClass: authority(assertion.authorityClass),
    scope: {
      domain: text(scope.domain, 'brainEvidenceAssertion.scope.domain', 200),
      ...(scope.jurisdiction === undefined
        ? {}
        : {
            jurisdiction: text(
              scope.jurisdiction,
              'brainEvidenceAssertion.scope.jurisdiction',
              100
            ).toUpperCase()
          }),
      concept: text(scope.concept, 'brainEvidenceAssertion.scope.concept', 500),
      effectiveFrom,
      ...(effectiveTo ? { effectiveTo } : {})
    },
    valueKind: valueKind(assertion.valueKind),
    value: jsonValue(assertion.value, 'brainEvidenceAssertion.value'),
    assertedAt: instant(assertion.assertedAt, 'brainEvidenceAssertion.assertedAt')
  };
}

export * from './brain-confidence.js';
