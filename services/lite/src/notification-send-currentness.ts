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
    private readonly endpoints: EmailCampaignEndpointResolver,
    private readonly outbound: Pick<PostgresOutboundContactPolicyStore, 'currentGlobalSuppressions'>
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
      if (ruleState.state === 'UNAVAILABLE') return result('UNAVAILABLE', 'OWNER_UNAVAILABLE');
      if (ruleState.state === 'UNKNOWN') return result('UNKNOWN', 'OWNER_DATA_UNKNOWN');
      if (ruleState.state === 'REVOKED') return result('REVOKED', 'ENTITLEMENT_REVOKED');
      if (ruleState.state !== 'CURRENT') return result('STALE', 'RULE_STALE');
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
        rule.spec.content.publishPackageId !== intent.content.publishPackageId ||
        rule.spec.content.version !== intent.content.version ||
        rule.spec.content.fingerprintSha256 !== intent.content.fingerprintSha256 ||
        rule.spec.senderProfile.senderProfileId !== intent.senderProfile.senderProfileId ||
        rule.spec.senderProfile.version !== intent.senderProfile.version ||
        rule.spec.senderProfile.fingerprintSha256 !== intent.senderProfile.fingerprintSha256
      )
        return result('STALE', 'RULE_STALE');

      const targetRef: OutboundContactTargetReferenceV1 = {
        owner: intent.target.owner,
        kind: intent.target.kind,
        id: intent.target.id,
        version: intent.target.version
      };
      const endpoint = await this.endpoints.resolve(workspaceId, targetRef);
      if (endpoint.state === 'UNAVAILABLE') return result('UNAVAILABLE', 'ENDPOINT_UNAVAILABLE');
      if (endpoint.state === 'UNKNOWN' || endpoint.state === 'NOT_FOUND')
        return result('UNKNOWN', 'ENDPOINT_UNAVAILABLE');
      if (
        endpoint.state !== 'CURRENT' ||
        endpoint.endpointFingerprintSha256 !== intent.target.endpointFingerprintSha256
      )
        return result('STALE', 'ENDPOINT_DRIFT');

      const suppressions = await this.outbound.currentGlobalSuppressions(
        workspaceId,
        intent.target.endpointFingerprintSha256
      );
      if (suppressions.some((item) => item.status === 'ACTIVE'))
        return result('SUPPRESSED', 'OUTBOUND_POLICY_SUPPRESSED');

      return result('CURRENT', 'EXACT_NOTIFICATION_PLAN_CURRENT');
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'PERSISTENCE_UNAVAILABLE') return result('UNAVAILABLE', 'OWNER_UNAVAILABLE');
      return result('UNKNOWN', 'OWNER_DATA_UNKNOWN');
    }
  }
}
