import { describe, expect, it } from 'vitest';
import { noChannelNotificationAuthorityConsequencesV1 } from '../src/channel-notification.js';
import {
  assertEmailCampaignSendIntentV1,
  assertEmailNotificationSendIntentV1,
  assertTradingListingPublicationIntentV1,
  canonicalEmailCampaignSendIntentPayloadV1,
  canonicalEmailNotificationSendIntentPayloadV1,
  canonicalTradingListingPublicationIntentPayloadV1,
  protectedExternalActionKindsV1,
  type EmailCampaignSendIntentV1,
  type EmailNotificationSendIntentV1,
  type TradingListingPublicationIntentV1
} from '../src/protected-external-action.js';

const intent: TradingListingPublicationIntentV1 = {
  schemaVersion: 1,
  actionKind: 'TRADING_LISTING_PUBLISH',
  workspaceId: '018f0000-0000-7000-8000-000000001176',
  listingDraft: { id: 'trading-listing-draft_1176', version: 3 },
  listingReview: { id: 'trading-listing-review_1176', version: 2 },
  listingAssets: [
    { id: 'listing-asset_b', version: 4 },
    { id: 'listing-asset_a', version: 1 }
  ],
  marketplaceTargetBinding: { id: 'trading-marketplace-target-binding_1176', version: 5 },
  effectFingerprintSha256: 'a'.repeat(64)
};

