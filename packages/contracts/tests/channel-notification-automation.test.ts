import { describe, expect, it } from 'vitest';
import {
  channelNotificationAutomationRuleStatusesV1,
  isChannelNotificationAutomationRuleStatusTransitionAllowedV1,
  parseChannelNotificationAutomationRuleV1
} from '../src/channel-notification-automation.js';
import { noChannelNotificationAuthorityConsequencesV1 } from '../src/channel-notification.js';

const workspaceId = '14141414-1414-4414-8414-141414141414';
const notificationRuleId = 'channel-notification-rule_primary' as const;

function spec(version: number, fingerprint = '3'.repeat(64)) {
  return {
    schemaVersion: 1 as const,
    notificationRuleId,
    workspaceId,
    version,
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
    dedupePolicy: { mode: 'ONE_PER_RULE_TRIGGER' as const },
    ruleFingerprintSha256: fingerprint,
    authority: noChannelNotificationAuthorityConsequencesV1
  };
}

function evidence(action: 'ACTIVATE' | 'REVOKE', version: number, fingerprint: string) {
  return {
    owner: 'CORE' as const,
    kind: 'GOVERNED_HUMAN_ACTION_RECEIPT' as const,
    action,
    workspaceId,
    notificationRuleId,
    authorizedRuleVersion: version,
    authorizedRuleFingerprintSha256: fingerprint,
    evidenceRef: `governed-human-action-receipt_${action.toLowerCase()}`,
    evidenceFingerprintSha256: '9'.repeat(64),
    verifiedAt: '2026-09-19T10:00:00.000Z'
  };
}

function draft() {
  return {
    schemaVersion: 1 as const,
    workspaceId,
    notificationRuleId,
    version: 1,
    status: 'DRAFT' as const,
    spec: spec(1),
    ruleIntentFingerprintSha256: '8'.repeat(64),
    activationEvidence: null,
    revocationEvidence: null,
    createdByPrincipalId: 'principal_owner',
    updatedByPrincipalId: 'principal_owner',
    createdAt: '2026-09-19T09:00:00.000Z',
    updatedAt: '2026-09-19T09:00:00.000Z',
    suspendedAt: null,
    revokedAt: null,
    authority: noChannelNotificationAuthorityConsequencesV1
  };
}

describe('Channel Notification Automation durable contract', () => {
  it('admits a DRAFT rule with no send authority or governance evidence', () => {
    expect(parseChannelNotificationAutomationRuleV1(draft())).toEqual(draft());
    expect(channelNotificationAutomationRuleStatusesV1).toEqual([
      'DRAFT',
      'ACTIVE',
      'SUSPENDED',
      'REVOKED'
    ]);
  });

  it('requires ACTIVE evidence to bind the exact current rule version and fingerprint', () => {
    const activeSpec = spec(2, '4'.repeat(64));
    const active = {
      ...draft(),
      version: 2,
      status: 'ACTIVE' as const,
      spec: activeSpec,
      activationEvidence: evidence('ACTIVATE', 2, activeSpec.ruleFingerprintSha256),
      updatedAt: '2026-09-19T10:00:00.000Z',
      updatedByPrincipalId: 'principal_activator'
    };
    expect(parseChannelNotificationAutomationRuleV1(active)).toEqual(active);

    expect(() =>
      parseChannelNotificationAutomationRuleV1({
        ...active,
        activationEvidence: {
          ...active.activationEvidence,
          authorizedRuleVersion: 1
        }
      })
    ).toThrow(/exact current rule version and fingerprint/);
  });

  it('keeps only prior activation evidence on a suspended rule', () => {
    const activeFingerprint = '4'.repeat(64);
    const suspended = {
      ...draft(),
      version: 3,
      status: 'SUSPENDED' as const,
      spec: spec(3, '5'.repeat(64)),
      activationEvidence: evidence('ACTIVATE', 2, activeFingerprint),
      updatedAt: '2026-09-19T11:00:00.000Z',
      suspendedAt: '2026-09-19T11:00:00.000Z',
      updatedByPrincipalId: 'principal_operator'
    };
    expect(parseChannelNotificationAutomationRuleV1(suspended)).toEqual(suspended);
  });

  it('requires REVOKE evidence to bind the exact terminal version', () => {
    const revokedSpec = spec(2, '6'.repeat(64));
    const revoked = {
      ...draft(),
      version: 2,
      status: 'REVOKED' as const,
      spec: revokedSpec,
      revocationEvidence: evidence('REVOKE', 2, revokedSpec.ruleFingerprintSha256),
      updatedAt: '2026-09-19T10:00:00.000Z',
      revokedAt: '2026-09-19T10:00:00.000Z',
      updatedByPrincipalId: 'principal_revoker'
    };
    expect(parseChannelNotificationAutomationRuleV1(revoked)).toEqual(revoked);
  });

  it('rejects raw endpoint-like material and Workspace drift', () => {
    expect(() =>
      parseChannelNotificationAutomationRuleV1({
        ...draft(),
        createdByPrincipalId: 'person@example.com'
      })
    ).toThrow(/without raw email material/);

    expect(() =>
      parseChannelNotificationAutomationRuleV1(
        {
          ...draft(),
          workspaceId: '15151515-1515-4515-8515-151515151515'
        },
        workspaceId
      )
    ).toThrow(/Workspace does not match/);
  });

  it('freezes the bounded status transition graph', () => {
    expect(isChannelNotificationAutomationRuleStatusTransitionAllowedV1('DRAFT', 'ACTIVE')).toBe(
      true
    );
    expect(
      isChannelNotificationAutomationRuleStatusTransitionAllowedV1('ACTIVE', 'SUSPENDED')
    ).toBe(true);
    expect(
      isChannelNotificationAutomationRuleStatusTransitionAllowedV1('SUSPENDED', 'ACTIVE')
    ).toBe(true);
    expect(isChannelNotificationAutomationRuleStatusTransitionAllowedV1('ACTIVE', 'REVOKED')).toBe(
      true
    );
    expect(isChannelNotificationAutomationRuleStatusTransitionAllowedV1('REVOKED', 'ACTIVE')).toBe(
      false
    );
    expect(isChannelNotificationAutomationRuleStatusTransitionAllowedV1('DRAFT', 'SUSPENDED')).toBe(
      false
    );
  });
});
