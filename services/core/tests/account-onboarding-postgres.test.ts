import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import {
  AccountOnboardingService,
  PostgresAccountOnboardingRepository
} from '../src/account-onboarding.js';
import { PostgresUserRepository } from '../src/identity.js';

const url = process.env.AUTH_TEST_DATABASE_URL;
const required = process.env.AUTH_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error('AUTH_POSTGRES_TEST_REQUIRED=1 requires AUTH_TEST_DATABASE_URL.');
const integration = url ? describe : describe.skip;
let database: ManagedDatabase;
const migrations = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const config = () =>
  parseDatabaseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DB_MIGRATION_NAMESPACE: 'core_auth',
    DB_APPLICATION_NAME: 'markorbit-m8-account-onboarding-tests'
  });
const coreMigrations = () =>
  loadMigrationsForOwner(migrations, migrationOwners, '@markorbit/core-service');
const service = () =>
  new AccountOnboardingService(new PostgresAccountOnboardingRepository(database));

async function cleanup() {
  await database
    .getPool()
    .query(
      'TRUNCATE sessions,password_credentials,account_profiles,workspace_memberships,workspaces,users CASCADE'
    );
}

async function createUser(userId: string, email: string) {
  return new PostgresUserRepository(database.getPool()).create({
    userId,
    email,
    displayName: 'Workspace Owner'
  });
}

integration('PostgreSQL account workspace onboarding', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    await database
      .getPool()
      .query(
        'DROP TABLE IF EXISTS knowledge_v2_deliveries,knowledge_intake_contents,knowledge_intakes,password_credentials,account_profiles,sessions,workspace_memberships,workspaces,users CASCADE; DROP SCHEMA IF EXISTS markorbit_persistence CASCADE'
      );
    await migrate(database.getPool(), 'core_auth', await coreMigrations());
  });

  afterAll(async () => database.close());

  it('persists the Workspace and owner membership across a reconnect', async () => {
    await cleanup();
    const user = await createUser(
      '018f0000-0000-7000-8000-000000000201',
      'persisted-workspace@example.com'
    );
    const created = await service().createWorkspace(user.userId, { name: 'Persisted Team' });
    await database.close();
    database = new ManagedDatabase(config());
    await database.start();
    await expect(service().listWorkspaces(user.userId)).resolves.toEqual([created]);
  });

  it('leaves no partial Workspace or membership after a duplicate explicit slug', async () => {
    await cleanup();
    const user = await createUser(
      '018f0000-0000-7000-8000-000000000202',
      'rollback-workspace@example.com'
    );
    const first = await service().createWorkspace(user.userId, {
      name: 'Existing Team',
      slug: 'existing-team'
    });
    await expect(
      service().createWorkspace(user.userId, {
        name: 'Another Team',
        slug: 'existing team'
      })
    ).rejects.toMatchObject({ code: 'DUPLICATE_WORKSPACE_SLUG' });
    const counts = await database.getPool().query<{ workspaces: number; memberships: number }>(
      `SELECT
        (SELECT count(*)::int FROM workspaces) AS workspaces,
        (SELECT count(*)::int FROM workspace_memberships) AS memberships`
    );
    expect(counts.rows[0]).toEqual({ workspaces: 1, memberships: 1 });
    expect(first.membership.role).toBe('WORKSPACE_ADMIN');
  });
});
