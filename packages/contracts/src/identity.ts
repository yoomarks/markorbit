export const USER_STATUSES = ['ACTIVE', 'DISABLED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
export const WORKSPACE_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
export type WorkspaceStatus = (typeof WORKSPACE_STATUSES)[number];
export const MEMBERSHIP_STATUSES = ['ACTIVE', 'SUSPENDED'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];
export const ROLES = ['WORKSPACE_ADMIN', 'MATTER_MANAGER', 'REVIEWER', 'READ_ONLY'] as const;
export type Role = (typeof ROLES)[number];
export const PERMISSIONS = [
  'workspace:read',
  'workspace:manage',
  'membership:read',
  'membership:manage',
  'matter:read',
  'matter:create',
  'matter:manage',
  'matter:promote-knowledge',
  'order:create',
  'order:read',
  'order:update',
  'order:confirm',
  'order:matter:create',
  'order:cancel',
  'order:audit:read',
  'review:read',
  'review:perform',
  'execution:read',
  'execution:manage',
  'document-package:read',
  'document-package:prepare',
  'instruction-ledger:read',
  'instruction-ledger:write',
  'document-package:mark-ready',
  'audit:read'
] as const;
export type Permission = (typeof PERMISSIONS)[number];
export const ROLE_PERMISSION_MATRIX = Object.freeze({
  WORKSPACE_ADMIN: PERMISSIONS,
  MATTER_MANAGER: Object.freeze([
    'workspace:read',
    'matter:read',
    'matter:create',
    'matter:manage',
    'matter:promote-knowledge',
    'order:create',
    'order:read',
    'order:update',
    'order:confirm',
    'order:matter:create',
    'order:cancel',
    'order:audit:read',
    'review:read',
    'review:perform',
    'execution:read',
    'execution:manage',
    'document-package:read',
    'document-package:prepare',
    'instruction-ledger:read',
    'instruction-ledger:write',
    'document-package:mark-ready',
    'audit:read'
  ] as const),
  REVIEWER: Object.freeze([
    'workspace:read',
    'matter:read',
    'order:read',
    'review:read',
    'review:perform',
    'execution:read',
    'execution:manage',
    'document-package:read',
    'document-package:prepare',
    'instruction-ledger:read',
    'instruction-ledger:write',
    'document-package:mark-ready'
  ] as const),
  READ_ONLY: Object.freeze([
    'workspace:read',
    'matter:read',
    'order:read',
    'review:read',
    'execution:read',
    'document-package:read',
    'instruction-ledger:read'
  ] as const)
} satisfies Readonly<Record<Role, readonly Permission[]>>);

export interface User {
  userId: string;
  email: string;
  normalizedEmail: string;
  displayName: string;
  status: UserStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface Workspace {
  workspaceId: string;
  name: string;
  slug: string;
  status: WorkspaceStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface WorkspaceMembership {
  membershipId: string;
  workspaceId: string;
  userId: string;
  role: Role;
  status: MembershipStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface CreateWorkspaceCommand {
  name: string;
  slug?: string;
}
export interface WorkspaceEntry {
  workspace: Workspace;
  membership: WorkspaceMembership;
}
export interface WorkspacePrincipal {
  kind: 'WORKSPACE';
  userId: string;
  workspaceId: string;
  membershipId: string;
  role: Role;
  permissions: readonly Permission[];
  authenticatedAt: string;
}
