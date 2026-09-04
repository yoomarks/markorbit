import {
  USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
  type OfficialFeeReferenceReaderQueryV1,
  type OfficialFeeReferenceReaderV1
} from './uspto-official-fee-resolver-pilot.js';

export type OfficialFeeReferenceReaderErrorCode =
  | 'INVALID_QUERY'
  | 'NO_CURRENT_REFERENCE'
  | 'AMBIGUOUS_CURRENT_REFERENCE'
  | 'DEPENDENCY_UNAVAILABLE';

export class OfficialFeeReferenceReaderError extends Error {
  constructor(
    readonly code: OfficialFeeReferenceReaderErrorCode,
    message: string,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'OfficialFeeReferenceReaderError';
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function validateQuery(query: Readonly<OfficialFeeReferenceReaderQueryV1>): void {
  if (
    query.operation !== USPTO_OFFICIAL_FEE_RESOLVER_OPERATION ||
    query.jurisdiction !== 'US' ||
    query.authority !== 'USPTO' ||
    typeof query.asOf !== 'string' ||
    !query.asOf.trim() ||
    query.asOf !== query.asOf.trim() ||
    Number.isNaN(Date.parse(query.asOf))
  )
    throw new OfficialFeeReferenceReaderError(
      'INVALID_QUERY',
      'Only the exact bounded USPTO official-fee current-reference query is supported.'
    );
}

export class HttpCoreOfficialFeeReferenceReaderV1 implements OfficialFeeReferenceReaderV1 {
  constructor(
    private readonly coreUrl: string,
    private readonly internalServiceSecret: string,
    private readonly fetcher: typeof fetch = fetch
  ) {
    if (Buffer.byteLength(internalServiceSecret) < 32)
      throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  }

  async resolveCurrent(query: Readonly<OfficialFeeReferenceReaderQueryV1>): Promise<unknown> {
    validateQuery(query);
    let response: Response;
    try {
      response = await this.fetcher(
        `${this.coreUrl.replace(/\/$/, '')}/internal/v1/official-fee-references/current`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-markorbit-internal-authorization': this.internalServiceSecret
          },
          body: JSON.stringify(query)
        }
      );
    } catch (cause) {
      throw new OfficialFeeReferenceReaderError(
        'DEPENDENCY_UNAVAILABLE',
        'Core Official Fee Reference authority is unavailable.',
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }

    const payload = (await response.json().catch(() => undefined)) as unknown;
    if (response.ok) {
      if (!record(payload))
        throw new OfficialFeeReferenceReaderError(
          'DEPENDENCY_UNAVAILABLE',
          'Core returned an invalid Official Fee Reference response.',
          false
        );
      return payload;
    }

    const error = record(payload);
    const code = typeof error?.code === 'string' ? error.code : undefined;
    if (response.status === 404 && code === 'NO_CURRENT_REFERENCE')
      throw new OfficialFeeReferenceReaderError(
        'NO_CURRENT_REFERENCE',
        'Core has no current Official Fee Reference for the requested instant.'
      );
    if (response.status === 409 && code === 'AMBIGUOUS_CURRENT_REFERENCE')
      throw new OfficialFeeReferenceReaderError(
        'AMBIGUOUS_CURRENT_REFERENCE',
        'Core reported ambiguous current Official Fee References.'
      );
    if (response.status === 400)
      throw new OfficialFeeReferenceReaderError(
        'INVALID_QUERY',
        'Core rejected the bounded Official Fee Reference query.'
      );
    throw new OfficialFeeReferenceReaderError(
      'DEPENDENCY_UNAVAILABLE',
      'Core Official Fee Reference authority rejected the request unexpectedly.',
      response.status >= 500
    );
  }
}
