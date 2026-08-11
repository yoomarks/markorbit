import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ManagedDatabase,
  loadMigrationsForOwner,
  migrate,
  parseDatabaseConfig
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
  HttpCoreAuthenticationClient,
  createRuntime as createGateway
} from '../apps/gateway/dist/index.js';

const url = process.env.CORE_TEST_DATABASE_URL ?? process.env.AUTH_TEST_DATABASE_URL;
const required = process.env.MILESTONE2_RESTART_REQUIRED === '1';
if (required && !url) throw new Error('CORE_TEST_DATABASE_URL is required for RST-001.');
const suite = url ? describe : describe.skip;
const secret = 'task-026-core-restart-secret-32-bytes';
const origin = 'https://test.markorbit.local';
const csrfSecret = 'task-026-core-restart-csrf-32-bytes';
const ids = {
  user: '01900000-0000-7000-8000-260000000101',
  workspace: '01900000-0000-7000-8000-260000000102',
  membership: '01900000-0000-7000-8000-260000000103'
};

suite.sequential('TASK 026 actual Core listener restart', () => {
  let database: ManagedDatabase,
    core: ReturnType<typeof createCore> | undefined,
    replacement: ReturnType<typeof createCore> | undefined,
    gateway: ReturnType<typeof createGateway> | undefined,
    corePort: number,
    durableCookie = '',
    durableCsrf = '';
  const open = async () => {
    const db = new ManagedDatabase(
      parseDatabaseConfig({
        NODE_ENV: 'test',
        DATABASE_URL: url,
        DB_MIGRATION_NAMESPACE: 'core',
        DB_APPLICATION_NAME: 'task-026-core-restart'
      })
    );
    await db.start();
    return db;
  };
  const authentication = (
    db: ManagedDatabase,
    options: Partial<ConstructorParameters<typeof AuthenticationService>[0]> = {}
  ) =>
    new AuthenticationService({
      sessions: new PostgresSessionRepository(db.getPool()),
      users: new PostgresUserRepository(db.getPool()),
      workspaces: new PostgresWorkspaceRepository(db.getPool()),
      memberships: new PostgresMembershipRepository(db.getPool()),
      ...options
    });
  beforeAll(async () => {
    database = await open();
    await database
      .getPool()
      .query(
        'DROP TABLE IF EXISTS knowledge_intake_contents,knowledge_intakes,sessions,workspace_memberships,workspaces,users CASCADE; DROP SCHEMA IF EXISTS markorbit_persistence CASCADE'
      );
    const migrations = await loadMigrationsForOwner(
      path.resolve('infrastructure/persistence/migrations'),
      path.resolve('infrastructure/persistence/migration-owners.json'),
      '@markorbit/core-service'
    );
    await migrate(database.getPool(), 'core', migrations);
    const users = new PostgresUserRepository(database.getPool()),
      workspaces = new PostgresWorkspaceRepository(database.getPool()),
      memberships = new PostgresMembershipRepository(database.getPool());
    await users.create({
      userId: ids.user,
      email: 'restart@example.test',
      displayName: 'Restart User'
    });
    await workspaces.create({
      workspaceId: ids.workspace,
      name: 'Restart Workspace',
      slug: 'restart-workspace'
    });
    await memberships.create({
      userId: ids.user,
      workspaceId: ids.workspace,
      membershipId: ids.membership,
      role: 'WORKSPACE_ADMIN'
    });
    core = createCore({
      port: 0,
      authentication: authentication(database),
      internalServiceSecret: secret
    });
    await core.start();
    corePort = core.listeningPort;
    gateway = createGateway({
      port: 0,
      milestoneTestRuntime: true,
      authenticationClient: new HttpCoreAuthenticationClient(
        `http://127.0.0.1:${corePort}`,
        secret
      ),
      csrfSecret,
      allowedOrigins: [origin],
      fixtureUsers: { primary: ids.user }
    });
    await gateway.start();
  });
  afterAll(async () => {
    await gateway?.stop();
    await replacement?.stop();
    await core?.stop();
    await database?.close();
  });
  it('RST-001 preserves exact Principal and durable Session evidence across actual listener replacement', async () => {
    const base = `http://127.0.0.1:${gateway!.listeningPort}`;
    const created = await fetch(`${base}/__test/auth/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fixture: 'primary' })
    });
    expect(created.status).toBe(201);
    const cookie = created.headers.get('set-cookie')!;
    durableCookie = cookie;
    const sessionResponse = await fetch(`${base}/api/auth/session`, { headers: { cookie } });
    durableCsrf = ((await sessionResponse.json()) as { csrfToken: string }).csrfToken;
    const issued = (await created.json()) as { sessionId: string };
    const before = await (
      await fetch(`${base}/api/workspaces/${ids.workspace}/context`, { headers: { cookie } })
    ).json();
    const sessionBefore = (
      await database
        .getPool()
        .query(
          'SELECT session_id,status,version,expires_at,revoked_at FROM sessions WHERE session_id=$1',
          [issued.sessionId]
        )
    ).rows[0];
    await core!.stop();
    core = undefined;
    await database.close();
    expect(
      (await fetch(`${base}/api/workspaces/${ids.workspace}/context`, { headers: { cookie } }))
        .status
    ).toBe(503);
    database = await open();
    replacement = createCore({
      port: corePort,
      authentication: authentication(database),
      internalServiceSecret: secret
    });
    await replacement.start();
    const response = await fetch(`${base}/api/workspaces/${ids.workspace}/context`, {
      headers: { cookie }
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(before);
    const sessionAfter = (
      await database
        .getPool()
        .query(
          'SELECT session_id,status,version,expires_at,revoked_at FROM sessions WHERE session_id=$1',
          [issued.sessionId]
        )
    ).rows[0];
    expect(sessionAfter).toEqual(sessionBefore);
  });
  it('RST-001 keeps revoked and expired opaque Sessions invalid after replacement', async () => {
    const revokedAuth = authentication(database, { tokenGenerator: () => 'r'.repeat(43) });
    const revoked = await revokedAuth.issueSession(ids.user);
    await revokedAuth.revokeSession(revoked.session.sessionId, 1);
    const expiredAuth = authentication(database, {
      clock: () => new Date('2020-01-01T00:00:00.000Z'),
      tokenGenerator: () => 'e'.repeat(43)
    });
    const expired = await expiredAuth.issueSession(ids.user, 300);
    const coreBase = `http://127.0.0.1:${corePort}`;
    const resolve = (token: string) =>
      fetch(`${coreBase}/internal/auth/sessions/resolve`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': secret
        },
        body: JSON.stringify({ token })
      });
    expect((await resolve(revoked.rawToken)).status).toBe(401);
    expect((await resolve(expired.rawToken)).status).toBe(401);
  });
  it('OUT-004/007 returns safe 503 for a Core database outage and recovers', async () => {
    const base = `http://127.0.0.1:${gateway!.listeningPort}`;
    await database.close();
    const read = await fetch(`${base}/api/workspaces/${ids.workspace}/context`, {
      headers: { cookie: durableCookie }
    });
    expect(read.status).toBe(503);
    expect(JSON.stringify(await read.json())).not.toMatch(
      /postgres|127\.0\.0\.1|password|SELECT|ECONN/iu
    );
    const mutation = await fetch(`${base}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: durableCookie,
        origin,
        'x-markorbit-csrf-token': durableCsrf
      },
      body: '{}'
    });
    expect(mutation.status).toBe(503);
    await replacement!.stop();
    replacement = undefined;
    database = await open();
    replacement = createCore({
      port: corePort,
      authentication: authentication(database),
      internalServiceSecret: secret
    });
    await replacement.start();
    const recovered = await fetch(`${base}/api/workspaces/${ids.workspace}/context`, {
      headers: { cookie: durableCookie }
    });
    expect(recovered.status).toBe(200);
    expect(await recovered.json()).toMatchObject({
      workspaceId: ids.workspace,
      membershipId: ids.membership,
      role: 'WORKSPACE_ADMIN'
    });
  });
});
