import { describe, expect, it } from 'vitest';
import {
  assessChannelEntitlementV1,
  channelFeatureDefinitionV1,
  channelPlatformClassesV1,
  noChannelPlatformAuthorityConsequencesV1
} from '../src/channel-platform.js';
import type { ResolvedEntitlementV1 } from '../src/workspace-commercial.js';

const workspaceId = 'workspace_01';

function entitlement(
  key: string,
  value: ResolvedEntitlementV1['value'],
  subjectWorkspaceId = workspaceId
): ResolvedEntitlementV1 {
  return {
    schemaVersion: 1,
    subject: { scope: 'WORKSPACE', workspaceId: subjectWorkspaceId },
    key,
    value,
    contributingGrantRefs: [{ grantId: 'grant_channels-01', version: 3 }],
    resolvedAt: '2026-09-18T08:00:00Z'
  };
}
describe('channel platform core', () => {
  it('freezes the four semantic channel classes', () => {
    expect(channelPlatformClassesV1).toEqual([
      'PRESENCE',
      'CAMPAIGN',
      'NOTIFICATION',
      'CONVERSATION'
    ]);
  });

  it('allows MO pooled transport for marketing email without granting send authority', () => {
    const definition = channelFeatureDefinitionV1('EMAIL_CAMPAIGN');
    expect(definition).toMatchObject({
      family: 'EMAIL',
      channelClasses: ['CAMPAIGN'],
      sendingIdentityOwnership: 'MO_MANAGED_INFRASTRUCTURE',
      workspaceOwnedAccountRequired: false,
      moSharedTransportPermitted: true
    });
    expect(noChannelPlatformAuthorityConsequencesV1.externalSendAuthorized).toBe(false);
    expect(noChannelPlatformAuthorityConsequencesV1.providerSelectionAuthorityGranted).toBe(false);
  });
  it.each([
    'SMS_WORKSPACE_NOTIFICATION',
    'SMS_WORKSPACE_CAMPAIGN',
    'WHATSAPP_BUSINESS',
    'WECHAT_ECOSYSTEM'
  ] as const)('requires Workspace-owned identity for %s', (featureKey) => {
    expect(channelFeatureDefinitionV1(featureKey)).toMatchObject({
      sendingIdentityOwnership: 'WORKSPACE_OWNED_IDENTITY',
      workspaceOwnedAccountRequired: true,
      moSharedTransportPermitted: false
    });
  });

  it('keeps the narrow MO system SMS transport separate from Workspace SMS', () => {
    expect(channelFeatureDefinitionV1('SMS_MO_SYSTEM_NOTIFICATION')).toMatchObject({
      family: 'SMS',
      channelClasses: ['NOTIFICATION'],
      sendingIdentityOwnership: 'MO_MANAGED_INFRASTRUCTURE',
      workspaceOwnedAccountRequired: false,
      moSharedTransportPermitted: true
    });
  });
  it('enables a feature only from an existing resolved Workspace boolean entitlement', () => {
    const result = assessChannelEntitlementV1(workspaceId, 'EMAIL_CAMPAIGN', [
      entitlement('lite.channel.email.campaign', { kind: 'BOOLEAN', enabled: true })
    ]);
    expect(result).toMatchObject({
      workspaceId,
      featureKey: 'EMAIL_CAMPAIGN',
      status: 'ENABLED',
      allowed: true,
      entitlementRef: {
        resolvedAt: '2026-09-18T08:00:00Z',
        contributingGrantRefs: [{ grantId: 'grant_channels-01', version: 3 }]
      },
      authority: noChannelPlatformAuthorityConsequencesV1
    });
  });

  it.each([
    [[], 'NOT_ENTITLED'],
    [[entitlement('lite.channel.email.campaign', { kind: 'BOOLEAN', enabled: false })], 'DISABLED'],
    [
      [
        entitlement('lite.channel.email.campaign', {
          kind: 'QUANTITY',
          quantity: 1000,
          unit: 'messages',
          aggregation: 'MAX'
        })
      ],
      'INVALID_ENTITLEMENT_VALUE'
    ],
    [
      [
        entitlement(
          'lite.channel.email.campaign',
          { kind: 'BOOLEAN', enabled: true },
          'workspace_other'
        )
      ],
      'NOT_ENTITLED'
    ]
  ] as const)('fails closed when entitlement evidence is not enabling: %s', (items, status) => {
    const result = assessChannelEntitlementV1(workspaceId, 'EMAIL_CAMPAIGN', items);
    expect(result.status).toBe(status);
    expect(result.allowed).toBe(false);
    expect(result.authority.externalSendAuthorized).toBe(false);
  });
  it('rejects ambiguous duplicate resolved entitlement truth', () => {
    const enabled = entitlement('lite.channel.email.campaign', {
      kind: 'BOOLEAN',
      enabled: true
    });
    expect(() =>
      assessChannelEntitlementV1(workspaceId, 'EMAIL_CAMPAIGN', [enabled, enabled])
    ).toThrow('Resolved channel entitlement must be unique');
  });

  it('keeps entitlement access separate from business and execution authority', () => {
    const result = assessChannelEntitlementV1(workspaceId, 'EMAIL_NOTIFICATION', [
      entitlement('lite.channel.email.notification', { kind: 'BOOLEAN', enabled: true })
    ]);
    expect(Object.values(result.authority).every((value) => value === false)).toBe(true);
  });
});
