import twilio from 'twilio';
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
import { TwilioSmsStatusCallbackVerificationAuthorityV1 } from '../src/twilio-sms-webhook.js';

const workspaceId = '14131413-1413-4413-8413-141314131413';
const accountSid = `AC${'1'.repeat(32)}`;
const phoneNumberSid = `PN${'2'.repeat(32)}`;
const messageSid = `SM${'3'.repeat(32)}`;
const token = 'twilio-auth-token-c7d3';
const callbackUrl =
  'https://callbacks.markorbit.example/webhooks/notification-automation/sms-workspace-notification/twilio';

const binding = {
  schemaVersion: 1 as const,
  workspaceChannelIdentityBindingId: 'workspace-channel-identity-binding_twilio-c7d3' as const,
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
      credentialBindingId: 'external-credential-binding_twilio-c7d3' as const,
      version: 2
    },
    evidenceRefs: ['twilio-account:opaque']
  },
  bindingFingerprintSha256: 'a'.repeat(64),
  boundAt: '2026-09-21T08:00:00.000Z',
  lastVerifiedAt: '2026-09-21T08:10:00.000Z',
  updatedAt: '2026-09-21T08:10:00.000Z',
  authority: noWorkspaceChannelIdentityAuthorityConsequencesV1
};

type Consumer<T> = (secret: Readonly<ResolvedExternalCredentialWireV1['secret']>) => Promise<T>;

function credentials() {
  const spy = vi.fn();
  return {
    spy,
    async withCredential<T>(
      request: Readonly<ExternalCredentialResolutionRequestWireV1>,
      consume: Consumer<T>
    ): Promise<T> {
      spy(request, consume);
      return consume({ kind: 'BASIC', username: accountSid, password: token });
    }
  };
}

const basePairs = [
  { name: 'AccountSid', value: accountSid },
  { name: 'MessageSid', value: messageSid },
  { name: 'MessageStatus', value: 'delivered' },
  { name: 'ErrorCode', value: '30001' }
] as const;

function signature(pairs: readonly Readonly<{ name: string; value: string }>[], url = callbackUrl) {
  const params: Record<string, string | string[]> = {};
  for (const pair of pairs) {
    const prior = params[pair.name];
    if (prior === undefined) params[pair.name] = pair.value;
    else if (Array.isArray(prior)) prior.push(pair.value);
    else params[pair.name] = [prior, pair.value];
  }
  return twilio.getExpectedTwilioSignature(token, url, params);
}

describe('Twilio SMS StatusCallback verifier', () => {
  it('uses the official helper with every form parameter, including future additions', async () => {
    const provider = credentials();
    const verifier = new TwilioSmsStatusCallbackVerificationAuthorityV1(provider, callbackUrl);
    const pairs = [...basePairs, { name: 'FutureTwilioField', value: 'future-value' }];
    const result = await verifier.verify({
      workspaceId,
      identityBinding: binding,
      signature: signature(pairs),
      formParams: pairs
    });
    expect(result).toEqual({
      authenticated: true,
      externalAccountRef: accountSid,
      providerMessageRef: messageSid,
      messageStatus: 'delivered',
      providerErrorCode: '30001'
    });
    expect(provider.spy).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedWorkspaceId: workspaceId,
        expectedProvider: 'TWILIO',
        expectedExternalAccountRef: accountSid,
        expectedSecretKind: 'BASIC',
        implementationProfileId: TWILIO_SMS_IMPLEMENTATION_PROFILE_ID_V1,
        implementationProfileVersion: TWILIO_SMS_IMPLEMENTATION_PROFILE_VERSION_V1
      }),
      expect.any(Function)
    );
    expect(JSON.stringify(result)).not.toContain(token);
    expect(JSON.stringify(result)).not.toContain('future-value');
  });

  it('rejects invalid signatures and a signature calculated for a different external URL', async () => {
    const verifier = new TwilioSmsStatusCallbackVerificationAuthorityV1(credentials(), callbackUrl);
    await expect(
      verifier.verify({
        workspaceId,
        identityBinding: binding,
        signature: 'AAAAAAAAAAAAAAAAAAAAAA==',
        formParams: basePairs
      })
    ).resolves.toEqual({ authenticated: false, reasonCode: 'SIGNATURE_INVALID' });
    await expect(
      verifier.verify({
        workspaceId,
        identityBinding: binding,
        signature: signature(basePairs, 'https://wrong.example/status'),
        formParams: basePairs
      })
    ).resolves.toEqual({ authenticated: false, reasonCode: 'SIGNATURE_INVALID' });
  });

  it('rejects a signed callback for the wrong account or malformed correlation fields', async () => {
    const verifier = new TwilioSmsStatusCallbackVerificationAuthorityV1(credentials(), callbackUrl);
    const wrongAccount = [
      ...basePairs.filter((pair) => pair.name !== 'AccountSid'),
      { name: 'AccountSid', value: `AC${'f'.repeat(32)}` }
    ];
    await expect(
      verifier.verify({
        workspaceId,
        identityBinding: binding,
        signature: signature(wrongAccount),
        formParams: wrongAccount
      })
    ).resolves.toEqual({
      authenticated: false,
      reasonCode: 'CALLBACK_CORRELATION_MISMATCH'
    });

    const duplicateSid = [...basePairs, { name: 'MessageSid', value: messageSid }];
    await expect(
      verifier.verify({
        workspaceId,
        identityBinding: binding,
        signature: signature(duplicateSid),
        formParams: duplicateSid
      })
    ).resolves.toEqual({
      authenticated: false,
      reasonCode: 'CALLBACK_CORRELATION_MISMATCH'
    });
  });
});
