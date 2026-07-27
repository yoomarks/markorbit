import type { SafeError } from '@markorbit/contracts';

export type MarkregErrorKind = 'recoverable' | 'blocking' | 'validation' | 'conflict' | 'offline';

export class MarkregApiError extends Error {
  constructor(
    public readonly kind: MarkregErrorKind,
    message: string,
    public readonly correlationId?: string
  ) {
    super(message);
    this.name = 'MarkregApiError';
  }
}

export function safeErrorMessage(status: number, error?: Partial<SafeError>): MarkregApiError {
  const reference = error?.correlationId;
  if (status === 409)
    return new MarkregApiError(
      'conflict',
      'This submission key was already used for different information. Review your details and submit again.',
      reference
    );
  if (status === 400 || status === 422)
    return new MarkregApiError(
      'validation',
      status === 422
        ? 'These details cannot be processed yet. Return to the intake and update them.'
        : 'Some submitted details are incomplete or invalid. Please review them.',
      reference
    );
  if (status === 502 || error?.retryable)
    return new MarkregApiError(
      'recoverable',
      'The recommendation service is temporarily unavailable. Your answers are safe; try again.',
      reference
    );
  return new MarkregApiError(
    'blocking',
    'We could not complete this request safely. Please start a new consultation or contact support.',
    reference
  );
}
