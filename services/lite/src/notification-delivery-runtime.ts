import { createHash, randomUUID } from 'node:crypto';
import type {
  ChannelNotificationAutomationRuleV1,
  ChannelNotificationDeliveryAttemptV1,
  ChannelNotificationDeliveryObservationV1,
  ChannelNotificationSendIntentV1,
  NotificationSendAuthorizationV1,
  NotificationSendReleaseV1,
  SmsChannelNotificationDeliveryObservationV1,
  WorkspaceChannelIdentityBindingV1
} from '@markorbit/contracts';
import { noChannelNotificationDeliveryAuthorityConsequencesV1 } from '@markorbit/contracts';
import { noChannelNotificationAuthorityConsequencesV1 } from '@markorbit/contracts/channel-notification';
import {
  channelNotificationDeliveryPlanFingerprintSha256V1,
  channelNotificationSendEffectFingerprintSha256V1
} from '@markorbit/contracts/channel-notification-fingerprint';
import type { ChannelNotificationRuleId } from '@markorbit/contracts/channel-notification';
import type { WorkspaceDirectoryEntryV1 } from '@markorbit/contracts/workspace-directory';
import type { EmailTransportProviderV1 } from './email-transport.js';
import type { SmsTransportProviderV1 } from './sms-transport.js';
import type { EmailCampaignEndpointResolver } from './email-campaign-delivery-currentness.js';
import type { WorkspaceDirectorySmsEndpointResolverV1 } from './sms-endpoint-currentness.js';
import type { SmsNotificationChannelIdentityCurrentnessReaderV1 } from './notification-automation-rule-currentness.js';
import type { PostgresLiteContentPreparationStore } from './content-preparation.js';
import type { PostgresEmailSenderProfileStore } from './email-sender-profile.js';
import type { PostgresNotificationAutomationRuleStore } from './notification-automation-rule.js';
import type { PostgresWorkspaceDirectoryStore } from './workspace-directory.js';
import type { PostgresWorkspaceChannelIdentityBindingStoreV1 } from './workspace-channel-identity-binding.js';
import type { MarkRegLifecycleNotificationTriggerCurrentnessReaderV1 } from './notification-trigger-markreg.js';
import type { PostgresNotificationDeliveryStore } from './notification-delivery.js';

export interface NotificationExecutionClientV1 {
  authorize(command: {
    workspaceId: string;
    intent: Readonly<ChannelNotificationSendIntentV1>;
    triggerEvidence: Readonly<
      ReturnType<MarkRegLifecycleNotificationTriggerCurrentnessReaderV1['materialize']>
    >;
    activationEvidence: NonNullable<ChannelNotificationAutomationRuleV1['activationEvidence']>;
    idempotencyKey: string;
  }): Promise<NotificationSendAuthorizationV1>;
  release(command: {
    workspaceId: string;
    authorizationId: NotificationSendAuthorizationV1['authorizationId'];
    authorizationVersion: 1;
    idempotencyKey: string;
  }): Promise<NotificationSendReleaseV1>;
}

export class HttpNotificationExecutionClientV1 implements NotificationExecutionClientV1 {
  constructor(
    private readonly executionUrl: string,
    private readonly internalServiceSecret: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 5_000
  ) {}

  private async post<T>(workspaceId: string, path: string, idempotencyKey: string, body: unknown) {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.executionUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': this.internalServiceSecret,
          'x-markorbit-workspace-id': workspaceId,
          'idempotency-key': idempotencyKey
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch {
      throw new NotificationDeliveryRuntimeError(
        'EXECUTION_UNAVAILABLE',
        'Execution is unavailable.'
      );
    }
    const payload = (await response.json().catch(() => ({}))) as T & { message?: string };
    if (!response.ok)
      throw new NotificationDeliveryRuntimeError(
        'EXECUTION_REJECTED',
        payload.message ?? 'Execution rejected Notification send.'
      );
    return payload;
  }

  authorize(command: Parameters<NotificationExecutionClientV1['authorize']>[0]) {
    return this.post<NotificationSendAuthorizationV1>(
      command.workspaceId,
      '/v1/protected-external-actions/notification-send/authorizations',
      command.idempotencyKey,
      {
        intent: command.intent,
        triggerEvidence: command.triggerEvidence,
        activationEvidence: command.activationEvidence
      }
    );
  }

