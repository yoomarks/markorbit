import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import { AccountAccessService, PostgresAccountAccessStore } from '../src/account-access.js';
import { AuthenticationService, PostgresSessionRepository } from '../src/auth.js';
import {
  PostgresMembershipRepository,
  PostgresUserRepository,
  PostgresWorkspaceRepository
} from '../src/identity.js';

const url = process.env.AUTH_TEST_DATABASE_URL;
const required = process.env.AUTH_POSTGRES_TEST_REQUIRED === '1';
if (required && !url) {
  throw new Error('AUTH_POSTGRES_TEST_REQUIRED=1 requires AUTH_TEST_DATABASE_URL.');
}

const integration = url ? describe : describe.skip;
let database: ManagedDatabase;
const migrations = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');

const config = () =>
  parseDatabaseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DB_MIGRATION_NAMESPACE: 'core_auth',
    DB_APPLICATION_NAME: 'markorbit-m8-account-access-tests'
  });

const coreMigrations = () =>
  loadMigrationsForOwner(migrations, migrationOwners, '@markorbit/core-service');

function service() {
  const query = database.getPool();
  const users = new PostgresUserRepository(query);
  const workspaces = new PostgresWorkspaceRepository(query);
  const authentication = new AuthenticationService({
    sessions: new PostgresSessionRepository(query),
    users,
    workspaces,
    memberships: new PostgresMembershipRepository(query)
  });
  return new AccountAccessService(new PostgresAccountAccessStore(database), authentication);
}

async function cleanup() {
  const sql =
    'TRUNCATE sessions,password_credentials,account_profiles,workspace_memberships,workspaces,users CASCADE';
  await database.getPool().query(sql);
}

async function rowCount(table: 'users' | 'account_profiles' | 'password_credentials') {
  const result = await database.getPool().query<{ count: number }>(
    `SELECT count(*)::int AS count FROM ${table}`
  );
  return result.rows[0]!.count;
}

integration('PostgreSQL real account access', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    const reset =
      'DROP TABLE IF EXISTS knowledge_v2_deliveries,knowledge_intake_contents,knowledge_intakes,password_credentials,account_profiles,sessions,workspace_memberships,workspaces,users CASCADE; DROP SCHEMA IF EXISTS markorbit_persistence CASCADE';
    await database.getPool().query(reset);
    await migrate(database.getPool(), 'core_auth', await coreMigrations());
  });

  afterAll(async () => database.close());

  it('persists account type and a one-way password credential', async () => {
    await cleanup();
    const password = 'durable account password';
    const registered = await service().register({
      email: 'Durable@Example.com',
      displayName: 'Durable User',
      password,
      accountType: 'PROFESSIONAL'
    });
    const result = await database.getPool().query<{
      normalized_email: string;
      account_type: string;
      password_hash: string;
    }>(
      `SELECT u.normalized_email,p.account_type,c.password_hash
       FROM users u
       JOIN account_profiles p ON p.user_id=u.user_id
       JOIN password_credentials c ON c.user_id=u.user_id
       WHERE u.user_id=$1`,
      [registered.account.userId]
    );
    const row = result.rows[0]!;
    expect(row.normalized_email).toBe('durable@example.com');
    expect(row.account_type).toBe('PROFESSIONAL');
    expect(row.password_hash).toMatch(/^scrypt\$/);
    expect(row.password_hash).not.toContain(password);
  });

  it('logs in after a database reconnect with a fresh Session', async () => {
    await cleanup();
    const registered = await service().register({
      email: 'restart@example.com',
      displayName: 'Restart User',
      password: 'restart durable password',
      accountType: 'CUSTOMER'
    });
    await database.close();
    database = new ManagedDatabase(config());
    await database.start();
    const loggedIn = await service().login({
      email: 'RESTART@example.com',
      password: 'restart durable password'
    });
    expect(loggedIn.account).toEqual(registered.account);
    expect(loggedIn.rawToken).not.toBe(registered.rawToken);
    const sessions = await database.getPool().query<{ count: number }>(
      'SELECT count(*)::int AS count FROM sessions WHERE user_id=$1',
      [registered.account.userId]
    );
    expect(sessions.rows[0]!.count).toBe(2);
  });

  it('rolls back a duplicate normalized-email registration', async () => {
    await cleanup();
    const access = service();
    await access.register({
      email: 'duplicate@example.com',
      displayName: 'First',
      password: 'first duplicate password',
      accountType: 'CUSTOMER'
    });
    await expect(
      access.register({
        email: 'DUPLICATE@example.com',
        displayName: 'Second',
        password: 'second duplicate password',
        accountType: 'PROFESSIONAL'
      })
    ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_REGISTERED' });
    expect(await rowCount('users')).toBe(1);
    expect(await rowCount('account_profiles')).toBe(1);
    expect(await rowCount('password_credentials')).toBe(1);
  });
});
