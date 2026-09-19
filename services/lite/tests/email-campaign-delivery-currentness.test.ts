import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  canonicalEmailCampaignSendIntentPayloadV1,
  type CoreHumanActionReceiptBindingV1,
  type EmailCampaignSendIntentV1,
  type OutboundContactReadinessV1
} from '@markorbit/contracts';
import {
  noEmailCampaignAuthorityConsequencesV1,
  type CampaignAudienceSnapshotV1,
  type CampaignBrandProjectionV1,
  type CampaignContentProjectionV1,
  type CampaignReviewDecisionV1,
  type EmailCampaignV1
} from '@markorbit/contracts/email-campaign';
import {
  noWorkspaceEmailSenderProfileAuthorityConsequencesV1,
  type WorkspaceEmailSenderProfileV1
} from '@markorbit/contracts/email-sender-profile';
import {
  EmailCampaignDeliveryCurrentnessResolver,
  type EmailCampaignEndpointResolver,
  type EmailCampaignEntitlementReader,
  type EmailCampaignEntitlementResolution,
  type EmailCampaignReadinessEvaluator
} from '../src/email-campaign-delivery-currentness.js';

const workspaceId = '14141414-1414-4414-8414-141414141414';
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const endpoint = 'person@example.com';
const endpointFingerprintSha256 = createHash('sha256').update(endpoint).digest('hex');

const audience: CampaignAudienceSnapshotV1 = {
  schemaVersion: 1,
  audienceSnapshotId: 'campaign-audience_currentness',
  workspaceId,
  version: 1,
  channel: 'EMAIL',
  reviewedSendFingerprintSha256: 'c'.repeat(64),
  entries: [
    {
      targetRef: {
        owner: 'LITE',
        kind: 'WORKSPACE_DIRECTORY_ENTRY',
        id: 'workspace-directory-entry_person',
        version: 1
      },
      endpointFingerprintSha256,
      purpose: 'PROSPECT_OUTREACH',
      policyRef: { policyId: 'policy_currentness', version: 1 },
      readiness: {
        evaluatedAt: '2026-09-19T00:00:00.000Z',
        readinessFingerprintSha256: 'd'.repeat(64),
        reviewedSendFingerprintSha256: 'c'.repeat(64),
        outcome: 'READY_FOR_HUMAN_SEND',
        reason: 'CURRENT_ALLOWED_ASSERTION',
        basisAssertionRef: {
          assertionId: 'outbound-contact-basis_currentness',
          version: 1
        },
        suppressionRefs: []
      }
    }
  ],
  audienceFingerprintSha256: 'a'.repeat(64),
  capturedAt: '2026-09-19T00:00:00.000Z',
  legalConsentVerifiedByMarkOrbit: false,
  externalSendAuthorized: false
};

const contentProjection: CampaignContentProjectionV1 = {
  schemaVersion: 1,
  contentProjectionId: 'campaign-content_currentness',
  workspaceId,
  version: 1,
  publishPackageRef: {
    publishPackageId: 'publish-package_currentness',
    version: 1,
    fingerprintSha256: '1'.repeat(64)
  },
  subject: 'Reviewed subject',
  reviewedSendFingerprintSha256: 'c'.repeat(64),
  bodyOwnedByPublishPackage: true,
  projectionFingerprintSha256: 'b'.repeat(64),
  createdAt: '2026-09-19T00:00:00.000Z',
  externalSendAuthorized: false
};

const brand: CampaignBrandProjectionV1 = {
  schemaVersion: 1,
  brandProjectionId: 'campaign-brand_currentness',
  workspaceId,
  version: 1,
  source: { kind: 'CAMPAIGN_LOCAL_PRESENTATION', sourceRef: 'campaign-brand-source' },
  presentation: { displayName: 'Example' },
  brandProjectionFingerprintSha256: 'e'.repeat(64),
  capturedAt: '2026-09-19T00:00:00.000Z',
  canonicalWorkspaceBrandCreated: false
};

