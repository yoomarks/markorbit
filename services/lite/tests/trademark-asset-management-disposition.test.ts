import { describe, expect, it } from 'vitest';
import {
  nextTrademarkAssetManagementRecoveryAttempt,
  trademarkAssetManagementDispositionRecoveryAuthority
} from '../src/trademark-asset-management-disposition.js';

describe('M11-WP07 management disposition recovery policy', () => {
  it('backs off internal recovery and dead-letters at the configured ceiling', () => {
    expect(nextTrademarkAssetManagementRecoveryAttempt('2026-08-21T01:00:00.000Z', 0, 5)).toEqual({
      status: 'PENDING',
      attemptCount: 1,
      availableAt: '2026-08-21T01:00:15.000Z'
    });
    expect(nextTrademarkAssetManagementRecoveryAttempt('2026-08-21T01:00:00.000Z', 1, 5)).toEqual({
      status: 'PENDING',
      attemptCount: 2,
      availableAt: '2026-08-21T01:00:30.000Z'
    });
    expect(nextTrademarkAssetManagementRecoveryAttempt('2026-08-21T01:00:00.000Z', 4, 5)).toEqual({
      status: 'DEAD_LETTER',
      attemptCount: 5,
      availableAt: '2026-08-21T01:00:00.000Z'
    });
  });

  it('keeps disposition/watch and recovery permanently non-authoritative', () => {
    expect(trademarkAssetManagementDispositionRecoveryAuthority).toEqual({
      mayPersistPrivateDisposition: true,
      mayMaintainWatchState: true,
      mayRetryInternalProjectionWork: true,
      mayDeadLetterInternalProjectionWork: true,
      mayReplayDeadLetterAfterExplicitInternalRecovery: true,
      mayCreateOfficialTruth: false,
      mayCertifyLegalDeadline: false,
      mayCreateLegalConclusion: false,
      mayAuthorizeFiling: false,
      mayAuthorizeExternalContact: false,
      mayAuthorizePayment: false,
      mayAuthorizeExternalPublication: false,
      mayCreateVerifiedCapability: false,
      mayUseCrossServiceSql: false
    });
  });
});
