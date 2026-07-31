/* eslint-disable @typescript-eslint/require-await */
import {
  InMemoryMembershipRepository,
  InMemoryUserRepository,
  InMemoryWorkspaceRepository
} from '../src/identity.js';
import {
  membershipRepositoryContract,
  userRepositoryContract,
  workspaceRepositoryContract,
  type IdentityRepositoryHarness
} from './identity-repository-contracts.js';

async function factory(): Promise<IdentityRepositoryHarness> {
  const users = new InMemoryUserRepository(),
    workspaces = new InMemoryWorkspaceRepository(),
    memberships = new InMemoryMembershipRepository(users, workspaces);
  const harness: IdentityRepositoryHarness = {
    users,
    workspaces,
    memberships,
    reopen: async () => harness,
    cleanup: async () => {
      memberships.clear();
      workspaces.clear();
      users.clear();
    },
    close: () => Promise.resolve()
  };
  return harness;
}
userRepositoryContract('in-memory', factory);
workspaceRepositoryContract('in-memory', factory);
membershipRepositoryContract('in-memory', factory);
