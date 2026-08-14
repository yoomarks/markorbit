import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import {
  AuthenticationError,
  SELF_SERVICE_ACCOUNT_TYPES,
  type AccountAccessResult,
  type AccountProfile,
  type AccountSummary,
  type AccountType,
  type LoginAccountCommand,
  type RegisterAccountCommand,
  type User,
  type UserRepository
} from '@markorbit/contracts';
import type { ManagedDatabase } from '@markorbit/persistence';
import { IdentityError } from '@markorbit/contracts';
import { AuthenticationService, uuidV7 } from './auth.js';
import { normalizeEmail, PostgresUserRepository } from './identity.js';

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;
const MIN_PASSWORD_BYTES = 10;
const MAX_PASSWORD_BYTES = 128;

const derive = (password: string, salt: Buffer, keyLength = SCRYPT_KEY_LENGTH) =>
  new Promise<Buffer>((resolve, reject) => {
    nodeScrypt(
      password,
      salt,
      keyLength,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM },
      (error, key) => (error ? reject(error) : resolve(key as Buffer))
    );
  });

export function validatePassword(password: string): void {
  const bytes = Buffer.byteLength(password, 'utf8');
  if (bytes < MIN_PASSWORD_BYTES || bytes > MAX_PASSWORD_BYTES)
    throw new AuthenticationError(
      'WEAK_PASSWORD',
      `Password must be between ${MIN_PASSWORD_BYTES} and ${MAX_PASSWORD_BYTES} UTF-8 bytes.`
    );
}

export async function hashPassword(password: string): Promise<string> {
  validatePassword(password);
  const salt = randomBytes(16);
  const hash = await derive(password, salt);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [n, r, p] = parts.slice(1, 4).map(Number);
  if (n !== SCRYPT_N || r !== SCRYPT_R || p !== SCRYPT_P) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4]!, 'base64url');
    expected = Buffer.from(parts[5]!, 'base64url');
  } catch {
    return false;
  }
  if (salt.length < 16 || expected.length !== SCRYPT_KEY_LENGTH) return false;
  let actual: Buffer;
  try {
    actual = await derive(password, salt, expected.length);
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export interface StoredAccountAccess {
  user: User;
  profile: AccountProfile;
  passwordHash: string;
}

export interface AccountAccessStore {
  register(input: {
    userId: string;
    email: string;
    displayName: string;
    accountType: AccountType;
    passwordHash: string;
  }): Promise<StoredAccountAccess>;
  findByNormalizedEmail(email: string): Promise<StoredAccountAccess | null>;
}

function profile(userId: string, accountType: AccountType, at: string): AccountProfile {
  return { userId, accountType, createdAt: at, updatedAt: at };
}

function duplicate(error: unknown): never {
  if (error instanceof IdentityError && error.code === 'DUPLICATE_NORMALIZED_EMAIL')
    throw new AuthenticationError(
      'EMAIL_ALREADY_REGISTERED',
      'An account with that email already exists.'
    );
  throw error;
}

export class InMemoryAccountAccessStore implements AccountAccessStore {
  private readonly records = new Map<string, { profile: AccountProfile; passwordHash: string }>();

  constructor(
    private readonly users: UserRepository,
    private readonly clock: () => Date = () => new Date()
  ) {}

  async register(input: {
    userId: string;
    email: string;
    displayName: string;
    accountType: AccountType;
    passwordHash: string;
  }): Promise<StoredAccountAccess> {
    let user: User;
    try {
      user = await this.users.create({
        userId: input.userId,
        email: input.email,
        displayName: input.displayName
      });
    } catch (error) {
      duplicate(error);
    }
    const at = this.clock().toISOString();
    const accountProfile = profile(input.userId, input.accountType, at);
    this.records.set(input.userId, { profile: accountProfile, passwordHash: input.passwordHash });
    return { user, profile: accountProfile, passwordHash: input.passwordHash };
  }

  async findByNormalizedEmail(email: string): Promise<StoredAccountAccess | null> {
    const user = await this.users.findByNormalizedEmail(normalizeEmail(email));
    if (!user) return null;
    const record = this.records.get(user.userId);
    return record ? { user, profile: structuredClone(record.profile), passwordHash: record.passwordHash } : null;
  }
}

type ProfileRow = {
  account_type: AccountType;
  created_at: Date;
  updated_at: Date;
  password_hash: string;
};

export class PostgresAccountAccessStore implements AccountAccessStore {
  constructor(private readonly database: ManagedDatabase) {}

  async register(input: {
    userId: string;
    email: string;
    displayName: string;
    accountType: AccountType;
    passwordHash: string;
  }): Promise<StoredAccountAccess> {
    try {
      return await this.database.transact(async (query) => {
        const users = new PostgresUserRepository(query);
        const user = await users.create({
          userId: input.userId,
          email: input.email,
          displayName: input.displayName
        });
        const result = await query.query<ProfileRow>(
          `INSERT INTO account_profiles(user_id,account_type)
           VALUES($1,$2)
           RETURNING account_type,created_at,updated_at`,
          [input.userId, input.accountType]
        );
        await query.query(
          `INSERT INTO password_credentials(user_id,password_hash)
           VALUES($1,$2)`,
          [input.userId, input.passwordHash]
        );
        const row = result.rows[0]!;
        return {
          user,
          profile: {
            userId: user.userId,
            accountType: row.account_type,
            createdAt: row.created_at.toISOString(),
            updatedAt: row.updated_at.toISOString()
          },
          passwordHash: input.passwordHash
        };
      });
    } catch (error) {
      duplicate(error);
    }
  }

  async findByNormalizedEmail(email: string): Promise<StoredAccountAccess | null> {
    try {
      const users = new PostgresUserRepository(this.database.getPool());
      const user = await users.findByNormalizedEmail(normalizeEmail(email));
      if (!user) return null;
      const result = await this.database.getPool().query<ProfileRow>(
        `SELECT p.account_type,p.created_at,p.updated_at,c.password_hash
         FROM account_profiles p
         JOIN password_credentials c ON c.user_id=p.user_id
         WHERE p.user_id=$1`,
        [user.userId]
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        user,
        profile: {
          userId: user.userId,
          accountType: row.account_type,
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString()
        },
        passwordHash: row.password_hash
      };
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof IdentityError) throw error;
      throw new AuthenticationError(
        'AUTHENTICATION_SERVICE_UNAVAILABLE',
        'Account access persistence is unavailable.',
        { cause: error }
      );
    }
  }
}

