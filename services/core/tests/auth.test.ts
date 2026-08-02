import { describe, expect, it } from 'vitest';
import { AuthenticationError, ROLE_PERMISSION_MATRIX } from '@markorbit/contracts';
import {
  InMemoryMembershipRepository,
  InMemoryUserRepository,
  InMemoryWorkspaceRepository
} from '../src/identity.js';
import {
  AuthenticationService,
  InMemorySessionRepository,
  authorize,
  generateSessionToken,
  hashSessionToken,
  parseSessionTtl,
  validateInternalServiceSecret
} from '../src/auth.js';
const ids = {
  user: '018f0000-0000-7000-8000-000000000001',
  workspace: '018f0000-0000-7000-8000-000000000002',
  membership: '018f0000-0000-7000-8000-000000000003'
};
async function fixture() {
  const users = new InMemoryUserRepository();
  const workspaces = new InMemoryWorkspaceRepository();
  const memberships = new InMemoryMembershipRepository(users, workspaces);
  const sessions = new InMemorySessionRepository();
  await users.create({ userId: ids.user, email: 'user@example.test', displayName: 'User' });
  await workspaces.create({ workspaceId: ids.workspace, name: 'Workspace', slug: 'workspace' });
  await memberships.create({
    membershipId: ids.membership,
    userId: ids.user,
    workspaceId: ids.workspace,
    role: 'REVIEWER'
  });
  const service = new AuthenticationService({
    users,
    workspaces,
    memberships,
    sessions,
    clock: () => new Date('2026-01-01T00:00:00Z'),
    tokenGenerator: () => 'A'.repeat(43)
  });
  return { users, workspaces, memberships, sessions, service };
}
describe('authenticated runtime', () => {
  it('generates cookie-safe tokens with 256 bits of entropy and hashes them', () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashSessionToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSessionToken(token)).not.toContain(token);
  });
  it('issues only the raw token once and persists only its hash', async () => {
    const f = await fixture();
    const issued = await f.service.issueSession(ids.user);
    expect(issued.session).not.toHaveProperty('tokenHash');
    const stored = (await f.sessions.listActiveForUser(ids.user))[0]!;
    expect(stored.tokenHash).toBe(hashSessionToken(issued.rawToken));
    expect(JSON.stringify(stored)).not.toContain(issued.rawToken);
  });
  it('resolves an active session and Core-derived workspace permissions', async () => {
    const f = await fixture();
    const i = await f.service.issueSession(ids.user);
    const user = await f.service.resolveSession(i.rawToken);
    expect(user.kind).toBe('AUTHENTICATED_USER');
    const workspace = await f.service.resolveWorkspacePrincipal(i.rawToken, ids.workspace);
    expect(workspace.permissions).toEqual(ROLE_PERMISSION_MATRIX.REVIEWER);
    expect(authorize(workspace, 'review:perform')).toBe(workspace);
  });
  it('fails closed after revocation', async () => {
    const f = await fixture();
    const i = await f.service.issueSession(ids.user);
    await f.service.revokeSession(i.session.sessionId, 1);
    await expect(f.service.resolveSession(i.rawToken)).rejects.toMatchObject({
      code: 'SESSION_REVOKED'
    });
  });
  it('fails closed after user disablement', async () => {
    const f = await fixture();
    const i = await f.service.issueSession(ids.user);
    await f.users.disable(ids.user, 1);
    await expect(f.service.resolveSession(i.rawToken)).rejects.toMatchObject({
      code: 'USER_DISABLED'
    });
  });
  it('rejects expiry without sleeping', async () => {
    const f = await fixture();
    const i = await f.service.issueSession(ids.user, 300);
    const expired = new AuthenticationService({
      users: f.users,
      workspaces: f.workspaces,
      memberships: f.memberships,
      sessions: f.sessions,
      clock: () => new Date('2026-01-01T00:05:00Z')
    });
    await expect(expired.resolveSession(i.rawToken)).rejects.toMatchObject({
      code: 'SESSION_EXPIRED'
    });
  });
  it('enforces bounded TTL configuration', () => {
    expect(parseSessionTtl()).toBe(43200);
    expect(() => parseSessionTtl('299')).toThrow(AuthenticationError);
    expect(() => parseSessionTtl('604801')).toThrow(AuthenticationError);
  });
  it('validates separate service identity with constant-time comparison', () => {
    const secret = 's'.repeat(32);
    expect(validateInternalServiceSecret(secret, secret)).toBe(true);
    expect(validateInternalServiceSecret(secret, 'x'.repeat(32))).toBe(false);
    expect(() => validateInternalServiceSecret(undefined, undefined)).toThrow(/32 bytes/);
  });
});
