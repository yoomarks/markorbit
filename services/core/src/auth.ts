import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unnecessary-type-assertion -- repositories deliberately share async contracts and normalize driver rows at the boundary. */
import type {
  MembershipRepository,
  Permission,
  Principal,
  Session,
  SessionRepository,
  UserRepository,
  WorkspaceRepository
} from '@markorbit/contracts';
import { AuthenticationError, PERMISSIONS, ROLES } from '@markorbit/contracts';
import type { QueryClient } from '@markorbit/persistence';
import { hasPermission } from './identity.js';

const clone = <T>(value: T): T => structuredClone(value);
export const SESSION_TTL = Object.freeze({
  defaultSeconds: 43_200,
  minimumSeconds: 300,
  maximumSeconds: 604_800
});
export function parseSessionTtl(value = process.env.MO_SESSION_TTL_SECONDS): number {
  if (value === undefined) return SESSION_TTL.defaultSeconds;
  const ttl = Number(value);
  if (
    !Number.isInteger(ttl) ||
    ttl < SESSION_TTL.minimumSeconds ||
    ttl > SESSION_TTL.maximumSeconds
  )
    throw new AuthenticationError('INVALID_SESSION_TTL', 'Session TTL configuration is invalid.');
  return ttl;
}
export const hashSessionToken = (token: string) =>
  createHash('sha256').update(token, 'utf8').digest('hex');
