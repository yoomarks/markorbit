import { describe, expect, it } from 'vitest';
import {
  noAutomaticTrademarkAssetManagementConsequences,
  trademarkAssetManagementAuthority,
  trademarkAssetManagementDispositionKinds,
  trademarkAssetManagementHandoffDestinations,
  trademarkAssetManagementRecommendationKinds,
  trademarkAssetManagementSignalDimensions
} from '../src/trademark-asset-management.js';

describe('M11 Trademark Asset management contracts', () => {
  it('freezes the initial proactive management vocabulary', () => {
    expect(trademarkAssetManagementSignalDimensions).toEqual(
      expect.arrayContaining([
        'OBSERVED_DATE_PROXIMITY',
        'SOURCE_FRESHNESS',
        'MISSING_CONSEQUENTIAL_CONTEXT',
        'SOURCE_CONFLICT',
        'LIFECYCLE_RELEVANCE',
        'KNOWLEDGE_CHANGE_RELEVANCE',
        'USER_PRIORITY',
        'PORTFOLIO_PATTERN'
      ])
    );
    expect(trademarkAssetManagementRecommendationKinds).toEqual(
      expect.arrayContaining([
        'VERIFY_SOURCE_OR_DEADLINE',
        'GATHER_MISSING_INFORMATION',
        'REVIEW_LIFECYCLE_RECOMMENDATION',
        'PREPARE_OWNER_WORK_CANDIDATE',
        'WATCH',
        'DEFER',
        'DISMISS'
      ])
    );
    expect(trademarkAssetManagementDispositionKinds).toEqual(
      expect.arrayContaining(['WATCHED', 'DEFERRED', 'DISMISSED', 'CONTINUED'])
    );
    expect(trademarkAssetManagementHandoffDestinations).toEqual(
      expect.arrayContaining(['TODAY', 'WORK', 'MARKREG_MATTER', 'EXECUTION_REVIEW'])
    );
  });

  it('keeps Product management separate from legal and execution authority', () => {
    expect(trademarkAssetManagementAuthority.mayDetectSourceOwnedChange).toBe(true);
    expect(trademarkAssetManagementAuthority.mayPrepareReviewableRecommendation).toBe(true);
    expect(trademarkAssetManagementAuthority.mayPrepareGovernedHandoffAfterUserConfirmation).toBe(
      true
    );
    expect(trademarkAssetManagementAuthority.mayCertifyLegalDeadline).toBe(false);
    expect(trademarkAssetManagementAuthority.mayVerifyOfficialStatus).toBe(false);
    expect(trademarkAssetManagementAuthority.mayCreateLegalConclusion).toBe(false);
    expect(trademarkAssetManagementAuthority.mayResolveSourceConflict).toBe(false);
    expect(trademarkAssetManagementAuthority.mayFileExternally).toBe(false);
    expect(trademarkAssetManagementAuthority.mayContactCustomerProviderOrAuthority).toBe(false);
    expect(trademarkAssetManagementAuthority.mayAuthorizePayment).toBe(false);
    expect(trademarkAssetManagementAuthority.mayPublishExternally).toBe(false);
    expect(trademarkAssetManagementAuthority.mayCreateVerifiedCapability).toBe(false);
    expect(trademarkAssetManagementAuthority.mayBypassOwnerDomainValidation).toBe(false);
    expect(trademarkAssetManagementAuthority.mayUseCrossServiceSql).toBe(false);
  });

  it('enumerates prohibited automatic consequences', () => {
    expect(noAutomaticTrademarkAssetManagementConsequences).toEqual(
      expect.arrayContaining([
        'OFFICIAL_STATUS_VERIFICATION',
        'DEADLINE_CERTIFICATION',
        'LEGAL_CONCLUSION',
        'CONFLICT_RESOLUTION',
        'FILING_SUBMISSION',
        'PAYMENT',
        'EXTERNAL_PUBLICATION',
        'CAPABILITY_VERIFICATION'
      ])
    );
  });
});
