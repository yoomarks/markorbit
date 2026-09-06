import {
  AuthenticationError,
  CONTROL_PLANE_CAPABILITIES,
  type ControlPlaneCapability
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { validateInternalServiceSecret } from './auth.js';
import type { InternalOperatorPrincipalResolverV1 } from './internal-operator-principal.js';

export interface InternalOperatorPrincipalHttpOptionsV1 {
  resolver: Pick<InternalOperatorPrincipalResolverV1, 'resolve'>;
  internalServiceSecret: string;
}

type ResolutionRequest = Readonly<{
  token: string;
  requiredCapability?: ControlPlaneCapability;
}>;

function resolutionRequest(request: JsonRequest): ResolutionRequest {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  const body = request.body as Record<string, unknown>;
  const keys = Object.keys(body);
  if (
    !keys.every((key) => ['token', 'requiredCapability'].includes(key)) ||
    keys.length < 1 ||
    keys.length > 2 ||
    typeof body.token !== 'string' ||
    !body.token
  )
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'Request body must contain token and may contain one requiredCapability.'
    );
  if (
    body.requiredCapability !== undefined &&
    !(CONTROL_PLANE_CAPABILITIES as readonly unknown[]).includes(body.requiredCapability)
  )
    throw new HttpError(400, 'INVALID_REQUEST', 'Required Control Plane capability is invalid.');
  return {
    token: body.token,
    ...(body.requiredCapability === undefined
      ? {}
      : { requiredCapability: body.requiredCapability as ControlPlaneCapability })
  };
}

function translate(error: unknown): never {
  if (!(error instanceof AuthenticationError)) throw error;
  const status =
    error.code === 'AUTHENTICATION_SERVICE_UNAVAILABLE'
      ? 503
      : error.code === 'PERMISSION_DENIED'
        ? 403
        : 401;
  throw new HttpError(status, error.code, error.message, status === 503);
}

export function createInternalOperatorPrincipalRoutesV1(
  options: InternalOperatorPrincipalHttpOptionsV1
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/control-plane/operator-principals/resolve',
      async handle(request) {
        if (
          !validateInternalServiceSecret(
            options.internalServiceSecret,
            request.headers['x-markorbit-internal-authorization']
          )
        )
          throw new HttpError(
            401,
            'INTERNAL_SERVICE_UNAUTHORIZED',
            'Internal service identity is invalid.'
          );
        const input = resolutionRequest(request);
        try {
          return json(
            200,
            input.requiredCapability
              ? await options.resolver.resolve(input.token, input.requiredCapability)
              : await options.resolver.resolve(input.token)
          );
        } catch (error) {
          return translate(error);
        }
      }
    }
  ];
}
