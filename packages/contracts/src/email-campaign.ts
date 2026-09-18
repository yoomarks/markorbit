import type {
  OutboundContactBasisAssertionIdV1,
  OutboundContactPolicyReferenceV1,
  OutboundContactPurposeV1,
  OutboundContactReadinessV1,
  OutboundContactSuppressionIdV1,
  OutboundContactSuppressionScopeV1,
  OutboundContactTargetReferenceV1
} from './outbound-contact-policy.js';
import type { PublishPackage, PublishPackageId } from './product-loop.js';
import type { SiteIdV1 } from './site.js';

export type EmailCampaignIdV1 = `email-campaign_${string}`;
export type CampaignAudienceSnapshotIdV1 = `campaign-audience_${string}`;
export type CampaignContentProjectionIdV1 = `campaign-content_${string}`;
export type CampaignBrandProjectionIdV1 = `campaign-brand_${string}`;
export type CampaignReviewDecisionIdV1 = `campaign-review_${string}`;

export const emailCampaignStatusesV1 = [
  'DRAFT',
  'READY_FOR_HUMAN_REVIEW',
  'REVIEWED_READY_FOR_DELIVERY_PREPARATION',
  'CHANGES_REQUIRED',
  'REJECTED',
  'SUPERSEDED'
] as const;
export type EmailCampaignStatusV1 = (typeof emailCampaignStatusesV1)[number];

export const campaignReviewOutcomesV1 = [
  'APPROVED_FOR_DELIVERY_PREPARATION',
  'CHANGES_REQUIRED',
  'REJECTED'
] as const;
export type CampaignReviewOutcomeV1 = (typeof campaignReviewOutcomesV1)[number];

export const noEmailCampaignAuthorityConsequencesV1 = Object.freeze({
  legalConsentVerifiedByMarkOrbit: false,
  providerSelectionAuthorityGranted: false,
  protectedActionAuthorized: false,
  externalSendAuthorized: false,
  externalMessageSent: false,
  managedCommunicationCreated: false,
  customerTruthCreated: false,
  orderCreated: false,
  matterCreated: false,
  trademarkTruthCreated: false,
  publicationCreated: false
});
export type EmailCampaignAuthorityConsequencesV1 = typeof noEmailCampaignAuthorityConsequencesV1;

export interface CampaignAudienceReadinessRefV1 {
  evaluatedAt: string;
  readinessFingerprintSha256: string;
  reviewedSendFingerprintSha256: string;
  outcome: 'READY_FOR_HUMAN_SEND';
  reason: 'CURRENT_ALLOWED_ASSERTION';
  basisAssertionRef: Readonly<{
    assertionId: OutboundContactBasisAssertionIdV1;
    version: number;
  }>;
  suppressionRefs: readonly Readonly<{
    suppressionId: OutboundContactSuppressionIdV1;
    version: number;
    scope: OutboundContactSuppressionScopeV1;
    status: 'ACTIVE' | 'CLEARED';
  }>[];
}

export interface CampaignAudienceEntryV1 {
  targetRef: Readonly<OutboundContactTargetReferenceV1>;
  endpointFingerprintSha256: string;
  purpose: OutboundContactPurposeV1;
  policyRef: Readonly<OutboundContactPolicyReferenceV1>;
  readiness: Readonly<CampaignAudienceReadinessRefV1>;
}

export interface CampaignAudienceSnapshotV1 {
  schemaVersion: 1;
  audienceSnapshotId: CampaignAudienceSnapshotIdV1;
  workspaceId: string;
  version: number;
  channel: 'EMAIL';
  reviewedSendFingerprintSha256: string;
  entries: readonly Readonly<CampaignAudienceEntryV1>[];
  audienceFingerprintSha256: string;
  capturedAt: string;
  legalConsentVerifiedByMarkOrbit: false;
  externalSendAuthorized: false;
}

