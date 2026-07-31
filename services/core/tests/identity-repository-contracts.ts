import { describe, expect, it } from 'vitest';
import type {
  MembershipRepository,
  UserRepository,
  WorkspaceRepository
} from '@markorbit/contracts';

export interface IdentityRepositoryHarness {
  users: UserRepository;
  workspaces: WorkspaceRepository;
  memberships: MembershipRepository;
  reopen(): Promise<IdentityRepositoryHarness>;
  cleanup(): Promise<void>;
  close(): Promise<void>;
}
export type IdentityHarnessFactory = () => Promise<IdentityRepositoryHarness>;

let sequence = 1;
const id = () => `01800000-0000-7000-8000-${String(sequence++).padStart(12, '0')}`;
async function withHarness<T>(
  factory: IdentityHarnessFactory,
  work: (h: IdentityRepositoryHarness) => Promise<T>
) {
  const harness = await factory();
  try {
    await harness.cleanup();
    return await work(harness);
  } finally {
    await harness.close();
  }
}
const userInput = () => ({
  userId: id(),
  email: `User${sequence}@Example.COM`,
  displayName: 'Test User'
});
const workspaceInput = () => ({
  workspaceId: id(),
  name: `Workspace ${sequence}`,
  slug: `Workspace-${sequence}`
});

export function userRepositoryContract(label: string, factory: IdentityHarnessFactory) {
  describe(`${label} UserRepository contract`, () => {
    it('creates and exactly reloads', () =>
      withHarness(factory, async (h) => {
        const created = await h.users.create(userInput());
        expect(await h.users.findById(created.userId)).toEqual(created);
      }));
    it('finds by normalized email and retains display casing', () =>
      withHarness(factory, async (h) => {
        const created = await h.users.create(userInput());
        expect(
          (await h.users.findByNormalizedEmail(`  ${created.email.toUpperCase()} `))?.userId
        ).toBe(created.userId);
        expect(created.email).toContain('@Example.COM');
      }));
    it('rejects duplicate normalized email', () =>
      withHarness(factory, async (h) => {
        const first = await h.users.create(userInput());
        await expect(
          h.users.create({ ...userInput(), email: ` ${first.email.toUpperCase()} ` })
        ).rejects.toMatchObject({ code: 'DUPLICATE_NORMALIZED_EMAIL' });
      }));
    it('rejects invalid input', () =>
      withHarness(factory, async (h) => {
        await expect(h.users.create({ ...userInput(), email: '   ' })).rejects.toMatchObject({
          code: 'INVALID_USER'
        });
        await expect(h.users.create({ ...userInput(), displayName: '   ' })).rejects.toMatchObject({
          code: 'INVALID_USER'
        });
      }));
    it('updates with an expected version', () =>
      withHarness(factory, async (h) => {
        const u = await h.users.create(userInput());
        const changed = await h.users.update(u.userId, 1, {
          email: 'Changed@Example.com',
          displayName: 'Changed'
        });
        expect(changed).toMatchObject({
          version: 2,
          displayName: 'Changed',
          normalizedEmail: 'changed@example.com'
        });
      }));
    it('rejects a stale update', () =>
      withHarness(factory, async (h) => {
        const u = await h.users.create(userInput());
        await h.users.update(u.userId, 1, { email: u.email, displayName: 'v2' });
        await expect(
          h.users.update(u.userId, 1, { email: u.email, displayName: 'lost' })
        ).rejects.toMatchObject({ code: 'STALE_VERSION' });
      }));
    it('disables without deleting', () =>
      withHarness(factory, async (h) => {
        const u = await h.users.create(userInput());
        expect(await h.users.disable(u.userId, 1)).toMatchObject({
          status: 'DISABLED',
          version: 2
        });
        expect(await h.users.findById(u.userId)).not.toBeNull();
      }));
    it('survives reconnect', () =>
      withHarness(factory, async (h) => {
        const u = await h.users.create(userInput());
        await h.users.disable(u.userId, 1);
        const reopened = await h.reopen();
        expect(await reopened.users.findById(u.userId)).toMatchObject({
          status: 'DISABLED',
          version: 2
        });
      }));
    it('returns null for a missing record', () =>
      withHarness(factory, async (h) => {
        expect(await h.users.findById(id())).toBeNull();
      }));
    it('protects stored state from returned-object mutation', () =>
      withHarness(factory, async (h) => {
        const u = await h.users.create(userInput());
        u.displayName = 'tampered';
        expect((await h.users.findById(u.userId))?.displayName).toBe('Test User');
      }));
  });
}

