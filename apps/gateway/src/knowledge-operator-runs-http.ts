import {
  AuthenticationError,
  encodeInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  readSessionCookie,
  requireTrustedOrigin,
  validateCsrf,
  type CoreAuthenticationClient
} from './auth.js';

export interface GatewayKnowledgeOperatorRunsOptions {
  knowledgeUrl?: string;
  authenticationClient?: CoreAuthenticationClient;
  internalServiceSecret?: string;
  csrfSecret: string;
  allowedOrigins: readonly string[];
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
            'PERMISSION_DENIED',
            'INVALID_CSRF_TOKEN',
            'UNTRUSTED_ORIGIN'
          ].includes(error.code)
        ? 403
        : 401;
  throw new HttpError(status, error.code, error.message, status === 503);
}

function requestBody(request: JsonRequest): { planId: string; extensions?: unknown } {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  const value = request.body as Record<string, unknown>;
  if (Object.keys(value).some((field) => !['planId', 'extensions'].includes(field)))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body contains unsupported fields.');
  if (typeof value.planId !== 'string' || !value.planId.trim())
    throw new HttpError(400, 'INVALID_REQUEST', 'planId is required.');
  return {
    planId: value.planId.trim(),
    ...(Object.hasOwn(value, 'extensions') ? { extensions: value.extensions } : {})
  };
}

async function browserPrincipal(
  request: JsonRequest,
  options: GatewayKnowledgeOperatorRunsOptions
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
    const principal = await options.authenticationClient.resolveWorkspace(
      token,
      workspaceId,
      request.headers['x-correlation-id']
    );
    requireTrustedOrigin(request.headers.origin, options.allowedOrigins);
    validateCsrf(
      principal.sessionId,
      options.csrfSecret,
      request.headers['x-markorbit-csrf-token']
    );
    if (!principal.permissions.includes('execution:manage'))
      throw new AuthenticationError(
        'PERMISSION_DENIED',
        'execution:manage permission is required.'
      );
    return principal;
  } catch (error) {
    return mapAuthentication(error);
  }
}

export function createGatewayKnowledgeOperatorRunsRoutes(
  options: GatewayKnowledgeOperatorRunsOptions
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/api/knowledge/operator-runs',
      handle: async (request) => {
        const body = requestBody(request);
        const idempotencyKey = request.headers['idempotency-key']?.trim();
        if (!idempotencyKey)
          throw new HttpError(400, 'INVALID_REQUEST', 'Idempotency-Key header is required.');
        const principal = await browserPrincipal(request, options);
        const internalServiceSecret = (options.internalServiceSecret ?? '').trim();
        const knowledgeUrl = (options.knowledgeUrl ?? '').trim();
        if (!internalServiceSecret || !knowledgeUrl)
          throw new HttpError(
            503,
            'KNOWLEDGE_RUNTIME_UNAVAILABLE',
            'Knowledge runtime is unavailable.',
            true
          );
        try {
          const response = await (options.fetchImpl ?? fetch)(
            `${knowledgeUrl.replace(/\/$/u, '')}/api/operator-runs`,
            {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                'x-markorbit-internal-authorization': internalServiceSecret,
                'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
                'idempotency-key': idempotencyKey,
                ...(request.headers['x-correlation-id']
                  ? { 'x-correlation-id': request.headers['x-correlation-id'] }
                  : {})
              },
              body: JSON.stringify(body),
              signal: AbortSignal.timeout(options.timeoutMs ?? 3000)
            }
          );
          return json(response.status, await response.json());
        } catch (error) {
          if (error instanceof HttpError) throw error;
          throw new HttpError(
            503,
            'KNOWLEDGE_RUNTIME_UNAVAILABLE',
            'Knowledge runtime is unavailable.',
            true
          );
        }
      }
    }
  ];
}
