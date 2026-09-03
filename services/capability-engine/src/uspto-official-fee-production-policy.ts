import {
  CapabilitySourceAdmissionPolicyCatalogV1,
  currentCapabilitySourceAdmissionPoliciesV1,
  type CapabilitySourceAdmissionPolicyEntryV1
} from './source-admission-policy-catalog.js';
import {
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION,
  USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE
} from './uspto-official-fee-resolver-pilot.js';

const USPTO_POLICY_ID_V1 = 'source-admission-policy.uspto-official-fee-resolver.v1';

export const historicalUsptoOfficialFeeSourceAdmissionPolicyV1 = Object.freeze(
  structuredClone(
    currentCapabilitySourceAdmissionPoliciesV1.find(
      (entry) => entry.policyId === USPTO_POLICY_ID_V1
    )!
  )
);

if (historicalUsptoOfficialFeeSourceAdmissionPolicyV1.maturityClass !== 'PILOT') {
  throw new Error('Historical USPTO source-admission policy v1 must remain immutable PILOT truth.');
}

export const usptoOfficialFeeSourceAdmissionPolicyV2 = Object.freeze({
  schemaVersion: 1 as const,
  policyId: 'source-admission-policy.uspto-official-fee-resolver.v2',
  policyVersion: 2,
  maturityClass: 'PRODUCTION_ADMISSIBLE' as const,
  capabilityId: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION.capabilityId,
  capabilityVersion: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION.capabilityVersion,
  implementationProfileId:
    USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.implementationProfileId,
  implementationProfileVersion: USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.version,
  implementationKey: USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.implementationKey,
  inputSchemaId: USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.inputSchemaId,
  outputSchemaId: USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.outputSchemaId,
  allowedCallerProducts: [
    ...USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.allowedCallerProducts
  ],
  maximumRiskClass: USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.maximumRiskClass,
  methodCurrentness: 'REQUIRED' as const,
  referenceCurrentness: 'REQUIRED' as const
}) satisfies Readonly<CapabilitySourceAdmissionPolicyEntryV1>;

export const promotedCapabilitySourceAdmissionPoliciesV2 = Object.freeze([
  ...currentCapabilitySourceAdmissionPoliciesV1.filter(
    (entry) => entry.policyId !== USPTO_POLICY_ID_V1
  ),
  usptoOfficialFeeSourceAdmissionPolicyV2
]);

export const promotedCapabilitySourceAdmissionPolicyCatalogV2 =
  new CapabilitySourceAdmissionPolicyCatalogV1(promotedCapabilitySourceAdmissionPoliciesV2);
