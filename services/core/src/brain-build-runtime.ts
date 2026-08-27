import { createHash } from 'node:crypto';
import {
  parseBrainAssetVersion,
  type BrainAssetType,
  type BrainAssetVersion,
  type BrainAssetId,
  type BrainAssetVersionId,
  type BrainBuildRunId
} from '@markorbit/contracts/brain';
import type {
  BrainBuildBlockedReason,
  BrainBuildRequest,
  BrainBuildResult,
  BrainCompilerPolicy
} from '@markorbit/contracts/brain-build';
import type { BrainEvidenceAssertion } from '@markorbit/contracts/brain-evidence';
import { evaluateBrainConfidence } from './brain-confidence-engine.js';
import { resolveBrainEvidence } from './brain-evidence-resolver.js';

export const brainCompilerPolicyV1: Readonly<BrainCompilerPolicy> = Object.freeze({
  schemaVersion: 1,
  policyId: 'brain-compiler-policy_core-v1',
  version: 1,
  candidateMinimumScore: 0.55,
  validatedMinimumScore: 0.75,
  validatedMinimumValidationFactor: 0.7
});

function canonicalize(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right)
  );
  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
    .join(',')}}`;
}

function sha256(value: unknown): string {
  return createHash('sha256').update(canonicalize(value)).digest('hex');
}

function normalizedAssertions(assertions: readonly Readonly<BrainEvidenceAssertion>[]): unknown[] {
  return assertions
    .map((assertion) => structuredClone(assertion))
    .sort((left, right) => {
      const leftIdentity = `${left.evidenceRef.sourceOwner}:${left.evidenceRef.sourceObjectId}:${left.evidenceRef.sourceVersion}`;
      const rightIdentity = `${right.evidenceRef.sourceOwner}:${right.evidenceRef.sourceObjectId}:${right.evidenceRef.sourceVersion}`;
      return leftIdentity.localeCompare(rightIdentity);
    });
}

function inputFingerprint(request: Readonly<BrainBuildRequest>): string {
  return sha256({
    assertions: normalizedAssertions(request.assertions),
    query: request.query,
    qualityEvidence: request.qualityEvidence,
    assetScope: request.assetScope,
    builtAt: request.builtAt,
    compilerPolicyId: brainCompilerPolicyV1.policyId,
    compilerPolicyVersion: brainCompilerPolicyV1.version
  });
}

function blocked(
  request: Readonly<BrainBuildRequest>,
  reason: BrainBuildBlockedReason,
  fingerprint: string,
  resolution: ReturnType<typeof resolveBrainEvidence>,
  confidenceEvaluation: ReturnType<typeof evaluateBrainConfidence>
): Readonly<BrainBuildResult> {
  return {
    run: {
      schemaVersion: 1,
      brainBuildRunId: `brain-build-run_${fingerprint}` as BrainBuildRunId,
      status: 'BLOCKED',
      inputFingerprintSha256: fingerprint,
      compilerPolicyId: brainCompilerPolicyV1.policyId,
      compilerPolicyVersion: brainCompilerPolicyV1.version,
      resolution,
      confidenceEvaluation,
      blockedReason: reason,
      builtAt: request.builtAt
    }
  };
}

function assetTypeFor(valueKind: string | undefined): BrainAssetType | undefined {
  if (valueKind === 'EXACT') return 'RESOLVED_VALUE';
  if (valueKind === 'STATISTICAL_RANGE' || valueKind === 'MODEL_ESTIMATE') {
    return 'STATISTICAL_ESTIMATE';
  }
  return undefined;
}

function compiledAssetVersion(
  request: Readonly<BrainBuildRequest>,
  fingerprint: string,
  status: 'CANDIDATE' | 'VALIDATED',
  resolution: ReturnType<typeof resolveBrainEvidence>,
  confidenceEvaluation: ReturnType<typeof evaluateBrainConfidence>,
  assetType: BrainAssetType
): Readonly<BrainAssetVersion> {
  if (!confidenceEvaluation.confidence) {
    throw new TypeError('A scored confidence evaluation is required to compile a Brain asset.');
  }
  const assetHash = sha256({
    domain: resolution.domain,
    jurisdiction: resolution.jurisdiction ?? null,
    concept: resolution.concept,
    inputSchemaId: request.assetScope.inputSchemaId,
    outputSchemaId: request.assetScope.outputSchemaId
  });
  const versionHash = sha256({ assetHash, fingerprint, status });
  return parseBrainAssetVersion({
    schemaVersion: 1,
    brainAssetId: `brain-asset_${assetHash}` as BrainAssetId,
    brainAssetVersionId: `brain-asset-version_${versionHash}` as BrainAssetVersionId,
    version: 1,
    assetType,
    status,
    scope: {
      domain: resolution.domain,
      ...(resolution.jurisdiction ? { jurisdiction: resolution.jurisdiction } : {}),
      concept: resolution.concept,
      inputSchemaId: request.assetScope.inputSchemaId,
      outputSchemaId: request.assetScope.outputSchemaId,
      effectiveFrom: request.assetScope.effectiveFrom,
      ...(request.assetScope.effectiveTo ? { effectiveTo: request.assetScope.effectiveTo } : {})
    },
    evidenceRefs: confidenceEvaluation.evidenceRefs,
    derivedFromBrainAssetVersionIds: [],
    confidence: confidenceEvaluation.confidence,
    payload: {
      valueKind: resolution.selectedValueKind,
      value: resolution.selectedValue,
      resolutionFingerprintSha256: confidenceEvaluation.resolutionFingerprint,
      confidencePolicyId: confidenceEvaluation.policyId,
      confidencePolicyVersion: confidenceEvaluation.policyVersion,
      compilerPolicyId: brainCompilerPolicyV1.policyId,
      compilerPolicyVersion: brainCompilerPolicyV1.version
    },
    createdAt: request.builtAt,
    ...(status === 'VALIDATED' ? { validatedAt: request.builtAt } : {})
  });
}

export function runBrainBuild(request: Readonly<BrainBuildRequest>): Readonly<BrainBuildResult> {
  const fingerprint = inputFingerprint(request);
  const resolution = resolveBrainEvidence(request.assertions, request.query);
  const confidenceEvaluation = evaluateBrainConfidence({
    candidate: resolution,
    qualityEvidence: request.qualityEvidence,
    evaluatedAt: request.builtAt
  });

  if (resolution.status === 'NO_EVIDENCE') {
    return blocked(
      request,
      'NO_APPLICABLE_EVIDENCE',
      fingerprint,
      resolution,
      confidenceEvaluation
    );
  }
  if (resolution.status === 'CONFLICTED') {
    return blocked(request, 'EVIDENCE_CONFLICT', fingerprint, resolution, confidenceEvaluation);
  }
  if (confidenceEvaluation.status !== 'SCORED' || !confidenceEvaluation.confidence) {
    return blocked(request, 'CONFIDENCE_UNSCORABLE', fingerprint, resolution, confidenceEvaluation);
  }
  const assetType = assetTypeFor(resolution.selectedValueKind);
  if (!assetType) {
    return blocked(
      request,
      'UNSUPPORTED_VALUE_KIND',
      fingerprint,
      resolution,
      confidenceEvaluation
    );
  }
  if (confidenceEvaluation.confidence.score < brainCompilerPolicyV1.candidateMinimumScore) {
    return blocked(
      request,
      'CONFIDENCE_BELOW_CANDIDATE_THRESHOLD',
      fingerprint,
      resolution,
      confidenceEvaluation
    );
  }

  const validationFactor = confidenceEvaluation.confidence.factors.validation;
  const validated =
    confidenceEvaluation.confidence.score >= brainCompilerPolicyV1.validatedMinimumScore &&
    validationFactor >= brainCompilerPolicyV1.validatedMinimumValidationFactor;
  const assetStatus = validated ? 'VALIDATED' : 'CANDIDATE';
  const producedAssetVersion = compiledAssetVersion(
    request,
    fingerprint,
    assetStatus,
    resolution,
    confidenceEvaluation,
    assetType
  );

  return {
    run: {
      schemaVersion: 1,
      brainBuildRunId: `brain-build-run_${fingerprint}` as BrainBuildRunId,
      status: validated ? 'VALIDATED_READY' : 'CANDIDATE_READY',
      inputFingerprintSha256: fingerprint,
      compilerPolicyId: brainCompilerPolicyV1.policyId,
      compilerPolicyVersion: brainCompilerPolicyV1.version,
      resolution,
      confidenceEvaluation,
      producedAssetVersion,
      builtAt: request.builtAt
    }
  };
}
