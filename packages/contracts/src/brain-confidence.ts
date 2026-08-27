import {
  BrainContractError,
  parseBrainEvidenceRef,
  type BrainConfidence,
  type BrainEvidenceRef
} from './brain.js';
import type { BrainEvidenceResolutionCandidate } from './brain-evidence.js';

export const brainConfidenceEvaluationStatuses = [
  'SCORED',
  'UNSCORABLE_NO_EVIDENCE',
  'UNSCORABLE_CONFLICTED'
] as const;
export type BrainConfidenceEvaluationStatus = (typeof brainConfidenceEvaluationStatuses)[number];

export type BrainConfidenceFactorName = keyof BrainConfidence['factors'];

export interface BrainConfidenceWeights {
  authority: number;
  freshness: number;
  agreement: number;
  coverage: number;
  validation: number;
  methodQuality: number;
}

export interface BrainConfidenceBandThresholds {
  low: number;
  medium: number;
  high: number;
  veryHigh: number;
}

export interface BrainConfidencePolicy {
  schemaVersion: 1;
  policyId: `brain-confidence-policy_${string}`;
  version: number;
  weights: Readonly<BrainConfidenceWeights>;
  bandThresholds: Readonly<BrainConfidenceBandThresholds>;
  freshnessHalfLifeDays: number;
  missingTimestampFreshness: number;
  singleSourceAgreement: number;
  counterEvidencePenalty: number;
}

export interface BrainConfidenceQualityEvidence {
  coverage: number;
  validation: number;
  methodQuality: number;
  coverageReason: string;
  validationReason: string;
  methodQualityReason: string;
}

export interface BrainConfidenceFactorEvidence {
  factor: BrainConfidenceFactorName;
  score: number;
  reason: string;
}

export interface BrainConfidenceEvaluation {
  schemaVersion: 1;
  status: BrainConfidenceEvaluationStatus;
  policyId: BrainConfidencePolicy['policyId'];
  policyVersion: number;
  resolutionFingerprint: string;
  confidence?: Readonly<BrainConfidence>;
  factorEvidence: readonly Readonly<BrainConfidenceFactorEvidence>[];
  evidenceRefs: readonly Readonly<BrainEvidenceRef>[];
  explanation: string;
}

