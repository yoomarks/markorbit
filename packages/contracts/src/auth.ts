import type { Permission, Role } from './identity.js';

export const SESSION_STATUSES = ['ACTIVE', 'REVOKED'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];
export interface Session {
  sessionId: string;
  userId: string;
  tokenHash: string;
  status: SessionStatus;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  version: number;
}
export type PublicSession = Omit<Session, 'tokenHash'>;
export interface AnonymousPrincipal {
  kind: 'ANONYMOUS';
}
export interface AuthenticatedUserPrincipal {
  kind: 'AUTHENTICATED_USER';
  sessionId: string;
  userId: string;
  sessionExpiresAt: string;
}
export interface WorkspacePrincipal {
  kind: 'WORKSPACE';
  sessionId: string;
  userId: string;
  workspaceId: string;
  membershipId: string;
  role: Role;
  permissions: readonly Permission[];
  sessionExpiresAt: string;
}
export type Principal = AnonymousPrincipal | AuthenticatedUserPrincipal | WorkspacePrincipal;
export interface InternalWorkspacePrincipalEnvelope {
  schemaVersion: 1;
  principal: WorkspacePrincipal;
}
export function encodeInternalWorkspacePrincipal(principal: WorkspacePrincipal): string {
  return Buffer.from(JSON.stringify({ schemaVersion: 1, principal }), 'utf8').toString('base64url');
}
export function parseInternalWorkspacePrincipal(value: string | undefined): WorkspacePrincipal {
  if (!value)
    throw new AuthenticationError('AUTHENTICATION_REQUIRED', 'Workspace Principal is required.');
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    throw new AuthenticationError('AUTHENTICATION_REQUIRED', 'Workspace Principal is invalid.');
  }
  const envelope = decoded as Partial<InternalWorkspacePrincipalEnvelope>;
  const p = envelope.principal as Partial<WorkspacePrincipal> | undefined;
  if (
    envelope.schemaVersion !== 1 ||
    !p ||
    p.kind !== 'WORKSPACE' ||
    !['WORKSPACE_ADMIN', 'MATTER_MANAGER', 'REVIEWER', 'READ_ONLY'].includes(String(p.role)) ||
    !Array.isArray(p.permissions) ||
    p.permissions.some(
      (x) =>
        ![
          'workspace:read',
          'workspace:manage',
          'membership:read',
          'membership:manage',
          'matter:read',
          'matter:create',
          'matter:manage',
          'review:read',
          'review:perform',
          'document-package:read',
          'document-package:prepare',
          'instruction-ledger:read',
          'instruction-ledger:write',
          'document-package:mark-ready'
        ].includes(String(x))
    ) ||
    [p.sessionId, p.userId, p.workspaceId, p.membershipId, p.sessionExpiresAt].some(
      (x) => typeof x !== 'string' || x.length === 0
    )
  )
    throw new AuthenticationError('AUTHENTICATION_REQUIRED', 'Workspace Principal is invalid.');
  return structuredClone(p as WorkspacePrincipal);
}
export type AuthenticationErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'INVALID_SESSION'
  | 'SESSION_EXPIRED'
  | 'SESSION_REVOKED'
  | 'USER_DISABLED'
  | 'WORKSPACE_CONTEXT_REQUIRED'
  | 'INVALID_WORKSPACE_CONTEXT'
  | 'MEMBERSHIP_REQUIRED'
  | 'MEMBERSHIP_SUSPENDED'
  | 'WORKSPACE_ARCHIVED'
  | 'PERMISSION_DENIED'
  | 'INVALID_CSRF_TOKEN'
  | 'UNTRUSTED_ORIGIN'
  | 'INTERNAL_SERVICE_UNAUTHORIZED'
  | 'AUTHENTICATION_SERVICE_UNAVAILABLE'
  | 'DUPLICATE_TOKEN_HASH'
  | 'STALE_SESSION_VERSION'
  | 'INVALID_SESSION_TTL';
export class AuthenticationError extends Error {
  constructor(
    public readonly code: AuthenticationErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'AuthenticationError';
  }
}
export interface SessionRepository {
  create(session: Session): Promise<Session>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  findById(sessionId: string): Promise<Session | null>;
  revoke(sessionId: string, expectedVersion: number, revokedAt: string): Promise<Session>;
  revokeAllForUser(userId: string, revokedAt: string): Promise<number>;
  listActiveForUser(userId: string): Promise<Session[]>;
}
