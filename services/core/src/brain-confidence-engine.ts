import { createHash } from 'node:crypto';
import {
  parseBrainConfidencePolicy,
  parseBrainConfidenceQualityEvidence,
  type BrainConfidenceBandThresholds,
  type BrainConfidenceEvaluation,
  type BrainConfidenceEvaluationRequest,
  type BrainConfidenceFactorEvidence,
  type BrainConfidencePolicy
} from '@markorbit/contracts/brain-confidence';
import type {
  BrainEvidenceAuthorityClass,
  BrainEvidenceResolutionAssertionSummary,
  BrainEvidenceResolutionCandidate
} from '@markorbit/contracts/brain-evidence';

const DAY_MS = 86_400_000;

const authorityScores: Readonly<Record<BrainEvidenceAuthorityClass, number>> = Object.freeze({
  CURRENT_OFFICIAL_PRIMARY: 1,
  CURRENT_OFFICIAL_STATISTICAL: 0.92,
  INTERNAL_VERIFIED_DATA: 0.85,
  VERIFIED_PROFESSIONAL_SOURCE: 0.78,
  SECONDARY_PROFESSIONAL: 0.62,
  GENERAL_PUBLIC_SOURCE: 0.4
});

export const brainConfidencePolicyV1: Readonly<BrainConfidencePolicy> = Object.freeze(
  parseBrainConfidencePolicy({
    schemaVersion: 1,
    policyId: 'brain-confidence-policy_core-v1',
    version: 1,
    weights: {
      authority: 0.25,
      freshness: 0.15,
      agreement: 0.2,
      coverage: 0.15,
      validation: 0.15,
      methodQuality: 0.1
    },
    bandThresholds: {
      low: 0.35,
      medium: 0.55,
      high: 0.75,
      veryHigh: 0.9
    },
    freshnessHalfLifeDays: 365,
    missingTimestampFreshness: 0.35,
    singleSourceAgreement: 0.55,
    counterEvidencePenalty: 0.18
  })
);

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function rounded(value: number): number {
  return Math.round(clamp(value) * 1_000_000) / 1_000_000;
}

function band(
  score: number,
  thresholds: BrainConfidenceBandThresholds
): 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' {
  if (score >= thresholds.veryHigh) return 'VERY_HIGH';
  if (score >= thresholds.high) return 'HIGH';
  if (score >= thresholds.medium) return 'MEDIUM';
  if (score >= thresholds.low) return 'LOW';
  return 'VERY_LOW';
}

function stableCandidateFingerprint(candidate: BrainEvidenceResolutionCandidate): string {
  const refs = [...candidate.supportingAssertions, ...candidate.conflictingAssertions]
    .map((summary) =>
      [
        summary.evidenceRef.sourceOwner,
        summary.evidenceRef.sourceObjectId,
        summary.evidenceRef.sourceVersion,
        summary.evidenceRef.sourceFingerprintSha256,
        summary.authorityClass,
        summary.valueKind,
        summary.valueFingerprintSha256
      ].join(':')
    )
    .sort();
  return createHash('sha256')
    .update(
      JSON.stringify({
        domain: candidate.domain,
        jurisdiction: candidate.jurisdiction ?? null,
        concept: candidate.concept,
        asOf: candidate.asOf,
        status: candidate.status,
        selectedAuthorityClass: candidate.selectedAuthorityClass ?? null,
        selectedValueKind: candidate.selectedValueKind ?? null,
        refs
      })
    )
    .digest('hex');
}

function sourceIdentity(summary: BrainEvidenceResolutionAssertionSummary): string {
  const ref = summary.evidenceRef;
  return `${ref.sourceOwner}:${ref.sourceObjectId}:${ref.sourceVersion}`;
}

function freshnessScore(
  candidate: BrainEvidenceResolutionCandidate,
  evaluatedAt: string,
  policy: BrainConfidencePolicy
): { score: number; reason: string } {
  const now = Date.parse(evaluatedAt);
  if (Number.isNaN(now)) throw new TypeError('evaluatedAt must be an ISO date/time.');
  const supporting = candidate.supportingAssertions;
  if (!supporting.length) return { score: 0, reason: 'No supporting evidence is available.' };
  const scores = supporting.map((summary) => {
    const timestamp = summary.evidenceRef.observedAt;
    if (!timestamp) return policy.missingTimestampFreshness;
    const observed = Date.parse(timestamp);
    if (Number.isNaN(observed)) return policy.missingTimestampFreshness;
    const ageDays = Math.max(0, (now - observed) / DAY_MS);
    return Math.pow(0.5, ageDays / policy.freshnessHalfLifeDays);
  });
  const score = scores.reduce((sum, item) => sum + item, 0) / scores.length;
  const missing = supporting.filter((summary) => !summary.evidenceRef.observedAt).length;
  return {
    score: rounded(score),
    reason: missing
      ? `${missing} supporting evidence reference(s) lack observation timestamps and receive the policy missing-timestamp score.`
      : 'Freshness is the mean time-decay score of supporting evidence observation timestamps.'
  };
}

