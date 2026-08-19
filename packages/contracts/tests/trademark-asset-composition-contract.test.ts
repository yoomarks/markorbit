import { describe, expect, it } from 'vitest';
import {
  trademarkAssetCompositionAuthority,
  trademarkAssetContextSignalKinds,
  trademarkAssetObservedFactKinds
} from '../src/trademark-asset-composition.js';

describe('M10 WP03 Trademark Asset composition contract', () => {
  it('keeps composition read-only and non-authoritative', () => {
    expect(trademarkAssetCompositionAuthority).toEqual({
      mayComposeWorkspaceAnchor: true,
      mayReadMarkRegProjection: true,
      mayReadDataEngineFacts: true,
      mayReadKnowledgeRelevance: true,
      mayPreserveConflictingObservations: true,
      factsAndSignalsRemainDistinct: true,
      maySelectOfficialWinnerAcrossConflicts: false,
      mayWriteBackToSourceOwner: false,
      mayUseCrossServiceSql: false,
      mayCreateOfficialStatus: false,
      mayCertifyLegalDeadline: false,
      mayAuthorizeProtectedAction: false
    });
  });

  it('keeps factual observations separate from advisory context signals', () => {
    expect(trademarkAssetObservedFactKinds).toEqual([
      'APPLICATION_STATUS',
      'APPLICATION_DATE',
      'REGISTRATION_DATE',
      'RENEWAL_DATE',
      'OWNER_NAME',
      'NICE_CLASSES',
      'LIFECYCLE_STAGE'
    ]);
    expect(trademarkAssetContextSignalKinds).toEqual(['RECOMMENDED_ACTION', 'KNOWLEDGE_RELEVANCE']);
  });
});
