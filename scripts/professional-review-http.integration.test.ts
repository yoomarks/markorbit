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
  createRuntime as createCore,
  permissionsForRole
} from '../services/core/dist/index.js';
import {
  createRuntime as createGateway,
  HttpCoreAuthenticationClient
} from '../apps/gateway/dist/index.js';
import {
  createRuntime as createMarkReg,
  FormalMatterService,
  PostgresCustomerConfirmationRepository,
  PostgresFormalMatterRepository,
  PostgresMatterDraftRepository,
  hashSnapshot
} from '../services/markreg/dist/index.js';
import { resetAndMigrateMarkRegTestDatabase } from '../services/markreg/tests/support/markreg-test-database.js';
import {
  createRuntime as createExecution,
  PostgresProfessionalReviewRepository
} from '../services/execution/dist/index.js';

const url = process.env.EXECUTION_TEST_DATABASE_URL;
const markregUrl = process.env.MARKREG_TEST_DATABASE_URL;
const required = process.env.EXECUTION_POSTGRES_TEST_REQUIRED === '1';
if (required && !url) throw new Error('EXECUTION_TEST_DATABASE_URL is required in required mode.');
if (required && !markregUrl)
  throw new Error('MARKREG_TEST_DATABASE_URL is required in required mode.');
const suite = url && markregUrl ? describe : describe.skip;
const secret = 'task-024-http-internal-service-secret';
const origin = 'https://review.test.markorbit.local';
const workspaceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherWorkspaceId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const at = '2026-07-31T21:00:00.000Z';

