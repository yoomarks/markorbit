import type {
  CapabilityObservationSourceKind,
  CapabilityObservationSourceOwner,
  CapabilityObservationSourceReference
} from '@markorbit/contracts';

const SHA256 = /^[0-9a-f]{64}$/;

export interface CapabilityObservationSourceLocator {
  owner: CapabilityObservationSourceOwner;
  kind: CapabilityObservationSourceKind;
  sourceId: string;
  sourceVersion: string | number;
  sourceFingerprintSha256: string;
}

export interface GovernedCapabilityObservationSourceAssertion {
  source: Readonly<CapabilityObservationSourceReference>;
  subjectAttributionAuthority: 'OWNER_SOURCE' | 'CORE_PRINCIPAL_RELATIONSHIP';
}

export type CapabilityObservationSourceErrorCode =
  | 'SOURCE_NOT_ALLOWED'
  | 'SOURCE_NOT_FOUND'
  | 'SOURCE_VERSION_MISMATCH'
  | 'SOURCE_FINGERPRINT_MISMATCH'
  | 'DEPENDENCY_UNAVAILABLE';

export class CapabilityObservationSourceError extends Error {
  constructor(
    readonly code: CapabilityObservationSourceErrorCode,
    message: string,
    readonly status: number,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'CapabilityObservationSourceError';
  }
}

export interface CapabilityObservationSourceAuthority {
  verify(
    locator: Readonly<CapabilityObservationSourceLocator>
  ): Promise<GovernedCapabilityObservationSourceAssertion>;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactSourceReference(value: unknown): CapabilityObservationSourceReference {
  if (!record(value))
    throw new CapabilityObservationSourceError(
      'DEPENDENCY_UNAVAILABLE',
      'Execution returned an invalid governed source assertion.',
      503,
      true
    );
  const owner = value.owner;
  const kind = value.kind;
  const sourceId = value.sourceId;
  const sourceVersion = value.sourceVersion;
  const sourceFingerprintSha256 = value.sourceFingerprintSha256;
  const observedAt = value.observedAt;
  const workspaceId = value.workspaceId;
  const subjectUserId = value.subjectUserId;
  const correlationId = value.correlationId;
  if (
    owner !== 'EXECUTION' ||
    kind !== 'EXECUTION_EVIDENCE_REVIEW_DECISION' ||
    typeof sourceId !== 'string' ||
    !sourceId.trim() ||
    !(
      (typeof sourceVersion === 'number' && Number.isInteger(sourceVersion) && sourceVersion > 0) ||
      (typeof sourceVersion === 'string' && sourceVersion.trim())
    ) ||
    typeof sourceFingerprintSha256 !== 'string' ||
    !SHA256.test(sourceFingerprintSha256) ||
    typeof observedAt !== 'string' ||
    Number.isNaN(Date.parse(observedAt)) ||
    typeof workspaceId !== 'string' ||
    !workspaceId.trim() ||
    typeof subjectUserId !== 'string' ||
    !subjectUserId.trim() ||
    (correlationId !== undefined && (typeof correlationId !== 'string' || !correlationId.trim()))
  )
    throw new CapabilityObservationSourceError(
      'DEPENDENCY_UNAVAILABLE',
      'Execution returned an invalid governed source assertion.',
      503,
      true
    );
  return {
    owner,
    kind,
    sourceId: sourceId.trim(),
    sourceVersion,
    sourceFingerprintSha256,
    observedAt: new Date(observedAt).toISOString(),
    workspaceId: workspaceId.trim(),
    subjectUserId: subjectUserId.trim(),
    ...(correlationId ? { correlationId: correlationId.trim() } : {})
  };
}

export class HttpExecutionCapabilityObservationSourceAuthority implements CapabilityObservationSourceAuthority {
  constructor(
    private readonly executionUrl: string,
    private readonly internalServiceSecret: string,
    private readonly fetcher: typeof fetch = fetch
  ) {
    if (Buffer.byteLength(internalServiceSecret) < 32)
      throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  }

  async verify(
    locator: Readonly<CapabilityObservationSourceLocator>
  ): Promise<GovernedCapabilityObservationSourceAssertion> {
    if (locator.owner !== 'EXECUTION' || locator.kind !== 'EXECUTION_EVIDENCE_REVIEW_DECISION')
      throw new CapabilityObservationSourceError(
        'SOURCE_NOT_ALLOWED',
        'M6-WP-03 admits only Execution Evidence Review Decisions.',
        422
      );
    let response: Response;
    try {
      response = await this.fetcher(
        `${this.executionUrl.replace(/\/$/, '')}/internal/v1/capability-observation-sources/evidence-review-decisions/${encodeURIComponent(locator.sourceId)}/versions/${encodeURIComponent(String(locator.sourceVersion))}`,
        {
          method: 'GET',
          headers: {
            'x-markorbit-internal-authorization': this.internalServiceSecret,
            'x-source-fingerprint-sha256': locator.sourceFingerprintSha256
          }
        }
      );
    } catch (cause) {
      throw new CapabilityObservationSourceError(
        'DEPENDENCY_UNAVAILABLE',
        'Execution governed source authority is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    const payload = (await response.json().catch(() => undefined)) as unknown;
    if (!response.ok) {
      const error = record(payload) ? payload : {};
      const code = typeof error.code === 'string' ? error.code : undefined;
      if (response.status === 404 || code === 'GOVERNED_SOURCE_NOT_FOUND')
        throw new CapabilityObservationSourceError(
          'SOURCE_NOT_FOUND',
          'Execution governed source was not found.',
          404
        );
      if (code === 'SOURCE_VERSION_MISMATCH')
        throw new CapabilityObservationSourceError(
          'SOURCE_VERSION_MISMATCH',
          'Execution governed source version changed.',
          409
        );
      if (code === 'SOURCE_FINGERPRINT_MISMATCH')
        throw new CapabilityObservationSourceError(
          'SOURCE_FINGERPRINT_MISMATCH',
          'Execution governed source fingerprint changed.',
          409
        );
      throw new CapabilityObservationSourceError(
        'DEPENDENCY_UNAVAILABLE',
        'Execution governed source authority rejected the request unexpectedly.',
        503,
        true
      );
    }
    if (!record(payload) || !record(payload.source))
      throw new CapabilityObservationSourceError(
        'DEPENDENCY_UNAVAILABLE',
        'Execution returned an invalid governed source assertion.',
        503,
        true
      );
    const source = exactSourceReference(payload.source);
    if (
      source.owner !== locator.owner ||
      source.kind !== locator.kind ||
      source.sourceId !== locator.sourceId ||
      String(source.sourceVersion) !== String(locator.sourceVersion)
    )
      throw new CapabilityObservationSourceError(
        'SOURCE_VERSION_MISMATCH',
        'Execution source identity/version does not match the exact admission request.',
        409
      );
    if (source.sourceFingerprintSha256 !== locator.sourceFingerprintSha256)
      throw new CapabilityObservationSourceError(
        'SOURCE_FINGERPRINT_MISMATCH',
        'Execution source fingerprint does not match the exact admission request.',
        409
      );
    if (payload.subjectAttributionAuthority !== 'OWNER_SOURCE')
      throw new CapabilityObservationSourceError(
        'DEPENDENCY_UNAVAILABLE',
        'Execution did not provide owner-controlled subject attribution.',
        503,
        true
      );
    return { source, subjectAttributionAuthority: 'OWNER_SOURCE' };
  }
}
