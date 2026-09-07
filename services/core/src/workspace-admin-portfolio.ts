import type { WorkspaceStatus } from '@markorbit/contracts';
import type { QueryClient } from '@markorbit/persistence';

export const WORKSPACE_ADMIN_PORTFOLIO_OBJECT_TYPE = 'WORKSPACE_ADMIN_PORTFOLIO_RESULT' as const;
export const WORKSPACE_ADMIN_PORTFOLIO_AUTHORITY = 'workspace-admin:read' as const;

export interface WorkspaceAdminPortfolioQueryV1 {
  page: number;
  pageSize: number;
  status?: WorkspaceStatus;
  search?: string;
}

export interface WorkspaceAdminPortfolioItemV1 {
  workspaceId: string;
  name: string;
  slug: string;
  status: WorkspaceStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  membershipCount: number;
  activeMembershipCount: number;
}
export interface WorkspaceAdminPortfolioResultV1 {
  schemaVersion: 1;
  objectType: typeof WORKSPACE_ADMIN_PORTFOLIO_OBJECT_TYPE;
  owner: 'CORE';
  access: 'READ_ONLY';
  requiredAuthority: typeof WORKSPACE_ADMIN_PORTFOLIO_AUTHORITY;
  observedAt: string;
  page: number;
  pageSize: number;
  total: number;
  items: readonly WorkspaceAdminPortfolioItemV1[];
}

export interface WorkspaceAdminPortfolioReaderV1 {
  read(query: WorkspaceAdminPortfolioQueryV1): Promise<WorkspaceAdminPortfolioResultV1>;
}

type WorkspacePortfolioRow = Record<string, unknown>;

function timestamp(value: unknown, field: string): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.valueOf())) throw new Error(`${field} is invalid.`);
  return date.toISOString();
}
function integer(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`${field} is invalid.`);
  return number;
}

function item(row: WorkspacePortfolioRow): WorkspaceAdminPortfolioItemV1 {
  const status = String(row.status);
  if (status !== 'ACTIVE' && status !== 'ARCHIVED') throw new Error('Workspace status is invalid.');
  return {
    workspaceId: String(row.workspace_id),
    name: String(row.name),
    slug: String(row.slug),
    status,
    version: integer(row.version, 'Workspace version'),
    createdAt: timestamp(row.created_at, 'Workspace createdAt'),
    updatedAt: timestamp(row.updated_at, 'Workspace updatedAt'),
    membershipCount: integer(row.membership_count, 'Membership count'),
    activeMembershipCount: integer(row.active_membership_count, 'Active membership count')
  };
}

export class PostgresWorkspaceAdminPortfolioReaderV1 implements WorkspaceAdminPortfolioReaderV1 {
  constructor(
    private readonly queryClient: QueryClient,
    private readonly now = () => new Date()
  ) {}
  async read(query: WorkspaceAdminPortfolioQueryV1): Promise<WorkspaceAdminPortfolioResultV1> {
    const offset = (query.page - 1) * query.pageSize;
    const result = await this.queryClient.query(
      `WITH membership_counts AS (
         SELECT workspace_id,
                COUNT(*)::int AS membership_count,
                COUNT(*) FILTER (WHERE status='ACTIVE')::int AS active_membership_count
         FROM workspace_memberships
         GROUP BY workspace_id
       ), filtered AS (
         SELECT w.workspace_id,w.name,w.slug,w.status,w.version,w.created_at,w.updated_at,
                COALESCE(m.membership_count,0)::int AS membership_count,
                COALESCE(m.active_membership_count,0)::int AS active_membership_count
         FROM workspaces w
         LEFT JOIN membership_counts m ON m.workspace_id=w.workspace_id
         WHERE ($1::text IS NULL OR w.status=$1)
           AND ($2::text IS NULL OR w.workspace_id::text=$2 OR lower(w.name)=lower($2))
       ), page_rows AS (
         SELECT * FROM filtered ORDER BY lower(name), workspace_id LIMIT $3 OFFSET $4
       ), total AS (
         SELECT COUNT(*)::int AS total_count FROM filtered
       )
       SELECT p.*,t.total_count FROM total t LEFT JOIN page_rows p ON true
       ORDER BY lower(p.name),p.workspace_id`,
      [query.status ?? null, query.search ?? null, query.pageSize, offset]
    );
    const rows = result.rows.map((row) => row as WorkspacePortfolioRow);
    const items = rows.filter((row) => row.workspace_id != null).map(item);
    const firstRow = result.rows[0] as WorkspacePortfolioRow | undefined;
    const total = firstRow ? integer(firstRow.total_count, 'Workspace total') : 0;
    return Object.freeze({
      schemaVersion: 1,
      objectType: WORKSPACE_ADMIN_PORTFOLIO_OBJECT_TYPE,
      owner: 'CORE',
      access: 'READ_ONLY',
      requiredAuthority: WORKSPACE_ADMIN_PORTFOLIO_AUTHORITY,
      observedAt: this.now().toISOString(),
      page: query.page,
      pageSize: query.pageSize,
      total,
      items: Object.freeze(items)
    });
  }
}
