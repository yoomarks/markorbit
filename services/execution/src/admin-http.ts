import { timingSafeEqual } from 'node:crypto';
import {
  AuthenticationError,
  parseInternalOperatorPrincipal,
  type InternalOperatorPrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';

export const EXECUTION_ADMIN_READ_AUTHORITY = 'execution-admin:read' as const;

export interface ExecutionAdministrationProjectionV1 {
  schemaVersion: 1;
  objectType: 'EXECUTION_ADMINISTRATION_PROJECTION';
  owner: 'EXECUTION';
  access: 'READ_ONLY';
  requiredAuthority: typeof EXECUTION_ADMIN_READ_AUTHORITY;
  observedAt: string;
  portfolio: {
    availability: 'NOT_YET_MODELED';
    reason: string;
  };
}

export interface ExecutionAdminHttpOptionsV1 {
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

export function createExecutionAdminRoutesV1(
  options: ExecutionAdminHttpOptionsV1
): readonly JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/internal/super-admin/execution',
      handle(request) {
        requireInternalService(request, options.internalServiceSecret);
        const principal = requireOperator(request);
        if (
          principal.capabilities.length !== 1 ||
          principal.capabilities[0] !== EXECUTION_ADMIN_READ_AUTHORITY
        )
          throw new HttpError(
            403,
            'PERMISSION_DENIED',
            `Exact ${EXECUTION_ADMIN_READ_AUTHORITY} authority is required.`
          );
        const result: ExecutionAdministrationProjectionV1 = {
          schemaVersion: 1,
          objectType: 'EXECUTION_ADMINISTRATION_PROJECTION',
          owner: 'EXECUTION',
          access: 'READ_ONLY',
          requiredAuthority: EXECUTION_ADMIN_READ_AUTHORITY,
          observedAt: (options.now ?? (() => new Date()))().toISOString(),
          portfolio: {
            availability: 'NOT_YET_MODELED',
            reason:
              'Execution does not yet expose one canonical durable global administration portfolio; Workspace-scoped authorization, plan, release, readiness and provider execution records are not elevated into platform-admin truth.'
          }
        };
        return json(200, result);
      }
    }
  ];
}
