import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  noChannelNotificationAuthorityConsequencesV1,
  type ChannelNotificationRuleSpecV1
} from '@markorbit/contracts/channel-notification';
import type { ChannelNotificationAutomationRuleV1 } from '@markorbit/contracts/channel-notification-automation';
import type {
  WorkspaceChannelIdentityCurrentnessReasonV1,
  WorkspaceChannelIdentityCurrentnessStateV1
} from '@markorbit/contracts/channel-identity-binding';
import type { PublishPackage } from '@markorbit/contracts/product-loop';
import { noChannelPlatformAuthorityConsequencesV1 } from '@markorbit/contracts/channel-platform';
import {
  noWorkspaceEmailSenderProfileAuthorityConsequencesV1,
  type WorkspaceEmailSenderProfileV1
} from '@markorbit/contracts/email-sender-profile';
import {
  C6SmsNotificationChannelIdentityCurrentnessReaderV1,
  NotificationAutomationRuleCurrentnessResolver,
  UnavailableSmsNotificationChannelIdentityRequirementsReaderV1,
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

const smsSpec: ChannelNotificationRuleSpecV1 = {
  schemaVersion: 1,
  notificationRuleId: 'channel-notification-rule_sms-primary',
  workspaceId,
  version: 2,
  featureKey: 'SMS_WORKSPACE_NOTIFICATION',
  triggerSelector: spec.triggerSelector,
  destinationResolver: { kind: 'EVENT_SUBJECT_WORKSPACE_DIRECTORY_PHONE' },
  content: spec.content,
  channelIdentityBinding: {
    id: 'workspace-channel-identity-binding_sms-primary',
    version: 4,
    fingerprintSha256: '8'.repeat(64)
  },
  contactPolicyRef: {
    policyId: 'outbound-contact-policy_sms-notification',
    version: 2
  },
  ratePolicyRef: 'notification-rate-policy_sms-default',
  dedupePolicy: { mode: 'ONE_PER_RULE_TRIGGER' },
  ruleFingerprintSha256: '9'.repeat(64),
  authority: noChannelNotificationAuthorityConsequencesV1
};

const smsActiveRule: ChannelNotificationAutomationRuleV1 = {
  ...activeRule,
  notificationRuleId: smsSpec.notificationRuleId,
  spec: smsSpec,
  ruleIntentFingerprintSha256: '7'.repeat(64),
  activationEvidence: {
    ...activeRule.activationEvidence!,
    notificationRuleId: smsSpec.notificationRuleId,
    authorizedRuleFingerprintSha256: smsSpec.ruleFingerprintSha256
  }
};

function harness(
  options: {
    latest?: ChannelNotificationAutomationRuleV1;
    exact?: ChannelNotificationAutomationRuleV1;
    entitlementAllowed?: boolean;
    entitlementUnavailable?: boolean;
    entitlementWorkspaceId?: string;
    entitlementFeatureKey?: 'EMAIL_NOTIFICATION' | 'EMAIL_CAMPAIGN';
    entitlementKey?: string;
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
        workspaceId: options.entitlementWorkspaceId ?? workspaceId,
        featureKey: options.entitlementFeatureKey ?? ('EMAIL_NOTIFICATION' as const),
        entitlementKey: options.entitlementKey ?? 'lite.channel.email.notification',
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

function smsHarness(
  state: WorkspaceChannelIdentityCurrentnessStateV1,
  reason: WorkspaceChannelIdentityCurrentnessReasonV1
) {
  const rules = {
    getExact: vi.fn(() => Promise.resolve(smsActiveRule)),
    getLatest: vi.fn(() => Promise.resolve(smsActiveRule))
  };
  const content = {
    findPublishPackage: vi.fn(() => Promise.resolve(publishPackage))
  };
  const getExactSenderProfile = vi.fn(() =>
    Promise.reject(new Error('email sender must not be read'))
  );
  const evaluateSenderProfileCurrentness = vi.fn(() =>
    Promise.reject(new Error('email sender currentness must not be read'))
  );
  const senders = {
    getExactSenderProfile,
    evaluateSenderProfileCurrentness
  };
  const entitlementResolve = vi.fn(() =>
    Promise.reject(new Error('email entitlement must not be read'))
  );
  const entitlement: NotificationAutomationEntitlementReader = {
    resolve: entitlementResolve
  };
  const smsIdentityResolve = vi.fn(() =>
    Promise.resolve({
      schemaVersion: 1 as const,
      workspaceId,
      featureKey: 'SMS_WORKSPACE_NOTIFICATION' as const,
      binding:
        smsSpec.featureKey === 'SMS_WORKSPACE_NOTIFICATION'
          ? smsSpec.channelIdentityBinding
          : {
              id: 'workspace-channel-identity-binding_never' as const,
              version: 1,
              fingerprintSha256: '0'.repeat(64)
            },
      state,
      reason,
      assessedAt: '2026-09-19T10:05:00.000Z',
      createsExecutionAuthority: false as const
    })
  );
  const smsIdentity = { resolve: smsIdentityResolve };
  return {
    getExactSenderProfile,
    entitlementResolve,
    smsIdentityResolve,
    resolver: new NotificationAutomationRuleCurrentnessResolver(
      rules,
      content,
      senders,
      entitlement,
      () => '2026-09-19T10:05:00.000Z',
      24 * 60 * 60 * 1000,
      smsIdentity
    )
  };
}

describe('C6 SMS Notification identity bridge', () => {
  const binding = {
    id: 'workspace-channel-identity-binding_sms-primary' as const,
    version: 4,
    fingerprintSha256: '8'.repeat(64)
  };

  it('passes trusted external-credential requirements into the C6 currentness owner', async () => {
    const currentness = {
      resolve: vi.fn(() =>
        Promise.resolve({
          schemaVersion: 1 as const,
          workspaceId,
          featureKey: 'SMS_WORKSPACE_NOTIFICATION' as const,
          binding,
          state: 'CURRENT' as const,
          reason: 'EXACT_BINDING_CURRENT' as const,
          assessedAt: '2026-09-19T10:05:00.000Z',
          createsExecutionAuthority: false as const
        })
      )
    };
    const requirements = {
      resolve: vi.fn(() =>
        Promise.resolve({
          kind: 'EXTERNAL_CREDENTIAL' as const,
          expectedProvider: 'provider:test-sms',
          expectedSecretKind: 'API_KEY' as const
        })
      )
    };
    const reader = new C6SmsNotificationChannelIdentityCurrentnessReaderV1(
      currentness,
      requirements
    );

    await expect(
      reader.resolve({ workspaceId, featureKey: 'SMS_WORKSPACE_NOTIFICATION', binding })
    ).resolves.toMatchObject({ state: 'CURRENT', reason: 'EXACT_BINDING_CURRENT' });
    expect(currentness.resolve).toHaveBeenCalledWith({
      workspaceId,
      featureKey: 'SMS_WORKSPACE_NOTIFICATION',
      binding,
      externalCredentialRequirements: {
        expectedProvider: 'provider:test-sms',
        expectedSecretKind: 'API_KEY'
      }
    });
  });

  it('passes trusted OAuth provider/scopes into the same C6 currentness owner', async () => {
    const currentness = {
      resolve: vi.fn(() =>
        Promise.resolve({
          schemaVersion: 1 as const,
          workspaceId,
          featureKey: 'SMS_WORKSPACE_NOTIFICATION' as const,
          binding,
          state: 'CURRENT' as const,
          reason: 'EXACT_BINDING_CURRENT' as const,
          assessedAt: '2026-09-19T10:05:00.000Z',
          createsExecutionAuthority: false as const
        })
      )
    };
    const reader = new C6SmsNotificationChannelIdentityCurrentnessReaderV1(currentness, {
      resolve: vi.fn(() =>
        Promise.resolve({
          kind: 'OAUTH' as const,
          expectedProvider: 'provider:test-oauth',
          requiredScopes: ['sms.send']
        })
      )
    });
    await reader.resolve({ workspaceId, featureKey: 'SMS_WORKSPACE_NOTIFICATION', binding });
    expect(currentness.resolve).toHaveBeenCalledWith({
      workspaceId,
      featureKey: 'SMS_WORKSPACE_NOTIFICATION',
      binding,
      oauthRequirements: {
        expectedProvider: 'provider:test-oauth',
        requiredScopes: ['sms.send']
      }
    });
  });

  it('fails closed before C6 resolution when trusted provider requirements are unavailable', async () => {
    const currentness = { resolve: vi.fn() };
    const reader = new C6SmsNotificationChannelIdentityCurrentnessReaderV1(
      currentness,
      new UnavailableSmsNotificationChannelIdentityRequirementsReaderV1(),
      () => '2026-09-19T10:05:00.000Z'
    );
    await expect(
      reader.resolve({ workspaceId, featureKey: 'SMS_WORKSPACE_NOTIFICATION', binding })
    ).resolves.toMatchObject({ state: 'UNAVAILABLE', createsExecutionAuthority: false });
    expect(currentness.resolve).not.toHaveBeenCalled();
  });
});

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

  it('fails closed when entitlement identity does not match the exact notification feature', async () => {
    await expect(
      harness({ entitlementWorkspaceId: '15151515-1515-4515-8515-151515151515' }).resolve(
        workspaceId,
        ruleId,
        2
      )
    ).resolves.toMatchObject({ state: 'UNKNOWN', reason: 'OWNER_DATA_UNKNOWN' });
    await expect(
      harness({ entitlementFeatureKey: 'EMAIL_CAMPAIGN' }).resolve(workspaceId, ruleId, 2)
    ).resolves.toMatchObject({ state: 'UNKNOWN', reason: 'OWNER_DATA_UNKNOWN' });
    await expect(
      harness({ entitlementKey: 'lite.channel.email.campaign' }).resolve(workspaceId, ruleId, 2)
    ).resolves.toMatchObject({ state: 'UNKNOWN', reason: 'OWNER_DATA_UNKNOWN' });
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

  it('returns CURRENT for exact SMS identity currentness without consulting email owners', async () => {
    const h = smsHarness('CURRENT', 'EXACT_BINDING_CURRENT');
    await expect(
      h.resolver.resolve(workspaceId, smsSpec.notificationRuleId, 2)
    ).resolves.toMatchObject({
      state: 'CURRENT',
      reason: 'EXACT_ACTIVE_RULE_CURRENT'
    });
    expect(h.smsIdentityResolve).toHaveBeenCalledTimes(1);
    expect(h.getExactSenderProfile).not.toHaveBeenCalled();
    expect(h.entitlementResolve).not.toHaveBeenCalled();
  });

  it.each([
    ['STALE', 'BINDING_STALE', 'STALE', 'CHANNEL_IDENTITY_STALE'],
    ['STALE', 'IMPLEMENTATION_STALE', 'STALE', 'CHANNEL_IDENTITY_STALE'],
    ['REVOKED', 'BINDING_REVOKED', 'REVOKED', 'CHANNEL_IDENTITY_REVOKED'],
    ['REVOKED', 'CREDENTIAL_REVOKED', 'REVOKED', 'CHANNEL_IDENTITY_REVOKED'],
    [
      'REAUTH_REQUIRED',
      'CREDENTIAL_REAUTH_REQUIRED',
      'REAUTH_REQUIRED',
      'CHANNEL_IDENTITY_REAUTH_REQUIRED'
    ],
    [
      'REAUTH_REQUIRED',
      'CREDENTIAL_EXPIRED',
      'REAUTH_REQUIRED',
      'CHANNEL_IDENTITY_REAUTH_REQUIRED'
    ],
    ['UNKNOWN', 'CREDENTIAL_UNKNOWN', 'UNKNOWN', 'CHANNEL_IDENTITY_UNKNOWN'],
    ['UNKNOWN', 'IDENTITY_VERIFICATION_UNKNOWN', 'UNKNOWN', 'CHANNEL_IDENTITY_UNKNOWN'],
    ['UNAVAILABLE', 'CREDENTIAL_UNAVAILABLE', 'UNAVAILABLE', 'CHANNEL_IDENTITY_UNAVAILABLE'],
    [
      'UNAVAILABLE',
      'IDENTITY_VERIFICATION_UNAVAILABLE',
      'UNAVAILABLE',
      'CHANNEL_IDENTITY_UNAVAILABLE'
    ],
    ['UNAVAILABLE', 'IMPLEMENTATION_UNAVAILABLE', 'UNAVAILABLE', 'CHANNEL_IDENTITY_UNAVAILABLE'],
    ['NOT_ENTITLED', 'ENTITLEMENT_NOT_ENABLED', 'REVOKED', 'ENTITLEMENT_REVOKED']
  ] as const)(
    'fails closed for SMS identity %s / %s',
    async (identityState, identityReason, expectedState, expectedReason) => {
      await expect(
        smsHarness(identityState, identityReason).resolver.resolve(
          workspaceId,
          smsSpec.notificationRuleId,
          2
        )
      ).resolves.toMatchObject({ state: expectedState, reason: expectedReason });
    }
  );
});
