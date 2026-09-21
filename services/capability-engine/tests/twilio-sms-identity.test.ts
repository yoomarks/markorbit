import { describe, expect, it, vi } from 'vitest';
import { noWorkspaceChannelIdentityAuthorityConsequencesV1 } from '@markorbit/contracts/channel-identity-binding';
import type {
  ExternalCredentialResolutionRequestWireV1,
  ResolvedExternalCredentialWireV1
} from '@markorbit/service-kit';
import { ExternalCredentialProviderError } from '../src/external-credential-provider.js';
import {
  TWILIO_SMS_CAPABILITY_ID_V1,
  TWILIO_SMS_CAPABILITY_VERSION_V1,
  TWILIO_SMS_IMPLEMENTATION_PROFILE_ID_V1,
  TWILIO_SMS_IMPLEMENTATION_PROFILE_VERSION_V1,
  TwilioSmsIdentityVerificationAuthorityV1
} from '../src/twilio-sms-identity.js';

const workspaceId = '14111411-1411-4411-8411-141114111411';
const accountSid = `AC${'1'.repeat(32)}`;
const phoneNumberSid = `PN${'2'.repeat(32)}`;
const token = 'auth-token-never-durable';

const binding = {
  schemaVersion: 1 as const,
  workspaceChannelIdentityBindingId: 'workspace-channel-identity-binding_twilio-c7d1' as const,
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
      credentialBindingId: 'external-credential-binding_twilio-c7d1' as const,
      version: 2
    },
    evidenceRefs: ['twilio-account:opaque']
  },
  bindingFingerprintSha256: 'a'.repeat(64),
  boundAt: '2026-09-21T04:00:00.000Z',
  lastVerifiedAt: '2026-09-21T04:10:00.000Z',
  updatedAt: '2026-09-21T04:10:00.000Z',
  authority: noWorkspaceChannelIdentityAuthorityConsequencesV1
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
      return consume({
        kind: 'BASIC',
        username,
        password: token
      });
    }
  };
}

function ok(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  );
}

function exactFetcher() {
  return vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const target = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
    expect(init?.method).toBe('GET');
    expect(new Headers(init?.headers).get('authorization')).not.toContain(token);
    if (target.includes('/IncomingPhoneNumbers/'))
      return ok({
        sid: phoneNumberSid,
        account_sid: accountSid,
        phone_number: '+14155550123',
        capabilities: { sms: true, mms: false, voice: false, fax: false }
      });
    return ok({ sid: accountSid, status: 'active' });
  });
}