export interface CampaignContentProjectionV1 {
  schemaVersion: 1;
  contentProjectionId: CampaignContentProjectionIdV1;
  workspaceId: string;
  version: number;
  publishPackageRef: Readonly<{
    publishPackageId: PublishPackageId;
    version: number;
    fingerprintSha256: string;
  }>;
  subject: string;
  preheader?: string;
  reviewedSendFingerprintSha256: string;
  bodyOwnedByPublishPackage: true;
  projectionFingerprintSha256: string;
  createdAt: string;
  externalSendAuthorized: false;
}

export interface CampaignBrandPresentationV1 {
  displayName: string;
  logoAssetRef?: string;
  primaryColor?: string;
  accentColor?: string;
  colorMode?: 'LIGHT' | 'DARK' | 'SYSTEM';
}

export type CampaignBrandSourceV1 =
  | Readonly<{
      kind: 'SITE_CONFIGURATION';
      siteId: SiteIdV1;
      configurationVersion: number;
      sourceRef: string;
    }>
  | Readonly<{
      kind: 'CAMPAIGN_LOCAL_PRESENTATION';
      sourceRef: string;
    }>;

export interface CampaignBrandProjectionV1 {
  schemaVersion: 1;
  brandProjectionId: CampaignBrandProjectionIdV1;
  workspaceId: string;
  version: number;
  source: CampaignBrandSourceV1;
  presentation: Readonly<CampaignBrandPresentationV1>;
  brandProjectionFingerprintSha256: string;
  capturedAt: string;
  canonicalWorkspaceBrandCreated: false;
}

export interface EmailCampaignV1 {
  schemaVersion: 1;
  campaignId: EmailCampaignIdV1;
  workspaceId: string;
  version: number;
  featureKey: 'EMAIL_CAMPAIGN';
  purpose: OutboundContactPurposeV1;
  audience: Readonly<{
    audienceSnapshotId: CampaignAudienceSnapshotIdV1;
    version: number;
    fingerprintSha256: string;
  }>;
  content: Readonly<{
    contentProjectionId: CampaignContentProjectionIdV1;
    version: number;
    fingerprintSha256: string;
  }>;
  brand: Readonly<{
    brandProjectionId: CampaignBrandProjectionIdV1;
    version: number;
    fingerprintSha256: string;
  }>;
  campaignFingerprintSha256: string;
  status: EmailCampaignStatusV1;
  humanReviewRequired: true;
  createdAt: string;
  updatedAt: string;
  authority: Readonly<EmailCampaignAuthorityConsequencesV1>;
}

export interface CampaignReviewDecisionV1 {
  schemaVersion: 1;
  campaignReviewDecisionId: CampaignReviewDecisionIdV1;
  workspaceId: string;
  version: number;
  campaign: Readonly<{ campaignId: EmailCampaignIdV1; version: number }>;
  expectedCampaignFingerprintSha256: string;
  outcome: CampaignReviewOutcomeV1;
  reviewerPrincipalId: string;
  rationale: string;
  reviewedAt: string;
  deliveryPreparationOnly: true;
  authority: Readonly<EmailCampaignAuthorityConsequencesV1>;
}

export class EmailCampaignContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'EmailCampaignContractError';
  }
}

const SHA256 = /^[a-f0-9]{64}$/u;

function assertSha256(value: string, field: string): void {
  if (!SHA256.test(value))
    throw new EmailCampaignContractError(`${field} must be lowercase SHA-256 hex.`);
}

function assertOpaqueReference(value: string, field: string): void {
  if (!value.trim() || value.includes('@'))
    throw new EmailCampaignContractError(`${field} must be opaque and cannot contain raw email.`);
}

function sameTarget(
  left: Readonly<OutboundContactTargetReferenceV1>,
  right: Readonly<OutboundContactTargetReferenceV1>
): boolean {
  return (
    left.owner === right.owner &&
    left.kind === right.kind &&
    left.id === right.id &&
    left.version === right.version
  );
}

function samePolicy(
  left: Readonly<OutboundContactPolicyReferenceV1>,
  right: Readonly<OutboundContactPolicyReferenceV1>
): boolean {
  return left.policyId === right.policyId && left.version === right.version;
}

