import { describe, expect, it } from 'vitest';
import {
  noChannelNotificationAuthorityConsequencesV1,
  parseChannelNotificationRuleSpecV1,
  parseChannelNotificationSendIntentV1,
  parseChannelNotificationTriggerEvidenceV1
} from '../src/channel-notification.js';

const workspaceId = '14141414-1414-4414-8414-141414141414';

const rule = {
  schemaVersion: 1 as const,
  notificationRuleId: 'channel-notification-rule_primary' as const,
  workspaceId,
  version: 1,
  featureKey: 'EMAIL_NOTIFICATION' as const,
  triggerSelector: {
    owner: 'MARKREG',
    eventType: 'FORMAL_MATTER_STATUS_CHANGED',
    subjectKind: 'WORKSPACE_DIRECTORY_ENTRY'
  },
  destinationResolver: {
    kind: 'EVENT_SUBJECT_WORKSPACE_DIRECTORY_EMAIL' as const
  },
  content: {
    publishPackageId: 'publish-package_primary' as const,
    version: 2,
    fingerprintSha256: '1'.repeat(64)
  },
  senderProfile: {
    senderProfileId: 'email-sender-profile_primary' as const,
    version: 3,
    fingerprintSha256: '2'.repeat(64)
  },
  ratePolicyRef: 'notification-rate-policy_default',
  dedupePolicy: {
    mode: 'ONE_PER_RULE_TRIGGER' as const
  },
  ruleFingerprintSha256: '3'.repeat(64),
  authority: noChannelNotificationAuthorityConsequencesV1
};

const trigger = {
  schemaVersion: 1 as const,
  notificationTriggerEvidenceId: 'channel-notification-trigger_primary' as const,
  workspaceId,
  version: 1 as const,
  owner: 'MARKREG',
  eventType: 'FORMAL_MATTER_STATUS_CHANGED',
  eventId: 'markreg-event_primary',
  subject: {
    owner: 'LITE',
    kind: 'WORKSPACE_DIRECTORY_ENTRY',
    id: 'workspace-directory-entry_primary',
    version: 4
  },
  occurredAt: '2026-09-19T09:30:00.000Z',
  evidenceRefs: ['markreg-event:primary'],
  triggerFingerprintSha256: '4'.repeat(64),
  authority: noChannelNotificationAuthorityConsequencesV1
};

const smsRule = {
  schemaVersion: 1 as const,
  notificationRuleId: 'channel-notification-rule_sms-primary' as const,
  workspaceId,
  version: 1,
  featureKey: 'SMS_WORKSPACE_NOTIFICATION' as const,
  triggerSelector: rule.triggerSelector,
  destinationResolver: {
    kind: 'EVENT_SUBJECT_WORKSPACE_DIRECTORY_PHONE' as const
  },
  content: rule.content,
  channelIdentityBinding: {
    id: 'workspace-channel-identity-binding_primary' as const,
    version: 4,
    fingerprintSha256: '8'.repeat(64)
  },
  contactPolicyRef: {
    policyId: 'outbound-contact-policy_sms-notification',
    version: 2
  },
  ratePolicyRef: 'notification-rate-policy_sms-default',
  dedupePolicy: {
    mode: 'ONE_PER_RULE_TRIGGER' as const
  },
  ruleFingerprintSha256: '9'.repeat(64),
  authority: noChannelNotificationAuthorityConsequencesV1
};

const intent = {
  schemaVersion: 1 as const,
  notificationSendIntentId: 'channel-notification-send-intent_primary' as const,
  workspaceId,
  version: 1 as const,
  featureKey: 'EMAIL_NOTIFICATION' as const,
  rule: {
    notificationRuleId: rule.notificationRuleId,
    version: rule.version,
    fingerprintSha256: rule.ruleFingerprintSha256
  },
  trigger: {
    notificationTriggerEvidenceId: trigger.notificationTriggerEvidenceId,
    version: 1 as const,
    fingerprintSha256: trigger.triggerFingerprintSha256
  },
  target: {
    owner: 'LITE',
    kind: 'WORKSPACE_DIRECTORY_ENTRY',
    id: 'workspace-directory-entry_primary',
    version: 4,
    endpointFingerprintSha256: '5'.repeat(64)
  },
  content: rule.content,
  senderProfile: rule.senderProfile,
  deliveryPlanFingerprintSha256: '6'.repeat(64),
  effectFingerprintSha256: '7'.repeat(64),
  authority: noChannelNotificationAuthorityConsequencesV1
};

