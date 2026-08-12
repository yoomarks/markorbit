import { timingSafeEqual } from 'node:crypto';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  PrivateReflectionCandidateError,
  type PostgresPrivateReflectionCandidateService
} from './private-reflection-candidate.js';

export interface PrivateReflectionCandidateRouteOptions {
  internalServiceSecret: string;
  reflections: PostgresPrivateReflectionCandidateService;
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
  if (error instanceof PrivateReflectionCandidateError)
    throw new HttpError(error.status, error.code, error.message, error.retryable, error.details);
  throw error;
}

export function createPrivateReflectionCandidateRoutes(
  options: PrivateReflectionCandidateRouteOptions
): JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/reflection-candidates/generations',
      handle: async (request) => {
        authorize(request, options.internalServiceSecret);
        try {
          const result = await options.reflections.generate(request.body, idempotencyKey(request));
          return json(result.replayed ? 200 : 201, result);
        } catch (error) {
          return mapError(error);
        }
      }
    }
  ];
}
