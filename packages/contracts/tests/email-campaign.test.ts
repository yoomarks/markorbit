import { describe, expect, it } from 'vitest';
import {
  assessCampaignAudienceReadinessV1,
  assessCampaignPublishPackageV1,
  noEmailCampaignAuthorityConsequencesV1,
  parseCampaignAudienceSnapshotV1,
  parseCampaignBrandProjectionV1,
  parseCampaignContentProjectionV1,
  parseCampaignReviewDecisionV1,
  parseEmailCampaignV1
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

const audienceInput = {
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
} as const;

const contentInput = {
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
} as const;

const brandInput = {
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
} as const;

const authority = noEmailCampaignAuthorityConsequencesV1;

const campaignInput = {
  schemaVersion: 1,
  campaignId: 'email-campaign_01',
  workspaceId: 'workspace_01',
  version: 1,
  featureKey: 'EMAIL_CAMPAIGN',
  purpose: 'PROSPECT_OUTREACH',
  audience: {
    audienceSnapshotId: 'campaign-audience_01',
    version: 1,
    fingerprintSha256: hashA
  },
  content: {
    contentProjectionId: 'campaign-content_01',
    version: 1,
    fingerprintSha256: hashB
  },
  brand: {
    brandProjectionId: 'campaign-brand_01',
    version: 1,
    fingerprintSha256: hashD
  },
  status: 'READY_FOR_HUMAN_REVIEW',
  humanReviewRequired: true,
  createdAt: '2026-09-18T09:14:00Z',
  updatedAt: '2026-09-18T09:14:00Z',
  authority
} as const;

describe('email campaign core contracts', () => {
  it('accepts an audience snapshot containing only opaque target/readiness lineage', () => {
    const snapshot = parseCampaignAudienceSnapshotV1(audienceInput);
    expect(snapshot.entries[0]).toMatchObject({
      targetRef: { id: 'prospect_01', version: 2 },
      endpointFingerprintSha256: hashB,
      readiness: {
        reviewedSendFingerprintSha256: hashC,
        outcome: 'READY_FOR_HUMAN_SEND'
      }
    });
    expect(snapshot.externalSendAuthorized).toBe(false);
    expect(snapshot.legalConsentVerifiedByMarkOrbit).toBe(false);
  });

  it('rejects raw email material from the audience target reference', () => {
    expect(() =>
      parseCampaignAudienceSnapshotV1({
        ...audienceInput,
        entries: [
          {
            ...audienceInput.entries[0],
            targetRef: { ...readiness.targetRef, id: 'person@example.com' }
          }
        ]
      })
    ).toThrow('cannot contain raw email');
  });

  it('rejects stale readiness for a different reviewed send fingerprint', () => {
    expect(() =>
      parseCampaignAudienceSnapshotV1({
        ...audienceInput,
        entries: [
          {
            ...audienceInput.entries[0],
            readiness: {
              ...audienceInput.entries[0].readiness,
              reviewedSendFingerprintSha256: hashD
            }
          }
        ]
      })
    ).toThrow('exact reviewed send');
  });

  it('references exact reviewed PublishPackage truth without copying body into Campaign', () => {
    const projection = parseCampaignContentProjectionV1(contentInput);
    expect(projection.bodyOwnedByPublishPackage).toBe(true);
    expect('body' in projection).toBe(false);
    expect(assessCampaignPublishPackageV1(projection, publishPackage)).toEqual({
      matches: true,
      reason: 'MATCH',
      createsSendAuthority: false
    });
  });

  it('fails PublishPackage assessment closed on version or fingerprint drift', () => {
    const projection = parseCampaignContentProjectionV1(contentInput);
    expect(
      assessCampaignPublishPackageV1(projection, { ...publishPackage, version: 4 })
    ).toMatchObject({ matches: false, reason: 'PUBLISH_PACKAGE_VERSION_MISMATCH' });
    expect(
      assessCampaignPublishPackageV1(projection, {
        ...publishPackage,
        publishPackageFingerprintSha256: hashD
      })
    ).toMatchObject({ matches: false, reason: 'PUBLISH_PACKAGE_FINGERPRINT_MISMATCH' });
  });

  it('captures a Site-backed brand presentation without creating canonical Workspace brand truth', () => {
    const brand = parseCampaignBrandProjectionV1(brandInput);
    expect(brand).toMatchObject({
      source: { kind: 'SITE_CONFIGURATION', configurationVersion: 4 },
      presentation: { displayName: 'Agency Brand' },
      canonicalWorkspaceBrandCreated: false
    });
  });

  it('supports a bounded campaign-local brand presentation when no Site source exists', () => {
    const brand = parseCampaignBrandProjectionV1({
      ...brandInput,
      source: {
        kind: 'CAMPAIGN_LOCAL_PRESENTATION',
        sourceRef: 'campaign-local:brand:01'
      }
    });
    expect(brand.source.kind).toBe('CAMPAIGN_LOCAL_PRESENTATION');
    expect(brand.canonicalWorkspaceBrandCreated).toBe(false);
  });

  it('keeps Campaign preparation separate from provider/execution/communication authority', () => {
    const campaign = parseEmailCampaignV1(campaignInput);
    expect(campaign.featureKey).toBe('EMAIL_CAMPAIGN');
    expect(Object.values(campaign.authority).every((value) => value === false)).toBe(true);
  });

  it('reviews only for delivery preparation and never authorizes a send', () => {
    const decision = parseCampaignReviewDecisionV1({
      schemaVersion: 1,
      campaignReviewDecisionId: 'campaign-review_01',
      workspaceId: 'workspace_01',
      version: 1,
      campaign: { campaignId: 'email-campaign_01', version: 1 },
      expectedCampaignFingerprintSha256: hashA,
      outcome: 'APPROVED_FOR_DELIVERY_PREPARATION',
      reviewerPrincipalId: 'principal_01',
      rationale: 'Reviewed audience, content and brand projection.',
      reviewedAt: '2026-09-18T09:15:00Z',
      deliveryPreparationOnly: true,
      authority
    });
    expect(decision.deliveryPreparationOnly).toBe(true);
    expect(decision.authority.externalSendAuthorized).toBe(false);
  });

  it('matches an Audience entry only to the exact current readiness evidence', () => {
    const snapshot = parseCampaignAudienceSnapshotV1(audienceInput);
    expect(assessCampaignAudienceReadinessV1(snapshot.entries[0], readiness)).toEqual({
      matches: true,
      reason: 'MATCH',
      createsSendAuthority: false
    });
    expect(
      assessCampaignAudienceReadinessV1(snapshot.entries[0], {
        ...readiness,
        readinessFingerprintSha256: hashA
      })
    ).toMatchObject({ matches: false, reason: 'READINESS_FINGERPRINT_MISMATCH' });
  });
});
