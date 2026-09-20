import { describe, expect, it } from 'vitest';
import { OAuthCredentialCurrentnessServiceV1 } from '../src/oauth-credential-currentness.js';

const credential = {
  owner: 'CORE_IDENTITY' as const,
  credentialBindingId: 'oauth-credential-binding_currentness' as const,
  version: 3
};
const binding = {
  ...credential,
  schemaVersion: 1,
  workspaceId: '14141414-1414-4414-8414-141414141414',
  provider: 'WHATSAPP',
  externalAccountRef: 'account_primary',
  grantedScopes: ['messages.send'],
  grantor: { userId: 'user_1', membershipId: 'membership_1', membershipVersion: 2 },
  lifecycle: 'ACTIVE',
  accessExpiresAt: '2026-09-20T12:00:00.000Z'
};

function service(overrides: Record<string, unknown> = {}, unavailable = false) {
  return new OAuthCredentialCurrentnessServiceV1(
    {
      findCredential: async () =>
        unavailable
          ? Promise.reject(new Error('down'))
          : ({ binding: { ...binding, ...overrides } } as never)
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
  requiredScopes: ['messages.send']
};

describe('OAuth credential currentness', () => {
  it('returns safe CURRENT evidence without decrypting or exposing tokens', async () => {
    const value = await service().assess(request);
    expect(value).toMatchObject({ state: 'CURRENT', exposesAccessToken: false });
    expect(JSON.stringify(value)).not.toMatch(/accessToken|refreshToken/u);
  });

  it.each([
    [{ lifecycle: 'EXPIRED' }, 'EXPIRED'],
    [{ lifecycle: 'REAUTH_REQUIRED' }, 'REAUTH_REQUIRED'],
    [{ lifecycle: 'REVOKED' }, 'REVOKED'],
    [{ accessExpiresAt: '2026-09-20T10:00:20.000Z' }, 'EXPIRED'],
    [{ version: 4 }, 'UNKNOWN'],
    [{ provider: 'OTHER' }, 'UNKNOWN'],
    [{ externalAccountRef: 'other' }, 'UNKNOWN'],
    [{ grantedScopes: [] }, 'UNKNOWN']
  ])('fails closed for %o', async (overrides, state) => {
    await expect(service(overrides).assess(request)).resolves.toMatchObject({ state });
  });

  it('maps owner failure to UNAVAILABLE', async () => {
    await expect(service({}, true).assess(request)).resolves.toMatchObject({
      state: 'UNAVAILABLE'
    });
  });
});