  release(command: Parameters<NotificationExecutionClientV1['release']>[0]) {
    return this.post<NotificationSendReleaseV1>(
      command.workspaceId,
      `/v1/protected-external-actions/notification-send/authorizations/${encodeURIComponent(command.authorizationId)}/releases`,
      command.idempotencyKey,
      { authorizationVersion: command.authorizationVersion }
    );
  }
}

export interface NotificationDestinationV1 {
  entry: Readonly<WorkspaceDirectoryEntryV1>;
  endpoint: string;
  endpointFingerprintSha256: string;
}

export class MarkRegSubjectWorkspaceDirectoryEmailResolverV1 {
  constructor(
    private readonly directory: Pick<
      PostgresWorkspaceDirectoryStore,
      'findLatestByExternalIdentityReference'
    >,
    private readonly endpoints: EmailCampaignEndpointResolver
  ) {}

  async resolve(workspaceId: string, formalMatterId: string, formalMatterVersion: number) {
    const matches = await this.directory.findLatestByExternalIdentityReference(
      workspaceId,
      formalMatterId,
      String(formalMatterVersion)
    );
    if (matches.length !== 1)
      throw new NotificationDeliveryRuntimeError(
        'DESTINATION_UNAVAILABLE',
        'Exact Formal Matter Workspace Directory destination is unavailable.'
      );
    const entry = matches[0]!;
    const resolved = await this.endpoints.resolve(workspaceId, {
      owner: 'LITE',
      kind: 'WORKSPACE_DIRECTORY_ENTRY',
      id: entry.workspaceDirectoryEntryId,
      version: entry.version
    });
    if (resolved.state !== 'CURRENT' || !resolved.endpoint || !resolved.endpointFingerprintSha256)
      throw new NotificationDeliveryRuntimeError(
        'DESTINATION_UNAVAILABLE',
        'Destination is not current.'
      );
    return {
      entry,
      endpoint: resolved.endpoint,
      endpointFingerprintSha256: resolved.endpointFingerprintSha256
    };
  }
}

export class NotificationDeliveryRuntimeError extends Error {
  constructor(
    readonly code:
      | 'INVALID_REQUEST'
      | 'RULE_NOT_ACTIVE'
      | 'TRIGGER_NOT_FOUND'
      | 'TRIGGER_MISMATCH'
      | 'DESTINATION_UNAVAILABLE'
      | 'CONTENT_UNAVAILABLE'
      | 'SENDER_UNAVAILABLE'
      | 'IDENTITY_UNAVAILABLE'
      | 'MANAGED_COMMUNICATION_UNSUPPORTED'
      | 'EXECUTION_UNAVAILABLE'
      | 'EXECUTION_REJECTED'
      | 'ATTEMPT_AMBIGUOUS'
      | 'ATTEMPT_TERMINAL',
    message: string
  ) {
    super(message);
    this.name = 'NotificationDeliveryRuntimeError';
  }
}

export interface DeliverEmailNotificationCommandV1 {
  workspaceId: string;
  notificationRuleId: ChannelNotificationRuleId;
  lifecycleEventId: string;
  idempotencyKey: string;
}

const digest = (value: string) => createHash('sha256').update(value).digest('hex');

