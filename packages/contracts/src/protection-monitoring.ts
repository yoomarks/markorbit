import { createHash } from 'node:crypto';
import type {
  DataEngineApplicantCandidateReferenceV1,
  DataEngineDiscoveredTrademarkCandidateV1
} from './data-engine-applicant-discovery.js';
import type { OpportunityCandidateId, ProductLoopExactReference } from './product-loop.js';
import type { TrademarkAssetId } from './trademark-asset-workspace.js';
import type { WorkspaceWatchTargetId } from './workspace-watch.js';

export type ProtectionMonitoringCandidateIdV1 = `protection-monitoring-candidate_${string}`;
export type ProtectionMonitoringDecisionIdV1 = `protection-monitoring-decision_${string}`;

export const protectionMonitoringDispositionsV1 = ['WATCH', 'IGNORE', 'ACTION'] as const;
export type ProtectionMonitoringDispositionV1 = (typeof protectionMonitoringDispositionsV1)[number];

export interface ProtectionMonitoringRelevanceEvidenceV1 {
  method: 'NORMALIZED_MARK_TEXT_BIGRAM_DICE_V1';
  managedMarkNormalized: string;
  observedMarkNormalized: string;
  scoreBasisPoints: number;
  explanation: string;
  algorithmicSimilarityIsLegalConclusion: false;
  likelihoodOfConfusionConcluded: false;
  infringementConcluded: false;
}

export const noProtectionMonitoringAuthorityConsequencesV1 = Object.freeze({
  officialTruthCreated: false,
  legalConclusionCreated: false,
  infringementConcluded: false,
  likelihoodOfConfusionConcluded: false,
  clientContactAuthorized: false,
  complaintAuthorized: false,
  takedownAuthorized: false,
  ceaseAndDesistAuthorized: false,
  filingAuthorized: false,
  protectedActionAuthorized: false
});

/** Lite-owned review candidate; source facts and Watch intent remain with their owners. */
export interface ProtectionMonitoringCandidateV1 {
  schemaVersion: 1;
  protectionMonitoringCandidateId: ProtectionMonitoringCandidateIdV1;
  workspaceId: string;
  version: 1;
  asset: Readonly<ProductLoopExactReference<TrademarkAssetId>>;
  watchTarget: Readonly<ProductLoopExactReference<WorkspaceWatchTargetId>>;
  applicant: Readonly<DataEngineApplicantCandidateReferenceV1>;
  observedTrademark: Readonly<DataEngineDiscoveredTrademarkCandidateV1>;
  relevance: Readonly<ProtectionMonitoringRelevanceEvidenceV1>;
  candidateFingerprintSha256: string;
  authorityConsequences: typeof noProtectionMonitoringAuthorityConsequencesV1;
  createdAt: string;
  updatedAt: string;
}

export interface ProtectionMonitoringDecisionV1 {
  schemaVersion: 1;
  protectionMonitoringDecisionId: ProtectionMonitoringDecisionIdV1;
  workspaceId: string;
  version: 1;
  candidate: Readonly<ProductLoopExactReference<ProtectionMonitoringCandidateIdV1>>;
  expectedCandidateFingerprintSha256: string;
  disposition: ProtectionMonitoringDispositionV1;
  decidedByPrincipalId: string;
  rationale: string;
  decidedAt: string;
  actionCandidate?: Readonly<ProductLoopExactReference<OpportunityCandidateId>>;
  externalActionExecuted: false;
  legalConclusionCreated: false;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonical(entry)])
    );
  }
  return value;
}

export function protectionMonitoringFingerprintSha256V1(
  value: Omit<ProtectionMonitoringCandidateV1, 'candidateFingerprintSha256'>
): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}
