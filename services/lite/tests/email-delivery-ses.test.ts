import { describe, expect, it, vi } from 'vitest';
import {
  noEmailDeliveryAuthorityConsequencesV1,
  type EmailDeliveryAttemptV1
} from '@markorbit/contracts/email-delivery';
import {
  AmazonSesAuthenticatedEventIngestion,
  AmazonSesV2DeliveryAdapter,
  normalizeAmazonSesEvent,
  type AmazonSesEventAuthenticator,
  type AmazonSesEventCorrelationVerifier,
  type AmazonSesObservationSink,
  type AmazonSesVerifiedEventEnvelope,
  type AmazonSesRoutingResolver,
  type AmazonSesV2Client
} from '../src/email-delivery-ses.js';

const workspaceId = '14141414-1414-4414-8414-141414141414';

const attempt = (
  status: EmailDeliveryAttemptV1['status'] = 'SUBMITTING',
  recipientCount = 1
): EmailDeliveryAttemptV1 => ({
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
  recipientCount,
  recipientManifestFingerprintSha256: '3'.repeat(64),
  deliveryPlanFingerprintSha256: '4'.repeat(64),
  correlationId: 'delivery:primary:0',
  attemptNumber: 1,
  status,
  createdAt: '2026-09-19T00:00:00.000Z',
  updatedAt: '2026-09-19T00:00:01.000Z',
  authority: noEmailDeliveryAuthorityConsequencesV1
});

const routing: AmazonSesRoutingResolver = {
  resolve: vi.fn(() =>
    Promise.resolve({
      workspaceId,
      tenantName: 'mo-workspace-primary',
      configurationSetName: 'mo-workspace-primary',
      region: 'us-east-1',
      senderIdentity: 'hello@mail.example.com',
      routingPartitionRef: 'routing:workspace-primary'
    })
  )
};

