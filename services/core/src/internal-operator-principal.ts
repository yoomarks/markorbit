import {
  AuthenticationError,
  type ControlPlaneCapability,
  type InternalOperatorPrincipal,
  type LiteAdminCapability,
  type WorkspaceAdminCapability
} from '@markorbit/contracts';
import type { AccountAccessService } from './account-access.js';
import type { AuthenticationService } from './auth.js';

export const COGNITIVE_READ_GRANTS_ENV = 'MO_COGNITIVE_READ_GRANTS_JSON';
export const DATA_READ_GRANTS_ENV = 'MO_DATA_READ_GRANTS_JSON';
export const KNOWLEDGE_READ_GRANTS_ENV = 'MO_KNOWLEDGE_READ_GRANTS_JSON';
export const WORKSPACE_ADMIN_READ_GRANTS_ENV = 'MO_WORKSPACE_ADMIN_READ_GRANTS_JSON';
export const WORKSPACE_ADMIN_MANAGE_GRANTS_ENV = 'MO_WORKSPACE_ADMIN_MANAGE_GRANTS_JSON';
export const LITE_ADMIN_READ_GRANTS_ENV = 'MO_LITE_ADMIN_READ_GRANTS_JSON';
const COGNITIVE_READ_CAPABILITY = 'control-plane:cognitive:read' as const;
const DATA_READ_CAPABILITY = 'control-plane:data:read' as const;
const KNOWLEDGE_READ_CAPABILITY = 'control-plane:knowledge:read' as const;
const WORKSPACE_ADMIN_READ_CAPABILITY = 'workspace-admin:read' as const;
const WORKSPACE_ADMIN_MANAGE_CAPABILITY = 'workspace-admin:manage' as const;
const LITE_ADMIN_READ_CAPABILITY = 'lite-admin:read' as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export class CognitiveReadGrantSourceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CognitiveReadGrantSourceError';
  }
}

export class DataReadGrantSourceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DataReadGrantSourceError';
  }
}

export class KnowledgeReadGrantSourceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'KnowledgeReadGrantSourceError';
  }
}

export class WorkspaceAdminReadGrantSourceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'WorkspaceAdminReadGrantSourceError';
  }
}

export class LiteAdminReadGrantSourceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'LiteAdminReadGrantSourceError';
  }
}

export class WorkspaceAdminManageGrantSourceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'WorkspaceAdminManageGrantSourceError';
  }
}

export interface CognitiveReadGrantSourceV1 {
  hasGrant(userId: string): Promise<boolean>;
}

export interface DataReadGrantSourceV1 {
  hasGrant(userId: string): Promise<boolean>;
}

export interface KnowledgeReadGrantSourceV1 {
  hasGrant(userId: string): Promise<boolean>;
}

export interface WorkspaceAdminReadGrantSourceV1 {
  hasGrant(userId: string): Promise<boolean>;
}

export interface LiteAdminReadGrantSourceV1 {
  hasGrant(userId: string): Promise<boolean>;
}

export interface WorkspaceAdminManageGrantSourceV1 {
  hasGrant(userId: string): Promise<boolean>;
}

function normalizedUserIds(
  userIds: Iterable<string>,
  label:
    'Cognitive' | 'Data' | 'Knowledge' | 'Workspace Admin' | 'Workspace Admin Manage' | 'Lite Admin'
): string[] {
  const normalized = [...userIds].map((userId) => userId.trim().toLowerCase());
  const invalid = normalized.some((userId) => !UUID.test(userId));
  const duplicated = new Set(normalized).size !== normalized.length;
  if (label === 'Cognitive') {
    if (invalid)
      throw new CognitiveReadGrantSourceError('Cognitive read grant user identity is malformed.');
    if (duplicated)
      throw new CognitiveReadGrantSourceError('Cognitive read grant user identity is duplicated.');
  } else if (label === 'Data') {
    if (invalid) throw new DataReadGrantSourceError('Data read grant user identity is malformed.');
    if (duplicated)
      throw new DataReadGrantSourceError('Data read grant user identity is duplicated.');
  } else if (label === 'Knowledge') {
    if (invalid)
      throw new KnowledgeReadGrantSourceError('Knowledge read grant user identity is malformed.');
    if (duplicated)
      throw new KnowledgeReadGrantSourceError('Knowledge read grant user identity is duplicated.');
  } else if (label === 'Workspace Admin') {
    if (invalid)
      throw new WorkspaceAdminReadGrantSourceError(
        'Workspace Admin read grant user identity is malformed.'
      );
    if (duplicated)
      throw new WorkspaceAdminReadGrantSourceError(
        'Workspace Admin read grant user identity is duplicated.'
      );
  } else if (label === 'Workspace Admin Manage') {
    if (invalid)
      throw new WorkspaceAdminManageGrantSourceError(
        'Workspace Admin manage grant user identity is malformed.'
      );
    if (duplicated)
      throw new WorkspaceAdminManageGrantSourceError(
        'Workspace Admin manage grant user identity is duplicated.'
      );
  } else {
    if (invalid)
      throw new LiteAdminReadGrantSourceError('Lite Admin read grant user identity is malformed.');
    if (duplicated)
      throw new LiteAdminReadGrantSourceError('Lite Admin read grant user identity is duplicated.');
  }
  return normalized;
}

