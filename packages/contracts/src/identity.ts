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
export type UserIdentity = Pick<User, 'userId'>;
export type WorkspaceIdentity = Pick<Workspace, 'workspaceId'>;
export type MembershipIdentity = Pick<
  WorkspaceMembership,
  'membershipId' | 'workspaceId' | 'userId'
>;

export type IdentityErrorCode =
  | 'INVALID_USER'
  | 'INVALID_WORKSPACE'
  | 'INVALID_MEMBERSHIP'
  | 'DUPLICATE_NORMALIZED_EMAIL'
  | 'DUPLICATE_WORKSPACE_SLUG'
  | 'DUPLICATE_MEMBERSHIP'
  | 'USER_NOT_FOUND'
  | 'WORKSPACE_NOT_FOUND'
  | 'MEMBERSHIP_NOT_FOUND'
  | 'USER_DISABLED'
  | 'WORKSPACE_ARCHIVED'
  | 'MEMBERSHIP_SUSPENDED'
  | 'STALE_VERSION'
  | 'INVALID_ROLE'
  | 'INVALID_PERMISSION'
  | 'WORKSPACE_SCOPE_MISMATCH'
  | 'PERSISTENCE_UNAVAILABLE';
export class IdentityError extends Error {
  constructor(
    public readonly code: IdentityErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'IdentityError';
  }
}

export interface UserRepository {
  create(input: Pick<User, 'userId' | 'email' | 'displayName'>): Promise<User>;
  findById(userId: string): Promise<User | null>;
  findByNormalizedEmail(normalizedEmail: string): Promise<User | null>;
  update(
    userId: string,
    expectedVersion: number,
    input: Pick<User, 'email' | 'displayName'>
  ): Promise<User>;
  disable(userId: string, expectedVersion: number): Promise<User>;
}
export interface WorkspaceRepository {
  create(input: Pick<Workspace, 'workspaceId' | 'name' | 'slug'>): Promise<Workspace>;
  findById(workspaceId: string): Promise<Workspace | null>;
  findBySlug(slug: string): Promise<Workspace | null>;
  update(
    workspaceId: string,
    expectedVersion: number,
    input: Pick<Workspace, 'name' | 'slug'>
  ): Promise<Workspace>;
  archive(workspaceId: string, expectedVersion: number): Promise<Workspace>;
}
export interface MembershipRepository {
  create(
    input: Pick<WorkspaceMembership, 'membershipId' | 'workspaceId' | 'userId' | 'role'>
  ): Promise<WorkspaceMembership>;
  findByWorkspaceAndUser(workspaceId: string, userId: string): Promise<WorkspaceMembership | null>;
  listByUser(userId: string): Promise<WorkspaceMembership[]>;
  listByWorkspace(workspaceId: string): Promise<WorkspaceMembership[]>;
  changeRole(
    workspaceId: string,
    userId: string,
    expectedVersion: number,
    role: Role
  ): Promise<WorkspaceMembership>;
  suspend(
    workspaceId: string,
    userId: string,
    expectedVersion: number
  ): Promise<WorkspaceMembership>;
}
