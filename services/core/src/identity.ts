/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import type {
  MembershipRepository,
  Permission,
  Role,
  User,
  UserRepository,
  Workspace,
  WorkspaceMembership,
  WorkspaceRepository
} from '@markorbit/contracts';
import { IdentityError, PERMISSIONS, ROLE_PERMISSION_MATRIX, ROLES } from '@markorbit/contracts';
import type { QueryClient } from '@markorbit/persistence';

export const normalizeEmail = (value: string) => value.trim().toLowerCase();
export const normalizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const clone = <T>(v: T): T => structuredClone(v);
const validRole = (r: string): r is Role => (ROLES as readonly string[]).includes(r);

const matrix = ROLE_PERMISSION_MATRIX;
export const permissionsForRole = (role: Role): readonly Permission[] => matrix[role];
const mutations = new Set<Permission>([
  'workspace:manage',
  'membership:manage',
  'matter:create',
  'matter:manage',
  'review:perform',
  'document-package:prepare',
  'instruction-ledger:write',
  'document-package:mark-ready'
]);
export function hasPermission(
  role: string,
  permission: string,
  state: {
    userStatus: User['status'];
    workspaceStatus: Workspace['status'];
    membershipStatus: WorkspaceMembership['status'];
  }
): boolean {
  if (!validRole(role) || !(PERMISSIONS as readonly string[]).includes(permission)) return false;
  if (state.userStatus !== 'ACTIVE' || state.membershipStatus !== 'ACTIVE') return false;
  return (
    (matrix[role] as readonly Permission[]).includes(permission as Permission) &&
    !(state.workspaceStatus === 'ARCHIVED' && mutations.has(permission as Permission))
  );
}
const now = () => new Date().toISOString();
function userInput(email: string, name: string) {
  if (!normalizeEmail(email).includes('@') || !name.trim())
    throw new IdentityError('INVALID_USER', 'User data is invalid.');
}
function workspaceInput(name: string, slug: string) {
  if (!name.trim() || !normalizeSlug(slug))
    throw new IdentityError('INVALID_WORKSPACE', 'Workspace data is invalid.');
}

