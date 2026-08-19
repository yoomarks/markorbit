import { describe, expect, it } from 'vitest';
import {
  trademarkAssetAiGuideContextKinds,
  trademarkAssetAiGuidePreparationAuthority
} from '../src/trademark-asset-ai-guide.js';

describe('Trademark Asset AI Guide contract', () => {
  it('keeps AI preparation assistive, source-derived and non-authoritative', () => {
    expect(trademarkAssetAiGuideContextKinds).toEqual([
      'ASSET_COMPOSITION',
      'COMMERCE_PROFILE',
      'MARKETPLACE_OVERLAY',
      'WORKSPACE_CONTEXT'
    ]);
    expect(trademarkAssetAiGuidePreparationAuthority).toMatchObject({
      pureAdvisoryProjection: true,
      callerSuppliedProvenanceTrusted: false,
      durableGuideHistoryCreated: false,
      commandIdempotencyClaimed: false,
      mayConsumeComposedAssetFacts: true,
      mayConsumeAdvisoryContextSignals: true,
      mayConsumeWorkspacePrivateCommerceContext: true,
      mayConsumeWorkspacePrivateMarketplaceOverlay: true,
      mayExplainEvidence: true,
      mayPrepareChecklist: true,
      mayPrepareContentCandidate: true,
      mayPrepareOwnerActionCandidate: true,
      mayPromoteAiTextToOfficialFact: false,
      mayResolveSourceConflictSilently: false,
      mayCertifyDeadline: false,
      mayVerifyOfficialStatus: false,
      mayMutateTrademarkAssetSourceTruth: false,
      mayMutateMarketplaceSourceListing: false,
      mayFileExternally: false,
      mayContactCustomerOrProvider: false,
      mayAuthorizePaidExecution: false
    });
  });
});
