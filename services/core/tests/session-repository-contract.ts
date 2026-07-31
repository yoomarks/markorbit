import { expect, it } from 'vitest';
import type { Session, SessionRepository } from '@markorbit/contracts';
export interface SessionHarness {
  sessions: SessionRepository;
  user(id: string): Promise<void>;
  cleanup(): Promise<void>;
  reopen?(): Promise<SessionHarness>;
}
let sequence = 1;
const id = () => `01900000-0000-7000-8000-${String(sequence++).padStart(12, '0')}`;
const row = (userId: string, overrides: Partial<Session> = {}): Session => ({
  sessionId: id(),
  userId,
  tokenHash: String(sequence).padStart(64, 'a').slice(-64),
  status: 'ACTIVE',
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-01-01T12:00:00.000Z',
  revokedAt: null,
  ...overrides
});
export function sessionRepositoryContract(label: string, make: () => Promise<SessionHarness>) {
  it(`${label}: creates, reloads, hashes, and clones records`, async () => {
    const h = await make();
    await h.cleanup();
    const user = id();
    await h.user(user);
    const value = row(user);
    await h.sessions.create(value);
    expect(await h.sessions.findById(value.sessionId)).toEqual(value);
    expect(await h.sessions.findByTokenHash(value.tokenHash)).toEqual(value);
    const loaded = await h.sessions.findById(value.sessionId);
    loaded!.status = 'REVOKED';
    expect((await h.sessions.findById(value.sessionId))!.status).toBe('ACTIVE');
  });
  it(`${label}: rejects duplicate token hashes and returns missing`, async () => {
    const h = await make();
    await h.cleanup();
    const user = id();
    await h.user(user);
    const first = row(user);
    await h.sessions.create(first);
    await expect(
      h.sessions.create(row(user, { tokenHash: first.tokenHash }))
    ).rejects.toMatchObject({ code: 'DUPLICATE_TOKEN_HASH' });
    expect(await h.sessions.findById(id())).toBeNull();
  });
  it(`${label}: revokes atomically and repeated revoke is idempotent`, async () => {
    const h = await make();
    await h.cleanup();
    const user = id();
    await h.user(user);
    const value = await h.sessions.create(row(user));
    const revoked = await h.sessions.revoke(value.sessionId, 1, '2026-01-02T00:00:00.000Z');
    expect(revoked).toMatchObject({ status: 'REVOKED', version: 2 });
    expect(await h.sessions.revoke(value.sessionId, 1, '2026-01-03T00:00:00.000Z')).toEqual(
      revoked
    );
  });
  it(`${label}: rejects a stale active revoke`, async () => {
    const h = await make();
    await h.cleanup();
    const user = id();
    await h.user(user);
    const value = await h.sessions.create(row(user));
    await expect(
      h.sessions.revoke(value.sessionId, 2, '2026-01-02T00:00:00.000Z')
    ).rejects.toMatchObject({ code: 'STALE_SESSION_VERSION' });
  });
  it(`${label}: bulk revocation is user bounded`, async () => {
    const h = await make();
    await h.cleanup();
    const a = id(),
      b = id();
    await h.user(a);
    await h.user(b);
    await h.sessions.create(row(a));
    await h.sessions.create(row(a));
    await h.sessions.create(row(b));
    expect(await h.sessions.revokeAllForUser(a, '2026-01-02T00:00:00.000Z')).toBe(2);
    expect(await h.sessions.listActiveForUser(a)).toHaveLength(0);
    expect(await h.sessions.listActiveForUser(b)).toHaveLength(1);
  });
  it(`${label}: active listing is deterministic and expiry does not delete`, async () => {
    const h = await make();
    await h.cleanup();
    const user = id();
    await h.user(user);
    const later = row(user, {
        createdAt: '2026-01-02T00:00:00.000Z',
        expiresAt: '2026-01-03T00:00:00.000Z'
      }),
      expired = row(user, {
        createdAt: '2025-01-01T00:00:00.000Z',
        expiresAt: '2025-01-02T00:00:00.000Z'
      });
    await h.sessions.create(later);
    await h.sessions.create(expired);
    expect((await h.sessions.listActiveForUser(user)).map((x) => x.sessionId)).toEqual([
      expired.sessionId,
      later.sessionId
    ]);
  });
  it(`${label}: persists across reconnect`, async () => {
    const h = await make();
    if (!h.reopen) return;
    await h.cleanup();
    const user = id();
    await h.user(user);
    const value = await h.sessions.create(row(user));
    const reopened = await h.reopen();
    expect(await reopened.sessions.findById(value.sessionId)).toEqual(value);
  });
}
