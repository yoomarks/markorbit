import type { TrademarkAssetView } from '@markorbit/contracts/trademark-asset-composition';
import type { TrademarkAssetRefreshRun } from '../src/trademark-asset-refresh.js';
import { describe, expect, it } from 'vitest';
import {
  deriveRepeatedPortfolioConditionSignals,
  deriveTrademarkAssetManagementSignals,
  trademarkAssetManagementSignalAuthority
} from '../src/trademark-asset-management-signal.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const lifecycleSource = {
  owner: 'MARKREG',
  kind: 'MARKREG_LIFECYCLE_PROJECTION',
  sourceId: 'lifecycle_signal_1',
  sourceVersion: '7',
  observedAt: '2026-08-20T00:00:00.000Z',
  freshness: 'CURRENT'
} as const;
const knowledgeSource = {
  owner: 'KNOWLEDGE',
  kind: 'KNOWLEDGE_SOURCE',
  sourceId: 'knowledge_signal_1',
  sourceVersion: '3',
  observedAt: '2026-08-20T01:00:00.000Z',
  freshness: 'CURRENT'
} as const;

function view(
  assetId = 'trademark-asset_test',
  overrides: Partial<TrademarkAssetView> = {}
): TrademarkAssetView {
  return {
    schemaVersion: 1,
    trademarkAssetId: assetId as TrademarkAssetView['trademarkAssetId'],
    workspaceId,
    anchorVersion: 3,
    anchor: {
      schemaVersion: 1,
      trademarkAssetId: assetId as TrademarkAssetView['trademarkAssetId'],
      workspaceId,
      version: 3,
      identity: { jurisdiction: 'US', markText: 'MARK ORBIT' },
      externalIdentifiers: [],
      workspaceRelationships: [{ kind: 'REPRESENTED', sourceAssetEditableByWorkspace: true }],
      sourceReferences: [lifecycleSource, knowledgeSource],
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
        source: lifecycleSource,
        freshness: 'CURRENT',
        consequential: true,
        officialTruthVerifiedByLite: false
      }
    ],
    contextSignals: [
      {
        kind: 'RECOMMENDED_ACTION',
        value: 'Review renewal evidence before preparing the next owner-domain step.',
        source: lifecycleSource,
        freshness: 'CURRENT',
        advisory: true,
        executionAuthorized: false
      },
      {
        kind: 'KNOWLEDGE_RELEVANCE',
        value: 'A newly observed source/rule update may be relevant to this Asset.',
        source: knowledgeSource,
        freshness: 'CURRENT',
        advisory: true,
        executionAuthorized: false
      }
    ],
    conflicts: [],
    sourceReferences: [lifecycleSource, knowledgeSource],
    freshness: 'CURRENT',
    composedAt: '2026-08-20T02:00:00.000Z',
    officialTruthVerifiedByLite: false,
    legalDeadlineCertified: false,
    protectedActionAuthorized: false,
    ...overrides
  };
}

function refresh(assetId = 'trademark-asset_test'): TrademarkAssetRefreshRun {
  return {
    schemaVersion: 1,
    refreshRunId: 'trademark-asset-refresh_signal-test',
    workspaceId,
    trademarkAssetId: assetId as TrademarkAssetRefreshRun['trademarkAssetId'],
    sourceOwnerScope: ['MARKREG', 'KNOWLEDGE'],
    observations: [lifecycleSource, knowledgeSource],
    changes: [
      {
        kind: 'OBSERVATION_CHANGED',
        sourceReferences: [lifecycleSource],
        previousSourceVersion: '6',
        currentSourceVersion: '7',
        observedAt: '2026-08-20T02:00:00.000Z',
        freshness: 'CURRENT'
      },
      {
        kind: 'OBSERVATION_CHANGED',
        sourceReferences: [knowledgeSource],
        previousSourceVersion: '2',
        currentSourceVersion: '3',
        observedAt: '2026-08-20T02:00:00.000Z',
        freshness: 'CURRENT'
      }
    ],
    refreshedAt: '2026-08-20T02:00:00.000Z',
    officialTruthVerifiedByLite: false,
    legalDeadlineCertified: false,
    conflictResolvedByLite: false,
    executionAuthorized: false
  };
}

