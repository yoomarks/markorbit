export type OwnerReadFailureKind =
  'authentication' | 'permission' | 'timeout' | 'unavailable' | 'contract';

export class OwnerReadError extends Error {
  readonly kind: OwnerReadFailureKind;
  readonly status: number | undefined;
  readonly code: string | undefined;

  constructor(
    kind: OwnerReadFailureKind,
    message: string,
    options: { status?: number; code?: string } = {}
  ) {
    super(message);
    this.name = 'OwnerReadError';
    this.kind = kind;
    this.status = options.status;
    this.code = options.code;
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function ownerReadHttpError(
  owner: string,
  status: number,
  value: unknown,
  separator = ' · '
): OwnerReadError {
  const failure = record(value);
  const code = typeof failure?.code === 'string' ? failure.code : undefined;
  const detail = typeof failure?.message === 'string' ? failure.message : undefined;
  const reportsTimeout =
    code?.includes('TIMEOUT') === true || /timed?\s*out|timeout/i.test(detail ?? '');
  const suffix = code ? `${separator}${code}` : '';
  const kind: OwnerReadFailureKind =
    status === 401
      ? 'authentication'
      : status === 403
        ? 'permission'
        : status === 408 || status === 504 || reportsTimeout
          ? 'timeout'
          : 'unavailable';
  return new OwnerReadError(kind, `${owner} unavailable (${status}${suffix}).`, {
    status,
    ...(code ? { code } : {})
  });
}
