/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment */
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  migrationStatus,
  parseDatabaseConfig,
  verifyMigrations,
  type QueryClient
} from '@markorbit/persistence';
import {
  PostgresMembershipRepository,
  PostgresUserRepository,
  PostgresWorkspaceRepository
} from '../src/identity.js';
import {
  membershipRepositoryContract,
  userRepositoryContract,
  workspaceRepositoryContract,
  type IdentityRepositoryHarness
} from './identity-repository-contracts.js';

const url = process.env.IDENTITY_TEST_DATABASE_URL;
const required = process.env.IDENTITY_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error('IDENTITY_POSTGRES_TEST_REQUIRED=1 requires IDENTITY_TEST_DATABASE_URL.');
const integration = url ? describe : describe.skip;
const config = () =>
  parseDatabaseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DB_MIGRATION_NAMESPACE: 'core_identity',
    DB_APPLICATION_NAME: 'markorbit-task-018-tests'
  });
let database: ManagedDatabase;
const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const coreMigrations = () =>
  loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/core-service');
const repositories = (q: QueryClient) => ({
  users: new PostgresUserRepository(q),
  workspaces: new PostgresWorkspaceRepository(q),
  memberships: new PostgresMembershipRepository(q)
});
async function reopen() {
  await database.close();
  database = new ManagedDatabase(config());
  await database.start();
  return harness();
}
function harness(): IdentityRepositoryHarness {
  return {
    ...repositories(database.getPool()),
    reopen,
    cleanup: async () => {
      await database.getPool().query('TRUNCATE workspace_memberships,workspaces,users CASCADE');
    },
    close: () => Promise.resolve()
  };
}
let n = 100000;
const id = () => `01800000-0000-7000-8000-${String(n++).padStart(12, '0')}`;

