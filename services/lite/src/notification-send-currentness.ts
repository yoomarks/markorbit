import {
  assertNotificationSendBindingV1,
  type ChannelNotificationAutomationGovernanceEvidenceV1,
  type ChannelNotificationSendIntentV1,
  type ChannelNotificationTriggerEvidenceV1,
  type NotificationSendCurrentnessReasonV1,
  type NotificationSendCurrentnessStateV1,
  type NotificationSendCurrentnessV1
} from '@markorbit/contracts';
import {
  channelNotificationDeliveryPlanFingerprintSha256V1,
  channelNotificationSendEffectFingerprintSha256V1,
  channelNotificationTriggerFingerprintSha256V1
} from '@markorbit/contracts/channel-notification-fingerprint';
import type { OutboundContactTargetReferenceV1 } from '@markorbit/contracts/outbound-contact-policy';
import type { NotificationAutomationGovernanceVerifierV1 } from './notification-automation-rule.js';
import type { NotificationAutomationRuleCurrentnessResolver } from './notification-automation-rule-currentness.js';
import type { PostgresNotificationAutomationRuleStore } from './notification-automation-rule.js';
import type { EmailCampaignEndpointResolver } from './email-campaign-delivery-currentness.js';
import type { PostgresOutboundContactPolicyStore } from './outbound-contact-policy.js';
import type { WorkspaceDirectorySmsEndpointResolverV1 } from './sms-endpoint-currentness.js';

export type NotificationTriggerOwnerCurrentnessState =
  'CURRENT' | 'STALE' | 'REVOKED' | 'UNKNOWN' | 'UNAVAILABLE';
export interface NotificationTriggerEvidenceCurrentnessReaderV1 {
  validateCurrent(
    evidence: Readonly<ChannelNotificationTriggerEvidenceV1>
  ): Promise<Readonly<{ state: NotificationTriggerOwnerCurrentnessState }>>;
}

export class UnavailableNotificationTriggerEvidenceCurrentnessReaderV1 implements NotificationTriggerEvidenceCurrentnessReaderV1 {
  validateCurrent(): Promise<Readonly<{ state: NotificationTriggerOwnerCurrentnessState }>> {
    return Promise.resolve({ state: 'UNAVAILABLE' });
  }
}

export class NotificationSendCurrentnessResolverV1 {
  constructor(
    private readonly rules: Pick<PostgresNotificationAutomationRuleStore, 'getExact'>,
    private readonly ruleCurrentness: Pick<
      NotificationAutomationRuleCurrentnessResolver,
      'resolve'
    >,
    private readonly governance: NotificationAutomationGovernanceVerifierV1,
    private readonly triggers: NotificationTriggerEvidenceCurrentnessReaderV1,
    private readonly emailEndpoints: EmailCampaignEndpointResolver,
    private readonly outbound: Pick<
      PostgresOutboundContactPolicyStore,
      'currentGlobalSuppressions' | 'evaluate'
    >,
    private readonly smsEndpoints?: Pick<WorkspaceDirectorySmsEndpointResolverV1, 'resolve'>
  ) {}

