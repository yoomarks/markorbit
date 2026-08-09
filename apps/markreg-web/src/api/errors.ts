import type { SafeError } from '@markorbit/contracts';

export type MarkregErrorKind = 'recoverable' | 'blocking' | 'validation' | 'conflict' | 'offline';

export class MarkregApiError extends Error {
  constructor(
    public readonly kind: MarkregErrorKind,
    message: string,
    public readonly correlationId?: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'MarkregApiError';
  }
}

export function safeErrorMessage(status: number, error?: Partial<SafeError>): MarkregApiError {
  const reference = error?.correlationId;
  const code = error?.code;
  if (status === 403)
    return new MarkregApiError(
      'blocking',
      'You do not have permission to change this Matter Draft.',
      reference,
      code
    );
  if (status === 404)
    return new MarkregApiError(
      'blocking',
      'This Matter Draft was not found in the current Workspace.',
      reference,
      code
    );
  if (status === 503)
    return new MarkregApiError(
      'recoverable',
      'Matter preparation is temporarily unavailable. Your saved Draft is unchanged.',
      reference,
      code
    );
  if (status === 409)
    return new MarkregApiError(
      'conflict',
      error?.code?.includes('STALE')
        ? 'This Matter Draft changed in another session. Reload the saved version before editing again.'
        : 'This submission key was already used for different information. Review your details and submit again.',
      reference,
      code
    );
  if (status === 400 || status === 422)
    return new MarkregApiError(
      'validation',
      status === 422
        ? 'These details cannot be processed yet. Return to the intake and update them.'
        : 'Some submitted details are incomplete or invalid. Please review them.',
      reference,
      code
    );
  if (status === 502 || error?.retryable)
    return new MarkregApiError(
      'recoverable',
      'The recommendation service is temporarily unavailable. Your answers are safe; try again.',
      reference,
      code
    );
  return new MarkregApiError(
    'blocking',
    'We could not complete this request safely. Please start a new consultation or contact support.',
    reference,
    code
  );
}