function sameSuppressions(
  left: readonly CampaignAudienceReadinessRefV1['suppressionRefs'][number][],
  right: readonly CampaignAudienceReadinessRefV1['suppressionRefs'][number][]
): boolean {
  return (
    left.length === right.length &&
    left.every((entry, index) => {
      const candidate = right[index];
      return (
        candidate !== undefined &&
        entry.suppressionId === candidate.suppressionId &&
        entry.version === candidate.version &&
        entry.scope === candidate.scope &&
        entry.status === candidate.status
      );
    })
  );
}

/**
 * C2A has no persistence/API parser. This guard only proves the frozen audience
 * shape cannot smuggle raw email endpoints or stale reviewed-send readiness.
 */
export function assertCampaignAudienceSnapshotSafetyV1(
  snapshot: Readonly<CampaignAudienceSnapshotV1>
): void {
  if (snapshot.entries.length < 1 || snapshot.entries.length > 10000)
    throw new EmailCampaignContractError('Audience snapshot must contain 1 to 10000 entries.');
  assertSha256(snapshot.reviewedSendFingerprintSha256, 'reviewedSendFingerprintSha256');
  assertSha256(snapshot.audienceFingerprintSha256, 'audienceFingerprintSha256');
  if (snapshot.legalConsentVerifiedByMarkOrbit || snapshot.externalSendAuthorized)
    throw new EmailCampaignContractError('Audience authority locks must remain false.');

  const endpointFingerprints = new Set<string>();
  for (const [index, entry] of snapshot.entries.entries()) {
    assertOpaqueReference(entry.targetRef.id, `entries[${index}].targetRef.id`);
    assertSha256(entry.endpointFingerprintSha256, `entries[${index}].endpointFingerprintSha256`);
    assertSha256(
      entry.readiness.readinessFingerprintSha256,
      `entries[${index}].readiness.readinessFingerprintSha256`
    );
    assertSha256(
      entry.readiness.reviewedSendFingerprintSha256,
      `entries[${index}].readiness.reviewedSendFingerprintSha256`
    );
    if (entry.readiness.reviewedSendFingerprintSha256 !== snapshot.reviewedSendFingerprintSha256)
      throw new EmailCampaignContractError('Audience readiness must bind the exact reviewed send.');
    if (
      entry.readiness.outcome !== 'READY_FOR_HUMAN_SEND' ||
      entry.readiness.reason !== 'CURRENT_ALLOWED_ASSERTION'
    )
      throw new EmailCampaignContractError('Audience entry is not current READY_FOR_HUMAN_SEND.');
    if (!entry.readiness.basisAssertionRef)
      throw new EmailCampaignContractError(
        'Audience entry requires exact basis assertion lineage.'
      );
    if (entry.readiness.suppressionRefs.length > 20)
      throw new EmailCampaignContractError('Audience suppression lineage exceeds the V1 bound.');
    if (endpointFingerprints.has(entry.endpointFingerprintSha256))
      throw new EmailCampaignContractError('Audience snapshot cannot duplicate an email endpoint.');
    endpointFingerprints.add(entry.endpointFingerprintSha256);
  }
}

export function assessCampaignPublishPackageV1(
  projection: Readonly<CampaignContentProjectionV1>,
  publishPackage: Readonly<PublishPackage>
): Readonly<{
  matches: boolean;
  reason:
    | 'MATCH'
    | 'WORKSPACE_MISMATCH'
    | 'PUBLISH_PACKAGE_ID_MISMATCH'
    | 'PUBLISH_PACKAGE_VERSION_MISMATCH'
    | 'PUBLISH_PACKAGE_FINGERPRINT_MISMATCH';
  createsSendAuthority: false;
}> {
  let reason:
    | 'MATCH'
    | 'WORKSPACE_MISMATCH'
    | 'PUBLISH_PACKAGE_ID_MISMATCH'
    | 'PUBLISH_PACKAGE_VERSION_MISMATCH'
    | 'PUBLISH_PACKAGE_FINGERPRINT_MISMATCH' = 'MATCH';
  if (projection.workspaceId !== publishPackage.workspaceId) reason = 'WORKSPACE_MISMATCH';
  else if (projection.publishPackageRef.publishPackageId !== publishPackage.publishPackageId)
    reason = 'PUBLISH_PACKAGE_ID_MISMATCH';
  else if (projection.publishPackageRef.version !== publishPackage.version)
    reason = 'PUBLISH_PACKAGE_VERSION_MISMATCH';
  else if (
    projection.publishPackageRef.fingerprintSha256 !==
    publishPackage.publishPackageFingerprintSha256
  )
    reason = 'PUBLISH_PACKAGE_FINGERPRINT_MISMATCH';
  return { matches: reason === 'MATCH', reason, createsSendAuthority: false };
}

