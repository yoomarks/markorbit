import { AuthenticationError } from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { validateInternalServiceSecret } from './auth.js';
import type { InternalOperatorPrincipalResolverV1 } from './internal-operator-principal.js';

export interface InternalOperatorPrincipalHttpOptionsV1 {
  resolver: Pick<InternalOperatorPrincipalResolverV1, 'resolve'>;
  internalServiceSecret: string;
}

function token(request: JsonRequest): string {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  const body = request.body as Record<string, unknown>;
  if (Object.keys(body).length !== 1 || typeof body.token !== 'string' || !body.token)
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must contain only token.');
  return body.token;
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
        try {
          return json(200, await options.resolver.resolve(token(request)));
        } catch (error) {
          return translate(error);
        }
      }
    }
  ];
}
