import { describe, expect, it } from 'vitest';
import { ExternalCredentialCurrentnessServiceV1 } from '../src/external-credential-currentness.js';
import type { ExternalCredentialStoredV1 } from '../src/external-credential.js';

const credential = {
  owner: 'CORE_IDENTITY' as const,
  credentialBindingId: 'external-credential-binding_currentness' as const,
  version: 3
};
const binding = {
  schemaVersion: 1 as const,
  credentialBindingId: credential.credentialBindingId,
  version: 3,
  workspaceId: '14141414-1414-4414-8414-141414141414',
  provider: 'WHATSAPP',
  externalAccountRef: 'account_primary',
  secretKind: 'STATIC_BEARER' as const,
  allowedCapabilityIds: ['capability.messages.send'],
  grantor: {
    userId: '15151515-1515-4515-8515-151515151515',
    membershipId: '16161616-1616-4616-8616-161616161616',
    membershipVersion: 2
  },
  lifecycle: 'ACTIVE' as const,
  expiresAt: '2026-09-20T12:00:00.000Z',
  createdAt: '2026-09-19T10:00:00.000Z',
  updatedAt: '2026-09-19T10:00:00.000Z',
  authority: {
    credentialSelectionAuthorityGranted: false as const,
    providerSelectionAuthorityGranted: false as const,
    implementationSelectionAuthorityGranted: false as const,
    protectedActionAuthorized: false as const,
    externalActionAuthorized: false as const,
    publishAuthorized: false as const,
    messageSendAuthorized: false as const,
    filingAuthorized: false as const,
    paymentAuthorized: false as const,
    externalIdentityLegallyVerified: false as const
  }
};
const secret = { keyId: 'key', nonceBase64: 'a', ciphertextBase64: 'b', authTagBase64: 'c' };

function service(overrides: Record<string, unknown> = {}, unavailable = false, noSecret = false) {
  return new ExternalCredentialCurrentnessServiceV1(
    {
      findCredential: () =>
        unavailable
          ? Promise.reject(new Error('down'))
          : Promise.resolve({
              binding: { ...binding, ...overrides },
              secretGeneration: 1,
              ...(noSecret ? {} : { secret })
            } as unknown as ExternalCredentialStoredV1)
    },
    { validate: () => Promise.resolve({}) as never },
    () => new Date('2026-09-20T10:00:00.000Z')
  );
}
const request = {
  credential,
  expectedWorkspaceId: binding.workspaceId,
  expectedProvider: binding.provider,
  expectedExternalAccountRef: binding.externalAccountRef,
  expectedSecretKind: binding.secretKind,
  requiredCapabilityId: binding.allowedCapabilityIds[0]!
};

describe('external credential currentness', () => {
  it('returns safe CURRENT evidence without decrypting or granting authority', async () => {
    const value = await service().assess(request);
    expect(value).toMatchObject({
      state: 'CURRENT',
      exposesSecretMaterial: false,
      createsExecutionAuthority: false
    });
    expect(JSON.stringify(value)).not.toMatch(/token|password|ciphertext/iu);
  });

  it.each([
    [{ lifecycle: 'EXPIRED', expiredAt: '2026-09-20T09:00:00.000Z' }, 'EXPIRED'],
    [
      { lifecycle: 'REAUTH_REQUIRED', reauthRequiredAt: '2026-09-20T09:00:00.000Z' },
      'REAUTH_REQUIRED'
    ],
    [{ lifecycle: 'REVOKED', revokedAt: '2026-09-20T09:00:00.000Z' }, 'REVOKED'],
    [{ expiresAt: '2026-09-20T09:00:00.000Z' }, 'EXPIRED'],
    [{ version: 4 }, 'UNKNOWN'],
    [{ workspaceId: '17171717-1717-4717-8717-171717171717' }, 'UNKNOWN'],
    [{ provider: 'OTHER' }, 'UNKNOWN'],
    [{ externalAccountRef: 'other' }, 'UNKNOWN'],
    [{ secretKind: 'BASIC' }, 'UNKNOWN'],
    [{ allowedCapabilityIds: [] }, 'UNKNOWN']
  ])('fails closed for %o', async (overrides, state) => {
    await expect(service(overrides).assess(request)).resolves.toMatchObject({ state });
  });

  it('maps owner and active-secret failures to UNAVAILABLE', async () => {
    await expect(service({}, true).assess(request)).resolves.toMatchObject({
      state: 'UNAVAILABLE'
    });
    await expect(service({}, false, true).assess(request)).resolves.toMatchObject({
      state: 'UNAVAILABLE'
    });
  });
});
