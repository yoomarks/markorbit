import { describe, expect, it, vi } from 'vitest';
import {
  noEmailDeliveryAuthorityConsequencesV1,
  type EmailDeliveryAttemptV1
} from '@markorbit/contracts/email-delivery';
import {
  AmazonSesV2DeliveryAdapter,
  normalizeAmazonSesEvent,
  type AmazonSesRoutingResolver,
  type AmazonSesV2Client
} from '../src/email-delivery-ses.js';

const workspaceId = '14141414-1414-4414-8414-141414141414';

const attempt = (status: EmailDeliveryAttemptV1['status'] = 'SUBMITTING'): EmailDeliveryAttemptV1 => ({
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
    const client: AmazonSesV2Client = {
      sendEmail: vi.fn(() => Promise.resolve({ MessageId: 'ses-message-123' }))
    };
    const adapter = new AmazonSesV2DeliveryAdapter(client, routing);
    await expect(
      adapter.submit({
        workspaceId,
        attempt: attempt(),
        routingPartitionRef: 'routing:workspace-primary',
        fromAddress: 'hello@mail.example.com',
        recipients: ['a@example.com', 'b@example.com'],
        subject: 'Reviewed subject',
        textContent: 'Reviewed body'
      })
    ).resolves.toEqual({
      status: 'ACCEPTED',
      providerSubmissionRef: 'ses-message-123'
    });
    expect(client.sendEmail).toHaveBeenCalledTimes(1);
    expect(client.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        TenantName: 'mo-workspace-primary',
        ConfigurationSetName: 'mo-workspace-primary',
        FromEmailAddress: 'hello@mail.example.com'
      })
    );
  });

  it('fails closed for routing Workspace/sender mismatch before SES', async () => {
    const client: AmazonSesV2Client = {
      sendEmail: vi.fn(() => Promise.resolve({ MessageId: 'never' }))
    };
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
      recipients: ['a@example.com', 'b@example.com'],
      subject: 'Reviewed subject',
      textContent: 'Reviewed body'
    });
    expect(result).toEqual({ status: 'FAILED', reasonCode: 'SES_ROUTING_WORKSPACE_MISMATCH' });
    expect(client.sendEmail).not.toHaveBeenCalled();
  });

  it('maps ambiguous transport failure to UNKNOWN and never claims delivery', async () => {
    const client: AmazonSesV2Client = {
      sendEmail: vi.fn(() => Promise.reject({ retryable: true }))
    };
    await expect(
      new AmazonSesV2DeliveryAdapter(client, routing).submit({
        workspaceId,
        attempt: attempt(),
        routingPartitionRef: 'routing:workspace-primary',
        fromAddress: 'hello@mail.example.com',
        recipients: ['a@example.com', 'b@example.com'],
        subject: 'Reviewed subject',
        textContent: 'Reviewed body'
      })
    ).resolves.toEqual({ status: 'UNKNOWN', reasonCode: 'SES_TRANSPORT_AMBIGUOUS' });
  });

  it('requires SUBMITTING state and bounded shard size', async () => {
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
        recipients: ['a@example.com', 'b@example.com'],
        subject: 'Reviewed subject',
        textContent: 'Reviewed body'
      })
    ).rejects.toThrow(/SUBMITTING/);
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
});
