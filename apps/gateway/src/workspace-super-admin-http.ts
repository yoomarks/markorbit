import {
  encodeInternalOperatorPrincipal,
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
import { readSessionCookie, requireTrustedOrigin, validateCsrf } from './auth.js';

export const WORKSPACE_SUPER_ADMIN_READ_AUTHORITY = 'workspace-admin:read' as const;
export const WORKSPACE_SUPER_ADMIN_MANAGE_AUTHORITY = 'workspace-admin:manage' as const;

export interface GatewayWorkspaceSuperAdminOptions {
  coreUrl?: string;
  internalServiceSecret?: string;
  operatorTimeoutMs?: number;
  ownerTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  csrfSecret?: string;
  allowedOrigins?: readonly string[];
}

export interface WorkspaceSuperAdminItem {
  workspaceId: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'ARCHIVED';
  version: number;
  createdAt: string;
  updatedAt: string;
  membershipCount: number;
  activeMembershipCount: number;
}
export interface WorkspaceSuperAdminResult {
  schemaVersion: 1;
  objectType: 'WORKSPACE_ADMIN_PORTFOLIO_RESULT';
  owner: 'CORE';
  access: 'READ_ONLY';
  requiredAuthority: typeof WORKSPACE_SUPER_ADMIN_READ_AUTHORITY;
  observedAt: string;
  page: number;
  pageSize: number;
  sort: 'NAME' | 'CREATED_AT' | 'UPDATED_AT' | 'MEMBERS';
  direction: 'ASC' | 'DESC';
  total: number;
  summary: { total: number; byStatus: { ACTIVE: number; ARCHIVED: number } };
  items: readonly WorkspaceSuperAdminItem[];
}

const QUERY_KEYS = new Set(['page', 'pageSize', 'status', 'search', 'sort', 'direction']);

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
function runtime(options: GatewayWorkspaceSuperAdminOptions) {
  const coreUrl = (options.coreUrl ?? process.env.CORE_URL ?? 'http://127.0.0.1:4101').replace(
    /\/$/u,
    ''
  );
  const internalServiceSecret = (
    options.internalServiceSecret ??
    process.env.MO_INTERNAL_SERVICE_SECRET ??
    ''
  ).trim();
  const operatorTimeoutMs = options.operatorTimeoutMs ?? 3_000;
  const ownerTimeoutMs = options.ownerTimeoutMs ?? 3_000;
  if (
    !internalServiceSecret ||
    !Number.isSafeInteger(operatorTimeoutMs) ||
    operatorTimeoutMs < 1 ||
    !Number.isSafeInteger(ownerTimeoutMs) ||
    ownerTimeoutMs < 1
  )
    throw new HttpError(
      503,
      'WORKSPACE_ADMIN_CONFIGURATION_UNAVAILABLE',
      'Workspace administration integration is unavailable.',
      true
    );
  return {
    coreUrl,
    internalServiceSecret,
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
      'WORKSPACE_ADMIN_OPERATOR_RESPONSE_INVALID',
      'Core Workspace Admin operator response is malformed.',
      true
    );
  }
}

