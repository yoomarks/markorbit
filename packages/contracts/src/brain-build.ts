import type {
  BrainAssetVersion,
  BrainBuildRunId
} from './brain.js';
import type { BrainConfidenceEvaluation, BrainConfidenceQualityEvidence } from './brain-confidence.js';
import type {
  BrainEvidenceAssertion,
  BrainEvidenceResolutionCandidate
} from './brain-evidence.js';

export const brainBuildStatuses = [
  'STARTED',
  'RESOLVED',
  'SCORED',
  'CANDIDATE_READY',
  'VALIDATED_READY',
  'BLOCKED'
] as const;
export type BrainBuildStatus = (typeof brainBuildStatuses)[number];

export const brainBuildBlockedReasons = [
  'NO_APPLICABLE_EVIDENCE',
  'EVIDENCE_CONFLICT',
  'CONFIDENCE_UNSCORABLE',
  'CONFIDENCE_BELOW_CANDIDATE_THRESHOLD',
  'VALIDATION_BELOW_VALIDATED_THRESHOLD',
  'UNSUPPORTED_VALUE_KIND'
] as const;
export type BrainBuildBlockedReason = (typeof brainBuildBlockedReasons)[number];

export interface BrainCompilerPolicy {
  schemaVersion: 1;
  policyId: `brain-compiler-policy_${string}`;
  version: number;
  candidateMinimumScore: number;
  validatedMinimumScore: number;
  validatedMinimumValidationFactor: number;
}

export interface BrainBuildAssetScopeInput {
  inputSchemaId: string;
  outputSchemaId: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface BrainBuildRequest {
  assertions: readonly Readonly<BrainEvidenceAssertion>[];
  query: {
    domain: string;
    jurisdiction?: string;
    concept: string;
    asOf: string;
  };
  qualityEvidence: Readonly<BrainConfidenceQualityEvidence>;
  assetScope: Readonly<BrainBuildAssetScopeInput>;
  builtAt: string;
}

export interface BrainBuildRun {
  schemaVersion: 1;
  brainBuildRunId: BrainBuildRunId;
  status: BrainBuildStatus;
  inputFingerprintSha256: string;
  compilerPolicyId: BrainCompilerPolicy['policyId'];
  compilerPolicyVersion: number;
  resolution: Readonly<BrainEvidenceResolutionCandidate>;
  confidenceEvaluation: Readonly<BrainConfidenceEvaluation>;
  producedAssetVersion?: Readonly<BrainAssetVersion>;
  blockedReason?: BrainBuildBlockedReason;
  builtAt: string;
}

export interface BrainBuildResult {
  run: Readonly<BrainBuildRun>;
}