export function assessCampaignAudienceReadinessV1(
  entry: Readonly<CampaignAudienceEntryV1>,
  readiness: Readonly<OutboundContactReadinessV1>
): Readonly<{
  matches: boolean;
  reason:
    | 'MATCH'
    | 'TARGET_MISMATCH'
    | 'ENDPOINT_FINGERPRINT_MISMATCH'
    | 'PURPOSE_MISMATCH'
    | 'POLICY_MISMATCH'
    | 'READINESS_FINGERPRINT_MISMATCH'
    | 'REVIEWED_SEND_FINGERPRINT_MISMATCH'
    | 'BASIS_ASSERTION_MISMATCH'
    | 'SUPPRESSION_LINEAGE_MISMATCH'
    | 'READINESS_NOT_READY';
  createsSendAuthority: false;
}> {
  let reason:
    | 'MATCH'
    | 'TARGET_MISMATCH'
    | 'ENDPOINT_FINGERPRINT_MISMATCH'
    | 'PURPOSE_MISMATCH'
    | 'POLICY_MISMATCH'
    | 'READINESS_FINGERPRINT_MISMATCH'
    | 'REVIEWED_SEND_FINGERPRINT_MISMATCH'
    | 'BASIS_ASSERTION_MISMATCH'
    | 'SUPPRESSION_LINEAGE_MISMATCH'
    | 'READINESS_NOT_READY' = 'MATCH';

  if (!sameTarget(entry.targetRef, readiness.targetRef)) reason = 'TARGET_MISMATCH';
  else if (entry.endpointFingerprintSha256 !== readiness.endpointFingerprintSha256)
    reason = 'ENDPOINT_FINGERPRINT_MISMATCH';
  else if (entry.purpose !== readiness.purpose) reason = 'PURPOSE_MISMATCH';
  else if (!samePolicy(entry.policyRef, readiness.policyRef)) reason = 'POLICY_MISMATCH';
  else if (entry.readiness.readinessFingerprintSha256 !== readiness.readinessFingerprintSha256)
    reason = 'READINESS_FINGERPRINT_MISMATCH';
  else if (
    entry.readiness.reviewedSendFingerprintSha256 !== readiness.reviewedSendFingerprintSha256
  )
    reason = 'REVIEWED_SEND_FINGERPRINT_MISMATCH';
  else if (
    !readiness.basisAssertionRef ||
    entry.readiness.basisAssertionRef.assertionId !== readiness.basisAssertionRef.assertionId ||
    entry.readiness.basisAssertionRef.version !== readiness.basisAssertionRef.version
  )
    reason = 'BASIS_ASSERTION_MISMATCH';
  else if (!sameSuppressions(entry.readiness.suppressionRefs, readiness.suppressionRefs))
    reason = 'SUPPRESSION_LINEAGE_MISMATCH';
  else if (
    readiness.outcome !== 'READY_FOR_HUMAN_SEND' ||
    readiness.reason !== 'CURRENT_ALLOWED_ASSERTION'
  )
    reason = 'READINESS_NOT_READY';

  return { matches: reason === 'MATCH', reason, createsSendAuthority: false };
}

