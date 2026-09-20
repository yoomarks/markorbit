import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface EncryptedCredentialEnvelopeV1 {
  keyId: string;
  nonceBase64: string;
  ciphertextBase64: string;
  authTagBase64: string;
}

export function encryptCredentialTextV1(
  keyId: string,
  key: Uint8Array,
  plaintext: string,
  aad: string
): EncryptedCredentialEnvelopeV1 {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key), nonce);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
  return {
    keyId,
    nonceBase64: nonce.toString('base64'),
    ciphertextBase64: ciphertext.toString('base64'),
    authTagBase64: cipher.getAuthTag().toString('base64')
  };
}

export function decryptCredentialTextV1(
  key: Uint8Array,
  secret: Readonly<EncryptedCredentialEnvelopeV1>,
  aad: string
): string {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(key),
    Buffer.from(secret.nonceBase64, 'base64')
  );
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(Buffer.from(secret.authTagBase64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertextBase64, 'base64')),
    decipher.final()
  ]).toString('utf8');
}
