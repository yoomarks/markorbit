import {
  noChannelNotificationAuthorityConsequencesV1,
  type ChannelNotificationTriggerEvidenceV1
} from '@markorbit/contracts/channel-notification';
import { channelNotificationTriggerFingerprintSha256V1 } from '@markorbit/contracts/channel-notification-fingerprint';
import type { LifecycleEventProjection } from '@markorbit/contracts/evidence-lifecycle';
import type {
  NotificationTriggerEvidenceCurrentnessReaderV1,
  NotificationTriggerOwnerCurrentnessState
} from './notification-send-currentness.js';

export class MarkRegLifecycleNotificationTriggerCurrentnessReaderV1 implements NotificationTriggerEvidenceCurrentnessReaderV1 {
  constructor(
    private readonly markRegUrl: string,
    private readonly internalServiceSecret: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 3_000
  ) {}

  async getExact(
    workspaceId: string,
    lifecycleEventId: string
  ): Promise<LifecycleEventProjection | undefined> {
    let response: Response;
    try {
      response = await this.fetchImpl(
        `${this.markRegUrl}/internal/v1/lifecycle-events/${encodeURIComponent(lifecycleEventId)}`,
        {
          headers: {
            'x-markorbit-internal-authorization': this.internalServiceSecret,
            'x-markorbit-workspace-id': workspaceId
          },
          signal: AbortSignal.timeout(this.timeoutMs)
        }
      );
    } catch {
      throw new Error('MARKREG_UNAVAILABLE');
    }
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error('MARKREG_UNAVAILABLE');
    return ((await response.json()) as { event: LifecycleEventProjection }).event;
  }

  materialize(event: Readonly<LifecycleEventProjection>): ChannelNotificationTriggerEvidenceV1 {
    const base: ChannelNotificationTriggerEvidenceV1 = {
      schemaVersion: 1,
      notificationTriggerEvidenceId: `channel-notification-trigger_${event.lifecycleEventId}`,
      workspaceId: event.workspaceId,
      version: 1,
      owner: 'MARKREG',
      eventType: event.eventCode,
      eventId: event.lifecycleEventId,
      subject: {
        owner: 'MARKREG',
        kind: 'FORMAL_MATTER',
        id: event.formalMatter.id,
        version: Number(event.formalMatter.version)
      },
      occurredAt: event.occurredAt,
      evidenceRefs: [
        `markreg-lifecycle-event:${event.lifecycleEventId}:v${event.version}`,
        `sha256:${event.lifecycleEventFingerprintSha256}`
      ],
      triggerFingerprintSha256: '0'.repeat(64),
      authority: noChannelNotificationAuthorityConsequencesV1
    };
    return {
      ...base,
      triggerFingerprintSha256: channelNotificationTriggerFingerprintSha256V1(base)
    };
  }

  async validateCurrent(
    evidence: Readonly<ChannelNotificationTriggerEvidenceV1>
  ): Promise<Readonly<{ state: NotificationTriggerOwnerCurrentnessState }>> {
    if (evidence.owner !== 'MARKREG') return { state: 'UNAVAILABLE' };
    try {
      const event = await this.getExact(evidence.workspaceId, evidence.eventId);
      if (!event) return { state: 'UNKNOWN' };
      const exact = this.materialize(event);
      return JSON.stringify(exact) === JSON.stringify(evidence)
        ? { state: 'CURRENT' }
        : { state: 'STALE' };
    } catch {
      return { state: 'UNAVAILABLE' };
    }
  }
}
