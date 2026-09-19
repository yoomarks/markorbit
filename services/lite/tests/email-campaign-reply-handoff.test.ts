import { describe, expect, it, vi } from 'vitest';
import {
  noEmailCampaignAuthorityConsequencesV1,
  type EmailCampaignV1
} from '@markorbit/contracts/email-campaign';
import {
  noEmailDeliveryAuthorityConsequencesV1,
  type EmailDeliveryAttemptV1
} from '@markorbit/contracts/email-delivery';
import {
  noWorkspaceEmailSenderProfileAuthorityConsequencesV1,
  type WorkspaceEmailSenderProfileV1
} from '@markorbit/contracts/email-sender-profile';
import type { ManagedCommunicationMessageV1 } from '@markorbit/contracts/managed-communication';
import {
  EmailCampaignReplyCorrelationError,
  EmailCampaignReplyHandoffServiceV1,
  type EmailCampaignReplyReferenceCorrelatorV1
} from '../src/email-campaign-reply-handoff.js';

const workspaceId = '14141414-1414-4414-8414-141414141414';

const campaign: EmailCampaignV1 = {
  schemaVersion: 1,
  campaignId: 'email-campaign_reply',
  workspaceId,
  version: 2,
  featureKey: 'EMAIL_CAMPAIGN',
  purpose: 'PROSPECT_OUTREACH',
  audience: {
    audienceSnapshotId: 'campaign-audience_reply',
    version: 1,
    fingerprintSha256: '1'.repeat(64)
  },
  content: {
    contentProjectionId: 'campaign-content_reply',
    version: 1,
    fingerprintSha256: '2'.repeat(64)
  },
  brand: {
    brandProjectionId: 'campaign-brand_reply',
    version: 1,
    fingerprintSha256: '3'.repeat(64)
  },
  campaignFingerprintSha256: '4'.repeat(64),
  status: 'DELIVERY_PREPARED',
  humanReviewRequired: true,
  createdAt: '2026-09-19T05:00:00.000Z',
  updatedAt: '2026-09-19T05:01:00.000Z',
  authority: noEmailCampaignAuthorityConsequencesV1
};

function attempt(suffix: string, providerSubmissionRef: string): EmailDeliveryAttemptV1 {
  return {
    schemaVersion: 1,
    deliveryAttemptId: `email-delivery-attempt_${suffix}`,
    version: 1,
    workspaceId,
    executionRelease: {
      releaseId: `protected-action-release_${suffix}`,
      version: 1,
      effectFingerprintSha256: '5'.repeat(64)
    },
    campaign: { campaignId: campaign.campaignId, version: campaign.version },
    senderProfile: {
      senderProfileId: 'email-sender-profile_reply',
      version: 3,
      fingerprintSha256: '6'.repeat(64)
    },
    implementation: {
      implementationProfileId: 'implementation-profile_amazon-ses-v2',
      version: 1
    },
    shardIndex: 0,
    recipientCount: 1,
    recipientManifestFingerprintSha256: '7'.repeat(64),
    deliveryPlanFingerprintSha256: '8'.repeat(64),
    correlationId: `reply:${suffix}`,
    attemptNumber: 1,
    status: 'ACCEPTED',
    providerSubmissionRef,
    createdAt: '2026-09-19T05:02:00.000Z',
    updatedAt: '2026-09-19T05:03:00.000Z',
    authority: noEmailDeliveryAuthorityConsequencesV1
  };
}

const senderProfile: WorkspaceEmailSenderProfileV1 = {
  schemaVersion: 1,
  senderProfileId: 'email-sender-profile_reply',
  workspaceId,
  version: 3,
  status: 'REVOKED',
  fromDomain: 'example.com',
  fromAddress: 'campaign@example.com',
  displayName: 'Campaign Team',
  replyTo: {
    mode: 'MANAGED_COMMUNICATION',
    accountRef: 'managed-account_reply'
  },
  verification: {
    status: 'VERIFIED',
    evidenceRefs: ['provider-verification:reply'],
    observedAt: '2026-09-19T04:00:00.000Z'
  },
  providerRoutingPartitionRef: 'ses-routing_reply',
  ratePolicyRef: 'rate-policy_reply',
  reputationIsolationKey: 'reputation_reply',
  createdAt: '2026-09-19T03:00:00.000Z',
  updatedAt: '2026-09-19T04:00:00.000Z',
  authority: noWorkspaceEmailSenderProfileAuthorityConsequencesV1
};

const message: ManagedCommunicationMessageV1 = {
  schemaVersion: 1,
  messageId: 'managed-message_reply',
  accountRef: 'managed-account_reply',
  threadRef: 'managed-thread_reply',
  channel: 'EMAIL',
  direction: 'INBOUND',
  participants: [{ role: 'SENDER', address: 'person@example.net' }],
  attachments: [],
  occurredAt: '2026-09-19T06:00:00.000Z',
  providerObservation: {
    provider: 'MICROSOFT_GRAPH',
    providerMessageId: 'AQMk-reply',
    observedAt: '2026-09-19T06:00:01.000Z'
  }
};