describe('M11-WP03 proactive Trademark Asset management signals', () => {
  it('derives observed-date, lifecycle, Knowledge and user-priority signals with refresh evidence', () => {
    const result = deriveTrademarkAssetManagementSignals(
      view(),
      refresh(),
      '2026-08-20T00:00:00.000Z'
    );

    expect(result.map((item) => item.dimension)).toEqual(
      expect.arrayContaining([
        'OBSERVED_DATE_PROXIMITY',
        'LIFECYCLE_RELEVANCE',
        'KNOWLEDGE_CHANGE_RELEVANCE',
        'USER_PRIORITY'
      ])
    );
    expect(result.find((item) => item.dimension === 'OBSERVED_DATE_PROXIMITY')?.severity).toBe(
      'URGENT'
    );
    expect(result.find((item) => item.dimension === 'LIFECYCLE_RELEVANCE')?.changes).toHaveLength(1);
    expect(result.find((item) => item.dimension === 'KNOWLEDGE_CHANGE_RELEVANCE')?.changes).toHaveLength(1);
    expect(result.every((item) => item.legalDeadlineCertified === false)).toBe(true);
    expect(result.every((item) => item.officialStatusVerifiedByLite === false)).toBe(true);
    expect(result.every((item) => item.legalConclusionVerified === false)).toBe(true);
    expect(result.every((item) => item.conflictResolvedByLite === false)).toBe(true);
    expect(result.every((item) => item.executionAuthorized === false)).toBe(true);
  });

  it('surfaces stale consequential context and unresolved conflict instead of manufacturing certainty', () => {
    const staleSource = { ...lifecycleSource, freshness: 'STALE' as const };
    const result = deriveTrademarkAssetManagementSignals(
      view('trademark-asset_stale', {
        observedFacts: [
          {
            kind: 'APPLICATION_STATUS',
            value: 'PENDING',
            source: staleSource,
            freshness: 'STALE',
            consequential: true,
            officialTruthVerifiedByLite: false
          }
        ],
        contextSignals: [],
        conflicts: [
          {
            kind: 'APPLICATION_STATUS',
            values: ['PENDING', 'REGISTERED'],
            evidence: [staleSource, lifecycleSource],
            unresolved: true
          }
        ],
        sourceReferences: [staleSource, lifecycleSource],
        freshness: 'CONFLICTING',
        anchor: {
          ...view().anchor,
          trademarkAssetId: 'trademark-asset_stale',
          workspacePriority: undefined,
          sourceReferences: [staleSource, lifecycleSource]
        }
      }),
      undefined,
      '2026-08-20T00:00:00.000Z'
    );

    expect(result.map((item) => item.dimension)).toEqual(
      expect.arrayContaining(['SOURCE_FRESHNESS', 'SOURCE_CONFLICT'])
    );
    expect(result.find((item) => item.dimension === 'SOURCE_CONFLICT')?.reason).toContain(
      'keeps the conflict unresolved'
    );
  });

  it('surfaces missing consequential context without converting advisory context into facts', () => {
    const result = deriveTrademarkAssetManagementSignals(
      view('trademark-asset_missing', {
        observedFacts: [],
        anchor: {
          ...view().anchor,
          trademarkAssetId: 'trademark-asset_missing',
          workspacePriority: undefined
        }
      }),
      undefined,
      '2026-08-20T00:00:00.000Z'
    );

    expect(result.some((item) => item.dimension === 'MISSING_CONSEQUENTIAL_CONTEXT')).toBe(true);
    expect(result.some((item) => item.dimension === 'LIFECYCLE_RELEVANCE')).toBe(true);
  });

  it('rejects a refresh run from another Asset or Workspace', () => {
    expect(() =>
      deriveTrademarkAssetManagementSignals(
        view(),
        { ...refresh(), trademarkAssetId: 'trademark-asset_other' },
        '2026-08-20T00:00:00.000Z'
      )
    ).toThrow('same Workspace Trademark Asset');
  });

  it('emits a repeated portfolio pattern only when at least three Assets already share evidence-backed signals', () => {
    const entries = ['one', 'two', 'three'].map((suffix) => {
      const assetView = view(`trademark-asset_${suffix}`);
      return {
        view: assetView,
        signals: deriveTrademarkAssetManagementSignals(
          assetView,
          undefined,
          '2026-08-20T00:00:00.000Z'
        )
      };
    });

    const pattern = deriveRepeatedPortfolioConditionSignals(
      entries,
      'OBSERVED_DATE_PROXIMITY',
      '2026-08-20T00:00:00.000Z'
    );
    expect(pattern).toHaveLength(3);
    expect(pattern.every((item) => item.dimension === 'PORTFOLIO_PATTERN')).toBe(true);
    expect(pattern.every((item) => item.legalConclusionVerified === false)).toBe(true);

    expect(
      deriveRepeatedPortfolioConditionSignals(
        entries.slice(0, 2),
        'OBSERVED_DATE_PROXIMITY',
        '2026-08-20T00:00:00.000Z'
      )
    ).toEqual([]);
  });

  it('freezes the non-authoritative management signal boundary', () => {
    expect(trademarkAssetManagementSignalAuthority.mayCertifyLegalDeadline).toBe(false);
    expect(trademarkAssetManagementSignalAuthority.mayVerifyOfficialStatus).toBe(false);
    expect(trademarkAssetManagementSignalAuthority.mayFormLegalConclusion).toBe(false);
    expect(trademarkAssetManagementSignalAuthority.mayResolveSourceConflict).toBe(false);
    expect(trademarkAssetManagementSignalAuthority.mayAuthorizeExecution).toBe(false);
    expect(trademarkAssetManagementSignalAuthority.mayMutateOwnerDomain).toBe(false);
  });
});
