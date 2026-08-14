import { describe, expect, it } from 'vitest';
import {
  AccountOnboardingService,
  InMemoryAccountOnboardingRepository
} from '../src/account-onboarding.js';
import {
  InMemoryMembershipRepository,
  InMemoryUserRepository,
  InMemoryWorkspaceRepository
} from '../src/identity.js';

function fixture() {
  const users = new InMemoryUserRepository();
  const workspaces = new InMemoryWorkspaceRepository();
  const memberships = new InMemoryMembershipRepository(users, workspaces);
  const onboarding = new AccountOnboardingService(
    new InMemoryAccountOnboardingRepository(users, workspaces, memberships)
  );
  return { users, workspaces, memberships, onboarding };
}

describe('account workspace onboarding', () => {
  it('creates an ACTIVE Workspace and WORKSPACE_ADMIN membership for an ACTIVE user', async () => {
    const f = fixture();
    const user = await f.users.create({
      userId: '018f0000-0000-7000-8000-000000000101',
      email: 'owner@example.com',
      displayName: 'Owner'
    });
    const entry = await f.onboarding.createWorkspace(user.userId, {
      name: 'Acme IP Team'
    });
    expect(entry.workspace).toMatchObject({
      name: 'Acme IP Team',
      slug: 'acme-ip-team',
      status: 'ACTIVE'
    });
    expect(entry.membership).toMatchObject({
      userId: user.userId,
      workspaceId: entry.workspace.workspaceId,
      role: 'WORKSPACE_ADMIN',
      status: 'ACTIVE'
    });
  });

  it('lists only active Workspace entries for the user', async () => {
    const f = fixture();
    const user = await f.users.create({
      userId: '018f0000-0000-7000-8000-000000000102',
      email: 'list@example.com',
      displayName: 'List User'
    });
    const first = await f.onboarding.createWorkspace(user.userId, { name: 'First Team' });
    const second = await f.onboarding.createWorkspace(user.userId, { name: 'Second Team' });
    await f.workspaces.archive(second.workspace.workspaceId, second.workspace.version);
    await expect(f.onboarding.listWorkspaces(user.userId)).resolves.toEqual([first]);
  });

  it('rejects disabled users before creating a Workspace', async () => {
    const f = fixture();
    const user = await f.users.create({
      userId: '018f0000-0000-7000-8000-000000000103',
      email: 'disabled@example.com',
      displayName: 'Disabled User'
    });
    await f.users.disable(user.userId, user.version);
    await expect(
      f.onboarding.createWorkspace(user.userId, { name: 'Should Not Exist' })
    ).rejects.toMatchObject({ code: 'USER_DISABLED' });
    await expect(f.workspaces.findBySlug('should-not-exist')).resolves.toBeNull();
  });

  it('rejects duplicate normalized Workspace slugs', async () => {
    const f = fixture();
    const user = await f.users.create({
      userId: '018f0000-0000-7000-8000-000000000104',
      email: 'duplicate@example.com',
      displayName: 'Duplicate User'
    });
    await f.onboarding.createWorkspace(user.userId, { name: 'North America' });
    await expect(
      f.onboarding.createWorkspace(user.userId, { name: 'North-America' })
    ).rejects.toMatchObject({ code: 'DUPLICATE_WORKSPACE_SLUG' });
  });
});
