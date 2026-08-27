import type { BrainAssetVersionId, BrainBuildRunId, BrainEvidenceRef } from './brain.js';

export type BrainGapId = `brain-gap_${string}`;
export type BrainGapRegistryKey = `brain-gap-key_${string}`;

export const brainGapTypes = [
  'MISSING_EVIDENCE',
  'STALE_EVIDENCE',
  'CONFLICTING_EVIDENCE',
  'INSUFFICIENT_SAMPLE',
  'LOW_CONFIDENCE',
  'MISSING_METHOD',
  'MISSING_PATTERN',
  'LOW_MODEL_QUALITY',
  'NOVEL_CASE',
  'MISSING_JURISDICTION',
  'MISSING_CAPABILITY'
] as const;
export type BrainGapType = (typeof brainGapTypes)[number];

export const brainGapSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type BrainGapSeverity = (typeof brainGapSeverities)[number];

export const brainGapBusinessImpacts = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type BrainGapBusinessImpact = (typeof brainGapBusinessImpacts)[number];

export const brainGapStatuses = [
  'OPEN',
  'ACKNOWLEDGED',
  'RESOLVING',
  'RESOLVED',
  'DISMISSED'
] as const;
export type BrainGapStatus = (typeof brainGapStatuses)[number];

export const brainGapDetectionSources = [
  'BUILD_RUN',
  'ASSET_AUDIT',
  'CASE_RUN',
  'EVALUATION'
] as const;
export type BrainGapDetectionSource = (typeof brainGapDetectionSources)[number];

export const brainGapTargetModules = [
  'KNOWLEDGE',
  'DATA_ENGINE',
  'MARKREG',
  'EXPERT',
  'BRAIN_BUILD',
  'CAPABILITY'
] as const;
export type BrainGapTargetModule = (typeof brainGapTargetModules)[number];

export interface BrainGapScope {
  domain: string;
  jurisdiction?: string;
  concept: string;
}

/** One immutable cognitive-gap detection occurrence with exact runtime lineage. */
export interface BrainGap {
  schemaVersion: 1;
  brainGapId: BrainGapId;
  fingerprintSha256: string;
  gapType: BrainGapType;
  severity: BrainGapSeverity;
  businessImpact: BrainGapBusinessImpact;
  status: BrainGapStatus;
  detectionSource: BrainGapDetectionSource;
  scope: Readonly<BrainGapScope>;
  targetModule: BrainGapTargetModule;
  reasonCode: string;
  explanation: string;
  remediationHint: string;
  evidenceRefs: readonly Readonly<BrainEvidenceRef>[];
  relatedBrainBuildRunId?: BrainBuildRunId;
  relatedBrainAssetVersionId?: BrainAssetVersionId;
  detectedAt: string;
}

export interface BrainSelfAuditResult {
  schemaVersion: 1;
  gaps: readonly Readonly<BrainGap>[];
  auditedAt: string;
}

export type BrainGapDispositionSource = 'MANUAL' | 'RECURRENCE';

export interface BrainGapDisposition {
  status: BrainGapStatus;
  occurredAt: string;
  reason: string;
  source: BrainGapDispositionSource;
}

/** Longitudinal registry identity that groups recurring BrainGap occurrences. */
export interface BrainGapRegistryRecord {
  schemaVersion: 1;
  brainGapRegistryKey: BrainGapRegistryKey;
  identityFingerprintSha256: string;
  status: BrainGapStatus;
  firstDetectedAt: string;
  lastDetectedAt: string;
  occurrenceCount: number;
  latestGap: Readonly<BrainGap>;
  latestDisposition?: Readonly<BrainGapDisposition>;
}

export interface BrainGapTransitionCommand {
  brainGapRegistryKey: BrainGapRegistryKey;
  toStatus: BrainGapStatus;
  occurredAt: string;
  reason: string;
}

export interface BrainGapRegistryQuery {
  status?: BrainGapStatus;
  gapType?: BrainGapType;
  targetModule?: BrainGapTargetModule;
  domain?: string;
  jurisdiction?: string;
  concept?: string;
}