describe('bounded protected external action contract', () => {
  it('contains only the three closed protected external action kinds', () => {
    expect(protectedExternalActionKindsV1).toEqual([
      'TRADING_LISTING_PUBLISH',
      'EMAIL_CAMPAIGN_SEND',
      'EMAIL_NOTIFICATION_SEND'
    ]);
  });

  it('canonicalizes the Listing Asset version set deterministically', () => {
    expect(canonicalTradingListingPublicationIntentPayloadV1(intent).listingAssets).toEqual([
      { id: 'listing-asset_a', version: 1 },
      { id: 'listing-asset_b', version: 4 }
    ]);
    expect(() => assertTradingListingPublicationIntentV1(intent)).not.toThrow();
  });

  it('rejects duplicate Listing Asset ids and non-SHA fingerprints', () => {
    expect(() =>
      assertTradingListingPublicationIntentV1({
        ...intent,
        listingAssets: [
          { id: 'listing-asset_a', version: 1 },
          { id: 'listing-asset_a', version: 2 }
        ]
      })
    ).toThrow(/distinct/);
    expect(() =>
      assertTradingListingPublicationIntentV1({ ...intent, effectFingerprintSha256: 'browser' })
    ).toThrow(/SHA-256/);
  });

  it('canonicalizes Email Campaign send without raw endpoints or provider fields', () => {
    const emailIntent: EmailCampaignSendIntentV1 = {
      schemaVersion: 1,
      actionKind: 'EMAIL_CAMPAIGN_SEND',
      workspaceId: intent.workspaceId,
      campaign: { id: 'email-campaign_test', version: 2, fingerprintSha256: 'a'.repeat(64) },
      campaignReview: { id: 'campaign-review_test', version: 1 },
      senderProfile: {
        id: 'email-sender-profile_primary',
        version: 3,
        fingerprintSha256: 'b'.repeat(64)
      },
      audience: {
        id: 'campaign-audience_test',
        version: 1,
        fingerprintSha256: 'c'.repeat(64)
      },
      content: {
        id: 'campaign-content_test',
        version: 1,
        fingerprintSha256: 'd'.repeat(64)
      },
      brand: {
        id: 'campaign-brand_test',
        version: 1,
        fingerprintSha256: 'e'.repeat(64)
      },
      recipientCount: 2,
      deliveryPlanFingerprintSha256: 'f'.repeat(64),
      effectFingerprintSha256: '0'.repeat(64)
    };
    expect(() => assertEmailCampaignSendIntentV1(emailIntent)).not.toThrow();
    const canonical = canonicalEmailCampaignSendIntentPayloadV1(emailIntent);
    expect(canonical).not.toHaveProperty('rawEmail');
    expect(canonical).not.toHaveProperty('provider');
    expect(canonical).not.toHaveProperty('credential');
    expect(canonical.recipientCount).toBe(2);
  });

  it('rejects malformed Email Campaign send fingerprints and unbounded recipient counts', () => {
    const emailIntent: EmailCampaignSendIntentV1 = {
      schemaVersion: 1,
      actionKind: 'EMAIL_CAMPAIGN_SEND',
      workspaceId: intent.workspaceId,
      campaign: { id: 'email-campaign_test', version: 1, fingerprintSha256: 'a'.repeat(64) },
      campaignReview: { id: 'campaign-review_test', version: 1 },
      senderProfile: {
        id: 'email-sender-profile_primary',
        version: 1,
        fingerprintSha256: 'b'.repeat(64)
      },
      audience: { id: 'campaign-audience_test', version: 1, fingerprintSha256: 'c'.repeat(64) },
      content: { id: 'campaign-content_test', version: 1, fingerprintSha256: 'd'.repeat(64) },
      brand: { id: 'campaign-brand_test', version: 1, fingerprintSha256: 'e'.repeat(64) },
      recipientCount: 1,
      deliveryPlanFingerprintSha256: 'f'.repeat(64),
      effectFingerprintSha256: '0'.repeat(64)
    };
    expect(() =>
      assertEmailCampaignSendIntentV1({ ...emailIntent, recipientCount: 10_001 })
    ).toThrow(/bounded maximum/);
    expect(() =>
      assertEmailCampaignSendIntentV1({
        ...emailIntent,
        senderProfile: { ...emailIntent.senderProfile, fingerprintSha256: 'secret@example.com' }
      })
    ).toThrow(/SHA-256|raw email|not allowed/);
    expect(() =>
      assertEmailCampaignSendIntentV1({
        ...emailIntent,
        rawEmail: 'person@example.com'
      } as unknown as EmailCampaignSendIntentV1)
    ).toThrow(/not allowed|raw email/);
  });

  it('binds automated Email Notification send to exact rule activation and effect', () => {
    const notification = {
      schemaVersion: 1 as const,
      notificationSendIntentId: 'channel-notification-send-intent_primary' as const,
      workspaceId: intent.workspaceId,
      version: 1 as const,
      featureKey: 'EMAIL_NOTIFICATION' as const,
      rule: {
        notificationRuleId: 'channel-notification-rule_primary' as const,
        version: 2,
        fingerprintSha256: '1'.repeat(64)
      },
      trigger: {
        notificationTriggerEvidenceId: 'channel-notification-trigger_primary' as const,
        version: 1 as const,
        fingerprintSha256: '2'.repeat(64)
      },
      target: {
        owner: 'LITE',
        kind: 'WORKSPACE_DIRECTORY_ENTRY',
        id: 'workspace-directory-entry_primary',
        version: 3,
        endpointFingerprintSha256: '3'.repeat(64)
      },
      content: {
        publishPackageId: 'publish-package_primary' as const,
        version: 4,
        fingerprintSha256: '4'.repeat(64)
      },
      senderProfile: {
        senderProfileId: 'email-sender-profile_primary' as const,
        version: 5,
        fingerprintSha256: '5'.repeat(64)
      },
      deliveryPlanFingerprintSha256: '6'.repeat(64),
      effectFingerprintSha256: '7'.repeat(64),
      authority: noChannelNotificationAuthorityConsequencesV1
    };
    const protectedIntent: EmailNotificationSendIntentV1 = {
      schemaVersion: 1,
      actionKind: 'EMAIL_NOTIFICATION_SEND',
      workspaceId: intent.workspaceId,
      notification,
      activationEvidence: {
        owner: 'CORE',
        kind: 'GOVERNED_HUMAN_ACTION_RECEIPT',
        action: 'ACTIVATE',
        workspaceId: intent.workspaceId,
        notificationRuleId: notification.rule.notificationRuleId,
        authorizedRuleVersion: notification.rule.version,
        authorizedRuleFingerprintSha256: notification.rule.fingerprintSha256,
        evidenceRef:
          'core-governed-human-action-receipt:018f0000-0000-7000-8000-000000001177',
        evidenceFingerprintSha256: '8'.repeat(64),
        verifiedAt: '2026-09-20T00:00:00.000Z'
      },
      effectFingerprintSha256: notification.effectFingerprintSha256
    };

    expect(() => assertEmailNotificationSendIntentV1(protectedIntent)).not.toThrow();
    expect(canonicalEmailNotificationSendIntentPayloadV1(protectedIntent)).toMatchObject({
      actionKind: 'EMAIL_NOTIFICATION_SEND',
      workspaceId: intent.workspaceId,
      notification: {
        rule: notification.rule,
        trigger: notification.trigger
      }
    });
    expect(
      canonicalEmailNotificationSendIntentPayloadV1(protectedIntent)
    ).not.toHaveProperty('humanReceipt');
  });

  it('rejects notification send when activation or effect binding drifts', () => {
    const base = {
      schemaVersion: 1 as const,
      actionKind: 'EMAIL_NOTIFICATION_SEND' as const,
      workspaceId: intent.workspaceId,
      notification: {
        schemaVersion: 1 as const,
        notificationSendIntentId: 'channel-notification-send-intent_primary' as const,
        workspaceId: intent.workspaceId,
        version: 1 as const,
        featureKey: 'EMAIL_NOTIFICATION' as const,
        rule: {
          notificationRuleId: 'channel-notification-rule_primary' as const,
          version: 2,
          fingerprintSha256: '1'.repeat(64)
        },
        trigger: {
          notificationTriggerEvidenceId: 'channel-notification-trigger_primary' as const,
          version: 1 as const,
          fingerprintSha256: '2'.repeat(64)
        },
        target: {
          owner: 'LITE',
          kind: 'WORKSPACE_DIRECTORY_ENTRY',
          id: 'workspace-directory-entry_primary',
          version: 3,
          endpointFingerprintSha256: '3'.repeat(64)
        },
        content: {
          publishPackageId: 'publish-package_primary' as const,
          version: 4,
          fingerprintSha256: '4'.repeat(64)
        },
        senderProfile: {
          senderProfileId: 'email-sender-profile_primary' as const,
          version: 5,
          fingerprintSha256: '5'.repeat(64)
        },
        deliveryPlanFingerprintSha256: '6'.repeat(64),
        effectFingerprintSha256: '7'.repeat(64),
        authority: noChannelNotificationAuthorityConsequencesV1
      },
      activationEvidence: {
        owner: 'CORE' as const,
        kind: 'GOVERNED_HUMAN_ACTION_RECEIPT' as const,
        action: 'ACTIVATE' as const,
        workspaceId: intent.workspaceId,
        notificationRuleId: 'channel-notification-rule_primary' as const,
        authorizedRuleVersion: 2,
        authorizedRuleFingerprintSha256: '1'.repeat(64),
        evidenceRef:
          'core-governed-human-action-receipt:018f0000-0000-7000-8000-000000001177',
        evidenceFingerprintSha256: '8'.repeat(64),
        verifiedAt: '2026-09-20T00:00:00.000Z'
      },
      effectFingerprintSha256: '7'.repeat(64)
    } satisfies EmailNotificationSendIntentV1;

    expect(() =>
      assertEmailNotificationSendIntentV1({
        ...base,
        activationEvidence: {
          ...base.activationEvidence,
          authorizedRuleFingerprintSha256: '9'.repeat(64)
        }
      })
    ).toThrow(/exact current Core-governed rule activation/);
    expect(() =>
      assertEmailNotificationSendIntentV1({
        ...base,
        effectFingerprintSha256: '0'.repeat(64)
      })
    ).toThrow(/effect fingerprint/);
  });

});
