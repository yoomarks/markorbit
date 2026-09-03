import {
  currentCapabilitySourceAdmissionPoliciesV1,
  currentCapabilitySourceAdmissionPolicyCatalogV1,
  historicalUsptoOfficialFeeSourceAdmissionPolicyV1,
  usptoOfficialFeeSourceAdmissionPolicyV2
} from './source-admission-policy-catalog.js';

if (historicalUsptoOfficialFeeSourceAdmissionPolicyV1.maturityClass !== 'PILOT') {
  throw new Error('Historical USPTO source-admission policy v1 must remain immutable PILOT truth.');
}
if (usptoOfficialFeeSourceAdmissionPolicyV2.maturityClass !== 'PRODUCTION_ADMISSIBLE') {
  throw new Error('Current USPTO source-admission policy v2 must remain production-admissible.');
}

export {
  historicalUsptoOfficialFeeSourceAdmissionPolicyV1,
  usptoOfficialFeeSourceAdmissionPolicyV2
};

/**
 * Compatibility aliases for the #656 promotion coordinator. After the real #659 approval,
 * the promoted set is the live current catalog rather than a test-only parallel policy universe.
 */
export const promotedCapabilitySourceAdmissionPoliciesV2 =
  currentCapabilitySourceAdmissionPoliciesV1;

export const promotedCapabilitySourceAdmissionPolicyCatalogV2 =
  currentCapabilitySourceAdmissionPolicyCatalogV1;
