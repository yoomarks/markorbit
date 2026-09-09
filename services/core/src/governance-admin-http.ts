import { timingSafeEqual } from 'node:crypto';
import {
  AuthenticationError,
  parseInternalOperatorPrincipal,
  type InternalOperatorPrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';

export const GOVERNANCE_ADMIN_READ_AUTHORITY = 'governance-admin:read' as const;

export interface GovernanceAdministrationProjectionV1 {
  schemaVersion: 1;
  objectType: 'GOVERNANCE_ADMINISTRATION_PROJECTION';
  owner: 'CORE_CONTROL_PLANE';
  access: 'READ_ONLY';
  requiredAuthority: typeof GOVERNANCE_ADMIN_READ_AUTHORITY;
  observedAt: string;
  portfolio: {
    availability: 'NOT_YET_MODELED';
    reason: string;
  };
}

export interface GovernanceAdminHttpOptionsV1 {
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

export function createGovernanceAdminRoutesV1(
  options: GovernanceAdminHttpOptionsV1
): readonly JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/internal/super-admin/governance',
      handle(request) {
        requireInternalService(request, options.internalServiceSecret);
        const principal = requireOperator(request);
        if (
          principal.capabilities.length !== 1 ||
          principal.capabilities[0] !== GOVERNANCE_ADMIN_READ_AUTHORITY
        )
          throw new HttpError(
            403,
            'PERMISSION_DENIED',
            `Exact ${GOVERNANCE_ADMIN_READ_AUTHORITY} authority is required.`
          );
        const result: GovernanceAdministrationProjectionV1 = {
          schemaVersion: 1,
          objectType: 'GOVERNANCE_ADMINISTRATION_PROJECTION',
          owner: 'CORE_CONTROL_PLANE',
          access: 'READ_ONLY',
          requiredAuthority: GOVERNANCE_ADMIN_READ_AUTHORITY,
          observedAt: (options.now ?? (() => new Date()))().toISOString(),
          portfolio: {
            availability: 'NOT_YET_MODELED',
            reason:
              'Core control-plane does not yet expose one canonical durable cross-owner Governance and Audit administration portfolio; owner-specific audit and provenance remain scoped and are not aggregated into platform completeness, cleanliness or risk truth.'
          }
        };
        return json(200, result);
      }
    }
  ];
}
