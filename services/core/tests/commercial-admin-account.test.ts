import { describe, expect, it } from 'vitest';
import {
  AccountAccessService,
  InMemoryAccountAccessStore,
  hashPassword
} from '../src/account-access.js';
import { AuthenticationService, InMemorySessionRepository } from '../src/auth.js';
import {
  InMemoryMembershipRepository,
  InMemoryUserRepository,
  InMemoryWorkspaceRepository
} from '../src/identity.js';

function fixture() {
  const users = new InMemoryUserRepository();
  const workspaces = new InMemoryWorkspaceRepository();
  const memberships = new InMemoryMembershipRepository(users, workspaces);
  const authentication = new AuthenticationService({
    users,
    workspaces,
    memberships,
    sessions: new InMemorySessionRepository()
  });
  const store = new InMemoryAccountAccessStore(users);
  return { store, access: new AccountAccessService(store, authentication) };
}

describe('Core commercial admin account inspection', () => {
  it('returns safe authoritative account classification without password material', async () => {
    const f = fixture();
    const userId = '018f0000-0000-7000-8000-000000000501';
    const passwordHash = await hashPassword('an internal operator password');
    await f.store.register({
      userId,
      email: 'ops@example.com',
      displayName: 'Internal Operator',
      accountType: 'INTERNAL',
      passwordHash
    });

    const inspected = await f.access.inspectAccount(userId);
    expect(inspected).toMatchObject({
      userId,
      email: 'ops@example.com',
      displayName: 'Internal Operator',
      accountType: 'INTERNAL',
      status: 'ACTIVE',
      version: 1
    });
    expect(JSON.stringify(inspected)).not.toContain(passwordHash);
    expect(JSON.stringify(inspected)).not.toContain('password');
  });

  it('returns null for an unknown account instead of fabricating an admin record', async () => {
    await expect(
      fixture().access.inspectAccount('018f0000-0000-7000-8000-000000000599')
    ).resolves.toBeNull();
  });
});
