import { describe, expect, it } from 'vitest';
import {
  aiGuideSuggestionKinds,
  noAutomaticTrademarkAssetConsequences,
  trademarkAssetAiGuideAuthority,
  trademarkAssetAttentionDimensions,
  trademarkAssetAttentionSeverities,
  trademarkAssetAuthorityBoundary,
  trademarkAssetFreshnessStates,
  trademarkAssetRelationKinds,
  trademarkAssetSourceKinds,
  trademarkAssetSourceOwners,
  type AiGuideContext,
  type AiGuideSuggestion,
  type TrademarkAsset,
  type TrademarkAssetAttentionSignal
} from '../src/trademark-asset-workspace.js';

const workspaceId = 'workspace_m10-wp01';
const observedAt = '2026-08-19T00:00:00.000Z';
const markregLifecycleSource = {
  owner: 'MARKREG',
  kind: 'MARKREG_LIFECYCLE_PROJECTION',
  sourceId: 'lifecycle_m10-wp01',
  sourceVersion: '4',
  sourceFingerprintSha256: 'a'.repeat(64),
  observedAt,
  freshness: 'CURRENT'
} as const;
const knowledgeSource = {
  owner: 'KNOWLEDGE',
  kind: 'KNOWLEDGE_SOURCE',
  sourceId: 'ready-package_m10-wp01',
  sourceVersion: '1.1',
  sourceFingerprintSha256: 'b'.repeat(64),
  observedAt,
  freshness: 'CURRENT'
} as const;
const dataSource = {
  owner: 'DATA_ENGINE',
  kind: 'DATA_ENGINE_TRADEMARK_RECORD',
  sourceId: 'data-record_m10-wp01',
  sourceVersion: '2026-08-18',
  observedAt,
  freshness: 'CURRENT'
} as const;

const asset = {
  schemaVersion: 1,
  trademarkAssetId: 'trademark-asset_m10-wp01',
  workspaceId,
  version: 1,
  identity: {
    jurisdiction: 'US',
    applicationNumber: '98123456',
    registrationNumber: '7654321',
    markText: 'MARKORBIT'
  },
  niceClasses: ['35', '42'],
  ownerOrClientReference: 'client_private-001',
  applicationDate: '2024-01-02',
  registrationDate: '2025-06-03',
  sourceObservedStatus: 'REGISTERED',
  sourceReferences: [markregLifecycleSource, dataSource],
  relations: [
    {
      kind: 'LIFECYCLE_PROJECTION',
      owner: 'MARKREG',
      referenceId: 'lifecycle_m10-wp01',
      referenceVersion: '4'
    },
    {
      kind: 'DATA_RECORD',
      owner: 'DATA_ENGINE',
      referenceId: 'data-record_m10-wp01',
      referenceVersion: '2026-08-18'
    }
  ],
  workspaceTags: ['priority-client'],
  workspaceNotes: ['Private working note.'],
  officialTruthVerifiedByLite: false,
  filingExecutedByLite: false,
  createdAt: observedAt,
  updatedAt: observedAt
} as const satisfies TrademarkAsset;

const attention = {
  schemaVersion: 1,
  attentionSignalId: 'trademark-asset-attention_m10-wp01',
  workspaceId,
  version: 1,
  asset: { id: asset.trademarkAssetId, version: asset.version },
  dimension: 'SOURCE_FRESHNESS',
  severity: 'IMPORTANT',
  reason: 'A source should be refreshed before relying on the projected status.',
  evidence: [markregLifecycleSource],
  generatedAt: observedAt,
  legalDeadlineCertified: false,
  officialStatusVerifiedByLite: false,
  executionAuthorized: false
} as const satisfies TrademarkAssetAttentionSignal;

const context = {
  schemaVersion: 1,
  workspaceId,
  subjectUserId: 'user_m10-wp01',
  asset: { id: asset.trademarkAssetId, version: asset.version },
  sourceReferences: [markregLifecycleSource, knowledgeSource, dataSource],
  relatedOwnerReferences: asset.relations,
  freshness: 'CURRENT',
  compiledAt: observedAt,
  permissionScopeVerified: true
} as const satisfies AiGuideContext;

const suggestion = {
  schemaVersion: 1,
  aiGuideSuggestionId: 'ai-guide-suggestion_m10-wp01',
  workspaceId,
  version: 1,
  asset: { id: asset.trademarkAssetId, version: asset.version },
  kind: 'PREPARE_OWNER_ACTION_CANDIDATE',
  title: 'Review the current lifecycle recommendation',
  explanation: 'Prepare a bounded owner action candidate; do not execute it automatically.',
  evidence: [markregLifecycleSource, knowledgeSource],
  staleOrConflictingEvidencePresent: false,
  userConfirmationRequiredForAnyConsequence: true,
  externalActionAuthorized: false,
  filingAuthorized: false,
  customerOrProviderContactAuthorized: false,
  paidExecutionAuthorized: false,
  officialTruthVerified: false,
  capabilityVerified: false,
  createdAt: observedAt
} as const satisfies AiGuideSuggestion;