export class StaticCognitiveReadGrantSourceV1 implements CognitiveReadGrantSourceV1 {
  private readonly userIds: ReadonlySet<string>;

  constructor(userIds: Iterable<string>) {
    this.userIds = new Set(normalizedUserIds(userIds, 'Cognitive'));
  }

  hasGrant(userId: string): Promise<boolean> {
    return Promise.resolve(this.userIds.has(userId.trim().toLowerCase()));
  }
}

export class StaticDataReadGrantSourceV1 implements DataReadGrantSourceV1 {
  private readonly userIds: ReadonlySet<string>;

  constructor(userIds: Iterable<string>) {
    this.userIds = new Set(normalizedUserIds(userIds, 'Data'));
  }

  hasGrant(userId: string): Promise<boolean> {
    return Promise.resolve(this.userIds.has(userId.trim().toLowerCase()));
  }
}

export class StaticKnowledgeReadGrantSourceV1 implements KnowledgeReadGrantSourceV1 {
  private readonly userIds: ReadonlySet<string>;

  constructor(userIds: Iterable<string>) {
    this.userIds = new Set(normalizedUserIds(userIds, 'Knowledge'));
  }

  hasGrant(userId: string): Promise<boolean> {
    return Promise.resolve(this.userIds.has(userId.trim().toLowerCase()));
  }
}

export class StaticWorkspaceAdminReadGrantSourceV1 implements WorkspaceAdminReadGrantSourceV1 {
  private readonly userIds: ReadonlySet<string>;

  constructor(userIds: Iterable<string>) {
    this.userIds = new Set(normalizedUserIds(userIds, 'Workspace Admin'));
  }

  hasGrant(userId: string): Promise<boolean> {
    return Promise.resolve(this.userIds.has(userId.trim().toLowerCase()));
  }
}

export class StaticLiteAdminReadGrantSourceV1 implements LiteAdminReadGrantSourceV1 {
  private readonly userIds: ReadonlySet<string>;
  constructor(userIds: Iterable<string>) {
    this.userIds = new Set(normalizedUserIds(userIds, 'Lite Admin'));
  }
  hasGrant(userId: string): Promise<boolean> {
    return Promise.resolve(this.userIds.has(userId.trim().toLowerCase()));
  }
}

export class StaticWorkspaceAdminManageGrantSourceV1 implements WorkspaceAdminManageGrantSourceV1 {
  private readonly userIds: ReadonlySet<string>;

  constructor(userIds: Iterable<string>) {
    this.userIds = new Set(normalizedUserIds(userIds, 'Workspace Admin Manage'));
  }

  hasGrant(userId: string): Promise<boolean> {
    return Promise.resolve(this.userIds.has(userId.trim().toLowerCase()));
  }
}

class UnavailableCognitiveReadGrantSourceV1 implements CognitiveReadGrantSourceV1 {
  constructor(private readonly cause?: Error) {}

  hasGrant(): Promise<boolean> {
    return Promise.reject(
      new CognitiveReadGrantSourceError('Cognitive read grant source is unavailable.', {
        cause: this.cause
      })
    );
  }
}

class UnavailableDataReadGrantSourceV1 implements DataReadGrantSourceV1 {
  constructor(private readonly cause?: Error) {}

  hasGrant(): Promise<boolean> {
    return Promise.reject(
      new DataReadGrantSourceError('Data read grant source is unavailable.', {
        cause: this.cause
      })
    );
  }
}

