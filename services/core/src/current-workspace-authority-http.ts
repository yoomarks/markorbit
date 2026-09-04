import { PERMISSIONS, type Permission } from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { validateInternalServiceSecret } from './auth.js';
import {
  CurrentWorkspaceAuthorityError,
  type CurrentWorkspaceAuthorityRequest,
  type CurrentWorkspaceAuthorityService
} from './current-workspace-authority.js';

export interface CurrentWorkspaceAuthorityHttpOptions {
  internalServiceSecret: string;
  service: Pick<CurrentWorkspaceAuthorityService, 'validate'>;
}

const allowedKeys = new Set([
  'workspaceId',
  'userId',
  'membershipId',
  'expectedWorkspaceVersion',
  'expectedUserVersion',
  'expectedMembershipVersion',
  'requiredPermission'
]);

function requestBody(request: JsonRequest): CurrentWorkspaceAuthorityRequest {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_CURRENT_AUTHORITY_REQUEST', 'Request body must be an object.');
  const value = request.body as Record<string, unknown>;
  if (Object.keys(value).some((key) => !allowedKeys.has(key)))
    throw new HttpError(
      400,
      'INVALID_CURRENT_AUTHORITY_REQUEST',
      'Only bounded current authority references may be supplied.'
    );
  if (
    typeof value.workspaceId !== 'string' ||
    typeof value.userId !== 'string' ||
    typeof value.membershipId !== 'string'
  )
    throw new HttpError(
      400,
      'INVALID_CURRENT_AUTHORITY_REQUEST',
      'workspaceId, userId and membershipId are required.'
    );
  for (const key of [
    'expectedWorkspaceVersion',
    'expectedUserVersion',
    'expectedMembershipVersion'
  ] as const)
    if (value[key] !== undefined && typeof value[key] !== 'number')
      throw new HttpError(
        400,
        'INVALID_CURRENT_AUTHORITY_REQUEST',
        `${key} must be a number when supplied.`
      );
  if (
    value.requiredPermission !== undefined &&
    (typeof value.requiredPermission !== 'string' ||
      !(PERMISSIONS as readonly string[]).includes(value.requiredPermission))
  )
    throw new HttpError(
      400,
      'INVALID_CURRENT_AUTHORITY_REQUEST',
      'requiredPermission must name an existing Core permission when supplied.'
    );
  return {
    workspaceId: value.workspaceId,
    userId: value.userId,
    membershipId: value.membershipId,
    ...(value.expectedWorkspaceVersion === undefined
      ? {}
      : { expectedWorkspaceVersion: value.expectedWorkspaceVersion as number }),
    ...(value.expectedUserVersion === undefined
      ? {}
      : { expectedUserVersion: value.expectedUserVersion as number }),
    ...(value.expectedMembershipVersion === undefined
      ? {}
      : { expectedMembershipVersion: value.expectedMembershipVersion as number }),
    ...(value.requiredPermission === undefined
      ? {}
      : { requiredPermission: value.requiredPermission as Permission })
  };
}

function authenticated(request: JsonRequest, configured: string) {
  if (!validateInternalServiceSecret(configured, request.headers['x-markorbit-internal-authorization']))
    throw new HttpError(
      401,
      'INTERNAL_SERVICE_UNAUTHORIZED',
      'Internal service identity is invalid.'
    );
}

export function createCurrentWorkspaceAuthorityRoutes(
  options: CurrentWorkspaceAuthorityHttpOptions
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/auth/workspace-authority/validate-current',
      async handle(request) {
        authenticated(request, options.internalServiceSecret);
        try {
          return json(200, await options.service.validate(requestBody(request)));
        } catch (error) {
          if (error instanceof CurrentWorkspaceAuthorityError)
            throw new HttpError(error.status, error.code, error.message, error.retryable);
          throw error;
        }
      }
    }
  ];
}
