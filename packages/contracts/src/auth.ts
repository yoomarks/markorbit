import { PERMISSIONS, type Permission, type Role, type UserStatus } from './identity.js';

export const ACCOUNT_TYPES = ['CUSTOMER', 'PROFESSIONAL', 'PROVIDER', 'INTERNAL'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];
export const SELF_SERVICE_ACCOUNT_TYPES = ['CUSTOMER', 'PROFESSIONAL'] as const;
export type SelfServiceAccountType = (typeof SELF_SERVICE_ACCOUNT_TYPES)[number];
export interface AccountProfile {
  userId: string;
  accountType: AccountType;
  createdAt: string;
  updatedAt: string;
}
export interface AccountSummary {
  userId: string;
  email: string;
  displayName: string;
  accountType: AccountType;
}
export interface RegisterAccountCommand {
  email: string;
  displayName: string;
  password: string;
  accountType: SelfServiceAccountType;
}
export interface LoginAccountCommand {
  email: string;
  password: string;
}
export interface AccountAccessResult {
  account: AccountSummary;
  rawToken: string;
  session: {
    sessionId: string;
    userId: string;
    status: 'ACTIVE';
    createdAt: string;
    expiresAt: string;
    revokedAt: null;
    version: number;
  };
}

export const COMMERCIAL_ADMIN_CAPABILITIES = [
  'commercial-admin:read',
  'commercial-admin:operate'
] as const;
export type CommercialAdminCapability = (typeof COMMERCIAL_ADMIN_CAPABILITIES)[number];
export interface CommercialAdminAccountView {
  userId: string;
  email: string;
  displayName: string;
  accountType: AccountType;
  status: UserStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  profileCreatedAt: string;
  profileUpdatedAt: string;
}
export interface InternalOperatorPrincipal {
  kind: 'INTERNAL_OPERATOR';
  sessionId: string;
  userId: string;
  capabilities: readonly CommercialAdminCapability[];
  sessionExpiresAt: string;
}
export function commercialAdminCapabilitiesForAccount(
  account: Pick<CommercialAdminAccountView, 'accountType' | 'status'>
): readonly CommercialAdminCapability[] {
  return account.accountType === 'INTERNAL' && account.status === 'ACTIVE'
    ? COMMERCIAL_ADMIN_CAPABILITIES
    : [];
}
export interface InternalOperatorPrincipalEnvelope {
  schemaVersion: 1;
  principal: InternalOperatorPrincipal;
}
export function encodeInternalOperatorPrincipal(principal: InternalOperatorPrincipal): string {
  return Buffer.from(JSON.stringify({ schemaVersion: 1, principal }), 'utf8').toString('base64url');
}
export function parseInternalOperatorPrincipal(
  value: string | undefined
): InternalOperatorPrincipal {
  if (!value)
    throw new AuthenticationError('AUTHENTICATION_REQUIRED', 'Internal operator Principal is required.');
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    throw new AuthenticationError('AUTHENTICATION_REQUIRED', 'Internal operator Principal is invalid.');
  }
  const envelope = decoded as Partial<InternalOperatorPrincipalEnvelope>;
  const principal = envelope.principal as Partial<InternalOperatorPrincipal> | undefined;
  if (
    envelope.schemaVersion !== 1 ||
    !principal ||
    principal.kind !== 'INTERNAL_OPERATOR' ||
    !Array.isArray(principal.capabilities) ||
    principal.capabilities.some(
      (capability) =>
        !(COMMERCIAL_ADMIN_CAPABILITIES as readonly string[]).includes(String(capability))
    ) ||
    [principal.sessionId, principal.userId, principal.sessionExpiresAt].some(
      (item) => typeof item !== 'string' || item.length === 0
    )
  )
    throw new AuthenticationError('AUTHENTICATION_REQUIRED', 'Internal operator Principal is invalid.');
  return structuredClone(principal as InternalOperatorPrincipal);
}

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
export type Principal =
  | AnonymousPrincipal
  | AuthenticatedUserPrincipal
  | WorkspacePrincipal
  | InternalOperatorPrincipal;
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
    p.permissions.some((x) => !PERMISSIONS.includes(x as Permission)) ||
    [p.sessionId, p.userId, p.workspaceId, p.membershipId, p.sessionExpiresAt].some(
      (x) => typeof x !== 'string' || x.length === 0
    )
  )
    throw new AuthenticationError('AUTHENTICATION_REQUIRED', 'Workspace Principal is invalid.');
  return structuredClone(p as WorkspacePrincipal);
}
export type AuthenticationErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'INVALID_ACCOUNT_TYPE'
  | 'WEAK_PASSWORD'
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
