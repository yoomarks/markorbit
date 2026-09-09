import { timingSafeEqual } from 'node:crypto';
import {
  AuthenticationError,
  parseInternalOperatorPrincipal,
  type InternalOperatorPrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';

export const CORE_ADMIN_READ_AUTHORITY = 'core-admin:read' as const;

export interface CoreAdministrationProjectionV1 {
  schemaVersion: 1;
  objectType: 'CORE_ADMINISTRATION_PROJECTION';
  owner: 'CORE';
  access: 'READ_ONLY';
  requiredAuthority: typeof CORE_ADMIN_READ_AUTHORITY;
  observedAt: string;
  portfolio: {
    availability: 'NOT_YET_MODELED';
    reason: string;
  };
}

export interface CoreAdminHttpOptionsV1 {
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

export function createCoreAdminRoutesV1(options: CoreAdminHttpOptionsV1): readonly JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/internal/super-admin/core',
      handle(request) {
        requireInternalService(request, options.internalServiceSecret);
        const principal = requireOperator(request);
        if (
          principal.capabilities.length !== 1 ||
          principal.capabilities[0] !== CORE_ADMIN_READ_AUTHORITY
        )
          throw new HttpError(
            403,
            'PERMISSION_DENIED',
            `Exact ${CORE_ADMIN_READ_AUTHORITY} authority is required.`
          );
        const result: CoreAdministrationProjectionV1 = {
          schemaVersion: 1,
          objectType: 'CORE_ADMINISTRATION_PROJECTION',
          owner: 'CORE',
          access: 'READ_ONLY',
          requiredAuthority: CORE_ADMIN_READ_AUTHORITY,
          observedAt: (options.now ?? (() => new Date()))().toISOString(),
          portfolio: {
            availability: 'NOT_YET_MODELED',
            reason:
              'Core does not yet expose one canonical durable platform administration portfolio for Users, Internal Operators, Sessions, Access Control, API Keys, Feature Flags and Audit; absent portfolio data is not treated as empty, zero, clean or complete.'
          }
        };
        return json(200, result);
      }
    }
  ];
}
