import {
  encodeInternalOperatorPrincipal,
  parseInternalOperatorPrincipal,
  type InternalOperatorPrincipal
} from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { readSessionCookie } from './auth.js';

export const LITE_SUPER_ADMIN_READ_AUTHORITY = 'lite-admin:read' as const;

export interface GatewayLiteSuperAdminOptions {
  coreUrl?: string;
  liteUrl?: string;
  internalServiceSecret?: string;
  operatorTimeoutMs?: number;
  ownerTimeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface LiteSuperAdminResult {
  schemaVersion: 1;
  objectType: 'LITE_ADMINISTRATION_PROJECTION';
  owner: 'LITE';
  access: 'READ_ONLY';
  requiredAuthority: typeof LITE_SUPER_ADMIN_READ_AUTHORITY;
  observedAt: string;
  portfolio: { availability: 'NOT_YET_MODELED'; reason: string };
}

function sessionToken(request: JsonRequest): string {
  const token = readSessionCookie(request.headers.cookie);
  if (!token) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  return token;
}

function runtime(options: GatewayLiteSuperAdminOptions) {
  const secret = (
    options.internalServiceSecret ??
    process.env.MO_INTERNAL_SERVICE_SECRET ??
    ''
  ).trim();
  if (!secret)
    throw new HttpError(
      503,
      'LITE_ADMIN_CONFIGURATION_UNAVAILABLE',
      'Lite administration integration is unavailable.',
      true
    );
  return {
    coreUrl: (options.coreUrl ?? process.env.CORE_URL ?? 'http://127.0.0.1:4101').replace(
      /\/$/u,
      ''
    ),
    liteUrl: (options.liteUrl ?? process.env.LITE_URL ?? 'http://127.0.0.1:4107').replace(
      /\/$/u,
      ''
    ),
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
      'LITE_ADMIN_OPERATOR_RESPONSE_INVALID',
      'Core Lite Admin operator response is malformed.',
      true
    );
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseOwner(value: unknown): LiteSuperAdminResult | null {
  const c = record(value);
  const p = record(c?.portfolio);
  if (
    !c ||
    !p ||
    c.schemaVersion !== 1 ||
    c.objectType !== 'LITE_ADMINISTRATION_PROJECTION' ||
    c.owner !== 'LITE' ||
    c.access !== 'READ_ONLY' ||
    c.requiredAuthority !== LITE_SUPER_ADMIN_READ_AUTHORITY ||
    typeof c.observedAt !== 'string' ||
    !Number.isFinite(Date.parse(c.observedAt)) ||
    p.availability !== 'NOT_YET_MODELED' ||
    typeof p.reason !== 'string' ||
    !p.reason
  )
    return null;
  return c as unknown as LiteSuperAdminResult;
}

async function resolveOperator(
  request: JsonRequest,
  token: string,
  options: GatewayLiteSuperAdminOptions
) {
  const r = runtime(options);
  let response: Response;
  try {
    response = await r.fetchImpl(
      `${r.coreUrl}/internal/super-admin/lite/operator-principals/resolve`,
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
      'Lite Admin operator authentication is unavailable.',
      true
    );
  }
  const body: unknown = await response.json().catch(() => undefined);
  if (body === undefined)
    throw new HttpError(
      503,
      'LITE_ADMIN_OPERATOR_RESPONSE_INVALID',
      'Core Lite Admin operator response is malformed.',
      true
    );
  if (!response.ok) return { response: json(response.status, body) };
  const principal = parseOperator(body);
  if (
    principal.capabilities.length !== 1 ||
    principal.capabilities[0] !== LITE_SUPER_ADMIN_READ_AUTHORITY
  )
    return {
      response: json(403, {
        code: 'PERMISSION_DENIED',
        message: `Exact ${LITE_SUPER_ADMIN_READ_AUTHORITY} authority is required.`
      })
    };
  return { principal };
}

export function createGatewayLiteSuperAdminRoutes(
  options: GatewayLiteSuperAdminOptions
): readonly JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/api/internal/super-admin/lite',
      async handle(request) {
        const token = sessionToken(request);
        const resolved = await resolveOperator(request, token, options);
        if ('response' in resolved) return resolved.response;
        const r = runtime(options);
        let response: Response;
        try {
          response = await r.fetchImpl(`${r.liteUrl}/internal/super-admin/lite`, {
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
            'LITE_ADMIN_OWNER_UNAVAILABLE',
            'Lite owner administration read is unavailable.',
            true
          );
        }
        const body: unknown = await response.json().catch(() => undefined);
        if (!response.ok) {
          if (body === undefined)
            throw new HttpError(
              503,
              'LITE_ADMIN_OWNER_UNAVAILABLE',
              'Lite owner administration read is unavailable.',
              true
            );
          return json(response.status, body);
        }
        const parsed = parseOwner(body);
        if (!parsed)
          throw new HttpError(
            503,
            'LITE_ADMIN_OWNER_CONTRACT_MISMATCH',
            'Lite owner administration response is malformed.',
            true
          );
        return json(200, parsed);
      }
    }
  ];
}
