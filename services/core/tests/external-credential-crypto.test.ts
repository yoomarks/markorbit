import { describe, expect, it } from 'vitest';
import {
  ExternalCredentialCryptoError,
  ExternalCredentialKeyringV1,
  externalCredentialSecretAadV1
} from '../src/external-credential-crypto.js';

const aad = externalCredentialSecretAadV1({
  credentialBindingId: 'external-credential-binding_test',
  workspaceId: '11111111-1111-4111-8111-111111111111',
  provider: 'TEST',
  secretKind: 'API_KEY',
  secretGeneration: 1
});

describe('external credential crypto', () => {
  const keyring = new ExternalCredentialKeyringV1({
    activeKeyId: 'key-v1',
    keys: { 'key-v1': Buffer.alloc(32, 7) }
  });

  it.each([
    { kind: 'API_KEY' as const, keyId: 'client', secret: 'api-secret' },
    { kind: 'STATIC_BEARER' as const, token: 'bearer-token' },
    { kind: 'BASIC' as const, username: 'user', password: 'password' }
  ])('round trips $kind only with exact AAD', (material) => {
    const encrypted = keyring.encrypt(material, aad);
    expect(JSON.stringify(encrypted)).not.toContain(Object.values(material).at(-1));
    expect(keyring.decrypt(encrypted, aad)).toEqual(material);
    expect(() => keyring.decrypt(encrypted, `${aad}:changed`)).toThrow(
      ExternalCredentialCryptoError
    );
  });

  it('rejects unknown secret fields and invalid key sizes', () => {
    expect(() =>
      keyring.encrypt({ kind: 'API_KEY', secret: 'x', token: 'leak' } as never, aad)
    ).toThrow(ExternalCredentialCryptoError);
    expect(
      () => new ExternalCredentialKeyringV1({ activeKeyId: 'bad', keys: { bad: Buffer.alloc(16) } })
    ).toThrow(ExternalCredentialCryptoError);
  });

  it('decrypts old-key material only while the old deployment key remains available', () => {
    const old = new ExternalCredentialKeyringV1({
      activeKeyId: 'old',
      keys: { old: Buffer.alloc(32, 1) }
    });
    const encrypted = old.encrypt({ kind: 'API_KEY', secret: 'old-value' }, aad);
    const rotating = new ExternalCredentialKeyringV1({
      activeKeyId: 'new',
      keys: { old: Buffer.alloc(32, 1), new: Buffer.alloc(32, 2) }
    });
    expect(rotating.decrypt(encrypted, aad)).toEqual({ kind: 'API_KEY', secret: 'old-value' });
    const retired = new ExternalCredentialKeyringV1({
      activeKeyId: 'new',
      keys: { new: Buffer.alloc(32, 2) }
    });
    expect(() => retired.decrypt(encrypted, aad)).toThrow(/decryption key is unavailable/u);
  });
});
