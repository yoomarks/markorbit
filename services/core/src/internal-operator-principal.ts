import {
  AuthenticationError,
  type ControlPlaneCapability,
  type InternalOperatorPrincipal
} from '@markorbit/contracts';
import type { AccountAccessService } from './account-access.js';
import type { AuthenticationService } from './auth.js';

export const COGNITIVE_READ_GRANTS_ENV = 'MO_COGNITIVE_READ_GRANTS_JSON';
export const DATA_READ_GRANTS_ENV = 'MO_DATA_READ_GRANTS_JSON';
const COGNITIVE_READ_CAPABILITY = 'control-plane:cognitive:read' as const;
const DATA_READ_CAPABILITY = 'control-plane:data:read' as const;
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

export interface CognitiveReadGrantSourceV1 {
  hasGrant(userId: string): Promise<boolean>;
}

export interface DataReadGrantSourceV1 {
  hasGrant(userId: string): Promise<boolean>;
}

function normalizedUserIds(userIds: Iterable<string>, label: 'Cognitive' | 'Data'): string[] {
  const normalized = [...userIds].map((userId) => userId.trim().toLowerCase());
  const invalid = normalized.some((userId) => !UUID.test(userId));
  const duplicated = new Set(normalized).size !== normalized.length;
  if (label === 'Cognitive') {
    if (invalid)
      throw new CognitiveReadGrantSourceError('Cognitive read grant user identity is malformed.');
    if (duplicated)
      throw new CognitiveReadGrantSourceError('Cognitive read grant user identity is duplicated.');
  } else {
    if (invalid) throw new DataReadGrantSourceError('Data read grant user identity is malformed.');
    if (duplicated) throw new DataReadGrantSourceError('Data read grant user identity is duplicated.');
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

type GrantConfig<TCapability extends ControlPlaneCapability> = {
  schemaVersion: 1;
  grants: readonly {
    userId: string;
    capabilities: readonly [TCapability];
  }[];
};

function parseGrantConfig<TCapability extends ControlPlaneCapability>(
  value: string,
  capability: TCapability,
  label: 'Cognitive' | 'Data'
): GrantConfig<TCapability> {
  const fail = (message: string, cause?: Error): never => {
    if (label === 'Cognitive')
      throw new CognitiveReadGrantSourceError(message, cause ? { cause } : undefined);
    throw new DataReadGrantSourceError(message, cause ? { cause } : undefined);
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    return fail(
      `${label} read grant configuration is malformed.`,
      error instanceof Error ? error : undefined
    );
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    return fail(`${label} read grant configuration is malformed.`);
  const config = parsed as Record<string, unknown>;
  if (
    config.schemaVersion !== 1 ||
    !Array.isArray(config.grants) ||
    Object.keys(config).some((key) => !['schemaVersion', 'grants'].includes(key))
  )
    return fail(`${label} read grant configuration is malformed.`);

  const grants = config.grants.map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      return fail(`${label} read grant entry is malformed.`);
    const grant = raw as Record<string, unknown>;
    if (
      Object.keys(grant).some((key) => !['userId', 'capabilities'].includes(key)) ||
      typeof grant.userId !== 'string' ||
      !UUID.test(grant.userId.trim().toLowerCase()) ||
      !Array.isArray(grant.capabilities) ||
      grant.capabilities.length !== 1 ||
      grant.capabilities[0] !== capability
    )
      return fail(`${label} read grant entry is malformed.`);
    return {
      userId: grant.userId.trim().toLowerCase(),
      capabilities: [capability] as const
    };
  });
  if (new Set(grants.map((grant) => grant.userId)).size !== grants.length)
    return fail(`${label} read grant user identity is duplicated.`);
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

export interface InternalOperatorPrincipalResolverOptionsV1 {
  authentication: Pick<AuthenticationService, 'resolveSession'>;
  accountAccess: Pick<AccountAccessService, 'inspectAccount'>;
  cognitiveReadGrants: Readonly<CognitiveReadGrantSourceV1>;
  dataReadGrants?: Readonly<DataReadGrantSourceV1>;
}

export class InternalOperatorPrincipalResolverV1 {
  constructor(private readonly options: InternalOperatorPrincipalResolverOptionsV1) {}

  async resolve(
    token: string,
    requiredCapability: ControlPlaneCapability = COGNITIVE_READ_CAPABILITY
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
      if (error instanceof CognitiveReadGrantSourceError || error instanceof DataReadGrantSourceError)
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
