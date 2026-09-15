import {
  parseInternalOperatorPrincipal,
  type CommercialOfferVersionV1,
  type RatePolicyVersionV1
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { validateInternalServiceSecret } from './auth.js';
import {
  CurrentWorkspaceAuthorityError,
  type CurrentWorkspaceAuthorityService
} from './current-workspace-authority.js';
import {
  WorkspaceCommercialError,
  type WorkspaceCommercialServiceV1
} from './workspace-commercial.js';

export interface WorkspaceCommercialHttpOptionsV1 {
  service: Pick<
    WorkspaceCommercialServiceV1,
    'listCurrentInstallations' | 'resolveEntitlement' | 'recordOffer' | 'recordRatePolicy'
  >;
  currentWorkspaceAuthority: Pick<CurrentWorkspaceAuthorityService, 'validate'>;
  internalServiceSecret: string;
  now?: () => Date;
}

function internal(request: JsonRequest, secret: string): void {
  if (!validateInternalServiceSecret(secret, request.headers['x-markorbit-internal-authorization']))
    throw new HttpError(
      401,
      'INTERNAL_SERVICE_UNAUTHORIZED',
      'Internal service identity is invalid.'
    );
}

function object(request: JsonRequest): Record<string, unknown> {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Record<string, unknown>;
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new HttpError(400, 'INVALID_REQUEST', `${field} is required.`);
  return value;
}

function expected(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be a positive integer.`);
  return Number(value);
}

async function authorizeWorkspaceRead(
  request: JsonRequest,
  options: WorkspaceCommercialHttpOptionsV1,
  body: Record<string, unknown>
): Promise<{ workspaceId: string; userId: string }> {
  internal(request, options.internalServiceSecret);
  const workspaceId = text(request.params.workspaceId, 'workspaceId');
  const userId = text(body.userId, 'userId');
  try {
    const expectedWorkspaceVersion = expected(
      body.expectedWorkspaceVersion,
      'expectedWorkspaceVersion'
    );
    const expectedUserVersion = expected(body.expectedUserVersion, 'expectedUserVersion');
    const expectedMembershipVersion = expected(
      body.expectedMembershipVersion,
      'expectedMembershipVersion'
    );
    await options.currentWorkspaceAuthority.validate({
      workspaceId,
      userId,
      membershipId: text(body.membershipId, 'membershipId'),
      ...(expectedWorkspaceVersion === undefined ? {} : { expectedWorkspaceVersion }),
      ...(expectedUserVersion === undefined ? {} : { expectedUserVersion }),
      ...(expectedMembershipVersion === undefined ? {} : { expectedMembershipVersion }),
      requiredPermission: 'workspace:read'
    });
  } catch (error) {
    if (error instanceof CurrentWorkspaceAuthorityError)
      throw new HttpError(error.status, error.code, error.message, error.retryable);
    throw error;
  }
  return { workspaceId, userId };
}

function authorizeCommercialAdmin(
  request: JsonRequest,
  options: WorkspaceCommercialHttpOptionsV1
): void {
  internal(request, options.internalServiceSecret);
  let principal;
  try {
    principal = parseInternalOperatorPrincipal(request.headers['x-markorbit-principal']);
  } catch {
    throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Internal Operator principal is invalid.');
  }
  if (
    principal.capabilities.length !== 1 ||
    principal.capabilities[0] !== 'commercial-admin:operate'
  )
    throw new HttpError(
      403,
      'PERMISSION_DENIED',
      'Exact commercial-admin:operate authority is required.'
    );
  if (Date.parse(principal.sessionExpiresAt) <= (options.now ?? (() => new Date()))().valueOf())
    throw new HttpError(401, 'SESSION_EXPIRED', 'Internal Operator session is expired.');
}

function translate(error: unknown): never {
  if (!(error instanceof WorkspaceCommercialError)) throw error;
  const status =
    error.code === 'NOT_FOUND' || error.code.startsWith('NO_')
      ? 404
      : error.code === 'INVALID_INPUT'
        ? 400
        : error.code === 'MEMBERSHIP_REQUIRED'
          ? 403
          : 409;
  throw new HttpError(status, error.code, error.message);
}

export function createWorkspaceCommercialRoutesV1(
  options: WorkspaceCommercialHttpOptionsV1
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/workspaces/:workspaceId/commercial/installations/read',
      async handle(request) {
        const body = object(request);
        const { workspaceId } = await authorizeWorkspaceRead(request, options, body);
        return json(200, {
          schemaVersion: 1,
          workspaceId,
          installations: await options.service.listCurrentInstallations(workspaceId)
        });
      }
    },
    {
      method: 'POST',
      path: '/internal/workspaces/:workspaceId/commercial/entitlements/resolve',
      async handle(request) {
        const body = object(request);
        const authority = await authorizeWorkspaceRead(request, options, body);
        const subjectScope = body.subjectScope;
        if (subjectScope !== 'USER' && subjectScope !== 'WORKSPACE')
          throw new HttpError(400, 'INVALID_REQUEST', 'subjectScope must be USER or WORKSPACE.');
        try {
          const subject =
            subjectScope === 'USER'
              ? { scope: 'USER' as const, userId: authority.userId }
              : { scope: 'WORKSPACE' as const, workspaceId: authority.workspaceId };
          return json(
            200,
            await options.service.resolveEntitlement(
              subject,
              text(body.entitlementKey, 'entitlementKey'),
              text(body.asOf, 'asOf')
            )
          );
        } catch (error) {
          return translate(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/internal/commercial/offers',
      async handle(request) {
        authorizeCommercialAdmin(request, options);
        try {
          return json(
            201,
            await options.service.recordOffer(
              object(request) as unknown as CommercialOfferVersionV1
            )
          );
        } catch (error) {
          return translate(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/internal/commercial/rate-policies',
      async handle(request) {
        authorizeCommercialAdmin(request, options);
        try {
          return json(
            201,
            await options.service.recordRatePolicy(
              object(request) as unknown as RatePolicyVersionV1
            )
          );
        } catch (error) {
          return translate(error);
        }
      }
    }
  ];
}
