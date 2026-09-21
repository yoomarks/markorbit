import { describe, expect, it, vi } from 'vitest';
import { noWorkspaceChannelIdentityAuthorityConsequencesV1 } from '@markorbit/contracts/channel-identity-binding';
import type {
  ExternalCredentialResolutionRequestWireV1,
  ResolvedExternalCredentialWireV1
} from '@markorbit/service-kit';
import {
  TWILIO_SMS_CAPABILITY_ID_V1,
  TWILIO_SMS_CAPABILITY_VERSION_V1,
  TWILIO_SMS_IMPLEMENTATION_PROFILE_ID_V1,
  TWILIO_SMS_IMPLEMENTATION_PROFILE_VERSION_V1
} from '../src/twilio-sms-identity.js';
import { TwilioSmsTransportAuthorityV1 } from '../src/twilio-sms-transport.js';

const workspaceId = '14121412-1412-4412-8412-141214121412';
const accountSid = `AC${'1'.repeat(32)}`;
const phoneNumberSid = `PN${'2'.repeat(32)}`;
const messageSid = `SM${'3'.repeat(32)}`;
const token = 'auth-token-never-durable';
const callback = 'https://hooks.example.test/twilio/status';

const binding = {
  schemaVersion: 1 as const,
  workspaceChannelIdentityBindingId: 'workspace-channel-identity-binding_twilio-c7d2' as const,
  version: 4,
  workspaceId,
  featureKey: 'SMS_WORKSPACE_NOTIFICATION' as const,
  identity: {
    externalAccountRef: accountSid,
    externalChannelRef: phoneNumberSid,
    displayLabel: 'Workspace SMS sender'
  },
  status: 'ACTIVE' as const,
  connection: {
    sourceKind: 'PROVIDER_API' as const,
    capabilityRef: {
      capabilityId: TWILIO_SMS_CAPABILITY_ID_V1,
      capabilityVersion: TWILIO_SMS_CAPABILITY_VERSION_V1
    },
    implementationRef: {
      implementationProfileId: TWILIO_SMS_IMPLEMENTATION_PROFILE_ID_V1,
      version: TWILIO_SMS_IMPLEMENTATION_PROFILE_VERSION_V1
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
};

const materialized = {
  workspaceId,
  identityBinding: binding,
  recipient: '+14155550123',
  textContent: 'Exact SMS body',
  endpointFingerprintSha256: 'b'.repeat(64),
  metadataTags: [
    { name: 'mo_notification_attempt', value: 'notification-delivery-attempt_exact' },
    { name: 'mo_effect', value: 'c'.repeat(64) }
  ]
};

type Consumer<T> = (secret: Readonly<ResolvedExternalCredentialWireV1['secret']>) => Promise<T>;

function credentialProvider(username = accountSid) {
  const spy = vi.fn();
  return {
    spy,
    async withCredential<T>(
      request: Readonly<ExternalCredentialResolutionRequestWireV1>,
      consume: Consumer<T>
    ): Promise<T> {
      spy(request, consume);
      return consume({ kind: 'BASIC', username, password: token });
    }
  };
}

function response(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' }
    })
  );
}

function successFetcher() {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, ...(init ? { init } : {}) });
    if (init?.method === 'GET')
      return response(200, {
        sid: phoneNumberSid,
        account_sid: accountSid,
        phone_number: '+14155550999',
        capabilities: { sms: true }
      });
    return response(201, {
      sid: messageSid,
      account_sid: accountSid,
      status: 'queued',
      from: '+14155550999',
      to: materialized.recipient,
      body: materialized.textContent
    });
  });
  return { fetcher, calls };
}