class UnavailableKnowledgeReadGrantSourceV1 implements KnowledgeReadGrantSourceV1 {
  constructor(private readonly cause?: Error) {}

  hasGrant(): Promise<boolean> {
    return Promise.reject(
      new KnowledgeReadGrantSourceError('Knowledge read grant source is unavailable.', {
        cause: this.cause
      })
    );
  }
}

class UnavailableWorkspaceAdminReadGrantSourceV1 implements WorkspaceAdminReadGrantSourceV1 {
  constructor(private readonly cause?: Error) {}

  hasGrant(): Promise<boolean> {
    return Promise.reject(
      new WorkspaceAdminReadGrantSourceError('Workspace Admin read grant source is unavailable.', {
        cause: this.cause
      })
    );
  }
}

class UnavailableLiteAdminReadGrantSourceV1 implements LiteAdminReadGrantSourceV1 {
  constructor(private readonly cause?: Error) {}
  hasGrant(): Promise<boolean> {
    return Promise.reject(
      new LiteAdminReadGrantSourceError('Lite Admin read grant source is unavailable.', {
        cause: this.cause
      })
    );
  }
}

class UnavailableWorkspaceAdminManageGrantSourceV1 implements WorkspaceAdminManageGrantSourceV1 {
  constructor(private readonly cause?: Error) {}

  hasGrant(): Promise<boolean> {
    return Promise.reject(
      new WorkspaceAdminManageGrantSourceError(
        'Workspace Admin manage grant source is unavailable.',
        {
          cause: this.cause
        }
      )
    );
  }
}

type GrantBackedCapability =
  ControlPlaneCapability | WorkspaceAdminCapability | LiteAdminCapability;

type GrantConfig<TCapability extends GrantBackedCapability> = {
  schemaVersion: 1;
  grants: readonly {
    userId: string;
    capabilities: readonly [TCapability];
  }[];
};

function parseGrantConfig<TCapability extends GrantBackedCapability>(
  value: string,
  capability: TCapability,
  label:
    'Cognitive' | 'Data' | 'Knowledge' | 'Workspace Admin' | 'Workspace Admin Manage' | 'Lite Admin'
): GrantConfig<TCapability> {
  const fail = (message: string, cause?: Error): never => {
    if (label === 'Cognitive')
      throw new CognitiveReadGrantSourceError(message, cause ? { cause } : undefined);
    if (label === 'Data')
      throw new DataReadGrantSourceError(message, cause ? { cause } : undefined);
    if (label === 'Knowledge')
      throw new KnowledgeReadGrantSourceError(message, cause ? { cause } : undefined);
    if (label === 'Workspace Admin')
      throw new WorkspaceAdminReadGrantSourceError(message, cause ? { cause } : undefined);
    if (label === 'Workspace Admin Manage')
      throw new WorkspaceAdminManageGrantSourceError(message, cause ? { cause } : undefined);
    throw new LiteAdminReadGrantSourceError(message, cause ? { cause } : undefined);
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    return fail(
      `${label === 'Workspace Admin Manage' ? 'Workspace Admin manage' : `${label} read`} grant configuration is malformed.`,
      error instanceof Error ? error : undefined
    );
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    return fail(
      `${label === 'Workspace Admin Manage' ? 'Workspace Admin manage' : `${label} read`} grant configuration is malformed.`
    );
  const config = parsed as Record<string, unknown>;
  if (
    config.schemaVersion !== 1 ||
    !Array.isArray(config.grants) ||
    Object.keys(config).some((key) => !['schemaVersion', 'grants'].includes(key))
  )
    return fail(
      `${label === 'Workspace Admin Manage' ? 'Workspace Admin manage' : `${label} read`} grant configuration is malformed.`
    );

  const grants = config.grants.map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      return fail(
        `${label === 'Workspace Admin Manage' ? 'Workspace Admin manage' : `${label} read`} grant entry is malformed.`
      );
    const grant = raw as Record<string, unknown>;
    if (
      Object.keys(grant).some((key) => !['userId', 'capabilities'].includes(key)) ||
      typeof grant.userId !== 'string' ||
      !UUID.test(grant.userId.trim().toLowerCase()) ||
      !Array.isArray(grant.capabilities) ||
      grant.capabilities.length !== 1 ||
      grant.capabilities[0] !== capability
    )
      return fail(
        `${label === 'Workspace Admin Manage' ? 'Workspace Admin manage' : `${label} read`} grant entry is malformed.`
      );
    return {
      userId: grant.userId.trim().toLowerCase(),
      capabilities: [capability] as const
    };
  });
  if (new Set(grants.map((grant) => grant.userId)).size !== grants.length)
    return fail(
      `${label === 'Workspace Admin Manage' ? 'Workspace Admin manage' : `${label} read`} grant user identity is duplicated.`
    );
  return { schemaVersion: 1, grants };
}