export class InMemoryUserRepository implements UserRepository {
  private rows = new Map<string, User>();
  async create(i: Pick<User, 'userId' | 'email' | 'displayName'>) {
    userInput(i.email, i.displayName);
    if ([...this.rows.values()].some((x) => x.normalizedEmail === normalizeEmail(i.email)))
      throw new IdentityError(
        'DUPLICATE_NORMALIZED_EMAIL',
        'A user with that email already exists.'
      );
    const t = now(),
      v: User = {
        ...i,
        displayName: i.displayName.trim(),
        normalizedEmail: normalizeEmail(i.email),
        status: 'ACTIVE',
        version: 1,
        createdAt: t,
        updatedAt: t
      };
    this.rows.set(v.userId, v);
    return clone(v);
  }
  async findById(id: string) {
    return clone(this.rows.get(id) ?? null);
  }
  async findByNormalizedEmail(e: string) {
    return clone(
      [...this.rows.values()].find((x) => x.normalizedEmail === normalizeEmail(e)) ?? null
    );
  }
  async update(id: string, ver: number, i: Pick<User, 'email' | 'displayName'>) {
    userInput(i.email, i.displayName);
    const old = this.rows.get(id);
    if (!old) throw new IdentityError('USER_NOT_FOUND', 'User was not found.');
    if (old.version !== ver) throw new IdentityError('STALE_VERSION', 'Expected version is stale.');
    if (
      [...this.rows.values()].some(
        (x) => x.userId !== id && x.normalizedEmail === normalizeEmail(i.email)
      )
    )
      throw new IdentityError(
        'DUPLICATE_NORMALIZED_EMAIL',
        'A user with that email already exists.'
      );
    const v = {
      ...old,
      ...i,
      displayName: i.displayName.trim(),
      normalizedEmail: normalizeEmail(i.email),
      version: ver + 1,
      updatedAt: now()
    };
    this.rows.set(id, v);
    return clone(v);
  }
  async disable(id: string, ver: number) {
    const old = this.rows.get(id);
    if (!old) throw new IdentityError('USER_NOT_FOUND', 'User was not found.');
    if (old.version !== ver) throw new IdentityError('STALE_VERSION', 'Expected version is stale.');
    const v: User = { ...old, status: 'DISABLED', version: ver + 1, updatedAt: now() };
    this.rows.set(id, v);
    return clone(v);
  }
  clear() {
    this.rows.clear();
  }
}
export class InMemoryWorkspaceRepository implements WorkspaceRepository {
  private rows = new Map<string, Workspace>();
  async create(i: Pick<Workspace, 'workspaceId' | 'name' | 'slug'>) {
    workspaceInput(i.name, i.slug);
    const slug = normalizeSlug(i.slug);
    if ([...this.rows.values()].some((x) => x.slug === slug))
      throw new IdentityError(
        'DUPLICATE_WORKSPACE_SLUG',
        'A workspace with that slug already exists.'
      );
    const t = now(),
      v: Workspace = {
        ...i,
        name: i.name.trim(),
        slug,
        status: 'ACTIVE',
        version: 1,
        createdAt: t,
        updatedAt: t
      };
    this.rows.set(v.workspaceId, v);
    return clone(v);
  }
  async findById(id: string) {
    return clone(this.rows.get(id) ?? null);
  }
  async findBySlug(s: string) {
    return clone([...this.rows.values()].find((x) => x.slug === normalizeSlug(s)) ?? null);
  }
  async update(id: string, ver: number, i: Pick<Workspace, 'name' | 'slug'>) {
    workspaceInput(i.name, i.slug);
    const old = this.rows.get(id);
    if (!old) throw new IdentityError('WORKSPACE_NOT_FOUND', 'Workspace was not found.');
    if (old.version !== ver) throw new IdentityError('STALE_VERSION', 'Expected version is stale.');
    const slug = normalizeSlug(i.slug);
    if ([...this.rows.values()].some((x) => x.workspaceId !== id && x.slug === slug))
      throw new IdentityError(
        'DUPLICATE_WORKSPACE_SLUG',
        'A workspace with that slug already exists.'
      );
    const v = { ...old, name: i.name.trim(), slug, version: ver + 1, updatedAt: now() };
    this.rows.set(id, v);
    return clone(v);
  }
  async archive(id: string, ver: number) {
    const old = this.rows.get(id);
    if (!old) throw new IdentityError('WORKSPACE_NOT_FOUND', 'Workspace was not found.');
    if (old.version !== ver) throw new IdentityError('STALE_VERSION', 'Expected version is stale.');
    const v: Workspace = { ...old, status: 'ARCHIVED', version: ver + 1, updatedAt: now() };
    this.rows.set(id, v);
    return clone(v);
  }
  clear() {
    this.rows.clear();
  }
}
export class InMemoryMembershipRepository implements MembershipRepository {
  private rows = new Map<string, WorkspaceMembership>();
  constructor(
    private users: UserRepository,
    private workspaces: WorkspaceRepository
  ) {}
  private key(w: string, u: string) {
    return `${w}\0${u}`;
  }
  async create(i: Pick<WorkspaceMembership, 'membershipId' | 'workspaceId' | 'userId' | 'role'>) {
    if (!validRole(i.role)) throw new IdentityError('INVALID_ROLE', 'Role is invalid.');
    const [u, w] = await Promise.all([
      this.users.findById(i.userId),
      this.workspaces.findById(i.workspaceId)
    ]);
    if (!u) throw new IdentityError('USER_NOT_FOUND', 'User was not found.');
    if (u.status === 'DISABLED') throw new IdentityError('USER_DISABLED', 'User is disabled.');
    if (!w) throw new IdentityError('WORKSPACE_NOT_FOUND', 'Workspace was not found.');
    if (w.status === 'ARCHIVED')
      throw new IdentityError('WORKSPACE_ARCHIVED', 'Workspace is archived.');
    if (this.rows.has(this.key(i.workspaceId, i.userId)))
      throw new IdentityError('DUPLICATE_MEMBERSHIP', 'Membership already exists.');
    const t = now(),
      v: WorkspaceMembership = { ...i, status: 'ACTIVE', version: 1, createdAt: t, updatedAt: t };
    this.rows.set(this.key(i.workspaceId, i.userId), v);
    return clone(v);
  }
  async findByWorkspaceAndUser(w: string, u: string) {
    return clone(this.rows.get(this.key(w, u)) ?? null);
  }
  async listByUser(u: string) {
    return clone(
      [...this.rows.values()]
        .filter((x) => x.userId === u)
        .sort((a, b) => a.workspaceId.localeCompare(b.workspaceId))
    );
  }
  async listByWorkspace(w: string) {
    return clone(
      [...this.rows.values()]
        .filter((x) => x.workspaceId === w)
        .sort((a, b) => a.userId.localeCompare(b.userId))
    );
  }
  private async mutate(w: string, u: string, v: number, change: Partial<WorkspaceMembership>) {
    const old = this.rows.get(this.key(w, u));
    if (!old) throw new IdentityError('MEMBERSHIP_NOT_FOUND', 'Membership was not found.');
    if (old.version !== v) throw new IdentityError('STALE_VERSION', 'Expected version is stale.');
    const row = { ...old, ...change, version: v + 1, updatedAt: now() };
    this.rows.set(this.key(w, u), row);
    return clone(row);
  }
  async changeRole(w: string, u: string, v: number, r: Role) {
    if (!validRole(r)) throw new IdentityError('INVALID_ROLE', 'Role is invalid.');
    return this.mutate(w, u, v, { role: r });
  }
  async suspend(w: string, u: string, v: number) {
    return this.mutate(w, u, v, { status: 'SUSPENDED' });
  }
  clear() {
    this.rows.clear();
  }
}

