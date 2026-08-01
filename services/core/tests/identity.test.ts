import { describe, expect, it } from 'vitest';
import { IdentityError, PERMISSIONS, ROLE_PERMISSION_MATRIX, ROLES } from '@markorbit/contracts';
import {
  hasPermission,
  InMemoryMembershipRepository,
  InMemoryUserRepository,
  InMemoryWorkspaceRepository,
  normalizeEmail,
  normalizeSlug
} from '../src/identity.js';
const uid = '01800000-0000-7000-8000-000000000001',
  wid = '01800000-0000-7000-8000-000000000002',
  mid = '01800000-0000-7000-8000-000000000003';
describe('identity contracts', () => {
  it('normalizes identifiers deterministically', () => {
    expect(normalizeEmail(' Test@Example.COM ')).toBe('test@example.com');
    expect(normalizeSlug(' My Workspace ')).toBe('my-workspace');
  });
  it('enforces versions, duplicates, scopes, and immutable results', async () => {
    const u = new InMemoryUserRepository(),
      w = new InMemoryWorkspaceRepository(),
      m = new InMemoryMembershipRepository(u, w);
    const user = await u.create({ userId: uid, email: 'A@Example.com', displayName: 'A' });
    await expect(
      u.create({ userId: mid, email: ' a@example.COM ', displayName: 'B' })
    ).rejects.toMatchObject({ code: 'DUPLICATE_NORMALIZED_EMAIL' });
    user.displayName = 'tamper';
    expect((await u.findById(uid))?.displayName).toBe('A');
    await w.create({ workspaceId: wid, name: 'One', slug: 'ONE' });
    await m.create({ membershipId: mid, workspaceId: wid, userId: uid, role: 'REVIEWER' });
    expect(await m.findByWorkspaceAndUser('01800000-0000-7000-8000-000000000099', uid)).toBeNull();
    await expect(m.changeRole(wid, uid, 9, 'READ_ONLY')).rejects.toBeInstanceOf(IdentityError);
    expect((await m.suspend(wid, uid, 1)).status).toBe('SUSPENDED');
  });
});
describe('role permission matrix', () => {
  for (const role of ROLES)
    for (const permission of PERMISSIONS)
      it(`${role} / ${permission}`, () => {
        const expected = (
          ROLE_PERMISSION_MATRIX[role] as readonly (typeof PERMISSIONS)[number][]
        ).includes(permission);
        expect(
          hasPermission(role, permission, {
            userStatus: 'ACTIVE',
            workspaceStatus: 'ACTIVE',
            membershipStatus: 'ACTIVE'
          })
        ).toBe(expected);
      });
  it('fails closed for inactive state and unknown vocabulary', () => {
    expect(
      hasPermission('UNKNOWN', 'workspace:read', {
        userStatus: 'ACTIVE',
        workspaceStatus: 'ACTIVE',
        membershipStatus: 'ACTIVE'
      })
    ).toBe(false);
    expect(
      hasPermission('WORKSPACE_ADMIN', 'unknown', {
        userStatus: 'ACTIVE',
        workspaceStatus: 'ACTIVE',
        membershipStatus: 'ACTIVE'
      })
    ).toBe(false);
    expect(
      hasPermission('WORKSPACE_ADMIN', 'workspace:manage', {
        userStatus: 'DISABLED',
        workspaceStatus: 'ACTIVE',
        membershipStatus: 'ACTIVE'
      })
    ).toBe(false);
    expect(
      hasPermission('WORKSPACE_ADMIN', 'workspace:manage', {
        userStatus: 'ACTIVE',
        workspaceStatus: 'ARCHIVED',
        membershipStatus: 'ACTIVE'
      })
    ).toBe(false);
    expect(
      hasPermission('WORKSPACE_ADMIN', 'workspace:read', {
        userStatus: 'ACTIVE',
        workspaceStatus: 'ACTIVE',
        membershipStatus: 'SUSPENDED'
      })
    ).toBe(false);
  });
});
