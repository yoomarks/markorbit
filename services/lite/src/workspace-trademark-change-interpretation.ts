import { createHash } from 'node:crypto';
import type {
  ImplementationBinding,
  SessionReceipt
} from '@markorbit/contracts/capability-runtime';
import {
  MANAGED_AI_EXECUTION_CAPABILITY_ID,
  MANAGED_AI_EXECUTION_CONTRACT_VERSION,
  type ManagedAiExecutionOutcomeV1
} from '@markorbit/contracts/managed-ai-execution';
import type {
  TrademarkAssetManagementRecommendation,
  TrademarkAssetManagementSignal
} from '@markorbit/contracts/trademark-asset-management';
import type {
  TrademarkAssetRelation,
  TrademarkAssetSourceReference
} from '@markorbit/contracts/trademark-asset-workspace';
import { prepareTrademarkAssetManagementRecommendations } from './trademark-asset-management-recommendation.js';

export const WORKSPACE_TRADEMARK_CHANGE_INTERPRETATION_OUTCOME_V1 =
  'workspace-trademark-change-interpretation.v1' as const;

export interface WorkspaceTrademarkChangeManagedAiEvidenceV1 {
  binding: Readonly<ImplementationBinding>;
  receipt: Readonly<SessionReceipt>;
  outcome: Readonly<ManagedAiExecutionOutcomeV1>;
}

export interface WorkspaceTrademarkChangeContextReferenceV1 {
  kind: string;
  referenceId: string;
  referenceVersion?: string;
}

interface WorkspaceTrademarkChangeImplementationSelectionV1 {
  implementationProfileId: string;
  implementationProfileVersion: number;
  implementationKey: string;
  selectionPolicyVersion: string;
  provider: string;
  model: string;
  capabilityRequestId: string;
  implementationBindingId: string;
  sessionReceiptId: string;
}

export interface WorkspaceTrademarkChangeInterpretationV1 {
  schemaVersion: 1;
  outcomeBoundary: typeof WORKSPACE_TRADEMARK_CHANGE_INTERPRETATION_OUTCOME_V1;
  workspaceId: string;
  asset: Readonly<{ id: string; version: number | string }>;
  signal: Readonly<{ id: string; version: number }>;
  sourceEvidence: readonly Readonly<TrademarkAssetSourceReference>[];
  sourceEvidenceFingerprintSha256: string;
  sourceFreshness: TrademarkAssetManagementSignal['freshness'];
  sourceConflictPresent: boolean;
  status: 'INTERPRETED' | 'VERIFICATION_REQUIRED' | 'INTERPRETATION_UNAVAILABLE';
  recommendation: Readonly<TrademarkAssetManagementRecommendation>;
  interpretation: Readonly<{
    source: 'MO_BASE' | 'WORKSPACE_LOCAL' | 'SOURCE_GUARDRAIL' | 'BASE_RECOMMENDATION_ONLY';
    summary: string;
    reviewFocus: string;
  }>;
  implementationSelection?: Readonly<WorkspaceTrademarkChangeImplementationSelectionV1>;
  workspaceContextReferences: readonly Readonly<WorkspaceTrademarkChangeContextReferenceV1>[];
  interpretedAt: string;
  userConfirmationRequired: true;
  authority: Readonly<{
    officialTruthCreated: false;
    legalConclusionCreated: false;
    legalDeadlineCertified: false;
    sourceConflictResolved: false;
    protectedActionAuthorized: false;
    externalActionExecuted: false;
    providerSelectionAuthorityGrantedToCaller: false;
  }>;
}

export interface PrepareWorkspaceTrademarkChangeInterpretationInputV1 {
  signal: Readonly<TrademarkAssetManagementSignal>;
  relatedOwnerReferences?: readonly Readonly<TrademarkAssetRelation>[];
  managedAi?: Readonly<WorkspaceTrademarkChangeManagedAiEvidenceV1>;
  workspaceContextReferences?: readonly Readonly<WorkspaceTrademarkChangeContextReferenceV1>[];
  interpretedAt?: string;
}

const NO_AUTHORITY = {
  officialTruthCreated: false,
  legalConclusionCreated: false,
  legalDeadlineCertified: false,
  sourceConflictResolved: false,
  protectedActionAuthorized: false,
  externalActionExecuted: false,
  providerSelectionAuthorityGrantedToCaller: false
} as const;

function sourceKey(source: Readonly<TrademarkAssetSourceReference>): string {
  return [
    source.owner,
    source.kind,
    source.sourceId,
    source.sourceVersion,
    source.observedAt,
    source.freshness
  ].join(':');
}

function exactEvidence(
  evidence: readonly Readonly<TrademarkAssetSourceReference>[]
): readonly TrademarkAssetSourceReference[] {
  const unique = new Map<string, TrademarkAssetSourceReference>();
  for (const source of evidence) {
    unique.set(sourceKey(source), structuredClone(source));
  }
  return [...unique.values()].sort((a, b) => sourceKey(a).localeCompare(sourceKey(b)));
}