export interface BrainConfidenceEvaluationRequest {
  candidate: Readonly<BrainEvidenceResolutionCandidate>;
  qualityEvidence: Readonly<BrainConfidenceQualityEvidence>;
  evaluatedAt: string;
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

function text(value: unknown, field: string, maximum = 2000): string {
  if (typeof value !== 'string') throw new BrainContractError(`${field} must be a string.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    throw new BrainContractError(`${field} must contain 1 to ${maximum} characters.`);
  return cleaned;
}

function unit(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1)
    throw new BrainContractError(`${field} must be a number between 0 and 1.`);
  return value;
}

function positive(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
    throw new BrainContractError(`${field} must be a positive number.`);
  return value;
}

export function parseBrainConfidencePolicy(value: unknown): BrainConfidencePolicy {
  const policy = record(value, 'brainConfidencePolicy');
  exactKeys(
    policy,
    [
      'schemaVersion',
      'policyId',
      'version',
      'weights',
      'bandThresholds',
      'freshnessHalfLifeDays',
      'missingTimestampFreshness',
      'singleSourceAgreement',
      'counterEvidencePenalty'
    ],
    'brainConfidencePolicy'
  );
  if (policy.schemaVersion !== 1)
    throw new BrainContractError('brainConfidencePolicy.schemaVersion must be 1.');
  const policyId = text(policy.policyId, 'brainConfidencePolicy.policyId', 300);
  if (!policyId.startsWith('brain-confidence-policy_') || policyId === 'brain-confidence-policy_')
    throw new BrainContractError('brainConfidencePolicy.policyId is invalid.');
  if (!Number.isSafeInteger(policy.version) || (policy.version as number) < 1)
    throw new BrainContractError('brainConfidencePolicy.version must be a positive safe integer.');

  const weights = record(policy.weights, 'brainConfidencePolicy.weights');
  const factorNames: readonly BrainConfidenceFactorName[] = [
    'authority',
    'freshness',
    'agreement',
    'coverage',
    'validation',
    'methodQuality'
  ];
  exactKeys(weights, factorNames, 'brainConfidencePolicy.weights');
  const parsedWeights = Object.fromEntries(
    factorNames.map((factor) => [
      factor,
      unit(weights[factor], `brainConfidencePolicy.weights.${factor}`)
    ])
  ) as unknown as BrainConfidenceWeights;
  const weightSum = factorNames.reduce((sum, factor) => sum + parsedWeights[factor], 0);
  if (Math.abs(weightSum - 1) > 1e-9)
    throw new BrainContractError('brainConfidencePolicy.weights must sum to 1.');

  const thresholds = record(policy.bandThresholds, 'brainConfidencePolicy.bandThresholds');
  exactKeys(
    thresholds,
    ['low', 'medium', 'high', 'veryHigh'],
    'brainConfidencePolicy.bandThresholds'
  );
  const bandThresholds: BrainConfidenceBandThresholds = {
    low: unit(thresholds.low, 'brainConfidencePolicy.bandThresholds.low'),
    medium: unit(thresholds.medium, 'brainConfidencePolicy.bandThresholds.medium'),
    high: unit(thresholds.high, 'brainConfidencePolicy.bandThresholds.high'),
    veryHigh: unit(thresholds.veryHigh, 'brainConfidencePolicy.bandThresholds.veryHigh')
  };
  if (!(
    bandThresholds.low < bandThresholds.medium &&
    bandThresholds.medium < bandThresholds.high &&
    bandThresholds.high < bandThresholds.veryHigh
  ))
    throw new BrainContractError(
      'brainConfidencePolicy.bandThresholds must be strictly increasing.'
    );

  return {
    schemaVersion: 1,
    policyId: policyId as BrainConfidencePolicy['policyId'],
    version: policy.version as number,
    weights: parsedWeights,
    bandThresholds,
    freshnessHalfLifeDays: positive(
      policy.freshnessHalfLifeDays,
      'brainConfidencePolicy.freshnessHalfLifeDays'
    ),
    missingTimestampFreshness: unit(
      policy.missingTimestampFreshness,
      'brainConfidencePolicy.missingTimestampFreshness'
    ),
    singleSourceAgreement: unit(
      policy.singleSourceAgreement,
      'brainConfidencePolicy.singleSourceAgreement'
    ),
    counterEvidencePenalty: unit(
      policy.counterEvidencePenalty,
      'brainConfidencePolicy.counterEvidencePenalty'
    )
  };
}

export function parseBrainConfidenceQualityEvidence(
  value: unknown
): BrainConfidenceQualityEvidence {
  const evidence = record(value, 'brainConfidenceQualityEvidence');
  exactKeys(
    evidence,
    [
      'coverage',
      'validation',
      'methodQuality',
      'coverageReason',
      'validationReason',
      'methodQualityReason'
    ],
    'brainConfidenceQualityEvidence'
  );
  return {
    coverage: unit(evidence.coverage, 'brainConfidenceQualityEvidence.coverage'),
    validation: unit(evidence.validation, 'brainConfidenceQualityEvidence.validation'),
    methodQuality: unit(evidence.methodQuality, 'brainConfidenceQualityEvidence.methodQuality'),
    coverageReason: text(evidence.coverageReason, 'brainConfidenceQualityEvidence.coverageReason'),
    validationReason: text(
      evidence.validationReason,
      'brainConfidenceQualityEvidence.validationReason'
    ),
    methodQualityReason: text(
      evidence.methodQualityReason,
      'brainConfidenceQualityEvidence.methodQualityReason'
    )
  };
}

export function parseBrainConfidenceEvaluationEvidenceRefs(
  value: unknown
): readonly BrainEvidenceRef[] {
  if (!Array.isArray(value))
    throw new BrainContractError('brainConfidenceEvaluation.evidenceRefs must be an array.');
  return value.map(parseBrainEvidenceRef);
}