export class EmailNotificationDeliveryRuntimeV1 {
  constructor(
    private readonly rules: Pick<PostgresNotificationAutomationRuleStore, 'getExact' | 'getLatest'>,
    private readonly triggers: MarkRegLifecycleNotificationTriggerCurrentnessReaderV1,
    private readonly destinations: MarkRegSubjectWorkspaceDirectoryEmailResolverV1,
    private readonly content: Pick<PostgresLiteContentPreparationStore, 'findPublishPackage'>,
    private readonly senders: Pick<PostgresEmailSenderProfileStore, 'getExactSenderProfile'>,
    private readonly execution: NotificationExecutionClientV1,
    private readonly store: Pick<
      PostgresNotificationDeliveryStore,
      'createAttempt' | 'getAttempt' | 'transitionAttempt' | 'recordObservation'
    >,
    private readonly transport: EmailTransportProviderV1,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async deliver(command: Readonly<DeliverEmailNotificationCommandV1>) {
    const rule = await this.rules.getLatest(command.workspaceId, command.notificationRuleId);
    if (!rule || rule.status !== 'ACTIVE' || !rule.activationEvidence)
      throw new NotificationDeliveryRuntimeError(
        'RULE_NOT_ACTIVE',
        'Exact active rule is required.'
      );
    if (rule.spec.featureKey !== 'EMAIL_NOTIFICATION')
      throw new NotificationDeliveryRuntimeError(
        'RULE_NOT_ACTIVE',
        'Email Notification delivery accepts EMAIL_NOTIFICATION rules only.'
      );
    const exactRule = await this.rules.getExact(
      command.workspaceId,
      command.notificationRuleId,
      rule.version
    );
    if (!exactRule || exactRule.spec.ruleFingerprintSha256 !== rule.spec.ruleFingerprintSha256)
      throw new NotificationDeliveryRuntimeError('RULE_NOT_ACTIVE', 'Rule owner evidence changed.');

    const ownerEvent = await this.triggers
      .getExact(command.workspaceId, command.lifecycleEventId)
      .catch(() => {
        throw new NotificationDeliveryRuntimeError(
          'TRIGGER_NOT_FOUND',
          'MarkReg trigger owner is unavailable.'
        );
      });
    if (!ownerEvent)
      throw new NotificationDeliveryRuntimeError(
        'TRIGGER_NOT_FOUND',
        'Lifecycle event was not found.'
      );
    const trigger = this.triggers.materialize(ownerEvent);
    if (
      rule.spec.triggerSelector.owner !== trigger.owner ||
      rule.spec.triggerSelector.eventType !== trigger.eventType ||
      rule.spec.triggerSelector.subjectKind !== trigger.subject.kind
    )
      throw new NotificationDeliveryRuntimeError(
        'TRIGGER_MISMATCH',
        'Lifecycle event does not match the rule selector.'
      );

    const [destination, publishPackage, sender] = await Promise.all([
      this.destinations.resolve(command.workspaceId, trigger.subject.id, trigger.subject.version),
      this.content.findPublishPackage(
        command.workspaceId,
        rule.spec.content.publishPackageId,
        rule.spec.content.version
      ),
      this.senders.getExactSenderProfile(
        command.workspaceId,
        rule.spec.senderProfile.senderProfileId,
        rule.spec.senderProfile.version
      )
    ]);
    if (
      !publishPackage ||
      publishPackage.publishPackageFingerprintSha256 !== rule.spec.content.fingerprintSha256
    )
      throw new NotificationDeliveryRuntimeError(
        'CONTENT_UNAVAILABLE',
        'Exact PublishPackage is unavailable.'
      );
    if (sender.status !== 'ACTIVE')
      throw new NotificationDeliveryRuntimeError(
        'SENDER_UNAVAILABLE',
        'Exact sender is not active.'
      );
    if (sender.replyTo.mode === 'MANAGED_COMMUNICATION')
      throw new NotificationDeliveryRuntimeError(
        'MANAGED_COMMUNICATION_UNSUPPORTED',
        'Notification V1 does not create Managed Communication truth.'
      );

    const identity = digest(
      `${rule.notificationRuleId}:${rule.version}:${trigger.triggerFingerprintSha256}`
    );
    const baseIntent: ChannelNotificationSendIntentV1 = {
      schemaVersion: 1,
      notificationSendIntentId: `channel-notification-send-intent_${identity}`,
      workspaceId: command.workspaceId,
      version: 1,
      featureKey: 'EMAIL_NOTIFICATION',
      rule: {
        notificationRuleId: rule.notificationRuleId,
        version: rule.version,
        fingerprintSha256: rule.spec.ruleFingerprintSha256
      },
      trigger: {
        notificationTriggerEvidenceId: trigger.notificationTriggerEvidenceId,
        version: 1,
        fingerprintSha256: trigger.triggerFingerprintSha256
      },
      target: {
        owner: 'LITE',
        kind: 'WORKSPACE_DIRECTORY_ENTRY',
        id: destination.entry.workspaceDirectoryEntryId,
        version: destination.entry.version,
        endpointFingerprintSha256: destination.endpointFingerprintSha256
      },
      content: rule.spec.content,
      senderProfile: rule.spec.senderProfile,
      deliveryPlanFingerprintSha256: '0'.repeat(64),
      effectFingerprintSha256: '0'.repeat(64),
      authority: noChannelNotificationAuthorityConsequencesV1
    };
    const withPlan = {
      ...baseIntent,
      deliveryPlanFingerprintSha256: channelNotificationDeliveryPlanFingerprintSha256V1(baseIntent)
    };
    const intent: ChannelNotificationSendIntentV1 = {
      ...withPlan,
      effectFingerprintSha256: channelNotificationSendEffectFingerprintSha256V1(withPlan)
    };

    const authorization = await this.execution.authorize({
      workspaceId: command.workspaceId,
      intent,
      triggerEvidence: trigger,
      activationEvidence: rule.activationEvidence,
      idempotencyKey: `${command.idempotencyKey}:authorize`
    });
    const release = await this.execution.release({
      workspaceId: command.workspaceId,
      authorizationId: authorization.authorizationId,
      authorizationVersion: 1,
      idempotencyKey: `${command.idempotencyKey}:release`
    });
    if (release.effectFingerprintSha256 !== intent.effectFingerprintSha256)
      throw new NotificationDeliveryRuntimeError(
        'EXECUTION_REJECTED',
        'Execution release does not bind the exact effect.'
      );

    const at = new Date(this.now()).toISOString();
    const planned: ChannelNotificationDeliveryAttemptV1 = {
      schemaVersion: 1,
      notificationDeliveryAttemptId: `notification-delivery-attempt_${identity}`,
      workspaceId: command.workspaceId,
      version: 1,
      executionRelease: { id: release.releaseId, version: 1 },
      sendIntent: { id: intent.notificationSendIntentId, version: 1 },
      effectFingerprintSha256: intent.effectFingerprintSha256,
      rule: {
        id: rule.notificationRuleId,
        version: rule.version,
        fingerprintSha256: rule.spec.ruleFingerprintSha256
      },
      trigger: {
        id: trigger.notificationTriggerEvidenceId,
        version: 1,
        fingerprintSha256: trigger.triggerFingerprintSha256
      },
      endpointFingerprintSha256: destination.endpointFingerprintSha256,
      content: {
        id: publishPackage.publishPackageId,
        version: publishPackage.version,
        fingerprintSha256: publishPackage.publishPackageFingerprintSha256
      },
      senderProfile: {
        id: sender.senderProfileId,
        version: sender.version,
        fingerprintSha256: rule.spec.senderProfile.fingerprintSha256
      },
      deliveryPlanFingerprintSha256: intent.deliveryPlanFingerprintSha256,
      status: 'PLANNED',
      reconciliationIdentity: `notification-effect:${intent.effectFingerprintSha256}`,
      createdAt: at,
      updatedAt: at,
      authority: noChannelNotificationDeliveryAuthorityConsequencesV1
    };
    const initial = await this.store.createAttempt(planned);
    const current = await this.store.getAttempt(
      command.workspaceId,
      initial.notificationDeliveryAttemptId
    );
    if (current.status === 'SUBMITTING' || current.status === 'UNKNOWN')
      throw new NotificationDeliveryRuntimeError(
        'ATTEMPT_AMBIGUOUS',
        'Ambiguous transport outcome is never blindly retried.'
      );
    if (current.status === 'ACCEPTED' || current.status === 'FAILED') return current;
    const submitting = {
      ...current,
      status: 'SUBMITTING' as const,
      updatedAt: new Date(this.now()).toISOString()
    };
    await this.store.transitionAttempt(submitting, 'PLANNED');

    let result;
    try {
      result = await this.transport.submit({
        workspaceId: command.workspaceId,
        routingPartitionRef: sender.providerRoutingPartitionRef,
        fromAddress: sender.fromAddress,
        ...(sender.replyTo.mode === 'EXPLICIT_ADDRESS' && sender.replyTo.address
          ? { replyToAddress: sender.replyTo.address }
          : {}),
        recipients: [destination.endpoint],
        subject: publishPackage.title,
        textContent: publishPackage.body,
        metadataTags: [
          { name: 'mo_notification_attempt', value: current.notificationDeliveryAttemptId },
          { name: 'mo_effect', value: intent.effectFingerprintSha256 }
        ]
      });
    } catch {
      result = { status: 'UNKNOWN' as const, reasonCode: 'TRANSPORT_EXCEPTION_AMBIGUOUS' };
    }
    const finished: ChannelNotificationDeliveryAttemptV1 = {
      ...submitting,
      status: result.status,
      ...(result.status === 'ACCEPTED'
        ? { providerSubmissionRef: result.providerSubmissionRef }
        : {}),
      updatedAt: new Date(this.now()).toISOString()
    };
    await this.store.transitionAttempt(finished, 'SUBMITTING');
    await this.store.recordObservation(this.transportObservation(finished, result));
    return finished;
  }

  private transportObservation(
    attempt: Readonly<ChannelNotificationDeliveryAttemptV1>,
    result: Awaited<ReturnType<EmailTransportProviderV1['submit']>>
  ): ChannelNotificationDeliveryObservationV1 {
    const at = new Date(this.now()).toISOString();
    return {
      schemaVersion: 1,
      notificationDeliveryObservationId: `notification-delivery-observation_${randomUUID()}`,
      workspaceId: attempt.workspaceId,
      version: 1,
      attempt: { id: attempt.notificationDeliveryAttemptId, version: 1 },
      eventIdentity: `transport:${attempt.notificationDeliveryAttemptId}:${result.status}`,
      event: result.status,
      ...(result.status === 'ACCEPTED' ? { providerMessageRef: result.providerSubmissionRef } : {}),
      authenticatedEvidence: true,
      reasonCode: result.status === 'ACCEPTED' ? 'PROVIDER_ACCEPTED' : result.reasonCode,
      evidenceRefs:
        result.status === 'ACCEPTED'
          ? [`provider-message:${result.providerSubmissionRef}`]
          : [`notification-attempt:${attempt.notificationDeliveryAttemptId}`],
      eventAt: at,
      observedAt: at,
      authority: noChannelNotificationDeliveryAuthorityConsequencesV1
    };
  }
}

export interface DeliverSmsNotificationCommandV1 {
  workspaceId: string;
  notificationRuleId: ChannelNotificationRuleId;
  lifecycleEventId: string;
  idempotencyKey: string;
}

export class MarkRegSubjectWorkspaceDirectorySmsResolverV1 {
  constructor(
    private readonly directory: Pick<
      PostgresWorkspaceDirectoryStore,
      'findLatestByExternalIdentityReference'
    >,
    private readonly endpoints: Pick<WorkspaceDirectorySmsEndpointResolverV1, 'resolve'>
  ) {}

