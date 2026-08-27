import { createHash } from 'node:crypto';
import type { BrainBuildRun } from '@markorbit/contracts/brain-build';
import type {
  BrainGap,
  BrainGapBusinessImpact,
  BrainGapSeverity,
  BrainGapTargetModule,
  BrainGapType,
  BrainSelfAuditResult
} from '@markorbit/contracts/brain-gap';

export const brainSelfAuditPolicyV1 = Object.freeze({
  policyId: 'brain-self-audit-policy_core-v1',
  version: 1,
  staleFreshnessThreshold: 0.5,
  lowConfidenceThreshold: 0.55,
  insufficientCoverageThreshold: 0.5
});

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

function sha256(value: unknown): string {
  return createHash('sha256').update(canonicalize(value)).digest('hex');
}

function severityFor(type: BrainGapType): BrainGapSeverity {
  if (type === 'MISSING_EVIDENCE' || type === 'CONFLICTING_EVIDENCE') return 'HIGH';
  if (type === 'LOW_CONFIDENCE' || type === 'INSUFFICIENT_SAMPLE') return 'HIGH';
  if (type === 'STALE_EVIDENCE') return 'MEDIUM';
  return 'MEDIUM';
}

function impactFor(type: BrainGapType): BrainGapBusinessImpact {
  if (type === 'MISSING_EVIDENCE' || type === 'CONFLICTING_EVIDENCE') return 'HIGH';
  if (type === 'LOW_CONFIDENCE') return 'HIGH';
  return 'MEDIUM';
}

function targetFor(type: BrainGapType): BrainGapTargetModule {
  if (['MISSING_EVIDENCE', 'STALE_EVIDENCE', 'CONFLICTING_EVIDENCE'].includes(type))
    return 'KNOWLEDGE';
  if (type === 'INSUFFICIENT_SAMPLE') return 'DATA_ENGINE';
  if (['MISSING_METHOD', 'MISSING_PATTERN', 'LOW_MODEL_QUALITY', 'NOVEL_CASE'].includes(type))
    return 'BRAIN_BUILD';
  if (type === 'MISSING_CAPABILITY') return 'CAPABILITY';
  if (type === 'MISSING_JURISDICTION') return 'KNOWLEDGE';
  return 'BRAIN_BUILD';
}

function explanationFor(type: BrainGapType): {
  reasonCode: string;
  explanation: string;
  remediationHint: string;
} {
  switch (type) {
    case 'MISSING_EVIDENCE':
      return {
        reasonCode: 'NO_APPLICABLE_EVIDENCE',
        explanation:
          'No applicable evidence was available for the requested Brain concept and scope.',
        remediationHint:
          'Acquire authoritative evidence for this concept and scope, then re-run the Brain build.'
      };
    case 'CONFLICTING_EVIDENCE':
      return {
        reasonCode: 'HIGHEST_AUTHORITY_CONFLICT',
        explanation:
          'The highest-authority applicable evidence contains materially conflicting values.',
        remediationHint:
          'Verify scope, effective dates and authoritative sources before recomputing the Brain asset.'
      };
    case 'STALE_EVIDENCE':
      return {
        reasonCode: 'FRESHNESS_BELOW_TRUSTED_THRESHOLD',
        explanation:
          'Supporting evidence freshness is below the trusted self-audit threshold or lacks observation timestamps.',
        remediationHint:
          'Refresh the supporting source evidence and preserve a current observation timestamp.'
      };
    case 'INSUFFICIENT_SAMPLE':
      return {
        reasonCode: 'STATISTICAL_COVERAGE_BELOW_THRESHOLD',
        explanation:
          'A statistical or model estimate has insufficient coverage for a trusted operational estimate.',
        remediationHint:
          'Increase the verified sample or coverage through Data Engine aggregation, then recompute.'
      };
    case 'LOW_CONFIDENCE':
      return {
        reasonCode: 'CONFIDENCE_BELOW_OPERATIONAL_THRESHOLD',
        explanation:
          'The resolved candidate confidence is below the self-audit threshold for reusable operational cognition.',
        remediationHint:
          'Inspect the decomposed confidence factors and strengthen the weakest evidence-quality dimensions.'
      };
    default:
      return {
        reasonCode: type,
        explanation: `Brain self-audit detected ${type}.`,
        remediationHint:
          'Route the gap to the deterministic target module for governed remediation planning.'
      };
  }
}