describe('Twilio SMS transport authority', () => {
  it('materializes the exact PN sender and submits explicit From/To/Body/StatusCallback only', async () => {
    const credentials = credentialProvider();
    const { fetcher, calls } = successFetcher();
    const transport = new TwilioSmsTransportAuthorityV1(credentials, callback, fetcher);

    const result = await transport.submit(materialized);
    expect(result).toEqual({
      status: 'ACCEPTED',
      providerSubmissionRef: messageSid
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toContain(
      `/Accounts/${accountSid}/IncomingPhoneNumbers/${phoneNumberSid}.json`
    );
    expect(calls[0]?.init?.method).toBe('GET');
    expect(calls[1]?.url).toBe(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    );
    expect(calls[1]?.init?.method).toBe('POST');
    const requestBody = calls[1]?.init?.body;
    expect(typeof requestBody).toBe('string');
    if (typeof requestBody !== 'string')
      throw new Error('Twilio request body must be form encoded.');
    const form = new URLSearchParams(requestBody);
    expect(Object.fromEntries(form.entries())).toEqual({
      To: materialized.recipient,
      From: '+14155550999',
      Body: materialized.textContent,
      StatusCallback: callback
    });
    expect(form.has('MessagingServiceSid')).toBe(false);
    expect(new Headers(calls[1]?.init?.headers).get('authorization')).toContain('Basic ');
    expect(JSON.stringify(result)).not.toContain(token);
    expect(JSON.stringify(result)).not.toContain(materialized.textContent);
    expect(JSON.stringify(result)).not.toContain(materialized.recipient);
  });

  it('passes exact C6D Capability/Profile provenance into one JIT BASIC resolution', async () => {
    const credentials = credentialProvider();
    const { fetcher } = successFetcher();
    await new TwilioSmsTransportAuthorityV1(credentials, callback, fetcher).submit(materialized);
    expect(credentials.spy).toHaveBeenCalledWith(
      expect.objectContaining({
        callerService: 'CAPABILITY_ENGINE',
        credential: binding.connection.externalCredentialRef,
        expectedWorkspaceId: workspaceId,
        expectedProvider: 'TWILIO',
        expectedExternalAccountRef: accountSid,
        expectedSecretKind: 'BASIC',
        requiredCapabilityId: TWILIO_SMS_CAPABILITY_ID_V1,
        requiredCapabilityVersion: TWILIO_SMS_CAPABILITY_VERSION_V1,
        implementationProfileId: TWILIO_SMS_IMPLEMENTATION_PROFILE_ID_V1,
        implementationProfileVersion: TWILIO_SMS_IMPLEMENTATION_PROFILE_VERSION_V1,
        approvedUsage: 'APPROVED_PROVIDER_ADAPTER_AUTHENTICATION'
      }),
      expect.any(Function)
    );
  });

  it('fails before provider IO for wrong credential account or non-exact profile', async () => {
    const wrongCredentials = credentialProvider(`AC${'f'.repeat(32)}`);
    const { fetcher } = successFetcher();
    await expect(
      new TwilioSmsTransportAuthorityV1(wrongCredentials, callback, fetcher).submit(materialized)
    ).resolves.toEqual({ status: 'FAILED', reasonCode: 'CREDENTIAL_ACCOUNT_MISMATCH' });
    expect(fetcher).not.toHaveBeenCalled();

    const exactCredentials = credentialProvider();
    await expect(
      new TwilioSmsTransportAuthorityV1(exactCredentials, callback, fetcher).submit({
        ...materialized,
        identityBinding: {
          ...binding,
          connection: {
            ...binding.connection,
            implementationRef: {
              implementationProfileId: 'implementation-profile_other',
              version: 1
            }
          }
        }
      })
    ).resolves.toEqual({ status: 'FAILED', reasonCode: 'IDENTITY_IMPLEMENTATION_MISMATCH' });
    expect(exactCredentials.spy).not.toHaveBeenCalled();
  });

  it.each([
    [404, 'SENDER_NOT_CURRENT'],
    [429, 'SENDER_LOOKUP_UNAVAILABLE'],
    [500, 'SENDER_LOOKUP_UNAVAILABLE']
  ] as const)(
    'treats sender preflight HTTP %s as definite no-submit failure',
    async (status, reasonCode) => {
      const fetcher = vi.fn<typeof fetch>(() => response(status, {}));
      const transport = new TwilioSmsTransportAuthorityV1(credentialProvider(), callback, fetcher);
      await expect(transport.submit(materialized)).resolves.toEqual({
        status: 'FAILED',
        reasonCode
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  );

  it('fails before submission when the exact PN no longer belongs to the account or lacks SMS', async () => {
    for (const number of [
      {
        sid: phoneNumberSid,
        account_sid: `AC${'4'.repeat(32)}`,
        phone_number: '+14155550999',
        capabilities: { sms: true }
      },
      {
        sid: phoneNumberSid,
        account_sid: accountSid,
        phone_number: '+14155550999',
        capabilities: { sms: false }
      }
    ]) {
      const fetcher = vi.fn<typeof fetch>(() => response(200, number));
      await expect(
        new TwilioSmsTransportAuthorityV1(credentialProvider(), callback, fetcher).submit(
          materialized
        )
      ).resolves.toEqual({ status: 'FAILED', reasonCode: 'SENDER_NOT_CURRENT' });
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });

  it.each([
    [400, 'FAILED', 'PROVIDER_REJECTED'],
    [401, 'FAILED', 'PROVIDER_REJECTED'],
    [429, 'FAILED', 'PROVIDER_THROTTLED'],
    [500, 'UNKNOWN', 'PROVIDER_SUBMISSION_AMBIGUOUS']
  ] as const)(
    'maps Message submission HTTP %s conservatively',
    async (statusCode, status, reasonCode) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockImplementationOnce(() =>
          response(200, {
            sid: phoneNumberSid,
            account_sid: accountSid,
            phone_number: '+14155550999',
            capabilities: { sms: true }
          })
        )
        .mockImplementationOnce(() => response(statusCode, {}));
      await expect(
        new TwilioSmsTransportAuthorityV1(credentialProvider(), callback, fetcher).submit(
          materialized
        )
      ).resolves.toEqual({ status, reasonCode });
      expect(fetcher).toHaveBeenCalledTimes(2);
    }
  );

  it('maps post-attempt network loss or malformed success to UNKNOWN and never retries internally', async () => {
    const network = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(() =>
        response(200, {
          sid: phoneNumberSid,
          account_sid: accountSid,
          phone_number: '+14155550999',
          capabilities: { sms: true }
        })
      )
      .mockRejectedValueOnce(new Error('connection lost'));
    await expect(
      new TwilioSmsTransportAuthorityV1(credentialProvider(), callback, network).submit(
        materialized
      )
    ).resolves.toEqual({
      status: 'UNKNOWN',
      reasonCode: 'PROVIDER_SUBMISSION_AMBIGUOUS'
    });
    expect(network).toHaveBeenCalledTimes(2);

    const malformed = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(() =>
        response(200, {
          sid: phoneNumberSid,
          account_sid: accountSid,
          phone_number: '+14155550999',
          capabilities: { sms: true }
        })
      )
      .mockImplementationOnce(() =>
        response(201, { sid: 'not-a-message-sid', account_sid: accountSid, status: 'queued' })
      );
    await expect(
      new TwilioSmsTransportAuthorityV1(credentialProvider(), callback, malformed).submit(
        materialized
      )
    ).resolves.toEqual({ status: 'UNKNOWN', reasonCode: 'PROVIDER_RESPONSE_AMBIGUOUS' });
    expect(malformed).toHaveBeenCalledTimes(2);
  });

  it('rejects overlong body or invalid destination before credential resolution', async () => {
    const credentials = credentialProvider();
    const { fetcher } = successFetcher();
    const transport = new TwilioSmsTransportAuthorityV1(credentials, callback, fetcher);
    await expect(
      transport.submit({ ...materialized, textContent: 'x'.repeat(1_601) })
    ).resolves.toEqual({ status: 'FAILED', reasonCode: 'INVALID_TRANSPORT_INPUT' });
    await expect(transport.submit({ ...materialized, recipient: 'not-e164' })).resolves.toEqual({
      status: 'FAILED',
      reasonCode: 'INVALID_TRANSPORT_INPUT'
    });
    expect(credentials.spy).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('requires an HTTPS callback URL without credentials or fragments', () => {
    const credentials = credentialProvider();
    expect(
      () => new TwilioSmsTransportAuthorityV1(credentials, 'http://example.test/status')
    ).toThrow(/StatusCallback/);
    expect(
      () =>
        new TwilioSmsTransportAuthorityV1(
          credentials,
          'https://user:pass@example.test/status#fragment'
        )
    ).toThrow(/StatusCallback/);
  });
});