type Row = Record<string, unknown>;
const mapUser = (r: Row): User => ({
  userId: r.user_id as string,
  email: r.email as string,
  normalizedEmail: r.normalized_email as string,
  displayName: r.display_name as string,
  status: r.status as User['status'],
  version: r.version as number,
  createdAt: (r.created_at as Date).toISOString(),
  updatedAt: (r.updated_at as Date).toISOString()
});
const mapWorkspace = (r: Row): Workspace => ({
  workspaceId: r.workspace_id as string,
  name: r.name as string,
  slug: r.slug as string,
  status: r.status as Workspace['status'],
  version: r.version as number,
  createdAt: (r.created_at as Date).toISOString(),
  updatedAt: (r.updated_at as Date).toISOString()
});
const mapMembership = (r: Row): WorkspaceMembership => ({
  membershipId: r.membership_id as string,
  workspaceId: r.workspace_id as string,
  userId: r.user_id as string,
  role: r.role as Role,
  status: r.status as WorkspaceMembership['status'],
  version: r.version as number,
  createdAt: (r.created_at as Date).toISOString(),
  updatedAt: (r.updated_at as Date).toISOString()
});
function pgError(
  e: unknown,
  duplicate: 'DUPLICATE_NORMALIZED_EMAIL' | 'DUPLICATE_WORKSPACE_SLUG' | 'DUPLICATE_MEMBERSHIP'
): never {
  const x = e as { code?: string };
  if (x.code === '23505')
    throw new IdentityError(duplicate, 'A unique identity record already exists.', { cause: e });
  throw new IdentityError('PERSISTENCE_UNAVAILABLE', 'Identity persistence is unavailable.', {
    cause: e
  });
}
export class PostgresUserRepository implements UserRepository {
  constructor(private q: QueryClient) {}
  async create(i: Pick<User, 'userId' | 'email' | 'displayName'>) {
    userInput(i.email, i.displayName);
    try {
      return mapUser(
        (
          await this.q.query(
            'INSERT INTO users(user_id,email,normalized_email,display_name) VALUES($1,$2,$3,$4) RETURNING *',
            [i.userId, i.email, normalizeEmail(i.email), i.displayName.trim()]
          )
        ).rows[0]
      );
    } catch (e) {
      pgError(e, 'DUPLICATE_NORMALIZED_EMAIL');
    }
  }
  async findById(id: string) {
    const r = await this.q.query('SELECT * FROM users WHERE user_id=$1', [id]);
    return r.rows[0] ? mapUser(r.rows[0]) : null;
  }
  async findByNormalizedEmail(e: string) {
    const r = await this.q.query('SELECT * FROM users WHERE normalized_email=$1', [
      normalizeEmail(e)
    ]);
    return r.rows[0] ? mapUser(r.rows[0]) : null;
  }
  async update(id: string, v: number, i: Pick<User, 'email' | 'displayName'>) {
    userInput(i.email, i.displayName);
    try {
      const r = await this.q.query(
        'UPDATE users SET email=$3,normalized_email=$4,display_name=$5,version=version+1,updated_at=now() WHERE user_id=$1 AND version=$2 RETURNING *',
        [id, v, i.email, normalizeEmail(i.email), i.displayName.trim()]
      );
      if (r.rows[0]) return mapUser(r.rows[0]);
      return this.missing(id);
    } catch (e) {
      pgError(e, 'DUPLICATE_NORMALIZED_EMAIL');
    }
  }
  async disable(id: string, v: number) {
    const r = await this.q.query(
      "UPDATE users SET status='DISABLED',version=version+1,updated_at=now() WHERE user_id=$1 AND version=$2 RETURNING *",
      [id, v]
    );
    if (r.rows[0]) return mapUser(r.rows[0]);
    return this.missing(id);
  }
  private async missing(id: string): Promise<never> {
    if (await this.findById(id))
      throw new IdentityError('STALE_VERSION', 'Expected version is stale.');
    throw new IdentityError('USER_NOT_FOUND', 'User was not found.');
  }
}
export class PostgresWorkspaceRepository implements WorkspaceRepository {
  constructor(private q: QueryClient) {}
  async create(i: Pick<Workspace, 'workspaceId' | 'name' | 'slug'>) {
    workspaceInput(i.name, i.slug);
    try {
      return mapWorkspace(
        (
          await this.q.query(
            'INSERT INTO workspaces(workspace_id,name,slug) VALUES($1,$2,$3) RETURNING *',
            [i.workspaceId, i.name.trim(), normalizeSlug(i.slug)]
          )
        ).rows[0]
      );
    } catch (e) {
      pgError(e, 'DUPLICATE_WORKSPACE_SLUG');
    }
  }
  async findById(id: string) {
    const r = await this.q.query('SELECT * FROM workspaces WHERE workspace_id=$1', [id]);
    return r.rows[0] ? mapWorkspace(r.rows[0]) : null;
  }
  async findBySlug(s: string) {
    const r = await this.q.query('SELECT * FROM workspaces WHERE slug=$1', [normalizeSlug(s)]);
    return r.rows[0] ? mapWorkspace(r.rows[0]) : null;
  }
  async update(id: string, v: number, i: Pick<Workspace, 'name' | 'slug'>) {
    workspaceInput(i.name, i.slug);
    try {
      return await this.mutate(id, v, 'name=$3,slug=$4', [i.name.trim(), normalizeSlug(i.slug)]);
    } catch (e) {
      if (e instanceof IdentityError) throw e;
      pgError(e, 'DUPLICATE_WORKSPACE_SLUG');
    }
  }
  async archive(id: string, v: number) {
    return this.mutate(id, v, "status='ARCHIVED'", []);
  }
  private async mutate(id: string, v: number, set: string, args: unknown[]) {
    const r = await this.q.query(
      `UPDATE workspaces SET ${set},version=version+1,updated_at=now() WHERE workspace_id=$1 AND version=$2 RETURNING *`,
      [id, v, ...args]
    );
    if (r.rows[0]) return mapWorkspace(r.rows[0]);
    if (await this.findById(id))
      throw new IdentityError('STALE_VERSION', 'Expected version is stale.');
    throw new IdentityError('WORKSPACE_NOT_FOUND', 'Workspace was not found.');
  }
}
export class PostgresMembershipRepository implements MembershipRepository {
  constructor(private q: QueryClient) {}
  async create(i: Pick<WorkspaceMembership, 'membershipId' | 'workspaceId' | 'userId' | 'role'>) {
    if (!validRole(i.role)) throw new IdentityError('INVALID_ROLE', 'Role is invalid.');
    try {
      const inserted = await this.q.query(
        `WITH eligible_user AS MATERIALIZED (
           SELECT user_id FROM users WHERE user_id=$3 AND status='ACTIVE' FOR UPDATE
         ), eligible_workspace AS MATERIALIZED (
           SELECT workspace_id FROM workspaces WHERE workspace_id=$2 AND status='ACTIVE' FOR UPDATE
         )
         INSERT INTO workspace_memberships(membership_id,workspace_id,user_id,role)
         SELECT $1,eligible_workspace.workspace_id,eligible_user.user_id,$4
         FROM eligible_user CROSS JOIN eligible_workspace RETURNING *`,
        [i.membershipId, i.workspaceId, i.userId, i.role]
      );
      if (inserted.rows[0]) return mapMembership(inserted.rows[0]);
      const [user, workspace] = await Promise.all([
        this.q.query('SELECT status FROM users WHERE user_id=$1', [i.userId]),
        this.q.query('SELECT status FROM workspaces WHERE workspace_id=$1', [i.workspaceId])
      ]);
      if (!user.rows[0]) throw new IdentityError('USER_NOT_FOUND', 'User was not found.');
      if (user.rows[0].status === 'DISABLED')
        throw new IdentityError('USER_DISABLED', 'User is disabled.');
      if (!workspace.rows[0])
        throw new IdentityError('WORKSPACE_NOT_FOUND', 'Workspace was not found.');
      throw new IdentityError('WORKSPACE_ARCHIVED', 'Workspace is archived.');
    } catch (e) {
      if (e instanceof IdentityError) throw e;
      pgError(e, 'DUPLICATE_MEMBERSHIP');
    }
  }
  async findByWorkspaceAndUser(w: string, u: string) {
    const r = await this.q.query(
      'SELECT * FROM workspace_memberships WHERE workspace_id=$1 AND user_id=$2',
      [w, u]
    );
    return r.rows[0] ? mapMembership(r.rows[0]) : null;
  }
  async listByUser(u: string) {
    return (
      await this.q.query(
        'SELECT * FROM workspace_memberships WHERE user_id=$1 ORDER BY workspace_id',
        [u]
      )
    ).rows.map(mapMembership);
  }
  async listByWorkspace(w: string) {
    return (
      await this.q.query(
        'SELECT * FROM workspace_memberships WHERE workspace_id=$1 ORDER BY user_id',
        [w]
      )
    ).rows.map(mapMembership);
  }
  async changeRole(w: string, u: string, v: number, r: Role) {
    if (!validRole(r)) throw new IdentityError('INVALID_ROLE', 'Role is invalid.');
    return this.mutate(w, u, v, 'role=$4', [r]);
  }
  async suspend(w: string, u: string, v: number) {
    return this.mutate(w, u, v, "status='SUSPENDED'", []);
  }
  private async mutate(w: string, u: string, v: number, set: string, args: unknown[]) {
    const r = await this.q.query(
      `UPDATE workspace_memberships SET ${set},version=version+1,updated_at=now() WHERE workspace_id=$1 AND user_id=$2 AND version=$3 RETURNING *`,
      [w, u, v, ...args]
    );
    if (r.rows[0]) return mapMembership(r.rows[0]);
    if (await this.findByWorkspaceAndUser(w, u))
      throw new IdentityError('STALE_VERSION', 'Expected version is stale.');
    throw new IdentityError('MEMBERSHIP_NOT_FOUND', 'Membership was not found.');
  }
}
