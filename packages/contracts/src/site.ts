import type { CommercialProductId } from './commercial.js';
import type { Channel, RelationshipModel } from './index.js';

export type SiteIdV1 = `site_${string}`;
export type SiteHostBindingIdV1 = `site_host_${string}`;
export type SiteKindV1 = 'MARKREG_REFERENCE' | 'WORKSPACE_BRANDED';
export type SiteLifecycleV1 = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'DECOMMISSIONED';
export type SiteHostBindingTypeV1 = 'PRIMARY' | 'ALIAS' | 'TEST';
export type SiteHostBindingStatusV1 =
  'PENDING_VERIFICATION' | 'VERIFIED' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
export type SiteFulfillmentModeV1 = 'SELF' | 'MARKREG' | 'GOVERNED_NETWORK_POLICY';

export interface ExactVersionReferenceV1 {
  id: string;
  version: number;
}

export interface SiteInstallationV1 {
  schemaVersion: 1;
  siteId: SiteIdV1;
  workspaceId: string;
  coreSiteInstallationRef: Readonly<{ installationId: string; version: number }>;
  version: number;
  kind: SiteKindV1;
  lifecycle: SiteLifecycleV1;
  currentConfigurationVersion: number;
  effectiveAt: string;
  recordedAt: string;
  sourceRef: string;
}

export interface SiteBrandConfigurationV1 {
  displayName: string;
  logoAssetRef?: string;
  theme: Readonly<{
    primaryColor: string;
    accentColor: string;
    colorMode: 'LIGHT' | 'DARK' | 'SYSTEM';
  }>;
}

export interface SiteLocalizationConfigurationV1 {
  defaultLocale: string;
  supportedLocales: readonly string[];
  defaultMarket: string;
  jurisdictions: readonly string[];
}

export interface SiteRoleReferencesV1 {
  surfaceOwnerWorkspaceId: string;
  customerRelationshipWorkspaceId: string;
  offerOwnerRef: string;
  merchantOwnerRef: string;
  fulfillmentOwnerRef: string;
  referralSourceRef?: string;
}

export interface SiteServiceAvailabilityV1 {
  productRef: Readonly<{
    owner: 'MARKREG';
    productId: CommercialProductId;
    version: number;
  }>;
  visibility: 'PUBLIC' | 'HIDDEN';
  locales: readonly string[];
  markets: readonly string[];
  channel: Channel;
  relationshipModel: RelationshipModel;
  pricingPolicyRefs: readonly ExactVersionReferenceV1[];
  fulfillment: Readonly<{
    mode: SiteFulfillmentModeV1;
    policyRef?: ExactVersionReferenceV1;
  }>;
}

export interface SiteContentSlotV1 {
  slot: string;
  route: string;
  locale: string;
  title: string;
  description?: string;
  publishPackageRef: ExactVersionReferenceV1;
  contentFingerprintSha256: string;
}

export interface SiteConfigurationVersionV1 {
  schemaVersion: 1;
  siteId: SiteIdV1;
  workspaceId: string;
  version: number;
  brand: Readonly<SiteBrandConfigurationV1>;
  localization: Readonly<SiteLocalizationConfigurationV1>;
  roles: Readonly<SiteRoleReferencesV1>;
  services: readonly Readonly<SiteServiceAvailabilityV1>[];
  contentSlots: readonly Readonly<SiteContentSlotV1>[];
  attributionPolicyRef?: ExactVersionReferenceV1;
  recordedAt: string;
  sourceRef: string;
}

export interface SiteHostBindingV1 {
  schemaVersion: 1;
  bindingId: SiteHostBindingIdV1;
  siteId: SiteIdV1;
  workspaceId: string;
  normalizedHostname: string;
  bindingType: SiteHostBindingTypeV1;
  version: number;
  status: SiteHostBindingStatusV1;
  verificationMethod: 'DNS_TXT' | 'HTTP_TOKEN' | 'PLATFORM_MANAGED';
  verificationEvidenceRef?: string;
  verifiedAt?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  recordedAt: string;
}

export interface SiteRuntimeCommercialAccessV1 {
  schemaVersion: 1;
  workspaceId: string;
  installationRef: Readonly<{ installationId: string; version: number }>;
  entitlementRefs: readonly Readonly<{
    key: string;
    contributingGrantRefs: readonly Readonly<{ grantId: string; version: number }>[];
    resolvedAt: string;
  }>[];
  currentAt: string;
}

export interface ResolvedPublicSiteV1 {
  schemaVersion: 1;
  siteId: SiteIdV1;
  siteVersion: number;
  configurationVersion: number;
  hostBindingVersion: number;
  hostname: string;
  brand: Readonly<SiteBrandConfigurationV1>;
  localization: Readonly<SiteLocalizationConfigurationV1>;
  services: readonly Readonly<
    Pick<
      SiteServiceAvailabilityV1,
      'productRef' | 'visibility' | 'locales' | 'markets' | 'channel' | 'relationshipModel'
    > & { fulfillmentMode: SiteFulfillmentModeV1 }
  >[];
  contentSlots: readonly Readonly<SiteContentSlotV1>[];
  currentness: Readonly<{
    hostBindingCurrent: true;
    configurationCurrent: true;
    coreSiteInstallationCurrent: true;
    entitlementsCurrent: true;
    observedAt: string;
  }>;
}

export interface SiteRequestContextV1 {
  schemaVersion: 1;
  siteId: SiteIdV1;
  workspaceId: string;
  siteVersion: number;
  configurationVersion: number;
  hostBindingId: SiteHostBindingIdV1;
  hostBindingVersion: number;
  normalizedHostname: string;
  defaultLocale: string;
  observedAt: string;
  fingerprintSha256: string;
}

export interface ResolvedSiteRuntimeV1 {
  schemaVersion: 1;
  publicSite: Readonly<ResolvedPublicSiteV1>;
  requestContext: Readonly<SiteRequestContextV1>;
}

export interface SiteConfigurationAuthorityConsequencesV1 {
  customerRelationshipCreated: false;
  quotePublished: false;
  paymentAuthorized: false;
  providerSelected: false;
  protectedActionAuthorized: false;
  workspaceMembershipGranted: false;
  brandingIdentityVerified: false;
}

export const noSiteConfigurationAuthorityConsequencesV1: Readonly<SiteConfigurationAuthorityConsequencesV1> =
  Object.freeze({
    customerRelationshipCreated: false,
    quotePublished: false,
    paymentAuthorized: false,
    providerSelected: false,
    protectedActionAuthorized: false,
    workspaceMembershipGranted: false,
    brandingIdentityVerified: false
  });
