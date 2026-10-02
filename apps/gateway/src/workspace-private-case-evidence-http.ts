import {
  AuthenticationError,
  encodeInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import {
  assertWorkspacePrivateCaseEvidenceReadResultV1,
  assertWorkspacePrivateCaseEvidenceReferenceListV1
} from '@markorbit/contracts/workspace-private-evidence';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  readSessionCookie,
  requireTrustedOrigin,
  validateCsrf,
  type CoreAuthenticationClient
} from './auth.js';

export interface GatewayWorkspacePrivateCaseEvidenceOptions {
  coreUrl: string;
  knowledgeUrl?: string;
  authenticationClient?: CoreAuthenticationClient;
  internalServiceSecret?: string;
  csrfSecret: string;
  allowedOrigins: readonly string[];
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const responseHeaders = { 'cache-control': 'private, no-store' } as const;

function mapAuthentication(error: unknown): never {
  if (!(error instanceof AuthenticationError)) throw error;
  const status =
    error.code === 'AUTHENTICATION_SERVICE_UNAVAILABLE'
      ? 503
      : error.code === 'INVALID_WORKSPACE_CONTEXT'
        ? 400
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

async function principal(
  request: JsonRequest,
  options: GatewayWorkspacePrivateCaseEvidenceOptions,
  protectedPost: boolean
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
    const resolved = await options.authenticationClient.resolveWorkspace(
      token,
      workspaceId,
      request.headers['x-correlation-id']
    );
    if (protectedPost) {
      requireTrustedOrigin(request.headers.origin, options.allowedOrigins);
      validateCsrf(
        resolved.sessionId,
        options.csrfSecret,
        request.headers['x-markorbit-csrf-token']
      );
    }
    if (!resolved.permissions.includes('matter:read'))
      throw new AuthenticationError(
        'PERMISSION_DENIED',
        'matter:read permission is required for private Case evidence.'
      );
    return resolved;
  } catch (error) {
    return mapAuthentication(error);
  }
}

function target(options: GatewayWorkspacePrivateCaseEvidenceOptions, owner: 'CORE' | 'KNOWLEDGE') {
  const secret = options.internalServiceSecret?.trim();
  const url = (owner === 'CORE' ? options.coreUrl : options.knowledgeUrl)?.trim();
  if (!secret || !url)
    throw new HttpError(
      503,
      'WORKSPACE_PRIVATE_CASE_EVIDENCE_SOURCE_UNAVAILABLE',
      `${owner === 'CORE' ? 'Core' : 'Knowledge'} private evidence owner is unavailable.`,
      true
    );
  return {
    url: url.replace(/\/$/u, ''),
    secret,
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs: options.timeoutMs ?? 5000
  };
}

async function ownerJson(
  request: JsonRequest,
  principalValue: WorkspacePrincipal,
  options: GatewayWorkspacePrivateCaseEvidenceOptions,
  owner: 'CORE' | 'KNOWLEDGE',
  path: string,
  body?: unknown
): Promise<{ status: number; value: unknown }> {
  const configured = target(options, owner);
  let response: Response;
  try {
    response = await configured.fetchImpl(`${configured.url}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        'x-markorbit-internal-authorization': configured.secret,
        'x-markorbit-principal': encodeInternalWorkspacePrincipal(principalValue),
        'x-markorbit-workspace-id': principalValue.workspaceId,
        ...(request.headers['x-correlation-id']
          ? { 'x-correlation-id': request.headers['x-correlation-id'] }
          : {})
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(configured.timeoutMs)
    });
  } catch {
    throw new HttpError(
      503,
      'WORKSPACE_PRIVATE_CASE_EVIDENCE_SOURCE_UNAVAILABLE',
      `${owner === 'CORE' ? 'Core' : 'Knowledge'} private evidence owner is unavailable.`,
      true
    );
  }
  const value = (await response.json().catch(() => undefined)) as unknown;
  if (value === undefined)
    throw new HttpError(
      503,
      'WORKSPACE_PRIVATE_CASE_EVIDENCE_INVALID_RESPONSE',
      `${owner === 'CORE' ? 'Core' : 'Knowledge'} returned an invalid private evidence response.`,
      true
    );
  return { status: response.status, value };
}

function body(request: JsonRequest): Record<string, unknown> {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(
      400,
      'INVALID_WORKSPACE_PRIVATE_CASE_EVIDENCE_REQUEST',
      'Request body must be an object.'
    );
  return request.body as Record<string, unknown>;
}

export function createGatewayWorkspacePrivateCaseEvidenceRoutes(
  options: GatewayWorkspacePrivateCaseEvidenceOptions
): readonly JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/api/markreg/formal-matters/:formalMatterId/private-evidence',
      handle: async (request) => {
        const authenticated = await principal(request, options, false);
        const formalMatterId = request.params.formalMatterId?.trim();
        if (!formalMatterId)
          throw new HttpError(
            400,
            'INVALID_WORKSPACE_PRIVATE_CASE_EVIDENCE_REQUEST',
            'Formal Matter identity is required.'
          );
        const response = await ownerJson(
          request,
          authenticated,
          options,
          'CORE',
          `/internal/v1/workspace-private-case-evidence/cases/${encodeURIComponent(formalMatterId)}`
        );
        if (response.status !== 200) return json(response.status, response.value, responseHeaders);
        try {
          assertWorkspacePrivateCaseEvidenceReferenceListV1(response.value);
        } catch {
          throw new HttpError(
            503,
            'WORKSPACE_PRIVATE_CASE_EVIDENCE_INVALID_RESPONSE',
            'Core returned an invalid private evidence reference list.',
            true
          );
        }
        if (
          response.value.workspaceId.toLowerCase() !== authenticated.workspaceId.toLowerCase() ||
          response.value.caseId !== formalMatterId
        )
          throw new HttpError(
            503,
            'WORKSPACE_PRIVATE_CASE_EVIDENCE_INVALID_RESPONSE',
            'Core returned private evidence for a different authority context.',
            true
          );
        return json(200, response.value, responseHeaders);
      }
    },
    {
      method: 'POST',
      path: '/api/markreg/formal-matters/:formalMatterId/private-evidence/:bindingId/read',
      handle: async (request) => {
        const authenticated = await principal(request, options, true);
        const formalMatterId = request.params.formalMatterId?.trim();
        const bindingId = request.params.bindingId?.trim();
        const value = body(request);
        if (
          !formalMatterId ||
          !bindingId ||
          Object.keys(value).some((key) => key !== 'expectedVersion') ||
          !Number.isSafeInteger(value.expectedVersion) ||
          Number(value.expectedVersion) < 1
        )
          throw new HttpError(
            400,
            'INVALID_WORKSPACE_PRIVATE_CASE_EVIDENCE_REQUEST',
            'Exact Formal Matter, binding and expected version are required.'
          );
        const response = await ownerJson(
          request,
          authenticated,
          options,
          'KNOWLEDGE',
          '/api/internal/workspace-private-case-evidence/read',
          { bindingId, expectedVersion: value.expectedVersion }
        );
        if (response.status !== 200) return json(response.status, response.value, responseHeaders);
        try {
          assertWorkspacePrivateCaseEvidenceReadResultV1(response.value);
        } catch {
          throw new HttpError(
            503,
            'WORKSPACE_PRIVATE_CASE_EVIDENCE_INVALID_RESPONSE',
            'Knowledge returned an invalid exact private evidence result.',
            true
          );
        }
        if (
          response.value.binding.bindingId !== bindingId ||
          response.value.binding.bindingVersion !== value.expectedVersion ||
          response.value.binding.caseId !== formalMatterId ||
          response.value.authority.coreWorkspaceId.toLowerCase() !==
            authenticated.workspaceId.toLowerCase() ||
          response.value.authority.userId.toLowerCase() !== authenticated.userId.toLowerCase() ||
          response.value.authority.membershipId.toLowerCase() !==
            authenticated.membershipId.toLowerCase()
        )
          throw new HttpError(
            503,
            'WORKSPACE_PRIVATE_CASE_EVIDENCE_INVALID_RESPONSE',
            'Knowledge returned private evidence for a different exact authority context.',
            true
          );
        return json(200, response.value, responseHeaders);
      }
    }
  ];
}
