import {
  decryptCredentialTextV1,
  encryptCredentialTextV1,
  type EncryptedCredentialEnvelopeV1
} from './credential-crypto.js';

export type ExternalCredentialSecretMaterialV1 =
  | Readonly<{ kind: 'API_KEY'; keyId?: string; secret: string }>
  | Readonly<{ kind: 'STATIC_BEARER'; token: string }>
  | Readonly<{ kind: 'BASIC'; username: string; password: string }>;
export type EncryptedExternalCredentialSecretV1 = EncryptedCredentialEnvelopeV1;

export class ExternalCredentialCryptoError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ExternalCredentialCryptoError';
  }
}

function exactText(value: unknown, field: string, maximum = 20_000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum)
    throw new ExternalCredentialCryptoError(`${field} is invalid.`);
  return value;
}
function material(value: unknown): ExternalCredentialSecretMaterialV1 {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new ExternalCredentialCryptoError('External credential secret payload is invalid.');
  const item = value as Record<string, unknown>;
  if (item.kind === 'API_KEY') {
    if (Object.keys(item).some((key) => !['kind', 'keyId', 'secret'].includes(key)))
      throw new ExternalCredentialCryptoError('API key payload contains unsupported fields.');
    const keyId = item.keyId === undefined ? undefined : exactText(item.keyId, 'API key id', 2_000);
    return {
      kind: 'API_KEY',
      ...(keyId ? { keyId } : {}),
      secret: exactText(item.secret, 'API key secret')
    };
  }
  if (item.kind === 'STATIC_BEARER') {
    if (Object.keys(item).some((key) => !['kind', 'token'].includes(key)))
      throw new ExternalCredentialCryptoError('Static bearer payload contains unsupported fields.');
    return { kind: 'STATIC_BEARER', token: exactText(item.token, 'Static bearer token') };
  }
  if (item.kind === 'BASIC') {
    if (Object.keys(item).some((key) => !['kind', 'username', 'password'].includes(key)))
      throw new ExternalCredentialCryptoError(
        'Basic credential payload contains unsupported fields.'
      );
    return {
      kind: 'BASIC',
      username: exactText(item.username, 'Basic username', 2_000),
      password: exactText(item.password, 'Basic password')
    };
  }
  throw new ExternalCredentialCryptoError('External credential secret kind is invalid.');
}
function keyId(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 120)
    throw new ExternalCredentialCryptoError('External credential key id is invalid.');
  return normalized;
}

export class ExternalCredentialKeyringV1 {
  private readonly keys: ReadonlyMap<string, Buffer>;
  readonly activeKeyId: string;
  constructor(
    input: Readonly<{ activeKeyId: string; keys: Readonly<Record<string, Uint8Array>> }>
  ) {
    this.activeKeyId = keyId(input.activeKeyId);
    this.keys = new Map(
      Object.entries(input.keys).map(([id, value]) => {
        const normalized = keyId(id);
        const bytes = Buffer.from(value);
        if (bytes.byteLength !== 32)
          throw new ExternalCredentialCryptoError(
            'External credential encryption keys must be 32 bytes.'
          );
        return [normalized, bytes] as const;
      })
    );
    if (!this.keys.has(this.activeKeyId))
      throw new ExternalCredentialCryptoError(
        'Active external credential encryption key is unavailable.'
      );
  }

  encrypt(
    value: Readonly<ExternalCredentialSecretMaterialV1>,
    aad: string
  ): EncryptedExternalCredentialSecretV1 {
    return encryptCredentialTextV1(
      this.activeKeyId,
      this.keys.get(this.activeKeyId)!,
      JSON.stringify(material(value)),
      aad
    );
  }
  decrypt(
    secret: Readonly<EncryptedExternalCredentialSecretV1>,
    aad: string
  ): ExternalCredentialSecretMaterialV1 {
    const key = this.keys.get(secret.keyId);
    if (!key)
      throw new ExternalCredentialCryptoError('External credential decryption key is unavailable.');
    try {
      return material(JSON.parse(decryptCredentialTextV1(key, secret, aad)));
    } catch (cause) {
      if (cause instanceof ExternalCredentialCryptoError) throw cause;
      throw new ExternalCredentialCryptoError(
        'External credential secret could not be decrypted.',
        {
          cause: cause instanceof Error ? cause : undefined
        }
      );
    }
  }
}

export function createExternalCredentialKeyringFromEnvironmentV1(
  env: NodeJS.ProcessEnv = process.env
): ExternalCredentialKeyringV1 {
  const activeKeyId = env.MO_CORE_EXTERNAL_CREDENTIAL_ACTIVE_KEY_ID;
  const encodedKeys = env.MO_CORE_EXTERNAL_CREDENTIAL_KEYS_JSON;
  if (!activeKeyId || !encodedKeys)
    throw new ExternalCredentialCryptoError(
      'External credential encryption keyring is not configured.'
    );
  let parsed: unknown;
  try {
    parsed = JSON.parse(encodedKeys);
  } catch (cause) {
    throw new ExternalCredentialCryptoError('External credential encryption keyring is invalid.', {
      cause: cause instanceof Error ? cause : undefined
    });
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    throw new ExternalCredentialCryptoError('External credential encryption keyring is invalid.');
  const keys: Record<string, Uint8Array> = {};
  for (const [id, encoded] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof encoded !== 'string')
      throw new ExternalCredentialCryptoError('External credential encryption keyring is invalid.');
    keys[id] = Buffer.from(encoded, 'base64');
  }
  return new ExternalCredentialKeyringV1({ activeKeyId, keys });
}

export function externalCredentialSecretAadV1(
  input: Readonly<{
    credentialBindingId: string;
    workspaceId: string;
    provider: string;
    secretKind: string;
    secretGeneration: number;
  }>
): string {
  return `external-credential-secret:v1:${input.credentialBindingId}:${input.workspaceId}:${input.provider}:${input.secretKind}:${input.secretGeneration}`;
}