export function createEnvironmentCognitiveReadGrantSourceV1(
  value = process.env[COGNITIVE_READ_GRANTS_ENV]
): CognitiveReadGrantSourceV1 {
  if (value === undefined)
    return new UnavailableCognitiveReadGrantSourceV1(
      new Error(`${COGNITIVE_READ_GRANTS_ENV} is not configured.`)
    );
  try {
    const config = parseGrantConfig(value, COGNITIVE_READ_CAPABILITY, 'Cognitive');
    return new StaticCognitiveReadGrantSourceV1(config.grants.map((grant) => grant.userId));
  } catch (error) {
    return new UnavailableCognitiveReadGrantSourceV1(error instanceof Error ? error : undefined);
  }
}

export function createEnvironmentDataReadGrantSourceV1(
  value = process.env[DATA_READ_GRANTS_ENV]
): DataReadGrantSourceV1 {
  if (value === undefined)
    return new UnavailableDataReadGrantSourceV1(
      new Error(`${DATA_READ_GRANTS_ENV} is not configured.`)
    );
  try {
    const config = parseGrantConfig(value, DATA_READ_CAPABILITY, 'Data');
    return new StaticDataReadGrantSourceV1(config.grants.map((grant) => grant.userId));
  } catch (error) {
    return new UnavailableDataReadGrantSourceV1(error instanceof Error ? error : undefined);
  }
}

export function createEnvironmentKnowledgeReadGrantSourceV1(
  value = process.env[KNOWLEDGE_READ_GRANTS_ENV]
): KnowledgeReadGrantSourceV1 {
  if (value === undefined)
    return new UnavailableKnowledgeReadGrantSourceV1(
      new Error(`${KNOWLEDGE_READ_GRANTS_ENV} is not configured.`)
    );
  try {
    const config = parseGrantConfig(value, KNOWLEDGE_READ_CAPABILITY, 'Knowledge');
    return new StaticKnowledgeReadGrantSourceV1(config.grants.map((grant) => grant.userId));
  } catch (error) {
    return new UnavailableKnowledgeReadGrantSourceV1(error instanceof Error ? error : undefined);
  }
}

export function createEnvironmentWorkspaceAdminReadGrantSourceV1(
  value = process.env[WORKSPACE_ADMIN_READ_GRANTS_ENV]
): WorkspaceAdminReadGrantSourceV1 {
  if (value === undefined)
    return new UnavailableWorkspaceAdminReadGrantSourceV1(
      new Error(`${WORKSPACE_ADMIN_READ_GRANTS_ENV} is not configured.`)
    );
  try {
    const config = parseGrantConfig(value, WORKSPACE_ADMIN_READ_CAPABILITY, 'Workspace Admin');
    return new StaticWorkspaceAdminReadGrantSourceV1(config.grants.map((grant) => grant.userId));
  } catch (error) {
    return new UnavailableWorkspaceAdminReadGrantSourceV1(
      error instanceof Error ? error : undefined
    );
  }
}

export function createEnvironmentLiteAdminReadGrantSourceV1(
  value = process.env[LITE_ADMIN_READ_GRANTS_ENV]
): LiteAdminReadGrantSourceV1 {
  if (value === undefined)
    return new UnavailableLiteAdminReadGrantSourceV1(
      new Error(`${LITE_ADMIN_READ_GRANTS_ENV} is not configured.`)
    );
  try {
    const config = parseGrantConfig(value, LITE_ADMIN_READ_CAPABILITY, 'Lite Admin');
    return new StaticLiteAdminReadGrantSourceV1(config.grants.map((grant) => grant.userId));
  } catch (error) {
    return new UnavailableLiteAdminReadGrantSourceV1(error instanceof Error ? error : undefined);
  }
}

