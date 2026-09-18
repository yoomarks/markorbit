import type { ResolvedEntitlementV1 } from './workspace-commercial.js';

export const channelPlatformClassesV1 = [
  'PRESENCE',
  'CAMPAIGN',
  'NOTIFICATION',
  'CONVERSATION'
] as const;
export type ChannelPlatformClassV1 = (typeof channelPlatformClassesV1)[number];

export const channelPlatformFamiliesV1 = ['SITE', 'EMAIL', 'SMS', 'WHATSAPP', 'WECHAT'] as const;
export type ChannelPlatformFamilyV1 = (typeof channelPlatformFamiliesV1)[number];

export const channelSendingIdentityOwnershipsV1 = [
  'MO_MANAGED_INFRASTRUCTURE',
  'WORKSPACE_OWNED_IDENTITY'
] as const;
export type ChannelSendingIdentityOwnershipV1 = (typeof channelSendingIdentityOwnershipsV1)[number];
export const channelFeatureKeysV1 = [
  'EMAIL_NOTIFICATION',
  'EMAIL_CAMPAIGN',
  'EMAIL_CONVERSATION',
  'SMS_MO_SYSTEM_NOTIFICATION',
  'SMS_WORKSPACE_NOTIFICATION',
  'SMS_WORKSPACE_CAMPAIGN',
  'WHATSAPP_BUSINESS',
  'WECHAT_ECOSYSTEM'
] as const;
export type ChannelFeatureKeyV1 = (typeof channelFeatureKeysV1)[number];

export interface ChannelFeatureDefinitionV1 {
  schemaVersion: 1;
  featureKey: ChannelFeatureKeyV1;
  family: ChannelPlatformFamilyV1;
  channelClasses: readonly ChannelPlatformClassV1[];
  entitlementKey: string;
  sendingIdentityOwnership: ChannelSendingIdentityOwnershipV1;
  workspaceOwnedAccountRequired: boolean;
  moSharedTransportPermitted: boolean;
}

export const noChannelPlatformAuthorityConsequencesV1 = Object.freeze({
  credentialAuthorityGranted: false,
  providerSelectionAuthorityGranted: false,
  protectedActionAuthorized: false,
  externalSendAuthorized: false,
  externalPublicationCreated: false,
  customerTruthCreated: false,
  orderCreated: false,
  matterCreated: false,
  trademarkTruthCreated: false
});
export type ChannelPlatformAuthorityConsequencesV1 =
  typeof noChannelPlatformAuthorityConsequencesV1;

const feature = (
  featureKey: ChannelFeatureKeyV1,
  family: ChannelPlatformFamilyV1,
  channelClasses: readonly ChannelPlatformClassV1[],
  entitlementKey: string,
  sendingIdentityOwnership: ChannelSendingIdentityOwnershipV1
): ChannelFeatureDefinitionV1 => ({
  schemaVersion: 1,
  featureKey,
  family,
  channelClasses,
  entitlementKey,
  sendingIdentityOwnership,
  workspaceOwnedAccountRequired: sendingIdentityOwnership === 'WORKSPACE_OWNED_IDENTITY',
  moSharedTransportPermitted: sendingIdentityOwnership === 'MO_MANAGED_INFRASTRUCTURE'
});

