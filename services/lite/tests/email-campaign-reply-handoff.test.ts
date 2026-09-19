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
import {
  noManagedCommunicationReplyReferenceAuthorityConsequencesV1,
  type ManagedCommunicationReplyReferenceEvidenceV1
} from '@markorbit/contracts/managed-communication-reply-reference';
import {
  EmailCampaignReplyCorrelationError,
  EmailCampaignReplyHandoffServiceV1,
  type EmailCampaignReplyReferenceCorrelatorV1,
  type RecordEmailCampaignReplyHandoffCommandV1
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
  status: 'REVIEWED_READY_FOR_DELIVERY_PREPARATION',
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

const replyReference: ManagedCommunicationReplyReferenceEvidenceV1 = {
  schemaVersion: 1,
  workspaceId,
  accountRef: 'managed-account_reply',
  messageId: 'managed-message_reply',
  threadRef: 'managed-thread_reply',
  provider: 'MICROSOFT_GRAPH',
  providerMessageId: 'AQMk-reply',
  observedAt: '2026-09-19T06:00:01.000Z',
  inReplyToMessageIds: ['010001reply-000000@email.amazonses.com'],
  referenceMessageIds: [],
  exactEvidence: {
    evidenceRef: 'commevidence_reply',
    sha256: '9'.repeat(64)
  },
  authority: noManagedCommunicationReplyReferenceAuthorityConsequencesV1
};

function service(options?: {
  correlator?: EmailCampaignReplyReferenceCorrelatorV1;
  attempts?: Record<string, EmailDeliveryAttemptV1 | undefined>;
  profile?: WorkspaceEmailSenderProfileV1;
  replyReference?: ManagedCommunicationReplyReferenceEvidenceV1;
}) {
  const primary = attempt('reply', '010001reply-000000');
  const attempts = options?.attempts ?? {
    '010001reply-000000': primary
  };
  const writer = {
    recordHandoff: vi.fn((command: Readonly<RecordEmailCampaignReplyHandoffCommandV1>) =>
      Promise.resolve(command.value)
    )
  };
  const managedCommunication = {
    resolveReplyReferenceEvidence: vi.fn(() =>
      Promise.resolve(options?.replyReference ?? replyReference)
    )
  };
  const runtime = new EmailCampaignReplyHandoffServiceV1(
    managedCommunication,
    {
      findAttemptByProviderSubmissionRef: vi.fn(
        (_workspaceId: string, providerSubmissionRef: string) =>
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
          evidenceMethod: 'RFC_IN_REPLY_TO' as const
        }
      ])
    },
    writer,
    () => '2026-09-19T06:01:00.000Z'
  );
  return { runtime, writer, managedCommunication };
}

const correlateInput = {
  workspaceId,
  accountRef: replyReference.accountRef,
  messageId: replyReference.messageId
};

describe('Email Campaign reply handoff runtime', () => {
  it('correlates bounded already-admitted reply references against historical exact lineage', async () => {
    const { runtime, writer, managedCommunication } = service();
    const result = await runtime.correlate({
      ...correlateInput,
      idempotencyKey: 'reply-handoff-primary'
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
        accountRef: replyReference.accountRef,
        messageId: replyReference.messageId,
        providerMessageId: replyReference.providerMessageId
      },
      outboundProviderSubmissionRef: '010001reply-000000',
      correlationMethod: 'PROVIDER_MESSAGE_REFERENCE',
      status: 'CORRELATED'
    });
    expect(Object.values(result.authority).every((value) => value === false)).toBe(true);
    expect(managedCommunication.resolveReplyReferenceEvidence).toHaveBeenCalledWith(correlateInput);
    expect(writer.recordHandoff).toHaveBeenCalledTimes(1);
  });

  it('does not require a historical sender profile to remain currently active', async () => {
    const { runtime } = service({ profile: senderProfile });
    await expect(
      runtime.correlate({
        ...correlateInput,
        idempotencyKey: 'reply-handoff-revoked'
      })
    ).resolves.toMatchObject({
      senderProfile: { senderProfileId: senderProfile.senderProfileId, version: 3 }
    });
  });

  it('fails closed when the bounded Managed Communication evidence escapes exact Workspace lineage', async () => {
    const { runtime } = service({
      replyReference: {
        ...replyReference,
        workspaceId: '24242424-2424-4424-8424-242424242424'
      }
    });
    await expect(
      runtime.correlate({
        ...correlateInput,
        idempotencyKey: 'reply-handoff-lineage-mismatch'
      })
    ).rejects.toMatchObject({ code: 'LINEAGE_MISMATCH' });
  });

  it('fails closed when the historical SenderProfile reply account differs', async () => {
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
        ...correlateInput,
        idempotencyKey: 'reply-handoff-profile-account-mismatch'
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
            evidenceMethod: 'RFC_IN_REPLY_TO'
          },
          {
            providerSubmissionRef: '010001second-000000',
            evidenceMethod: 'RFC_REFERENCES'
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
        ...correlateInput,
        idempotencyKey: 'reply-handoff-ambiguous'
      })
    ).rejects.toMatchObject({ code: 'CORRELATION_AMBIGUOUS' });
  });

  it('rejects runtime clocks that precede admitted reply evidence', async () => {
    const { runtime } = service({
      replyReference: {
        ...replyReference,
        observedAt: '2026-09-19T06:02:00.000Z'
      }
    });
    await expect(
      runtime.correlate({
        ...correlateInput,
        idempotencyKey: 'reply-handoff-clock'
      })
    ).rejects.toBeInstanceOf(EmailCampaignReplyCorrelationError);
  });
});