function ownerQuery(request: JsonRequest): string {
  const unsupported = Object.keys(request.query).filter((key) => !QUERY_KEYS.has(key));
  if (unsupported.length)
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      `Unsupported query fields: ${unsupported.join(', ')}.`
    );
  const search = new URLSearchParams();
  for (const key of ['page', 'pageSize', 'status', 'search', 'sort', 'direction'] as const) {
    const value = request.query[key];
    if (value !== undefined) search.set(key, value);
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}
async function resolveOperator(
  request: JsonRequest,
  token: string,
  options: GatewayWorkspaceSuperAdminOptions,
  requiredAuthority:
    typeof WORKSPACE_SUPER_ADMIN_READ_AUTHORITY | typeof WORKSPACE_SUPER_ADMIN_MANAGE_AUTHORITY,
  resolverPath: string
): Promise<{ principal: InternalOperatorPrincipal } | { response: JsonResult }> {
  const configured = runtime(options);
  let response: Response;
  try {
    response = await configured.fetchImpl(`${configured.coreUrl}${resolverPath}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-markorbit-internal-authorization': configured.internalServiceSecret,
        ...correlationHeaders(request)
      },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(configured.operatorTimeoutMs)
    });
  } catch {
    throw new HttpError(
      503,
      'AUTHENTICATION_SERVICE_UNAVAILABLE',
      'Workspace Admin operator authentication is unavailable.',
      true
    );
  }
  const value: unknown = await response.json().catch(() => undefined);
  if (value === undefined)
    throw new HttpError(
      503,
      'WORKSPACE_ADMIN_OPERATOR_RESPONSE_INVALID',
      'Core Workspace Admin operator response is malformed.',
      true
    );
  if (!response.ok) return { response: json(response.status, value) };
  const principal = parseOperator(value);
  if (principal.capabilities.length !== 1 || principal.capabilities[0] !== requiredAuthority)
    return {
      response: json(403, {
        code: 'PERMISSION_DENIED',
        message: `Exact ${requiredAuthority} authority is required.`
      })
    };
  return { principal };
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function parseItem(value: unknown): WorkspaceSuperAdminItem | null {
  const candidate = record(value);
  if (!candidate) return null;
  const workspaceId = text(candidate.workspaceId);
  const name = text(candidate.name);
  const slug = text(candidate.slug);
  const status = candidate.status;
  const version = nonNegativeInteger(candidate.version);
  const createdAt = text(candidate.createdAt);
  const updatedAt = text(candidate.updatedAt);
  const membershipCount = nonNegativeInteger(candidate.membershipCount);
  const activeMembershipCount = nonNegativeInteger(candidate.activeMembershipCount);
  if (
    !workspaceId ||
    !name ||
    !slug ||
    (status !== 'ACTIVE' && status !== 'ARCHIVED') ||
    version === null ||
    !createdAt ||
    !updatedAt ||
    membershipCount === null ||
    activeMembershipCount === null ||
    activeMembershipCount > membershipCount ||
    !Number.isFinite(Date.parse(createdAt)) ||
    !Number.isFinite(Date.parse(updatedAt))
  )
    return null;
  return {
    workspaceId,
    name,
    slug,
    status,
    version,
    createdAt,
    updatedAt,
    membershipCount,
    activeMembershipCount
  };
}
function parseOwnerResult(value: unknown): WorkspaceSuperAdminResult | null {
  const candidate = record(value);
  if (!candidate || !Array.isArray(candidate.items)) return null;
  const page = nonNegativeInteger(candidate.page);
  const pageSize = nonNegativeInteger(candidate.pageSize);
  const sort = candidate.sort;
  const direction = candidate.direction;
  const total = nonNegativeInteger(candidate.total);
  const summary = record(candidate.summary);
  const byStatus = record(summary?.byStatus);
  const summaryTotal = nonNegativeInteger(summary?.total);
  const activeTotal = nonNegativeInteger(byStatus?.ACTIVE);
  const archivedTotal = nonNegativeInteger(byStatus?.ARCHIVED);
  const observedAt = text(candidate.observedAt);
  const items = candidate.items.map(parseItem);
  if (
    candidate.schemaVersion !== 1 ||
    candidate.objectType !== 'WORKSPACE_ADMIN_PORTFOLIO_RESULT' ||
    candidate.owner !== 'CORE' ||
    candidate.access !== 'READ_ONLY' ||
    candidate.requiredAuthority !== WORKSPACE_SUPER_ADMIN_READ_AUTHORITY ||
    !observedAt ||
    !Number.isFinite(Date.parse(observedAt)) ||
    page === null ||
    page < 1 ||
    pageSize === null ||
    pageSize < 1 ||
    !['NAME', 'CREATED_AT', 'UPDATED_AT', 'MEMBERS'].includes(String(sort)) ||
    !['ASC', 'DESC'].includes(String(direction)) ||
    total === null ||
    summaryTotal === null ||
    activeTotal === null ||
    archivedTotal === null ||
    activeTotal + archivedTotal !== summaryTotal ||
    total > summaryTotal ||
    items.some((item) => item === null)
  )
    return null;
  return {
    schemaVersion: 1,
    objectType: 'WORKSPACE_ADMIN_PORTFOLIO_RESULT',
    owner: 'CORE',
    access: 'READ_ONLY',
    requiredAuthority: WORKSPACE_SUPER_ADMIN_READ_AUTHORITY,
    observedAt,
    page,
    pageSize,
    sort: sort as WorkspaceSuperAdminResult['sort'],
    direction: direction as WorkspaceSuperAdminResult['direction'],
    total,
    summary: {
      total: summaryTotal,
      byStatus: { ACTIVE: activeTotal, ARCHIVED: archivedTotal }
    },
    items: items as WorkspaceSuperAdminItem[]
  };
}
async function readOwner(
  request: JsonRequest,
  query: string,
  principal: InternalOperatorPrincipal,
  options: GatewayWorkspaceSuperAdminOptions
): Promise<JsonResult> {
  const configured = runtime(options);
  let response: Response;
  try {
    response = await configured.fetchImpl(
      `${configured.coreUrl}/internal/super-admin/workspaces${query}`,
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-markorbit-internal-authorization': configured.internalServiceSecret,
          'x-markorbit-principal': encodeInternalOperatorPrincipal(principal),
          ...correlationHeaders(request)
        },
        signal: AbortSignal.timeout(configured.ownerTimeoutMs)
      }
    );
  } catch {
    throw new HttpError(
      503,
      'WORKSPACE_ADMIN_OWNER_UNAVAILABLE',
      'Core Workspace portfolio read is unavailable.',
      true
    );
  }
  const value: unknown = await response.json().catch(() => undefined);
  if (!response.ok)
    return json(
      response.status,
      value ?? {
        code: 'WORKSPACE_ADMIN_OWNER_FAILURE',
        message: 'Core Workspace portfolio read failed.'
      }
    );
  const parsed = parseOwnerResult(value);
  if (!parsed)
    throw new HttpError(
      503,
      'WORKSPACE_ADMIN_OWNER_CONTRACT_MISMATCH',
      'Core Workspace portfolio response is malformed.',
      true
    );
  return json(200, parsed);
}

interface WorkspaceSuperAdminManagedWorkspace {
  workspaceId: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'ARCHIVED';
  version: number;
  createdAt: string;
  updatedAt: string;
}

function parseManagedWorkspace(value: unknown): WorkspaceSuperAdminManagedWorkspace | null {
  const candidate = record(value);
  if (!candidate) return null;
  const workspaceId = text(candidate.workspaceId);
  const name = text(candidate.name);
  const slug = text(candidate.slug);
  const status = candidate.status;
  const version = nonNegativeInteger(candidate.version);
  const createdAt = text(candidate.createdAt);
  const updatedAt = text(candidate.updatedAt);
  if (
    !workspaceId ||
    !name ||
    !slug ||
    (status !== 'ACTIVE' && status !== 'ARCHIVED') ||
    version === null ||
    version < 1 ||
    !createdAt ||
    !updatedAt ||
    !Number.isFinite(Date.parse(createdAt)) ||
    !Number.isFinite(Date.parse(updatedAt))
  )
    return null;
  return { workspaceId, name, slug, status, version, createdAt, updatedAt };
}

async function manageDisplayName(
  request: JsonRequest,
  options: GatewayWorkspaceSuperAdminOptions
): Promise<JsonResult> {
  const token = sessionToken(request);
  const operator = await resolveOperator(
    request,
    token,
    options,
    WORKSPACE_SUPER_ADMIN_MANAGE_AUTHORITY,
    '/internal/super-admin/workspace/manage/operator-principals/resolve'
  );
  if ('response' in operator) return operator.response;
  requireTrustedOrigin(request.headers.origin, options.allowedOrigins ?? []);
  validateCsrf(
    operator.principal.sessionId,
    options.csrfSecret ?? '',
    request.headers['x-markorbit-csrf-token']
  );
  const key = request.headers['idempotency-key'];
  if (!key) throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required.');
  const workspaceId = request.params.workspaceId;
  if (!workspaceId) throw new HttpError(400, 'INVALID_REQUEST', 'Workspace target is required.');
  const configured = runtime(options);
  let response: Response;
  try {
    response = await configured.fetchImpl(
      `${configured.coreUrl}/internal/super-admin/workspaces/${encodeURIComponent(workspaceId)}/display-name`,
      {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': configured.internalServiceSecret,
          'x-markorbit-principal': encodeInternalOperatorPrincipal(operator.principal),
          'idempotency-key': key,
          ...correlationHeaders(request)
        },
        body: JSON.stringify(request.body ?? {}),
        signal: AbortSignal.timeout(configured.ownerTimeoutMs)
      }
    );
  } catch {
    throw new HttpError(
      503,
      'WORKSPACE_ADMIN_OWNER_UNAVAILABLE',
      'Core Workspace management is unavailable.',
      true
    );
  }
  const value: unknown = await response.json().catch(() => undefined);
  if (!response.ok)
    return json(
      response.status,
      value ?? {
        code: 'WORKSPACE_ADMIN_OWNER_FAILURE',
        message: 'Core Workspace management failed.'
      }
    );
  const managed = parseManagedWorkspace(value);
  if (!managed)
    throw new HttpError(
      503,
      'WORKSPACE_ADMIN_OWNER_CONTRACT_MISMATCH',
      'Core Workspace management response is malformed.',
      true
    );
  return json(200, managed);
}

export function createGatewayWorkspaceSuperAdminRoutes(
  options: GatewayWorkspaceSuperAdminOptions
): readonly JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/api/internal/super-admin/workspaces',
      handle: async (request) => {
        const query = ownerQuery(request);
        const token = sessionToken(request);
        const operator = await resolveOperator(
          request,
          token,
          options,
          WORKSPACE_SUPER_ADMIN_READ_AUTHORITY,
          '/internal/super-admin/workspace/operator-principals/resolve'
        );
        if ('response' in operator) return operator.response;
        return readOwner(request, query, operator.principal, options);
      }
    },
    {
      method: 'PATCH',
      path: '/api/internal/super-admin/workspaces/:workspaceId/display-name',
      handle: (request) => manageDisplayName(request, options)
    }
  ];
}
