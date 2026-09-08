import { timingSafeEqual } from 'node:crypto';
import {
  AuthenticationError,
  parseInternalOperatorPrincipal,
  type InternalOperatorPrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';

export const LITE_ADMIN_READ_AUTHORITY = 'lite-admin:read' as const;

export interface LiteAdministrationProjectionV1 {
  schemaVersion: 1;
  objectType: 'LITE_ADMINISTRATION_PROJECTION';
  owner: 'LITE';
  access: 'READ_ONLY';
  requiredAuthority: typeof LITE_ADMIN_READ_AUTHORITY;
  observedAt: string;
  portfolio: {
    availability: 'NOT_YET_MODELED';
    reason: string;
  };
}

export interface LiteAdminHttpOptionsV1 {
  internalServiceSecret: string;
  now?: () => Date;
}

function requireInternalService(request: JsonRequest, configuredSecret: string): void {
  const supplied = request.headers['x-markorbit-internal-authorization'];
  if (!supplied)
    throw new HttpError(
      401,
      'INTERNAL_SERVICE_UNAUTHORIZED',
      'Internal service identity is invalid.'
    );
  const actual = Buffer.from(supplied, 'utf8');
  const expected = Buffer.from(configuredSecret, 'utf8');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new HttpError(
      401,
      'INTERNAL_SERVICE_UNAUTHORIZED',
      'Internal service identity is invalid.'
    );
}

function requireOperator(request: JsonRequest): InternalOperatorPrincipal {
  try {
    return parseInternalOperatorPrincipal(request.headers['x-markorbit-internal-principal']);
  } catch (error) {
    if (error instanceof AuthenticationError)
      throw new HttpError(
        401,
        'AUTHENTICATION_REQUIRED',
        'Internal Operator Principal is required.'
      );
    throw error;
  }
}

export function createLiteAdminRoutesV1(options: LiteAdminHttpOptionsV1): readonly JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/internal/super-admin/lite',
      handle(request) {
        requireInternalService(request, options.internalServiceSecret);
        const principal = requireOperator(request);
        if (
          principal.capabilities.length !== 1 ||
          principal.capabilities[0] !== LITE_ADMIN_READ_AUTHORITY
        )
          throw new HttpError(
            403,
            'PERMISSION_DENIED',
            `Exact ${LITE_ADMIN_READ_AUTHORITY} authority is required.`
          );
        const result: LiteAdministrationProjectionV1 = {
          schemaVersion: 1,
          objectType: 'LITE_ADMINISTRATION_PROJECTION',
          owner: 'LITE',
          access: 'READ_ONLY',
          requiredAuthority: LITE_ADMIN_READ_AUTHORITY,
          observedAt: (options.now ?? (() => new Date()))().toISOString(),
          portfolio: {
            availability: 'NOT_YET_MODELED',
            reason:
              'Lite does not yet expose one canonical durable global administration portfolio; customer Workspace routes are not elevated into platform-admin truth.'
          }
        };
        return json(200, result);
      }
    }
  ];
}
