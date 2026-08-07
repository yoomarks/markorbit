import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ManagedDatabase,
  loadMigrationsForOwner,
  migrate,
  parseDatabaseConfig,
  verifyMigrations
} from '../packages/persistence/dist/index.js';
import {
  AuthenticationService,
  PostgresMembershipRepository,
  PostgresSessionRepository,
  PostgresUserRepository,
  PostgresWorkspaceRepository,
  createRuntime as createCore
} from '../services/core/dist/index.js';
import {
  PostgresFormalMatterRepository,
  createRuntime as createMarkReg
} from '../services/markreg/dist/index.js';
import {
  PostgresProfessionalReviewRepository,
  createRuntime as createExecution
} from '../services/execution/dist/index.js';

const urls = {
  Core: process.env.MILESTONE2_CORE_DATABASE_URL,
  MarkReg: process.env.MILESTONE2_MARKREG_DATABASE_URL,
  Execution: process.env.MILESTONE2_EXECUTION_DATABASE_URL
} as const;
const required = process.env.MILESTONE2_OUTAGE_REQUIRED === '1';
if (required)
  for (const [owner, url] of Object.entries(urls))
    if (!url) throw new Error(`MILESTONE2_${owner.toUpperCase()}_DATABASE_URL is required.`);
const suite = Object.values(urls).every(Boolean) ? describe : describe.skip;
const owners = {
  Core: '@markorbit/core-service',
  MarkReg: '@markorbit/markreg-service',
  Execution: '@markorbit/execution-service'
} as const;
const secret = 'task-026-startup-restoration-secret';
const bad = (owner: string) =>
  new ManagedDatabase(
    parseDatabaseConfig({
      NODE_ENV: 'test',
      DATABASE_URL: `postgresql://task026:secret@127.0.0.1:1/${owner.toLowerCase()}_unavailable`,
      DB_MIGRATION_NAMESPACE: `${owner.toLowerCase()}_outage`,
      DB_CONNECTION_TIMEOUT_MS: '100',
      DB_APPLICATION_NAME: `task-026-${owner.toLowerCase()}-outage`
    })
  );
