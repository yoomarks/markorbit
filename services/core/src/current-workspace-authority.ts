import {
  PERMISSIONS,
  type MembershipRepository,
  type Permission,
  type UserRepository,
  type WorkspaceRepository
} from '@markorbit/contracts';
import { hasPermission } from './identity.js';

export type CurrentWorkspaceAuthorityErrorCode =
  | 'INVALID_CURRENT_AUTHORITY_REQUEST'
  | 'CURRENT_AUTHORITY_NOT_FOUND'
  | 'CURRENT_AUTHORITY_STALE'
  | 'CURRENT_AUTHORITY_DENIED'
  | 'CURRENT_AUTHORITY_PERMISSION_DENIED'
  | 'CURRENT_AUTHORITY_SOURCE_UNAVAILABLE';

export class CurrentWorkspaceAuthorityError extends Error {
  constructor(
    readonly code: CurrentWorkspaceAuthorityErrorCode,
    message: string,
    readonly status: number,
    readonly retryable = false,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'CurrentWorkspaceAuthorityError';
  }
}

export interface CurrentWorkspaceAuthorityRequest {
  workspaceId: string;
  userId: string;
  membershipId: string;
  expectedWorkspaceVersion?: number;
  expectedUserVersion?: number;
  expectedMembershipVersion?: number;
  requiredPermission?: Permission;
}

export interface CurrentWorkspaceAuthorityResult {
  schemaVersion: 1;
  authorityAvailable: true;
  workspaceCurrent: true;
  userCurrent: true;
  membershipCurrent: true;
  bindingMatches: true;
  permissionCurrent: true | null;
  workspace: Readonly<{
    workspaceId: string;
    version: number;
  }>;
  user: Readonly<{
    userId: string;
    version: number;
  }>;
  membership: Readonly<{
    membershipId: string;
    workspaceId: string;
    userId: string;
    role: string;
    version: number;
  }>;
  requiredPermission: Permission | null;
}

export interface CurrentWorkspaceAuthorityServiceOptions {
  users: Pick<UserRepository, 'findById'>;
  workspaces: Pick<WorkspaceRepository, 'findById'>;
  memberships: Pick<MembershipRepository, 'findByWorkspaceAndUser'>;
}

const canonicalUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value);

const validExpectedVersion = (value: number | undefined) =>
  value === undefined || (Number.isSafeInteger(value) && value >= 1);

export class CurrentWorkspaceAuthorityService {
  constructor(private readonly sources: CurrentWorkspaceAuthorityServiceOptions) {}

  async validate(
    request: Readonly<CurrentWorkspaceAuthorityRequest>
  ): Promise<Readonly<CurrentWorkspaceAuthorityResult>> {
    if (
      !canonicalUuid(request.workspaceId) ||
      !canonicalUuid(request.userId) ||
      !canonicalUuid(request.membershipId) ||
      !validExpectedVersion(request.expectedWorkspaceVersion) ||
      !validExpectedVersion(request.expectedUserVersion) ||
      !validExpectedVersion(request.expectedMembershipVersion) ||
      (request.requiredPermission !== undefined &&
        !(PERMISSIONS as readonly string[]).includes(request.requiredPermission))
    )
      throw new CurrentWorkspaceAuthorityError(
        'INVALID_CURRENT_AUTHORITY_REQUEST',
        'Exact Workspace, user and membership references are required.',
        400
      );

    let user;
    let workspace;
    let membership;
    try {
      [user, workspace, membership] = await Promise.all([
        this.sources.users.findById(request.userId),
        this.sources.workspaces.findById(request.workspaceId),
        this.sources.memberships.findByWorkspaceAndUser(request.workspaceId, request.userId)
      ]);
    } catch (cause) {
      throw new CurrentWorkspaceAuthorityError(
        'CURRENT_AUTHORITY_SOURCE_UNAVAILABLE',
        'Current Workspace authority source is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }

    if (
      !user ||
      !workspace ||
      !membership ||
      membership.membershipId !== request.membershipId ||
      membership.workspaceId !== request.workspaceId ||
      membership.userId !== request.userId
    )
      throw new CurrentWorkspaceAuthorityError(
        'CURRENT_AUTHORITY_NOT_FOUND',
        'Exact current Workspace authority could not be established.',
        404
      );

    if (
      (request.expectedWorkspaceVersion !== undefined &&
        workspace.version !== request.expectedWorkspaceVersion) ||
      (request.expectedUserVersion !== undefined && user.version !== request.expectedUserVersion) ||
      (request.expectedMembershipVersion !== undefined &&
        membership.version !== request.expectedMembershipVersion)
    )
      throw new CurrentWorkspaceAuthorityError(
        'CURRENT_AUTHORITY_STALE',
        'Expected Workspace authority version is no longer current.',
        409
      );

    if (user.status !== 'ACTIVE' || workspace.status !== 'ACTIVE' || membership.status !== 'ACTIVE')
      throw new CurrentWorkspaceAuthorityError(
        'CURRENT_AUTHORITY_DENIED',
        'Workspace authority is no longer current.',
        409
      );

    const permissionCurrent = request.requiredPermission
      ? hasPermission(membership.role, request.requiredPermission, {
          userStatus: user.status,
          workspaceStatus: workspace.status,
          membershipStatus: membership.status
        })
      : null;
    if (permissionCurrent === false)
      throw new CurrentWorkspaceAuthorityError(
        'CURRENT_AUTHORITY_PERMISSION_DENIED',
        'Required current Workspace permission is not present.',
        403
      );

    return Object.freeze({
      schemaVersion: 1,
      authorityAvailable: true,
      workspaceCurrent: true,
      userCurrent: true,
      membershipCurrent: true,
      bindingMatches: true,
      permissionCurrent,
      workspace: Object.freeze({
        workspaceId: workspace.workspaceId,
        version: workspace.version
      }),
      user: Object.freeze({
        userId: user.userId,
        version: user.version
      }),
      membership: Object.freeze({
        membershipId: membership.membershipId,
        workspaceId: membership.workspaceId,
        userId: membership.userId,
        role: membership.role,
        version: membership.version
      }),
      requiredPermission: request.requiredPermission ?? null
    });
  }
}