function summary(record: StoredAccountAccess): AccountSummary {
  return {
    userId: record.user.userId,
    email: record.user.email,
    displayName: record.user.displayName,
    accountType: record.profile.accountType
  };
}

export class AccountAccessService {
  constructor(
    private readonly store: AccountAccessStore,
    private readonly authentication: AuthenticationService
  ) {}

  async register(command: RegisterAccountCommand): Promise<AccountAccessResult> {
    if (!(SELF_SERVICE_ACCOUNT_TYPES as readonly string[]).includes(command.accountType))
      throw new AuthenticationError(
        'INVALID_ACCOUNT_TYPE',
        'This account type cannot be created through self-service registration.'
      );
    validatePassword(command.password);
    const passwordHash = await hashPassword(command.password);
    const record = await this.store.register({
      userId: uuidV7(),
      email: command.email,
      displayName: command.displayName,
      accountType: command.accountType,
      passwordHash
    });
    const issued = await this.authentication.issueSession(record.user.userId);
    return {
      account: summary(record),
      rawToken: issued.rawToken,
      session: {
        ...issued.session,
        status: 'ACTIVE',
        revokedAt: null
      }
    };
  }

  async login(command: LoginAccountCommand): Promise<AccountAccessResult> {
    const record = await this.store.findByNormalizedEmail(command.email);
    if (!record || !(await verifyPassword(command.password, record.passwordHash)))
      throw new AuthenticationError('INVALID_CREDENTIALS', 'Email or password is incorrect.');
    if (record.user.status !== 'ACTIVE')
      throw new AuthenticationError('USER_DISABLED', 'User is disabled.');
    const issued = await this.authentication.issueSession(record.user.userId);
    return {
      account: summary(record),
      rawToken: issued.rawToken,
      session: {
        ...issued.session,
        status: 'ACTIVE',
        revokedAt: null
      }
    };
  }
}