function evidenceFingerprint(evidence: readonly Readonly<TrademarkAssetSourceReference>[]): string {
  return createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
}

function cleanContextReferences(
  references: readonly Readonly<WorkspaceTrademarkChangeContextReferenceV1>[]
): readonly WorkspaceTrademarkChangeContextReferenceV1[] {
  return references
    .map((reference) => {
      const kind = reference.kind.trim();
      const referenceId = reference.referenceId.trim();
      const referenceVersion = reference.referenceVersion?.trim();
      if (!kind || !referenceId || kind.length > 200 || referenceId.length > 500) {
        throw new Error('Workspace context references must be bounded exact references.');
      }
      if (referenceVersion !== undefined && (!referenceVersion || referenceVersion.length > 200)) {
        throw new Error('Workspace context referenceVersion is invalid.');
      }
      return {
        kind,
        referenceId,
        ...(referenceVersion === undefined ? {} : { referenceVersion })
      };
    })
    .sort((a, b) => {
      const left = `${a.kind}:${a.referenceId}:${a.referenceVersion ?? ''}`;
      const right = `${b.kind}:${b.referenceId}:${b.referenceVersion ?? ''}`;
      return left.localeCompare(right);
    });
}

function allAuthorityFalse(authority: object): boolean {
  return Object.values(authority).every((value) => value === false);
}

function assertManagedAiEvidence(
  workspaceId: string,
  managedAi: Readonly<WorkspaceTrademarkChangeManagedAiEvidenceV1>
): WorkspaceTrademarkChangeImplementationSelectionV1 {
  const { binding, receipt, outcome } = managedAi;
  if (receipt.workspaceId !== workspaceId) {
    throw new Error('Managed AI Session Receipt must belong to the same Workspace.');
  }
  if (binding.capabilityRequestId !== receipt.capabilityRequestId) {
    throw new Error('Managed AI binding and Session Receipt must share one capability request.');
  }

  const stableCapability =
    binding.runtimeCapability.capabilityId === MANAGED_AI_EXECUTION_CAPABILITY_ID &&
    binding.runtimeCapability.capabilityVersion === MANAGED_AI_EXECUTION_CONTRACT_VERSION &&
    receipt.runtimeCapability.capabilityId === MANAGED_AI_EXECUTION_CAPABILITY_ID &&
    receipt.runtimeCapability.capabilityVersion === MANAGED_AI_EXECUTION_CONTRACT_VERSION &&
    outcome.capabilityId === MANAGED_AI_EXECUTION_CAPABILITY_ID &&
    outcome.capabilityVersion === MANAGED_AI_EXECUTION_CONTRACT_VERSION;
  if (!stableCapability) {
    throw new Error('Trademark change interpretation may only consume Managed AI Execution.');
  }

  const bindingMatchesReceipt =
    binding.runtimeCapability.id === receipt.runtimeCapability.id &&
    binding.runtimeCapability.version === receipt.runtimeCapability.version &&
    binding.implementation.id === receipt.implementation.id &&
    binding.implementation.version === receipt.implementation.version &&
    binding.implementation.implementationKey === receipt.implementation.implementationKey;
  if (!bindingMatchesReceipt) {
    throw new Error('Managed AI binding and Session Receipt provenance do not match.');
  }
  if (!allAuthorityFalse(receipt.authority) || !allAuthorityFalse(outcome.authority)) {
    throw new Error('Managed AI evidence must remain authority-false.');
  }
  if (outcome.status !== 'COMPLETED' || outcome.provenance === undefined) {
    throw new Error('Completed Managed AI provenance is required for specialized interpretation.');
  }

  const provenance = outcome.provenance;
  const provenanceMatchesBinding =
    provenance.implementationProfileId === binding.implementation.id &&
    provenance.implementationProfileVersion === binding.implementation.version &&
    provenance.implementationKey === binding.implementation.implementationKey;
  if (!provenanceMatchesBinding) {
    throw new Error('Managed AI execution provenance does not match the governed binding.');
  }

  return {
    implementationProfileId: provenance.implementationProfileId,
    implementationProfileVersion: provenance.implementationProfileVersion,
    implementationKey: provenance.implementationKey,
    selectionPolicyVersion: binding.selectionPolicyVersion,
    provider: provenance.provider,
    model: provenance.model,
    capabilityRequestId: binding.capabilityRequestId,
    implementationBindingId: binding.implementationBindingId,
    sessionReceiptId: receipt.sessionReceiptId
  };
}

function parseInterpretationOutput(
  value: unknown
): Readonly<{ summary: string; reviewFocus: string }> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Managed AI trademark interpretation output must be an object.');
  }
  const record = value as Record<string, unknown>;
  const unsupported = Object.keys(record).filter(
    (key) => key !== 'summary' && key !== 'reviewFocus'
  );
  if (unsupported.length > 0) {
    throw new Error(
      `Managed AI trademark interpretation output contains unsupported fields: ${unsupported.join(', ')}.`
    );
  }

  const summary = typeof record.summary === 'string' ? record.summary.trim() : '';
  const reviewFocus = typeof record.reviewFocus === 'string' ? record.reviewFocus.trim() : '';
  if (!summary || !reviewFocus || summary.length > 2000 || reviewFocus.length > 2000) {
    throw new Error('Managed AI summary and reviewFocus must be bounded non-empty strings.');
  }
  return { summary, reviewFocus };
}