const campaign: EmailCampaignV1 = {
  schemaVersion: 1,
  campaignId: 'email-campaign_currentness',
  workspaceId,
  version: 1,
  featureKey: 'EMAIL_CAMPAIGN',
  purpose: 'PROSPECT_OUTREACH',
  audience: {
    audienceSnapshotId: audience.audienceSnapshotId,
    version: 1,
    fingerprintSha256: audience.audienceFingerprintSha256
  },
  content: {
    contentProjectionId: contentProjection.contentProjectionId,
    version: 1,
    fingerprintSha256: contentProjection.projectionFingerprintSha256
  },
  brand: {
    brandProjectionId: brand.brandProjectionId,
    version: 1,
    fingerprintSha256: brand.brandProjectionFingerprintSha256
  },
  campaignFingerprintSha256: 'f'.repeat(64),
  status: 'REVIEWED_READY_FOR_DELIVERY_PREPARATION',
  humanReviewRequired: true,
  createdAt: '2026-09-19T00:00:00.000Z',
  updatedAt: '2026-09-19T00:00:00.000Z',
  authority: noEmailCampaignAuthorityConsequencesV1
};

const review: CampaignReviewDecisionV1 = {
  schemaVersion: 1,
  campaignReviewDecisionId: 'campaign-review_currentness',
  workspaceId,
  version: 1,
  campaign: { campaignId: campaign.campaignId, version: 1 },
  expectedCampaignFingerprintSha256: campaign.campaignFingerprintSha256,
  outcome: 'APPROVED_FOR_DELIVERY_PREPARATION',
  reviewerPrincipalId: 'principal_reviewer',
  rationale: 'Reviewed.',
  reviewedAt: '2026-09-19T00:00:00.000Z',
  deliveryPreparationOnly: true,
  authority: noEmailCampaignAuthorityConsequencesV1
};

const sender: WorkspaceEmailSenderProfileV1 = {
  schemaVersion: 1,
  senderProfileId: 'email-sender-profile_primary',
  workspaceId,
  version: 1,
  status: 'ACTIVE',
  fromDomain: 'mail.example.com',
  fromAddress: 'hello@mail.example.com',
  displayName: 'Example',
  replyTo: { mode: 'SAME_AS_FROM' },
  verification: {
    status: 'VERIFIED',
    evidenceRefs: ['dns:verified'],
    observedAt: '2026-09-19T00:00:00.000Z'
  },
  providerRoutingPartitionRef: 'routing:workspace',
  ratePolicyRef: 'rate:default',
  reputationIsolationKey: 'reputation:workspace',
  createdAt: '2026-09-19T00:00:00.000Z',
  updatedAt: '2026-09-19T00:00:00.000Z',
  authority: noWorkspaceEmailSenderProfileAuthorityConsequencesV1
};

const receipt: CoreHumanActionReceiptBindingV1 = {
  schemaVersion: 1,
  receiptId: '018f0000-0000-7000-8000-000000001354',
  receiptVersion: 1,
  workspaceId,
  userId: '018f0000-0000-7000-8000-000000001355',
  membershipId: '018f0000-0000-7000-8000-000000001356',
  principalReference: 'core-workspace-principal:currentness',
  kind: 'EMAIL_CAMPAIGN_SEND',
  mutationRoute: '/api/execution/protected-external-actions/email-campaign-send/authorizations',
  reviewedActionDigest: '9'.repeat(64),
  idempotencyKey: 'authorize-currentness',
  authenticatedAt: '2026-09-19T00:00:00.000Z',
  authorityReference: 'core-governed-human-action-receipt:currentness',
  authorityVersion: 1,
  affirmativeHumanActionEvidenceReference: 'core-governed-human-action-evidence:currentness',
  source: 'CORE',
  actorKind: 'HUMAN_USER',
  workspaceVersion: 1,
  userVersion: 1,
  membershipVersion: 1,
  createdAt: '2026-09-19T00:00:00.000Z'
};

