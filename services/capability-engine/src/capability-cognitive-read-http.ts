import { timingSafeEqual } from 'node:crypto';
import { AuthenticationError, parseInternalOperatorPrincipal } from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  CapabilityCognitiveReadError,
  type CapabilityCognitiveReadServiceV1
} from './capability-cognitive-read.js';

export interface CapabilityCognitiveReadHttpOptionsV1 {
  service: Pick<CapabilityCognitiveReadServiceV1, 'read'>;
  internalServiceSecret: string;
}

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function authorize(request: JsonRequest, internalServiceSecret: string): void {
  if (!trusted(internalServiceSecret, request.headers['x-markorbit-internal-authorization']))
    throw new HttpError(
      401,
      'INTERNAL_SERVICE_UNAUTHORIZED',
      'Internal service identity is invalid.'
    );

  let principal;
  try {
    principal = parseInternalOperatorPrincipal(request.headers['x-markorbit-principal']);
  } catch (error) {
    if (error instanceof AuthenticationError) throw new HttpError(401, error.code, error.message);
    throw error;
  }

  if (!(principal.capabilities as readonly string[]).includes('control-plane:cognitive:read'))
    throw new HttpError(
      403,
      'PERMISSION_DENIED',
      'control-plane:cognitive:read capability is required.'
    );
}

function translate(error: unknown): never {
  if (!(error instanceof CapabilityCognitiveReadError)) throw error;
  throw new HttpError(503, 'COGNITIVE_READ_SOURCE_UNAVAILABLE', error.message, true);
}

export function createCapabilityCognitiveReadRoutesV1(
  options: CapabilityCognitiveReadHttpOptionsV1
): readonly JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/internal/control-plane/cognitive/capabilities',
      handle: async (request) => {
        authorize(request, options.internalServiceSecret);
        try {
          return json(200, await options.service.read());
        } catch (error) {
          return translate(error);
        }
      }
    }
  ];
}