export const channelFeatureDefinitionsV1 = Object.freeze([
  feature(
    'EMAIL_NOTIFICATION',
    'EMAIL',
    ['NOTIFICATION'],
    'lite.channel.email.notification',
    'MO_MANAGED_INFRASTRUCTURE'
  ),
  feature(
    'EMAIL_CAMPAIGN',
    'EMAIL',
    ['CAMPAIGN'],
    'lite.channel.email.campaign',
    'MO_MANAGED_INFRASTRUCTURE'
  ),
  feature(
    'EMAIL_CONVERSATION',
    'EMAIL',
    ['CONVERSATION'],
    'lite.channel.email.conversation',
    'WORKSPACE_OWNED_IDENTITY'
  ),
  feature(
    'SMS_MO_SYSTEM_NOTIFICATION',
    'SMS',
    ['NOTIFICATION'],
    'lite.channel.sms.mo_system_notification',
    'MO_MANAGED_INFRASTRUCTURE'
  ),
  feature(
    'SMS_WORKSPACE_NOTIFICATION',
    'SMS',
    ['NOTIFICATION'],
    'lite.channel.sms.workspace_notification',
    'WORKSPACE_OWNED_IDENTITY'
  ),
  feature(
    'SMS_WORKSPACE_CAMPAIGN',
    'SMS',
    ['CAMPAIGN'],
    'lite.channel.sms.workspace_campaign',
    'WORKSPACE_OWNED_IDENTITY'
  ),
  feature(
    'WHATSAPP_BUSINESS',
    'WHATSAPP',
    ['CAMPAIGN', 'NOTIFICATION', 'CONVERSATION'],
    'lite.channel.whatsapp.business',
    'WORKSPACE_OWNED_IDENTITY'
  ),
  feature(
    'WECHAT_ECOSYSTEM',
    'WECHAT',
    ['NOTIFICATION', 'CONVERSATION'],
    'lite.channel.wechat.ecosystem',
    'WORKSPACE_OWNED_IDENTITY'
  )
] satisfies readonly ChannelFeatureDefinitionV1[]);

export function channelFeatureDefinitionV1(
  featureKey: ChannelFeatureKeyV1
): Readonly<ChannelFeatureDefinitionV1> {
  const definition = channelFeatureDefinitionsV1.find((item) => item.featureKey === featureKey);
  if (!definition) throw new TypeError('Unknown channel feature.');
  return definition;
}

export const channelEntitlementAccessStatusesV1 = [
  'ENABLED',
  'NOT_ENTITLED',
  'DISABLED',
  'INVALID_ENTITLEMENT_VALUE'
] as const;
export type ChannelEntitlementAccessStatusV1 = (typeof channelEntitlementAccessStatusesV1)[number];

export interface ChannelEntitlementAccessV1 {
  schemaVersion: 1;
  workspaceId: string;
  featureKey: ChannelFeatureKeyV1;
  entitlementKey: string;
  status: ChannelEntitlementAccessStatusV1;
  allowed: boolean;
  entitlementRef?: Readonly<{
    resolvedAt: string;
    contributingGrantRefs: readonly Readonly<{ grantId: string; version: number }>[];
  }>;
  authority: ChannelPlatformAuthorityConsequencesV1;
}
export function assessChannelEntitlementV1(
  workspaceId: string,
  featureKey: ChannelFeatureKeyV1,
  resolvedEntitlements: readonly Readonly<ResolvedEntitlementV1>[]
): ChannelEntitlementAccessV1 {
  const definition = channelFeatureDefinitionV1(featureKey);
  const matches = resolvedEntitlements.filter(
    (item) =>
      item.subject.scope === 'WORKSPACE' &&
      item.subject.workspaceId === workspaceId &&
      item.key === definition.entitlementKey
  );
  if (matches.length > 1) throw new TypeError('Resolved channel entitlement must be unique.');
  const entitlement = matches[0];
  let status: ChannelEntitlementAccessStatusV1 = 'NOT_ENTITLED';
  if (entitlement) {
    status =
      entitlement.value.kind !== 'BOOLEAN'
        ? 'INVALID_ENTITLEMENT_VALUE'
        : entitlement.value.enabled
          ? 'ENABLED'
          : 'DISABLED';
  }
  return {
    schemaVersion: 1,
    workspaceId,
    featureKey,
    entitlementKey: definition.entitlementKey,
    status,
    allowed: status === 'ENABLED',
    ...(entitlement
      ? {
          entitlementRef: {
            resolvedAt: entitlement.resolvedAt,
            contributingGrantRefs: entitlement.contributingGrantRefs
          }
        }
      : {}),
    authority: noChannelPlatformAuthorityConsequencesV1
  };
}
