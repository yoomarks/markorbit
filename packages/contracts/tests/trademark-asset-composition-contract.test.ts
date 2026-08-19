import { describe, expect, it } from 'vitest';
import {
  trademarkAssetCompositionAuthority,
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
      maySelectOfficialWinnerAcrossConflicts: false,
      mayWriteBackToSourceOwner: false,
      mayUseCrossServiceSql: false,
      mayCreateOfficialStatus: false,
      mayCertifyLegalDeadline: false,
      mayAuthorizeProtectedAction: false
    });
  });

  it('keeps facts separate from later attention and AI judgment', () => {
    expect(trademarkAssetObservedFactKinds).toEqual([
      'APPLICATION_STATUS',
      'APPLICATION_DATE',
      'REGISTRATION_DATE',
      'RENEWAL_DATE',
      'OWNER_NAME',
      'NICE_CLASSES',
      'LIFECYCLE_STAGE',
      'RECOMMENDED_ACTION',
      'KNOWLEDGE_RELEVANCE'
    ]);
  });
});
