import type { ExternalCredentialProvenanceAuthorityV1 } from './external-credential-resolution.js';

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export class HttpCapabilityProvenanceAuthorityV1 implements ExternalCredentialProvenanceAuthorityV1 {
  constructor(
    private readonly capabilityEngineUrl: string,
    private readonly internalServiceSecret: string,
    private readonly fetcher: typeof fetch = fetch
  ) {
    if (Buffer.byteLength(internalServiceSecret) < 32)
      throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  }

  async assess(
    input: Parameters<ExternalCredentialProvenanceAuthorityV1['assess']>[0]
  ): ReturnType<ExternalCredentialProvenanceAuthorityV1['assess']> {
    let response: Response;
    try {
      response = await this.fetcher(
        `${this.capabilityEngineUrl.replace(/\/$/u, '')}/internal/v1/channel-identity/provenance/currentness`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-markorbit-internal-authorization': this.internalServiceSecret
          },
          body: JSON.stringify(input)
        }
      );
    } catch {
      return { state: 'UNAVAILABLE' };
    }
    if (!response.ok) return { state: 'UNAVAILABLE' };
    const payload = record(await response.json().catch(() => undefined));
    if (!payload) return { state: 'UNAVAILABLE' };
    const allowed = new Set([
      'schemaVersion',
      'state',
      'checkedAt',
      'createsImplementationSelectionAuthority',
      'createsExecutionAuthority'
    ]);
    if (
      Object.keys(payload).some((key) => !allowed.has(key)) ||
      payload.schemaVersion !== 1 ||
      !['CURRENT', 'STALE', 'UNKNOWN', 'UNAVAILABLE'].includes(String(payload.state)) ||
      payload.createsImplementationSelectionAuthority !== false ||
      payload.createsExecutionAuthority !== false
    )
      return { state: 'UNAVAILABLE' };
    return { state: payload.state as 'CURRENT' | 'STALE' | 'UNKNOWN' | 'UNAVAILABLE' };
  }
}