function intent(): EmailCampaignSendIntentV1 {
  const base = {
    schemaVersion: 1 as const,
    actionKind: 'EMAIL_CAMPAIGN_SEND' as const,
    workspaceId,
    campaign: {
      id: campaign.campaignId,
      version: campaign.version,
      fingerprintSha256: campaign.campaignFingerprintSha256
    },
    campaignReview: { id: review.campaignReviewDecisionId, version: review.version },
    senderProfile: {
      id: sender.senderProfileId,
      version: sender.version,
      fingerprintSha256: hash(sender)
    },
    audience: {
      id: audience.audienceSnapshotId,
      version: audience.version,
      fingerprintSha256: audience.audienceFingerprintSha256
    },
    content: {
      id: contentProjection.contentProjectionId,
      version: contentProjection.version,
      fingerprintSha256: contentProjection.projectionFingerprintSha256
    },
    brand: {
      id: brand.brandProjectionId,
      version: brand.version,
      fingerprintSha256: brand.brandProjectionFingerprintSha256
    },
    recipientCount: 1,
    deliveryPlanFingerprintSha256: '',
    effectFingerprintSha256: ''
  };
  const deliveryPlanFingerprintSha256 = hash(
    canonicalEmailCampaignSendIntentPayloadV1({
      ...base,
      deliveryPlanFingerprintSha256: '0'.repeat(64),
      effectFingerprintSha256: '0'.repeat(64)
    })
  );
  return {
    ...base,
    deliveryPlanFingerprintSha256,
    effectFingerprintSha256: hash({
      ...canonicalEmailCampaignSendIntentPayloadV1({
        ...base,
        deliveryPlanFingerprintSha256,
        effectFingerprintSha256: '0'.repeat(64)
      }),
      deliveryPlanFingerprintSha256
    })
  };
}

function harness(
  options: {
    endpointState?: 'CURRENT' | 'STALE' | 'NOT_FOUND' | 'UNKNOWN' | 'UNAVAILABLE';
    readiness?: 'READY_FOR_HUMAN_SEND' | 'BLOCKED' | 'UNKNOWN';
    entitlement?: 'CURRENT' | 'DENIED' | 'UNAVAILABLE';
    senderState?:
      'CURRENT_ELIGIBLE' | 'SUSPENDED' | 'REVOKED' | 'STALE' | 'UNKNOWN' | 'UNAVAILABLE';
  } = {}
) {
  const campaigns = {
    loadReviewedAggregate: vi.fn(() =>
      Promise.resolve({ campaign, audience, content: contentProjection, brand, review })
    ),
    getLatestCampaign: vi.fn(() => Promise.resolve(campaign))
  };
  const senders = {
    getExactSenderProfile: vi.fn(() => Promise.resolve(sender)),
    evaluateSenderProfileCurrentness: vi.fn(() =>
      Promise.resolve({
        schemaVersion: 1 as const,
        workspaceId,
        senderProfileId: sender.senderProfileId,
        version: sender.version,
        state: options.senderState ?? ('CURRENT_ELIGIBLE' as const),
        evaluatedAt: '2026-09-19T00:10:00.000Z',
        verificationObservedAt: sender.verification.observedAt,
        createsSendAuthority: false as const
      })
    )
  };
  const endpoints: EmailCampaignEndpointResolver = {
    resolve: vi.fn(() =>
      Promise.resolve({
        state: options.endpointState ?? 'CURRENT',
        endpoint,
        endpointFingerprintSha256
      })
    )
  };
  const outbound: EmailCampaignReadinessEvaluator = {
    evaluate: vi.fn(
      (
        command: Parameters<EmailCampaignReadinessEvaluator['evaluate']>[0]
      ): Promise<OutboundContactReadinessV1> =>
        Promise.resolve({
          schemaVersion: 1,
          workspaceId,
          evaluatedByPrincipalId: command.actorPrincipalId,
          targetRef: command.targetRef,
          channel: 'EMAIL',
          endpointFingerprintSha256: command.endpointFingerprintSha256,
          purpose: 'PROSPECT_OUTREACH',
          policyRef: command.policyRef,
          reviewedSendFingerprintSha256: command.reviewedSendFingerprintSha256,
          outcome: options.readiness ?? 'READY_FOR_HUMAN_SEND',
          reason:
            options.readiness === 'BLOCKED'
              ? 'ACTIVE_SUPPRESSION'
              : options.readiness === 'UNKNOWN'
                ? 'NO_CURRENT_ASSERTION'
                : 'CURRENT_ALLOWED_ASSERTION',
          basisAssertionRef: {
            assertionId: 'outbound-contact-basis_currentness',
            version: 1
          },
          suppressionRefs: [],
          evaluatedAt: '2026-09-19T00:10:00.000Z',
          readinessFingerprintSha256: '8'.repeat(64),
          authorityConsequences: {
            legalConsentVerifiedByMarkOrbit: false,
            externalMessageSent: false,
            protectedActionAuthorized: false
          }
        })
    )
  };
  const entitlements: EmailCampaignEntitlementReader = {
    resolve: vi.fn((): Promise<EmailCampaignEntitlementResolution> => {
      if (options.entitlement === 'UNAVAILABLE') return Promise.resolve({ state: 'UNAVAILABLE' });
      return Promise.resolve({
        state: 'CURRENT',
        access: {
          schemaVersion: 1,
          workspaceId,
          featureKey: 'EMAIL_CAMPAIGN',
          entitlementKey: 'lite.channel.email.campaign',
          status: options.entitlement === 'DENIED' ? 'DISABLED' : 'ENABLED',
          allowed: options.entitlement !== 'DENIED',
          authority: {
            credentialAuthorityGranted: false,
            providerSelectionAuthorityGranted: false,
            protectedActionAuthorized: false,
            externalSendAuthorized: false,
            externalPublicationCreated: false,
            customerTruthCreated: false,
            orderCreated: false,
            matterCreated: false,
            trademarkTruthCreated: false
          }
        }
      });
    })
  };
  return new EmailCampaignDeliveryCurrentnessResolver(
    campaigns,
    senders,
    endpoints,
    outbound,
    entitlements
  );
}

