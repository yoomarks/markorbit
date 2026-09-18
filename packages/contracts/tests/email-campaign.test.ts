import { describe, expect, it } from 'vitest';
import {
  assessCampaignAudienceReadinessV1,
  assessCampaignPublishPackageV1,
  assessCampaignReviewDecisionV1,
  assessEmailCampaignAssemblyV1,
  assertCampaignAudienceSnapshotSafetyV1,
  noEmailCampaignAuthorityConsequencesV1,
  type CampaignAudienceSnapshotV1,
  type CampaignBrandProjectionV1,
  type CampaignContentProjectionV1,
  type CampaignReviewDecisionV1,
  type EmailCampaignV1
} from '../src/email-campaign.js';

const hashA = 'a'.repeat(64);
const hashB = 'b'.repeat(64);
const hashC = 'c'.repeat(64);
const hashD = 'd'.repeat(64);

const publishPackage = {
  schemaVersion: 1,
  publishPackageId: 'publish-package_campaign-01',
  workspaceId: 'workspace_01',
  version: 3,
  contentDraft: { id: 'content-draft_campaign-01', version: 2 },
  contentDraftFingerprintSha256: hashB,
  reviewDecision: { id: 'content-review-decision_campaign-01', version: 1 },
  title: 'Reviewed title',
  body: 'Reviewed owner-backed body',
  publishPackageFingerprintSha256: hashA,
  status: 'PREPARED',
  externalPublishExecuted: false,
  createdAt: '2026-09-18T09:00:00Z'
} as const;

const readiness = {
  schemaVersion: 1,
  workspaceId: 'workspace_01',
  evaluatedByPrincipalId: 'principal_01',
  targetRef: { owner: 'LITE', kind: 'PROSPECT', id: 'prospect_01', version: 2 },
  channel: 'EMAIL',
  endpointFingerprintSha256: hashB,
  purpose: 'PROSPECT_OUTREACH',
  policyRef: { policyId: 'policy_us-b2b', version: 2 },
  reviewedSendFingerprintSha256: hashC,
  outcome: 'READY_FOR_HUMAN_SEND',
  reason: 'CURRENT_ALLOWED_ASSERTION',
  basisAssertionRef: { assertionId: 'outbound-contact-basis_prospect-01', version: 1 },
  suppressionRefs: [],
  evaluatedAt: '2026-09-18T09:10:00Z',
  readinessFingerprintSha256: hashD,
  authorityConsequences: {
    legalConsentVerifiedByMarkOrbit: false,
    externalMessageSent: false,
    protectedActionAuthorized: false
  }
} as const;

const audience = {
  schemaVersion: 1,
  audienceSnapshotId: 'campaign-audience_01',
  workspaceId: 'workspace_01',
  version: 1,
  channel: 'EMAIL',
  reviewedSendFingerprintSha256: hashC,
  entries: [
    {
      targetRef: readiness.targetRef,
      endpointFingerprintSha256: readiness.endpointFingerprintSha256,
      purpose: readiness.purpose,
      policyRef: readiness.policyRef,
      readiness: {
        evaluatedAt: readiness.evaluatedAt,
        readinessFingerprintSha256: readiness.readinessFingerprintSha256,
        reviewedSendFingerprintSha256: readiness.reviewedSendFingerprintSha256,
        outcome: readiness.outcome,
        reason: readiness.reason,
        basisAssertionRef: readiness.basisAssertionRef,
        suppressionRefs: readiness.suppressionRefs
      }
    }
  ],
  audienceFingerprintSha256: hashA,
  capturedAt: '2026-09-18T09:11:00Z',
  legalConsentVerifiedByMarkOrbit: false,
  externalSendAuthorized: false
} as const satisfies CampaignAudienceSnapshotV1;

const content = {
  schemaVersion: 1,
  contentProjectionId: 'campaign-content_01',
  workspaceId: 'workspace_01',
  version: 1,
  publishPackageRef: {
    publishPackageId: publishPackage.publishPackageId,
    version: publishPackage.version,
    fingerprintSha256: publishPackage.publishPackageFingerprintSha256
  },
  subject: 'A reviewed campaign subject',
  preheader: 'A bounded preheader',
  reviewedSendFingerprintSha256: hashC,
  bodyOwnedByPublishPackage: true,
  projectionFingerprintSha256: hashB,
  createdAt: '2026-09-18T09:12:00Z',
  externalSendAuthorized: false
} as const satisfies CampaignContentProjectionV1;

