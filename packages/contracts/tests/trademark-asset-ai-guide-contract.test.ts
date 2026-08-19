import { describe, expect, it } from 'vitest';
import {
  trademarkAssetAiGuideContextKinds,
  trademarkAssetAiGuidePreparationAuthority
} from '../src/trademark-asset-ai-guide.js';

describe('Trademark Asset AI Guide contract', () => {
  it('keeps AI preparation assistive and non-authoritative', () => {
    expect(trademarkAssetAiGuideContextKinds).toEqual([
      'ASSET_COMPOSITION',
      'COMMERCE_PROFILE',
      'MARKETPLACE_OVERLAY',
      'WORKSPACE_CONTEXT'
    ]);
    expect(trademarkAssetAiGuidePreparationAuthority).toMatchObject({
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
