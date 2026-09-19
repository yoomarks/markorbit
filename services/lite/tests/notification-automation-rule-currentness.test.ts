[Reading 270 lines from start (total: 270 lines, 0 remaining)]

import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  noChannelNotificationAuthorityConsequencesV1,
  type ChannelNotificationRuleSpecV1
} from '@markorbit/contracts/channel-notification';
import type { ChannelNotificationAutomationRuleV1 } from '@markorbit/contracts/channel-notification-automation';
import type { PublishPackage } from '@markorbit/contracts/product-loop';
import { noChannelPlatformAuthorityConsequencesV1 } from '@markorbit/contracts/channel-platform';
import {
  noWorkspaceEmailSenderProfileAuthorityConsequencesV1,
  type WorkspaceEmailSenderProfileV1
} from '@markorbit/contracts/email-sender-profile';
import {
  NotificationAutomationRuleCurrentnessResolver,
  type NotificationAutomationEntitlementReader
} from '../src/notification-automation-rule-currentness.js';

const workspaceId = '14141414-1414-4414-8414-141414141414';
const ruleId = 'channel-notification-rule_primary' as const;

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonical(entry)])
    );
  }
  return value;
}

const fingerprint = (value: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');

const sender: WorkspaceEmailSenderProfileV1 = {
  schemaVersion: 1,
  senderProfileId: 'email-sender-profile_primary',
  workspaceId,
  version: 3,
  status: 'ACTIVE',
  fromDomain: 'mail.example.com',
  fromAddress: 'notify@mail.example.com',
  displayName: 'Example',
  replyTo: { mode: 'SAME_AS_FROM' },
  verification: {
    status: 'VERIFIED',
    evidenceRefs: ['dns:verified'],
    observedAt: '2026-09-19T10:00:00.000Z'
  },
  providerRoutingPartitionRef: 'routing:notification',
  ratePolicyRef: 'rate:notification',
  reputationIsolationKey: 'reputation:notification',
  createdAt: '2026-09-19T09:00:00.000Z',
  updatedAt: '2026-09-19T10:00:00.000Z',
  authority: noWorkspaceEmailSenderProfileAuthorityConsequencesV1
};

const publishPackage: PublishPackage = {
  schemaVersion: 1,
  publishPackageId: 'publish-package_primary',
  workspaceId,
  version: 2,
  contentDraft: { id: 'content-draft_primary', version: 1 },
  contentDraftFingerprintSha256: 'a'.repeat(64),
  reviewDecision: { id: 'content-review-decision_primary', version: 1 },
  title: 'Notification title',
  body: 'Notification body',
  publishPackageFingerprintSha256: 'b'.repeat(64),
  status: 'PREPARED',
  externalPublishExecuted: false,
  createdAt: '2026-09-19T09:30:00.000Z'
};

const spec: ChannelNotificationRuleSpecV1 = {
  schemaVersion: 1,
  notificationRuleId: ruleId,
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
    publishPackageId: publishPackage.publishPackageId,
    version: publishPackage.version,
    fingerprintSha256: publishPackage.publishPackageFingerprintSha256
  },
  senderProfile: {
    senderProfileId: sender.senderProfileId,
    version: sender.version,
    fingerprintSha256: fingerprint(sender)
  },
  ratePolicyRef: 'notification-rate-policy_default',
  dedupePolicy: { mode: 'ONE_PER_RULE_TRIGGER' },
  ruleFingerprintSha256: 'c'.repeat(64),
  authority: noChannelNotificationAuthorityConsequencesV1
};

const activeRule: ChannelNotificationAutomationRuleV1 = {
  schemaVersion: 1,
  workspaceId,
  notificationRuleId: ruleId,
  version: 2,
  status: 'ACTIVE',
  spec,
  ruleIntentFingerprintSha256: 'd'.repeat(64),
  activationEvidence: {
    owner: 'CORE',
    kind: 'GOVERNED_HUMAN_ACTION_RECEIPT',
    action: 'ACTIVATE',
    workspaceId,
    notificationRuleId: ruleId,
    authorizedRuleVersion: 2,
    authorizedRuleFingerprintSha256: spec.ruleFingerprintSha256,
    evidenceRef: 'governed-human-action-receipt_notification-activate',
    evidenceFingerprintSha256: 'e'.repeat(64),
    verifiedAt: '2026-09-19T10:00:00.000Z'
  },
  revocationEvidence: null,
  createdByPrincipalId: 'principal_owner',
  updatedByPrincipalId: 'principal_owner',
  createdAt: '2026-09-19T09:00:00.000Z',
  updatedAt: '2026-09-19T10:00:00.000Z',
  suspendedAt: null,
  revokedAt: null,
  authority: noChannelNotificationAuthorityConsequencesV1
};