  async resolve(
    workspaceId: string,
    intent: Readonly<ChannelNotificationSendIntentV1>,
    triggerEvidence: Readonly<ChannelNotificationTriggerEvidenceV1>,
    activationEvidence: Readonly<ChannelNotificationAutomationGovernanceEvidenceV1>
  ): Promise<NotificationSendCurrentnessV1> {
    const result = (
      state: NotificationSendCurrentnessStateV1,
      reason: NotificationSendCurrentnessReasonV1
    ): NotificationSendCurrentnessV1 => ({
      schemaVersion: 1,
      workspaceId: workspaceId.toLowerCase(),
      actionKind: 'NOTIFICATION_SEND',
      effectFingerprintSha256: intent.effectFingerprintSha256,
      deliveryPlanFingerprintSha256: intent.deliveryPlanFingerprintSha256,
      state,
      reason
    });
    try {
      assertNotificationSendBindingV1({ intent, triggerEvidence, activationEvidence });
      if (
        intent.workspaceId.toLowerCase() !== workspaceId.toLowerCase() ||
        triggerEvidence.workspaceId.toLowerCase() !== workspaceId.toLowerCase() ||
        activationEvidence.workspaceId.toLowerCase() !== workspaceId.toLowerCase()
      )
        return result('UNKNOWN', 'WORKSPACE_MISMATCH');

      if (
        channelNotificationTriggerFingerprintSha256V1(triggerEvidence) !==
        triggerEvidence.triggerFingerprintSha256
      )
        return result('UNKNOWN', 'FINGERPRINT_MISMATCH');

      if (
        channelNotificationDeliveryPlanFingerprintSha256V1(intent) !==
          intent.deliveryPlanFingerprintSha256 ||
        channelNotificationSendEffectFingerprintSha256V1(intent) !== intent.effectFingerprintSha256
      )
        return result('UNKNOWN', 'FINGERPRINT_MISMATCH');

      const rule = await this.rules.getExact(
        workspaceId,
        intent.rule.notificationRuleId,
        intent.rule.version
      );
      if (!rule) return result('UNKNOWN', 'OWNER_DATA_UNKNOWN');
      if (
        rule.status !== 'ACTIVE' ||
        rule.spec.ruleFingerprintSha256 !== intent.rule.fingerprintSha256
      )
        return result('STALE', 'RULE_STALE');

      const ruleState = await this.ruleCurrentness.resolve(
        workspaceId,
        rule.notificationRuleId,
        rule.version
      );
      if (ruleState.state === 'UNAVAILABLE')
        return result(
          'UNAVAILABLE',
          ruleState.reason === 'CHANNEL_IDENTITY_UNAVAILABLE'
            ? 'CHANNEL_IDENTITY_UNAVAILABLE'
            : 'OWNER_UNAVAILABLE'
        );
      if (ruleState.state === 'UNKNOWN')
        return result(
          'UNKNOWN',
          ruleState.reason === 'CHANNEL_IDENTITY_UNKNOWN'
            ? 'CHANNEL_IDENTITY_UNKNOWN'
            : 'OWNER_DATA_UNKNOWN'
        );
      if (ruleState.state === 'REAUTH_REQUIRED')
        return result('REAUTH_REQUIRED', 'CHANNEL_IDENTITY_REAUTH_REQUIRED');
      if (ruleState.state === 'REVOKED')
        return result(
          'REVOKED',
          ruleState.reason === 'CHANNEL_IDENTITY_REVOKED'
            ? 'CHANNEL_IDENTITY_REVOKED'
            : 'ENTITLEMENT_REVOKED'
        );
      if (ruleState.state !== 'CURRENT')
        return result(
          'STALE',
          ruleState.reason === 'CHANNEL_IDENTITY_STALE' ? 'CHANNEL_IDENTITY_STALE' : 'RULE_STALE'
        );
      if (
        !rule.activationEvidence ||
        rule.activationEvidence.evidenceRef !== activationEvidence.evidenceRef ||
        rule.activationEvidence.evidenceFingerprintSha256 !==
          activationEvidence.evidenceFingerprintSha256 ||
        rule.activationEvidence.authorizedRuleVersion !== rule.version ||
        rule.activationEvidence.authorizedRuleFingerprintSha256 !== rule.spec.ruleFingerprintSha256
      )
        return result('STALE', 'ACTIVATION_EVIDENCE_STALE');

      let verifiedActivation: Readonly<ChannelNotificationAutomationGovernanceEvidenceV1>;
      try {
        verifiedActivation = await this.governance.verify({
          action: 'ACTIVATE',
          workspaceId,
          notificationRuleId: rule.notificationRuleId,
          candidateRuleVersion: rule.version,
          candidateRuleFingerprintSha256: rule.spec.ruleFingerprintSha256,
          governanceEvidenceRef: activationEvidence.evidenceRef
        });
      } catch {
        return result('UNAVAILABLE', 'OWNER_UNAVAILABLE');
      }
      if (
        verifiedActivation.evidenceFingerprintSha256 !==
          activationEvidence.evidenceFingerprintSha256 ||
        verifiedActivation.authorizedRuleVersion !== rule.version ||
        verifiedActivation.authorizedRuleFingerprintSha256 !== rule.spec.ruleFingerprintSha256
      )
        return result('STALE', 'ACTIVATION_EVIDENCE_STALE');

      if (
        rule.spec.triggerSelector.owner !== triggerEvidence.owner ||
        rule.spec.triggerSelector.eventType !== triggerEvidence.eventType ||
        rule.spec.triggerSelector.subjectKind !== triggerEvidence.subject.kind
      )
        return result('STALE', 'TRIGGER_STALE');
      const triggerState = await this.triggers.validateCurrent(triggerEvidence);
      if (triggerState.state === 'UNAVAILABLE') return result('UNAVAILABLE', 'TRIGGER_UNAVAILABLE');
      if (triggerState.state === 'UNKNOWN') return result('UNKNOWN', 'OWNER_DATA_UNKNOWN');
      if (triggerState.state === 'REVOKED') return result('REVOKED', 'TRIGGER_STALE');
      if (triggerState.state !== 'CURRENT') return result('STALE', 'TRIGGER_STALE');

      if (
        rule.spec.featureKey !== intent.featureKey ||
        rule.spec.content.publishPackageId !== intent.content.publishPackageId ||
        rule.spec.content.version !== intent.content.version ||
        rule.spec.content.fingerprintSha256 !== intent.content.fingerprintSha256
      )
        return result('STALE', 'RULE_STALE');

      if (rule.spec.featureKey === 'EMAIL_NOTIFICATION') {
        if (
          intent.featureKey !== 'EMAIL_NOTIFICATION' ||
          rule.spec.senderProfile.senderProfileId !== intent.senderProfile.senderProfileId ||
          rule.spec.senderProfile.version !== intent.senderProfile.version ||
          rule.spec.senderProfile.fingerprintSha256 !== intent.senderProfile.fingerprintSha256
        )
          return result('STALE', 'RULE_STALE');
      } else {
        if (
          intent.featureKey !== 'SMS_WORKSPACE_NOTIFICATION' ||
          rule.spec.channelIdentityBinding.id !== intent.channelIdentityBinding.id ||
          rule.spec.channelIdentityBinding.version !== intent.channelIdentityBinding.version ||
          rule.spec.channelIdentityBinding.fingerprintSha256 !==
            intent.channelIdentityBinding.fingerprintSha256
        )
          return result('STALE', 'RULE_STALE');
      }

      const targetRef: OutboundContactTargetReferenceV1 = {
        owner: intent.target.owner,
        kind: intent.target.kind,
        id: intent.target.id,
        version: intent.target.version
      };
      const endpoint =
        intent.featureKey === 'SMS_WORKSPACE_NOTIFICATION'
          ? this.smsEndpoints
            ? await this.smsEndpoints.resolve(workspaceId, targetRef)
            : { state: 'UNAVAILABLE' as const }
          : await this.emailEndpoints.resolve(workspaceId, targetRef);
      if (endpoint.state === 'UNAVAILABLE') return result('UNAVAILABLE', 'ENDPOINT_UNAVAILABLE');
      if (endpoint.state === 'UNKNOWN' || endpoint.state === 'NOT_FOUND')
        return result('UNKNOWN', 'ENDPOINT_UNAVAILABLE');
      if (
        endpoint.state !== 'CURRENT' ||
        endpoint.endpointFingerprintSha256 !== intent.target.endpointFingerprintSha256
      )
        return result('STALE', 'ENDPOINT_DRIFT');

      if (intent.featureKey === 'SMS_WORKSPACE_NOTIFICATION') {
        if (rule.spec.featureKey !== 'SMS_WORKSPACE_NOTIFICATION')
          return result('STALE', 'RULE_STALE');
        const readiness = await this.outbound.evaluate({
          workspaceId,
          actorPrincipalId: 'notification-automation-currentness',
          targetRef,
          endpointFingerprintSha256: intent.target.endpointFingerprintSha256,
          channel: 'SMS',
          purpose: 'WORKSPACE_NOTIFICATION',
          policyRef: rule.spec.contactPolicyRef,
          reviewedSendFingerprintSha256: intent.effectFingerprintSha256
        });
        if (readiness.outcome === 'BLOCKED')
          return result(
            'SUPPRESSED',
            readiness.reason === 'ACTIVE_SUPPRESSION'
              ? 'OUTBOUND_POLICY_SUPPRESSED'
              : 'OUTBOUND_POLICY_BLOCKED'
          );
        if (readiness.outcome !== 'READY_FOR_HUMAN_SEND')
          return result('UNKNOWN', 'OUTBOUND_POLICY_UNKNOWN');
      } else {
        const suppressions = await this.outbound.currentGlobalSuppressions(
          workspaceId,
          intent.target.endpointFingerprintSha256,
          'EMAIL'
        );
        if (suppressions.some((item) => item.status === 'ACTIVE'))
          return result('SUPPRESSED', 'OUTBOUND_POLICY_SUPPRESSED');
      }

      return result('CURRENT', 'EXACT_NOTIFICATION_PLAN_CURRENT');
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'PERSISTENCE_UNAVAILABLE') return result('UNAVAILABLE', 'OWNER_UNAVAILABLE');
      return result('UNKNOWN', 'OWNER_DATA_UNKNOWN');
    }
  }
}