export function createEnvironmentWorkspaceAdminManageGrantSourceV1(
  value = process.env[WORKSPACE_ADMIN_MANAGE_GRANTS_ENV]
): WorkspaceAdminManageGrantSourceV1 {
  if (value === undefined)
    return new UnavailableWorkspaceAdminManageGrantSourceV1(
      new Error(`${WORKSPACE_ADMIN_MANAGE_GRANTS_ENV} is not configured.`)
    );
  try {
    const config = parseGrantConfig(
      value,
      WORKSPACE_ADMIN_MANAGE_CAPABILITY,
      'Workspace Admin Manage'
    );
    return new StaticWorkspaceAdminManageGrantSourceV1(config.grants.map((grant) => grant.userId));
  } catch (error) {
    return new UnavailableWorkspaceAdminManageGrantSourceV1(
      error instanceof Error ? error : undefined
    );
  }
}

export interface InternalOperatorPrincipalResolverOptionsV1 {
  authentication: Pick<AuthenticationService, 'resolveSession'>;
  accountAccess: Pick<AccountAccessService, 'inspectAccount'>;
  cognitiveReadGrants: Readonly<CognitiveReadGrantSourceV1>;
  dataReadGrants?: Readonly<DataReadGrantSourceV1>;
  knowledgeReadGrants?: Readonly<KnowledgeReadGrantSourceV1>;
  workspaceAdminReadGrants?: Readonly<WorkspaceAdminReadGrantSourceV1>;
  workspaceAdminManageGrants?: Readonly<WorkspaceAdminManageGrantSourceV1>;
  liteAdminReadGrants?: Readonly<LiteAdminReadGrantSourceV1>;
}

export class InternalOperatorPrincipalResolverV1 {
  constructor(private readonly options: InternalOperatorPrincipalResolverOptionsV1) {}

  async resolve(
    token: string,
    requiredCapability: GrantBackedCapability = COGNITIVE_READ_CAPABILITY
  ): Promise<Readonly<InternalOperatorPrincipal>> {
    const session = await this.options.authentication.resolveSession(token);
    const account = await this.options.accountAccess.inspectAccount(session.userId);
    if (!account)
      throw new AuthenticationError('AUTHENTICATION_REQUIRED', 'Account was not found.');
    if (account.status !== 'ACTIVE')
      throw new AuthenticationError('USER_DISABLED', 'User is disabled.');
    if (account.accountType !== 'INTERNAL')
      throw new AuthenticationError(
        'PERMISSION_DENIED',
        'Internal Operator account authority is required.'
      );

    const source =
      requiredCapability === COGNITIVE_READ_CAPABILITY
        ? this.options.cognitiveReadGrants
        : requiredCapability === DATA_READ_CAPABILITY
          ? this.options.dataReadGrants
          : requiredCapability === KNOWLEDGE_READ_CAPABILITY
            ? this.options.knowledgeReadGrants
            : requiredCapability === WORKSPACE_ADMIN_READ_CAPABILITY
              ? this.options.workspaceAdminReadGrants
              : requiredCapability === WORKSPACE_ADMIN_MANAGE_CAPABILITY
                ? this.options.workspaceAdminManageGrants
                : requiredCapability === LITE_ADMIN_READ_CAPABILITY
                  ? this.options.liteAdminReadGrants
                  : undefined;
    if (!source)
      throw new AuthenticationError(
        'AUTHENTICATION_SERVICE_UNAVAILABLE',
        `${requiredCapability} grant source is unavailable.`
      );

    let granted: boolean;
    try {
      granted = await source.hasGrant(session.userId);
    } catch (error) {
      if (
        error instanceof CognitiveReadGrantSourceError ||
        error instanceof DataReadGrantSourceError ||
        error instanceof KnowledgeReadGrantSourceError ||
        error instanceof WorkspaceAdminReadGrantSourceError ||
        error instanceof WorkspaceAdminManageGrantSourceError ||
        error instanceof LiteAdminReadGrantSourceError
      )
        throw new AuthenticationError(
          'AUTHENTICATION_SERVICE_UNAVAILABLE',
          `${requiredCapability} grant source is unavailable.`,
          { cause: error }
        );
      throw error;
    }
    if (!granted)
      throw new AuthenticationError(
        'PERMISSION_DENIED',
        `Explicit ${requiredCapability} grant is required.`
      );

    return Object.freeze({
      kind: 'INTERNAL_OPERATOR',
      sessionId: session.sessionId,
      userId: session.userId,
      capabilities: Object.freeze([requiredCapability]),
      sessionExpiresAt: session.sessionExpiresAt
    });
  }
}