const exactEvidence = {
  evidenceRef: 'commevidence_reply',
  sha256: '9'.repeat(64),
  provider: 'MICROSOFT_GRAPH',
  providerMessageId: 'AQMk-reply',
  observedAt: '2026-09-19T06:00:01.000Z',
  headers: [
    {
      name: 'in-reply-to',
      value: '<010001reply-000000@email.amazonses.com>'
    }
  ]
};

function service(options?: {
  correlator?: EmailCampaignReplyReferenceCorrelatorV1;
  attempts?: Record<string, EmailDeliveryAttemptV1 | undefined>;
  profile?: WorkspaceEmailSenderProfileV1;
}) {
  const primary = attempt('reply', '010001reply-000000');
  const attempts = options?.attempts ?? {
    '010001reply-000000': primary
  };
  const writer = {
    recordHandoff: vi.fn((command) => Promise.resolve(command.value))
  };
  const runtime = new EmailCampaignReplyHandoffServiceV1(
    {
      findAttemptByProviderSubmissionRef: vi.fn((_workspaceId, providerSubmissionRef) =>
        Promise.resolve(attempts[providerSubmissionRef])
      )
    },
    {
      getCampaignVersion: vi.fn(() => Promise.resolve(campaign))
    },
    {
      getExactSenderProfile: vi.fn(() => Promise.resolve(options?.profile ?? senderProfile))
    },
    options?.correlator ?? {
      candidates: vi.fn(() => [
        {
          providerSubmissionRef: '010001reply-000000',
          correlationMethod: 'RFC_IN_REPLY_TO' as const
        }
      ])
    },
    writer,
    () => '2026-09-19T06:01:00.000Z'
  );
  return { runtime, writer };
}

describe('Email Campaign reply handoff runtime', () => {
  it('correlates a real inbound reply against historical exact lineage', async () => {
    const { runtime, writer } = service();
    const result = await runtime.correlate({
      workspaceId,
      idempotencyKey: 'reply-handoff-primary',
      message,
      exactEvidence
    });

    expect(result).toMatchObject({
      workspaceId,
      campaign: { campaignId: campaign.campaignId, version: campaign.version },
      deliveryAttempt: {
        deliveryAttemptId: 'email-delivery-attempt_reply',
        version: 1
      },
      senderProfile: {
        senderProfileId: senderProfile.senderProfileId,
        version: senderProfile.version
      },
      managedCommunication: {
        accountRef: message.accountRef,
        messageId: message.messageId,
        providerMessageId: message.providerObservation.providerMessageId
      },
      outboundProviderSubmissionRef: '010001reply-000000',
      correlationMethod: 'RFC_IN_REPLY_TO',
      status: 'CORRELATED'
    });
    expect(Object.values(result.authority).every((value) => value === false)).toBe(true);
    expect(writer.recordHandoff).toHaveBeenCalledTimes(1);
  });

  it('does not require a historical sender profile to remain currently active', async () => {
    const { runtime } = service({ profile: senderProfile });
    await expect(
      runtime.correlate({
        workspaceId,
        idempotencyKey: 'reply-handoff-revoked',
        message,
        exactEvidence
      })
    ).resolves.toMatchObject({
      senderProfile: { senderProfileId: senderProfile.senderProfileId, version: 3 }
    });
  });

  it('fails closed when the Managed Communication account differs from the historical reply target', async () => {
    const { runtime } = service({
      profile: {
        ...senderProfile,
        replyTo: {
          mode: 'MANAGED_COMMUNICATION',
          accountRef: 'managed-account_other'
        }
      }
    });
    await expect(
      runtime.correlate({
        workspaceId,
        idempotencyKey: 'reply-handoff-account-mismatch',
        message,
        exactEvidence
      })
    ).rejects.toMatchObject({ code: 'REPLY_ACCOUNT_MISMATCH' });
  });

  it('fails closed when multiple distinct delivery attempts are referenced', async () => {
    const second = attempt('second', '010001second-000000');
    const { runtime } = service({
      correlator: {
        candidates: () => [
          {
            providerSubmissionRef: '010001reply-000000',
            correlationMethod: 'RFC_IN_REPLY_TO'
          },
          {
            providerSubmissionRef: '010001second-000000',
            correlationMethod: 'RFC_REFERENCES'
          }
        ]
      },
      attempts: {
        '010001reply-000000': attempt('reply', '010001reply-000000'),
        '010001second-000000': second
      }
    });
    await expect(
      runtime.correlate({
        workspaceId,
        idempotencyKey: 'reply-handoff-ambiguous',
        message,
        exactEvidence
      })
    ).rejects.toMatchObject({ code: 'CORRELATION_AMBIGUOUS' });
  });

  it('rejects inbound exact evidence that does not match the normalized message provenance', async () => {
    const { runtime } = service();
    await expect(
      runtime.correlate({
        workspaceId,
        idempotencyKey: 'reply-handoff-evidence-mismatch',
        message,
        exactEvidence: {
          ...exactEvidence,
          providerMessageId: 'AQMk-other'
        }
      })
    ).rejects.toBeInstanceOf(EmailCampaignReplyCorrelationError);
  });
});
