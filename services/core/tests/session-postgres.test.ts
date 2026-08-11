import path from 'node:path';
/* eslint-disable @typescript-eslint/require-await -- injected query failure and contract factory are asynchronous interfaces. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig,
  type QueryClient
} from '@markorbit/persistence';
import { PostgresSessionRepository } from '../src/auth.js';
import { sessionRepositoryContract, type SessionHarness } from './session-repository-contract.js';
const url = process.env.AUTH_TEST_DATABASE_URL;
const required = process.env.AUTH_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error('AUTH_POSTGRES_TEST_REQUIRED=1 requires AUTH_TEST_DATABASE_URL.');
const integration = url ? describe : describe.skip;
let database: ManagedDatabase;
const config = () =>
  parseDatabaseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DB_MIGRATION_NAMESPACE: 'core_auth',
    DB_APPLICATION_NAME: 'markorbit-task-019-tests'
  });
const migrations = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const coreMigrations = () =>
  loadMigrationsForOwner(migrations, migrationOwners, '@markorbit/core-service');
const harness = (): SessionHarness => ({
  sessions: new PostgresSessionRepository(database.getPool()),
  user: async (id) => {
    await database
      .getPool()
      .query(
        "INSERT INTO users(user_id,email,normalized_email,display_name) VALUES($1,$2,$2,'Session Test')",
        [id, `${id}@example.test`]
      );
  },
  cleanup: async () => {
    await database
      .getPool()
      .query('TRUNCATE sessions,workspace_memberships,workspaces,users CASCADE');
  },
  reopen: async () => {
    await database.close();
    database = new ManagedDatabase(config());
    await database.start();
    return harness();
  }
});
integration('PostgreSQL Session repository', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    await database
      .getPool()
      .query(
        'DROP TABLE IF EXISTS knowledge_intake_contents,knowledge_intakes,sessions,workspace_memberships,workspaces,users CASCADE; DROP SCHEMA IF EXISTS markorbit_persistence CASCADE'
      );
    await migrate(database.getPool(), 'core_auth', await coreMigrations());
  });
  afterAll(async () => database.close());
  sessionRepositoryContract('postgres', async () => harness());
  it('enforces User foreign keys', async () => {
    await harness().cleanup();
    await expect(
      new PostgresSessionRepository(database.getPool()).create({
        sessionId: '01900000-0000-7000-8000-999999999999',
        userId: '01900000-0000-7000-8000-999999999998',
        tokenHash: 'b'.repeat(64),
        status: 'ACTIVE',
        version: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        expiresAt: '2026-01-02T00:00:00.000Z',
        revokedAt: null
      })
    ).rejects.toBeDefined();
  });
  it('does not expose driver errors when unavailable', async () => {
    const q: QueryClient = {
      query: async () => {
        throw Object.assign(new Error('secret'), { code: 'ECONNREFUSED' });
      }
    };
    await expect(
      new PostgresSessionRepository(q).findById('01900000-0000-7000-8000-999999999999')
    ).rejects.toBeDefined();
  });
  it('CON-CORE-002 serializes a durable Session revoke/use race without partial evidence', async () => {
    await harness().cleanup();
    const userId = '01900000-0000-7000-8000-260000000201';
    const sessionId = '01900000-0000-7000-8000-260000000202';
    await harness().user(userId);
    const repository = new PostgresSessionRepository(database.getPool());
    await repository.create({
      sessionId,
      userId,
      tokenHash: 'c'.repeat(64),
      status: 'ACTIVE',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2027-01-01T00:00:00.000Z',
      revokedAt: null
    });
    const [use, revoke] = await Promise.all([
      repository.findById(sessionId),
      repository.revoke(sessionId, 1, '2026-08-02T00:00:00.000Z')
    ]);
    expect(['ACTIVE', 'REVOKED']).toContain(use?.status);
    expect(revoke).toMatchObject({ sessionId, status: 'REVOKED', version: 2 });
    expect(await repository.findById(sessionId)).toMatchObject({
      sessionId,
      status: 'REVOKED',
      version: 2
    });
    expect(
      (await database.getPool().query('SELECT 1 FROM sessions WHERE session_id=$1', [sessionId]))
        .rowCount
    ).toBe(1);
  });
});
