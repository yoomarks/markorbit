import type { TrademarkAssetView } from '@markorbit/contracts/trademark-asset-composition';
import { describe, expect, it } from 'vitest';
import {
  deriveTrademarkAssetAttention,
  trademarkAssetAttentionAuthority
} from '../src/trademark-asset-attention.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const source = {
  owner: 'MARKREG',
  kind: 'MARKREG_LIFECYCLE_PROJECTION',
  sourceId: 'lifecycle_1',
  sourceVersion: '7',
  observedAt: '2026-08-20T00:00:00.000Z',
  freshness: 'CURRENT'
} as const;

function view(overrides: Partial<TrademarkAssetView> = {}): TrademarkAssetView {
  return {
    schemaVersion: 1,
    trademarkAssetId: 'trademark-asset_test',
    workspaceId,
    anchorVersion: 3,
    anchor: {
      schemaVersion: 1,
      trademarkAssetId: 'trademark-asset_test',
      workspaceId,
      version: 3,
      identity: { jurisdiction: 'US', markText: 'MARK ORBIT' },
      externalIdentifiers: [],
      workspaceRelationships: [{ kind: 'REPRESENTED', sourceAssetEditableByWorkspace: true }],
      sourceReferences: [source],
      relations: [],
      workspaceTags: [],
      workspaceNotes: [],
      workspacePriority: 'High',
      officialTruthVerifiedByLite: false,
      filingExecutedByLite: false,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-20T00:00:00.000Z'
    },
    observedFacts: [
      {
        kind: 'RENEWAL_DATE',
        value: '2026-09-10',
        source,
        freshness: 'CURRENT',
        consequential: true,
        officialTruthVerifiedByLite: false
      }
    ],
    contextSignals: [
      {
        kind: 'RECOMMENDED_ACTION',
        value: 'Review renewal evidence before preparing the owner-domain next step.',
        source,
        freshness: 'CURRENT',
        advisory: true,
        executionAuthorized: false
      }
    ],
    conflicts: [],
    sourceReferences: [source],
    freshness: 'CURRENT',
    composedAt: '2026-08-20T00:00:00.000Z',
    officialTruthVerifiedByLite: false,
    legalDeadlineCertified: false,
    protectedActionAuthorized: false,
    ...overrides
  };
}

describe('deriveTrademarkAssetAttention', () => {
  it('explains time sensitivity, owner recommendation and explicit user priority without authority escalation', () => {
    const result = deriveTrademarkAssetAttention(view(), '2026-08-20T00:00:00.000Z');

    expect(result.map((item) => item.dimension)).toEqual(
      expect.arrayContaining(['TIME_SENSITIVITY', 'LIFECYCLE_RECOMMENDATION', 'USER_PRIORITY'])
    );
    expect(result.find((item) => item.dimension === 'TIME_SENSITIVITY')?.severity).toBe(
      'URGENT'
    );
    expect(result.every((item) => item.legalDeadlineCertified === false)).toBe(true);
    expect(result.every((item) => item.officialStatusVerifiedByLite === false)).toBe(true);
    expect(result.every((item) => item.executionAuthorized === false)).toBe(true);
  });

  it('keeps stale and missing source context visible rather than manufacturing certainty', () => {
    const result = deriveTrademarkAssetAttention(
      view({
        observedFacts: [],
        contextSignals: [],
        sourceReferences: [],
        freshness: 'STALE',
        anchor: { ...view().anchor, sourceReferences: [] }
      }),
      '2026-08-20T00:00:00.000Z'
    );

    expect(result.map((item) => item.dimension)).toEqual(
      expect.arrayContaining(['SOURCE_FRESHNESS', 'MISSING_CONTEXT'])
    );
  });

  it('freezes the non-executing attention authority boundary', () => {
    expect(trademarkAssetAttentionAuthority.mayCertifyLegalDeadline).toBe(false);
    expect(trademarkAssetAttentionAuthority.mayVerifyOfficialStatus).toBe(false);
    expect(trademarkAssetAttentionAuthority.mayResolveConflictingFacts).toBe(false);
    expect(trademarkAssetAttentionAuthority.mayAuthorizeExecution).toBe(false);
    expect(trademarkAssetAttentionAuthority.mayMutateOwnerDomain).toBe(false);
  });
});