function verificationReason(signal: Readonly<TrademarkAssetManagementSignal>): string | undefined {
  if (signal.evidence.length === 0) {
    return 'No exact source evidence is available.';
  }
  if (signal.dimension === 'SOURCE_CONFLICT' || signal.freshness === 'CONFLICTING') {
    return 'Source observations conflict and require source-owner verification.';
  }
  const staleEvidence = signal.evidence.some((source) => source.freshness !== 'CURRENT');
  if (signal.dimension === 'SOURCE_FRESHNESS' || signal.freshness !== 'CURRENT' || staleEvidence) {
    return 'Source evidence is not fully current and requires freshness verification.';
  }
  return undefined;
}

function prepareExistingRecommendation(
  input: Readonly<PrepareWorkspaceTrademarkChangeInterpretationInputV1>,
  interpretedAt: string
): TrademarkAssetManagementRecommendation {
  const recommendations = prepareTrademarkAssetManagementRecommendations({
    signals: [input.signal],
    createdAt: interpretedAt,
    ...(input.relatedOwnerReferences === undefined
      ? {}
      : { relatedOwnerReferences: input.relatedOwnerReferences })
  });
  const recommendation = recommendations[0];
  if (recommendation === undefined) {
    throw new Error('Expected one existing Management Recommendation for the signal.');
  }
  return recommendation;
}

export function prepareWorkspaceTrademarkChangeInterpretationV1(
  input: Readonly<PrepareWorkspaceTrademarkChangeInterpretationInputV1>
): WorkspaceTrademarkChangeInterpretationV1 {
  const interpretedAt = input.interpretedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(interpretedAt))) {
    throw new Error('interpretedAt must be a valid timestamp.');
  }

  const signal = input.signal;
  const sourceEvidence = exactEvidence(signal.evidence);
  const recommendation = prepareExistingRecommendation(input, interpretedAt);
  const base = {
    schemaVersion: 1 as const,
    outcomeBoundary: WORKSPACE_TRADEMARK_CHANGE_INTERPRETATION_OUTCOME_V1,
    workspaceId: signal.workspaceId,
    asset: structuredClone(signal.asset),
    signal: { id: signal.managementSignalId, version: signal.version },
    sourceEvidence,
    sourceEvidenceFingerprintSha256: evidenceFingerprint(sourceEvidence),
    sourceFreshness: signal.freshness,
    sourceConflictPresent:
      signal.dimension === 'SOURCE_CONFLICT' || signal.freshness === 'CONFLICTING',
    recommendation,
    workspaceContextReferences: cleanContextReferences(input.workspaceContextReferences ?? []),
    interpretedAt: new Date(interpretedAt).toISOString(),
    userConfirmationRequired: true as const,
    authority: NO_AUTHORITY
  };

  const guardrail = verificationReason(signal);
  if (guardrail !== undefined) {
    return {
      ...base,
      status: 'VERIFICATION_REQUIRED',
      interpretation: {
        source: 'SOURCE_GUARDRAIL',
        summary: guardrail,
        reviewFocus: 'Verify exact source evidence before further professional reliance.'
      }
    };
  }

  if (input.managedAi === undefined || input.managedAi.outcome.status !== 'COMPLETED') {
    return {
      ...base,
      status: 'INTERPRETATION_UNAVAILABLE',
      interpretation: {
        source: 'BASE_RECOMMENDATION_ONLY',
        summary: recommendation.explanation,
        reviewFocus: 'Use the deterministic Management Recommendation for human review.'
      }
    };
  }

  const implementationSelection = assertManagedAiEvidence(signal.workspaceId, input.managedAi);
  const interpretation = parseInterpretationOutput(input.managedAi.outcome.structuredOutput);
  const workspaceLocal = implementationSelection.selectionPolicyVersion.startsWith(
    'workspace-implementation-preference.'
  );

  return {
    ...base,
    status: 'INTERPRETED',
    interpretation: {
      source: workspaceLocal ? 'WORKSPACE_LOCAL' : 'MO_BASE',
      ...interpretation
    },
    implementationSelection
  };
}

export const workspaceTrademarkChangeInterpretationAuthority = {
  serviceLocalProjectionOnly: true,
  reusesExistingManagementRecommendationOwner: true,
  mayPreserveExactSourceEvidence: true,
  mayExposeGovernedImplementationSelectionProvenance: true,
  mayVaryReviewFocusByGovernedWorkspaceContext: true,
  mayCreateCapabilityId: false,
  mayVerifyOfficialTruth: false,
  mayCreateLegalConclusion: false,
  mayCertifyLegalDeadline: false,
  mayResolveSourceConflict: false,
  mayGrantCallerProviderSelection: false,
  mayAuthorizeProtectedAction: false,
  mayExecuteExternalAction: false,
  mayMutateOwnerDomain: false
} as const;
