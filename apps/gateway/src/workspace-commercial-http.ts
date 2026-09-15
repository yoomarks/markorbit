import { AuthenticationError, type WorkspacePrincipal } from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { type CoreAuthenticationClient, readSessionCookie } from './auth.js';

export interface GatewayWorkspaceCommercialOptionsV1 {
  coreUrl?: string;
  authenticationClient?: CoreAuthenticationClient;
  internalServiceSecret?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function mapAuthentication(error: unknown): never {
  if (!(error instanceof AuthenticationError)) throw error;
  const status =
    error.code === 'AUTHENTICATION_SERVICE_UNAVAILABLE'
      ? 503
      : [
            'MEMBERSHIP_REQUIRED',
            'MEMBERSHIP_SUSPENDED',
            'WORKSPACE_ARCHIVED',
            'PERMISSION_DENIED'
          ].includes(error.code)
        ? 403
        : 401;
  throw new HttpError(status, error.code, error.message, status === 503);
}

async function principal(
  request: JsonRequest,
  options: GatewayWorkspaceCommercialOptionsV1
): Promise<WorkspacePrincipal> {
  const token = readSessionCookie(request.headers.cookie);
  if (!token) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  const workspaceId = request.headers['x-markorbit-workspace-id'];
  if (!workspaceId)
    throw new HttpError(400, 'INVALID_WORKSPACE_CONTEXT', 'Workspace context is required.');
  if (!options.authenticationClient)
    throw new HttpError(
      503,
      'AUTHENTICATION_SERVICE_UNAVAILABLE',
      'Authentication service is unavailable.',
      true
    );
  try {
    const value = await options.authenticationClient.resolveWorkspace(
      token,
      workspaceId,
      request.headers['x-correlation-id']
    );
    if (!value.permissions.includes('workspace:read'))
      throw new AuthenticationError('PERMISSION_DENIED', 'workspace:read permission is required.');
    return value;
  } catch (error) {
    return mapAuthentication(error);
  }
}

async function callCore(
  request: JsonRequest,
  options: GatewayWorkspaceCommercialOptionsV1,
  actor: WorkspacePrincipal,
  path: string,
  body: Readonly<Record<string, unknown>>
) {
  const secret = (options.internalServiceSecret ?? '').trim();
  if (!secret)
    throw new HttpError(
      503,
      'WORKSPACE_COMMERCIAL_UNAVAILABLE',
      'Workspace commercial owner is unavailable.',
      true
    );
  const baseUrl = (options.coreUrl ?? 'http://127.0.0.1:4101').replace(/\/$/u, '');
  try {
    const response = await (options.fetchImpl ?? fetch)(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-markorbit-internal-authorization': secret,
        ...(request.headers['x-correlation-id']
          ? { 'x-correlation-id': request.headers['x-correlation-id'] }
          : {})
      },
      body: JSON.stringify({ userId: actor.userId, membershipId: actor.membershipId, ...body }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 3_000)
    });
    return json(response.status, await response.json());
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      503,
      'WORKSPACE_COMMERCIAL_UNAVAILABLE',
      'Workspace commercial owner is unavailable.',
      true
    );
  }
}

export function createGatewayWorkspaceCommercialRoutesV1(
  options: GatewayWorkspaceCommercialOptionsV1
): readonly JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/api/workspace-commercial/installations',
      async handle(request) {
        const actor = await principal(request, options);
        return callCore(
          request,
          options,
          actor,
          `/internal/workspaces/${encodeURIComponent(actor.workspaceId)}/commercial/installations/read`,
          {}
        );
      }
    },
    {
      method: 'GET',
      path: '/api/workspace-commercial/entitlements/:entitlementKey',
      async handle(request) {
        const actor = await principal(request, options);
        const subjectScope = request.query.subjectScope;
        const asOf = request.query.asOf;
        if (
          (subjectScope !== 'USER' && subjectScope !== 'WORKSPACE') ||
          !asOf ||
          Number.isNaN(Date.parse(asOf))
        )
          throw new HttpError(400, 'INVALID_REQUEST', 'subjectScope and an ISO asOf are required.');
        return callCore(
          request,
          options,
          actor,
          `/internal/workspaces/${encodeURIComponent(actor.workspaceId)}/commercial/entitlements/resolve`,
          { subjectScope, entitlementKey: request.params.entitlementKey!, asOf }
        );
      }
    }
  ];
}