describe('Email Campaign delivery currentness', () => {
  it('returns CURRENT only when every owner is current', async () => {
    await expect(harness().resolve(workspaceId, intent(), receipt)).resolves.toMatchObject({
      state: 'CURRENT',
      reason: 'EXACT_DELIVERY_PLAN_CURRENT'
    });
  });

  it('fails closed when entitlement is revoked or unavailable', async () => {
    await expect(
      harness({ entitlement: 'DENIED' }).resolve(workspaceId, intent(), receipt)
    ).resolves.toMatchObject({ state: 'REVOKED', reason: 'ENTITLEMENT_REVOKED' });
    await expect(
      harness({ entitlement: 'UNAVAILABLE' }).resolve(workspaceId, intent(), receipt)
    ).resolves.toMatchObject({ state: 'UNAVAILABLE', reason: 'OWNER_UNAVAILABLE' });
  });

  it('fails closed for sender, endpoint and suppression drift', async () => {
    await expect(
      harness({ senderState: 'SUSPENDED' }).resolve(workspaceId, intent(), receipt)
    ).resolves.toMatchObject({ state: 'STALE', reason: 'SENDER_PROFILE_STALE' });
    await expect(
      harness({ endpointState: 'STALE' }).resolve(workspaceId, intent(), receipt)
    ).resolves.toMatchObject({ state: 'STALE', reason: 'ENDPOINT_DRIFT' });
    await expect(
      harness({ readiness: 'BLOCKED' }).resolve(workspaceId, intent(), receipt)
    ).resolves.toMatchObject({
      state: 'SUPPRESSED',
      reason: 'OUTBOUND_POLICY_SUPPRESSED'
    });
  });

  it('fails closed when Workspace or delivery-plan fingerprints drift', async () => {
    await expect(
      harness().resolve('15151515-1515-4515-8515-151515151515', intent(), receipt)
    ).resolves.toMatchObject({ state: 'UNKNOWN', reason: 'WORKSPACE_MISMATCH' });
    await expect(
      harness().resolve(
        workspaceId,
        { ...intent(), deliveryPlanFingerprintSha256: '0'.repeat(64) },
        receipt
      )
    ).resolves.toMatchObject({ state: 'UNKNOWN', reason: 'FINGERPRINT_MISMATCH' });
  });
});