function agreementScore(
  candidate: BrainEvidenceResolutionCandidate,
  policy: BrainConfidencePolicy
): { score: number; reason: string } {
  const independentSupportingSources = new Set(candidate.supportingAssertions.map(sourceIdentity))
    .size;
  if (!independentSupportingSources)
    return { score: 0, reason: 'No independent supporting source is available.' };
  const base =
    independentSupportingSources === 1
      ? policy.singleSourceAgreement
      : Math.min(1, policy.singleSourceAgreement + 0.15 * (independentSupportingSources - 1));
  const independentCounterSources = new Set(candidate.conflictingAssertions.map(sourceIdentity))
    .size;
  const score = rounded(base - independentCounterSources * policy.counterEvidencePenalty);
  return {
    score,
    reason: independentCounterSources
      ? `${independentSupportingSources} independent supporting source(s) are offset by ${independentCounterSources} preserved counter-evidence source(s).`
      : `${independentSupportingSources} independent supporting source(s) contribute agreement evidence.`
  };
}

function authorityScore(candidate: BrainEvidenceResolutionCandidate): {
  score: number;
  reason: string;
} {
  const selected = candidate.selectedAuthorityClass;
  if (!selected) return { score: 0, reason: 'No selected evidence authority class is available.' };
  return {
    score: authorityScores[selected],
    reason: `Selected evidence authority class is ${selected}.`
  };
}

function evidenceRefs(candidate: BrainEvidenceResolutionCandidate) {
  const refs = [...candidate.supportingAssertions, ...candidate.conflictingAssertions].map(
    (summary) => summary.evidenceRef
  );
  const seen = new Set<string>();
  return refs
    .filter((ref) => {
      const identity = `${ref.sourceOwner}:${ref.sourceObjectId}:${ref.sourceVersion}:${ref.sourceFingerprintSha256}`;
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    })
    .map((ref) => structuredClone(ref));
}

function unscorable(
  candidate: BrainEvidenceResolutionCandidate,
  status: 'UNSCORABLE_NO_EVIDENCE' | 'UNSCORABLE_CONFLICTED'
): BrainConfidenceEvaluation {
  return {
    schemaVersion: 1,
    status,
    policyId: brainConfidencePolicyV1.policyId,
    policyVersion: brainConfidencePolicyV1.version,
    resolutionFingerprint: stableCandidateFingerprint(candidate),
    factorEvidence: [],
    evidenceRefs: evidenceRefs(candidate),
    explanation:
      status === 'UNSCORABLE_NO_EVIDENCE'
        ? 'Confidence is not computed because the evidence resolver found no applicable evidence.'
        : 'Confidence is not computed because the highest-authority evidence is materially conflicted.'
  };
}

export function evaluateBrainConfidence(
  request: Readonly<BrainConfidenceEvaluationRequest>
): Readonly<BrainConfidenceEvaluation> {
  const candidate = request.candidate;
  if (candidate.status === 'NO_EVIDENCE') return unscorable(candidate, 'UNSCORABLE_NO_EVIDENCE');
  if (candidate.status === 'CONFLICTED') return unscorable(candidate, 'UNSCORABLE_CONFLICTED');

  const quality = parseBrainConfidenceQualityEvidence(request.qualityEvidence);
  const authority = authorityScore(candidate);
  const freshness = freshnessScore(candidate, request.evaluatedAt, brainConfidencePolicyV1);
  const agreement = agreementScore(candidate, brainConfidencePolicyV1);

  const factorEvidence: BrainConfidenceFactorEvidence[] = [
    { factor: 'authority', score: rounded(authority.score), reason: authority.reason },
    { factor: 'freshness', score: rounded(freshness.score), reason: freshness.reason },
    { factor: 'agreement', score: rounded(agreement.score), reason: agreement.reason },
    { factor: 'coverage', score: rounded(quality.coverage), reason: quality.coverageReason },
    { factor: 'validation', score: rounded(quality.validation), reason: quality.validationReason },
    {
      factor: 'methodQuality',
      score: rounded(quality.methodQuality),
      reason: quality.methodQualityReason
    }
  ];

  const factors = Object.fromEntries(factorEvidence.map((item) => [item.factor, item.score])) as {
    authority: number;
    freshness: number;
    agreement: number;
    coverage: number;
    validation: number;
    methodQuality: number;
  };
  const weights = brainConfidencePolicyV1.weights;
  const score = rounded(
    factors.authority * weights.authority +
      factors.freshness * weights.freshness +
      factors.agreement * weights.agreement +
      factors.coverage * weights.coverage +
      factors.validation * weights.validation +
      factors.methodQuality * weights.methodQuality
  );

  return {
    schemaVersion: 1,
    status: 'SCORED',
    policyId: brainConfidencePolicyV1.policyId,
    policyVersion: brainConfidencePolicyV1.version,
    resolutionFingerprint: stableCandidateFingerprint(candidate),
    confidence: {
      score,
      band: band(score, brainConfidencePolicyV1.bandThresholds),
      factors
    },
    factorEvidence,
    evidenceRefs: evidenceRefs(candidate),
    explanation:
      'Confidence is a deterministic weighted evaluation of decomposable evidence-quality factors under the versioned Core Brain confidence policy.'
  };
}