const brand = {
  schemaVersion: 1,
  brandProjectionId: 'campaign-brand_01',
  workspaceId: 'workspace_01',
  version: 1,
  source: {
    kind: 'SITE_CONFIGURATION',
    siteId: 'site_agency-01',
    configurationVersion: 4,
    sourceRef: 'site-config:agency-01:4'
  },
  presentation: {
    displayName: 'Agency Brand',
    logoAssetRef: 'asset_logo-01',
    primaryColor: '#111111',
    accentColor: '#eeeeee',
    colorMode: 'LIGHT'
  },
  brandProjectionFingerprintSha256: hashD,
  capturedAt: '2026-09-18T09:13:00Z',
  canonicalWorkspaceBrandCreated: false
} as const satisfies CampaignBrandProjectionV1;

const campaign = {
  schemaVersion: 1,
  campaignId: 'email-campaign_01',
  workspaceId: 'workspace_01',
  version: 1,
  featureKey: 'EMAIL_CAMPAIGN',
  purpose: 'PROSPECT_OUTREACH',
  audience: {
    audienceSnapshotId: audience.audienceSnapshotId,
    version: audience.version,
    fingerprintSha256: audience.audienceFingerprintSha256
  },
  content: {
    contentProjectionId: content.contentProjectionId,
    version: content.version,
    fingerprintSha256: content.projectionFingerprintSha256
  },
  brand: {
    brandProjectionId: brand.brandProjectionId,
    version: brand.version,
    fingerprintSha256: brand.brandProjectionFingerprintSha256
  },
  campaignFingerprintSha256: hashA,
  status: 'READY_FOR_HUMAN_REVIEW',
  humanReviewRequired: true,
  createdAt: '2026-09-18T09:14:00Z',
  updatedAt: '2026-09-18T09:14:00Z',
  authority: noEmailCampaignAuthorityConsequencesV1
} as const satisfies EmailCampaignV1;

const review = {
  schemaVersion: 1,
  campaignReviewDecisionId: 'campaign-review_01',
  workspaceId: 'workspace_01',
  version: 1,
  campaign: { campaignId: campaign.campaignId, version: campaign.version },
  expectedCampaignFingerprintSha256: campaign.campaignFingerprintSha256,
  outcome: 'APPROVED_FOR_DELIVERY_PREPARATION',
  reviewerPrincipalId: 'principal_01',
  rationale: 'Reviewed audience, content and brand projection.',
  reviewedAt: '2026-09-18T09:15:00Z',
  deliveryPreparationOnly: true,
  authority: noEmailCampaignAuthorityConsequencesV1
} as const satisfies CampaignReviewDecisionV1;

