import {
  encodeInternalOperatorPrincipal,
  parseInternalOperatorPrincipal,
  type InternalOperatorPrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { readSessionCookie } from './auth.js';

export const EXECUTION_SUPER_ADMIN_READ_AUTHORITY = 'execution-admin:read' as const;

export interface GatewayExecutionSuperAdminOptions {
  coreUrl?: string;
  executionUrl?: string;
  internalServiceSecret?: string;
  operatorTimeoutMs?: number;
  ownerTimeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface ExecutionSuperAdminResult {
  schemaVersion: 1;
  objectType: 'EXECUTION_ADMINISTRATION_PROJECTION';
  owner: 'EXECUTION';
  access: 'READ_ONLY';
  requiredAuthority: typeof EXECUTION_SUPER_ADMIN_READ_AUTHORITY;
  observedAt: string;
  portfolio: { availability: 'NOT_YET_MODELED'; reason: string };
}

function sessionToken(request: JsonRequest): string {
  const token = readSessionCookie(request.headers.cookie);
  if (!token) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return token;
}

function runtime(options: GatewayExecutionSuperAdminOptions) {
  const secret = (
    options.internalServiceSecret ??
    process.env.MO_INTERNAL_SERVICE_SECRET ??
    ''
  ).trim();
  if (!secret)
    throw new HttpError(
      503,
      'EXECUTION_ADMIN_CONFIGURATION_UNAVAILABLE',
      'Execution administration integration is unavailable.',
      true
    );
  return {
    coreUrl: (options.coreUrl ?? process.env.CORE_URL ?? 'http://127.0.0.1:4101').replace(
      /\/$/u,
      ''
    ),
    executionUrl: (
      options.executionUrl ??
      process.env.EXECUTION_URL ??
      'http://127.0.0.1:4104'
    ).replace(/\/$/u, ''),
    secret,
    operatorTimeoutMs: options.operatorTimeoutMs ?? 3000,
    ownerTimeoutMs: options.ownerTimeoutMs ?? 3000,
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
      'EXECUTION_ADMIN_OPERATOR_RESPONSE_INVALID',
      'Core Execution Admin operator response is malformed.',
      true
    );
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseOwner(value: unknown): ExecutionSuperAdminResult | null {
  const c = record(value);
  const p = record(c?.portfolio);
  if (
    !c ||
    !p ||
    c.schemaVersion !== 1 ||
    c.objectType !== 'EXECUTION_ADMINISTRATION_PROJECTION' ||
    c.owner !== 'EXECUTION' ||
    c.access !== 'READ_ONLY' ||
    c.requiredAuthority !== EXECUTION_SUPER_ADMIN_READ_AUTHORITY ||
    typeof c.observedAt !== 'string' ||
    !Number.isFinite(Date.parse(c.observedAt)) ||
    p.availability !== 'NOT_YET_MODELED' ||
    typeof p.reason !== 'string' ||
    !p.reason
  )
    return null;
  return c as unknown as ExecutionSuperAdminResult;
}

async function resolveOperator(
  request: JsonRequest,
  token: string,
  options: GatewayExecutionSuperAdminOptions
) {
  const r = runtime(options);
  let response: Response;
  try {
    response = await r.fetchImpl(
      `${r.coreUrl}/internal/super-admin/execution/operator-principals/resolve`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': r.secret
        },
        body: JSON.stringify({ token }),
        signal: AbortSignal.timeout(r.operatorTimeoutMs)
      }
    );
  } catch {
    throw new HttpError(
      503,
      'AUTHENTICATION_SERVICE_UNAVAILABLE',
      'Execution Admin operator authentication is unavailable.',
      true
    );
  }
  const body: unknown = await response.json().catch(() => undefined);
  if (body === undefined)
    throw new HttpError(
      503,
      'EXECUTION_ADMIN_OPERATOR_RESPONSE_INVALID',
      'Core Execution Admin operator response is malformed.',
      true
    );
  if (!response.ok) return { response: json(response.status, body) };
  const principal = parseOperator(body);
  if (
    principal.capabilities.length !== 1 ||
    principal.capabilities[0] !== EXECUTION_SUPER_ADMIN_READ_AUTHORITY
  )
    return {
      response: json(403, {
        code: 'PERMISSION_DENIED',
        message: `Exact ${EXECUTION_SUPER_ADMIN_READ_AUTHORITY} authority is required.`
      })
    };
  return { principal };
}

export function createGatewayExecutionSuperAdminRoutes(
  options: GatewayExecutionSuperAdminOptions
): readonly JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/api/internal/super-admin/execution',
      async handle(request) {
        const token = sessionToken(request);
        const resolved = await resolveOperator(request, token, options);
        if ('response' in resolved) return resolved.response;
        const r = runtime(options);
        let response: Response;
        try {
          response = await r.fetchImpl(`${r.executionUrl}/internal/super-admin/execution`, {
            method: 'GET',
            headers: {
              'x-markorbit-internal-authorization': r.secret,
              'x-markorbit-internal-principal': encodeInternalOperatorPrincipal(resolved.principal)
            },
            signal: AbortSignal.timeout(r.ownerTimeoutMs)
          });
        } catch {
          throw new HttpError(
            503,
            'EXECUTION_ADMIN_OWNER_UNAVAILABLE',
            'Execution owner administration read is unavailable.',
            true
          );
        }
        const body: unknown = await response.json().catch(() => undefined);
        if (!response.ok) {
          if (body === undefined)
            throw new HttpError(
              503,
              'EXECUTION_ADMIN_OWNER_UNAVAILABLE',
              'Execution owner administration read is unavailable.',
              true
            );
          return json(response.status, body);
        }
        const parsed = parseOwner(body);
        if (!parsed)
          throw new HttpError(
            503,
            'EXECUTION_ADMIN_OWNER_CONTRACT_MISMATCH',
            'Execution owner administration response is malformed.',
            true
          );
        return json(200, parsed);
      }
    }
  ];
}