const restored = async (owner: keyof typeof urls) => {
  const database = new ManagedDatabase(
    parseDatabaseConfig({
      NODE_ENV: 'test',
      DATABASE_URL: urls[owner],
      DB_MIGRATION_NAMESPACE: `${owner.toLowerCase()}_startup_restored`,
      DB_APPLICATION_NAME: `task-026-${owner.toLowerCase()}-restored`
    })
  );
  await database.start();
  const migrations = await loadMigrationsForOwner(
    path.resolve('infrastructure/persistence/migrations'),
    path.resolve('infrastructure/persistence/migration-owners.json'),
    owners[owner]
  );
  const tables = [
    ...new Set(
      migrations.flatMap((migration) =>
        [...migration.sql.matchAll(/\bCREATE TABLE\s+([a-z][a-z0-9_]*)\s*\(/gi)].map(
          (match) => match[1]!
        )
      )
    )
  ];
  const functions = [
    ...new Set(
      migrations.flatMap((migration) =>
        [...migration.sql.matchAll(/\bCREATE FUNCTION\s+([a-z][a-z0-9_]*)\s*\(/gi)].map(
          (match) => match[1]!
        )
      )
    )
  ];
  if (tables.length)
    await database
      .getPool()
      .query(`DROP TABLE IF EXISTS ${tables.map((table) => `"${table}"`).join(',')} CASCADE`);
  for (const functionName of functions)
    await database.getPool().query(`DROP FUNCTION IF EXISTS "${functionName}"() CASCADE`);
  await database.getPool().query('DROP SCHEMA IF EXISTS markorbit_persistence CASCADE');
  await migrate(database.getPool(), `${owner.toLowerCase()}_startup_restored`, migrations);
  await verifyMigrations(database.getPool(), `${owner.toLowerCase()}_startup_restored`, migrations);
  return database;
};
const failure = async (owner: string) => {
  const database = bad(owner);
  let first: unknown;
  try {
    await database.start();
  } catch (error) {
    first = error;
  }
  expect(first).toMatchObject({
    code: expect.stringMatching(/DATABASE_UNAVAILABLE|DATABASE_TIMEOUT/)
  });
  expect(JSON.stringify(first)).not.toMatch(/secret|task026|127\.0\.0\.1/iu);
  await database.close();
  await database.close();
};

suite.sequential('TASK 026 owner startup outage and actual listener restoration', () => {
  it('OUT-CORE-STARTUP preserves the causal failure then restores Core listener, health and durable identity readiness', async () => {
    await failure('Core');
    const database = await restored('Core');
    const users = new PostgresUserRepository(database.getPool()),
      workspaces = new PostgresWorkspaceRepository(database.getPool()),
      memberships = new PostgresMembershipRepository(database.getPool()),
      sessions = new PostgresSessionRepository(database.getPool());
    const userId = '01900000-0000-7000-8000-260000009001',
      workspaceId = '01900000-0000-7000-8000-260000009002';
    if (!(await users.findById(userId)))
      await users.create({
        userId,
        email: 'startup-core@tenant.test',
        displayName: 'Startup Core'
      });
    if (!(await workspaces.findById(workspaceId)))
      await workspaces.create({ workspaceId, name: 'Startup Core', slug: 'startup-core' });
    if (!(await memberships.findByWorkspaceAndUser(workspaceId, userId)))
      await memberships.create({
        membershipId: '01900000-0000-7000-8000-260000009003',
        userId,
        workspaceId,
        role: 'WORKSPACE_ADMIN'
      });
    const auth = new AuthenticationService({ users, workspaces, memberships, sessions });
    const runtime = createCore({ port: 0, authentication: auth, internalServiceSecret: secret });
    try {
      await runtime.start();
      expect((await fetch(`http://127.0.0.1:${runtime.listeningPort}/health`)).status).toBe(200);
      const issued = await auth.issueSession(userId);
      expect(await auth.resolveWorkspacePrincipal(issued.rawToken, workspaceId)).toMatchObject({
        userId,
        workspaceId,
        role: 'WORKSPACE_ADMIN'
      });
      const port = runtime.listeningPort;
      await runtime.stop();
      const replacement = createCore({ port, authentication: auth, internalServiceSecret: secret });
      await replacement.start();
      expect((await fetch(`http://127.0.0.1:${port}/health`)).status).toBe(200);
      await replacement.stop();
    } finally {
      await runtime.stop().catch(() => undefined);
      await database.close();
      await database.close();
    }
  });
  it('OUT-MARKREG-STARTUP preserves the causal failure then restores the durable MarkReg listener and reusable port', async () => {
    await failure('MarkReg');
    const database = await restored('MarkReg');
    const runtime = createMarkReg({
      port: 0,
      formalMatterRepository: new PostgresFormalMatterRepository(database, database.getPool()),
      internalServiceSecret: secret
    });
    try {
      await runtime.start();
      expect((await fetch(`http://127.0.0.1:${runtime.listeningPort}/health`)).status).toBe(200);
      expect(
        (await database.getPool().query('SELECT count(*)::int AS count FROM formal_matters'))
          .rows[0].count
      ).toBeGreaterThanOrEqual(0);
      const port = runtime.listeningPort;
      await runtime.stop();
      const replacement = createMarkReg({
        port,
        formalMatterRepository: new PostgresFormalMatterRepository(database, database.getPool()),
        internalServiceSecret: secret
      });
      await replacement.start();
      expect((await fetch(`http://127.0.0.1:${port}/health`)).status).toBe(200);
      await replacement.stop();
    } finally {
      await runtime.stop().catch(() => undefined);
      await database.close();
    }
  });
  it('OUT-EXECUTION-STARTUP preserves the causal failure then restores the durable Execution listener and reusable port', async () => {
    await failure('Execution');
    const database = await restored('Execution');
    const factory = (workspace: string) =>
      new PostgresProfessionalReviewRepository(database, database.getPool(), workspace);
    const runtime = createExecution({
      port: 0,
      reviewRepositoryFactory: factory,
      internalServiceSecret: secret
    });
    try {
      await runtime.start();
      expect((await fetch(`http://127.0.0.1:${runtime.listeningPort}/health`)).status).toBe(200);
      expect(
        (
          await database
            .getPool()
            .query('SELECT count(*)::int AS count FROM professional_review_cases')
        ).rows[0].count
      ).toBeGreaterThanOrEqual(0);
      const port = runtime.listeningPort;
      await runtime.stop();
      const replacement = createExecution({
        port,
        reviewRepositoryFactory: factory,
        internalServiceSecret: secret
      });
      await replacement.start();
      expect((await fetch(`http://127.0.0.1:${port}/health`)).status).toBe(200);
      await replacement.stop();
    } finally {
      await runtime.stop().catch(() => undefined);
      await database.close();
    }
  });
});