export function workspaceRepositoryContract(label: string, factory: IdentityHarnessFactory) {
  describe(`${label} WorkspaceRepository contract`, () => {
    it('creates and exactly reloads', () =>
      withHarness(factory, async (h) => {
        const created = await h.workspaces.create(workspaceInput());
        expect(await h.workspaces.findById(created.workspaceId)).toEqual(created);
      }));
    it('finds by normalized slug', () =>
      withHarness(factory, async (h) => {
        const w = await h.workspaces.create(workspaceInput());
        expect((await h.workspaces.findBySlug(` ${w.slug.toUpperCase()} `))?.workspaceId).toBe(
          w.workspaceId
        );
      }));
    it('rejects duplicate normalized slug', () =>
      withHarness(factory, async (h) => {
        const w = await h.workspaces.create(workspaceInput());
        await expect(
          h.workspaces.create({ ...workspaceInput(), slug: ` ${w.slug.toUpperCase()} ` })
        ).rejects.toMatchObject({ code: 'DUPLICATE_WORKSPACE_SLUG' });
      }));
    it('updates with an expected version', () =>
      withHarness(factory, async (h) => {
        const w = await h.workspaces.create(workspaceInput());
        expect(
          await h.workspaces.update(w.workspaceId, 1, { name: 'Changed', slug: 'Changed Slug' })
        ).toMatchObject({ version: 2, name: 'Changed', slug: 'changed-slug' });
      }));
    it('rejects a stale update', () =>
      withHarness(factory, async (h) => {
        const w = await h.workspaces.create(workspaceInput());
        await h.workspaces.update(w.workspaceId, 1, { name: 'v2', slug: w.slug });
        await expect(h.workspaces.archive(w.workspaceId, 1)).rejects.toMatchObject({
          code: 'STALE_VERSION'
        });
      }));
    it('archives without deleting', () =>
      withHarness(factory, async (h) => {
        const w = await h.workspaces.create(workspaceInput());
        expect(await h.workspaces.archive(w.workspaceId, 1)).toMatchObject({
          status: 'ARCHIVED',
          version: 2
        });
        expect(await h.workspaces.findById(w.workspaceId)).not.toBeNull();
      }));
    it('survives reconnect', () =>
      withHarness(factory, async (h) => {
        const w = await h.workspaces.create(workspaceInput());
        await h.workspaces.archive(w.workspaceId, 1);
        const reopened = await h.reopen();
        expect(await reopened.workspaces.findById(w.workspaceId)).toMatchObject({
          status: 'ARCHIVED'
        });
      }));
    it('returns null for a missing record', () =>
      withHarness(factory, async (h) => {
        expect(await h.workspaces.findById(id())).toBeNull();
      }));
    it('protects stored state from returned-object mutation', () =>
      withHarness(factory, async (h) => {
        const w = await h.workspaces.create(workspaceInput());
        w.name = 'tampered';
        expect((await h.workspaces.findById(w.workspaceId))?.name).not.toBe('tampered');
      }));
  });
}

