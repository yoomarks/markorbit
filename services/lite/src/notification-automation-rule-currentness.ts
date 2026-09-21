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
import type { WorkspaceChannelIdentityCurrentnessV1 } from '@markorbit/contracts/channel-identity-binding';
import type { ExternalCredentialSecretKindV1 } from '@markorbit/contracts/external-credential';
import type { WorkspaceChannelIdentityCurrentnessResolverV1 } from './workspace-channel-identity-currentness.js';
import type { PostgresLiteContentPreparationStore } from './content-preparation.js';
import type { PostgresEmailSenderProfileStore } from './email-sender-profile.js';
import type { PostgresNotificationAutomationRuleStore } from './notification-automation-rule.js';

export interface NotificationAutomationEntitlementReader {
  resolve(
    workspaceId: string
  ): Promise<Readonly<ChannelEntitlementAccessV1> | Readonly<{ unavailable: true }>>;
}

export interface SmsNotificationChannelIdentityCurrentnessReaderV1 {
  resolve(input: {
    workspaceId: string;
    featureKey: 'SMS_WORKSPACE_NOTIFICATION';
    binding: Readonly<{
      id: `workspace-channel-identity-binding_${string}`;
      version: number;
      fingerprintSha256: string;
    }>;
  }): Promise<Readonly<WorkspaceChannelIdentityCurrentnessV1>>;
}

export type SmsNotificationChannelCredentialRequirementsV1 =
  | Readonly<{
      kind: 'OAUTH';
      expectedProvider: string;
      requiredScopes: readonly string[];
    }>
  | Readonly<{
      kind: 'EXTERNAL_CREDENTIAL';
      expectedProvider: string;
      expectedSecretKind: ExternalCredentialSecretKindV1;
    }>;

export interface SmsNotificationChannelIdentityRequirementsReaderV1 {
  resolve(input: {
    workspaceId: string;
    featureKey: 'SMS_WORKSPACE_NOTIFICATION';
    binding: Readonly<{
      id: `workspace-channel-identity-binding_${string}`;
      version: number;
      fingerprintSha256: string;
    }>;
  }): Promise<
    Readonly<SmsNotificationChannelCredentialRequirementsV1> | Readonly<{ unavailable: true }>
  >;
}

export class UnavailableSmsNotificationChannelIdentityRequirementsReaderV1 implements SmsNotificationChannelIdentityRequirementsReaderV1 {
  resolve(): Promise<Readonly<{ unavailable: true }>> {
    return Promise.resolve({ unavailable: true });
  }
}

function unavailableSmsIdentityCurrentness(
  input: Parameters<SmsNotificationChannelIdentityCurrentnessReaderV1['resolve']>[0],
  now: () => string
): Readonly<WorkspaceChannelIdentityCurrentnessV1> {
  return {
    schemaVersion: 1,
    workspaceId: input.workspaceId,
    featureKey: input.featureKey,
    binding: input.binding,
    state: 'UNAVAILABLE',
    reason: 'OWNER_DATA_UNKNOWN',
    assessedAt: now(),
    createsExecutionAuthority: false
  };
}

export class C6SmsNotificationChannelIdentityCurrentnessReaderV1 implements SmsNotificationChannelIdentityCurrentnessReaderV1 {
  constructor(
    private readonly currentness: Pick<WorkspaceChannelIdentityCurrentnessResolverV1, 'resolve'>,
    private readonly requirements: SmsNotificationChannelIdentityRequirementsReaderV1,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async resolve(
    input: Parameters<SmsNotificationChannelIdentityCurrentnessReaderV1['resolve']>[0]
  ): Promise<Readonly<WorkspaceChannelIdentityCurrentnessV1>> {
    let requirements: Awaited<
      ReturnType<SmsNotificationChannelIdentityRequirementsReaderV1['resolve']>
    >;
    try {
      requirements = await this.requirements.resolve(input);
    } catch {
      return unavailableSmsIdentityCurrentness(input, this.now);
    }
    if ('unavailable' in requirements) return unavailableSmsIdentityCurrentness(input, this.now);

    try {
      return await this.currentness.resolve({
        workspaceId: input.workspaceId,
        featureKey: input.featureKey,
        binding: input.binding,
        ...(requirements.kind === 'OAUTH'
          ? {
              oauthRequirements: {
                expectedProvider: requirements.expectedProvider,
                requiredScopes: requirements.requiredScopes
              }
            }
          : {
              externalCredentialRequirements: {
                expectedProvider: requirements.expectedProvider,
                expectedSecretKind: requirements.expectedSecretKind
              }
            })
      });
    } catch {
      return unavailableSmsIdentityCurrentness(input, this.now);
    }
  }
}

export class UnavailableSmsNotificationChannelIdentityCurrentnessReaderV1 implements SmsNotificationChannelIdentityCurrentnessReaderV1 {
  constructor(private readonly now: () => string = () => new Date().toISOString()) {}

