import { describe, expect, it, vi } from 'vitest';
import {
  noEmailCampaignAuthorityConsequencesV1,
  type CampaignAudienceSnapshotV1,
  type EmailCampaignV1
} from '@markorbit/contracts/email-campaign';
import {
  noEmailDeliveryAuthorityConsequencesV1,
  type EmailDeliveryAttemptV1,
  type EmailDeliveryObservationV1
} from '@markorbit/contracts/email-delivery';
import {
  EmailCampaignDeliveryAnalyticsRuntimeError,
  EmailCampaignDeliveryAnalyticsService,
  type EmailCampaignDeliveryAnalyticsCampaignReader,
  type EmailCampaignDeliveryAnalyticsEvidenceReader
} from '../src/email-campaign-delivery-analytics.js';

const workspaceId = '14141414-1414-4414-8414-141414141414';

const audience: CampaignAudienceSnapshotV1 = {
  schemaVersion: 1,
  audienceSnapshotId: 'campaign-audience_analytics',
  workspaceId,
  version: 1,
  channel: 'EMAIL',
  reviewedSendFingerprintSha256: 'c'.repeat(64),
  entries: [
    {
      targetRef: {
        owner: 'LITE',
        kind: 'WORKSPACE_DIRECTORY_ENTRY',
        id: 'workspace-directory-entry_one',
        version: 1
      },
      endpointFingerprintSha256: '1'.repeat(64),
      purpose: 'PROSPECT_OUTREACH',
      policyRef: { policyId: 'policy_analytics', version: 1 },
      readiness: {
        evaluatedAt: '2026-09-19T00:00:00.000Z',
        readinessFingerprintSha256: '2'.repeat(64),
        reviewedSendFingerprintSha256: 'c'.repeat(64),
        outcome: 'READY_FOR_HUMAN_SEND',
        reason: 'CURRENT_ALLOWED_ASSERTION',
        basisAssertionRef: { assertionId: 'outbound-contact-basis_one', version: 1 },
        suppressionRefs: []
      }
    },
    {
      targetRef: {
        owner: 'LITE',
        kind: 'WORKSPACE_DIRECTORY_ENTRY',
        id: 'workspace-directory-entry_two',
        version: 1
      },
      endpointFingerprintSha256: '3'.repeat(64),
      purpose: 'PROSPECT_OUTREACH',
      policyRef: { policyId: 'policy_analytics', version: 1 },
      readiness: {
        evaluatedAt: '2026-09-19T00:00:00.000Z',
        readinessFingerprintSha256: '4'.repeat(64),
        reviewedSendFingerprintSha256: 'c'.repeat(64),
        outcome: 'READY_FOR_HUMAN_SEND',
        reason: 'CURRENT_ALLOWED_ASSERTION',
        basisAssertionRef: { assertionId: 'outbound-contact-basis_two', version: 1 },
        suppressionRefs: []
      }
    }
  ],
  audienceFingerprintSha256: 'a'.repeat(64),
  capturedAt: '2026-09-19T00:00:00.000Z',
  legalConsentVerifiedByMarkOrbit: false,
  externalSendAuthorized: false
};

const campaign: EmailCampaignV1 = {
  schemaVersion: 1,
  campaignId: 'email-campaign_analytics',
  workspaceId,
  version: 1,
  featureKey: 'EMAIL_CAMPAIGN',
  purpose: 'PROSPECT_OUTREACH',
  audience: {
    audienceSnapshotId: audience.audienceSnapshotId,
    version: audience.version,
    fingerprintSha256: audience.audienceFingerprintSha256
  },
  content: {
    contentProjectionId: 'campaign-content_analytics',
    version: 1,
    fingerprintSha256: '5'.repeat(64)
  },
  brand: {
    brandProjectionId: 'campaign-brand_analytics',
    version: 1,
    fingerprintSha256: '6'.repeat(64)
  },
  campaignFingerprintSha256: '7'.repeat(64),
  status: 'REVIEWED_READY_FOR_DELIVERY_PREPARATION',
  humanReviewRequired: true,
  createdAt: '2026-09-19T00:00:00.000Z',
  updatedAt: '2026-09-19T00:00:00.000Z',
  authority: noEmailCampaignAuthorityConsequencesV1
};

function attempt(suffix: string, status: EmailDeliveryAttemptV1['status']): EmailDeliveryAttemptV1 {
  return {
    schemaVersion: 1,
    deliveryAttemptId: `email-delivery-attempt_${suffix}`,
    version: 1,
    workspaceId,
    executionRelease: {
      releaseId: `protected-action-release_${suffix}`,
      version: 1,
      effectFingerprintSha256: '8'.repeat(64)
    },
    campaign: { campaignId: campaign.campaignId, version: campaign.version },
    senderProfile: {
      senderProfileId: 'email-sender-profile_analytics',
      version: 1,
      fingerprintSha256: '9'.repeat(64)
    },
    implementation: {
      implementationProfileId: 'implementation-profile_amazon-ses-v2',
      version: 1
    },
    shardIndex: suffix === 'one' ? 0 : 1,
    recipientCount: 1,
    recipientManifestFingerprintSha256: 'b'.repeat(64),
    deliveryPlanFingerprintSha256: 'd'.repeat(64),
    correlationId: `analytics:${suffix}`,
    attemptNumber: 1,
    status,
    ...(status === 'ACCEPTED' ? { providerSubmissionRef: `ses-${suffix}` } : {}),
    createdAt: '2026-09-19T00:01:00.000Z',
    updatedAt: '2026-09-19T00:02:00.000Z',
    authority: noEmailDeliveryAuthorityConsequencesV1
  };
}

