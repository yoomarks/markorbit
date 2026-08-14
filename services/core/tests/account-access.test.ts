import { describe, expect, it } from 'vitest';
import { AuthenticationError } from '@markorbit/contracts';
import {
  AccountAccessService,
  InMemoryAccountAccessStore,
  hashPassword,
  verifyPassword
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
  const sessions = new InMemorySessionRepository();
  const authentication = new AuthenticationService({ users, workspaces, memberships, sessions });
  const store = new InMemoryAccountAccessStore(users);
  const access = new AccountAccessService(store, authentication);
  return { users, sessions, store, access, authentication };
}

describe('real account access', () => {
  it('hashes passwords with scrypt and never embeds the plaintext password', async () => {
    const password = 'correct horse battery staple';
    const encoded = await hashPassword(password);
    expect(encoded).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(encoded).not.toContain(password);
    await expect(verifyPassword(password, encoded)).resolves.toBe(true);
    await expect(verifyPassword('incorrect password', encoded)).resolves.toBe(false);
  });

  it('creates a CUSTOMER account and a real durable session', async () => {
    const f = fixture();
    const result = await f.access.register({
      email: 'Customer@Example.com',
      displayName: 'Customer One',
      password: 'a secure customer password',
      accountType: 'CUSTOMER'
    });
    expect(result.account).toMatchObject({
      email: 'Customer@Example.com',
      displayName: 'Customer One',
      accountType: 'CUSTOMER'
    });
    expect(result.rawToken).not.toHaveLength(0);
    expect(await f.authentication.resolveSession(result.rawToken)).toMatchObject({
      kind: 'AUTHENTICATED_USER',
      userId: result.account.userId
    });
  });

  it('creates a PROFESSIONAL account', async () => {
    const result = await fixture().access.register({
      email: 'pro@example.com',
      displayName: 'Professional One',
      password: 'a secure professional password',
      accountType: 'PROFESSIONAL'
    });
    expect(result.account.accountType).toBe('PROFESSIONAL');
  });

  it('rejects PROVIDER and INTERNAL from self-service registration', async () => {
    const f = fixture();
    for (const accountType of ['PROVIDER', 'INTERNAL'] as const) {
      await expect(
        f.access.register({
          email: `${accountType.toLowerCase()}@example.com`,
          displayName: accountType,
          password: 'a secure registration password',
          accountType: accountType as never
        })
      ).rejects.toMatchObject({ code: 'INVALID_ACCOUNT_TYPE' });
    }
  });

  it('rejects weak passwords before persistence', async () => {
    const f = fixture();
    await expect(
      f.access.register({
        email: 'weak@example.com',
        displayName: 'Weak',
        password: 'short',
        accountType: 'CUSTOMER'
      })
    ).rejects.toMatchObject({ code: 'WEAK_PASSWORD' });
    await expect(f.users.findByNormalizedEmail('weak@example.com')).resolves.toBeNull();
  });

  it('rejects duplicate normalized email registration', async () => {
    const f = fixture();
    await f.access.register({
      email: 'User@Example.com',
      displayName: 'First',
      password: 'first secure password',
      accountType: 'CUSTOMER'
    });
    await expect(
      f.access.register({
        email: 'user@example.com',
        displayName: 'Second',
        password: 'second secure password',
        accountType: 'PROFESSIONAL'
      })
    ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_REGISTERED' });
  });

  it('logs in by normalized email and issues a fresh session', async () => {
    const f = fixture();
    const registered = await f.access.register({
      email: 'Login@Example.com',
      displayName: 'Login User',
      password: 'login secure password',
      accountType: 'CUSTOMER'
    });
    const loggedIn = await f.access.login({
      email: 'login@example.com',
      password: 'login secure password'
    });
    expect(loggedIn.account).toEqual(registered.account);
    expect(loggedIn.rawToken).not.toBe(registered.rawToken);
    expect(await f.sessions.listActiveForUser(registered.account.userId)).toHaveLength(2);
  });

  it('uses the same INVALID_CREDENTIALS error for unknown email and wrong password', async () => {
    const f = fixture();
    await f.access.register({
      email: 'known@example.com',
      displayName: 'Known',
      password: 'known secure password',
      accountType: 'CUSTOMER'
    });
    for (const command of [
      { email: 'missing@example.com', password: 'known secure password' },
      { email: 'known@example.com', password: 'wrong secure password' }
    ]) {
      await expect(f.access.login(command)).rejects.toEqual(
        expect.objectContaining<Partial<AuthenticationError>>({ code: 'INVALID_CREDENTIALS' })
      );
    }
  });
});
