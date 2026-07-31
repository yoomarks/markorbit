export type PersistenceErrorCode =
  | 'INVALID_DATABASE_CONFIGURATION'
  | 'DATABASE_UNAVAILABLE'
  | 'DATABASE_TIMEOUT'
  | 'MIGRATION_LOCK_UNAVAILABLE'
  | 'MIGRATION_CHECKSUM_MISMATCH'
  | 'MIGRATION_EXECUTION_FAILED'
  | 'TRANSACTION_BEGIN_FAILED'
  | 'TRANSACTION_COMMIT_FAILED'
  | 'TRANSACTION_ROLLBACK_FAILED'
  | 'CONSTRAINT_VIOLATION';

export class PersistenceError extends Error {
  constructor(
    public readonly code: PersistenceErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'PersistenceError';
  }
}

export function redactSecrets(value: string): string {
  return value
    .replace(/(postgres(?:ql)?:\/\/[^:/.\s]+:)[^@/\s]+@/giu, '$1[REDACTED]@')
    .replace(/((?:password|secret|token)\s*[=:]\s*)[^\s,;]+/giu, '$1[REDACTED]');
}

export function normalizeDatabaseError(error: unknown): PersistenceError {
  if (error instanceof PersistenceError) return error;
  const candidate = error as { code?: string; message?: string };
  const cause = error instanceof Error ? error : undefined;
  if (candidate.code === '57014')
    return new PersistenceError('DATABASE_TIMEOUT', 'The database operation timed out.', { cause });
  if (candidate.code?.startsWith('23'))
    return new PersistenceError('CONSTRAINT_VIOLATION', 'A database constraint was violated.', {
      cause
    });
  return new PersistenceError('DATABASE_UNAVAILABLE', 'The database is unavailable.', { cause });
}
