import { createHash } from 'node:crypto';
import { parseBrainEvidenceRef, type BrainEvidenceRef } from './brain.js';
import type { BrainMethodVersionId } from './brain-method.js';

export const seedBusinessArchetypesV1 = [
  'SERVICE_AGENCY_CANDIDATE',
  'TRADING_ORIENTED_AGENCY_CANDIDATE',
  'TRADEMARK_INVESTOR_CANDIDATE',
  'BRAND_OWNER_CANDIDATE',
  'HYBRID_CANDIDATE',
  'REVIEW_REQUIRED'
] as const;
export type SeedBusinessArchetypeV1 = (typeof seedBusinessArchetypesV1)[number];

export const seedArchetypeEvidenceBandsV1 = [
  'STRONG',
  'MODERATE',
  'WEAK',
  'REVIEW_REQUIRED'
] as const;
export type SeedArchetypeEvidenceBandV1 = (typeof seedArchetypeEvidenceBandsV1)[number];

export const seedArchetypeIndicatorCodesV1 = [
  'APPLICATION_VOLUME',
  'PORTFOLIO_BREADTH',
  'REPEATED_TRANSFER_OUT',
  'TRANSFER_COUNTERPARTY_DIVERSITY',
  'HOLDING_CYCLE_PATTERN',
  'CATEGORY_BRAND_DIVERSITY',
  'PUBLIC_MARKETPLACE_LISTINGS',
  'INTRA_GROUP_TRANSFER_SHARE',
  'AGENCY_REPRESENTATION_PATTERN',
  'TRADING_ACTIVITY_PATTERN',
  'BRAND_OWNER_OPERATION_PATTERN'
] as const;
export type SeedArchetypeIndicatorCodeV1 = (typeof seedArchetypeIndicatorCodesV1)[number];

const investorBehaviorIndicatorCodesV1 = new Set<SeedArchetypeIndicatorCodeV1>([
  'REPEATED_TRANSFER_OUT',
  'TRANSFER_COUNTERPARTY_DIVERSITY',
  'HOLDING_CYCLE_PATTERN',
  'PUBLIC_MARKETPLACE_LISTINGS'
]);

export interface SeedArchetypeTargetRefV1 {
  owner: 'DATA_ENGINE' | 'BRAIN' | 'LITE';
  kind: string;
  id: string;
  version: string | number;
  fingerprintSha256: string;
  observedAt: string;
}

export interface SeedArchetypeIndicatorV1 {
  code: SeedArchetypeIndicatorCodeV1;
  direction: 'SUPPORTS' | 'COUNTERS';
  explanation: string;
  evidenceRefs: readonly Readonly<BrainEvidenceRef>[];
}

export interface SeedArchetypeCandidateV1 {
  archetype: SeedBusinessArchetypeV1;
  band: SeedArchetypeEvidenceBandV1;
  indicators: readonly Readonly<SeedArchetypeIndicatorV1>[];
}

export const noSeedArchetypeAuthorityConsequencesV1 = Object.freeze({
  workspaceTypeAssigned: false,
  investorStatusEstablished: false,
  customerRelationshipEstablished: false,
  opportunityQualified: false,
  marketingConsentInferred: false,
  outreachAuthorized: false,
  externalActionAuthorized: false
});

export interface SeedBusinessArchetypeAssessmentV1 {
  schemaVersion: 1;
  assessmentId: `seed-archetype-assessment_${string}`;
  methodVersionId: BrainMethodVersionId;
  targetRef: Readonly<SeedArchetypeTargetRefV1>;
  candidates: readonly Readonly<SeedArchetypeCandidateV1>[];
  evaluatedAt: string;
  explanation: string;
  authorityConsequences: typeof noSeedArchetypeAuthorityConsequencesV1;
  assessmentFingerprintSha256: string;
}

export class SeedArchetypeValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'SeedArchetypeValidationError';
  }
}

type JsonObject = Record<string, unknown>;
const SHA256 = /^[0-9a-f]{64}$/u;
const ASSESSMENT_ID = /^seed-archetype-assessment_[A-Za-z0-9_-]+$/u;