async function seed(h: IdentityRepositoryHarness) {
  const u = await h.users.create(userInput()),
    w = await h.workspaces.create(workspaceInput());
  return { u, w };
}
export function membershipRepositoryContract(label: string, factory: IdentityHarnessFactory) {
  describe(`${label} MembershipRepository contract`, () => {
    it('creates and exactly reloads', () =>
      withHarness(factory, async (h) => {
        const { u, w } = await seed(h),
          m = await h.memberships.create({
            membershipId: id(),
            workspaceId: w.workspaceId,
            userId: u.userId,
            role: 'REVIEWER'
          });
        expect(await h.memberships.findByWorkspaceAndUser(w.workspaceId, u.userId)).toEqual(m);
      }));
    it('rejects duplicate Workspace/User pair', () =>
      withHarness(factory, async (h) => {
        const { u, w } = await seed(h);
        await h.memberships.create({
          membershipId: id(),
          workspaceId: w.workspaceId,
          userId: u.userId,
          role: 'REVIEWER'
        });
        await expect(
          h.memberships.create({
            membershipId: id(),
            workspaceId: w.workspaceId,
            userId: u.userId,
            role: 'READ_ONLY'
          })
        ).rejects.toMatchObject({ code: 'DUPLICATE_MEMBERSHIP' });
      }));
    it('fails closed across Workspace scope', () =>
      withHarness(factory, async (h) => {
        const { u, w } = await seed(h),
          other = await h.workspaces.create(workspaceInput());
        await h.memberships.create({
          membershipId: id(),
          workspaceId: w.workspaceId,
          userId: u.userId,
          role: 'REVIEWER'
        });
        expect(await h.memberships.findByWorkspaceAndUser(other.workspaceId, u.userId)).toBeNull();
      }));
    it('loads only by the exact Workspace and User identity', () =>
      withHarness(factory, async (h) => {
        const { u, w } = await seed(h);
        const membership = await h.memberships.create({
          membershipId: id(),
          workspaceId: w.workspaceId,
          userId: u.userId,
          role: 'REVIEWER'
        });
        expect(
          (await h.memberships.findByWorkspaceAndUser(w.workspaceId, u.userId))?.membershipId
        ).toBe(membership.membershipId);
        expect(await h.memberships.findByWorkspaceAndUser(w.workspaceId, id())).toBeNull();
      }));
    it('lists by User across Workspaces with distinct roles', () =>
      withHarness(factory, async (h) => {
        const { u, w } = await seed(h),
          other = await h.workspaces.create(workspaceInput());
        await h.memberships.create({
          membershipId: id(),
          workspaceId: w.workspaceId,
          userId: u.userId,
          role: 'REVIEWER'
        });
        await h.memberships.create({
          membershipId: id(),
          workspaceId: other.workspaceId,
          userId: u.userId,
          role: 'READ_ONLY'
        });
        expect((await h.memberships.listByUser(u.userId)).map((x) => x.role)).toEqual([
          'REVIEWER',
          'READ_ONLY'
        ]);
      }));
    it('orders list-by-User deterministically by Workspace identity', () =>
      withHarness(factory, async (h) => {
        const { u, w } = await seed(h);
        const other = await h.workspaces.create(workspaceInput());
        await h.memberships.create({
          membershipId: id(),
          workspaceId: other.workspaceId,
          userId: u.userId,
          role: 'READ_ONLY'
        });
        await h.memberships.create({
          membershipId: id(),
          workspaceId: w.workspaceId,
          userId: u.userId,
          role: 'REVIEWER'
        });
        const rows = await h.memberships.listByUser(u.userId);
        expect(rows.map((x) => x.workspaceId)).toEqual([...rows.map((x) => x.workspaceId)].sort());
      }));
    it('lists only the explicit Workspace in deterministic User order', () =>
      withHarness(factory, async (h) => {
        const { u, w } = await seed(h),
          u2 = await h.users.create(userInput()),
          other = await h.workspaces.create(workspaceInput());
        await h.memberships.create({
          membershipId: id(),
          workspaceId: w.workspaceId,
          userId: u2.userId,
          role: 'READ_ONLY'
        });
        await h.memberships.create({
          membershipId: id(),
          workspaceId: w.workspaceId,
          userId: u.userId,
          role: 'REVIEWER'
        });
        await h.memberships.create({
          membershipId: id(),
          workspaceId: other.workspaceId,
          userId: u.userId,
          role: 'READ_ONLY'
        });
        const rows = await h.memberships.listByWorkspace(w.workspaceId);
        expect(rows.every((x) => x.workspaceId === w.workspaceId)).toBe(true);
        expect(rows.map((x) => x.userId)).toEqual([...rows.map((x) => x.userId)].sort());
      }));
    it('changes role with expected version', () =>
      withHarness(factory, async (h) => {
        const { u, w } = await seed(h);
        await h.memberships.create({
          membershipId: id(),
          workspaceId: w.workspaceId,
          userId: u.userId,
          role: 'REVIEWER'
        });
        expect(
          await h.memberships.changeRole(w.workspaceId, u.userId, 1, 'READ_ONLY')
        ).toMatchObject({ role: 'READ_ONLY', version: 2 });
      }));
    it('rejects stale role change', () =>
      withHarness(factory, async (h) => {
        const { u, w } = await seed(h);
        await h.memberships.create({
          membershipId: id(),
          workspaceId: w.workspaceId,
          userId: u.userId,
          role: 'REVIEWER'
        });
        await h.memberships.changeRole(w.workspaceId, u.userId, 1, 'READ_ONLY');
        await expect(
          h.memberships.changeRole(w.workspaceId, u.userId, 1, 'REVIEWER')
        ).rejects.toMatchObject({ code: 'STALE_VERSION' });
      }));
    it('suspends only the explicitly scoped Membership', () =>
      withHarness(factory, async (h) => {
        const { u, w } = await seed(h),
          other = await h.workspaces.create(workspaceInput());
        await h.memberships.create({
          membershipId: id(),
          workspaceId: w.workspaceId,
          userId: u.userId,
          role: 'REVIEWER'
        });
        await h.memberships.create({
          membershipId: id(),
          workspaceId: other.workspaceId,
          userId: u.userId,
          role: 'READ_ONLY'
        });
        await h.memberships.suspend(w.workspaceId, u.userId, 1);
        expect((await h.memberships.findByWorkspaceAndUser(w.workspaceId, u.userId))?.status).toBe(
          'SUSPENDED'
        );
        expect(
          (await h.memberships.findByWorkspaceAndUser(other.workspaceId, u.userId))?.status
        ).toBe('ACTIVE');
      }));
    it('survives reconnect', () =>
      withHarness(factory, async (h) => {
        const { u, w } = await seed(h);
        await h.memberships.create({
          membershipId: id(),
          workspaceId: w.workspaceId,
          userId: u.userId,
          role: 'REVIEWER'
        });
        await h.memberships.suspend(w.workspaceId, u.userId, 1);
        const reopened = await h.reopen();
        expect(
          (await reopened.memberships.findByWorkspaceAndUser(w.workspaceId, u.userId))?.status
        ).toBe('SUSPENDED');
      }));
    it('rejects admission to archived Workspace', () =>
      withHarness(factory, async (h) => {
        const { u, w } = await seed(h);
        await h.workspaces.archive(w.workspaceId, 1);
        await expect(
          h.memberships.create({
            membershipId: id(),
            workspaceId: w.workspaceId,
            userId: u.userId,
            role: 'REVIEWER'
          })
        ).rejects.toMatchObject({ code: 'WORKSPACE_ARCHIVED' });
      }));
    it('rejects admission for disabled User', () =>
      withHarness(factory, async (h) => {
        const { u, w } = await seed(h);
        await h.users.disable(u.userId, 1);
        await expect(
          h.memberships.create({
            membershipId: id(),
            workspaceId: w.workspaceId,
            userId: u.userId,
            role: 'REVIEWER'
          })
        ).rejects.toMatchObject({ code: 'USER_DISABLED' });
      }));
    it('protects stored state from returned-object mutation', () =>
      withHarness(factory, async (h) => {
        const { u, w } = await seed(h),
          m = await h.memberships.create({
            membershipId: id(),
            workspaceId: w.workspaceId,
            userId: u.userId,
            role: 'REVIEWER'
          });
        m.role = 'READ_ONLY';
        expect((await h.memberships.findByWorkspaceAndUser(w.workspaceId, u.userId))?.role).toBe(
          'REVIEWER'
        );
      }));
  });
}