describe('email campaign core contracts', () => {
  it('keeps Campaign preparation separate from provider/execution/communication authority', () => {
    expect(campaign.featureKey).toBe('EMAIL_CAMPAIGN');
    expect(Object.values(campaign.authority).every((value) => value === false)).toBe(true);
  });

  it('accepts only opaque deduplicated audience entries bound to the exact reviewed send', () => {
    expect(() => assertCampaignAudienceSnapshotSafetyV1(audience)).not.toThrow();
    expect(audience.entries[0]).toMatchObject({
      targetRef: { id: 'prospect_01', version: 2 },
      endpointFingerprintSha256: hashB,
      readiness: {
        reviewedSendFingerprintSha256: hashC,
        outcome: 'READY_FOR_HUMAN_SEND'
      }
    });
  });

  it('rejects raw email material from the audience target reference', () => {
    expect(() =>
      assertCampaignAudienceSnapshotSafetyV1({
        ...audience,
        entries: [
          {
            ...audience.entries[0],
            targetRef: { ...readiness.targetRef, id: 'person@example.com' }
          }
        ]
      })
    ).toThrow('cannot contain raw email');
  });

  it('rejects stale readiness for a different reviewed send fingerprint', () => {
    expect(() =>
      assertCampaignAudienceSnapshotSafetyV1({
        ...audience,
        entries: [
          {
            ...audience.entries[0],
            readiness: {
              ...audience.entries[0].readiness,
              reviewedSendFingerprintSha256: hashD
            }
          }
        ]
      })
    ).toThrow('exact reviewed send');
  });

  it('rejects duplicate recipient endpoints inside one immutable audience snapshot', () => {
    expect(() =>
      assertCampaignAudienceSnapshotSafetyV1({
        ...audience,
        entries: [
          audience.entries[0],
          {
            ...audience.entries[0],
            targetRef: { ...readiness.targetRef, id: 'prospect_02' }
          }
        ]
      })
    ).toThrow('cannot duplicate an email endpoint');
  });

  it('references exact reviewed PublishPackage truth without copying body into Campaign', () => {
    expect('body' in content).toBe(false);
    expect(content.bodyOwnedByPublishPackage).toBe(true);
    expect(assessCampaignPublishPackageV1(content, publishPackage)).toEqual({
      matches: true,
      reason: 'MATCH',
      createsSendAuthority: false
    });
  });

  it('fails PublishPackage assessment closed on version or fingerprint drift', () => {
    expect(
      assessCampaignPublishPackageV1(content, { ...publishPackage, version: 4 })
    ).toMatchObject({ matches: false, reason: 'PUBLISH_PACKAGE_VERSION_MISMATCH' });
    expect(
      assessCampaignPublishPackageV1(content, {
        ...publishPackage,
        publishPackageFingerprintSha256: hashD
      })
    ).toMatchObject({ matches: false, reason: 'PUBLISH_PACKAGE_FINGERPRINT_MISMATCH' });
  });

  it('captures Site-backed presentation without creating canonical Workspace brand truth', () => {
    expect(brand).toMatchObject({
      source: { kind: 'SITE_CONFIGURATION', configurationVersion: 4 },
      presentation: { displayName: 'Agency Brand' },
      canonicalWorkspaceBrandCreated: false
    });
    const localBrand: CampaignBrandProjectionV1 = {
      ...brand,
      source: { kind: 'CAMPAIGN_LOCAL_PRESENTATION', sourceRef: 'campaign-local:brand:01' }
    };
    expect(localBrand.source.kind).toBe('CAMPAIGN_LOCAL_PRESENTATION');
    expect(localBrand.canonicalWorkspaceBrandCreated).toBe(false);
  });

  it('matches an Audience entry only to the exact current readiness lineage', () => {
    expect(assessCampaignAudienceReadinessV1(audience.entries[0], readiness)).toEqual({
      matches: true,
      reason: 'MATCH',
      createsSendAuthority: false
    });
    expect(
      assessCampaignAudienceReadinessV1(audience.entries[0], {
        ...readiness,
        readinessFingerprintSha256: hashA
      })
    ).toMatchObject({ matches: false, reason: 'READINESS_FINGERPRINT_MISMATCH' });
  });

  it('assembles only exact same-workspace, same-purpose, same-reviewed-send projections', () => {
    expect(assessEmailCampaignAssemblyV1(campaign, audience, content, brand)).toEqual({
      matches: true,
      reason: 'MATCH',
      createsSendAuthority: false
    });
    expect(
      assessEmailCampaignAssemblyV1(
        campaign,
        audience,
        { ...content, reviewedSendFingerprintSha256: hashD },
        brand
      )
    ).toMatchObject({ matches: false, reason: 'REVIEWED_SEND_FINGERPRINT_MISMATCH' });
  });

  it('human approval permits delivery preparation only and still creates no send authority', () => {
    expect(assessCampaignReviewDecisionV1(review, campaign)).toEqual({
      matches: true,
      approvedForDeliveryPreparation: true,
      reason: 'MATCH',
      createsSendAuthority: false
    });
    expect(review.deliveryPreparationOnly).toBe(true);
    expect(review.authority.externalSendAuthorized).toBe(false);
  });

  it('fails review closed when the Campaign fingerprint drifts', () => {
    expect(
      assessCampaignReviewDecisionV1(review, {
        ...campaign,
        campaignFingerprintSha256: hashD
      })
    ).toMatchObject({
      matches: false,
      approvedForDeliveryPreparation: false,
      reason: 'CAMPAIGN_FINGERPRINT_MISMATCH'
    });
  });
});