function object(value: unknown, field: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new SeedArchetypeValidationError(`${field} must be an object.`);
  return value as JsonObject;
}

function exact(value: JsonObject, fields: readonly string[], field: string): void {
  if (Object.keys(value).sort().join(',') !== [...fields].sort().join(','))
    throw new SeedArchetypeValidationError(`${field} must contain exactly the V1 fields.`);
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum)
    throw new SeedArchetypeValidationError(`${field} is invalid.`);
  return value.trim();
}

function at(value: unknown, field: string): string {
  const result = text(value, field, 80);
  if (!Number.isFinite(Date.parse(result)))
    throw new SeedArchetypeValidationError(`${field} must be an ISO timestamp.`);
  return new Date(result).toISOString();
}

function sha(value: unknown, field: string): string {
  const result = text(value, field, 64);
  if (!SHA256.test(result))
    throw new SeedArchetypeValidationError(`${field} must be lowercase SHA-256.`);
  return result;
}

function version(value: unknown, field: string): string | number {
  if (Number.isSafeInteger(value) && Number(value) >= 1) return Number(value);
  if (typeof value === 'string' && value.trim()) return value.trim();
  throw new SeedArchetypeValidationError(`${field} is invalid.`);
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)])
    );
  return value;
}

function fingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

function targetRef(value: unknown): SeedArchetypeTargetRefV1 {
  const input = object(value, 'targetRef');
  exact(input, ['owner', 'kind', 'id', 'version', 'fingerprintSha256', 'observedAt'], 'targetRef');
  if (!['DATA_ENGINE', 'BRAIN', 'LITE'].includes(String(input.owner)))
    throw new SeedArchetypeValidationError('targetRef.owner is invalid.');
  return {
    owner: input.owner as SeedArchetypeTargetRefV1['owner'],
    kind: text(input.kind, 'targetRef.kind', 160),
    id: text(input.id, 'targetRef.id', 300),
    version: version(input.version, 'targetRef.version'),
    fingerprintSha256: sha(input.fingerprintSha256, 'targetRef.fingerprintSha256'),
    observedAt: at(input.observedAt, 'targetRef.observedAt')
  };
}

function indicator(value: unknown, field: string): SeedArchetypeIndicatorV1 {
  const input = object(value, field);
  exact(input, ['code', 'direction', 'explanation', 'evidenceRefs'], field);
  if (
    typeof input.code !== 'string' ||
    !seedArchetypeIndicatorCodesV1.includes(input.code as SeedArchetypeIndicatorCodeV1)
  )
    throw new SeedArchetypeValidationError(`${field}.code is invalid.`);
  if (input.direction !== 'SUPPORTS' && input.direction !== 'COUNTERS')
    throw new SeedArchetypeValidationError(`${field}.direction is invalid.`);
  if (!Array.isArray(input.evidenceRefs) || input.evidenceRefs.length === 0)
    throw new SeedArchetypeValidationError(`${field}.evidenceRefs must be non-empty.`);
  return {
    code: input.code as SeedArchetypeIndicatorCodeV1,
    direction: input.direction,
    explanation: text(input.explanation, `${field}.explanation`, 1000),
    evidenceRefs: input.evidenceRefs.map((item) => parseBrainEvidenceRef(item))
  };
}

