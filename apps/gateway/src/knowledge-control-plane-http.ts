import {
  AuthenticationError,
  parseInternalOperatorPrincipal,
  type InternalOperatorPrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import {
  HttpError,
  json,
  type JsonRequest,
  type JsonResult,
  type JsonRoute
} from '@markorbit/service-kit';
import { readSessionCookie, WORKSPACE_HEADER_NAME, type CoreAuthenticationClient } from './auth.js';
import {
  KNOWLEDGE_READ_AUTHORITY,
  parseKnowledgeEvidenceSupplyHealthOwnerResult
} from './knowledge-evidence-supply-health-owner.js';

export interface GatewayKnowledgeControlPlaneOptions {
  coreUrl?: string;
  internalServiceSecret?: string;
  knowledgeUrl?: string;
  knowledgeTimeoutMs?: number;
  operatorTimeoutMs?: number;
  authenticationClient?: CoreAuthenticationClient;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

const OWNER_PRINCIPAL_TTL_MS = 60_000;

function requestToken(request: JsonRequest): string {
  const value = readSessionCookie(request.headers.cookie);
  if (!value) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return value;
}

function requestWorkspaceId(request: JsonRequest): string {
  const value = request.headers[WORKSPACE_HEADER_NAME]?.trim();
  if (!value)
    throw new HttpError(400, 'WORKSPACE_CONTEXT_REQUIRED', 'Workspace context is required.');
  return value;
}

function correlationHeaders(request: JsonRequest): Record<string, string> {
  return {
    ...(request.headers['x-correlation-id']
      ? { 'x-correlation-id': request.headers['x-correlation-id'] }
      : {}),
    ...(request.headers['x-request-id'] ? { 'x-request-id': request.headers['x-request-id'] } : {})
  };
}

function parseOperator(value: unknown): InternalOperatorPrincipal {
  try {
    return parseInternalOperatorPrincipal(
      Buffer.from(JSON.stringify({ schemaVersion: 1, principal: value }), 'utf8').toString(
        'base64url'
      )
    );
  } catch {
    throw new HttpError(
      503,
      'KNOWLEDGE_OPERATOR_RESPONSE_INVALID',
      'Core Knowledge operator response is malformed.',
      true
    );
  }
}

function mapWorkspaceAuthentication(error: unknown): never {
  if (!(error instanceof AuthenticationError)) throw error;
  const code = String(error.code);
  const status =
    code === 'AUTHENTICATION_SERVICE_UNAVAILABLE' || code === 'PERSISTENCE_UNAVAILABLE'
      ? 503
      : ['WORKSPACE_CONTEXT_REQUIRED', 'INVALID_WORKSPACE_CONTEXT'].includes(code)
        ? 400
        : [
              'MEMBERSHIP_REQUIRED',
              'MEMBERSHIP_SUSPENDED',
              'WORKSPACE_ARCHIVED',
              'PERMISSION_DENIED'
            ].includes(code)
          ? 403
          : 401;
  throw new HttpError(status, code, error.message, status === 503);
}

function authenticationClient(
  options: GatewayKnowledgeControlPlaneOptions
): CoreAuthenticationClient {
  if (!options.authenticationClient)
    throw new HttpError(
      503,
      'AUTHENTICATION_SERVICE_UNAVAILABLE',
      'Knowledge Workspace authentication is unavailable.',
      true
    );
  return options.authenticationClient;
}

function configuredOwnerRuntime(options: GatewayKnowledgeControlPlaneOptions) {
  const knowledgeUrl = (options.knowledgeUrl ?? process.env.KNOWLEDGE_URL ?? '').trim();
  const internalServiceSecret = (
    options.internalServiceSecret ??
    process.env.MO_INTERNAL_SERVICE_SECRET ??
    ''
  ).trim();
  const timeoutMs = options.knowledgeTimeoutMs ?? 3_000;
  if (!knowledgeUrl || !internalServiceSecret || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1)
    throw new HttpError(
      503,
      'KNOWLEDGE_CONFIGURATION_UNAVAILABLE',
      'Knowledge Control Plane integration is unavailable.',
      true
    );
  return {
    knowledgeUrl: knowledgeUrl.replace(/\/$/u, ''),
    internalServiceSecret,
    timeoutMs,
    fetchImpl: options.fetchImpl ?? fetch
  };
}

async function resolveKnowledgeOperator(
  request: JsonRequest,
  token: string,
  options: GatewayKnowledgeControlPlaneOptions
): Promise<{ principal: InternalOperatorPrincipal } | { response: JsonResult }> {
  const internalServiceSecret = (
    options.internalServiceSecret ??
    process.env.MO_INTERNAL_SERVICE_SECRET ??
    ''
  ).trim();
  const operatorTimeoutMs = options.operatorTimeoutMs ?? 3_000;
  if (!internalServiceSecret || !Number.isSafeInteger(operatorTimeoutMs) || operatorTimeoutMs < 1)
    throw new HttpError(
      503,
      'AUTHENTICATION_SERVICE_UNAVAILABLE',
      'Knowledge operator authentication is unavailable.',
      true
    );

  let response: Response;
  try {
    response = await fetch(
      `${options.coreUrl ?? process.env.CORE_URL ?? 'http://127.0.0.1:4101'}/internal/control-plane/operator-principals/resolve`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': internalServiceSecret,
          ...correlationHeaders(request)
        },
        body: JSON.stringify({ token, requiredCapability: KNOWLEDGE_READ_AUTHORITY }),
        signal: AbortSignal.timeout(operatorTimeoutMs)
      }
    );
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      503,
      'AUTHENTICATION_SERVICE_UNAVAILABLE',
      'Knowledge operator authentication is unavailable.',
      true
    );
  }

  const value: unknown = await response.json().catch(() => undefined);
  if (value === undefined)
    throw new HttpError(
      503,
      'KNOWLEDGE_OPERATOR_RESPONSE_INVALID',
      'Core Knowledge operator response is malformed.',
      true
    );
  if (!response.ok) return { response: json(response.status, value) };

  const principal = parseOperator(value);
  if (!principal.capabilities.includes(KNOWLEDGE_READ_AUTHORITY))
    return {
      response: json(403, {
        code: 'PERMISSION_DENIED',
        message: `${KNOWLEDGE_READ_AUTHORITY} capability is required.`
      })
    };
  return { principal };
}