describe('M10-WP-01 Trademark Asset Workspace contracts', () => {
  it('freezes source, freshness, relation, attention and AI Guide vocabulary', () => {
    expect(trademarkAssetSourceOwners).toContain('DATA_ENGINE');
    expect(trademarkAssetSourceOwners).toContain('WORKSPACE_USER');
    expect(trademarkAssetSourceKinds).toContain('MARKREG_LIFECYCLE_PROJECTION');
    expect(trademarkAssetSourceKinds).toContain('DATA_ENGINE_TRADEMARK_RECORD');
    expect(trademarkAssetSourceKinds).toContain('WORKSPACE_ADMISSION');
    expect(trademarkAssetFreshnessStates).toContain('CONFLICTING');
    expect(trademarkAssetRelationKinds).toContain('MATTER');
    expect(trademarkAssetAttentionDimensions).toContain('SOURCE_FRESHNESS');
    expect(trademarkAssetAttentionDimensions).toContain('LIFECYCLE_RECOMMENDATION');
    expect(trademarkAssetAttentionSeverities).toEqual(['INFO', 'NOTICE', 'IMPORTANT', 'URGENT']);
    expect(aiGuideSuggestionKinds).toContain('SUMMARIZE_OWNER_CONTEXT');
    expect(aiGuideSuggestionKinds).toContain('PREPARE_OWNER_ACTION_CANDIDATE');
  });

  it('keeps the Asset a private projection instead of official or execution truth', () => {
    expect(asset.identity.registrationNumber).toBe('7654321');
    expect(asset.relations[0]?.owner).toBe('MARKREG');
    expect(asset.relations[1]?.owner).toBe('DATA_ENGINE');
    expect(asset.officialTruthVerifiedByLite).toBe(false);
    expect(asset.filingExecutedByLite).toBe(false);
    expect(trademarkAssetAuthorityBoundary).toMatchObject({
      assetIsWorkspacePrivateProjection: true,
      exactSourceAndFreshnessRequiredForConsequentialClaims: true,
      markRegRemainsMatterAndLifecycleOwner: true,
      executionRemainsProtectedActionOwner: true,
      dataEngineConsumptionReadOnlyAndContractBound: true,
      knowledgeRemainsAcquisitionAndProvenanceOwner: true,
      crossServiceSqlAllowed: false,
      assetCreatesOfficialTruth: false,
      assetCreatesMatterAutomatically: false
    });
  });

  it('keeps attention explainable and unable to certify deadlines, status or execution', () => {
    expect(attention.reason).toContain('source');
    expect(attention.evidence[0]?.sourceId).toBe('lifecycle_m10-wp01');
    expect(attention.legalDeadlineCertified).toBe(false);
    expect(attention.officialStatusVerifiedByLite).toBe(false);
    expect(attention.executionAuthorized).toBe(false);
    expect(trademarkAssetAuthorityBoundary.attentionCertifiesDeadline).toBe(false);
  });

  it('requires permission-safe context and preserves visible freshness', () => {
    expect(context.permissionScopeVerified).toBe(true);
    expect(context.freshness).toBe('CURRENT');
    expect(context.sourceReferences.map((source) => source.owner)).toEqual([
      'MARKREG',
      'KNOWLEDGE',
      'DATA_ENGINE'
    ]);
  });

  it('allows AI to prepare candidates but never grants protected consequences', () => {
    expect(trademarkAssetAiGuideAuthority.mayPrepareOwnerActionCandidate).toBe(true);
    expect(trademarkAssetAiGuideAuthority.maySummarizeOwnerContext).toBe(true);
    expect(trademarkAssetAiGuideAuthority.mayCertifyDeadline).toBe(false);
    expect(trademarkAssetAiGuideAuthority.mayVerifyOfficialStatus).toBe(false);
    expect(trademarkAssetAiGuideAuthority.mayFileExternally).toBe(false);
    expect(trademarkAssetAiGuideAuthority.mayContactCustomerOrProvider).toBe(false);
    expect(trademarkAssetAiGuideAuthority.mayCreateVerifiedCapability).toBe(false);
    expect(trademarkAssetAiGuideAuthority.mayAuthorizePaidExecution).toBe(false);
    expect(trademarkAssetAiGuideAuthority.mayBypassOwnerDomainValidation).toBe(false);
    expect(trademarkAssetAuthorityBoundary.aiGuideExecutesProtectedAction).toBe(false);
    expect(trademarkAssetAuthorityBoundary.aiGuideVerifiesCapability).toBe(false);
    expect(suggestion.userConfirmationRequiredForAnyConsequence).toBe(true);
    expect(suggestion.externalActionAuthorized).toBe(false);
    expect(suggestion.filingAuthorized).toBe(false);
    expect(suggestion.customerOrProviderContactAuthorized).toBe(false);
    expect(suggestion.paidExecutionAuthorized).toBe(false);
    expect(suggestion.officialTruthVerified).toBe(false);
    expect(suggestion.capabilityVerified).toBe(false);
  });

  it('locks automatic Matter, filing, paid execution, Capability and Official Truth consequences out', () => {
    expect(noAutomaticTrademarkAssetConsequences).toContain('ORDER_OR_MATTER_CREATION');
    expect(noAutomaticTrademarkAssetConsequences).toContain('FILING_SUBMISSION');
    expect(noAutomaticTrademarkAssetConsequences).toContain('PAID_EXECUTION');
    expect(noAutomaticTrademarkAssetConsequences).toContain('CAPABILITY_VERIFICATION');
    expect(noAutomaticTrademarkAssetConsequences).toContain('OFFICIAL_TRUTH_CREATION');
  });
});
