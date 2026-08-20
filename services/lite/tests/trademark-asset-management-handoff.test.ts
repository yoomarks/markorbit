import type {
  TrademarkAssetManagementRecommendation,
  TrademarkAssetManagementSignal
} from '@markorbit/contracts/trademark-asset-management';
import { describe, expect, it } from 'vitest';
import {
  prepareTrademarkAssetManagementHandoff,
  trademarkAssetManagementHandoffAuthority
} from '../src/trademark-asset-management-handoff.js';

const source = {
  owner: 'MARKREG',
  kind: 'MARKREG_LIFECYCLE_PROJECTION',
  sourceId: 'lifecycle_1',
  sourceVersion: '7',
  observedAt: '2026-08-20T00:00:00.000Z',
  freshness: 'CURRENT'
} as const;

const signal: TrademarkAssetManagementSignal = {
  schemaVersion: 1,
  managementSignalId: 'trademark-asset-management-signal_signal_1',
  workspaceId: '11111111-1111-4111-8111-111111111111',
  version: 3,
  asset: { id: 'trademark-asset_test', version: 3 },
  dimension: 'LIFECYCLE_RELEVANCE',
  severity: 'IMPORTANT',
  reason: 'Owner-domain recommendation exists.',
  changes: [],
  evidence: [source],
  freshness: 'CURRENT',
  generatedAt: '2026-08-20T00:00:00.000Z',
  legalDeadlineCertified: false,
  officialStatusVerifiedByLite: false,
  legalConclusionVerified: false,
  conflictResolvedByLite: false,
  executionAuthorized: false
};

function recommendation(
  kind: TrademarkAssetManagementRecommendation['kind'] = 'PREPARE_OWNER_WORK_CANDIDATE'
): TrademarkAssetManagementRecommendation {
  return {
    schemaVersion: 1,
    recommendationId: `trademark-asset-management-recommendation_${kind.toLowerCase()}`,
    workspaceId: signal.workspaceId,
    version: 3,
    asset: signal.asset,
    signalReferences: [{ id: signal.managementSignalId, version: signal.version }],
    kind,
    title: kind,
    explanation: kind,
    evidence: [source],
    relatedOwnerReferences: [
      { kind: 'MATTER', owner: 'MARKREG', referenceId: 'matter_1', referenceVersion: '4' }
    ],
    staleOrConflictingEvidencePresent: false,
    userConfirmationRequired: true,
    officialTruthVerified: false,
    legalDeadlineCertified: false,
    filingAuthorized: false,
    customerOrProviderContactAuthorized: false,
    externalPublicationAuthorized: false,
    paidExecutionAuthorized: false,
    capabilityVerified: false,
    createdAt: '2026-08-20T00:00:00.000Z'
  };
}

describe('prepareTrademarkAssetManagementHandoff', () => {
  it('routes owner work to an existing Matter when one is referenced', () => {
    const handoff = prepareTrademarkAssetManagementHandoff({
      signal,
      recommendation: recommendation(),
      requestedByUserId: 'user_1',
      userConfirmed: true,
      requestedAt: '2026-08-20T01:00:00.000Z'
    });

    expect(handoff.destination).toBe('MARKREG_MATTER');
    expect(handoff.userConfirmed).toBe(true);
    expect(handoff.evidenceSnapshot).toHaveLength(1);
    expect(handoff.protectedActionAuthorized).toBe(false);
    expect(handoff.filingAuthorized).toBe(false);
    expect(handoff.externalContactAuthorized).toBe(false);
    expect(handoff.paymentAuthorized).toBe(false);
    expect(handoff.publicationAuthorized).toBe(false);
  });

  it('routes verification and Today preparation into Today without authorizing consequence', () => {
    for (const kind of ['VERIFY_SOURCE_OR_DEADLINE', 'PREPARE_TODAY_CANDIDATE'] as const) {
      const handoff = prepareTrademarkAssetManagementHandoff({
        signal,
        recommendation: recommendation(kind),
        requestedByUserId: 'user_1',
        userConfirmed: true,
        requestedAt: '2026-08-20T01:00:00.000Z'
      });
      expect(handoff.destination).toBe('TODAY');
      expect(handoff.protectedActionAuthorized).toBe(false);
    }
  });

  it('rejects disposition-only recommendations as governed handoffs', () => {
    for (const kind of ['WATCH', 'DEFER', 'DISMISS'] as const) {
      expect(() =>
        prepareTrademarkAssetManagementHandoff({
          signal,
          recommendation: recommendation(kind),
          requestedByUserId: 'user_1',
          userConfirmed: true
        })
      ).toThrow(/disposition candidate/);
    }
  });

  it('rejects a recommendation that does not exactly reference the selected signal', () => {
    expect(() =>
      prepareTrademarkAssetManagementHandoff({
        signal,
        recommendation: {
          ...recommendation(),
          signalReferences: [
            { id: 'trademark-asset-management-signal_other', version: signal.version }
          ]
        },
        requestedByUserId: 'user_1',
        userConfirmed: true
      })
    ).toThrow(/exact reference/);
  });

  it('freezes non-authorizing handoff authority', () => {
    expect(trademarkAssetManagementHandoffAuthority.requiresExplicitUserConfirmation).toBe(true);
    expect(trademarkAssetManagementHandoffAuthority.mayAuthorizeProtectedAction).toBe(false);
    expect(trademarkAssetManagementHandoffAuthority.mayAuthorizeFiling).toBe(false);
    expect(trademarkAssetManagementHandoffAuthority.mayAuthorizeExternalContact).toBe(false);
    expect(trademarkAssetManagementHandoffAuthority.mayAuthorizePayment).toBe(false);
    expect(trademarkAssetManagementHandoffAuthority.mayAuthorizePublication).toBe(false);
    expect(trademarkAssetManagementHandoffAuthority.mayBypassOwnerDomainValidation).toBe(false);
  });
});