  async resolve(workspaceId: string, formalMatterId: string, formalMatterVersion: number) {
    const matches = await this.directory.findLatestByExternalIdentityReference(
      workspaceId,
      formalMatterId,
      String(formalMatterVersion)
    );
    if (matches.length !== 1)
      throw new NotificationDeliveryRuntimeError(
        'DESTINATION_UNAVAILABLE',
        'Exact Formal Matter Workspace Directory SMS destination is unavailable.'
      );
    const entry = matches[0]!;
    const resolved = await this.endpoints.resolve(workspaceId, {
      owner: 'LITE',
      kind: 'WORKSPACE_DIRECTORY_ENTRY',
      id: entry.workspaceDirectoryEntryId,
      version: entry.version
    });
    if (resolved.state !== 'CURRENT' || !resolved.endpoint || !resolved.endpointFingerprintSha256)
      throw new NotificationDeliveryRuntimeError(
        'DESTINATION_UNAVAILABLE',
        'SMS destination is not current.'
      );
    return {
      entry,
      endpoint: resolved.endpoint,
      endpointFingerprintSha256: resolved.endpointFingerprintSha256
    };
  }
}

export class SmsNotificationDeliveryRuntimeV1 {
  constructor(
    private readonly rules: Pick<PostgresNotificationAutomationRuleStore, 'getExact' | 'getLatest'>,
    private readonly triggers: MarkRegLifecycleNotificationTriggerCurrentnessReaderV1,
    private readonly destinations: MarkRegSubjectWorkspaceDirectorySmsResolverV1,
    private readonly content: Pick<PostgresLiteContentPreparationStore, 'findPublishPackage'>,
    private readonly identityCurrentness: SmsNotificationChannelIdentityCurrentnessReaderV1,
    private readonly bindings: Pick<
      PostgresWorkspaceChannelIdentityBindingStoreV1,
      'getExact' | 'getLatest'
    >,
    private readonly execution: NotificationExecutionClientV1,
    private readonly store: Pick<
      PostgresNotificationDeliveryStore,
      'createAttempt' | 'getAttempt' | 'transitionAttempt' | 'recordObservation'
    >,
    private readonly transport: SmsTransportProviderV1,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async deliver(command: Readonly<DeliverSmsNotificationCommandV1>) {
    const rule = await this.rules.getLatest(command.workspaceId, command.notificationRuleId);
    if (!rule || rule.status !== 'ACTIVE' || !rule.activationEvidence)
      throw new NotificationDeliveryRuntimeError(
        'RULE_NOT_ACTIVE',
        'Exact active rule is required.'
      );
    if (rule.spec.featureKey !== 'SMS_WORKSPACE_NOTIFICATION')
      throw new NotificationDeliveryRuntimeError(
        'RULE_NOT_ACTIVE',
        'SMS Notification delivery accepts SMS_WORKSPACE_NOTIFICATION rules only.'
      );
    const exactRule = await this.rules.getExact(
      command.workspaceId,
      command.notificationRuleId,
      rule.version
    );
    if (!exactRule || exactRule.spec.ruleFingerprintSha256 !== rule.spec.ruleFingerprintSha256)
      throw new NotificationDeliveryRuntimeError('RULE_NOT_ACTIVE', 'Rule owner evidence changed.');

    const ownerEvent = await this.triggers
      .getExact(command.workspaceId, command.lifecycleEventId)
      .catch(() => {
        throw new NotificationDeliveryRuntimeError(
          'TRIGGER_NOT_FOUND',
          'MarkReg trigger owner is unavailable.'
        );
      });
    if (!ownerEvent)
      throw new NotificationDeliveryRuntimeError(
        'TRIGGER_NOT_FOUND',
        'Lifecycle event was not found.'
      );
    const trigger = this.triggers.materialize(ownerEvent);
    if (
      rule.spec.triggerSelector.owner !== trigger.owner ||
      rule.spec.triggerSelector.eventType !== trigger.eventType ||
      rule.spec.triggerSelector.subjectKind !== trigger.subject.kind
    )
      throw new NotificationDeliveryRuntimeError(
        'TRIGGER_MISMATCH',
        'Lifecycle event does not match the rule selector.'
      );

    const [destination, publishPackage] = await Promise.all([
      this.destinations.resolve(command.workspaceId, trigger.subject.id, trigger.subject.version),
      this.content.findPublishPackage(
        command.workspaceId,
        rule.spec.content.publishPackageId,
        rule.spec.content.version
      )
    ]);
    if (
      !publishPackage ||
      publishPackage.publishPackageFingerprintSha256 !== rule.spec.content.fingerprintSha256
    )
      throw new NotificationDeliveryRuntimeError(
        'CONTENT_UNAVAILABLE',
        'Exact PublishPackage is unavailable.'
      );

    const identity = digest(
      `${rule.notificationRuleId}:${rule.version}:${trigger.triggerFingerprintSha256}`
    );
    const baseIntent: ChannelNotificationSendIntentV1 = {
      schemaVersion: 1,
      notificationSendIntentId: `channel-notification-send-intent_${identity}`,
      workspaceId: command.workspaceId,
      version: 1,
      featureKey: 'SMS_WORKSPACE_NOTIFICATION',
      rule: {
        notificationRuleId: rule.notificationRuleId,
        version: rule.version,
        fingerprintSha256: rule.spec.ruleFingerprintSha256
      },
      trigger: {
        notificationTriggerEvidenceId: trigger.notificationTriggerEvidenceId,
        version: 1,
        fingerprintSha256: trigger.triggerFingerprintSha256
      },
      target: {
        owner: 'LITE',
        kind: 'WORKSPACE_DIRECTORY_ENTRY',
        id: destination.entry.workspaceDirectoryEntryId,
        version: destination.entry.version,
        endpointFingerprintSha256: destination.endpointFingerprintSha256
      },
      content: rule.spec.content,
      channelIdentityBinding: rule.spec.channelIdentityBinding,
      deliveryPlanFingerprintSha256: '0'.repeat(64),
      effectFingerprintSha256: '0'.repeat(64),
      authority: noChannelNotificationAuthorityConsequencesV1
    };
    const withPlan = {
      ...baseIntent,
      deliveryPlanFingerprintSha256: channelNotificationDeliveryPlanFingerprintSha256V1(baseIntent)
    };
    const intent: ChannelNotificationSendIntentV1 = {
      ...withPlan,
      effectFingerprintSha256: channelNotificationSendEffectFingerprintSha256V1(withPlan)
    };

    const authorization = await this.execution.authorize({
      workspaceId: command.workspaceId,
      intent,
      triggerEvidence: trigger,
      activationEvidence: rule.activationEvidence,
      idempotencyKey: `${command.idempotencyKey}:authorize`
    });
    const release = await this.execution.release({
      workspaceId: command.workspaceId,
      authorizationId: authorization.authorizationId,
      authorizationVersion: 1,
      idempotencyKey: `${command.idempotencyKey}:release`
    });
    if (release.effectFingerprintSha256 !== intent.effectFingerprintSha256)
      throw new NotificationDeliveryRuntimeError(
        'EXECUTION_REJECTED',
        'Execution release does not bind the exact effect.'
      );

    const currentness = await this.identityCurrentness.resolve({
      workspaceId: command.workspaceId,
      featureKey: 'SMS_WORKSPACE_NOTIFICATION',
      binding: rule.spec.channelIdentityBinding
    });
    if (
      currentness.state !== 'CURRENT' ||
      currentness.workspaceId !== command.workspaceId ||
      currentness.featureKey !== 'SMS_WORKSPACE_NOTIFICATION' ||
      currentness.binding.id !== rule.spec.channelIdentityBinding.id ||
      currentness.binding.version !== rule.spec.channelIdentityBinding.version ||
      currentness.binding.fingerprintSha256 !== rule.spec.channelIdentityBinding.fingerprintSha256
    )
      throw new NotificationDeliveryRuntimeError(
        'IDENTITY_UNAVAILABLE',
        'Exact SMS Channel identity currentness is not current after Execution release.'
      );

    let binding: WorkspaceChannelIdentityBindingV1 | undefined;
    let latest: WorkspaceChannelIdentityBindingV1 | undefined;
    try {
      [binding, latest] = await Promise.all([
        this.bindings.getExact(
          command.workspaceId,
          rule.spec.channelIdentityBinding.id,
          rule.spec.channelIdentityBinding.version
        ),
        this.bindings.getLatest(command.workspaceId, rule.spec.channelIdentityBinding.id)
      ]);
    } catch {
      throw new NotificationDeliveryRuntimeError(
        'IDENTITY_UNAVAILABLE',
        'Exact SMS Channel identity binding is unavailable.'
      );
    }
    if (
      !binding ||
      !latest ||
      binding.featureKey !== 'SMS_WORKSPACE_NOTIFICATION' ||
      binding.status !== 'ACTIVE' ||
      binding.bindingFingerprintSha256 !== rule.spec.channelIdentityBinding.fingerprintSha256 ||
      latest.version !== binding.version ||
      latest.bindingFingerprintSha256 !== binding.bindingFingerprintSha256 ||
      latest.status !== 'ACTIVE'
    )
      throw new NotificationDeliveryRuntimeError(
        'IDENTITY_UNAVAILABLE',
        'SMS Channel identity binding/head drifted after Execution release.'
      );

    const at = new Date(this.now()).toISOString();
    const planned: ChannelNotificationDeliveryAttemptV1 = {
      schemaVersion: 1,
      notificationDeliveryAttemptId: `notification-delivery-attempt_${identity}`,
      workspaceId: command.workspaceId,
      version: 1,
      executionRelease: { id: release.releaseId, version: 1 },
      sendIntent: { id: intent.notificationSendIntentId, version: 1 },
      effectFingerprintSha256: intent.effectFingerprintSha256,
      rule: {
        id: rule.notificationRuleId,
        version: rule.version,
        fingerprintSha256: rule.spec.ruleFingerprintSha256
      },
      trigger: {
        id: trigger.notificationTriggerEvidenceId,
        version: 1,
        fingerprintSha256: trigger.triggerFingerprintSha256
      },
      endpointFingerprintSha256: destination.endpointFingerprintSha256,
      endpointRef: {
        owner: intent.target.owner,
        kind: intent.target.kind,
        id: intent.target.id,
        version: intent.target.version
      },
      content: {
        id: publishPackage.publishPackageId,
        version: publishPackage.version,
        fingerprintSha256: publishPackage.publishPackageFingerprintSha256
      },
      channelIdentityBinding: {
        id: binding.workspaceChannelIdentityBindingId,
        version: binding.version,
        fingerprintSha256: binding.bindingFingerprintSha256
      },
      implementationRef: binding.connection.implementationRef,
      deliveryPlanFingerprintSha256: intent.deliveryPlanFingerprintSha256,
      status: 'PLANNED',
      reconciliationIdentity: `notification-effect:${intent.effectFingerprintSha256}`,
      createdAt: at,
      updatedAt: at,
      authority: noChannelNotificationDeliveryAuthorityConsequencesV1
    };
    const initial = await this.store.createAttempt(planned);
    const current = await this.store.getAttempt(
      command.workspaceId,
      initial.notificationDeliveryAttemptId
    );
    if (current.status === 'SUBMITTING' || current.status === 'UNKNOWN')
      throw new NotificationDeliveryRuntimeError(
        'ATTEMPT_AMBIGUOUS',
        'Ambiguous transport outcome is never blindly retried.'
      );
    if (current.status === 'ACCEPTED' || current.status === 'FAILED') return current;

    const submitting: ChannelNotificationDeliveryAttemptV1 = {
      ...current,
      status: 'SUBMITTING',
      updatedAt: new Date(this.now()).toISOString()
    };
    await this.store.transitionAttempt(submitting, 'PLANNED');

    let result: Awaited<ReturnType<SmsTransportProviderV1['submit']>>;
    try {
      result = await this.transport.submit({
        workspaceId: command.workspaceId,
        identityBinding: binding,
        recipient: destination.endpoint,
        textContent: publishPackage.body,
        endpointFingerprintSha256: destination.endpointFingerprintSha256,
        metadataTags: [
          { name: 'mo_notification_attempt', value: current.notificationDeliveryAttemptId },
          { name: 'mo_effect', value: intent.effectFingerprintSha256 }
        ]
      });
    } catch {
      result = { status: 'UNKNOWN', reasonCode: 'TRANSPORT_EXCEPTION_AMBIGUOUS' };
    }

    const finished: ChannelNotificationDeliveryAttemptV1 = {
      ...submitting,
      status: result.status,
      ...(result.status === 'ACCEPTED'
        ? { providerSubmissionRef: result.providerSubmissionRef }
        : {}),
      updatedAt: new Date(this.now()).toISOString()
    };
    await this.store.transitionAttempt(finished, 'SUBMITTING');
    await this.store.recordObservation(this.transportObservation(finished, result));
    return finished;
  }

  private transportObservation(
    attempt: Readonly<ChannelNotificationDeliveryAttemptV1>,
    result: Awaited<ReturnType<SmsTransportProviderV1['submit']>>
  ): SmsChannelNotificationDeliveryObservationV1 {
    const at = new Date(this.now()).toISOString();
    return {
      schemaVersion: 1,
      notificationDeliveryObservationId: `notification-delivery-observation_${randomUUID()}`,
      workspaceId: attempt.workspaceId,
      version: 1,
      attempt: { id: attempt.notificationDeliveryAttemptId, version: 1 },
      eventIdentity: `transport:${attempt.notificationDeliveryAttemptId}:${result.status}`,
      event: result.status,
      ...(result.status === 'ACCEPTED' ? { providerMessageRef: result.providerSubmissionRef } : {}),
      endpointFingerprintSha256: attempt.endpointFingerprintSha256,
      authenticatedEvidence: true,
      reasonCode: result.status === 'ACCEPTED' ? 'PROVIDER_ACCEPTED' : result.reasonCode,
      evidenceRefs:
        result.status === 'ACCEPTED'
          ? [`provider-submission:${result.providerSubmissionRef}`]
          : [`notification-attempt:${attempt.notificationDeliveryAttemptId}`],
      eventAt: at,
      observedAt: at,
      authority: noChannelNotificationDeliveryAuthorityConsequencesV1
    };
  }
}
