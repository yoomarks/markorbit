export const WORKSPACE_PRODUCT_KEYS = [
  'LITE',
  'SITE',
  'MARKREG_DISTRIBUTION',
  'TRADING',
  'API_ACCESS'
] as const;
export type WorkspaceProductKeyV1 = (typeof WORKSPACE_PRODUCT_KEYS)[number];
export type CommercialSubjectScopeV1 = 'USER' | 'WORKSPACE';
export type CommercialSubjectRefV1 =
  | Readonly<{ scope: 'USER'; userId: string }>
  | Readonly<{ scope: 'WORKSPACE'; workspaceId: string }>;

export interface WorkspaceProductInstallationV1 {
  schemaVersion: 1;
  installationId: string;
  workspaceId: string;
  productKey: WorkspaceProductKeyV1;
  version: number;
  status: 'ACTIVE' | 'SUSPENDED' | 'DECOMMISSIONED';
  effectiveAt: string;
  recordedAt: string;
  sourceRef: string;
}
export type EntitlementValueV1 =
  | Readonly<{ kind: 'BOOLEAN'; enabled: boolean }>
  | Readonly<{
      kind: 'QUANTITY';
      quantity: number;
      unit: string;
      aggregation: 'MAX' | 'SUM';
      period?: string;
    }>
  | Readonly<{ kind: 'LEVEL'; level: string; rank: number }>;
export interface EntitlementDefinitionV1 {
  key: string;
  subjectScope: CommercialSubjectScopeV1;
  value: EntitlementValueV1;
}
export interface AssignableBenefitDefinitionV1 {
  benefitKey: string;
  capacity: number;
  entitlements: readonly EntitlementDefinitionV1[];
}
export interface CommercialOfferVersionV1 {
  schemaVersion: 1;
  offerId: string;
  version: number;
  sku: string;
  displayName: string;
  subjectScope: CommercialSubjectScopeV1;
  productKey: WorkspaceProductKeyV1;
  amountMinor: number;
  currency: string;
  billingInterval: 'NONE' | 'MONTH' | 'YEAR' | 'CUSTOM';
  effectiveFrom: string;
  effectiveTo?: string;
  lifecycle: 'DRAFT' | 'PUBLISHED' | 'RETIRED';
  entitlements: readonly EntitlementDefinitionV1[];
  assignableBenefits: readonly AssignableBenefitDefinitionV1[];
  publishedAt?: string;
  recordedAt: string;
}
export interface CommercialAgreementV1 {
  schemaVersion: 1;
  agreementId: string;
  version: number;
  subject: CommercialSubjectRefV1;
  offerId: string;
  offerVersion: number;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED';
  effectiveFrom: string;
  effectiveTo?: string;
  sourceRef: string;
  recordedAt: string;
}
export interface EntitlementGrantV1 {
  schemaVersion: 1;
  grantId: string;
  version: number;
  subject: CommercialSubjectRefV1;
  entitlement: EntitlementDefinitionV1;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED';
  sourceType: 'AGREEMENT' | 'PROMOTION' | 'TRIAL' | 'MANUAL';
  sourceRef: string;
  effectiveFrom: string;
  effectiveTo?: string;
  recordedAt: string;
}
export interface AssignableEntitlementGrantV1 {
  schemaVersion: 1;
  assignableGrantId: string;
  version: number;
  sponsorWorkspaceId: string;
  sourceAgreementId: string;
  benefitKey: string;
  capacity: number;
  entitlements: readonly EntitlementDefinitionV1[];
  status: 'AVAILABLE' | 'ASSIGNED' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED';
  effectiveFrom: string;
  effectiveTo?: string;
  recordedAt: string;
}
export interface EntitlementGrantAssignmentV1 {
  schemaVersion: 1;
  assignmentId: string;
  version: number;
  assignableGrantId: string;
  workspaceId: string;
  membershipId: string;
  userId: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  effectiveFrom: string;
  effectiveTo?: string;
  recordedAt: string;
}
export interface ResolvedEntitlementV1 {
  schemaVersion: 1;
  subject: CommercialSubjectRefV1;
  key: string;
  value: EntitlementValueV1;
  contributingGrantRefs: readonly Readonly<{ grantId: string; version: number }>[];
  resolvedAt: string;
}
export type RatePolicyKindV1 =
  'REFERRAL_COMMISSION' | 'TRADING_FEE' | 'MARKREG_SERVICE_FEE' | 'MGSN_SERVICE_FEE';
export type RateCalculationV1 =
  | Readonly<{ kind: 'FIXED_AMOUNT'; amountMinor: number; currency: string }>
  | Readonly<{ kind: 'PERCENTAGE'; basisPoints: number }>
  | Readonly<{ kind: 'NEGOTIATED'; agreementRef: string }>;
export interface RatePolicyApplicabilityV1 {
  productKey?: WorkspaceProductKeyV1;
  serviceKey?: string;
  channelKey?: string;
  partnerRef?: string;
  relationshipRef?: string;
  referralSourceRef?: string;
}
export interface RatePolicyVersionV1 {
  schemaVersion: 1;
  policyId: string;
  version: number;
  kind: RatePolicyKindV1;
  lifecycle: 'DRAFT' | 'ACTIVE' | 'RETIRED';
  applicability: RatePolicyApplicabilityV1;
  calculation: RateCalculationV1;
  payerRef?: string;
  payeeRef?: string;
  beneficiaryRef?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  sourceRef: string;
  recordedAt: string;
}
export interface AppliedRateSnapshotV1 {
  schemaVersion: 1;
  policyId: string;
  policyVersion: number;
  kind: RatePolicyKindV1;
  calculation: RateCalculationV1;
  basisAmountMinor?: number;
  calculatedAmountMinor?: number;
  currency?: string;
  payerRef?: string;
  payeeRef?: string;
  beneficiaryRef?: string;
  appliedAt: string;
  sourceRef: string;
}
