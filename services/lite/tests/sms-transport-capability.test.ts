import { describe, expect, it, vi } from 'vitest';
import { noWorkspaceChannelIdentityAuthorityConsequencesV1 } from '@markorbit/contracts/channel-identity-binding';
import { HttpCapabilityTwilioSmsTransportV1 } from '../src/sms-transport-capability.js';

const workspaceId = '14121412-1412-4412-8412-141214121412';
const materialized = {
  workspaceId,
  identityBinding: {
    schemaVersion: 1 as const,
    workspaceChannelIdentityBindingId: 'workspace-channel-identity-binding_twilio-c7d2' as const,
    version: 4,
    workspaceId,
    featureKey: 'SMS_WORKSPACE_NOTIFICATION' as const,
    identity: {
      externalAccountRef: `AC${'1'.repeat(32)}`,
      externalChannelRef: `PN${'2'.repeat(32)}`,
      displayLabel: 'Workspace SMS sender'
    },
    status: 'ACTIVE' as const,
    connection: {
      sourceKind: 'PROVIDER_API' as const,
      capabilityRef: { capabilityId: 'channel.sms.notification', capabilityVersion: '1' },
      implementationRef: {
        implementationProfileId:
          'implementation-profile_twilio-sms-incoming-phone-number-v1' as const,
        version: 1
      },
      externalCredentialRef: {
        owner: 'CORE_IDENTITY' as const,
        credentialBindingId: 'external-credential-binding_twilio-c7d2' as const,
        version: 2
      },
      evidenceRefs: ['twilio-account:opaque']
    },
    bindingFingerprintSha256: 'a'.repeat(64),
    boundAt: '2026-09-21T06:00:00.000Z',
    lastVerifiedAt: '2026-09-21T06:10:00.000Z',
    updatedAt: '2026-09-21T06:10:00.000Z',
    authority: noWorkspaceChannelIdentityAuthorityConsequencesV1
  },
  recipient: '+14155550123',
  textContent: 'Exact SMS body',
  endpointFingerprintSha256: 'b'.repeat(64),
  metadataTags: [{ name: 'mo_effect', value: 'c'.repeat(64) }]
};

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' }
    })
  );
}

describe('Capability-backed Twilio SMS transport', () => {
  it('passes the exact C7C materialization to the trusted Capability Engine adapter', async () => {
    const messageSid = `SM${'3'.repeat(32)}`;
    const fetcher = vi.fn<typeof fetch>(() =>
      jsonResponse(200, { status: 'ACCEPTED', providerSubmissionRef: messageSid })
    );
    const transport = new HttpCapabilityTwilioSmsTransportV1(
      'http://capability-engine/',
      'i'.repeat(40),
      fetcher
    );

    await expect(transport.submit(materialized)).resolves.toEqual({
      status: 'ACCEPTED',
      providerSubmissionRef: messageSid
    });
    expect(fetcher).toHaveBeenCalledWith(
      'http://capability-engine/internal/v1/channel-sms/twilio/submit',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': 'i'.repeat(40)
        },
        body: JSON.stringify({ materialized })
      })
    );
  });

  it.each([
    [400, 'FAILED', 'TRANSPORT_BRIDGE_REJECTED'],
    [401, 'FAILED', 'TRANSPORT_BRIDGE_REJECTED'],
    [404, 'FAILED', 'TRANSPORT_BRIDGE_REJECTED'],
    [500, 'UNKNOWN', 'TRANSPORT_BRIDGE_AMBIGUOUS']
  ] as const)(
    'maps trusted bridge HTTP %s without inventing provider evidence',
    async (statusCode, status, reasonCode) => {
      const transport = new HttpCapabilityTwilioSmsTransportV1(
        'http://capability-engine',
        'i'.repeat(40),
        vi.fn<typeof fetch>(() => jsonResponse(statusCode, {}))
      );
      await expect(transport.submit(materialized)).resolves.toEqual({ status, reasonCode });
    }
  );

  it('maps bridge network loss to UNKNOWN because remote submission cannot be disproved', async () => {
    const fetcher = vi.fn<typeof fetch>(() => Promise.reject(new Error('connection lost')));
    await expect(
      new HttpCapabilityTwilioSmsTransportV1(
        'http://capability-engine',
        'i'.repeat(40),
        fetcher
      ).submit(materialized)
    ).resolves.toEqual({ status: 'UNKNOWN', reasonCode: 'TRANSPORT_BRIDGE_AMBIGUOUS' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([
    { status: 'ACCEPTED', providerSubmissionRef: 'not-a-message-sid' },
    { status: 'FAILED', reasonCode: 'lowercase-not-allowed' },
    { status: 'DELIVERED', providerSubmissionRef: `SM${'3'.repeat(32)}` },
    { status: 'ACCEPTED', providerSubmissionRef: `SM${'3'.repeat(32)}`, raw: 'forbidden' }
  ])('fails closed on malformed or over-authoritative bridge output', async (body) => {
    const transport = new HttpCapabilityTwilioSmsTransportV1(
      'http://capability-engine',
      'i'.repeat(40),
      vi.fn<typeof fetch>(() => jsonResponse(200, body))
    );
    await expect(transport.submit(materialized)).resolves.toEqual({
      status: 'UNKNOWN',
      reasonCode: 'TRANSPORT_BRIDGE_AMBIGUOUS'
    });
  });

  it('passes bounded FAILED/UNKNOWN reason codes through without adding retry authority', async () => {
    for (const body of [
      { status: 'FAILED', reasonCode: 'PROVIDER_THROTTLED' },
      { status: 'UNKNOWN', reasonCode: 'PROVIDER_SUBMISSION_AMBIGUOUS' }
    ] as const) {
      const transport = new HttpCapabilityTwilioSmsTransportV1(
        'http://capability-engine',
        'i'.repeat(40),
        vi.fn<typeof fetch>(() => jsonResponse(200, body))
      );
      await expect(transport.submit(materialized)).resolves.toEqual(body);
    }
  });
});
