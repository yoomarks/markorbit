import {
  parseInternalOperatorPrincipal,
  type InternalOperatorPrincipal
} from '@markorbit/contracts';
import {
  HttpError,
  json,
  type JsonRequest,
  type JsonResult,
  type JsonRoute
} from '@markorbit/service-kit';
import { readSessionCookie } from './auth.js';
import { KNOWLEDGE_READ_AUTHORITY } from './knowledge-evidence-supply-health-owner.js';

export interface GatewayKnowledgeSuperAdminOptions {
  coreUrl?: string;
  knowledgeUrl?: string;
  internalServiceSecret?: string;
  operatorTimeoutMs?: number;
  ownerTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export interface KnowledgeSuperAdminResult {
  schemaVersion: 1;
  objectType: 'KNOWLEDGE_PLATFORM_ADMINISTRATION_OWNER_RESULT';
  owner: 'KNOWLEDGE';
  access: 'READ_ONLY';
  requiredUpstreamAuthority: typeof KNOWLEDGE_READ_AUTHORITY;
  observedAt: string;
  portfolio: { availability: 'NOT_YET_MODELED'; reason: string };
}
const OWNER_PRINCIPAL_TTL_MS = 60_000;

function sessionToken(request: JsonRequest): string {
  const token = readSessionCookie(request.headers.cookie);
  if (!token) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return token;
}

function correlationHeaders(request: JsonRequest): Record<string, string> {
  return {
    ...(request.headers['x-correlation-id']
      ? { 'x-correlation-id': request.headers['x-correlation-id'] }
      : {}),
    ...(request.headers['x-request-id'] ? { 'x-request-id': request.headers['x-request-id'] } : {})
  };
}

function runtime(options: GatewayKnowledgeSuperAdminOptions) {
  const secret = (
    options.internalServiceSecret ??
    process.env.MO_INTERNAL_SERVICE_SECRET ??
    ''
  ).trim();
  const knowledgeUrl = (options.knowledgeUrl ?? process.env.KNOWLEDGE_URL ?? '').trim();
  const coreUrl = (options.coreUrl ?? process.env.CORE_URL ?? 'http://127.0.0.1:4101').trim();
  const operatorTimeoutMs = options.operatorTimeoutMs ?? 3_000;
  const ownerTimeoutMs = options.ownerTimeoutMs ?? 3_000;
  if (
    !secret ||
    !knowledgeUrl ||
    !coreUrl ||
    !Number.isSafeInteger(operatorTimeoutMs) ||
    operatorTimeoutMs < 1 ||
    !Number.isSafeInteger(ownerTimeoutMs) ||
    ownerTimeoutMs < 1
  ) {
    throw new HttpError(
      503,
      'KNOWLEDGE_ADMIN_CONFIGURATION_UNAVAILABLE',
      'Knowledge administration integration is unavailable.',
      true
    );
  }
  return {
    secret,
    coreUrl: coreUrl.replace(/\/$/u, ''),
    knowledgeUrl: knowledgeUrl.replace(/\/$/u, ''),
    operatorTimeoutMs,
    ownerTimeoutMs,
    fetchImpl: options.fetchImpl ?? fetch
  };
}

function parseOperator(value: unknown): InternalOperatorPrincipal {
  try {
    const encoded = Buffer.from(
      JSON.stringify({ schemaVersion: 1, principal: value }),
      'utf8'
    ).toString('base64url');
    return parseInternalOperatorPrincipal(encoded);
  } catch {
    throw new HttpError(
      503,
      'KNOWLEDGE_ADMIN_OPERATOR_RESPONSE_INVALID',
      'Core Knowledge Admin operator response is malformed.',
      true
    );
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseOwner(value: unknown): KnowledgeSuperAdminResult | null {
  const source = record(value);
  const portfolio = record(source?.portfolio);
  if (
    !source ||
    !portfolio ||
    source.schemaVersion !== 1 ||
    source.objectType !== 'KNOWLEDGE_PLATFORM_ADMINISTRATION_OWNER_RESULT' ||
    source.owner !== 'KNOWLEDGE' ||
    source.access !== 'READ_ONLY' ||
    source.requiredUpstreamAuthority !== KNOWLEDGE_READ_AUTHORITY ||
    typeof source.observedAt !== 'string' ||
    !Number.isFinite(Date.parse(source.observedAt)) ||
    portfolio.availability !== 'NOT_YET_MODELED' ||
    typeof portfolio.reason !== 'string' ||
    !portfolio.reason.trim()
  ) {
    return null;
  }
  return {
    schemaVersion: 1,
    objectType: 'KNOWLEDGE_PLATFORM_ADMINISTRATION_OWNER_RESULT',
    owner: 'KNOWLEDGE',
    access: 'READ_ONLY',
    requiredUpstreamAuthority: KNOWLEDGE_READ_AUTHORITY,
    observedAt: source.observedAt,
    portfolio: { availability: 'NOT_YET_MODELED', reason: portfolio.reason }
  };
}
async function resolveOperator(
  request: JsonRequest,
  token: string,
  options: GatewayKnowledgeSuperAdminOptions
): Promise<{ principal: InternalOperatorPrincipal } | { response: JsonResult }> {
  const configured = runtime(options);
  let response: Response;
  try {
    response = await configured.fetchImpl(
      `${configured.coreUrl}/internal/control-plane/operator-principals/resolve`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': configured.secret,
          ...correlationHeaders(request)
        },
        body: JSON.stringify({ token, requiredCapability: KNOWLEDGE_READ_AUTHORITY }),
        signal: AbortSignal.timeout(configured.operatorTimeoutMs)
      }
    );
  } catch {
    throw new HttpError(
      503,
      'AUTHENTICATION_SERVICE_UNAVAILABLE',
      'Knowledge Admin operator authentication is unavailable.',
      true
    );
  }
  const body: unknown = await response.json().catch(() => undefined);
  if (body === undefined) {
    throw new HttpError(
      503,
      'KNOWLEDGE_ADMIN_OPERATOR_RESPONSE_INVALID',
      'Core Knowledge Admin operator response is malformed.',
      true
    );
  }
  if (!response.ok) return { response: json(response.status, body) };

  const principal = parseOperator(body);
  if (
    principal.capabilities.length !== 1 ||
    principal.capabilities[0] !== KNOWLEDGE_READ_AUTHORITY
  ) {
    return {
      response: json(403, {
        code: 'PERMISSION_DENIED',
        message: `Exact ${KNOWLEDGE_READ_AUTHORITY} authority is required.`
      })
    };
  }
  return { principal };
}

function ownerPrincipal(operator: InternalOperatorPrincipal, now: Date): string {
  const sessionExpiry = Date.parse(operator.sessionExpiresAt);
  if (!Number.isFinite(sessionExpiry)) {
    throw new HttpError(
      503,
      'KNOWLEDGE_ADMIN_PRINCIPAL_INVALID',
      'Knowledge Admin operator expiry is invalid.',
      true
    );
  }
  const expiresAt = Math.min(sessionExpiry, now.getTime() + OWNER_PRINCIPAL_TTL_MS);
  if (expiresAt <= now.getTime()) {
    throw new HttpError(401, 'SESSION_EXPIRED', 'The authenticated session has expired.');
  }
  return Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      principal: {
        kind: 'CONTROL_PLANE_KNOWLEDGE_PLATFORM_READ',
        caller: 'MARKORBIT_GATEWAY',
        authority: KNOWLEDGE_READ_AUTHORITY,
        expiresAt: new Date(expiresAt).toISOString()
      }
    }),
    'utf8'
  ).toString('base64url');
}

