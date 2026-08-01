import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ManagedDatabase } from '../packages/persistence/dist/index.js';
import {
  AuthenticationService,
  InMemoryMembershipRepository,
  InMemorySessionRepository,
  InMemoryUserRepository,
  InMemoryWorkspaceRepository,
  createRuntime as createCore
} from '../services/core/dist/index.js';
import {
  PostgresMarkRegAuditRepository,
  createRuntime as createMarkReg
} from '../services/markreg/dist/index.js';
import {
  HttpCoreAuthenticationClient,
  createRuntime as createGateway
} from '../apps/gateway/dist/index.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from '../services/markreg/tests/support/markreg-test-database.js';

const url = process.env.MARKREG_TEST_DATABASE_URL;
const required = process.env.MARKREG_AUDIT_HTTP_REQUIRED === '1';
if (required && !url) throw new Error('MARKREG_TEST_DATABASE_URL is required in audit HTTP mode.');
const suite = url ? describe : describe.skip;
const secret = 'task-025a-audit-http-internal-secret-32-bytes';
const workspaceId = '25252525-2525-4252-8252-252525252525';
const otherWorkspaceId = '26262626-2626-4262-8262-262626262626';

suite('TASK 025A authenticated MarkReg audit HTTP boundary', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'task025a-audit-http',
    poolMaximum: 5,
    connectionTimeoutMs: 1000,
    idleTimeoutMs: 1000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: MARKREG_TEST_MIGRATION_NAMESPACE
  });
  const users = new InMemoryUserRepository();
  const workspaces = new InMemoryWorkspaceRepository();
  const memberships = new InMemoryMembershipRepository(users, workspaces);
  const sessions = new InMemorySessionRepository();
  let clock = new Date('2026-08-01T12:00:00.000Z');
  const authentication = new AuthenticationService({
    users,
    workspaces,
    memberships,
    sessions,
    clock: () => clock
  });
  const core = createCore({ port: 0, authentication, internalServiceSecret: secret });
  let markreg = createMarkReg({ port: 0, internalServiceSecret: secret });
  let gateway: ReturnType<typeof createGateway>;
  const tokens: Record<string, string> = {};
  const userIds = {
    admin: '11111111-1111-4111-8111-111111111111',
    manager: '22222222-2222-4222-8222-222222222222',
    reviewer: '33333333-3333-4333-8333-333333333333',
    reader: '44444444-4444-4444-8444-444444444444'
  } as const;
  const membershipIds = {
    admin: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    manager: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    reviewer: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    reader: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  } as const;
  const auditInput = (workspace = workspaceId) => ({
    workspaceId: workspace,
    actorId: 'user-admin',
    actorMembershipId: 'membership-admin',
    operation: 'FORMAL_MATTER_CREATE' as const,
    targetType: 'FORMAL_MATTER' as const,
    targetId: 'formal-matter_http',
    reasonCode: 'IDEMPOTENCY_KEY_REUSE' as const,
    occurredAt: '2026-08-01T12:00:00.000Z'
  });
  const request = (token: string | undefined, workspace = workspaceId, query = '') =>
    fetch(`http://127.0.0.1:${gateway.listeningPort}/api/markreg/audit-records${query}`, {
      headers: {
        ...(token ? { cookie: `mo_session=${token}` } : {}),
        'x-markorbit-workspace-id': workspace
      }
    });

  beforeAll(async () => {
    await database.start();
    await resetAndMigrateMarkRegTestDatabase({
      pool: database.getPool(),
      migrationsDirectory: path.resolve('infrastructure/persistence/migrations'),
      migrationOwners: path.resolve('infrastructure/persistence/migration-owners.json')
    });
    await workspaces.create({ workspaceId, name: 'One', slug: 'one' });
    await workspaces.create({ workspaceId: otherWorkspaceId, name: 'Two', slug: 'two' });
    for (const [name, role] of [
      ['admin', 'WORKSPACE_ADMIN'],
      ['manager', 'MATTER_MANAGER'],
      ['reviewer', 'REVIEWER'],
      ['reader', 'READ_ONLY']
    ] as const) {
      const userId = userIds[name];
      await users.create({ userId, email: `${name}@example.test`, displayName: name });
      await memberships.create({
        membershipId: membershipIds[name],
        workspaceId,
        userId,
        role
      });
      tokens[name] = (await authentication.issueSession(userId)).rawToken;
    }
    await new PostgresMarkRegAuditRepository(database.getPool()).appendDenial(auditInput());
    markreg = createMarkReg({
      port: 0,
      internalServiceSecret: secret,
      auditRepository: new PostgresMarkRegAuditRepository(database.getPool())
    });
    await core.start();
    await markreg.start();
    gateway = createGateway({
      port: 0,
      markRegUrl: `http://127.0.0.1:${markreg.listeningPort}`,
      authenticationClient: new HttpCoreAuthenticationClient(
        `http://127.0.0.1:${core.listeningPort}`,
        secret
      ),
      internalServiceSecret: secret
    });
    await gateway.start();
  });
  afterAll(async () => {
    await Promise.allSettled([gateway?.stop(), markreg.stop(), core.stop()]);
    await database.close();
  });

  it.each(['admin', 'manager'])('%s may read normalized audit evidence', async (role) => {
    const response = await request(tokens[role]);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { records: unknown[] };
    expect(body.records).toHaveLength(1);
    expect(JSON.stringify(body)).not.toMatch(/mo_session|csrf|raw-key|password/iu);
  });

  it.each(['reviewer', 'reader'])('%s receives 403', async (role) => {
    expect((await request(tokens[role])).status).toBe(403);
  });

  it('anonymous and expired Sessions receive 401', async () => {
    expect((await request(undefined)).status).toBe(401);
    const expired = await authentication.issueSession(userIds.admin, 300);
    clock = new Date(clock.getTime() + 301_000);
    expect((await request(expired.rawToken)).status).toBe(401);
  });

  it('does not discover another Workspace or trust forged query context', async () => {
    const response = await request(
      tokens.admin,
      workspaceId,
      `?workspaceId=${encodeURIComponent(otherWorkspaceId)}&kind=DENIAL`
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { records: { workspaceId: string }[] };
    expect(body.records.every((record) => record.workspaceId === workspaceId)).toBe(true);
  });

  it('validates bounded filters and pagination', async () => {
    expect((await request(tokens.admin, workspaceId, '?limit=101')).status).toBe(400);
    const response = await request(
      tokens.admin,
      workspaceId,
      '?reasonCode=IDEMPOTENCY_KEY_REUSE&limit=1'
    );
    expect(response.status).toBe(200);
  });

  it('maps MarkReg unavailability to a safe 503', async () => {
    await markreg.stop();
    const response = await request(tokens.admin);
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toMatch(/ECONNREFUSED|127\.0\.0\.1/iu);
  });
});
