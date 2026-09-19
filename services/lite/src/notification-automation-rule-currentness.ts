import { createHash } from 'node:crypto';
import type {
  ChannelNotificationAutomationRuleCurrentnessReasonV1,
  ChannelNotificationAutomationRuleCurrentnessStateV1,
  ChannelNotificationAutomationRuleCurrentnessV1
} from '@markorbit/contracts/channel-notification-automation';
import type { ChannelNotificationRuleId } from '@markorbit/contracts/channel-notification';
import type { PublishPackage } from '@markorbit/contracts/product-loop';
import type { ChannelEntitlementAccessV1 } from '@markorbit/contracts/channel-platform';
import type { WorkspaceEmailSenderProfileV1 } from '@markorbit/contracts/email-sender-profile';
import type { ContentPreparationStore } from './content-preparation.js';
import type { PostgresEmailSenderProfileStore } from './email-sender-profile.js';
import type { PostgresNotificationAutomationRuleStore } from './notification-automation-rule.js';

export interface NotificationAutomationEntitlementReader {
  resolve(
    workspaceId: string
  ): Promise<Readonly<ChannelEntitlementAccessV1> | Readonly<{ unavailable: true }>>;
}

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

function fingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

export class NotificationAutomationRuleCurrentnessResolver {
  constructor(
    private readonly rules: Pick<PostgresNotificationAutomationRuleStore, 'getExact' | 'getLatest'>,
    private readonly content: Pick<ContentPreparationStore, 'findPublishPackage'>,
    private readonly senders: Pick<
      PostgresEmailSenderProfileStore,
      'getExactSenderProfile' | 'evaluateSenderProfileCurrentness'
    >,
    private readonly entitlement: NotificationAutomationEntitlementReader,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly verificationMaximumAgeMs = 24 * 60 * 60 * 1000
  ) {}

  async resolve(
    workspaceId: string,
    notificationRuleId: ChannelNotificationRuleId,
    version: number
  ): Promise<ChannelNotificationAutomationRuleCurrentnessV1> {
    let ruleFingerprintSha256 = '0'.repeat(64);
    const result = (
      state: ChannelNotificationAutomationRuleCurrentnessStateV1,
      reason: ChannelNotificationAutomationRuleCurrentnessReasonV1
    ): ChannelNotificationAutomationRuleCurrentnessV1 => ({
      schemaVersion: 1,
      workspaceId,
      notificationRuleId,
      version,
      ruleFingerprintSha256,
      state,
      reason,
      evaluatedAt: this.now(),
      protectedActionAuthorized: false,
      externalSendAuthorized: false
    });

    try {
      const [exact, latest] = await Promise.all([
        this.rules.getExact(workspaceId, notificationRuleId, version),
        this.rules.getLatest(workspaceId, notificationRuleId)
      ]);

      if (!exact || !latest) return result('UNKNOWN', 'OWNER_DATA_UNKNOWN');
      if (exact.workspaceId !== workspaceId || latest.workspaceId !== workspaceId)
        return result('UNKNOWN', 'WORKSPACE_MISMATCH');

      ruleFingerprintSha256 = exact.spec.ruleFingerprintSha256;

      if (latest.version !== version) return result('STALE', 'RULE_SUPERSEDED');

      if (exact.status === 'REVOKED') return result('REVOKED', 'RULE_NOT_ACTIVE');
      if (exact.status !== 'ACTIVE') return result('STALE', 'RULE_NOT_ACTIVE');

      const entitlement = await this.entitlement.resolve(workspaceId);
      if ('unavailable' in entitlement) return result('UNAVAILABLE', 'OWNER_UNAVAILABLE');
      if (!entitlement.allowed) return result('REVOKED', 'ENTITLEMENT_REVOKED');

      const publishPackage = await this.content.findPublishPackage(
        workspaceId,
        exact.spec.content.publishPackageId,
        exact.spec.content.version
      );
      if (!publishPackage) return result('UNKNOWN', 'CONTENT_NOT_FOUND');
      if (
        publishPackage.workspaceId !== workspaceId ||
        publishPackage.publishPackageFingerprintSha256 !== exact.spec.content.fingerprintSha256
      )
        return result('STALE', 'CONTENT_FINGERPRINT_MISMATCH');

      let sender: WorkspaceEmailSenderProfileV1;
      try {
        sender = await this.senders.getExactSenderProfile(
          workspaceId,
          exact.spec.senderProfile.senderProfileId,
          exact.spec.senderProfile.version
        );
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === 'NOT_FOUND') return result('UNKNOWN', 'SENDER_PROFILE_NOT_FOUND');
        if (code === 'PERSISTENCE_UNAVAILABLE')
          return result('UNAVAILABLE', 'SENDER_PROFILE_UNAVAILABLE');
        return result('UNKNOWN', 'OWNER_DATA_UNKNOWN');
      }

      if (
        sender.workspaceId !== workspaceId ||
        fingerprint(sender) !== exact.spec.senderProfile.fingerprintSha256
      )
        return result('STALE', 'SENDER_PROFILE_STALE');

      const senderCurrentness = await this.senders.evaluateSenderProfileCurrentness(
        workspaceId,
        exact.spec.senderProfile.senderProfileId,
        this.verificationMaximumAgeMs
      );
      if (
        senderCurrentness.version !== exact.spec.senderProfile.version ||
        senderCurrentness.state === 'STALE' ||
        senderCurrentness.state === 'SUSPENDED' ||
        senderCurrentness.state === 'PENDING_VERIFICATION'
      )
        return result('STALE', 'SENDER_PROFILE_STALE');
      if (senderCurrentness.state === 'REVOKED') return result('REVOKED', 'SENDER_PROFILE_REVOKED');
      if (senderCurrentness.state === 'UNKNOWN' || senderCurrentness.state === 'UNAVAILABLE')
        return result('UNAVAILABLE', 'SENDER_PROFILE_UNAVAILABLE');
      if (senderCurrentness.state !== 'CURRENT_ELIGIBLE')
        return result('UNKNOWN', 'OWNER_DATA_UNKNOWN');

      return result('CURRENT', 'EXACT_ACTIVE_RULE_CURRENT');
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'PERSISTENCE_UNAVAILABLE') return result('UNAVAILABLE', 'OWNER_UNAVAILABLE');
      return result('UNKNOWN', 'OWNER_DATA_UNKNOWN');
    }
  }
}

export function publishPackageMatchesNotificationRule(
  publishPackage: Readonly<PublishPackage>,
  expectedFingerprintSha256: string
): boolean {
  return publishPackage.publishPackageFingerprintSha256 === expectedFingerprintSha256;
}
