import { describe, expect, it } from 'vitest';

import {
  capabilitySourceAdmissionPolicyFingerprintV1,
  materializeCapabilitySourceAdmissionPolicyContentIdentityV1
} from '../src/source-admission-policy-content-provenance.js';
import {
  historicalUsptoOfficialFeeSourceAdmissionPolicyV1,
  promotedCapabilitySourceAdmissionPoliciesV2,
  usptoOfficialFeeSourceAdmissionPolicyV2
} from '../src/uspto-official-fee-production-policy.js';

describe('USPTO official-fee source-admission policy v2', () => {
  it('preserves historical v1 as PILOT and creates a distinct production v2 identity', () => {
    expect(historicalUsptoOfficialFeeSourceAdmissionPolicyV1).toMatchObject({
      policyId: 'source-admission-policy.uspto-official-fee-resolver.v1',
      policyVersion: 1,
      maturityClass: 'PILOT'
    });
    expect(usptoOfficialFeeSourceAdmissionPolicyV2).toMatchObject({
      policyId: 'source-admission-policy.uspto-official-fee-resolver.v2',
      policyVersion: 2,
      maturityClass: 'PRODUCTION_ADMISSIBLE',
      methodCurrentness: 'REQUIRED',
      referenceCurrentness: 'REQUIRED'
    });

    const historicalFingerprint = capabilitySourceAdmissionPolicyFingerprintV1(
      historicalUsptoOfficialFeeSourceAdmissionPolicyV1
    );
    const promotedIdentity = materializeCapabilitySourceAdmissionPolicyContentIdentityV1(
      usptoOfficialFeeSourceAdmissionPolicyV2
    );
    expect(promotedIdentity.policyFingerprintSha256).not.toBe(historicalFingerprint);
    expect(promotedIdentity.policyVersion).toBe(2);
  });

  it('replaces only the exact USPTO binding in the promoted catalog source set', () => {
    expect(
      promotedCapabilitySourceAdmissionPoliciesV2.filter((entry) =>
        entry.policyId.startsWith('source-admission-policy.uspto-official-fee-resolver.')
      )
    ).toEqual([usptoOfficialFeeSourceAdmissionPolicyV2]);
    expect(promotedCapabilitySourceAdmissionPoliciesV2).toHaveLength(4);
  });
});
