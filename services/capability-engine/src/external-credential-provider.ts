import type {
  ExternalCredentialResolutionRequestWireV1,
  ResolvedExternalCredentialWireV1
} from '@markorbit/service-kit';

export type ExternalCredentialConsumerV1<T> = (
  secret: Readonly<ResolvedExternalCredentialWireV1['secret']>
) => Promise<T>;

export type ExternalCredentialProviderErrorCode =
  | 'INVALID_RESOLUTION_RESPONSE'
  | 'CREDENTIAL_RESOLUTION_DENIED'
  | 'CREDENTIAL_RESOLUTION_UNAVAILABLE';

export class ExternalCredentialProviderError extends Error {
  constructor(
    readonly code: ExternalCredentialProviderErrorCode,
    message: string,
    readonly retryable = false
  ) {
    super(message);
    this.name = 'ExternalCredentialProviderError';
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function exact(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === allowed.length && keys.every((key) => allowed.includes(key));
}

function secret(value: unknown): ResolvedExternalCredentialWireV1['secret'] {
  const item = record(value);
  if (!item) throw invalid();
  if (item.kind === 'API_KEY') {
    if (!exact(item, item.keyId === undefined ? ['kind', 'secret'] : ['kind', 'keyId', 'secret']))
      throw invalid();
    if (
      typeof item.secret !== 'string' ||
      !item.secret ||
      (item.keyId !== undefined && (typeof item.keyId !== 'string' || !item.keyId))
    )
      throw invalid();
    return Object.freeze({
      kind: 'API_KEY' as const,
      ...(item.keyId === undefined ? {} : { keyId: item.keyId }),
      secret: item.secret
    });
  }
  if (item.kind === 'STATIC_BEARER') {
    if (!exact(item, ['kind', 'token']) || typeof item.token !== 'string' || !item.token)
      throw invalid();
    return Object.freeze({ kind: 'STATIC_BEARER' as const, token: item.token });
  }
  if (item.kind === 'BASIC') {
    if (
      !exact(item, ['kind', 'username', 'password']) ||
      typeof item.username !== 'string' ||
      !item.username ||
      typeof item.password !== 'string' ||
      !item.password
    )
      throw invalid();
    return Object.freeze({
      kind: 'BASIC' as const,
      username: item.username,
      password: item.password
    });
  }
  throw invalid();
}

function invalid(): ExternalCredentialProviderError {
  return new ExternalCredentialProviderError(
    'INVALID_RESOLUTION_RESPONSE',
    'Core returned an invalid external credential resolution response.'
  );
}

export class CoreBackedExternalCredentialProviderV1 {
  constructor(
    private readonly coreUrl: string,
    private readonly internalServiceSecret: string,
    private readonly fetcher: typeof fetch = fetch
  ) {
    if (Buffer.byteLength(internalServiceSecret) < 32)
      throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  }

  async withCredential<T>(
    request: Readonly<ExternalCredentialResolutionRequestWireV1>,
    consume: ExternalCredentialConsumerV1<T>
  ): Promise<T> {
    let response: Response;
    try {
      response = await this.fetcher(
        `${this.coreUrl.replace(/\/$/u, '')}/internal/v1/external-credentials/resolve`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-markorbit-internal-authorization': this.internalServiceSecret
          },
          body: JSON.stringify(request)
        }
      );
    } catch {
      throw new ExternalCredentialProviderError(
        'CREDENTIAL_RESOLUTION_UNAVAILABLE',
        'Core external credential resolution is unavailable.',
        true
      );
    }
    if (!response.ok) {
      throw new ExternalCredentialProviderError(
        response.status >= 500
          ? 'CREDENTIAL_RESOLUTION_UNAVAILABLE'
          : 'CREDENTIAL_RESOLUTION_DENIED',
        'Core external credential resolution was denied.',
        response.status >= 500
      );
    }
    const payload = record(await response.json().catch(() => undefined));
    if (
      !payload ||
      !exact(payload, [
        'schemaVersion',
        'credentialBindingId',
        'bindingVersion',
        'secret',
        'createsProviderSelectionAuthority',
        'createsImplementationSelectionAuthority',
        'createsExecutionAuthority',
        'authorizesProtectedAction'
      ]) ||
      payload.schemaVersion !== 1 ||
      payload.credentialBindingId !== request.credential.credentialBindingId ||
      payload.bindingVersion !== request.credential.version ||
      payload.createsProviderSelectionAuthority !== false ||
      payload.createsImplementationSelectionAuthority !== false ||
      payload.createsExecutionAuthority !== false ||
      payload.authorizesProtectedAction !== false
    )
      throw invalid();
    let material: ResolvedExternalCredentialWireV1['secret'] | undefined = secret(payload.secret);
    if (material.kind !== request.expectedSecretKind) throw invalid();
    try {
      return await consume(material);
    } finally {
      material = undefined;
    }
  }
}
