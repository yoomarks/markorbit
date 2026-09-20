import { describe, expect, it, vi } from 'vitest';
import {
  noChannelNotificationAuthorityConsequencesV1,
  type ChannelNotificationSendIntentV1,
  type ChannelNotificationTriggerEvidenceV1
} from '@markorbit/contracts/channel-notification';
import {
  channelNotificationDeliveryPlanFingerprintSha256V1,
  channelNotificationSendEffectFingerprintSha256V1,
  channelNotificationTriggerFingerprintSha256V1
} from '@markorbit/contracts/channel-notification-fingerprint';
import type {
  ChannelNotificationAutomationGovernanceEvidenceV1,
  ChannelNotificationAutomationRuleV1
} from '@markorbit/contracts/channel-notification-automation';
import {
  NotificationSendCurrentnessResolverV1,
  UnavailableNotificationTriggerEvidenceCurrentnessReaderV1
} from '../src/notification-send-currentness.js';

const workspaceId = '14141414-1414-4414-8414-141414141414';
const notificationRuleId = 'channel-notification-rule_send-currentness' as const;
const endpointFingerprintSha256 = '5'.repeat(64);

const activationEvidence: ChannelNotificationAutomationGovernanceEvidenceV1 = {
  owner: 'CORE',
  kind: 'GOVERNED_HUMAN_ACTION_RECEIPT',
  action: 'ACTIVATE',
  workspaceId,
  notificationRuleId,
  authorizedRuleVersion: 2,
  authorizedRuleFingerprintSha256: '3'.repeat(64),
  evidenceRef: 'core-governed-human-action-receipt:send-currentness',
  evidenceFingerprintSha256: '9'.repeat(64),
  verifiedAt: '2026-09-20T00:00:00.000Z'
};

const activeRule: ChannelNotificationAutomationRuleV1 = {
  schemaVersion: 1,
  workspaceId,
  notificationRuleId,
  version: 2,
  status: 'ACTIVE',
  spec: {
    schemaVersion: 1,
    notificationRuleId,
    workspaceId,
    version: 2,
    featureKey: 'EMAIL_NOTIFICATION',
    triggerSelector: {
      owner: 'MARKREG',
      eventType: 'FORMAL_MATTER_STATUS_CHANGED',
      subjectKind: 'WORKSPACE_DIRECTORY_ENTRY'
    },
    destinationResolver: { kind: 'EVENT_SUBJECT_WORKSPACE_DIRECTORY_EMAIL' },
    content: {
      publishPackageId: 'publish-package_send-currentness',
      version: 2,
      fingerprintSha256: '1'.repeat(64)
    },
    senderProfile: {
      senderProfileId: 'email-sender-profile_send-currentness',
      version: 3,
      fingerprintSha256: '2'.repeat(64)
    },
    ratePolicyRef: 'notification-rate-policy_default',
    dedupePolicy: { mode: 'ONE_PER_RULE_TRIGGER' },
    ruleFingerprintSha256: activationEvidence.authorizedRuleFingerprintSha256,
    authority: noChannelNotificationAuthorityConsequencesV1
  },
  ruleIntentFingerprintSha256: '8'.repeat(64),
  activationEvidence,
  revocationEvidence: null,
  createdByPrincipalId: 'principal_owner',
  updatedByPrincipalId: 'principal_owner',
  createdAt: '2026-09-19T23:00:00.000Z',
  updatedAt: '2026-09-20T00:00:00.000Z',
  suspendedAt: null,
  revokedAt: null,
  authority: noChannelNotificationAuthorityConsequencesV1
};

function trigger(): ChannelNotificationTriggerEvidenceV1 {
  const value: ChannelNotificationTriggerEvidenceV1 = {
    schemaVersion: 1,
    notificationTriggerEvidenceId: 'channel-notification-trigger_send-currentness',
    workspaceId,
    version: 1,
    owner: 'MARKREG',
    eventType: 'FORMAL_MATTER_STATUS_CHANGED',
    eventId: 'markreg-event_send-currentness',
    subject: {
      owner: 'LITE',
      kind: 'WORKSPACE_DIRECTORY_ENTRY',
      id: 'workspace-directory-entry_send-currentness',
      version: 4
    },
    occurredAt: '2026-09-20T00:05:00.000Z',
    evidenceRefs: ['markreg-event:send-currentness'],
    triggerFingerprintSha256: '0'.repeat(64),
    authority: noChannelNotificationAuthorityConsequencesV1
  };
  value.triggerFingerprintSha256 = channelNotificationTriggerFingerprintSha256V1(value);
  return value;
}

function intent(
  triggerEvidence: ChannelNotificationTriggerEvidenceV1
): ChannelNotificationSendIntentV1 {
  const value: ChannelNotificationSendIntentV1 = {
    schemaVersion: 1,
    notificationSendIntentId: 'channel-notification-send-intent_send-currentness',
    workspaceId,
    version: 1,
    featureKey: 'EMAIL_NOTIFICATION',
    rule: {
      notificationRuleId,
      version: activeRule.version,
      fingerprintSha256: activeRule.spec.ruleFingerprintSha256
    },
    trigger: {
      notificationTriggerEvidenceId: triggerEvidence.notificationTriggerEvidenceId,
      version: 1,
      fingerprintSha256: triggerEvidence.triggerFingerprintSha256
    },
    target: {
      ...triggerEvidence.subject,
      endpointFingerprintSha256
    },
    content: activeRule.spec.content,
    senderProfile: activeRule.spec.senderProfile,
    deliveryPlanFingerprintSha256: '0'.repeat(64),
    effectFingerprintSha256: '0'.repeat(64),
    authority: noChannelNotificationAuthorityConsequencesV1
  };
  value.deliveryPlanFingerprintSha256 = channelNotificationDeliveryPlanFingerprintSha256V1(value);
  value.effectFingerprintSha256 = channelNotificationSendEffectFingerprintSha256V1(value);
  return value;
}

