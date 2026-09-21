import { describe, expect, it, vi } from 'vitest';
import { noWorkspaceChannelIdentityAuthorityConsequencesV1 } from '@markorbit/contracts/channel-identity-binding';
import {
  HttpCapabilityWorkspaceChannelIdentityVerificationAuthorityV1,
  TwilioSmsNotificationChannelIdentityRequirementsReaderV1
} from '../src/twilio-sms-identity-readers.js';

const workspaceId = '14111411-1411-4411-8411-141114111411';
const accountSid = `AC${'1'.repeat(32)}`;
const phoneNumberSid = `PN${'2'.repeat(32)}`;
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
      capabilityId: 'channel.sms.notification',
      capabilityVersion: '1'
    },
    implementationRef: {
      implementationProfileId:
        'implementation-profile_twilio-sms-incoming-phone-number-v1' as const,
      version: 1
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

const ref = {
  id: binding.workspaceChannelIdentityBindingId,
  version: binding.version,
  fingerprintSha256: binding.bindingFingerprintSha256
};

describe('Twilio SMS identity safe readers', () => {
  it('accepts only the exact Twilio implementation profile as BASIC requirements', async () => {
    const getExact = vi.fn(() => Promise.resolve(binding));
    const reader = new TwilioSmsNotificationChannelIdentityRequirementsReaderV1({ getExact });

    await expect(
      reader.resolve({
        workspaceId,
        featureKey: 'SMS_WORKSPACE_NOTIFICATION',
        binding: ref
      })
    ).resolves.toEqual({
      kind: 'EXTERNAL_CREDENTIAL',
      expectedProvider: 'TWILIO',
      expectedSecretKind: 'BASIC'
    });
    expect(getExact).toHaveBeenCalledWith(
      workspaceId,
      binding.workspaceChannelIdentityBindingId,
      binding.version
    );
  });

  it.each([
    {
      ...binding,
      connection: {
        ...binding.connection,
        implementationRef: {
          implementationProfileId: 'implementation-profile_other-provider' as const,
          version: 1
        }
      }
    },
    {
      ...binding,
      connection: {
        ...binding.connection,
        capabilityRef: { capabilityId: 'channel.sms.other', capabilityVersion: '1' }
      }
    },
    {
      ...binding,
      connection: {
        ...binding.connection,
        externalCredentialRef: undefined
      }
    },
    {
      ...binding,
      bindingFingerprintSha256: 'b'.repeat(64)
    }
  ])(
    'fails closed instead of inferring provider requirements from a non-exact binding',
    async (value) => {
      const reader = new TwilioSmsNotificationChannelIdentityRequirementsReaderV1({
        getExact: vi.fn(() => Promise.resolve(value as never))
      });
      await expect(
        reader.resolve({
          workspaceId,
          featureKey: 'SMS_WORKSPACE_NOTIFICATION',
          binding: ref
        })
      ).resolves.toEqual({ unavailable: true });
    }
  );

  it('reads a safe exact verification observation from Capability Engine', async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            schemaVersion: 1,
            binding: ref,
            status: 'VERIFIED',
            observedAt: '2026-09-21T04:20:00.000Z',
            evidenceRefs: [
              `twilio-sms-identity:account:${accountSid}:number:${phoneNumberSid}:sms-capable`
            ]
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
    );
    const reader = new HttpCapabilityWorkspaceChannelIdentityVerificationAuthorityV1(
      'http://capability-engine',
      'i'.repeat(40),
      fetcher,
      () => '2026-09-21T04:21:00.000Z'
    );

    await expect(reader.verify(binding)).resolves.toMatchObject({
      status: 'VERIFIED',
      binding: ref
    });
    expect(fetcher).toHaveBeenCalledWith(
      'http://capability-engine/internal/v1/channel-identity/verification',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ binding })
      })
    );
  });

  it('fails closed on route outage, malformed output, or reference mismatch', async () => {
    const values: Array<() => Promise<Response>> = [
      () => Promise.reject(new Error('down')),
      () => Promise.resolve(new Response('{bad', { status: 200 })),
      () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              schemaVersion: 1,
              binding: { ...ref, version: ref.version + 1 },
              status: 'VERIFIED',
              observedAt: '2026-09-21T04:20:00.000Z',
              evidenceRefs: ['twilio-sms-identity:mismatch']
            }),
            { status: 200 }
          )
        )
    ];
    for (const response of values) {
      const reader = new HttpCapabilityWorkspaceChannelIdentityVerificationAuthorityV1(
        'http://capability-engine',
        'i'.repeat(40),
        vi.fn(response),
        () => '2026-09-21T04:21:00.000Z'
      );
      await expect(reader.verify(binding)).resolves.toEqual({
        schemaVersion: 1,
        binding: ref,
        status: 'UNAVAILABLE',
        observedAt: '2026-09-21T04:21:00.000Z',
        evidenceRefs: ['channel-identity-verification:unavailable']
      });
    }
  });
});