export const generateSessionToken = () => randomBytes(32).toString('base64url');
export function uuidV7(now = Date.now(), bytes = randomBytes(10)): string {
  const b = Buffer.alloc(16);
  b.writeUIntBE(now, 0, 6);
  bytes.copy(b, 6);
  b[6] = (b[6]! & 0x0f) | 0x70;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export class InMemorySessionRepository implements SessionRepository {
  private rows = new Map<string, Session>();
  async create(row: Session) {
    if ([...this.rows.values()].some((x) => x.tokenHash === row.tokenHash))
      throw new AuthenticationError('DUPLICATE_TOKEN_HASH', 'Session token collision.');
    this.rows.set(row.sessionId, clone(row));
    return clone(row);
  }
  async findByTokenHash(hash: string) {
    return clone([...this.rows.values()].find((x) => x.tokenHash === hash) ?? null);
  }
  async findById(id: string) {
    return clone(this.rows.get(id) ?? null);
  }
  async revoke(id: string, version: number, at: string) {
    const old = this.rows.get(id);
    if (!old) throw new AuthenticationError('INVALID_SESSION', 'Session is invalid.');
    if (old.status === 'REVOKED') return clone(old);
    if (old.version !== version)
      throw new AuthenticationError('STALE_SESSION_VERSION', 'Session version is stale.');
    const row: Session = { ...old, status: 'REVOKED', revokedAt: at, version: old.version + 1 };
    this.rows.set(id, row);
    return clone(row);
  }
  async revokeAllForUser(userId: string, at: string) {
    let count = 0;
    for (const row of this.rows.values())
      if (row.userId === userId && row.status === 'ACTIVE') {
        this.rows.set(row.sessionId, {
          ...row,
          status: 'REVOKED',
          revokedAt: at,
          version: row.version + 1
        });
        count++;
      }
    return count;
  }
  async listActiveForUser(userId: string) {
    return clone(
      [...this.rows.values()]
        .filter((x) => x.userId === userId && x.status === 'ACTIVE')
        .sort(
          (a, b) => a.createdAt.localeCompare(b.createdAt) || a.sessionId.localeCompare(b.sessionId)
        )
    );
  }
}
type Row = Record<string, unknown>;
const map = (r: Row): Session => ({
  sessionId: r.session_id as string,
  userId: r.user_id as string,
  tokenHash: r.token_hash as string,
  status: r.status as Session['status'],
  version: r.version as number,
  createdAt: (r.created_at as Date).toISOString(),
  expiresAt: (r.expires_at as Date).toISOString(),
  revokedAt: r.revoked_at ? (r.revoked_at as Date).toISOString() : null
});
export class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly q: QueryClient) {}
  async create(s: Session) {
    try {
      const r = await this.q.query(
        'INSERT INTO sessions(session_id,user_id,token_hash,status,version,created_at,expires_at,revoked_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [
          s.sessionId,
          s.userId,
          s.tokenHash,
          s.status,
          s.version,
          s.createdAt,
          s.expiresAt,
          s.revokedAt
        ]
      );
      return map(r.rows[0]!);
    } catch (e) {
      if ((e as { code?: string }).code === '23505')
        throw new AuthenticationError('DUPLICATE_TOKEN_HASH', 'Session token collision.', {
          cause: e
        });
      throw e;
    }
  }
  async findByTokenHash(h: string) {
    const r = await this.q.query('SELECT * FROM sessions WHERE token_hash=$1', [h]);
    return r.rows[0] ? map(r.rows[0]) : null;
  }
  async findById(id: string) {
    const r = await this.q.query('SELECT * FROM sessions WHERE session_id=$1', [id]);
    return r.rows[0] ? map(r.rows[0]) : null;
  }
  async revoke(id: string, v: number, at: string) {
    const r = await this.q.query(
      "UPDATE sessions SET status='REVOKED',revoked_at=$3,version=version+1 WHERE session_id=$1 AND version=$2 AND status='ACTIVE' RETURNING *",
      [id, v, at]
    );
    if (r.rows[0]) return map(r.rows[0]);
    const old = await this.findById(id);
    if (!old) throw new AuthenticationError('INVALID_SESSION', 'Session is invalid.');
    if (old.status === 'REVOKED') return old;
    throw new AuthenticationError('STALE_SESSION_VERSION', 'Session version is stale.');
  }
  async revokeAllForUser(id: string, at: string) {
    const r = await this.q.query(
      "UPDATE sessions SET status='REVOKED',revoked_at=$2,version=version+1 WHERE user_id=$1 AND status='ACTIVE'",
      [id, at]
    );
    return r.rowCount ?? 0;
  }
  async listActiveForUser(id: string) {
    const r = await this.q.query(
      "SELECT * FROM sessions WHERE user_id=$1 AND status='ACTIVE' ORDER BY created_at,session_id",
      [id]
    );
    return r.rows.map(map);
  }
}
export interface AuthenticationServiceOptions {
  sessions: SessionRepository;
  users: UserRepository;
  workspaces: WorkspaceRepository;
  memberships: MembershipRepository;
  clock?: () => Date;
  tokenGenerator?: () => string;
  ttlSeconds?: number;
}
export class AuthenticationService {
  private readonly clock;
  private readonly tokenGenerator;
  private readonly ttl;
  constructor(private readonly d: AuthenticationServiceOptions) {
    this.clock = d.clock ?? (() => new Date());
    this.tokenGenerator = d.tokenGenerator ?? generateSessionToken;
    this.ttl = d.ttlSeconds ?? parseSessionTtl();
    parseSessionTtl(String(this.ttl));
  }
  async issueSession(userId: string, requestedTtl = this.ttl) {
    parseSessionTtl(String(requestedTtl));
    const user = await this.d.users.findById(userId);
    if (!user) throw new AuthenticationError('INVALID_SESSION', 'User cannot authenticate.');
    if (user.status !== 'ACTIVE')
      throw new AuthenticationError('USER_DISABLED', 'User is disabled.');
    const rawToken = this.tokenGenerator();
    const created = this.clock();
    const row: Session = {
      sessionId: uuidV7(created.getTime()),
      userId,
      tokenHash: hashSessionToken(rawToken),
      status: 'ACTIVE',
      version: 1,
      createdAt: created.toISOString(),
      expiresAt: new Date(created.getTime() + requestedTtl * 1000).toISOString(),
      revokedAt: null
    };
    await this.d.sessions.create(row);
    const session = {
      sessionId: row.sessionId,
      userId: row.userId,
      status: row.status,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      version: row.version
    };
    return { rawToken, session };
  }
  async resolveSession(rawToken: string) {
    const row = await this.d.sessions.findByTokenHash(hashSessionToken(rawToken));
    if (!row) throw new AuthenticationError('INVALID_SESSION', 'Session is invalid.');
    if (row.status === 'REVOKED')
      throw new AuthenticationError('SESSION_REVOKED', 'Session is revoked.');
    if (Date.parse(row.expiresAt) <= this.clock().getTime())
      throw new AuthenticationError('SESSION_EXPIRED', 'Session is expired.');
    const user = await this.d.users.findById(row.userId);
    if (!user) throw new AuthenticationError('INVALID_SESSION', 'Session is invalid.');
    if (user.status !== 'ACTIVE')
      throw new AuthenticationError('USER_DISABLED', 'User is disabled.');
    return Object.freeze({
      kind: 'AUTHENTICATED_USER',
      sessionId: row.sessionId,
      userId: row.userId,
      sessionExpiresAt: row.expiresAt
    } as const);
  }
  async revokeSession(id: string, version: number) {
    return this.d.sessions.revoke(id, version, this.clock().toISOString());
  }
  async revokeUserSessions(id: string) {
    return this.d.sessions.revokeAllForUser(id, this.clock().toISOString());
  }
  async resolveWorkspacePrincipal(token: string, workspaceId: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(workspaceId))
      throw new AuthenticationError('INVALID_WORKSPACE_CONTEXT', 'Workspace context is invalid.');
    const principal = await this.resolveSession(token);
    const [user, workspace, membership] = await Promise.all([
      this.d.users.findById(principal.userId),
      this.d.workspaces.findById(workspaceId),
      this.d.memberships.findByWorkspaceAndUser(workspaceId, principal.userId)
    ]);
    if (!workspace)
      throw new AuthenticationError('MEMBERSHIP_REQUIRED', 'Workspace membership is required.');
    if (workspace.status === 'ARCHIVED')
      throw new AuthenticationError('WORKSPACE_ARCHIVED', 'Workspace is archived.');
    if (!membership)
      throw new AuthenticationError('MEMBERSHIP_REQUIRED', 'Workspace membership is required.');
    if (membership.status !== 'ACTIVE')
      throw new AuthenticationError('MEMBERSHIP_SUSPENDED', 'Workspace membership is suspended.');
    if (!user || user.status !== 'ACTIVE')
      throw new AuthenticationError('USER_DISABLED', 'User is disabled.');
    if (!(ROLES as readonly string[]).includes(membership.role))
      throw new AuthenticationError('PERMISSION_DENIED', 'Permission is denied.');
    const permissions = PERMISSIONS.filter((p) =>
      hasPermission(membership.role, p, {
        userStatus: user.status,
        workspaceStatus: workspace.status,
        membershipStatus: membership.status
      })
    );
    return Object.freeze({
      kind: 'WORKSPACE',
      sessionId: principal.sessionId,
      userId: principal.userId,
      workspaceId,
      membershipId: membership.membershipId,
      role: membership.role,
      permissions: Object.freeze(permissions),
      sessionExpiresAt: principal.sessionExpiresAt
    } as const);
  }
}
export function authorize(principal: Principal, permission?: Permission) {
  if (principal.kind === 'ANONYMOUS')
    throw new AuthenticationError('AUTHENTICATION_REQUIRED', 'Authentication is required.');
  if (permission && (principal.kind !== 'WORKSPACE' || !principal.permissions.includes(permission)))
    throw new AuthenticationError('PERMISSION_DENIED', 'Permission is denied.');
  return principal;
}
export function validateInternalServiceSecret(
  configured: string | undefined,
  supplied: string | undefined
) {
  if (!configured || Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const a = Buffer.from(configured),
    b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}