  resolve(
    input: Parameters<SmsNotificationChannelIdentityCurrentnessReaderV1['resolve']>[0]
  ): Promise<Readonly<WorkspaceChannelIdentityCurrentnessV1>> {
    return Promise.resolve(unavailableSmsIdentityCurrentness(input, this.now));
  }
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
    private readonly content: Pick<PostgresLiteContentPreparationStore, 'findPublishPackage'>,
    private readonly senders: Pick<
      PostgresEmailSenderProfileStore,
      'getExactSenderProfile' | 'evaluateSenderProfileCurrentness'
    >,
    private readonly entitlement: NotificationAutomationEntitlementReader,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly verificationMaximumAgeMs = 24 * 60 * 60 * 1000,
    private readonly smsIdentity: SmsNotificationChannelIdentityCurrentnessReaderV1 = new UnavailableSmsNotificationChannelIdentityCurrentnessReaderV1(
      now
    )
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

      if (exact.spec.featureKey === 'SMS_WORKSPACE_NOTIFICATION') {
        const identity = await this.smsIdentity.resolve({
          workspaceId,
          featureKey: 'SMS_WORKSPACE_NOTIFICATION',
          binding: exact.spec.channelIdentityBinding
        });
        if (
          identity.workspaceId !== workspaceId ||
          identity.featureKey !== 'SMS_WORKSPACE_NOTIFICATION' ||
          identity.binding.id !== exact.spec.channelIdentityBinding.id ||
          identity.binding.version !== exact.spec.channelIdentityBinding.version ||
          identity.binding.fingerprintSha256 !== exact.spec.channelIdentityBinding.fingerprintSha256
        )
          return result('UNKNOWN', 'CHANNEL_IDENTITY_UNKNOWN');
        if (identity.state === 'STALE') return result('STALE', 'CHANNEL_IDENTITY_STALE');
        if (identity.state === 'REVOKED') return result('REVOKED', 'CHANNEL_IDENTITY_REVOKED');
        if (identity.state === 'REAUTH_REQUIRED')
          return result('REAUTH_REQUIRED', 'CHANNEL_IDENTITY_REAUTH_REQUIRED');
        if (identity.state === 'NOT_ENTITLED') return result('REVOKED', 'ENTITLEMENT_REVOKED');
        if (identity.state === 'UNKNOWN') return result('UNKNOWN', 'CHANNEL_IDENTITY_UNKNOWN');
        if (identity.state === 'UNAVAILABLE')
          return result('UNAVAILABLE', 'CHANNEL_IDENTITY_UNAVAILABLE');
        if (identity.state !== 'CURRENT') return result('UNKNOWN', 'CHANNEL_IDENTITY_UNKNOWN');
        return result('CURRENT', 'EXACT_ACTIVE_RULE_CURRENT');
      }

      const entitlement = await this.entitlement.resolve(workspaceId);
      if ('unavailable' in entitlement) return result('UNAVAILABLE', 'OWNER_UNAVAILABLE');
      if (
        entitlement.workspaceId !== workspaceId ||
        entitlement.featureKey !== 'EMAIL_NOTIFICATION' ||
        entitlement.entitlementKey !== 'lite.channel.email.notification'
      )
        return result('UNKNOWN', 'OWNER_DATA_UNKNOWN');
      if (!entitlement.allowed) return result('REVOKED', 'ENTITLEMENT_REVOKED');

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
