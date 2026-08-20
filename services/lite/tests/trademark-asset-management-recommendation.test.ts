import type { AiGuideSuggestion } from '@markorbit/contracts/trademark-asset-workspace';
import type { TrademarkAssetManagementSignal } from '@markorbit/contracts/trademark-asset-management';
import { describe, expect, it } from 'vitest';
import {
  prepareTrademarkAssetManagementRecommendations,
  trademarkAssetManagementRecommendationAuthority
} from '../src/trademark-asset-management-recommendation.js';

const source = {
  owner: 'MARKREG',
  kind: 'MARKREG_LIFECYCLE_PROJECTION',
  sourceId: 'lifecycle_1',
  sourceVersion: '7',
  observedAt: '2026-08-20T00:00:00.000Z',
  freshness: 'CURRENT'
} as const;

function signal(
  dimension: TrademarkAssetManagementSignal['dimension'],
  id: string,
  freshness: TrademarkAssetManagementSignal['freshness'] = 'CURRENT'
): TrademarkAssetManagementSignal {
  return {
    schemaVersion: 1,
    managementSignalId: `trademark-asset-management-signal_${id}`,
    workspaceId: '11111111-1111-4111-8111-111111111111',
    version: 3,
    asset: { id: 'trademark-asset_test', version: 3 },
    dimension,
    severity: 'IMPORTANT',
    reason: `Reason for ${dimension}`,
    changes: [],
    evidence: [{ ...source, freshness }],
    freshness,
    generatedAt: '2026-08-20T00:00:00.000Z',
    legalDeadlineCertified: false,
    officialStatusVerifiedByLite: false,
    legalConclusionVerified: false,
    conflictResolvedByLite: false,
    executionAuthorized: false
  };
}

function aiSuggestion(kind: AiGuideSuggestion['kind']): AiGuideSuggestion {
  return {
    schemaVersion: 1,
    aiGuideSuggestionId: `ai-guide-suggestion_${kind.toLowerCase()}`,
    workspaceId: '11111111-1111-4111-8111-111111111111',
    version: 3,
    asset: { id: 'trademark-asset_test', version: 3 },
    kind,
    title: kind,
    explanation: kind,
    evidence: [source],
    staleOrConflictingEvidencePresent: false,
    userConfirmationRequiredForAnyConsequence: true,
    externalActionAuthorized: false,
    filingAuthorized: false,
    customerOrProviderContactAuthorized: false,
    paidExecutionAuthorized: false,
    capabilityVerified: false,
    officialTruthVerified: false,
    createdAt: '2026-08-20T00:00:00.000Z'
  };
}

describe('prepareTrademarkAssetManagementRecommendations', () => {
  it('maps observed-date and conflict signals to source verification without certifying a deadline', () => {
    const recommendations = prepareTrademarkAssetManagementRecommendations({
      signals: [
        signal('OBSERVED_DATE_PROXIMITY', 'date'),
        signal('SOURCE_CONFLICT', 'conflict', 'CONFLICTING')
      ],
      createdAt: '2026-08-20T00:00:00.000Z'
    });

    expect(recommendations.map((item) => item.kind)).toEqual([
      'VERIFY_SOURCE_OR_DEADLINE',
      'VERIFY_SOURCE_OR_DEADLINE'
    ]);
    expect(recommendations.every((item) => item.userConfirmationRequired)).toBe(true);
    expect(recommendations.every((item) => item.legalDeadlineCertified === false)).toBe(true);
    expect(recommendations.every((item) => item.filingAuthorized === false)).toBe(true);
  });

  it('uses matching bounded AI Guide context to prepare owner-work or Content candidates only', () => {
    const recommendations = prepareTrademarkAssetManagementRecommendations({
      signals: [
        signal('LIFECYCLE_RELEVANCE', 'lifecycle'),
        signal('KNOWLEDGE_CHANGE_RELEVANCE', 'knowledge')
      ],
      aiGuideSuggestions: [
        aiSuggestion('PREPARE_OWNER_ACTION_CANDIDATE'),
        aiSuggestion('PREPARE_CONTENT_CANDIDATE')
      ],
      relatedOwnerReferences: [
        { kind: 'MATTER', owner: 'MARKREG', referenceId: 'matter_1', referenceVersion: '4' }
      ],
      createdAt: '2026-08-20T00:00:00.000Z'
    });

    expect(recommendations.map((item) => item.kind)).toEqual([
      'PREPARE_OWNER_WORK_CANDIDATE',
      'PREPARE_CONTENT_CANDIDATE'
    ]);
    expect(recommendations[0]?.relatedOwnerReferences[0]?.referenceId).toBe('matter_1');
    expect(recommendations.every((item) => item.paidExecutionAuthorized === false)).toBe(true);
    expect(recommendations.every((item) => item.externalPublicationAuthorized === false)).toBe(
      true
    );
  });

  it('rejects mixed Workspace or Asset signal input', () => {
    const other = {
      ...signal('USER_PRIORITY', 'other'),
      workspaceId: '22222222-2222-4222-8222-222222222222'
    } satisfies TrademarkAssetManagementSignal;

    expect(() =>
      prepareTrademarkAssetManagementRecommendations({
        signals: [signal('USER_PRIORITY', 'one'), other]
      })
    ).toThrow(/one Workspace Trademark Asset/);
  });

  it('freezes non-executing recommendation authority', () => {
    expect(trademarkAssetManagementRecommendationAuthority.mayVerifyOfficialTruth).toBe(false);
    expect(trademarkAssetManagementRecommendationAuthority.mayCertifyLegalDeadline).toBe(false);
    expect(trademarkAssetManagementRecommendationAuthority.mayResolveConflict).toBe(false);
    expect(trademarkAssetManagementRecommendationAuthority.mayAuthorizeFiling).toBe(false);
    expect(trademarkAssetManagementRecommendationAuthority.mayAuthorizeExternalContact).toBe(false);
    expect(trademarkAssetManagementRecommendationAuthority.mayAuthorizePayment).toBe(false);
    expect(trademarkAssetManagementRecommendationAuthority.mayAuthorizePublication).toBe(false);
  });
});