describe('Amazon SES V2 tenant delivery adapter', () => {
  it('maps one governed shard and treats MessageId as ACCEPTED only', async () => {
    const sendEmail = vi.fn(() => Promise.resolve({ MessageId: 'ses-message-123' }));
    const client: AmazonSesV2Client = { sendEmail };
    const adapter = new AmazonSesV2DeliveryAdapter(client, routing);
    await expect(
      adapter.submit({
        workspaceId,
        attempt: attempt(),
        routingPartitionRef: 'routing:workspace-primary',
        fromAddress: 'hello@mail.example.com',
        recipients: ['a@example.com'],
        subject: 'Reviewed subject',
        textContent: 'Reviewed body'
      })
    ).resolves.toEqual({
      status: 'ACCEPTED',
      providerSubmissionRef: 'ses-message-123'
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      'us-east-1',
      expect.objectContaining({
        TenantName: 'mo-workspace-primary',
        ConfigurationSetName: 'mo-workspace-primary',
        FromEmailAddress: 'hello@mail.example.com'
      })
    );
  });

  it('fails closed for routing Workspace/sender mismatch before SES', async () => {
    const sendEmail = vi.fn(() => Promise.resolve({ MessageId: 'never' }));
    const client: AmazonSesV2Client = { sendEmail };
    const wrongRouting: AmazonSesRoutingResolver = {
      resolve: vi.fn(() =>
        Promise.resolve({
          workspaceId: '15151515-1515-4515-8515-151515151515',
          tenantName: 'other',
          configurationSetName: 'other',
          region: 'us-east-1',
          senderIdentity: 'other@example.com',
          routingPartitionRef: 'routing:workspace-primary'
        })
      )
    };
    const result = await new AmazonSesV2DeliveryAdapter(client, wrongRouting).submit({
      workspaceId,
      attempt: attempt(),
      routingPartitionRef: 'routing:workspace-primary',
      fromAddress: 'hello@mail.example.com',
      recipients: ['a@example.com'],
      subject: 'Reviewed subject',
      textContent: 'Reviewed body'
    });
    expect(result).toEqual({ status: 'FAILED', reasonCode: 'SES_ROUTING_WORKSPACE_MISMATCH' });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('maps ambiguous transport failure to UNKNOWN and never claims delivery', async () => {
    const transportError = Object.assign(new Error('transport ambiguous'), { retryable: true });
    const client: AmazonSesV2Client = {
      sendEmail: vi.fn(() => Promise.reject(transportError))
    };
    await expect(
      new AmazonSesV2DeliveryAdapter(client, routing).submit({
        workspaceId,
        attempt: attempt(),
        routingPartitionRef: 'routing:workspace-primary',
        fromAddress: 'hello@mail.example.com',
        recipients: ['a@example.com'],
        subject: 'Reviewed subject',
        textContent: 'Reviewed body'
      })
    ).resolves.toEqual({ status: 'UNKNOWN', reasonCode: 'SES_TRANSPORT_AMBIGUOUS' });
  });

  it('requires SUBMITTING state', async () => {
    const client: AmazonSesV2Client = {
      sendEmail: vi.fn(() => Promise.resolve({ MessageId: 'never' }))
    };
    const adapter = new AmazonSesV2DeliveryAdapter(client, routing);
    await expect(
      adapter.submit({
        workspaceId,
        attempt: attempt('PLANNED'),
        routingPartitionRef: 'routing:workspace-primary',
        fromAddress: 'hello@mail.example.com',
        recipients: ['a@example.com'],
        subject: 'Reviewed subject',
        textContent: 'Reviewed body'
      })
    ).rejects.toThrow(/SUBMITTING/);
  });

  it('rejects multi-recipient SES V1 attempts before provider transport', async () => {
    const sendEmail = vi.fn(() => Promise.resolve({ MessageId: 'never' }));
    const client: AmazonSesV2Client = { sendEmail };
    const adapter = new AmazonSesV2DeliveryAdapter(client, routing);
    await expect(
      adapter.submit({
        workspaceId,
        attempt: attempt('SUBMITTING', 2),
        routingPartitionRef: 'routing:workspace-primary',
        fromAddress: 'hello@mail.example.com',
        recipients: ['a@example.com', 'b@example.com'],
        subject: 'Reviewed subject',
        textContent: 'Reviewed body'
      })
    ).rejects.toThrow(/exactly one recipient/);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('Amazon SES event normalization', () => {
  it('rejects unauthenticated provider events', () => {
    expect(() =>
      normalizeAmazonSesEvent(
        {
          eventType: 'Delivery',
          mail: {
            messageId: 'ses-message-123',
            timestamp: '2026-09-19T00:02:00.000Z',
            destination: ['person@example.com']
          }
        },
        {
          authenticated: false,
          workspaceId,
          deliveryAttemptId: 'email-delivery-attempt_primary',
          observedAt: '2026-09-19T00:02:01.000Z'
        }
      )
    ).toThrow(/Unauthenticated/);
  });

  it('rejects ambiguous multi-recipient provider events', () => {
    expect(() =>
      normalizeAmazonSesEvent(
        {
          eventType: 'Bounce',
          mail: {
            messageId: 'ses-message-multi',
            timestamp: '2026-09-19T00:01:00.000Z',
            destination: ['a@example.com', 'b@example.com']
          },
          bounce: { bounceType: 'Permanent' }
        },
        {
          authenticated: true,
          workspaceId,
          deliveryAttemptId: 'email-delivery-attempt_primary',
          observedAt: '2026-09-19T00:01:01.000Z'
        }
      )
    ).toThrow(/exactly one recipient destination/);
  });

  it('normalizes delivered evidence without retaining raw recipient email', () => {
    const value = normalizeAmazonSesEvent(
      {
        eventType: 'Delivery',
        mail: {
          messageId: 'ses-message-123',
          timestamp: '2026-09-19T00:02:00.000Z',
          destination: ['person@example.com']
        }
      },
      {
        authenticated: true,
        workspaceId,
        deliveryAttemptId: 'email-delivery-attempt_primary',
        observedAt: '2026-09-19T00:02:01.000Z'
      }
    );
    expect(value.event).toBe('DELIVERED');
    expect(value.providerMessageRef).toBe('ses-message-123');
    expect(value.endpointFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(value)).not.toContain('person@example.com');
  });

  it('prefers provider event chronology and native event identity', () => {
    const value = normalizeAmazonSesEvent(
      {
        eventType: 'Delivery',
        mail: {
          messageId: 'ses-message-chronology',
          timestamp: '2026-09-19T00:00:00.000Z',
          destination: ['person@example.com']
        },
        delivery: {
          timestamp: '2026-09-19T00:06:00.000Z'
        }
      },
      {
        authenticated: true,
        workspaceId,
        deliveryAttemptId: 'email-delivery-attempt_primary',
        observedAt: '2026-09-19T00:06:01.000Z',
        providerEventId: 'eventbridge-event-123'
      }
    );
    expect(value.eventAt).toBe('2026-09-19T00:06:00.000Z');
    expect(value.eventIdentity).toBe('ses-event:eventbridge-event-123');
  });

  it('distinguishes permanent and transient SES bounces', () => {
    const base = {
      mail: {
        messageId: 'ses-message-bounce',
        timestamp: '2026-09-19T00:03:00.000Z',
        destination: ['person@example.com']
      }
    };
    expect(
      normalizeAmazonSesEvent(
        { ...base, eventType: 'Bounce', bounce: { bounceType: 'Permanent' } },
        {
          authenticated: true,
          workspaceId,
          deliveryAttemptId: 'email-delivery-attempt_primary',
          observedAt: '2026-09-19T00:03:01.000Z'
        }
      ).event
    ).toBe('HARD_BOUNCED');
    expect(
      normalizeAmazonSesEvent(
        { ...base, eventType: 'Bounce', bounce: { bounceType: 'Transient' } },
        {
          authenticated: true,
          workspaceId,
          deliveryAttemptId: 'email-delivery-attempt_primary',
          observedAt: '2026-09-19T00:03:01.000Z'
        }
      ).event
    ).toBe('SOFT_BOUNCED');
    expect(
      normalizeAmazonSesEvent(
        { ...base, eventType: 'Bounce', bounce: { bounceType: 'Undetermined' } },
        {
          authenticated: true,
          workspaceId,
          deliveryAttemptId: 'email-delivery-attempt_primary',
          observedAt: '2026-09-19T00:03:01.000Z'
        }
      ).event
    ).toBe('UNKNOWN');
  });

  it('treats SES Subscription as unsubscribe only for OptOut evidence', () => {
    const base = {
      eventType: 'Subscription',
      mail: {
        messageId: 'ses-message-subscription',
        timestamp: '2026-09-19T00:04:00.000Z',
        destination: ['person@example.com']
      }
    };
    expect(
      normalizeAmazonSesEvent(
        {
          ...base,
          subscription: {
            newTopicPreferences: {
              unsubscribeAll: true,
              topicSubscriptionStatus: []
            }
          }
        },
        {
          authenticated: true,
          workspaceId,
          deliveryAttemptId: 'email-delivery-attempt_primary',
          observedAt: '2026-09-19T00:04:01.000Z'
        }
      ).event
    ).toBe('UNSUBSCRIBED');
    expect(
      normalizeAmazonSesEvent(
        {
          ...base,
          subscription: {
            newTopicPreferences: {
              unsubscribeAll: false,
              topicSubscriptionStatus: [{ topicName: 'marketing', subscriptionStatus: 'OptOut' }]
            }
          }
        },
        {
          authenticated: true,
          workspaceId,
          deliveryAttemptId: 'email-delivery-attempt_primary',
          observedAt: '2026-09-19T00:04:01.000Z'
        }
      ).event
    ).toBe('UNSUBSCRIBED');
    expect(
      normalizeAmazonSesEvent(
        {
          ...base,
          subscription: {
            newTopicPreferences: {
              unsubscribeAll: false,
              topicSubscriptionStatus: [{ topicName: 'marketing', subscriptionStatus: 'OptIn' }]
            }
          }
        },
        {
          authenticated: true,
          workspaceId,
          deliveryAttemptId: 'email-delivery-attempt_primary',
          observedAt: '2026-09-19T00:04:01.000Z'
        }
      ).event
    ).toBe('UNKNOWN');
  });
});

describe('Amazon SES authenticated event ingestion', () => {
  const envelope = {
    eventType: 'Complaint',
    mail: {
      messageId: 'ses-message-ingest',
      timestamp: '2026-09-19T00:05:00.000Z',
      destination: ['person@example.com']
    }
  };

  it('fails closed when infrastructure authentication rejects the envelope', async () => {
    const authenticator: AmazonSesEventAuthenticator = {
      verifyAndExtract: vi.fn(() => Promise.reject(new Error('invalid AWS evidence')))
    };
    const assertCorrelated = vi.fn(() => Promise.resolve());
    const admit = vi.fn((value) => Promise.resolve(value));
    const correlation: AmazonSesEventCorrelationVerifier = { assertCorrelated };
    const sink: AmazonSesObservationSink = { admit };
    await expect(
      new AmazonSesAuthenticatedEventIngestion(authenticator, correlation, sink).ingest(envelope)
    ).rejects.toThrow(/invalid AWS evidence/);
    expect(assertCorrelated).not.toHaveBeenCalled();
    expect(admit).not.toHaveBeenCalled();
  });

  it('rejects tenant or Workspace correlation mismatch before evidence admission', async () => {
    const verified: AmazonSesVerifiedEventEnvelope = {
      event: envelope,
      workspaceId,
      deliveryAttemptId: 'email-delivery-attempt_primary',
      routingPartitionRef: 'routing:workspace-primary',
      tenantName: 'mo-workspace-primary',
      observedAt: '2026-09-19T00:05:01.000Z'
    };
    const authenticator: AmazonSesEventAuthenticator = {
      verifyAndExtract: vi.fn(() => Promise.resolve(verified))
    };
    const assertCorrelated = vi.fn(() => Promise.reject(new Error('tenant mismatch')));
    const admit = vi.fn((value) => Promise.resolve(value));
    const correlation: AmazonSesEventCorrelationVerifier = { assertCorrelated };
    const sink: AmazonSesObservationSink = { admit };
    await expect(
      new AmazonSesAuthenticatedEventIngestion(authenticator, correlation, sink).ingest(envelope)
    ).rejects.toThrow(/tenant mismatch/);
    expect(admit).not.toHaveBeenCalled();
  });

  it('admits only verified, correlated evidence without durable raw email', async () => {
    const verified: AmazonSesVerifiedEventEnvelope = {
      event: envelope,
      workspaceId,
      deliveryAttemptId: 'email-delivery-attempt_primary',
      routingPartitionRef: 'routing:workspace-primary',
      tenantName: 'mo-workspace-primary',
      observedAt: '2026-09-19T00:05:01.000Z'
    };
    const authenticator: AmazonSesEventAuthenticator = {
      verifyAndExtract: vi.fn(() => Promise.resolve(verified))
    };
    const assertCorrelated = vi.fn(() => Promise.resolve());
    const admit = vi.fn((value) => Promise.resolve(value));
    const correlation: AmazonSesEventCorrelationVerifier = { assertCorrelated };
    const sink: AmazonSesObservationSink = { admit };
    const result = await new AmazonSesAuthenticatedEventIngestion(
      authenticator,
      correlation,
      sink
    ).ingest(envelope);
    expect(result.event).toBe('COMPLAINED');
    expect(result.authenticatedEvidence).toBe(true);
    expect(assertCorrelated).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        tenantName: 'mo-workspace-primary',
        providerMessageRef: 'ses-message-ingest'
      })
    );
    expect(JSON.stringify(result)).not.toContain('person@example.com');
    expect(admit).toHaveBeenCalledTimes(1);
  });
});