const smsIntent = {
  schemaVersion: 1 as const,
  notificationSendIntentId: 'channel-notification-send-intent_sms-primary' as const,
  workspaceId,
  version: 1 as const,
  featureKey: 'SMS_WORKSPACE_NOTIFICATION' as const,
  rule: {
    notificationRuleId: smsRule.notificationRuleId,
    version: smsRule.version,
    fingerprintSha256: smsRule.ruleFingerprintSha256
  },
  trigger: intent.trigger,
  target: intent.target,
  content: smsRule.content,
  channelIdentityBinding: smsRule.channelIdentityBinding,
  deliveryPlanFingerprintSha256: 'a'.repeat(64),
  effectFingerprintSha256: 'b'.repeat(64),
  authority: noChannelNotificationAuthorityConsequencesV1
};

describe('Channel Notification contracts', () => {
  it('admits a bounded EMAIL_NOTIFICATION rule without send authority', () => {
    expect(parseChannelNotificationRuleSpecV1(rule)).toEqual(rule);
    expect(Object.values(rule.authority).every((value) => value === false)).toBe(true);
  });

  it('admits a bounded SMS_WORKSPACE_NOTIFICATION rule/send intent without email sender truth', () => {
    expect(parseChannelNotificationRuleSpecV1(smsRule)).toEqual(smsRule);
    expect(parseChannelNotificationSendIntentV1(smsIntent)).toEqual(smsIntent);

    expect(() =>
      parseChannelNotificationRuleSpecV1({
        ...smsRule,
        senderProfile: rule.senderProfile
      })
    ).toThrow(/bounded V1 fields/);

    const { channelIdentityBinding: omittedBinding, ...missingBinding } = smsRule;
    void omittedBinding;
    expect(() => parseChannelNotificationRuleSpecV1(missingBinding)).toThrow(/bounded V1 fields/);
  });

  it('rejects raw phone material in durable SMS truth', () => {
    expect(() =>
      parseChannelNotificationSendIntentV1({
        ...smsIntent,
        recipientPhone: '+14155550123'
      })
    ).toThrow(/forbidden durable notification material/);
  });

  it('admits trigger evidence as owner references without event payload', () => {
    expect(parseChannelNotificationTriggerEvidenceV1(trigger)).toEqual(trigger);
  });

  it('admits a send intent with exact rule, trigger, content, sender and endpoint fingerprint', () => {
    expect(parseChannelNotificationSendIntentV1(intent)).toEqual(intent);
  });

  it('rejects raw message and endpoint material in durable rule/send truth', () => {
    expect(() =>
      parseChannelNotificationRuleSpecV1({
        ...rule,
        textBody: 'Status update body'
      })
    ).toThrow(/forbidden durable notification material/);

    expect(() =>
      parseChannelNotificationSendIntentV1({
        ...intent,
        recipientEmail: 'person@example.com'
      })
    ).toThrow(/forbidden durable notification material/);
  });

  it('rejects event payload escape hatches and raw email-like references', () => {
    expect(() =>
      parseChannelNotificationTriggerEvidenceV1({
        ...trigger,
        payload: { status: 'APPROVED' }
      })
    ).toThrow(/bounded V1 fields/);

    expect(() =>
      parseChannelNotificationTriggerEvidenceV1({
        ...trigger,
        subject: {
          ...trigger.subject,
          id: 'person@example.com'
        }
      })
    ).toThrow(/without raw email data/);
  });

  it('rejects authority escalation and non-notification channel keys', () => {
    expect(() =>
      parseChannelNotificationRuleSpecV1({
        ...rule,
        authority: {
          ...rule.authority,
          externalSendAuthorized: true
        }
      })
    ).toThrow(/externalSendAuthorized/);

    expect(() =>
      parseChannelNotificationRuleSpecV1({
        ...rule,
        featureKey: 'EMAIL_CAMPAIGN'
      })
    ).toThrow(/EMAIL_NOTIFICATION or SMS_WORKSPACE_NOTIFICATION only/);
  });
});
