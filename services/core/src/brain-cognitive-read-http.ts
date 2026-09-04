import { AuthenticationError, parseInternalOperatorPrincipal } from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { validateInternalServiceSecret } from './auth.js';
import {
  BrainCognitiveReadError,
  type BrainCognitiveReadServiceV1
} from './brain-cognitive-read.js';

export interface BrainCognitiveReadHttpOptionsV1 {
  service: Pick<BrainCognitiveReadServiceV1, 'read'>;
  internalServiceSecret: string;
}

function authorize(request: JsonRequest, internalServiceSecret: string): void {
  if (
    !validateInternalServiceSecret(
      internalServiceSecret,
      request.headers['x-markorbit-internal-authorization']
    )
  )
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
  if (!(error instanceof BrainCognitiveReadError)) throw error;
  throw new HttpError(503, 'COGNITIVE_READ_SOURCE_UNAVAILABLE', error.message, true);
}

export function createBrainCognitiveReadRoutesV1(
  options: BrainCognitiveReadHttpOptionsV1
): readonly JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/internal/control-plane/cognitive',
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
