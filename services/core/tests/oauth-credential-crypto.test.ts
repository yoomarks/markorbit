import { describe, expect, it } from 'vitest';
import {
  OAuthCredentialCryptoError,
  OAuthCredentialKeyringV1,
  oauthCredentialSecretAadV1
} from '../src/oauth-credential-crypto.js';

const oldKey = Buffer.alloc(32, 3);
const newKey = Buffer.alloc(32, 9);
const aad = oauthCredentialSecretAadV1({
  credentialBindingId: 'oauth-credential-binding_crypto-test',
  workspaceId: 'workspace_crypto-test',
  provider: 'MICROSOFT_GRAPH',
  secretGeneration: 1
});

describe('OAuth credential AEAD keyring', () => {
  it('encrypts secret material and fails closed for transplanted AAD', () => {
    const keyring = new OAuthCredentialKeyringV1({
      activeKeyId: 'key-v1',
      keys: { 'key-v1': oldKey }
    });
    const encrypted = keyring.encrypt(
      {
        accessToken: 'access-secret',
        refreshToken: 'refresh-secret',
        accessExpiresAt: '2026-09-11T02:00:00.000Z'
      },
      aad
    );
    expect(JSON.stringify(encrypted)).not.toContain('access-secret');
    expect(JSON.stringify(encrypted)).not.toContain('refresh-secret');
    expect(keyring.decrypt(encrypted, aad)).toEqual({
      accessToken: 'access-secret',
      refreshToken: 'refresh-secret',
      accessExpiresAt: '2026-09-11T02:00:00.000Z'
    });
    expect(() => keyring.decrypt(encrypted, `${aad}:other-workspace`)).toThrow(
      OAuthCredentialCryptoError
    );
  });

  it('decrypts an older key generation while encrypting new material with the active key', () => {
    const oldRing = new OAuthCredentialKeyringV1({
      activeKeyId: 'key-v1',
      keys: { 'key-v1': oldKey }
    });
    const encryptedOld = oldRing.encryptText('pkce-secret', 'grant-aad');
    const rotatedRing = new OAuthCredentialKeyringV1({
      activeKeyId: 'key-v2',
      keys: { 'key-v1': oldKey, 'key-v2': newKey }
    });
    expect(rotatedRing.decryptText(encryptedOld, 'grant-aad')).toBe('pkce-secret');
    expect(rotatedRing.encryptText('new-secret', 'grant-aad').keyId).toBe('key-v2');
  });

  it('fails closed when the active key is missing or malformed', () => {
    expect(
      () => new OAuthCredentialKeyringV1({ activeKeyId: 'missing', keys: { 'key-v1': oldKey } })
    ).toThrow('Active OAuth credential encryption key is unavailable');
    expect(
      () => new OAuthCredentialKeyringV1({ activeKeyId: 'bad', keys: { bad: Buffer.alloc(16) } })
    ).toThrow('must be 32 bytes');
  });
});
