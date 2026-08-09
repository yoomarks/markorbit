import { AuthenticationError, type WorkspaceRepository } from '@markorbit/contracts';
import {
  createServiceRuntime,
  HttpError,
  json,
  type JsonRequest,
  type JsonRoute
} from '@markorbit/service-kit';
import type { AuthenticationService } from './auth.js';

export const serviceManifest = Object.freeze({
  name: 'core',
  port: Number(process.env.PORT ?? '4101'),
  version: '0.1.0'
});

export interface CoreRuntimeOptions {
  port?: number;
  authentication?: AuthenticationService;
  workspaces?: Pick<WorkspaceRepository, 'findById'>;
  internalServiceSecret?: string;
}
function body(request: JsonRequest): Record<string, unknown> {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Record<string, unknown>;
}
function authError(error: unknown): never {
  if (!(error instanceof AuthenticationError)) throw error;
  const status = [
    'MEMBERSHIP_REQUIRED',
    'MEMBERSHIP_SUSPENDED',
    'WORKSPACE_ARCHIVED',
    'PERMISSION_DENIED'
  ].includes(error.code)
    ? 403
    : error.code === 'INVALID_WORKSPACE_CONTEXT'
      ? 400
      : 401;
  throw new HttpError(status, error.code, error.message);
}
export function createRuntime(options: CoreRuntimeOptions = {}) {
  const authentication = options.authentication;
  const secret = options.internalServiceSecret;
  const internal =
    (handle: (request: JsonRequest) => Promise<ReturnType<typeof json>>): JsonRoute['handle'] =>
    async (request) => {
      const supplied = request.headers['x-markorbit-internal-authorization'];
      const { validateInternalServiceSecret } = await import('./auth.js');
      if (!validateInternalServiceSecret(secret, supplied))
        throw new HttpError(
          401,
          'INTERNAL_SERVICE_UNAUTHORIZED',
          'Internal service identity is invalid.'
        );
      if (!authentication)
        throw new HttpError(
          503,
          'AUTHENTICATION_SERVICE_UNAVAILABLE',
          'Authentication service is unavailable.',
          true
        );
      try {
        return await handle(request);
      } catch (error) {
        authError(error);
      }
    };
  const routes: JsonRoute[] = authentication
    ? [
        {
          method: 'POST',
          path: '/internal/auth/sessions',
          handle: internal(async (request) => {
            const value = body(request),
              userId = value.userId;
            if (typeof userId !== 'string')
              throw new HttpError(400, 'INVALID_REQUEST', 'userId is required.');
            const issued = await authentication.issueSession(
              userId,
              typeof value.ttlSeconds === 'number' ? value.ttlSeconds : undefined
            );
            return json(201, issued);
          })
        },
        {
          method: 'POST',
          path: '/internal/auth/sessions/resolve',
          handle: internal(async (request) => {
            const token = body(request).token;
            if (typeof token !== 'string' || !token)
              throw new HttpError(400, 'INVALID_REQUEST', 'token is required.');
            return json(200, await authentication.resolveSession(token));
          })
        },
        {
          method: 'POST',
          path: '/internal/auth/workspace-principals/resolve',
          handle: internal(async (request) => {
            const value = body(request);
            if (typeof value.token !== 'string' || typeof value.workspaceId !== 'string')
              throw new HttpError(400, 'INVALID_REQUEST', 'token and workspaceId are required.');
            return json(
              200,
              await authentication.resolveWorkspacePrincipal(value.token, value.workspaceId)
            );
          })
        },
        {
          method: 'POST',
          path: '/internal/auth/sessions/:sessionId/revoke',
          handle: internal(async (request) => {
            const revoked = await authentication.revokeCurrentSession(request.params.sessionId!);
            return json(200, {
              sessionId: revoked.sessionId,
              userId: revoked.userId,
              status: revoked.status,
              createdAt: revoked.createdAt,
              expiresAt: revoked.expiresAt,
              revokedAt: revoked.revokedAt,
              version: revoked.version
            });
          })
        },
        ...(options.workspaces
          ? [
              {
                method: 'GET' as const,
                path: '/internal/identity/workspaces/:workspaceId',
                handle: internal(async (request) => {
                  const workspace = await options.workspaces!.findById(request.params.workspaceId!);
                  if (!workspace)
                    throw new HttpError(404, 'WORKSPACE_NOT_FOUND', 'Workspace was not found.');
                  return json(200, {
                    workspace: {
                      workspaceId: workspace.workspaceId,
                      status: workspace.status
                    }
                  });
                })
              }
            ]
          : [])
      ]
    : [];
  return createServiceRuntime(
    { ...serviceManifest, port: options.port ?? serviceManifest.port },
    { routes }
  );
}
export * from './identity.js';
export * from './auth.js';
