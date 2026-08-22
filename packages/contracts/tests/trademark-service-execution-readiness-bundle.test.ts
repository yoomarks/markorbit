import { describe, expect, it } from 'vitest';
import { trademarkServiceOperatorReadinessBundleAuthority } from '../src/trademark-service-execution-readiness-bundle.js';

describe('M15-WP-06 operator readiness bundle authority', () => {
  it('allows review evidence without deployment or production authority', () => {
    expect(trademarkServiceOperatorReadinessBundleAuthority).toEqual({
      mayComposeOperatorReviewEvidence: true,
      maySurfaceUnresolvedHumanActions: true,
      mayApproveDeployment: false,
      mayAuthorizeProductionEnablement: false,
      mayAuthorizeProductionCredentials: false,
      mayAuthorizeLiveExternalAction: false,
      mayCreateOfficialTruth: false,
      mayMutateOwnerDomainTruth: false
    });
  });
});
