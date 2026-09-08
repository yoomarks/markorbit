import { parseInternalOperatorPrincipal } from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { validateInternalServiceSecret } from './auth.js';
import {
  WORKSPACE_ADMIN_MANAGE_AUTHORITY,
  WorkspaceAdminManagementError,
  type PostgresWorkspaceAdminManagementServiceV1
} from './workspace-admin-management.js';

export interface WorkspaceAdminManagementHttpOptionsV1 {
  service: Pick<PostgresWorkspaceAdminManagementServiceV1, 'renameDisplayName'>;
  internalServiceSecret: string;
  now?: () => Date;
}

function authorize(request: JsonRequest, options: WorkspaceAdminManagementHttpOptionsV1) {
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
  let principal;
  try {
    principal = parseInternalOperatorPrincipal(request.headers['x-markorbit-principal']);
  } catch {
    throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Internal Operator principal is invalid.');
  }
  if (
    principal.capabilities.length !== 1 ||
    principal.capabilities[0] !== WORKSPACE_ADMIN_MANAGE_AUTHORITY
  )
    throw new HttpError(
      403,
      'PERMISSION_DENIED',
      'Exact workspace-admin:manage authority is required.'
    );
  const expiresAt = Date.parse(principal.sessionExpiresAt);
  const now = (options.now ?? (() => new Date()))().valueOf();
  if (!Number.isFinite(expiresAt) || expiresAt <= now)
    throw new HttpError(401, 'SESSION_EXPIRED', 'Internal Operator session is expired.');
  return principal;
}

function commandBody(request: JsonRequest): {
  expectedVersion: number;
  displayName: string;
  reason: string;
} {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  const body = request.body as Record<string, unknown>;
  if (
    Object.keys(body).length !== 3 ||
    !['expectedVersion', 'displayName', 'reason'].every((key) => key in body) ||
    !Number.isSafeInteger(body.expectedVersion) ||
    Number(body.expectedVersion) < 1 ||
    typeof body.displayName !== 'string' ||
    typeof body.reason !== 'string'
  )
    throw new HttpError(400, 'INVALID_REQUEST', 'Workspace display-name command is invalid.');
  return {
    expectedVersion: body.expectedVersion as number,
    displayName: body.displayName,
    reason: body.reason
  };
}

function idempotencyKey(request: JsonRequest): string {
  const value = request.headers['idempotency-key'];
  if (typeof value !== 'string' || !value || value.trim() !== value || value.length > 256)
    throw new HttpError(
      400,
      'IDEMPOTENCY_KEY_REQUIRED',
      'A bounded Idempotency-Key header is required.'
    );
  return value;
}
function translate(error: unknown): never {
  if (!(error instanceof WorkspaceAdminManagementError)) throw error;
  throw new HttpError(error.status, error.code, error.message, error.retryable);
}

export function createWorkspaceAdminManagementRoutesV1(
  options: WorkspaceAdminManagementHttpOptionsV1
): readonly JsonRoute[] {
  return [
    {
      method: 'PATCH',
      path: '/internal/super-admin/workspaces/:workspaceId/display-name',
      async handle(request) {
        const principal = authorize(request, options);
        const workspaceId = request.params.workspaceId;
        if (!workspaceId)
          throw new HttpError(400, 'INVALID_REQUEST', 'Workspace target is required.');
        const body = commandBody(request);
        try {
          const workspace = await options.service.renameDisplayName(
            {
              workspaceId,
              expectedVersion: body.expectedVersion,
              displayName: body.displayName,
              reason: body.reason,
              idempotencyKey: idempotencyKey(request)
            },
            { userId: principal.userId, sessionId: principal.sessionId },
            request.headers['x-correlation-id']
          );
          return json(200, workspace);
        } catch (error) {
          return translate(error);
        }
      }
    }
  ];
}