function gap(
  run: Readonly<BrainBuildRun>,
  type: BrainGapType,
  auditedAt: string
): Readonly<BrainGap> {
  const details = explanationFor(type);
  const evidenceRefs = run.confidenceEvaluation.evidenceRefs
    .map((ref) => structuredClone(ref))
    .sort((left, right) =>
      `${left.sourceOwner}:${left.sourceObjectId}:${left.sourceVersion}:${left.sourceFingerprintSha256}`.localeCompare(
        `${right.sourceOwner}:${right.sourceObjectId}:${right.sourceVersion}:${right.sourceFingerprintSha256}`
      )
    );
  const identity = {
    policyId: brainSelfAuditPolicyV1.policyId,
    policyVersion: brainSelfAuditPolicyV1.version,
    brainBuildRunId: run.brainBuildRunId,
    gapType: type,
    domain: run.resolution.domain,
    jurisdiction: run.resolution.jurisdiction ?? null,
    concept: run.resolution.concept,
    evidenceRefs
  };
  const fingerprintSha256 = sha256(identity);
  return {
    schemaVersion: 1,
    brainGapId: `brain-gap_${fingerprintSha256}`,
    fingerprintSha256,
    gapType: type,
    severity: severityFor(type),
    businessImpact: impactFor(type),
    status: 'OPEN',
    detectionSource: 'BUILD_RUN',
    scope: {
      domain: run.resolution.domain,
      ...(run.resolution.jurisdiction ? { jurisdiction: run.resolution.jurisdiction } : {}),
      concept: run.resolution.concept
    },
    targetModule: targetFor(type),
    reasonCode: details.reasonCode,
    explanation: details.explanation,
    remediationHint: details.remediationHint,
    evidenceRefs,
    relatedBrainBuildRunId: run.brainBuildRunId,
    ...(run.producedAssetVersion
      ? { relatedBrainAssetVersionId: run.producedAssetVersion.brainAssetVersionId }
      : {}),
    detectedAt: auditedAt
  };
}

export function auditBrainBuildRun(
  run: Readonly<BrainBuildRun>,
  auditedAt: string
): Readonly<BrainSelfAuditResult> {
  if (Number.isNaN(Date.parse(auditedAt)))
    throw new TypeError('auditedAt must be an ISO date/time.');
  const types = new Set<BrainGapType>();

  if (run.resolution.status === 'NO_EVIDENCE') types.add('MISSING_EVIDENCE');
  if (run.resolution.status === 'CONFLICTED') types.add('CONFLICTING_EVIDENCE');

  const confidence = run.confidenceEvaluation.confidence;
  if (confidence) {
    if (confidence.factors.freshness < brainSelfAuditPolicyV1.staleFreshnessThreshold) {
      types.add('STALE_EVIDENCE');
    }
    if (confidence.score < brainSelfAuditPolicyV1.lowConfidenceThreshold) {
      types.add('LOW_CONFIDENCE');
    }
    if (
      (run.resolution.selectedValueKind === 'STATISTICAL_RANGE' ||
        run.resolution.selectedValueKind === 'MODEL_ESTIMATE') &&
      confidence.factors.coverage < brainSelfAuditPolicyV1.insufficientCoverageThreshold
    ) {
      types.add('INSUFFICIENT_SAMPLE');
    }
  }

  const gaps = [...types].sort().map((type) => gap(run, type, auditedAt));

  return {
    schemaVersion: 1,
    gaps,
    auditedAt
  };
}