function observation(
  attemptValue: EmailDeliveryAttemptV1,
  event: EmailDeliveryObservationV1['event'],
  identity: string,
  observedAt: string
): EmailDeliveryObservationV1 {
  return {
    schemaVersion: 1,
    observationId: `email-delivery-observation_${identity}`,
    version: 1,
    workspaceId,
    deliveryAttempt: { deliveryAttemptId: attemptValue.deliveryAttemptId, version: 1 },
    eventIdentity: `provider:${identity}`,
    event,
    evidenceKind: 'PROVIDER_EVENT',
    providerMessageRef: `ses-${identity}`,
    endpointFingerprintSha256: 'e'.repeat(64),
    authenticatedEvidence: true,
    reasonCode: `TEST_${event}`,
    evidenceRefs: [`provider:${identity}`],
    eventAt: observedAt,
    observedAt,
    authority: noEmailDeliveryAuthorityConsequencesV1
  };
}

function service(
  attempts: readonly EmailDeliveryAttemptV1[],
  observations: readonly EmailDeliveryObservationV1[]
) {
  const campaigns: EmailCampaignDeliveryAnalyticsCampaignReader = {
    getCampaignVersion: vi.fn(() => Promise.resolve(campaign)),
    getAudienceSnapshot: vi.fn(() => Promise.resolve(audience))
  };
  const delivery: EmailCampaignDeliveryAnalyticsEvidenceReader = {
    listCampaignAttempts: vi.fn(() => Promise.resolve(attempts)),
    listCampaignObservations: vi.fn(() => Promise.resolve(observations))
  };
  return new EmailCampaignDeliveryAnalyticsService(
    campaigns,
    delivery,
    () => '2026-09-19T00:10:00.000Z'
  );
}

describe('Email Campaign delivery analytics', () => {
  it('derives distinct evidence counters without double counting duplicate outcomes', async () => {
    const one = attempt('one', 'ACCEPTED');
    const two = attempt('two', 'UNKNOWN');
    const result = await service(
      [one, two],
      [
        observation(one, 'ACCEPTED', 'accepted-1', '2026-09-19T00:03:00.000Z'),
        observation(one, 'DELIVERED', 'delivered-1', '2026-09-19T00:04:00.000Z'),
        observation(one, 'DELIVERED', 'delivered-2', '2026-09-19T00:05:00.000Z'),
        observation(two, 'DEFERRED', 'deferred-1', '2026-09-19T00:06:00.000Z'),
        observation(two, 'SOFT_BOUNCED', 'soft-1', '2026-09-19T00:07:00.000Z')
      ]
    ).read({ workspaceId, campaignId: campaign.campaignId, campaignVersion: campaign.version });

    expect(result).toMatchObject({
      requested: 2,
      attempted: 2,
      accepted: 1,
      delivered: 1,
      deferred: 1,
      softBounced: 1,
      hardBounced: 0,
      failed: 0,
      unknown: 1,
      evidenceThrough: '2026-09-19T00:07:00.000Z'
    });
    expect(Object.values(result.authority).every((value) => value === false)).toBe(true);
  });

  it('allows chronology counters to overlap for the same attempt', async () => {
    const one = attempt('one', 'ACCEPTED');
    const result = await service(
      [one],
      [
        observation(one, 'DEFERRED', 'deferred', '2026-09-19T00:03:00.000Z'),
        observation(one, 'DELIVERED', 'delivered', '2026-09-19T00:04:00.000Z'),
        observation(one, 'COMPLAINED', 'complaint', '2026-09-19T00:05:00.000Z')
      ]
    ).read({ workspaceId, campaignId: campaign.campaignId, campaignVersion: campaign.version });
    expect(result).toMatchObject({ deferred: 1, delivered: 1, complained: 1 });
  });

  it('returns reviewed audience demand with zero delivery evidence before sending', async () => {
    const result = await service([], []).read({
      workspaceId,
      campaignId: campaign.campaignId,
      campaignVersion: campaign.version
    });
    expect(result).toMatchObject({
      requested: 2,
      attempted: 0,
      accepted: 0,
      delivered: 0,
      failed: 0,
      unknown: 0,
      evidenceThrough: campaign.updatedAt
    });
  });

  it('fails closed when an observation escapes exact attempt scope', async () => {
    const one = attempt('one', 'ACCEPTED');
    const escaped = observation(
      { ...one, deliveryAttemptId: 'email-delivery-attempt_other' },
      'DELIVERED',
      'escaped',
      '2026-09-19T00:04:00.000Z'
    );
    await expect(
      service([one], [escaped]).read({
        workspaceId,
        campaignId: campaign.campaignId,
        campaignVersion: campaign.version
      })
    ).rejects.toBeInstanceOf(EmailCampaignDeliveryAnalyticsRuntimeError);
  });
});
