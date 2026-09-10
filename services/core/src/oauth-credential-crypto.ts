import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface OAuthCredentialSecretMaterialV1 {
  accessToken: string;
  refreshToken?: string;
  accessExpiresAt: string;
}

export interface EncryptedOAuthSecretV1 {
  keyId: string;
  nonceBase64: string;
  ciphertextBase64: string;
  authTagBase64: string;
}

export class OAuthCredentialCryptoError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'OAuthCredentialCryptoError';
  }
}

function assertKeyId(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 120)
    throw new OAuthCredentialCryptoError('OAuth credential key id is invalid.');
  return normalized;
}
function assertSecretMaterial(value: unknown): OAuthCredentialSecretMaterialV1 {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new OAuthCredentialCryptoError('OAuth secret payload is invalid.');
  const item = value as Record<string, unknown>;
  const keys = Object.keys(item);
  if (keys.some((key) => !['accessToken', 'refreshToken', 'accessExpiresAt'].includes(key)))
    throw new OAuthCredentialCryptoError('OAuth secret payload contains unsupported fields.');
  if (typeof item.accessToken !== 'string' || !item.accessToken.trim())
    throw new OAuthCredentialCryptoError('OAuth access token is unavailable.');
  if (
    item.refreshToken !== undefined &&
    (typeof item.refreshToken !== 'string' || !item.refreshToken.trim())
  )
    throw new OAuthCredentialCryptoError('OAuth refresh token is invalid.');
  if (
    typeof item.accessExpiresAt !== 'string' ||
    !Number.isFinite(Date.parse(item.accessExpiresAt))
  )
    throw new OAuthCredentialCryptoError('OAuth access expiry is invalid.');
  return {
    accessToken: item.accessToken,
    ...(item.refreshToken ? { refreshToken: item.refreshToken } : {}),
    accessExpiresAt: new Date(item.accessExpiresAt).toISOString()
  };
}

export class OAuthCredentialKeyringV1 {
  private readonly keys: ReadonlyMap<string, Buffer>;
  readonly activeKeyId: string;
  constructor(
    input: Readonly<{ activeKeyId: string; keys: Readonly<Record<string, Uint8Array>> }>
  ) {
    this.activeKeyId = assertKeyId(input.activeKeyId);
    const entries = Object.entries(input.keys).map(([keyId, key]) => {
      const normalizedKeyId = assertKeyId(keyId);
      const bytes = Buffer.from(key);
      if (bytes.byteLength !== 32)
        throw new OAuthCredentialCryptoError('OAuth credential encryption keys must be 32 bytes.');
      return [normalizedKeyId, bytes] as const;
    });
    this.keys = new Map(entries);
    if (!this.keys.has(this.activeKeyId))
      throw new OAuthCredentialCryptoError(
        'Active OAuth credential encryption key is unavailable.'
      );
  }

  encryptText(plaintext: string, aad: string): EncryptedOAuthSecretV1 {
    const key = this.keys.get(this.activeKeyId)!;
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(Buffer.from(aad, 'utf8'));
    const ciphertext = Buffer.concat([
      cipher.update(Buffer.from(plaintext, 'utf8')),
      cipher.final()
    ]);
    return {
      keyId: this.activeKeyId,
      nonceBase64: nonce.toString('base64'),
      ciphertextBase64: ciphertext.toString('base64'),
      authTagBase64: cipher.getAuthTag().toString('base64')
    };
  }

  decryptText(secret: Readonly<EncryptedOAuthSecretV1>, aad: string): string {
    const key = this.keys.get(secret.keyId);
    if (!key)
      throw new OAuthCredentialCryptoError('OAuth credential decryption key is unavailable.');
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(secret.nonceBase64, 'base64')
      );
      decipher.setAAD(Buffer.from(aad, 'utf8'));
      decipher.setAuthTag(Buffer.from(secret.authTagBase64, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(secret.ciphertextBase64, 'base64')),
        decipher.final()
      ]).toString('utf8');
    } catch (cause) {
      throw new OAuthCredentialCryptoError('OAuth credential secret could not be decrypted.', {
        cause: cause instanceof Error ? cause : undefined
      });
    }
  }

  encrypt(
    material: Readonly<OAuthCredentialSecretMaterialV1>,
    aad: string
  ): EncryptedOAuthSecretV1 {
    return this.encryptText(JSON.stringify(assertSecretMaterial(material)), aad);
  }

  decrypt(secret: Readonly<EncryptedOAuthSecretV1>, aad: string): OAuthCredentialSecretMaterialV1 {
    try {
      return assertSecretMaterial(JSON.parse(this.decryptText(secret, aad)));
    } catch (cause) {
      if (cause instanceof OAuthCredentialCryptoError) throw cause;
      throw new OAuthCredentialCryptoError('OAuth credential secret payload is invalid.', {
        cause: cause instanceof Error ? cause : undefined
      });
    }
  }
}

export function createOAuthCredentialKeyringFromEnvironmentV1(
  env: NodeJS.ProcessEnv = process.env
): OAuthCredentialKeyringV1 {
  const activeKeyId = env.MO_CORE_OAUTH_CREDENTIAL_ACTIVE_KEY_ID;
  const encodedKeys = env.MO_CORE_OAUTH_CREDENTIAL_KEYS_JSON;
  if (!activeKeyId || !encodedKeys)
    throw new OAuthCredentialCryptoError('OAuth credential encryption keyring is not configured.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(encodedKeys);
  } catch (cause) {
    throw new OAuthCredentialCryptoError('OAuth credential encryption keyring is invalid.', {
      cause: cause instanceof Error ? cause : undefined
    });
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    throw new OAuthCredentialCryptoError('OAuth credential encryption keyring is invalid.');
  const keys: Record<string, Uint8Array> = {};
  for (const [keyId, encoded] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof encoded !== 'string')
      throw new OAuthCredentialCryptoError('OAuth credential encryption keyring is invalid.');
    const bytes = Buffer.from(encoded, 'base64');
    if (bytes.byteLength !== 32)
      throw new OAuthCredentialCryptoError('OAuth credential encryption keys must be 32 bytes.');
    keys[keyId] = bytes;
  }
  return new OAuthCredentialKeyringV1({ activeKeyId, keys });
}

export function oauthCredentialSecretAadV1(
  input: Readonly<{
    credentialBindingId: string;
    workspaceId: string;
    provider: string;
    secretGeneration: number;
  }>
): string {
  return `oauth-credential-secret:v1:${input.credentialBindingId}:${input.workspaceId}:${input.provider}:${input.secretGeneration}`;
}