suite('real authenticated durable Professional Review HTTP path', () => {
  let authenticationNow = new Date(at);
  const executionDatabase = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'professional-review-http',
    poolMaximum: 15,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'professional_review_http'
  });
  const markregDatabase = new ManagedDatabase({
    connection: { url: markregUrl! },
    applicationName: 'professional-review-http-markreg',
    poolMaximum: 15,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'professional_review_http_markreg'
  });
  const users = new InMemoryUserRepository();
  const workspaces = new InMemoryWorkspaceRepository();
  const memberships = new InMemoryMembershipRepository(users, workspaces);
  const sessions = new InMemorySessionRepository();
  const authentication = new AuthenticationService({
    users,
    workspaces,
    memberships,
    sessions,
    clock: () => authenticationNow
  });
  const core = createCore({ port: 0, authentication, internalServiceSecret: secret });
  let markreg: ReturnType<typeof createMarkReg>;
  let execution: ReturnType<typeof createExecution>;
  let gateway: ReturnType<typeof createGateway>;
  let base = '';
  const cookies: Record<string, string> = {};
  const csrf: Record<string, string> = {};
  const confirmations = () => new PostgresCustomerConfirmationRepository(markregDatabase.getPool());
  const drafts = () => new PostgresMatterDraftRepository(markregDatabase.getPool());
  const executionRuntime = (port: number) => {
    const pool = executionDatabase.getPool();
    return createExecution({
      port,
      reviewRepositoryFactory: (workspace) =>
        new PostgresProfessionalReviewRepository(executionDatabase, pool, workspace),
      internalServiceSecret: secret,
      markRegUrl: `http://127.0.0.1:${markreg.listeningPort}`,
      now: () => at
    });
  };
  const headers = (role: string, key?: string, workspace = workspaceId) => ({
    'content-type': 'application/json',
    cookie: cookies[role]!,
    origin,
    'x-markorbit-csrf-token': csrf[role]!,
    'x-markorbit-workspace-id': workspace,
    ...(key ? { 'idempotency-key': key } : {})
  });

  async function seedMatter(suffix: string, workspace = workspaceId) {
    const quote = {
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
      assumptions: [],
      limitations: ['No filing']
    };
    const confirmation = {
      confirmationId: `confirmation_${suffix}`,
      workspaceId: workspace,
      sourceQuoteId: quote.quoteId,
      sourceQuoteVersion: quote.quoteVersion,
      status: 'CONFIRMED' as const,
      version: 1,
      snapshotSchemaVersion: 1 as const,
      sourceSnapshot: quote,
      sourceSnapshotHash: hashSnapshot(quote),
      acceptedAt: at,
      updatedAt: at,
      withdrawnAt: null
    };
    await confirmations().create(confirmation);
    const draft = {
      schemaVersion: 1 as const,
      matterDraftId: `matter-draft_${suffix}`,
      workspaceId: workspace,
      customerConfirmationId: confirmation.confirmationId,
      customerConfirmationVersion: 1,
      sourceQuoteId: quote.quoteId,
      sourceQuoteVersion: quote.quoteVersion,
      preparation: {
        applicantName: 'Northstar',
        applicantAddress: '1 Orbit Way',
        trademark: `ORBIT ${suffix}`,
        targetJurisdiction: 'US',
        classes: [9],
        goodsServices: 'Software',
        filingBasis: 'USE',
        representativeRequired: false,
        documentReferences: ['doc_1'],
        commercialScopeUnchanged: true
      },
      instructionCompleteness: 'COMPLETE' as const,
      documentReadiness: 'READY' as const,
      readiness: {
        evaluatedAt: at,
        checks: [
          {
            code: 'CUSTOMER_CONFIRMATION_VALID' as const,
            status: 'PASS' as const,
            explanation: 'Current',
            blocking: true
          }
        ],
        readyForProfessionalReview: true
      },
      missingInformation: [],
      status: 'READY_FOR_PROFESSIONAL_REVIEW' as const,
      version: 1,
      createdAt: at,
      updatedAt: at
    };
    await drafts().create(draft);
    const principal = await authentication.resolveWorkspacePrincipal(
      cookies.admin!.match(/mo_session=([^;]+)/)![1]!,
      workspace
    );
    return new FormalMatterService(
      new PostgresFormalMatterRepository(markregDatabase, markregDatabase.getPool()),
      confirmations(),
      drafts(),
      () => at
    ).create(principal, {
      workspaceId: workspace,
      customerConfirmationId: confirmation.confirmationId as never,
      expectedCustomerConfirmationVersion: 1,
      matterDraftId: draft.matterDraftId as never,
      expectedMatterDraftVersion: 1,
      idempotencyKey: `formal-${suffix}`
    });
  }
  async function open(role: string, suffix: string) {
    const matter = await seedMatter(suffix);
    const key = `review-${suffix}`;
    const response = await fetch(`${base}/api/lite/professional-review-cases`, {
      method: 'POST',
      headers: headers(role, key),
      body: JSON.stringify({
        formalMatterId: matter.formalMatterId,
        sourceFormalMatterVersion: matter.version,
        sourceSnapshotSha256: matter.snapshotSha256,
        matterDraftId: matter.sourceMatterDraftId,
        matterDraftVersion: String(matter.sourceMatterDraftVersion)
      })
    });
    return { matter, response, body: (await response.json()) as { reviewCase: any } };
  }

  beforeAll(async () => {
    await executionDatabase.start();
    await markregDatabase.start();
    const executionPool = executionDatabase.getPool();
    const markregPool = markregDatabase.getPool();
    await executionPool.query(
      `DROP TABLE IF EXISTS
         execution_evidence_review_audit,
         execution_evidence_review_commands,
         execution_evidence_correction_requests,
         execution_evidence_review_decisions,
         execution_evidence_review_sources,
         execution_provider_return_evidence_audit,
         execution_provider_return_evidence_commands,
         execution_provider_return_evidence_receipts,
         filing_execution_task_drafts,
         execution_releases,
         filing_authorizations,
         filing_governance_commands,
         filing_governance_audit,
         professional_review_audit,
         professional_review_commands,
         professional_review_cases
       CASCADE`
    );
    await executionPool.query(
      'DROP FUNCTION IF EXISTS reject_filing_governance_audit_mutation() CASCADE'
    );
    const history = await executionPool.query<{ migration_history: string | null }>(
      "SELECT to_regclass('markorbit_persistence.migration_history')::text AS migration_history"
    );
    if (history.rows[0]?.migration_history)
      await executionPool.query(
        "DELETE FROM markorbit_persistence.migration_history WHERE namespace = 'professional_review_http_execution'"
      );
    const directory = path.resolve('infrastructure/persistence/migrations');
    const owners = path.resolve('infrastructure/persistence/migration-owners.json');
    await resetAndMigrateMarkRegTestDatabase({
      pool: markregPool,
      migrationsDirectory: directory,
      migrationOwners: owners
    });
    await migrate(
      executionPool,
      'professional_review_http_execution',
      await loadMigrationsForOwner(directory, owners, '@markorbit/execution-service')
    );
    await workspaces.create({ workspaceId, name: 'Review HTTP', slug: 'review-http' });
    await workspaces.create({
      workspaceId: otherWorkspaceId,
      name: 'Other Review',
      slug: 'other-review'
    });
    for (const [name, role] of [
      ['admin', 'WORKSPACE_ADMIN'],
      ['manager', 'MATTER_MANAGER'],
      ['reviewer', 'REVIEWER'],
      ['readonly', 'READ_ONLY']
    ] as const) {
      await users.create({
        userId: `user_${name}`,
        email: `${name}@review.test`,
        displayName: name
      });
      await memberships.create({
        membershipId: `membership_${name}`,
        workspaceId,
        userId: `user_${name}`,
        role
      });
    }
    await users.create({
      userId: 'user_nonmember',
      email: 'nonmember@review.test',
      displayName: 'nonmember'
    });
    await memberships.create({
      membershipId: 'membership_admin_other',
      workspaceId: otherWorkspaceId,
      userId: 'user_admin',
      role: 'WORKSPACE_ADMIN'
    });
    await core.start();
    markreg = createMarkReg({
      port: 0,
      customerConfirmationRepository: confirmations(),
      matterDraftRepository: drafts(),
      formalMatterRepository: new PostgresFormalMatterRepository(markregDatabase, markregPool),
      internalServiceSecret: secret,
      now: () => at
    });
    await markreg.start();
    execution = executionRuntime(0);
    await execution.start();
    gateway = createGateway({
      port: 0,
      markRegUrl: `http://127.0.0.1:${markreg.listeningPort}`,
      executionUrl: `http://127.0.0.1:${execution.listeningPort}`,
      authenticationClient: new HttpCoreAuthenticationClient(
        `http://127.0.0.1:${core.listeningPort}`,
        secret
      ),
      internalServiceSecret: secret,
      milestoneTestRuntime: true,
      fixtureUsers: {
        admin: 'user_admin',
        manager: 'user_manager',
        reviewer: 'user_reviewer',
        readonly: 'user_readonly',
        nonmember: 'user_nonmember'
      },
      csrfSecret: 'task-024-csrf',
      allowedOrigins: [origin]
    });
    await gateway.start();
    base = `http://127.0.0.1:${gateway.listeningPort}`;
    for (const role of ['admin', 'manager', 'reviewer', 'readonly', 'nonmember']) {
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
    await gateway?.stop();
    await execution?.stop();
    await markreg?.stop();
    await core.stop();
    await executionDatabase.close();
    await markregDatabase.close();
  });

  it('enforces the role, Session and Workspace matrix through real listeners', async () => {
    const managerToken = cookies.manager!.match(/mo_session=([^;]+)/)![1]!;
    const managerPrincipal = await authentication.resolveWorkspacePrincipal(
      managerToken,
      workspaceId
    );
    expect(managerPrincipal.role).toBe('MATTER_MANAGER');
    expect(managerPrincipal.permissions).toEqual(permissionsForRole('MATTER_MANAGER'));
    for (const role of ['admin', 'manager', 'reviewer'])
      expect((await open(role, `role_${role}`)).response.status, role).toBe(200);
    const readable = await open('admin', 'readable');
    const id = readable.body.reviewCase.reviewCaseId;
    const readOnlyGet = await fetch(`${base}/api/lite/professional-review-cases/${id}`, {
      headers: { cookie: cookies.readonly!, 'x-markorbit-workspace-id': workspaceId }
    });
    expect(readOnlyGet.status).toBe(200);
    const denied = await fetch(`${base}/api/lite/professional-review-cases/${id}/claim`, {
      method: 'POST',
      headers: headers('readonly'),
      body: JSON.stringify({ expectedVersion: 1 })
    });
    expect(denied.status).toBe(403);
    expect(
      (
        await fetch(`${base}/api/lite/professional-review-cases`, {
          headers: { 'x-markorbit-workspace-id': workspaceId }
        })
      ).status
    ).toBe(401);
    expect(
      (
        await fetch(`${base}/api/lite/professional-review-cases`, {
          headers: { cookie: cookies.nonmember!, 'x-markorbit-workspace-id': workspaceId }
        })
      ).status
    ).toBe(403);
    expect(
      (
        await fetch(`${base}/api/lite/professional-review-cases/${id}`, {
          headers: { cookie: cookies.admin!, 'x-markorbit-workspace-id': otherWorkspaceId }
        })
      ).status
    ).toBe(404);
    authenticationNow = new Date('2030-01-01T00:00:00.000Z');
    expect(
      (
        await fetch(`${base}/api/lite/professional-review-cases`, {
          headers: { cookie: cookies.admin!, 'x-markorbit-workspace-id': workspaceId }
        })
      ).status
    ).toBe(401);
    authenticationNow = new Date(at);
  });

  it('saves exact drafts, rejects stale/invalid evidence, completes immutably and survives listener restart', async () => {
    const opened = await open('reviewer', 'durable');
    expect(opened.response.status).toBe(200);
    let review = opened.body.reviewCase;
    const claim = await fetch(
      `${base}/api/lite/professional-review-cases/${review.reviewCaseId}/claim`,
      {
        method: 'POST',
        headers: headers('reviewer'),
        body: JSON.stringify({ expectedVersion: review.version })
      }
    );
    review = ((await claim.json()) as any).reviewCase;
    const updates = review.checklist.map((item: any) => ({
      code: item.code,
      status: 'PASS',
      reviewerNote: 'Durable structured finding.'
    }));
    const draft = await fetch(
      `${base}/api/lite/professional-review-cases/${review.reviewCaseId}/checklist`,
      {
        method: 'PATCH',
        headers: headers('reviewer'),
        body: JSON.stringify({ expectedVersion: review.version, updates })
      }
    );
    expect(draft.status).toBe(200);
    review = ((await draft.json()) as any).reviewCase;
    const stale = await fetch(
      `${base}/api/lite/professional-review-cases/${review.reviewCaseId}/checklist`,
      {
        method: 'PATCH',
        headers: headers('reviewer'),
        body: JSON.stringify({ expectedVersion: review.version - 1, updates: [] })
      }
    );
    expect(stale.status).toBe(409);
    const invalid = await fetch(
      `${base}/api/lite/professional-review-cases/${review.reviewCaseId}/checklist`,
      {
        method: 'PATCH',
        headers: headers('reviewer'),
        body: JSON.stringify({
          expectedVersion: review.version,
          updates: [{ code: 'UNBOUNDED', status: 'PASS' }]
        })
      }
    );
    expect(invalid.status).toBe(422);
    const completedResponse = await fetch(
      `${base}/api/lite/professional-review-cases/${review.reviewCaseId}/complete`,
      {
        method: 'POST',
        headers: headers('reviewer', `complete-${review.reviewCaseId}`),
        body: JSON.stringify({
          expectedVersion: review.version,
          code: 'MARK_READY_FOR_NEXT_STEP',
          rationale: 'Ready for next governed step.'
        })
      }
    );
    expect(completedResponse.status).toBe(200);
    const completed = ((await completedResponse.json()) as any).reviewCase;
    expect(completed).toMatchObject({
      status: 'REVIEWED_READY_FOR_NEXT_STEP',
      completedBy: 'user_reviewer',
      formalMatterId: opened.matter.formalMatterId,
      sourceFormalMatterVersion: 1,
      sourceSnapshotSha256: opened.matter.snapshotSha256
    });
    expect(completed.decision.consequences).toEqual({
      orderCreated: false,
      paymentCreated: false,
      formalMatterCreated: false,
      providerAppointed: false,
      filingCreated: false,
      customerMessageSent: false
    });
    const oldPort = execution.listeningPort!;
    await execution.stop();
    execution = executionRuntime(oldPort);
    await execution.start();
    const afterRestart = await fetch(
      `${base}/api/lite/professional-review-cases/${review.reviewCaseId}`,
      { headers: { cookie: cookies.reviewer!, 'x-markorbit-workspace-id': workspaceId } }
    );
    expect(afterRestart.status).toBe(200);
    expect(((await afterRestart.json()) as any).reviewCase).toEqual(completed);
  });

  it('OUT-006/009 maps an actual Execution database outage to 503 and recovers durable evidence', async () => {
    const opened = await open('reviewer', 'execution_database_outage');
    expect(opened.response.status).toBe(200);
    const review = opened.body.reviewCase;
    await executionDatabase.close();
    const read = await fetch(`${base}/api/lite/professional-review-cases/${review.reviewCaseId}`, {
      headers: { cookie: cookies.reviewer!, 'x-markorbit-workspace-id': workspaceId }
    });
    expect(read.status).toBe(503);
    expect(JSON.stringify(await read.json())).not.toMatch(
      /postgres|127\.0\.0\.1|password|SELECT|ECONN/iu
    );
    const mutation = await fetch(
      `${base}/api/lite/professional-review-cases/${review.reviewCaseId}/claim`,
      { method: 'POST', headers: headers('reviewer', 'execution-outage-claim'), body: '{}' }
    );
    expect(mutation.status).toBe(503);
    const port = execution.listeningPort!;
    await execution.stop();
    await executionDatabase.start();
    execution = executionRuntime(port);
    await execution.start();
    const recovered = await fetch(
      `${base}/api/lite/professional-review-cases/${review.reviewCaseId}`,
      { headers: { cookie: cookies.reviewer!, 'x-markorbit-workspace-id': workspaceId } }
    );
    expect(recovered.status).toBe(200);
    expect(((await recovered.json()) as any).reviewCase).toEqual(review);
  });

  it('maps unavailable Execution and required MarkReg validation to 503', async () => {
    const port = execution.listeningPort!;
    await execution.stop();
    expect(
      (
        await fetch(`${base}/api/lite/professional-review-cases`, {
          headers: { cookie: cookies.admin!, 'x-markorbit-workspace-id': workspaceId }
        })
      ).status
    ).toBe(503);
    execution = executionRuntime(port);
    await execution.start();
    const matter = await seedMatter('source_unavailable');
    await markreg.stop();
    const response = await fetch(`${base}/api/lite/professional-review-cases`, {
      method: 'POST',
      headers: headers('admin', 'source-unavailable'),
      body: JSON.stringify({
        formalMatterId: matter.formalMatterId,
        sourceFormalMatterVersion: 1,
        sourceSnapshotSha256: matter.snapshotSha256,
        matterDraftId: matter.sourceMatterDraftId,
        matterDraftVersion: '1'
      })
    });
    expect(response.status).toBe(503);
  });
});
