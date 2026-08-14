import {
  IdentityError,
  type CreateWorkspaceCommand,
  type WorkspaceEntry,
  type WorkspaceMembership,
  type UserRepository,
  type WorkspaceRepository,
  type MembershipRepository
} from '@markorbit/contracts';
import type { ManagedDatabase } from '@markorbit/persistence';
import { uuidV7 } from './auth.js';
import {
  normalizeSlug,
  PostgresMembershipRepository,
  PostgresUserRepository,
  PostgresWorkspaceRepository
} from './identity.js';

export interface AccountOnboardingRepository {
  createWorkspaceForUser(userId: string, command: CreateWorkspaceCommand): Promise<WorkspaceEntry>;
  listWorkspacesForUser(userId: string): Promise<readonly WorkspaceEntry[]>;
}

export class InMemoryAccountOnboardingRepository implements AccountOnboardingRepository {
  constructor(
    private readonly users: UserRepository,
    private readonly workspaces: WorkspaceRepository,
    private readonly memberships: MembershipRepository
  ) {}

  async createWorkspaceForUser(
    userId: string,
    command: CreateWorkspaceCommand
  ): Promise<WorkspaceEntry> {
    const user = await this.users.findById(userId);
    if (!user) throw new IdentityError('USER_NOT_FOUND', 'User was not found.');
    if (user.status !== 'ACTIVE') throw new IdentityError('USER_DISABLED', 'User is disabled.');
    const baseSlug = normalizeSlug(command.slug ?? command.name);
    if (!baseSlug) throw new IdentityError('INVALID_WORKSPACE', 'Workspace data is invalid.');
    const workspace = await this.workspaces.create({
      workspaceId: uuidV7(),
      name: command.name,
      slug: baseSlug
    });
    const membership = await this.memberships.create({
      membershipId: uuidV7(),
      workspaceId: workspace.workspaceId,
      userId,
      role: 'WORKSPACE_ADMIN'
    });
    return { workspace, membership };
  }

  async listWorkspacesForUser(userId: string): Promise<readonly WorkspaceEntry[]> {
    const memberships = await this.memberships.listByUser(userId);
    const entries = await Promise.all(
      memberships
        .filter((membership) => membership.status === 'ACTIVE')
        .map(async (membership) => {
          const workspace = await this.workspaces.findById(membership.workspaceId);
          return workspace?.status === 'ACTIVE' ? { workspace, membership } : null;
        })
    );
    return entries.filter((entry): entry is WorkspaceEntry => entry !== null);
  }
}

export class PostgresAccountOnboardingRepository implements AccountOnboardingRepository {
  constructor(private readonly database: ManagedDatabase) {}

  async createWorkspaceForUser(
    userId: string,
    command: CreateWorkspaceCommand
  ): Promise<WorkspaceEntry> {
    return this.database.transact(async (query) => {
      const users = new PostgresUserRepository(query);
      const workspaces = new PostgresWorkspaceRepository(query);
      const memberships = new PostgresMembershipRepository(query);
      const user = await users.findById(userId);
      if (!user) throw new IdentityError('USER_NOT_FOUND', 'User was not found.');
      if (user.status !== 'ACTIVE') throw new IdentityError('USER_DISABLED', 'User is disabled.');
      const baseSlug = normalizeSlug(command.slug ?? command.name);
      if (!baseSlug) throw new IdentityError('INVALID_WORKSPACE', 'Workspace data is invalid.');
      const workspace = await workspaces.create({
        workspaceId: uuidV7(),
        name: command.name,
        slug: baseSlug
      });
      const membership = await memberships.create({
        membershipId: uuidV7(),
        workspaceId: workspace.workspaceId,
        userId,
        role: 'WORKSPACE_ADMIN'
      });
      return { workspace, membership };
    });
  }

  async listWorkspacesForUser(userId: string): Promise<readonly WorkspaceEntry[]> {
    const query = this.database.getPool();
    const memberships = new PostgresMembershipRepository(query);
    const workspaces = new PostgresWorkspaceRepository(query);
    const rows = await memberships.listByUser(userId);
    const entries = await Promise.all(
      rows
        .filter((membership: WorkspaceMembership) => membership.status === 'ACTIVE')
        .map(async (membership) => {
          const workspace = await workspaces.findById(membership.workspaceId);
          return workspace?.status === 'ACTIVE' ? { workspace, membership } : null;
        })
    );
    return entries.filter((entry): entry is WorkspaceEntry => entry !== null);
  }
}

export class AccountOnboardingService {
  constructor(private readonly repository: AccountOnboardingRepository) {}

  createWorkspace(userId: string, command: CreateWorkspaceCommand) {
    if (!command.name.trim())
      throw new IdentityError('INVALID_WORKSPACE', 'Workspace name is required.');
    return this.repository.createWorkspaceForUser(userId, command);
  }

  listWorkspaces(userId: string) {
    return this.repository.listWorkspacesForUser(userId);
  }
}