function candidate(value: unknown, field: string): SeedArchetypeCandidateV1 {
  const input = object(value, field);
  exact(input, ['archetype', 'band', 'indicators'], field);
  if (
    typeof input.archetype !== 'string' ||
    !seedBusinessArchetypesV1.includes(input.archetype as SeedBusinessArchetypeV1)
  )
    throw new SeedArchetypeValidationError(`${field}.archetype is invalid.`);
  if (
    typeof input.band !== 'string' ||
    !seedArchetypeEvidenceBandsV1.includes(input.band as SeedArchetypeEvidenceBandV1)
  )
    throw new SeedArchetypeValidationError(`${field}.band is invalid.`);
  if (!Array.isArray(input.indicators) || input.indicators.length === 0)
    throw new SeedArchetypeValidationError(`${field}.indicators must be non-empty.`);
  const indicators = input.indicators.map((item, index) =>
    indicator(item, `${field}.indicators[${index}]`)
  );
  if (
    input.archetype === 'TRADEMARK_INVESTOR_CANDIDATE' &&
    !indicators.some(
      (item) => item.direction === 'SUPPORTS' && investorBehaviorIndicatorCodesV1.has(item.code)
    )
  )
    throw new SeedArchetypeValidationError(
      'TRADEMARK_INVESTOR_CANDIDATE requires supporting transfer, holding-cycle or marketplace behavior evidence; application volume alone is insufficient.'
    );
  return {
    archetype: input.archetype as SeedBusinessArchetypeV1,
    band: input.band as SeedArchetypeEvidenceBandV1,
    indicators
  };
}

function authority(value: unknown): typeof noSeedArchetypeAuthorityConsequencesV1 {
  const input = object(value, 'authorityConsequences');
  exact(input, Object.keys(noSeedArchetypeAuthorityConsequencesV1), 'authorityConsequences');
  if (Object.values(input).some((item) => item !== false))
    throw new SeedArchetypeValidationError('Archetype assessment cannot grant authority.');
  return noSeedArchetypeAuthorityConsequencesV1;
}

export function seedBusinessArchetypeAssessmentFingerprintSha256V1(
  value: Omit<SeedBusinessArchetypeAssessmentV1, 'assessmentFingerprintSha256'>
): string {
  return fingerprint(value);
}

export function parseSeedBusinessArchetypeAssessmentV1(
  value: unknown
): SeedBusinessArchetypeAssessmentV1 {
  const input = object(value, 'seedBusinessArchetypeAssessment');
  exact(
    input,
    [
      'schemaVersion',
      'assessmentId',
      'methodVersionId',
      'targetRef',
      'candidates',
      'evaluatedAt',
      'explanation',
      'authorityConsequences',
      'assessmentFingerprintSha256'
    ],
    'seedBusinessArchetypeAssessment'
  );
  const assessmentId = text(input.assessmentId, 'assessmentId', 300);
  if (input.schemaVersion !== 1 || !ASSESSMENT_ID.test(assessmentId))
    throw new SeedArchetypeValidationError('Assessment identity is invalid.');
  const methodVersionId = text(input.methodVersionId, 'methodVersionId', 300);
  if (!methodVersionId.startsWith('brain-method-version_'))
    throw new SeedArchetypeValidationError('methodVersionId is invalid.');
  if (!Array.isArray(input.candidates) || input.candidates.length === 0)
    throw new SeedArchetypeValidationError('candidates must be non-empty.');
  const candidates = input.candidates.map((item, index) => candidate(item, `candidates[${index}]`));
  if (new Set(candidates.map((item) => item.archetype)).size !== candidates.length)
    throw new SeedArchetypeValidationError('Candidate archetypes must be unique.');

  const parsed: Omit<SeedBusinessArchetypeAssessmentV1, 'assessmentFingerprintSha256'> = {
    schemaVersion: 1,
    assessmentId: assessmentId as SeedBusinessArchetypeAssessmentV1['assessmentId'],
    methodVersionId: methodVersionId as BrainMethodVersionId,
    targetRef: targetRef(input.targetRef),
    candidates,
    evaluatedAt: at(input.evaluatedAt, 'evaluatedAt'),
    explanation: text(input.explanation, 'explanation', 2000),
    authorityConsequences: authority(input.authorityConsequences)
  };
  const expected = seedBusinessArchetypeAssessmentFingerprintSha256V1(parsed);
  if (sha(input.assessmentFingerprintSha256, 'assessmentFingerprintSha256') !== expected)
    throw new SeedArchetypeValidationError('Archetype assessment fingerprint mismatch.');
  return { ...parsed, assessmentFingerprintSha256: expected };
}