function harness(
  options: {
    latest?: ChannelNotificationAutomationRuleV1;
    exact?: ChannelNotificationAutomationRuleV1;
    entitlementAllowed?: boolean;
    entitlementUnavailable?: boolean;
    packageValue?: PublishPackage | null;
    senderValue?: WorkspaceEmailSenderProfileV1;
    senderState?:
      | 'CURRENT_ELIGIBLE'
      | 'PENDING_VERIFICATION'
      | 'SUSPENDED'
      | 'REVOKED'
      | 'STALE'
      | 'UNKNOWN'
      | 'UNAVAILABLE';
  } = {}
) {
  const rules = {
    getExact: vi.fn(() => Promise.resolve(options.exact ?? activeRule)),
    getLatest: vi.fn(() => Promise.resolve(options.latest ?? activeRule))
  };
  const content = {
    findPublishPackage: vi.fn(() =>
      Promise.resolve(
        options.packageValue === undefined
          ? publishPackage
          : options.packageValue === null
            ? undefined
            : options.packageValue
      )
    )
  };
  const senders = {
    getExactSenderProfile: vi.fn(() => Promise.resolve(options.senderValue ?? sender)),
    evaluateSenderProfileCurrentness: vi.fn(() =>
      Promise.resolve({
        schemaVersion: 1 as const,
        workspaceId,
        senderProfileId: sender.senderProfileId,
        version: sender.version,
        state: options.senderState ?? ('CURRENT_ELIGIBLE' as const),
        evaluatedAt: '2026-09-19T10:05:00.000Z',
        verificationObservedAt: sender.verification.observedAt,
        createsSendAuthority: false as const
      })
    )
  };
  const entitlement: NotificationAutomationEntitlementReader = {
    resolve: vi.fn(() => {
      if (options.entitlementUnavailable) return Promise.resolve({ unavailable: true as const });
      return Promise.resolve({
        schemaVersion: 1 as const,
        workspaceId,
        featureKey: 'EMAIL_NOTIFICATION' as const,
        entitlementKey: 'lite.channel.email.notification',
        status: options.entitlementAllowed === false ? ('DISABLED' as const) : ('ENABLED' as const),
        allowed: options.entitlementAllowed !== false,
        authority: noChannelPlatformAuthorityConsequencesV1
      });
    })
  };
  return new NotificationAutomationRuleCurrentnessResolver(
    rules,
    content,
    senders,
    entitlement,
    () => '2026-09-19T10:05:00.000Z'
  );
}

describe('Notification Automation Rule currentness', () => {
  it('returns CURRENT only for exact active rule/content/sender/entitlement truth', async () => {
    await expect(harness().resolve(workspaceId, ruleId, 2)).resolves.toMatchObject({
      state: 'CURRENT',
      reason: 'EXACT_ACTIVE_RULE_CURRENT',
      protectedActionAuthorized: false,
      externalSendAuthorized: false
    });
  });

  it('fails closed when rule head supersedes the requested version', async () => {
    const newer = {
      ...activeRule,
      version: 3,
      spec: { ...activeRule.spec, version: 3 }
    } as ChannelNotificationAutomationRuleV1;
    await expect(harness({ latest: newer }).resolve(workspaceId, ruleId, 2)).resolves.toMatchObject(
      { state: 'STALE', reason: 'RULE_SUPERSEDED' }
    );
  });

  it('fails closed for revoked entitlement and missing content', async () => {
    await expect(
      harness({ entitlementAllowed: false }).resolve(workspaceId, ruleId, 2)
    ).resolves.toMatchObject({ state: 'REVOKED', reason: 'ENTITLEMENT_REVOKED' });
    await expect(
      harness({ packageValue: null }).resolve(workspaceId, ruleId, 2)
    ).resolves.toMatchObject({ state: 'UNKNOWN', reason: 'CONTENT_NOT_FOUND' });
  });

  it('fails closed for content fingerprint drift and sender currentness drift', async () => {
    await expect(
      harness({
        packageValue: {
          ...publishPackage,
          publishPackageFingerprintSha256: 'f'.repeat(64)
        }
      }).resolve(workspaceId, ruleId, 2)
    ).resolves.toMatchObject({
      state: 'STALE',
      reason: 'CONTENT_FINGERPRINT_MISMATCH'
    });

    await expect(
      harness({ senderState: 'SUSPENDED' }).resolve(workspaceId, ruleId, 2)
    ).resolves.toMatchObject({ state: 'STALE', reason: 'SENDER_PROFILE_STALE' });
    await expect(
      harness({ senderState: 'REVOKED' }).resolve(workspaceId, ruleId, 2)
    ).resolves.toMatchObject({ state: 'REVOKED', reason: 'SENDER_PROFILE_REVOKED' });
    await expect(
      harness({ senderState: 'UNAVAILABLE' }).resolve(workspaceId, ruleId, 2)
    ).resolves.toMatchObject({
      state: 'UNAVAILABLE',
      reason: 'SENDER_PROFILE_UNAVAILABLE'
    });
  });

  it('treats entitlement owner outage as unavailable rather than revocation', async () => {
    await expect(
      harness({ entitlementUnavailable: true }).resolve(workspaceId, ruleId, 2)
    ).resolves.toMatchObject({ state: 'UNAVAILABLE', reason: 'OWNER_UNAVAILABLE' });
  });
});

[executed on device: MarkOrbit (710fa508-4ac4-4899-bf0a-594e530d3e21)]