function harness(
  options: {
    triggerState?: 'CURRENT' | 'STALE' | 'REVOKED' | 'UNKNOWN' | 'UNAVAILABLE';
    endpointState?: 'CURRENT' | 'STALE' | 'NOT_FOUND' | 'UNKNOWN' | 'UNAVAILABLE';
    endpointFingerprint?: string;
    suppressed?: boolean;
    governanceUnavailable?: boolean;
    ruleCurrentnessState?: 'CURRENT' | 'STALE' | 'REVOKED' | 'UNKNOWN' | 'UNAVAILABLE';
  } = {}
) {
  const rules = { getExact: vi.fn(() => Promise.resolve(activeRule)) };
  const ruleCurrentness = {
    resolve: vi.fn(() =>
      Promise.resolve({
        schemaVersion: 1 as const,
        workspaceId,
        notificationRuleId,
        version: 2,
        ruleFingerprintSha256: activeRule.spec.ruleFingerprintSha256,
        state: options.ruleCurrentnessState ?? ('CURRENT' as const),
        reason: 'EXACT_ACTIVE_RULE_CURRENT' as const,
        evaluatedAt: '2026-09-20T00:06:00.000Z',
        protectedActionAuthorized: false as const,
        externalSendAuthorized: false as const
      })
    )
  };
  const governance = {
    verify: vi.fn(() => {
      if (options.governanceUnavailable) return Promise.reject(new Error('Core unavailable'));
      return Promise.resolve(activationEvidence);
    })
  };
  const triggers = {
    validateCurrent: vi.fn(() =>
      Promise.resolve({ state: options.triggerState ?? ('CURRENT' as const) })
    )
  };
  const endpoints = {
    resolve: vi.fn(() =>
      Promise.resolve({
        state: options.endpointState ?? ('CURRENT' as const),
        endpointFingerprintSha256: options.endpointFingerprint ?? endpointFingerprintSha256
      })
    )
  };
  const outbound = {
    currentGlobalSuppressions: vi.fn(() =>
      Promise.resolve(options.suppressed ? [{ status: 'ACTIVE' }] : [])
    )
  };

  return {
    triggers,
    endpoints,
    outbound,
    resolver: new NotificationSendCurrentnessResolverV1(
      rules,
      ruleCurrentness,
      governance,
      triggers,
      endpoints,
      outbound as never
    )
  };
}
describe('Notification send currentness', () => {
  it('returns CURRENT only for exact active rule, activation, trigger, endpoint and policy truth', async () => {
    const triggerEvidence = trigger();
    const sendIntent = intent(triggerEvidence);
    await expect(
      harness().resolver.resolve(workspaceId, sendIntent, triggerEvidence, activationEvidence)
    ).resolves.toMatchObject({
      state: 'CURRENT',
      reason: 'EXACT_NOTIFICATION_PLAN_CURRENT',
      effectFingerprintSha256: sendIntent.effectFingerprintSha256,
      deliveryPlanFingerprintSha256: sendIntent.deliveryPlanFingerprintSha256
    });
  });

  it('fails closed for trigger owner outage and the C5C production placeholder is unavailable', async () => {
    const triggerEvidence = trigger();
    const sendIntent = intent(triggerEvidence);
    await expect(
      harness({ triggerState: 'UNAVAILABLE' }).resolver.resolve(
        workspaceId,
        sendIntent,
        triggerEvidence,
        activationEvidence
      )
    ).resolves.toMatchObject({ state: 'UNAVAILABLE', reason: 'TRIGGER_UNAVAILABLE' });
    await expect(
      new UnavailableNotificationTriggerEvidenceCurrentnessReaderV1().validateCurrent()
    ).resolves.toEqual({ state: 'UNAVAILABLE' });
  });

  it('fails closed for endpoint drift and ALL_OUTBOUND suppression', async () => {
    const triggerEvidence = trigger();
    const sendIntent = intent(triggerEvidence);
    await expect(
      harness({ endpointFingerprint: '6'.repeat(64) }).resolver.resolve(
        workspaceId,
        sendIntent,
        triggerEvidence,
        activationEvidence
      )
    ).resolves.toMatchObject({ state: 'STALE', reason: 'ENDPOINT_DRIFT' });
    await expect(
      harness({ suppressed: true }).resolver.resolve(
        workspaceId,
        sendIntent,
        triggerEvidence,
        activationEvidence
      )
    ).resolves.toMatchObject({
      state: 'SUPPRESSED',
      reason: 'OUTBOUND_POLICY_SUPPRESSED'
    });
  });

  it('rejects trigger fingerprint drift before owner currentness is consulted', async () => {
    const triggerEvidence = { ...trigger(), triggerFingerprintSha256: 'f'.repeat(64) };
    const sendIntent = intent(triggerEvidence);
    const h = harness();
    await expect(
      h.resolver.resolve(workspaceId, sendIntent, triggerEvidence, activationEvidence)
    ).resolves.toMatchObject({ state: 'UNKNOWN', reason: 'FINGERPRINT_MISMATCH' });
    expect(h.triggers.validateCurrent).not.toHaveBeenCalled();
  });

  it('treats Core activation revalidation outage as unavailable', async () => {
    const triggerEvidence = trigger();
    const sendIntent = intent(triggerEvidence);
    await expect(
      harness({ governanceUnavailable: true }).resolver.resolve(
        workspaceId,
        sendIntent,
        triggerEvidence,
        activationEvidence
      )
    ).resolves.toMatchObject({ state: 'UNAVAILABLE', reason: 'OWNER_UNAVAILABLE' });
  });
});
