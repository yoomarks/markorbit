import { timingSafeEqual } from 'node:crypto';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  CapabilityObservationLedgerError,
  type PostgresCapabilityObservationLedger
} from './capability-observation-ledger.js';

export interface CapabilityObservationRouteOptions {
  internalServiceSecret: string;
  ledger: PostgresCapabilityObservationLedger;
}

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function authorize(request: JsonRequest, secret: string): void {
  if (!trusted(secret, request.headers['x-markorbit-internal-authorization']))
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );
}

function idempotencyKey(request: JsonRequest): string {
  const value = request.headers['idempotency-key'];
  if (!value || !value.trim())
    throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required.');
  return value.trim();
}

function mapError(error: unknown): never {
  if (error instanceof CapabilityObservationLedgerError)
    throw new HttpError(error.status, error.code, error.message, error.retryable, error.details);
  throw error;
}

export function createCapabilityObservationRoutes(
  options: CapabilityObservationRouteOptions
): JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/capability-observations/admissions',
      handle: async (request) => {
        authorize(request, options.internalServiceSecret);
        try {
          const result = await options.ledger.admit(request.body, idempotencyKey(request));
          return json(result.replayed ? 200 : 201, result);
        } catch (error) {
          return mapError(error);
        }
      }
    }
  ];
}
