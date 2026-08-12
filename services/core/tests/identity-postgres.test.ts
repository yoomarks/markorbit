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
        'DROP TABLE IF EXISTS knowledge_v2_deliveries,knowledge_intake_contents,knowledge_intakes,sessions,workspace_memberships,workspaces,users CASCADE; DROP SCHEMA IF EXISTS markorbit_persistence CASCADE'
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
      r.memberships.create({ membershipId: id(), workspaceId: w.workspaceId, userId: u.userId, role: 'ADMIN' }),
      r.memberships.create({ membershipId: id(), workspaceId: w.workspaceId, userId: u.userId, role: 'VIEWER' })
    ]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((x) => x.status === 'rejected')[0]).toMatchObject({
      reason: { code: 'DUPLICATE_MEMBERSHIP' }
    });
  });
  it('User expected-version race has one winner and one stale result', async () => {
    await harness().cleanup();
    const users = repositories(database.getPool()).users;
    const created = await users.create({ userId: id(), email: `${n}@example.com`, displayName: 'Before' });
    const results = await Promise.allSettled([
      users.update(created.userId, { displayName: 'One' }, created.version),
      users.update(created.userId, { displayName: 'Two' }, created.version)
    ]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((x) => x.status === 'rejected')[0]).toMatchObject({
      reason: { code: 'STALE_VERSION' }
    });
  });
  it('Workspace expected-version race has one winner and one stale result', async () => {
    await harness().cleanup();
    const workspaces = repositories(database.getPool()).workspaces;
    const created = await workspaces.create({ workspaceId: id(), name: 'Before', slug: `before-${n}` });
    const results = await Promise.allSettled([
      workspaces.update(created.workspaceId, { name: 'One' }, created.version),
      workspaces.update(created.workspaceId, { name: 'Two' }, created.version)
    ]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((x) => x.status === 'rejected')[0]).toMatchObject({
      reason: { code: 'STALE_VERSION' }
    });
  });
  it('Membership expected-version race has one winner and one stale result', async () => {
    await harness().cleanup();
    const r = repositories(database.getPool()),
      u = await r.users.create({ userId: id(), email: `${n}@example.com`, displayName: 'Race' }),
      w = await r.workspaces.create({ workspaceId: id(), name: 'Race', slug: `membership-race-${n}` }),
      m = await r.memberships.create({ membershipId: id(), workspaceId: w.workspaceId, userId: u.userId, role: 'VIEWER' });
    const results = await Promise.allSettled([
      r.memberships.updateRole(m.membershipId, 'EDITOR', m.version),
      r.memberships.updateRole(m.membershipId, 'ADMIN', m.version)
    ]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((x) => x.status === 'rejected')[0]).toMatchObject({
      reason: { code: 'STALE_VERSION' }
    });
  });
  it('rolls back bounded identity writes without partial state', async () => {
    await harness().cleanup();
    const r = repositories(database.getPool()),
      userId = id();
    await expect(
      database.withTransaction(async (q) => {
        const tx = repositories(q);
        await tx.users.create({ userId, email: `${n}@example.com`, displayName: 'Rollback' });
        throw new Error('rollback');
      })
    ).rejects.toThrow('rollback');
    expect(await r.users.findById(userId)).toBeNull();
  });
  it('maps database unavailability to a safe typed error', async () => {
    const q: QueryClient = {
      query: async () => {
        throw Object.assign(new Error('secret driver detail'), { code: 'ECONNREFUSED' });
      }
    };
    await expect(new PostgresUserRepository(q).findById(id())).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE'
    });
  });
  it('serializes Membership admission with archived and disabled source changes', async () => {
    await harness().cleanup();
    const r = repositories(database.getPool()),
      u = await r.users.create({ userId: id(), email: `${n}@example.com`, displayName: 'Admission' }),
      w = await r.workspaces.create({ workspaceId: id(), name: 'Admission', slug: `admission-${n}` });
    const outcomes = await Promise.allSettled([
      r.memberships.create({ membershipId: id(), workspaceId: w.workspaceId, userId: u.userId, role: 'VIEWER' }),
      r.workspaces.archive(w.workspaceId, w.version),
      r.users.disable(u.userId, u.version)
    ]);
    const membership = outcomes[0];
    if (membership.status === 'fulfilled') {
      expect(membership.value.workspaceId).toBe(w.workspaceId);
      expect(membership.value.userId).toBe(u.userId);
    } else {
      expect(membership.reason).toMatchObject({ code: expect.stringMatching(/WORKSPACE|USER/) });
    }
  });
});

describe('identity PostgreSQL required mode', () => {
  it('maps an unavailable PostgreSQL startup to failure', async () => {
    if (!required) return;
    const unavailable = new ManagedDatabase(
      parseDatabaseConfig({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://invalid:invalid@127.0.0.1:1/invalid',
        DB_MIGRATION_NAMESPACE: 'core_identity_unavailable',
        DB_APPLICATION_NAME: 'markorbit-task-018-unavailable-tests',
        DB_CONNECT_TIMEOUT_MS: '100'
      })
    );
    await expect(unavailable.start()).rejects.toBeDefined();
  });
});