async function resolveWorkspace(
  request: JsonRequest,
  token: string,
  workspaceId: string,
  options: GatewayKnowledgeControlPlaneOptions
): Promise<WorkspacePrincipal> {
  try {
    const principal = await authenticationClient(options).resolveWorkspace(
      token,
      workspaceId,
      request.headers['x-correlation-id']
    );
    if (principal.workspaceId !== workspaceId)
      throw new HttpError(
        503,
        'KNOWLEDGE_WORKSPACE_RESPONSE_INVALID',
        'Core Workspace response is inconsistent.',
        true
      );
    return principal;
  } catch (error) {
    return mapWorkspaceAuthentication(error);
  }
}

function ownerPrincipal(
  operator: InternalOperatorPrincipal,
  workspace: WorkspacePrincipal,
  now: Date
): string {
  if (operator.userId !== workspace.userId || operator.sessionId !== workspace.sessionId)
    throw new HttpError(
      503,
      'KNOWLEDGE_PRINCIPAL_MISMATCH',
      'Knowledge operator and Workspace principals do not share one authenticated session.',
      true
    );
  const operatorExpiry = Date.parse(operator.sessionExpiresAt);
  const workspaceExpiry = Date.parse(workspace.sessionExpiresAt);
  if (!Number.isFinite(operatorExpiry) || !Number.isFinite(workspaceExpiry))
    throw new HttpError(
      503,
      'KNOWLEDGE_PRINCIPAL_INVALID',
      'Knowledge principal expiry is invalid.',
      true
    );
  const expiresAt = Math.min(
    operatorExpiry,
    workspaceExpiry,
    now.getTime() + OWNER_PRINCIPAL_TTL_MS
  );
  if (expiresAt <= now.getTime())
    throw new HttpError(401, 'SESSION_EXPIRED', 'The authenticated session has expired.');
  return Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      principal: {
        kind: 'CONTROL_PLANE_KNOWLEDGE_READ',
        caller: 'MARKORBIT_GATEWAY',
        workspaceId: workspace.workspaceId,
        authority: KNOWLEDGE_READ_AUTHORITY,
        expiresAt: new Date(expiresAt).toISOString()
      }
    }),
    'utf8'
  ).toString('base64url');
}

async function readOwner(
  request: JsonRequest,
  workspace: WorkspacePrincipal,
  operator: InternalOperatorPrincipal,
  options: GatewayKnowledgeControlPlaneOptions
): Promise<JsonResult> {
  const runtime = configuredOwnerRuntime(options);
  const principal = ownerPrincipal(operator, workspace, (options.now ?? (() => new Date()))());
  let response: Response;
  try {
    response = await runtime.fetchImpl(
      `${runtime.knowledgeUrl}/api/internal/control-plane/evidence-supply-health?workspaceId=${encodeURIComponent(workspace.workspaceId)}`,
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-markorbit-internal-authorization': runtime.internalServiceSecret,
          'x-markorbit-control-plane-principal': principal,
          ...correlationHeaders(request)
        },
        signal: AbortSignal.timeout(runtime.timeoutMs)
      }
    );
  } catch {
    throw new HttpError(
      503,
      'KNOWLEDGE_OWNER_UNAVAILABLE',
      'Knowledge owner read is unavailable.',
      true
    );
  }

  const value: unknown = await response.json().catch(() => undefined);
  if (!response.ok)
    return json(
      response.status,
      value ?? {
        code: 'KNOWLEDGE_OWNER_FAILURE',
        message: 'Knowledge owner read failed.'
      }
    );
  const parsed = parseKnowledgeEvidenceSupplyHealthOwnerResult(value, workspace.workspaceId);
  if (!parsed)
    throw new HttpError(
      503,
      'KNOWLEDGE_OWNER_CONTRACT_MISMATCH',
      'Knowledge owner response is malformed.',
      true
    );
  return json(200, parsed);
}

export function createGatewayKnowledgeControlPlaneRoutes(
  options: GatewayKnowledgeControlPlaneOptions
): readonly JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/api/internal/control-plane/knowledge/evidence-supply-health',
      handle: async (request) => {
        const workspaceId = requestWorkspaceId(request);
        const token = requestToken(request);
        const operator = await resolveKnowledgeOperator(request, token, options);
        if ('response' in operator) return operator.response;
        const workspace = await resolveWorkspace(request, token, workspaceId, options);
        return readOwner(request, workspace, operator.principal, options);
      }
    }
  ];
}
