import { describe, expect, it } from 'vitest';
import {
  InMemoryMembershipRepository,
  InMemoryUserRepository,
  InMemoryWorkspaceRepository
} from '../src/identity.js';
import { CurrentWorkspaceAuthorityService } from '../src/current-workspace-authority.js';

const ids = {
  user: '018f0000-0000-7000-8000-000000000001',
  workspace: '018f0000-0000-7000-8000-000000000002',
  membership: '018f0000-0000-7000-8000-000000000003',
  otherMembership: '018f0000-0000-7000-8000-000000000004'
};

async function fixture() {
  const users = new InMemoryUserRepository();
  const workspaces = new InMemoryWorkspaceRepository();
  const memberships = new InMemoryMembershipRepository(users, workspaces);
  await users.create({ userId: ids.user, email: 'user@example.test', displayName: 'User' });
  await workspaces.create({ workspaceId: ids.workspace, name: 'Workspace', slug: 'workspace' });
  await memberships.create({
    membershipId: ids.membership,
    userId: ids.user,
    workspaceId: ids.workspace,
    role: 'REVIEWER'
  });
  return {
    users,
    workspaces,
    memberships,
    service: new CurrentWorkspaceAuthorityService({ users, workspaces, memberships })
  };
}

const exact = () => ({
  workspaceId: ids.workspace,
  userId: ids.user,
  membershipId: ids.membership,
  expectedWorkspaceVersion: 1,
  expectedUserVersion: 1,
  expectedMembershipVersion: 1,
  requiredPermission: 'review:perform' as const
});

describe('current Workspace authority verifier', () => {
  it('validates exact active Workspace, user, membership and current permission without a session', async () => {
    const f = await fixture();
    const result = await f.service.validate(exact());

    expect(result).toEqual({
      schemaVersion: 1,
      authorityAvailable: true,
      workspaceCurrent: true,
      userCurrent: true,
      membershipCurrent: true,
      bindingMatches: true,
      permissionCurrent: true,
      workspace: { workspaceId: ids.workspace, version: 1 },
      user: { userId: ids.user, version: 1 },
      membership: {
        membershipId: ids.membership,
        workspaceId: ids.workspace,
        userId: ids.user,
        role: 'REVIEWER',
        version: 1
      },
      requiredPermission: 'review:perform'
    });
    expect(JSON.stringify(result)).not.toContain('user@example.test');
    expect(JSON.stringify(result)).not.toContain('token');
  });

  it('fails privacy-safely when the exact membership reference does not bind', async () => {
    const f = await fixture();
    await expect(
      f.service.validate({ ...exact(), membershipId: ids.otherMembership })
    ).rejects.toMatchObject({
      status: 404,
      code: 'CURRENT_AUTHORITY_NOT_FOUND'
    });
  });

  it('fails closed when an expected canonical version is stale', async () => {
    const f = await fixture();
    await f.memberships.changeRole(ids.workspace, ids.user, 1, 'MATTER_MANAGER');
    await expect(f.service.validate(exact())).rejects.toMatchObject({
      status: 409,
      code: 'CURRENT_AUTHORITY_STALE'
    });
  });

  it('fails closed for disabled users, archived Workspaces and suspended memberships', async () => {
    const disabled = await fixture();
    await disabled.users.disable(ids.user, 1);
    await expect(
      disabled.service.validate({ ...exact(), expectedUserVersion: 2 })
    ).rejects.toMatchObject({ code: 'CURRENT_AUTHORITY_DENIED' });

    const archived = await fixture();
    await archived.workspaces.archive(ids.workspace, 1);
    await expect(
      archived.service.validate({ ...exact(), expectedWorkspaceVersion: 2 })
    ).rejects.toMatchObject({ code: 'CURRENT_AUTHORITY_DENIED' });

    const suspended = await fixture();
    await suspended.memberships.suspend(ids.workspace, ids.user, 1);
    await expect(
      suspended.service.validate({ ...exact(), expectedMembershipVersion: 2 })
    ).rejects.toMatchObject({ code: 'CURRENT_AUTHORITY_DENIED' });
  });

  it('checks an existing Core permission without turning identity currentness into business authority', async () => {
    const f = await fixture();
    await expect(
      f.service.validate({ ...exact(), requiredPermission: 'workspace:manage' })
    ).rejects.toMatchObject({
      status: 403,
      code: 'CURRENT_AUTHORITY_PERMISSION_DENIED'
    });
  });

  it('distinguishes source unavailability from a known authority denial', async () => {
    const f = await fixture();
    const service = new CurrentWorkspaceAuthorityService({
      users: {
        findById: () => Promise.reject(new Error('database unavailable'))
      },
      workspaces: f.workspaces,
      memberships: f.memberships
    });

    await expect(service.validate(exact())).rejects.toMatchObject({
      status: 503,
      code: 'CURRENT_AUTHORITY_SOURCE_UNAVAILABLE',
      retryable: true
    });
  });
});
