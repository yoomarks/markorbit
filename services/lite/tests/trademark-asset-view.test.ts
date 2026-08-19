import { describe, expect, it } from 'vitest';
import type { TrademarkAsset } from '@markorbit/contracts/trademark-asset-workspace';
import {
  composeTrademarkAssetView,
  TrademarkAssetCompositionError
} from '../src/trademark-asset-view.js';

const anchor: TrademarkAsset = {
  schemaVersion: 1,
  trademarkAssetId: 'trademark-asset_wp03',
  workspaceId: '94949494-9494-4949-8949-949494949494',
  version: 3,
  identity: { jurisdiction: 'US', markText: 'MARKORBIT' },
  externalIdentifiers: [],
  workspaceRelationships: [{ kind: 'MANAGED', sourceAssetEditableByWorkspace: false }],
  sourceReferences: [
    {
      owner: 'WORKSPACE_USER',
      kind: 'WORKSPACE_ADMISSION',
      sourceId: 'admission_wp03',
      sourceVersion: '1',
      observedAt: '2026-08-19T02:00:00.000Z',
      freshness: 'CURRENT'
    }
  ],
  relations: [],
  workspaceTags: ['client-a'],
  workspaceNotes: [],
  officialTruthVerifiedByLite: false,
  filingExecutedByLite: false,
  createdAt: '2026-08-19T02:00:00.000Z',
  updatedAt: '2026-08-19T02:05:00.000Z'
};

const markRegSource = {
  owner: 'MARKREG',
  kind: 'MARKREG_LIFECYCLE_PROJECTION',
  sourceId: 'lifecycle_formal-matter_1',
  sourceVersion: '7',
  observedAt: '2026-08-19T02:10:00.000Z',
  freshness: 'CURRENT'
} as const;

const dataEngineSource = {
  owner: 'DATA_ENGINE',
  kind: 'DATA_ENGINE_TRADEMARK_RECORD',
  sourceId: 'us_98123456',
  sourceVersion: '2026-08-19T02:09:00Z',
  observedAt: '2026-08-19T02:09:00.000Z',
  freshness: 'CURRENT'
} as const;

const knowledgeSource = {
  owner: 'KNOWLEDGE',
  kind: 'KNOWLEDGE_SOURCE',
  sourceId: 'knowledge_us-rule-change_1',
  sourceVersion: 'sha256:abc',
  observedAt: '2026-08-19T01:30:00.000Z',
  freshness: 'CURRENT'
} as const;

describe('M10 WP03 Trademark Asset View composition', () => {
  it('composes facts and contextual signals without conflating them', () => {
    const view = composeTrademarkAssetView({
      anchor,
      composedAt: '2026-08-19T02:15:00.000Z',
      facts: [
        {
          kind: 'APPLICATION_STATUS',
          value: 'REGISTERED',
          source: markRegSource,
          consequential: true
        },
        {
          kind: 'APPLICATION_STATUS',
          value: 'REGISTERED',
          source: dataEngineSource,
          consequential: true
        }
      ],
      signals: [
        {
          kind: 'KNOWLEDGE_RELEVANCE',
          value: 'Section 8 maintenance guidance changed',
          source: knowledgeSource
        }
      ]
    });

    expect(view.trademarkAssetId).toBe(anchor.trademarkAssetId);
    expect(view.anchor).toBe(anchor);
    expect(view.observedFacts).toHaveLength(2);
    expect(view.contextSignals).toEqual([
      expect.objectContaining({
        kind: 'KNOWLEDGE_RELEVANCE',
        advisory: true,
        executionAuthorized: false
      })
    ]);
    expect(view.conflicts).toEqual([]);
    expect(view.freshness).toBe('CURRENT');
    expect(view.officialTruthVerifiedByLite).toBe(false);
    expect(view.legalDeadlineCertified).toBe(false);
    expect(view.protectedActionAuthorized).toBe(false);
    expect(view.sourceReferences).toHaveLength(4);
  });

  it('preserves contradictory factual observations instead of selecting a winner', () => {
    const view = composeTrademarkAssetView({
      anchor,
      composedAt: '2026-08-19T02:15:00.000Z',
      facts: [
        {
          kind: 'APPLICATION_STATUS',
          value: 'PENDING',
          source: markRegSource,
          consequential: true
        },
        {
          kind: 'APPLICATION_STATUS',
          value: 'REGISTERED',
          source: dataEngineSource,
          consequential: true
        }
      ]
    });

    expect(view.freshness).toBe('CONFLICTING');
    expect(view.conflicts).toHaveLength(1);
    expect(view.conflicts[0]).toMatchObject({
      kind: 'APPLICATION_STATUS',
      unresolved: true
    });
    expect(view.conflicts[0]?.values).toEqual(['PENDING', 'REGISTERED']);
    expect(view.conflicts[0]?.evidence).toHaveLength(2);
  });

  it('treats arrays with the same members as the same factual observation', () => {
    const view = composeTrademarkAssetView({
      anchor,
      composedAt: '2026-08-19T02:15:00.000Z',
      facts: [
        { kind: 'NICE_CLASSES', value: ['9', '35'], source: markRegSource },
        { kind: 'NICE_CLASSES', value: ['35', '9'], source: dataEngineSource }
      ]
    });

    expect(view.conflicts).toEqual([]);
  });

  it('rejects source owners contributing facts outside their authority', () => {
    expect(() =>
      composeTrademarkAssetView({
        anchor,
        composedAt: '2026-08-19T02:15:00.000Z',
        facts: [{ kind: 'APPLICATION_STATUS', value: 'REGISTERED', source: knowledgeSource }]
      })
    ).toThrowError(TrademarkAssetCompositionError);

    try {
      composeTrademarkAssetView({
        anchor,
        composedAt: '2026-08-19T02:15:00.000Z',
        facts: [{ kind: 'LIFECYCLE_STAGE', value: 'MAINTENANCE', source: dataEngineSource }]
      });
    } catch (error) {
      expect(error).toMatchObject({ code: 'FACT_OWNER_MISMATCH' });
    }
  });

  it('rejects context signals from the wrong owner', () => {
    expect(() =>
      composeTrademarkAssetView({
        anchor,
        composedAt: '2026-08-19T02:15:00.000Z',
        signals: [
          {
            kind: 'KNOWLEDGE_RELEVANCE',
            value: 'Not a Data Engine responsibility',
            source: dataEngineSource
          }
        ]
      })
    ).toThrowError(/cannot contribute context signal/);
  });

  it('rejects mismatched source owner and source kind pairs', () => {
    expect(() =>
      composeTrademarkAssetView({
        anchor,
        composedAt: '2026-08-19T02:15:00.000Z',
        facts: [
          {
            kind: 'APPLICATION_STATUS',
            value: 'REGISTERED',
            source: {
              ...dataEngineSource,
              kind: 'KNOWLEDGE_SOURCE'
            }
          }
        ]
      })
    ).toThrowError(/cannot use source kind/);
  });

  it('is UNKNOWN rather than authoritative when no owner input is available', () => {
    const view = composeTrademarkAssetView({
      anchor,
      composedAt: '2026-08-19T02:15:00.000Z'
    });

    expect(view.freshness).toBe('UNKNOWN');
    expect(view.observedFacts).toEqual([]);
    expect(view.contextSignals).toEqual([]);
  });
});