async function readOwner(
  request: JsonRequest,
  operator: InternalOperatorPrincipal,
  options: GatewayKnowledgeSuperAdminOptions
): Promise<JsonResult> {
  const configured = runtime(options);
  const principal = ownerPrincipal(operator, (options.now ?? (() => new Date()))());
  let response: Response;
  try {
    response = await configured.fetchImpl(
      `${configured.knowledgeUrl}/api/internal/control-plane/platform-administration`,
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-markorbit-internal-authorization': configured.secret,
          'x-markorbit-control-plane-principal': principal,
          ...correlationHeaders(request)
        },
        signal: AbortSignal.timeout(configured.ownerTimeoutMs)
      }
    );
  } catch {
    throw new HttpError(
      503,
      'KNOWLEDGE_ADMIN_OWNER_UNAVAILABLE',
      'Knowledge owner administration read is unavailable.',
      true
    );
  }
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    if (body === undefined) {
      throw new HttpError(
        503,
        'KNOWLEDGE_ADMIN_OWNER_UNAVAILABLE',
        'Knowledge owner administration read is unavailable.',
        true
      );
    }
    return json(response.status, body);
  }
  const parsed = parseOwner(body);
  if (!parsed) {
    throw new HttpError(
      503,
      'KNOWLEDGE_ADMIN_OWNER_CONTRACT_MISMATCH',
      'Knowledge owner administration response is malformed.',
      true
    );
  }
  return json(200, parsed);
}

export function createGatewayKnowledgeSuperAdminRoutes(
  options: GatewayKnowledgeSuperAdminOptions
): readonly JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/api/internal/super-admin/knowledge',
      async handle(request) {
        const token = sessionToken(request);
        const resolved = await resolveOperator(request, token, options);
        if ('response' in resolved) return resolved.response;
        return readOwner(request, resolved.principal, options);
      }
    }
  ];
}
