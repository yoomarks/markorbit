import { describe, expect, it } from 'vitest';
import type { TrademarkAssetView } from '@markorbit/contracts/trademark-asset-composition';
import { TrademarkAssetAiGuidePreparer } from '../src/trademark-asset-ai-guide.js';

const source = {
  owner: 'MARKREG',
  kind: 'MARKREG_LIFECYCLE_PROJECTION',
  sourceId: 'matter_1',
  sourceVersion: '7',
  observedAt: '2026-08-19T00:00:00.000Z',
  freshness: 'CURRENT'
} as const;

const view: TrademarkAssetView = {
  schemaVersion: 1,
  trademarkAssetId: 'trademark-asset_test',
  workspaceId: '11111111-1111-4111-8111-111111111111',
  anchorVersion: 3,
  anchor: {
    schemaVersion: 1,
    trademarkAssetId: 'trademark-asset_test',
    workspaceId: '11111111-1111-4111-8111-111111111111',
    version: 3,
    identity: { jurisdiction: 'US', markText: 'MARK ORBIT' },
    externalIdentifiers: [],
    workspaceRelationships: [
      { kind: 'REPRESENTED', sourceAssetEditableByWorkspace: true }
    ],
    sourceReferences: [source],
    relations: [],
    workspaceTags: [],
    workspaceNotes: [],
    officialTruthVerifiedByLite: false,
    filingExecutedByLite: false,
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z'
  },
  observedFacts: [
    {
      kind: 'OWNER_NAME',
      value: 'Example Owner',
      source,
      freshness: 'CURRENT',
      consequential: true,
      officialTruthVerifiedByLite: false
    }
  ],
  contextSignals: [
    {
      kind: 'RECOMMENDED_ACTION',
      value: 'Review the next lifecycle step',
      source,
      freshness: 'CURRENT',
      advisory: true,
      executionAuthorized: false
    }
  ],
  conflicts: [],
  sourceReferences: [source],
  freshness: 'CURRENT',
  composedAt: '2026-08-19T00:00:00.000Z',
  officialTruthVerifiedByLite: false,
  legalDeadlineCertified: false,
  protectedActionAuthorized: false
};

describe('TrademarkAssetAiGuidePreparer', () => {
  it('prepares evidence-grounded suggestions without creating authority', () => {
    const preparer = new TrademarkAssetAiGuidePreparer(
      () => '2026-08-19T01:00:00.000Z',
      () => '00000000-0000-4000-8000-000000000001'
    );
    const result = preparer.prepare({
      workspaceId: view.workspaceId,
      subjectUserId: 'user_1',
      view,
      requestedKinds: ['EXPLAIN_ASSET', 'IDENTIFY_MISSING_INFORMATION', 'PREPARE_OWNER_ACTION_CANDIDATE']
    });

    expect(result.suggestions).toHaveLength(3);
    expect(result.evidence).toEqual([source]);
    expect(result.suggestions.every((item) => item.officialTruthVerified === false)).toBe(true);
    expect(result.suggestions.every((item) => item.externalActionAuthorized === false)).toBe(true);
    expect(result.officialTruthCreatedByGuide).toBe(false);
    expect(result.deadlineCertifiedByGuide).toBe(false);
    expect(result.externalActionAuthorizedByGuide).toBe(false);
  });

  it('surfaces stale or conflicting evidence instead of hiding it', () => {
    const preparer = new TrademarkAssetAiGuidePreparer(
      () => '2026-08-19T01:00:00.000Z',
      () => '00000000-0000-4000-8000-000000000002'
    );
    const result = preparer.prepare({
      workspaceId: view.workspaceId,
      subjectUserId: 'user_1',
      view: {
        ...view,
        freshness: 'CONFLICTING',
        conflicts: [
          {
            kind: 'OWNER_NAME',
            values: ['Example Owner', 'Another Owner'],
            evidence: [source],
            unresolved: true
          }
        ]
      },
      requestedKinds: ['PREPARE_CHECKLIST']
    });

    expect(result.staleOrConflictingEvidencePresent).toBe(true);
    expect(result.suggestions[0]?.staleOrConflictingEvidencePresent).toBe(true);
    expect(result.suggestions[0]?.explanation).toContain('unresolved conflicting observations');
  });
});
