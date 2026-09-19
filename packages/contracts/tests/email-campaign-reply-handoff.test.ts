import { describe, expect, it } from 'vitest';
import {
  noEmailCampaignReplyHandoffAuthorityConsequencesV1,
  parseEmailCampaignReplyHandoffV1
} from '../src/email-campaign-reply-handoff.js';

const value = {
  schemaVersion: 1 as const,
  replyHandoffId: 'email-campaign-reply-handoff_primary' as const,
  workspaceId: '14141414-1414-4414-8414-141414141414',
  campaign: { campaignId: 'email-campaign_primary' as const, version: 2 },
  deliveryAttempt: {
    deliveryAttemptId: 'email-delivery-attempt_primary' as const,
    version: 1 as const
  },
  senderProfile: { senderProfileId: 'email-sender-profile_primary' as const, version: 3 },
  managedCommunication: {
    accountRef: 'managed-account_primary',
    messageId: 'managed-message_primary',
    threadRef: 'managed-thread_primary',
    provider: 'MICROSOFT_GRAPH',
    providerMessageId: 'AQMk-provider-message',
    observedAt: '2026-09-19T06:00:00.000Z'
  },
  inboundEvidence: {
    evidenceRef: 'commevidence_primary',
    sha256: '1'.repeat(64)
  },
  outboundProviderSubmissionRef: '01000199abcdef-000000',
  correlationMethod: 'PROVIDER_MESSAGE_REFERENCE' as const,
  correlationEvidenceFingerprintSha256: '2'.repeat(64),
  status: 'CORRELATED' as const,
  createdAt: '2026-09-19T06:01:00.000Z',
  authority: noEmailCampaignReplyHandoffAuthorityConsequencesV1
};

describe('Email Campaign reply handoff contract', () => {
  it('admits only bounded correlated reply evidence', () => {
    expect(parseEmailCampaignReplyHandoffV1(value)).toEqual(value);
  });

  it('rejects raw communication content and addresses', () => {
    expect(() => parseEmailCampaignReplyHandoffV1({ ...value, subject: 'Reply subject' })).toThrow(
      /forbidden material/
    );
    expect(() =>
      parseEmailCampaignReplyHandoffV1({ ...value, recipientEmail: 'person@example.com' })
    ).toThrow(/forbidden material/);
  });

  it('rejects authority escalation', () => {
    expect(() =>
      parseEmailCampaignReplyHandoffV1({
        ...value,
        authority: { ...value.authority, businessSuccessCreated: true }
      })
    ).toThrow(/businessSuccessCreated/);
  });

  it('rejects unsupported correlation methods', () => {
    expect(() =>
      parseEmailCampaignReplyHandoffV1({ ...value, correlationMethod: 'RFC_IN_REPLY_TO' })
    ).toThrow(/correlationMethod/);
  });
});
