/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unnecessary-type-assertion */
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { noChannelNotificationDeliveryAuthorityConsequencesV1 } from '@markorbit/contracts';
import { NotificationAmazonSesAuthenticatedEventIngestionV1 } from '../src/notification-delivery-ses.js';

const workspaceId = '14141414-1414-4414-8414-141414141414';
const endpoint = 'person@example.com';
const endpointFingerprintSha256 = createHash('sha256').update(endpoint).digest('hex');
const attempt = {
  schemaVersion: 1,
  notificationDeliveryAttemptId: 'notification-delivery-attempt_primary',
  workspaceId,
  version: 1,
  executionRelease: { id: 'protected-action-release_primary', version: 1 },
  sendIntent: { id: 'channel-notification-send-intent_primary', version: 1 },
  effectFingerprintSha256: '1'.repeat(64),
  rule: { id: 'channel-notification-rule_primary', version: 1, fingerprintSha256: '2'.repeat(64) },
  trigger: {
    id: 'channel-notification-trigger_primary',
    version: 1,
    fingerprintSha256: '3'.repeat(64)
  },
  endpointFingerprintSha256,
  content: { id: 'publish-package_primary', version: 1, fingerprintSha256: '4'.repeat(64) },
  senderProfile: {
    id: 'email-sender-profile_primary',
    version: 1,
    fingerprintSha256: '5'.repeat(64)
  },
  deliveryPlanFingerprintSha256: '6'.repeat(64),
  status: 'ACCEPTED',
  providerSubmissionRef: 'ses-message-primary',
  reconciliationIdentity: 'notification-effect:primary',
  createdAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-20T00:00:01.000Z',
  authority: noChannelNotificationDeliveryAuthorityConsequencesV1
} as const;

function envelope(type: string, bounceType?: string) {
  return {
    event: {
      eventType: type,
      mail: {
        messageId: attempt.providerSubmissionRef,
        destination: [endpoint],
        timestamp: '2026-09-20T01:00:00.000Z'
      },
      ...(type === 'BOUNCE'
        ? { bounce: { bounceType, timestamp: '2026-09-20T01:01:00.000Z' } }
        : {}),
      ...(type === 'COMPLAINT' ? { complaint: { timestamp: '2026-09-20T01:01:00.000Z' } } : {}),
      ...(type === 'DELIVERY' ? { delivery: { timestamp: '2026-09-20T01:01:00.000Z' } } : {})
    },
    workspaceId,
    deliveryAttemptId: attempt.notificationDeliveryAttemptId,
    routingPartitionRef: 'route:primary',
    tenantName: 'tenant-primary',
    observedAt: '2026-09-20T01:02:00.000Z',
    providerEventId: `event-${type}-${bounceType ?? 'none'}`
  };
}

function harness(value: ReturnType<typeof envelope>) {
  const observations = new Map<string, any>();
  const suppression = { setSuppression: vi.fn(async () => ({})) };
  const service = new NotificationAmazonSesAuthenticatedEventIngestionV1(
    { verifyAndExtract: vi.fn(async () => value as never) },
    {
      getAttempt: vi.fn(async () => attempt as never),
      recordObservation: vi.fn(async (observation: any) => {
        const prior = observations.get(observation.eventIdentity);
        if (prior) return prior;
        observations.set(observation.eventIdentity, observation);
        return observation;
      })
    } as never,
    {
      getExactSenderProfile: vi.fn(async () => ({ providerRoutingPartitionRef: 'route:primary' }))
    } as never,
    suppression
  );
  return { service, suppression, observations };
}

describe('Notification authenticated SES reconciliation', () => {
  it('records Delivery without creating suppression', async () => {
    const { service, suppression } = harness(envelope('DELIVERY'));
    await expect(service.ingest({ signed: true })).resolves.toMatchObject({ event: 'DELIVERED' });
    expect(suppression.setSuppression).not.toHaveBeenCalled();
  });

  it('replays the same authenticated provider event idempotently', async () => {
    const { service, observations } = harness(envelope('DELIVERY'));
    const first = await service.ingest({ signed: true });
    const replay = await service.ingest({ signed: true });
    expect(replay).toEqual(first);
    expect(observations.size).toBe(1);
  });

  it.each([
    ['BOUNCE', 'Permanent', 'HARD_BOUNCED'],
    ['COMPLAINT', undefined, 'COMPLAINED']
  ])(
    'records %s and routes permanent suppression through policy owner',
    async (type, bounceType, expected) => {
      const { service, suppression } = harness(envelope(type, bounceType));
      await expect(service.ingest({ signed: true })).resolves.toMatchObject({ event: expected });
      expect(suppression.setSuppression).toHaveBeenCalledWith(
        expect.objectContaining({ scope: 'ALL_OUTBOUND' })
      );
    }
  );

  it('does not permanently suppress a transient bounce', async () => {
    const { service, suppression } = harness(envelope('BOUNCE', 'Transient'));
    await expect(service.ingest({ signed: true })).resolves.toMatchObject({
      event: 'SOFT_BOUNCED'
    });
    expect(suppression.setSuppression).not.toHaveBeenCalled();
  });

  it('rejects wrong provider-message correlation', async () => {
    const wrong = envelope('DELIVERY');
    (wrong.event.mail as { messageId: string }).messageId = 'unknown-message';
    const { service, observations } = harness(wrong);
    await expect(service.ingest({ signed: true })).rejects.toThrow(/correlate/u);
    expect(observations.size).toBe(0);
  });
});