integration('PostgreSQL 16 identity verification', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    await database
      .getPool()
      .query(
        'DROP TABLE IF EXISTS knowledge_v2_deliveries,knowledge_intake_contents,knowledge_intakes,password_credentials,account_profiles,sessions,workspace_memberships,workspaces,users CASCADE; DROP SCHEMA IF EXISTS markorbit_persistence CASCADE'
      );
    await migrate(database.getPool(), 'core_identity', await coreMigrations());
  });
  afterAll(async () => database.close());
  userRepositoryContract('PostgreSQL', async () => harness());
  workspaceRepositoryContract('PostgreSQL', async () => harness());
  membershipRepositoryContract('PostgreSQL', async () => harness());
  it('reports applied status, verifies checksum, and repeats idempotently', async () => {
    const migrations = await coreMigrations();
    await migrate(database.getPool(), 'core_identity', migrations);
    expect(
      (await migrationStatus(database.getPool(), 'core_identity', migrations)).every(
        (x) => x.state === 'applied'
      )
    ).toBe(true);
    await verifyMigrations(database.getPool(), 'core_identity', migrations);
  });
  it('allows exactly one concurrent normalized-email duplicate', async () => {
    await harness().cleanup();
    const users = new PostgresUserRepository(database.getPool()),
      email = 'Race@Example.com';
    const results = await Promise.allSettled([
      users.create({ userId: id(), email, displayName: 'One' }),
      users.create({ userId: id(), email: email.toUpperCase(), displayName: 'Two' })
    ]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((x) => x.status === 'rejected')[0]).toMatchObject({
      reason: { code: 'DUPLICATE_NORMALIZED_EMAIL' }
    });
  });
  it('allows exactly one concurrent Membership duplicate', async () => {
    await harness().cleanup();
    const r = repositories(database.getPool()),
      u = await r.users.create({ userId: id(), email: `${n}@example.com`, displayName: 'Race' }),
      w = await r.workspaces.create({ workspaceId: id(), name: 'Race', slug: `race-${n}` });
    const results = await Promise.allSettled([
      r.memberships.create({
        membershipId: id(),
        workspaceId: w.workspaceId,
        userId: u.userId,
        role: 'REVIEWER'
      }),
      r.memberships.create({
        membershipId: id(),
        workspaceId: w.workspaceId,
        userId: u.userId,
        role: 'READ_ONLY'
      })
    ]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((x) => x.status === 'rejected')[0]).toMatchObject({
      reason: { code: 'DUPLICATE_MEMBERSHIP' }
    });
  });
  for (const aggregate of ['User', 'Workspace', 'Membership'] as const)
    it(`${aggregate} expected-version race has one winner and one stale result`, async () => {
      await harness().cleanup();
      const r = repositories(database.getPool()),
        u = await r.users.create({ userId: id(), email: `${n}@example.com`, displayName: 'Race' }),
        w = await r.workspaces.create({ workspaceId: id(), name: 'Race', slug: `race-${n}` });
      let operations: Promise<unknown>[];
      if (aggregate === 'User')
        operations = [
          r.users.update(u.userId, 1, { email: u.email, displayName: 'a' }),
          r.users.update(u.userId, 1, { email: u.email, displayName: 'b' })
        ];
      else if (aggregate === 'Workspace')
        operations = [
          r.workspaces.update(w.workspaceId, 1, { name: 'a', slug: w.slug }),
          r.workspaces.update(w.workspaceId, 1, { name: 'b', slug: w.slug })
        ];
      else {
        await r.memberships.create({
          membershipId: id(),
          workspaceId: w.workspaceId,
          userId: u.userId,
          role: 'REVIEWER'
        });
        operations = [
          r.memberships.changeRole(w.workspaceId, u.userId, 1, 'READ_ONLY'),
          r.memberships.changeRole(w.workspaceId, u.userId, 1, 'MATTER_MANAGER')
        ];
      }
      const results = await Promise.allSettled(operations);
      expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((x) => x.status === 'rejected')[0]).toMatchObject({
        reason: { code: 'STALE_VERSION' }
      });
    });
  it('rolls back bounded identity writes without partial state', async () => {
    await harness().cleanup();
    const userId = id();
    await expect(
      database.transact(async (q) => {
        const r = repositories(q);
        await r.users.create({ userId, email: `${n}@example.com`, displayName: 'Rollback' });
        await r.workspaces.create({ workspaceId: id(), name: 'Rollback', slug: `rollback-${n}` });
        throw new Error('rollback sentinel');
      })
    ).rejects.toThrow('rollback sentinel');
    expect(await new PostgresUserRepository(database.getPool()).findById(userId)).toBeNull();
    expect(
      (await database.getPool().query("SELECT 1 FROM workspaces WHERE name='Rollback'")).rowCount
    ).toBe(0);
  });
  it('maps database unavailability to a safe typed error', async () => {
    const unavailable: QueryClient = {
      query: async () => {
        throw Object.assign(new Error('connection included secret'), { code: 'ECONNREFUSED' });
      }
    };
    await expect(
      new PostgresUserRepository(unavailable).create({
        userId: id(),
        email: 'safe@example.com',
        displayName: 'Safe'
      })
    ).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
      message: 'Identity persistence is unavailable.'
    });
  });
  it('serializes Membership admission with archived and disabled source changes', async () => {
    await harness().cleanup();
    const r = repositories(database.getPool()),
      u = await r.users.create({
        userId: id(),
        email: `${n}@example.com`,
        displayName: 'Admission'
      }),
      w = await r.workspaces.create({
        workspaceId: id(),
        name: 'Admission',
        slug: `admission-${n}`
      });
    const [admission] = await Promise.allSettled([
      r.memberships.create({
        membershipId: id(),
        workspaceId: w.workspaceId,
        userId: u.userId,
        role: 'REVIEWER'
      }),
      r.workspaces.archive(w.workspaceId, 1),
      r.users.disable(u.userId, 1)
    ]);
    if (admission.status === 'rejected')
      expect(admission.reason).toMatchObject({
        code: expect.stringMatching(/USER_DISABLED|WORKSPACE_ARCHIVED/)
      });
    else expect(await r.memberships.findByWorkspaceAndUser(w.workspaceId, u.userId)).not.toBeNull();
  });
});

describe('identity PostgreSQL required mode', () => {
  it('maps an unavailable PostgreSQL startup to failure', async () => {
    const db = new ManagedDatabase(
      parseDatabaseConfig({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/unavailable',
        DB_MIGRATION_NAMESPACE: 'identity_unavailable',
        DB_CONNECTION_TIMEOUT_MS: '100'
      })
    );
    await expect(db.start()).rejects.toMatchObject({
      code: expect.stringMatching(/DATABASE_UNAVAILABLE|DATABASE_TIMEOUT/)
    });
    await db.close();
  });
});
