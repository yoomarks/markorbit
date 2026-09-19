import { describe, expect, it } from 'vitest';
import {
  noEmailDeliveryAuthorityConsequencesV1,
  parseEmailDeliveryAttemptV1,
  parseEmailDeliveryObservationV1,
  type EmailDeliveryAttemptV1,
  type EmailDeliveryObservationV1
} from '../src/email-delivery.js';

const workspaceId = '14141414-1414-4414-8414-141414141414';

const attempt = (): EmailDeliveryAttemptV1 => ({
  schemaVersion: 1,
  deliveryAttemptId: 'email-delivery-attempt_primary',
  version: 1,
  workspaceId,
  executionRelease: {
    releaseId: 'protected-action-release_primary',
    version: 1,
    effectFingerprintSha256: '1'.repeat(64)
  },
  campaign: { campaignId: 'email-campaign_primary', version: 1 },
  senderProfile: {
    senderProfileId: 'email-sender-profile_primary',
    version: 1,
    fingerprintSha256: '2'.repeat(64)
  },
  implementation: {
    implementationProfileId: 'implementation-profile_amazon-ses-v2',
    version: 1
  },
  shardIndex: 0,
  recipientCount: 2,
  recipientManifestFingerprintSha256: '3'.repeat(64),
  deliveryPlanFingerprintSha256: '4'.repeat(64),
  correlationId: 'delivery:primary:0',
  attemptNumber: 1,
  status: 'PLANNED',
  createdAt: '2026-09-19T00:00:00.000Z',
  updatedAt: '2026-09-19T00:00:00.000Z',
  authority: noEmailDeliveryAuthorityConsequencesV1
});

const observation = (): EmailDeliveryObservationV1 => ({
  schemaVersion: 1,
  observationId: 'email-delivery-observation_primary',
  version: 1,
  workspaceId,
  deliveryAttempt: {
    deliveryAttemptId: 'email-delivery-attempt_primary',
    version: 1
  },
  eventIdentity: 'ses-message:accepted',
  event: 'ACCEPTED',
  evidenceKind: 'ADAPTER_TRANSPORT',
  providerMessageRef: 'ses-message-123',
  authenticatedEvidence: true,
  reasonCode: 'SES_ACCEPTED',
  evidenceRefs: ['ses-message:ses-message-123'],
  eventAt: '2026-09-19T00:01:00.000Z',
  observedAt: '2026-09-19T00:01:00.000Z',
  authority: noEmailDeliveryAuthorityConsequencesV1
});

describe('email delivery evidence contract', () => {
  it('parses provider-neutral attempts and observations without authority', () => {
    const parsedAttempt = parseEmailDeliveryAttemptV1(attempt());
    const parsedObservation = parseEmailDeliveryObservationV1(observation());
    expect(parsedAttempt.status).toBe('PLANNED');
    expect(parsedObservation.event).toBe('ACCEPTED');
    expect(Object.values(parsedAttempt.authority).every((value) => value === false)).toBe(true);
    expect(Object.values(parsedObservation.authority).every((value) => value === false)).toBe(true);
  });

  it.each(['rawEmail', 'recipientEmail', 'apiKey', 'accessToken', 'providerPayload'])(
    'rejects forbidden durable material: %s',
    (field) => {
      expect(() =>
        parseEmailDeliveryAttemptV1({
          ...attempt(),
          [field]: field === 'rawEmail' ? 'person@example.com' : 'secret'
        })
      ).toThrow(/forbidden material/);
    }
  );

  it('requires authenticated provider observations', () => {
    expect(() =>
      parseEmailDeliveryObservationV1({
        ...observation(),
        authenticatedEvidence: false
      })
    ).toThrow(/authenticatedEvidence/);
  });

  it('keeps provider acceptance distinct from delivery', () => {
    expect(parseEmailDeliveryObservationV1(observation()).event).toBe('ACCEPTED');
    expect(parseEmailDeliveryAttemptV1({ ...attempt(), status: 'ACCEPTED' }).status).toBe(
      'ACCEPTED'
    );
  });
});
