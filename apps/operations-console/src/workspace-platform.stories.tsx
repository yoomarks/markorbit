import type { Meta, StoryObj } from '@storybook/react';
import type {
  WorkspaceAdminItem,
  WorkspaceAdminPortfolio,
  WorkspaceAdminPortfolioQuery
} from './workspace-admin.js';
import { WorkspacePlatformWorkspace } from './workspace-platform.js';

const items: readonly WorkspaceAdminItem[] = [
  {
    workspaceId: 'workspace_orbit_ip',
    name: 'Orbit IP Partners',
    slug: 'orbit-ip-partners',
    status: 'ACTIVE',
    version: 7,
    createdAt: '2025-02-18T03:00:00.000Z',
    updatedAt: '2026-09-28T06:30:00.000Z',
    membershipCount: 18,
    activeMembershipCount: 16
  },
  {
    workspaceId: 'workspace_northstar',
    name: 'Northstar Trademark Studio',
    slug: 'northstar-trademark',
    status: 'ACTIVE',
    version: 12,
    createdAt: '2024-11-03T02:00:00.000Z',
    updatedAt: '2026-09-27T15:12:00.000Z',
    membershipCount: 42,
    activeMembershipCount: 38
  },
  {
    workspaceId: 'workspace_archive_demo',
    name: 'Archived Migration Workspace',
    slug: 'archived-migration',
    status: 'ARCHIVED',
    version: 4,
    createdAt: '2024-01-08T02:00:00.000Z',
    updatedAt: '2026-08-21T09:45:00.000Z',
    membershipCount: 6,
    activeMembershipCount: 0
  }
];

const load = (query: WorkspaceAdminPortfolioQuery): Promise<WorkspaceAdminPortfolio> =>
  Promise.resolve({
    schemaVersion: 1,
    objectType: 'WORKSPACE_ADMIN_PORTFOLIO_RESULT',
    owner: 'CORE',
    access: 'READ_ONLY',
    requiredAuthority: 'workspace-admin:read',
    observedAt: '2026-09-28T06:45:00.000Z',
    page: query.page,
    pageSize: query.pageSize,
    sort: query.sort,
    direction: query.direction,
    total: 128,
    summary: { total: 128, byStatus: { ACTIVE: 119, ARCHIVED: 9 } },
    items
  } satisfies WorkspaceAdminPortfolio);

export default {
  title: 'Products/Workspace Console',
  component: WorkspacePlatformWorkspace,
  parameters: { layout: 'fullscreen' },
  args: { loadPortfolio: load }
} satisfies Meta<typeof WorkspacePlatformWorkspace>;

export const WorkspaceList: StoryObj<typeof WorkspacePlatformWorkspace> = {};
export const WorkspaceDetail: StoryObj<typeof WorkspacePlatformWorkspace> = {
  args: { initialWorkspaceId: 'workspace_orbit_ip' }
};
