import { randomUUID } from 'node:crypto';
import {
  noChannelNotificationDeliveryAuthorityConsequencesV1,
  type ChannelNotificationDeliveryObservationV1
} from '@markorbit/contracts';
import type { WorkspaceEmailSenderProfileV1 } from '@markorbit/contracts/email-sender-profile';
import type { SetOutboundContactSuppressionCommand } from './outbound-contact-policy.js';
import type { PostgresNotificationDeliveryStore } from './notification-delivery.js';
import { normalizeAmazonSesEvent, type AmazonSesEventAuthenticator } from './email-delivery-ses.js';
import type { PostgresEmailSenderProfileStore } from './email-sender-profile.js';

export interface NotificationSuppressionOwnerV1 {
  setSuppression(command: Readonly<SetOutboundContactSuppressionCommand>): Promise<unknown>;
}

/** Reuses the shared authenticated SES envelope and normalizer; only the truth adapter differs. */
export class NotificationAmazonSesAuthenticatedEventIngestionV1 {
  constructor(
    private readonly authenticator: AmazonSesEventAuthenticator,
    private readonly store: Pick<
      PostgresNotificationDeliveryStore,
      'getAttempt' | 'recordObservation'
    >,
    private readonly senders: Pick<PostgresEmailSenderProfileStore, 'getExactSenderProfile'>,
    private readonly suppression: NotificationSuppressionOwnerV1,
    private readonly actorPrincipalId = 'system:notification-provider-evidence'
  ) {}

  async ingest(envelope: unknown): Promise<ChannelNotificationDeliveryObservationV1> {
    const verified = await this.authenticator.verifyAndExtract(envelope);
    const attempt = await this.store.getAttempt(
      verified.workspaceId,
      verified.deliveryAttemptId as never
    );
    const sender: WorkspaceEmailSenderProfileV1 = await this.senders.getExactSenderProfile(
      attempt.workspaceId,
      attempt.senderProfile.id,
      attempt.senderProfile.version
    );
    if (sender.providerRoutingPartitionRef !== verified.routingPartitionRef)
      throw new Error('SES routing partition does not correlate to the Notification attempt.');
    const shared = normalizeAmazonSesEvent(verified.event, {
      authenticated: true,
      workspaceId: verified.workspaceId,
      deliveryAttemptId: verified.deliveryAttemptId,
      observedAt: verified.observedAt,
      ...(verified.providerEventId ? { providerEventId: verified.providerEventId } : {})
    });
    if (
      !shared.providerMessageRef ||
      shared.providerMessageRef !== attempt.providerSubmissionRef ||
      shared.endpointFingerprintSha256 !== attempt.endpointFingerprintSha256
    )
      throw new Error('SES provider event does not correlate to the exact Notification attempt.');
    const event =
      shared.event === 'DELIVERED' ||
      shared.event === 'HARD_BOUNCED' ||
      shared.event === 'SOFT_BOUNCED' ||
      shared.event === 'COMPLAINED' ||
      shared.event === 'FAILED'
        ? shared.event
        : 'UNKNOWN';
    const observation: ChannelNotificationDeliveryObservationV1 = {
      schemaVersion: 1,
      notificationDeliveryObservationId: `notification-delivery-observation_${randomUUID()}`,
      workspaceId: attempt.workspaceId,
      version: 1,
      attempt: { id: attempt.notificationDeliveryAttemptId, version: 1 },
      eventIdentity: shared.eventIdentity,
      event,
      providerMessageRef: shared.providerMessageRef,
      endpointFingerprintSha256: shared.endpointFingerprintSha256,
      authenticatedEvidence: true,
      reasonCode: shared.reasonCode,
      evidenceRefs: shared.evidenceRefs,
      eventAt: shared.eventAt,
      observedAt: shared.observedAt,
      authority: noChannelNotificationDeliveryAuthorityConsequencesV1
    };
    const recorded = await this.store.recordObservation(observation);
    if (recorded.event === 'HARD_BOUNCED' || recorded.event === 'COMPLAINED') {
      await this.suppression.setSuppression({
        workspaceId: recorded.workspaceId,
        actorPrincipalId: this.actorPrincipalId,
        idempotencyKey: `notification-delivery:suppression:${recorded.eventIdentity}`,
        endpointFingerprintSha256: recorded.endpointFingerprintSha256!,
        scope: 'ALL_OUTBOUND',
        reasonCode: recorded.event === 'HARD_BOUNCED' ? 'HARD_BOUNCE' : 'COMPLAINT',
        sourceClass: 'PROVIDER_OBSERVATION',
        evidenceRefs: [
          `notification-delivery-observation:${recorded.notificationDeliveryObservationId}`,
          ...recorded.evidenceRefs
        ],
        effectiveAt: recorded.eventAt
      });
    }
    return recorded;
  }
}