describe('Twilio SMS identity verification authority', () => {
  it('verifies only the exact active Account SID plus SMS-capable PN SID', async () => {
    const credentials = credentialProvider();
    const fetcher = exactFetcher();
    const service = new TwilioSmsIdentityVerificationAuthorityV1(
      credentials,
      fetcher,
      () => '2026-09-21T04:20:00.000Z'
    );

    const result = await service.verify(binding);

    expect(result).toMatchObject({
      status: 'VERIFIED',
      binding: {
        id: binding.workspaceChannelIdentityBindingId,
        version: binding.version,
        fingerprintSha256: binding.bindingFingerprintSha256
      }
    });
    expect(result.evidenceRefs).toEqual([
      `twilio-sms-identity:account:${accountSid}:number:${phoneNumberSid}:sms-capable`
    ]);
    expect(JSON.stringify(result)).not.toContain(token);
    expect(JSON.stringify(result)).not.toContain('+14155550123');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(credentials.spy).toHaveBeenCalledWith(
      expect.objectContaining({
        callerService: 'CAPABILITY_ENGINE',
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

  it('rejects a BASIC username that does not equal the exact bound Account SID before provider IO', async () => {
    const credentials = credentialProvider(`AC${'f'.repeat(32)}`);
    const fetcher = exactFetcher();
    const service = new TwilioSmsIdentityVerificationAuthorityV1(
      credentials,
      fetcher,
      () => '2026-09-21T04:20:00.000Z'
    );
    await expect(service.verify(binding)).resolves.toMatchObject({ status: 'UNKNOWN' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    [{ sid: accountSid, status: 'suspended' }, 'UNKNOWN'],
    [{ sid: `AC${'3'.repeat(32)}`, status: 'active' }, 'UNKNOWN']
  ] as const)('fails closed for non-current account identity', async (account, status) => {
    const credentials = credentialProvider();
    const fetcher = vi.fn(() => ok(account));
    const service = new TwilioSmsIdentityVerificationAuthorityV1(
      credentials,
      fetcher,
      () => '2026-09-21T04:20:00.000Z'
    );
    await expect(service.verify(binding)).resolves.toMatchObject({ status });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ sid: phoneNumberSid, account_sid: `AC${'4'.repeat(32)}`, capabilities: { sms: true } }],
    [{ sid: `PN${'5'.repeat(32)}`, account_sid: accountSid, capabilities: { sms: true } }],
    [{ sid: phoneNumberSid, account_sid: accountSid, capabilities: { sms: false } }]
  ])('fails closed for exact number/account/SMS capability mismatch', async (number) => {
    const credentials = credentialProvider();
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => ok({ sid: accountSid, status: 'active' }))
      .mockImplementationOnce(() => ok(number));
    const service = new TwilioSmsIdentityVerificationAuthorityV1(
      credentials,
      fetcher as typeof fetch,
      () => '2026-09-21T04:20:00.000Z'
    );
    await expect(service.verify(binding)).resolves.toMatchObject({ status: 'UNKNOWN' });
  });

  it.each([
    [401, 'UNKNOWN'],
    [404, 'UNKNOWN'],
    [429, 'UNAVAILABLE'],
    [500, 'UNAVAILABLE']
  ] as const)('maps provider HTTP %s conservatively', async (statusCode, expected) => {
    const credentials = credentialProvider();
    const fetcher = vi.fn(() => Promise.resolve(new Response('', { status: statusCode })));
    const service = new TwilioSmsIdentityVerificationAuthorityV1(
      credentials,
      fetcher,
      () => '2026-09-21T04:20:00.000Z'
    );
    await expect(service.verify(binding)).resolves.toMatchObject({ status: expected });
  });

  it('maps provider timeout and credential authority outages to UNAVAILABLE without a send', async () => {
    const credentials = credentialProvider();
    const fetcher = vi.fn<typeof fetch>(() => Promise.reject(new Error('timeout')));
    const unavailable = new TwilioSmsIdentityVerificationAuthorityV1(
      credentials,
      fetcher,
      () => '2026-09-21T04:20:00.000Z'
    );
    await expect(unavailable.verify(binding)).resolves.toMatchObject({ status: 'UNAVAILABLE' });

    const denied = {
      withCredential: vi.fn(() =>
        Promise.reject(
          new ExternalCredentialProviderError(
            'CREDENTIAL_RESOLUTION_UNAVAILABLE',
            'Core unavailable',
            true
          )
        )
      )
    };
    await expect(
      new TwilioSmsIdentityVerificationAuthorityV1(
        denied,
        fetcher as typeof fetch,
        () => '2026-09-21T04:20:00.000Z'
      ).verify(binding)
    ).resolves.toMatchObject({ status: 'UNAVAILABLE' });

    for (const call of fetcher.mock.calls) expect(call[1]?.method).not.toBe('POST');
  });

  it('does not resolve credentials for a different provider profile or malformed exact identity', async () => {
    const credentials = credentialProvider();
    const fetcher = exactFetcher();
    const service = new TwilioSmsIdentityVerificationAuthorityV1(
      credentials,
      fetcher,
      () => '2026-09-21T04:20:00.000Z'
    );
    await expect(
      service.verify({
        ...binding,
        connection: {
          ...binding.connection,
          implementationRef: {
            implementationProfileId: 'implementation-profile_other-provider',
            version: 1
          }
        }
      })
    ).resolves.toMatchObject({ status: 'UNAVAILABLE' });
    await expect(
      service.verify({
        ...binding,
        identity: { ...binding.identity, externalChannelRef: 'sender-alias' }
      })
    ).resolves.toMatchObject({ status: 'UNKNOWN' });
    expect(credentials.spy).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