export function assessEmailCampaignAssemblyV1(
  campaign: Readonly<EmailCampaignV1>,
  audience: Readonly<CampaignAudienceSnapshotV1>,
  content: Readonly<CampaignContentProjectionV1>,
  brand: Readonly<CampaignBrandProjectionV1>
): Readonly<{
  matches: boolean;
  reason:
    | 'MATCH'
    | 'WORKSPACE_MISMATCH'
    | 'PURPOSE_MISMATCH'
    | 'AUDIENCE_REF_MISMATCH'
    | 'CONTENT_REF_MISMATCH'
    | 'BRAND_REF_MISMATCH'
    | 'REVIEWED_SEND_FINGERPRINT_MISMATCH';
  createsSendAuthority: false;
}> {
  let reason:
    | 'MATCH'
    | 'WORKSPACE_MISMATCH'
    | 'PURPOSE_MISMATCH'
    | 'AUDIENCE_REF_MISMATCH'
    | 'CONTENT_REF_MISMATCH'
    | 'BRAND_REF_MISMATCH'
    | 'REVIEWED_SEND_FINGERPRINT_MISMATCH' = 'MATCH';

  if (
    campaign.workspaceId !== audience.workspaceId ||
    campaign.workspaceId !== content.workspaceId ||
    campaign.workspaceId !== brand.workspaceId
  )
    reason = 'WORKSPACE_MISMATCH';
  else if (audience.entries.some((entry) => entry.purpose !== campaign.purpose))
    reason = 'PURPOSE_MISMATCH';
  else if (
    campaign.audience.audienceSnapshotId !== audience.audienceSnapshotId ||
    campaign.audience.version !== audience.version ||
    campaign.audience.fingerprintSha256 !== audience.audienceFingerprintSha256
  )
    reason = 'AUDIENCE_REF_MISMATCH';
  else if (
    campaign.content.contentProjectionId !== content.contentProjectionId ||
    campaign.content.version !== content.version ||
    campaign.content.fingerprintSha256 !== content.projectionFingerprintSha256
  )
    reason = 'CONTENT_REF_MISMATCH';
  else if (
    campaign.brand.brandProjectionId !== brand.brandProjectionId ||
    campaign.brand.version !== brand.version ||
    campaign.brand.fingerprintSha256 !== brand.brandProjectionFingerprintSha256
  )
    reason = 'BRAND_REF_MISMATCH';
  else if (audience.reviewedSendFingerprintSha256 !== content.reviewedSendFingerprintSha256)
    reason = 'REVIEWED_SEND_FINGERPRINT_MISMATCH';

  return { matches: reason === 'MATCH', reason, createsSendAuthority: false };
}

export function assessCampaignReviewDecisionV1(
  decision: Readonly<CampaignReviewDecisionV1>,
  campaign: Readonly<EmailCampaignV1>
): Readonly<{
  matches: boolean;
  approvedForDeliveryPreparation: boolean;
  reason:
    | 'MATCH'
    | 'WORKSPACE_MISMATCH'
    | 'CAMPAIGN_REF_MISMATCH'
    | 'CAMPAIGN_FINGERPRINT_MISMATCH'
    | 'NOT_APPROVED';
  createsSendAuthority: false;
}> {
  let reason:
    | 'MATCH'
    | 'WORKSPACE_MISMATCH'
    | 'CAMPAIGN_REF_MISMATCH'
    | 'CAMPAIGN_FINGERPRINT_MISMATCH'
    | 'NOT_APPROVED' = 'MATCH';

  if (decision.workspaceId !== campaign.workspaceId) reason = 'WORKSPACE_MISMATCH';
  else if (
    decision.campaign.campaignId !== campaign.campaignId ||
    decision.campaign.version !== campaign.version
  )
    reason = 'CAMPAIGN_REF_MISMATCH';
  else if (decision.expectedCampaignFingerprintSha256 !== campaign.campaignFingerprintSha256)
    reason = 'CAMPAIGN_FINGERPRINT_MISMATCH';
  else if (decision.outcome !== 'APPROVED_FOR_DELIVERY_PREPARATION') reason = 'NOT_APPROVED';

  return {
    matches: reason === 'MATCH',
    approvedForDeliveryPreparation: reason === 'MATCH',
    reason,
    createsSendAuthority: false
  };
}
