export type WorkspaceAdminStatus = 'ACTIVE' | 'ARCHIVED';
export type WorkspaceAdminSort = 'NAME' | 'CREATED_AT' | 'UPDATED_AT' | 'MEMBERS';
export type WorkspaceAdminDirection = 'ASC' | 'DESC';

export interface WorkspaceAdminItem {
  workspaceId: string;
  name: string;
  slug: string;
  status: WorkspaceAdminStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  membershipCount: number;
  activeMembershipCount: number;
}

export interface WorkspaceAdminPortfolio {
  schemaVersion: 1;
  objectType: 'WORKSPACE_ADMIN_PORTFOLIO_RESULT';
  owner: 'CORE';
  access: 'READ_ONLY';
  requiredAuthority: 'workspace-admin:read';
  observedAt: string;
  page: number;
  pageSize: number;
  sort: WorkspaceAdminSort;
  direction: WorkspaceAdminDirection;
  total: number;
  summary: {
    total: number;
    byStatus: Readonly<{ ACTIVE: number; ARCHIVED: number }>;
  };
  items: readonly WorkspaceAdminItem[];
}

export interface WorkspaceAdminPortfolioQuery {
  page: number;
  pageSize: number;
  status?: WorkspaceAdminStatus;
  search?: string;
  sort: WorkspaceAdminSort;
  direction: WorkspaceAdminDirection;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function timestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
function nonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function item(value: unknown): WorkspaceAdminItem | undefined {
  const source = record(value);
  if (!source) return undefined;
  if (
    !text(source.workspaceId) ||
    !text(source.name) ||
    !text(source.slug) ||
    (source.status !== 'ACTIVE' && source.status !== 'ARCHIVED') ||
    !nonNegativeInteger(source.version) ||
    !timestamp(source.createdAt) ||
    !timestamp(source.updatedAt) ||
    !nonNegativeInteger(source.membershipCount) ||
    !nonNegativeInteger(source.activeMembershipCount) ||
    source.activeMembershipCount > source.membershipCount
  )
    return undefined;
  return {
    workspaceId: source.workspaceId,
    name: source.name,
    slug: source.slug,
    status: source.status,
    version: source.version,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
    membershipCount: source.membershipCount,
    activeMembershipCount: source.activeMembershipCount
  };
}
export function parseWorkspaceAdminPortfolio(value: unknown): WorkspaceAdminPortfolio | undefined {
  const source = record(value);
  const summary = record(source?.summary);
  const byStatus = record(summary?.byStatus);
  if (!source || !summary || !byStatus || !Array.isArray(source.items)) return undefined;
  const items = source.items.map(item);
  if (
    source.schemaVersion !== 1 ||
    source.objectType !== 'WORKSPACE_ADMIN_PORTFOLIO_RESULT' ||
    source.owner !== 'CORE' ||
    source.access !== 'READ_ONLY' ||
    source.requiredAuthority !== 'workspace-admin:read' ||
    !timestamp(source.observedAt) ||
    !nonNegativeInteger(source.page) ||
    source.page < 1 ||
    !nonNegativeInteger(source.pageSize) ||
    source.pageSize < 1 ||
    !['NAME', 'CREATED_AT', 'UPDATED_AT', 'MEMBERS'].includes(String(source.sort)) ||
    !['ASC', 'DESC'].includes(String(source.direction)) ||
    !nonNegativeInteger(source.total) ||
    !nonNegativeInteger(summary.total) ||
    !nonNegativeInteger(byStatus.ACTIVE) ||
    !nonNegativeInteger(byStatus.ARCHIVED) ||
    byStatus.ACTIVE + byStatus.ARCHIVED !== summary.total ||
    source.total > summary.total ||
    items.some((entry) => entry === undefined)
  )
    return undefined;
  return {
    schemaVersion: 1,
    objectType: 'WORKSPACE_ADMIN_PORTFOLIO_RESULT',
    owner: 'CORE',
    access: 'READ_ONLY',
    requiredAuthority: 'workspace-admin:read',
    observedAt: source.observedAt,
    page: source.page,
    pageSize: source.pageSize,
    sort: source.sort as WorkspaceAdminSort,
    direction: source.direction as WorkspaceAdminDirection,
    total: source.total,
    summary: {
      total: summary.total,
      byStatus: { ACTIVE: byStatus.ACTIVE, ARCHIVED: byStatus.ARCHIVED }
    },
    items: items as WorkspaceAdminItem[]
  };
}

function failureCode(value: unknown): string {
  const source = record(value);
  return typeof source?.code === 'string' ? ` · ${source.code}` : '';
}

export async function loadWorkspaceAdminPortfolio(
  query: WorkspaceAdminPortfolioQuery,
  fetchImpl: typeof fetch = fetch
): Promise<WorkspaceAdminPortfolio> {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    sort: query.sort,
    direction: query.direction
  });
  if (query.status) params.set('status', query.status);
  if (query.search) params.set('search', query.search);
  const response = await fetchImpl(`/api/internal/super-admin/workspaces?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
    headers: { accept: 'application/json' }
  });
  const value: unknown = await response.json().catch(() => undefined);
  if (!response.ok)
    throw new Error(`Workspace portfolio unavailable (${response.status}${failureCode(value)}).`);
  const parsed = parseWorkspaceAdminPortfolio(value);
  if (!parsed)
    throw new Error('Workspace portfolio owner response is malformed and cannot be trusted.');
  if (
    parsed.page !== query.page ||
    parsed.pageSize !== query.pageSize ||
    parsed.sort !== query.sort ||
    parsed.direction !== query.direction
  )
    throw new Error(
      'Workspace portfolio owner response does not match the requested page or sort.'
    );
  return parsed;
}

export interface WorkspaceAdminManagedWorkspace {
  workspaceId: string;
  name: string;
  slug: string;
  status: WorkspaceAdminStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

function parseManagedWorkspace(value: unknown): WorkspaceAdminManagedWorkspace | undefined {
  const source = record(value);
  if (!source) return undefined;
  if (!text(source.workspaceId) || !text(source.name) || !text(source.slug)) return undefined;
  if (source.status !== 'ACTIVE' && source.status !== 'ARCHIVED') return undefined;
  if (!nonNegativeInteger(source.version) || source.version < 1) return undefined;
  if (!timestamp(source.createdAt) || !timestamp(source.updatedAt)) return undefined;
  return {
    workspaceId: source.workspaceId,
    name: source.name,
    slug: source.slug,
    status: source.status,
    version: source.version,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt
  };
}

export async function renameWorkspaceDisplayName(
  workspaceId: string,
  expectedVersion: number,
  displayName: string,
  reason: string,
  fetchImpl: typeof fetch = fetch
): Promise<WorkspaceAdminManagedWorkspace> {
  const sessionResponse = await fetchImpl('/api/auth/session', {
    method: 'GET',
    credentials: 'include',
    headers: { accept: 'application/json' }
  });
  const session = record(await sessionResponse.json().catch(() => undefined));
  const csrfToken = text(session?.csrfToken) ? session.csrfToken : undefined;
  if (!sessionResponse.ok || !csrfToken)
    throw new Error('Workspace management session is unavailable.');
  const response = await fetchImpl(
    `/api/internal/super-admin/workspaces/${encodeURIComponent(workspaceId)}/display-name`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-markorbit-csrf-token': csrfToken,
        'idempotency-key': globalThis.crypto.randomUUID()
      },
      body: JSON.stringify({ expectedVersion, displayName, reason })
    }
  );
  const value: unknown = await response.json().catch(() => undefined);
  if (!response.ok)
    throw new Error(`Workspace rename unavailable (${response.status}${failureCode(value)}).`);
  const parsed = parseManagedWorkspace(value);
  if (!parsed)
    throw new Error('Workspace rename owner response is malformed and cannot be trusted.');
  return parsed;
}
