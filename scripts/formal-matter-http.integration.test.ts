import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ManagedDatabase,
  loadMigrationsForOwner,
  migrate
} from '../packages/persistence/dist/index.js';
import {
  AuthenticationService,
  InMemoryMembershipRepository,
  InMemorySessionRepository,
  InMemoryUserRepository,
  InMemoryWorkspaceRepository,
  createRuntime as createCore
} from '../services/core/dist/index.js';
import {
  createRuntime as createGateway,
  HttpCoreAuthenticationClient
} from '../apps/gateway/dist/index.js';
import {
  createRuntime as createMarkReg,
  PostgresCustomerConfirmationRepository,
  PostgresMatterDraftRepository,
  PostgresFormalMatterRepository,
  hashSnapshot
} from '../services/markreg/dist/index.js';

const url = process.env.MARKREG_TEST_DATABASE_URL,
  required = process.env.MARKREG_POSTGRES_TEST_REQUIRED === '1';
if (required && !url) throw new Error('MARKREG_TEST_DATABASE_URL is required in required mode.');
const suite = url ? describe : describe.skip;
const secret = 'task-022-http-internal-service-secret';
const origin = 'https://test.markorbit.local';
const workspaceId = '44444444-4444-4444-8444-444444444444';
const otherWorkspaceId = '55555555-5555-4555-8555-555555555555';
const at = '2026-07-31T16:00:00.000Z';
suite('real authenticated Formal Matter HTTP vertical slice', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'formal-matter-http',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'markreg_formal_matter_http_test'
  });
  const users = new InMemoryUserRepository(),
    workspaces = new InMemoryWorkspaceRepository(),
    memberships = new InMemoryMembershipRepository(users, workspaces),
    sessions = new InMemorySessionRepository();
  const auth = new AuthenticationService({ users, workspaces, memberships, sessions });
  const core = createCore({ port: 0, authentication: auth, internalServiceSecret: secret });
  let markreg: ReturnType<typeof createMarkReg>,
    gateway: ReturnType<typeof createGateway>,
    markregPort = 0,
    base = '';
  const cookies: Record<string, string> = {};
  const csrf: Record<string, string> = {};
  const confirmations = () => new PostgresCustomerConfirmationRepository(database.getPool());
  const drafts = () => new PostgresMatterDraftRepository(database.getPool());
  const runtime = (port: number) =>
    createMarkReg({
      port,
      customerConfirmationRepository: confirmations(),
      matterDraftRepository: drafts(),
      formalMatterRepository: new PostgresFormalMatterRepository(database, database.getPool()),
      internalServiceSecret: secret,
      now: () => at
    });
  async function seed(
    suffix: string,
    options: { workspace?: string; withdrawn?: boolean; ready?: boolean } = {}
  ) {
    const workspace = options.workspace ?? workspaceId,
      snapshot = {
        schemaVersion: 1 as const,
        quoteId: `quote_${suffix}`,
        quoteVersion: 'quote-v1',
        planId: `plan_${suffix}`,
        planVersion: 'plan-v1',
        currency: 'USD',
        totalMinor: 100,
        lineItems: [
          { code: 'SERVICE', description: 'Service', category: 'SERVICE_FEE', amountMinor: 100 }
        ],
        termsVersion: 'terms-v1',
        acknowledgementCodes: ['NO_FILING'],
        selectedOptionCode: 'A',
        recommendationId: `recommendation_${suffix}`,
        assumptions: [{ code: 'SCOPE', text: 'Unchanged' }],
        limitations: ['No filing']
      };
    const confirmation = {
      confirmationId: `confirmation_${suffix}`,
      workspaceId: workspace,
      sourceQuoteId: snapshot.quoteId,
      sourceQuoteVersion: snapshot.quoteVersion,
      status: options.withdrawn ? ('WITHDRAWN' as const) : ('CONFIRMED' as const),
      version: 1,
      snapshotSchemaVersion: 1 as const,
      sourceSnapshot: snapshot,
      sourceSnapshotHash: hashSnapshot(snapshot),
      acceptedAt: at,
      updatedAt: at,
      withdrawnAt: options.withdrawn ? at : null
    };
    await confirmations().create(confirmation);
    const ready = options.ready !== false,
      checks = [
        {
          code: 'CUSTOMER_CONFIRMATION_VALID' as const,
          status: ready ? ('PASS' as const) : ('FAIL' as const),
          explanation: ready ? 'Current' : 'Incomplete',
          blocking: true
        }
      ];
    const draft = {
      schemaVersion: 1 as const,
      matterDraftId: `matter-draft_${suffix}`,
      workspaceId: workspace,
      customerConfirmationId: confirmation.confirmationId,
      customerConfirmationVersion: 1,
      sourceQuoteId: snapshot.quoteId,
      sourceQuoteVersion: snapshot.quoteVersion,
      preparation: {
        applicantName: 'Orbit',
        applicantAddress: '1 Way',
        trademark: 'ORBIT',
        targetJurisdiction: 'US',
        classes: [9],
        goodsServices: 'Software',
        filingBasis: 'USE',
        representativeRequired: false,
        documentReferences: ['doc_1'],
        commercialScopeUnchanged: true
      },
      instructionCompleteness: ready ? ('COMPLETE' as const) : ('INCOMPLETE' as const),
      documentReadiness: ready ? ('READY' as const) : ('MISSING' as const),
      readiness: { evaluatedAt: at, checks, readyForProfessionalReview: ready },
      missingInformation: ready ? [] : ['CUSTOMER_CONFIRMATION_VALID'],
      status: ready ? ('READY_FOR_PROFESSIONAL_REVIEW' as const) : ('NEEDS_INFORMATION' as const),
      version: 1,
      createdAt: at,
      updatedAt: at
    };
    await drafts().create(draft);
    return { confirmation, draft };
  }
  const headers = (role: string, key?: string) => ({
    'content-type': 'application/json',
    cookie: cookies[role]!,
    origin,
    'x-markorbit-csrf-token': csrf[role]!,
    'x-markorbit-workspace-id': workspaceId,
    ...(key ? { 'idempotency-key': key } : {})
  });
  async function create(role: string, suffix: string, overrides: Record<string, unknown> = {}) {
    const source = await seed(suffix);
    const key = `formal-${suffix}`;
    const body = {
      workspaceId,
      customerConfirmationId: source.confirmation.confirmationId,
      expectedCustomerConfirmationVersion: 1,
      matterDraftId: source.draft.matterDraftId,
      expectedMatterDraftVersion: 1,
      idempotencyKey: key,
      ...overrides
    };
    const response = await fetch(`${base}/api/markreg/formal-matters`, {
      method: 'POST',
      headers: headers(role, key),
      body: JSON.stringify(body)
    });
    return { response, body, source };
  }
  beforeAll(async () => {
    await database.start();
    const pool = database.getPool();
    await pool.query(
      'DROP TABLE IF EXISTS formal_matter_audit,formal_matter_commands,formal_matters,matter_drafts,customer_confirmations CASCADE'
    );
    const history = await pool.query<{ migration_history: string | null }>(
      "SELECT to_regclass('markorbit_persistence.migration_history')::text AS migration_history"
    );
    if (history.rows[0]?.migration_history)
      await pool.query('DELETE FROM markorbit_persistence.migration_history WHERE namespace=$1', [
        'markreg_formal_matter_http_test'
      ]);
    const owned = await loadMigrationsForOwner(
      path.resolve('infrastructure/persistence/migrations'),
      path.resolve('infrastructure/persistence/migration-owners.json'),
      '@markorbit/markreg-service'
    );
    await migrate(pool, 'markreg_formal_matter_http_test', owned);
    await workspaces.create({ workspaceId, name: 'Formal Matter HTTP', slug: 'formal-http' });
    await workspaces.create({ workspaceId: otherWorkspaceId, name: 'Other', slug: 'other-http' });
    for (const role of ['WORKSPACE_ADMIN', 'MATTER_MANAGER', 'REVIEWER', 'READ_ONLY']) {
      const name = role.toLowerCase(),
        userId = `user_${name}`,
        membershipId = `membership_${name}`;
      await users.create({ userId, email: `${name}@example.test`, displayName: role });
      await memberships.create({ membershipId, workspaceId, userId, role: role as never });
    }
    await core.start();
    markreg = runtime(0);
    await markreg.start();
    markregPort = markreg.listeningPort;
    gateway = createGateway({
      port: 0,
      markRegUrl: `http://127.0.0.1:${markregPort}`,
      authenticationClient: new HttpCoreAuthenticationClient(
        `http://127.0.0.1:${core.listeningPort}`,
        secret
      ),
      internalServiceSecret: secret,
      milestoneTestRuntime: true,
      fixtureUsers: {
        admin: 'user_workspace_admin',
        manager: 'user_matter_manager',
        reviewer: 'user_reviewer',
        readonly: 'user_read_only'
      },
      csrfSecret: 'task-022-csrf',
      allowedOrigins: [origin]
    });
    await gateway.start();
    base = `http://127.0.0.1:${gateway.listeningPort}`;
    for (const role of ['admin', 'manager', 'reviewer', 'readonly']) {
      const boot = await fetch(`${base}/__test/auth/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fixture: role })
      });
      cookies[role] = boot.headers.get('set-cookie')!;
      const session = await fetch(`${base}/api/auth/session`, {
        headers: { cookie: cookies[role]! }
      });
      csrf[role] = ((await session.json()) as { csrfToken: string }).csrfToken;
    }
  });
  afterAll(async () => {
    await gateway.stop();
    await markreg.stop();
    await core.stop();
    await database.close();
  });
  it('permits Admin and Matter Manager, reloads, replays, and proves no downstream authority objects', async () => {
    for (const role of ['admin', 'manager']) {
      const suffix = `allowed_${role}`,
        created = await create(role, suffix);
      expect(created.response.status).toBe(200);
      const payload = (await created.response.json()) as {
        formalMatter: { formalMatterId: string; status: string; snapshotSha256: string };
      };
      expect(payload.formalMatter.status).toBe('OPEN');
      const replay = await fetch(`${base}/api/markreg/formal-matters`, {
        method: 'POST',
        headers: headers(role, created.body.idempotencyKey as string),
        body: JSON.stringify(created.body)
      });
      expect(
        ((await replay.json()) as { formalMatter: { formalMatterId: string } }).formalMatter
          .formalMatterId
      ).toBe(payload.formalMatter.formalMatterId);
      const read = await fetch(
        `${base}/api/markreg/formal-matters/${payload.formalMatter.formalMatterId}`,
        { headers: { cookie: cookies[role]!, 'x-markorbit-workspace-id': workspaceId } }
      );
      expect(await read.json()).toMatchObject({
        formalMatter: {
          formalMatterId: payload.formalMatter.formalMatterId,
          sourceMatterDraftId: created.source.draft.matterDraftId
        },
        consequences: {
          orderCreated: false,
          paymentCreated: false,
          professionalAppointed: false,
          filingCreated: false
        }
      });
    }
  });
  it('denies Reviewer and Read Only creation', async () => {
    expect((await create('reviewer', 'denied_reviewer')).response.status).toBe(403);
    expect((await create('readonly', 'denied_readonly')).response.status).toBe(403);
  });
  it('maps conflict, stale, withdrawn, not-ready and cross-Workspace sources safely', async () => {
    const conflict = await create('admin', 'conflict');
    expect(conflict.response.status).toBe(200);
    const reused = await fetch(`${base}/api/markreg/formal-matters`, {
      method: 'POST',
      headers: headers('admin', conflict.body.idempotencyKey as string),
      body: JSON.stringify({ ...conflict.body, expectedMatterDraftVersion: 2 })
    });
    expect(reused.status).toBe(409);
    const stale = await create('admin', 'stale', { expectedMatterDraftVersion: 2 });
    expect(stale.response.status).toBe(409);
    const withdrawn = await seed('withdrawn', { withdrawn: true });
    let response = await fetch(`${base}/api/markreg/formal-matters`, {
      method: 'POST',
      headers: headers('admin', 'withdrawn'),
      body: JSON.stringify({
        workspaceId,
        customerConfirmationId: withdrawn.confirmation.confirmationId,
        expectedCustomerConfirmationVersion: 1,
        matterDraftId: withdrawn.draft.matterDraftId,
        expectedMatterDraftVersion: 1,
        idempotencyKey: 'withdrawn'
      })
    });
    expect(response.status).toBe(422);
    const notReady = await seed('not-ready', { ready: false });
    response = await fetch(`${base}/api/markreg/formal-matters`, {
      method: 'POST',
      headers: headers('admin', 'not-ready'),
      body: JSON.stringify({
        workspaceId,
        customerConfirmationId: notReady.confirmation.confirmationId,
        expectedCustomerConfirmationVersion: 1,
        matterDraftId: notReady.draft.matterDraftId,
        expectedMatterDraftVersion: 1,
        idempotencyKey: 'not-ready'
      })
    });
    expect(response.status).toBe(422);
    const cross = await seed('cross', { workspace: otherWorkspaceId });
    response = await fetch(`${base}/api/markreg/formal-matters`, {
      method: 'POST',
      headers: headers('admin', 'cross'),
      body: JSON.stringify({
        workspaceId,
        customerConfirmationId: cross.confirmation.confirmationId,
        expectedCustomerConfirmationVersion: 1,
        matterDraftId: cross.draft.matterDraftId,
        expectedMatterDraftVersion: 1,
        idempotencyKey: 'cross'
      })
    });
    expect(response.status).toBe(404);
  });
  it('survives an actual MarkReg listener stop and new runtime start on the same PostgreSQL database', async () => {
    const created = await create('admin', 'restart');
    const value = (await created.response.json()) as {
      formalMatter: {
        formalMatterId: string;
        status: string;
        snapshotSha256: string;
        sourceMatterDraftId: string;
      };
    };
    await markreg.stop();
    markreg = runtime(markregPort);
    await markreg.start();
    const read = await fetch(
      `${base}/api/markreg/formal-matters/${value.formalMatter.formalMatterId}`,
      { headers: { cookie: cookies.admin!, 'x-markorbit-workspace-id': workspaceId } }
    );
    expect(await read.json()).toMatchObject({ formalMatter: value.formalMatter });
  });
  it('returns 503, not conflict, while MarkReg is unavailable', async () => {
    await markreg.stop();
    const response = await fetch(`${base}/api/markreg/formal-matters/missing`, {
      headers: { cookie: cookies.admin!, 'x-markorbit-workspace-id': workspaceId }
    });
    expect(response.status).toBe(503);
    markreg = runtime(markregPort);
    await markreg.start();
  });
});
