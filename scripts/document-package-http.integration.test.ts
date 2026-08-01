import path from 'node:path';
import { createHash } from 'node:crypto';
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
  FormalMatterService,
  PostgresCustomerConfirmationRepository,
  PostgresDocumentPackageService,
  PostgresFormalMatterRepository,
  PostgresMatterDraftRepository,
  hashSnapshot
} from '../services/markreg/dist/index.js';
import {
  createRuntime as createExecution,
  PostgresProfessionalReviewRepository
} from '../services/execution/dist/index.js';
import {
  encodeInternalWorkspacePrincipal,
  type ProfessionalReviewCase
} from '../packages/contracts/dist/index.js';

const url = process.env.MARKREG_TEST_DATABASE_URL;
const required = process.env.MARKREG_DOCUMENT_PACKAGE_POSTGRES_REQUIRED === '1';
if (required && !url) throw new Error('MARKREG_TEST_DATABASE_URL is required in required mode.');
const suite = url ? describe : describe.skip;
const workspaceId = '25252525-2525-4525-8525-252525252525';
const otherWorkspaceId = '25252525-2525-4525-8525-252525252526';
const origin = 'https://package-http.test.markorbit.local';
const secret = 'task-025-package-http-internal-secret';
const at = '2026-08-01T12:00:00.000Z';
const canonical = (value: unknown): string =>
  Array.isArray(value)
    ? `[${value.map(canonical).join(',')}]`
    : value && typeof value === 'object'
      ? `{${Object.entries(value as Record<string, unknown>)
          .filter(([, v]) => v !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
          .join(',')}}`
      : (JSON.stringify(value) ?? 'null');
const sha = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');

suite('authenticated durable Document Package HTTP path', () => {
  let now = new Date(at);
  let markregDatabase: ManagedDatabase;
  const executionDatabase = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'task025-http-execution',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'task025_http_execution'
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
    clock: () => now
  });
  const core = createCore({ port: 0, authentication, internalServiceSecret: secret });
  let markreg: ReturnType<typeof createMarkReg>;
  let execution: ReturnType<typeof createExecution>;
  let gateway: ReturnType<typeof createGateway>;
  let markregPort = 4515;
  let base = '';
  const cookies: Record<string, string> = {};
  const csrf: Record<string, string> = {};
  const newMarkregDatabase = () =>
    new ManagedDatabase({
      connection: { url: url! },
      applicationName: 'task025-http-markreg',
      poolMaximum: 10,
      connectionTimeoutMs: 500,
      idleTimeoutMs: 1000,
      statementTimeoutMs: 5000,
      sslMode: 'disable',
      migrationNamespace: 'task025_http_markreg'
    });
  const reviewSource = (db: ManagedDatabase) => ({
    async get(principal: any, reviewCaseId: string, correlationId?: string) {
      try {
        const response = await fetch(
          `http://127.0.0.1:${execution.listeningPort}/v1/professional-review-cases/${encodeURIComponent(reviewCaseId)}`,
          {
            headers: {
              'x-markorbit-internal-authorization': secret,
              'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
              'x-markorbit-workspace-id': principal.workspaceId,
              ...(correlationId ? { 'x-correlation-id': correlationId } : {})
            }
          }
        );
        if (!response.ok) throw new Error(`Review source ${response.status}`);
        return ((await response.json()) as { reviewCase: ProfessionalReviewCase }).reviewCase;
      } catch (cause) {
        throw Object.assign(new Error('Execution Review source is unavailable.', { cause }), {
          code: 'DEPENDENCY_UNAVAILABLE'
        });
      }
    }
  });
  const constructMarkreg = async (port: number) => {
    markregDatabase = newMarkregDatabase();
    await markregDatabase.start();
    const pool = markregDatabase.getPool();
    const confirmations = new PostgresCustomerConfirmationRepository(pool);
    const drafts = new PostgresMatterDraftRepository(pool);
    const runtime = createMarkReg({
      port,
      customerConfirmationRepository: confirmations,
      matterDraftRepository: drafts,
      formalMatterRepository: new PostgresFormalMatterRepository(markregDatabase, pool),
      documentPackageService: new PostgresDocumentPackageService(
        markregDatabase,
        pool,
        reviewSource(markregDatabase),
        () => at
      ),
      executionUrl: `http://127.0.0.1:${execution?.listeningPort ?? 0}`,
      internalServiceSecret: secret,
      now: () => at
    });
    return runtime;
  };
  const headers = (role: string, key?: string, workspace = workspaceId) => ({
    'content-type': 'application/json',
    cookie: cookies[role]!,
    origin,
    'x-markorbit-csrf-token': csrf[role]!,
    'x-markorbit-workspace-id': workspace,
    ...(key ? { 'idempotency-key': key } : {})
  });
  const request = async (
    role: string,
    pathName: string,
    method = 'GET',
    body?: unknown,
    key?: string,
    workspace = workspaceId
  ) => {
    const response = await fetch(`${base}${pathName}`, {
      method,
      headers:
        method === 'GET'
          ? { cookie: cookies[role]!, 'x-markorbit-workspace-id': workspace }
          : headers(role, key, workspace),
      ...(body === undefined
        ? {}
        : { body: JSON.stringify({ workspaceId: workspace, ...(body as object) }) })
    });
    const value = await response.json().catch(() => ({}));
    return { response, value: value as any };
  };
  const seedMatter = async (suffix: string, workspace = workspaceId) => {
    const pool = markregDatabase.getPool();
    const confirmations = new PostgresCustomerConfirmationRepository(pool);
    const drafts = new PostgresMatterDraftRepository(pool);
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
    await confirmations.create(confirmation);
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
        documentReferences: [`required_${suffix}`],
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
    await drafts.create(draft);
    const token = cookies.admin!.match(/mo_session=([^;]+)/)![1]!;
    const principal = await authentication.resolveWorkspacePrincipal(token, workspace);
    return new FormalMatterService(
      new PostgresFormalMatterRepository(markregDatabase, pool),
      confirmations,
      drafts,
      () => at
    ).create(principal, {
      workspaceId: workspace,
      customerConfirmationId: confirmation.confirmationId as never,
      expectedCustomerConfirmationVersion: 1,
      matterDraftId: draft.matterDraftId as never,
      expectedMatterDraftVersion: 1,
      idempotencyKey: `formal-${suffix}`
    });
  };
  const createReview = async (suffix: string, complete = true) => {
    const matter = await seedMatter(suffix);
    const opened = await request(
      'reviewer',
      '/api/lite/professional-review-cases',
      'POST',
      {
        formalMatterId: matter.formalMatterId,
        sourceFormalMatterVersion: matter.version,
        sourceSnapshotSha256: matter.snapshotSha256,
        matterDraftId: matter.sourceMatterDraftId,
        matterDraftVersion: String(matter.sourceMatterDraftVersion)
      },
      `review-open-${suffix}`
    );
    expect(opened.response.status).toBe(200);
    let review = opened.value.reviewCase;
    if (!complete) return { matter, review };
    review = (
      await request(
        'reviewer',
        `/api/lite/professional-review-cases/${review.reviewCaseId}/claim`,
        'POST',
        { expectedVersion: review.version },
        `claim-${suffix}`
      )
    ).value.reviewCase;
    const updates = review.checklist.map((item: any) => ({
      code: item.code,
      status: 'PASS',
      reviewerNote: 'Satisfied.'
    }));
    review = (
      await request(
        'reviewer',
        `/api/lite/professional-review-cases/${review.reviewCaseId}/checklist`,
        'PATCH',
        { expectedVersion: review.version, updates },
        `check-${suffix}`
      )
    ).value.reviewCase;
    const completed = await request(
      'reviewer',
      `/api/lite/professional-review-cases/${review.reviewCaseId}/complete`,
      'POST',
      {
        expectedVersion: review.version,
        code: 'MARK_READY_FOR_NEXT_STEP',
        rationale: 'Ready for preparation.'
      },
      `complete-${suffix}`
    );
    expect(completed.response.status).toBe(200);
    return { matter, review: completed.value.reviewCase };
  };
  const createPackage = async (suffix: string, role = 'admin') => {
    const source = await createReview(suffix);
    const command = {
      professionalReviewCaseId: source.review.reviewCaseId,
      expectedReviewVersion: source.review.version,
      expectedCompletedDecisionId: source.review.decision.decidedAt,
      expectedCompletedDecisionHash: sha(source.review.decision)
    };
    const created = await request(
      role,
      '/api/markreg/document-packages',
      'POST',
      command,
      `package-${suffix}`
    );
    return { ...source, command, created };
  };

  beforeAll(async () => {
    markregDatabase = newMarkregDatabase();
    await Promise.all([markregDatabase.start(), executionDatabase.start()]);
    const pool = markregDatabase.getPool();
    await pool.query(
      'DROP TABLE IF EXISTS document_package_audit,document_package_commands,document_instruction_entries,document_package_items,document_packages,professional_review_audit,professional_review_commands,professional_review_cases,formal_matter_audit,formal_matter_commands,formal_matters,matter_drafts,customer_confirmations CASCADE'
    );
    const history = await pool.query<{ migration_history: string | null }>(
      "SELECT to_regclass('markorbit_persistence.migration_history')::text AS migration_history"
    );
    if (history.rows[0]?.migration_history)
      await pool.query(
        "DELETE FROM markorbit_persistence.migration_history WHERE namespace IN ('task025_http_markreg','task025_http_execution')"
      );
    const directory = path.resolve('infrastructure/persistence/migrations');
    const owners = path.resolve('infrastructure/persistence/migration-owners.json');
    await migrate(
      pool,
      'task025_http_markreg',
      await loadMigrationsForOwner(directory, owners, '@markorbit/markreg-service')
    );
    await migrate(
      pool,
      'task025_http_execution',
      await loadMigrationsForOwner(directory, owners, '@markorbit/execution-service')
    );
    await workspaces.create({ workspaceId, name: 'Package HTTP', slug: 'package-http' });
    await workspaces.create({
      workspaceId: otherWorkspaceId,
      name: 'Other Package',
      slug: 'other-package'
    });
    for (const [name, role] of [
      ['admin', 'WORKSPACE_ADMIN'],
      ['manager', 'MATTER_MANAGER'],
      ['reviewer', 'REVIEWER'],
      ['readonly', 'READ_ONLY']
    ] as const) {
      await users.create({
        userId: `user_${name}`,
        email: `${name}@package.test`,
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
      email: 'nonmember@package.test',
      displayName: 'nonmember'
    });
    await memberships.create({
      membershipId: 'membership_admin_other',
      workspaceId: otherWorkspaceId,
      userId: 'user_admin',
      role: 'WORKSPACE_ADMIN'
    });
    await core.start();
    await markregDatabase.close();
    markreg = await constructMarkreg(markregPort);
    await markreg.start();
    execution = createExecution({
      port: 0,
      reviewRepositoryFactory: (workspace) =>
        new PostgresProfessionalReviewRepository(
          executionDatabase,
          executionDatabase.getPool(),
          workspace
        ),
      internalServiceSecret: secret,
      markRegUrl: `http://127.0.0.1:${markregPort}`,
      now: () => at
    });
    await execution.start();
    markregPort = markreg.listeningPort!;
    gateway = createGateway({
      port: 0,
      markRegUrl: `http://127.0.0.1:${markregPort}`,
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
      csrfSecret: 'task-025-http-csrf',
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
  }, 30_000);
  afterAll(async () => {
    await gateway?.stop();
    await execution?.stop();
    await markreg?.stop();
    await core.stop();
    await markregDatabase?.close();
    await executionDatabase.close();
  });

  it('enforces Core Principal permissions, Sessions, origin and Workspace isolation', async () => {
    for (const role of ['admin', 'manager', 'reviewer', 'readonly']) {
      const token = cookies[role]!.match(/mo_session=([^;]+)/)![1]!;
      const principal = await authentication.resolveWorkspacePrincipal(token, workspaceId);
      expect(principal.permissions).toContain('document-package:read');
      expect(principal.permissions).toContain('instruction-ledger:read');
      if (role === 'readonly')
        expect(principal.permissions).not.toContain('document-package:prepare');
      else
        expect(principal.permissions).toEqual(
          expect.arrayContaining([
            'document-package:prepare',
            'instruction-ledger:write',
            'document-package:mark-ready'
          ])
        );
    }
    const source = await createReview('matrix');
    const body = {
      professionalReviewCaseId: source.review.reviewCaseId,
      expectedReviewVersion: source.review.version,
      expectedCompletedDecisionId: source.review.decision.decidedAt,
      expectedCompletedDecisionHash: sha(source.review.decision),
      actorId: 'browser-forged',
      role: 'WORKSPACE_ADMIN',
      permissions: ['document-package:prepare']
    };
    for (const role of ['admin', 'manager', 'reviewer'])
      expect(
        (await request(role, '/api/markreg/document-packages', 'POST', body, `matrix-${role}`))
          .response.status
      ).toBe(200);
    expect(
      (await request('readonly', '/api/markreg/document-packages', 'POST', body, 'matrix-readonly'))
        .response.status
    ).toBe(403);
    expect(
      (
        await fetch(`${base}/api/markreg/document-packages/not-found`, {
          headers: { 'x-markorbit-workspace-id': workspaceId }
        })
      ).status
    ).toBe(401);
    expect(
      (await request('nonmember', '/api/markreg/document-packages/not-found')).response.status
    ).toBe(403);
    const packageId = (
      await request('admin', '/api/markreg/document-packages', 'POST', body, 'matrix-read')
    ).value.documentPackageId;
    const readablePackage = (
      await request('readonly', `/api/markreg/document-packages/${packageId}`)
    ).value;
    expect(readablePackage.createdBy).toBe('user_admin');
    for (const [pathName, method, mutation] of [
      [`/api/markreg/document-packages/${packageId}`, 'PATCH', { expectedVersion: 1, draft: {} }],
      [
        `/api/markreg/document-packages/${packageId}/documents`,
        'POST',
        { expectedVersion: 1, evidence: {} }
      ],
      [
        `/api/markreg/document-packages/${packageId}/instructions`,
        'POST',
        { expectedVersion: 1, instruction: {} }
      ],
      [
        `/api/markreg/document-packages/${packageId}/instructions/missing/supersede`,
        'POST',
        { expectedVersion: 1, instruction: {} }
      ],
      [`/api/markreg/document-packages/${packageId}/mark-ready`, 'POST', { expectedVersion: 1 }]
    ] as const)
      expect(
        (await request('readonly', pathName, method, mutation, `readonly-${pathName}`)).response
          .status
      ).toBe(403);
    expect(
      (await request('readonly', `/api/markreg/document-packages/${packageId}`)).response.status
    ).toBe(200);
    expect(
      (
        await request(
          'admin',
          `/api/markreg/document-packages/${packageId}`,
          'GET',
          undefined,
          undefined,
          otherWorkspaceId
        )
      ).response.status
    ).toBe(404);
    const invalidOrigin = await fetch(`${base}/api/markreg/document-packages`, {
      method: 'POST',
      headers: { ...headers('admin', 'bad-origin'), origin: 'https://evil.test' },
      body: JSON.stringify({ workspaceId, ...body })
    });
    expect(invalidOrigin.status).toBe(403);
    const missingCsrf = await fetch(`${base}/api/markreg/document-packages`, {
      method: 'POST',
      headers: { ...headers('admin', 'missing-csrf'), 'x-markorbit-csrf-token': '' },
      body: JSON.stringify({ workspaceId, ...body })
    });
    expect(missingCsrf.status).toBe(403);
    now = new Date('2030-01-01T00:00:00.000Z');
    expect(
      (await request('admin', `/api/markreg/document-packages/${packageId}`)).response.status
    ).toBe(401);
    now = new Date(at);
  });

  it('persists exact evidence and append-only instructions, enforces conflicts, becomes ready, and survives listener replacement', async () => {
    const flow = await createPackage('durable');
    expect(flow.created.response.status).toBe(200);
    let value = flow.created.value;
    const versions = [value.version];
    const packageId = value.documentPackageId;
    const replay = await request(
      'admin',
      '/api/markreg/document-packages',
      'POST',
      flow.command,
      'package-durable'
    );
    expect(replay.value).toEqual(value);
    const conflict = await request(
      'admin',
      '/api/markreg/document-packages',
      'POST',
      { ...flow.command, expectedReviewVersion: flow.command.expectedReviewVersion - 1 },
      'package-durable'
    );
    expect(conflict.response.status).toBe(409);
    const blockedDocuments = await request(
      'admin',
      `/api/markreg/document-packages/${packageId}/mark-ready`,
      'POST',
      { expectedVersion: value.version },
      'ready-without-documents'
    );
    expect(blockedDocuments.response.status).toBe(422);
    const malformed = await request(
      'admin',
      `/api/markreg/document-packages/${packageId}/documents`,
      'POST',
      {
        expectedVersion: value.version,
        evidence: { requirementKey: value.requirements[0].requirementKey }
      },
      'malformed-evidence'
    );
    expect(malformed.response.status).toBe(400);
    const evidence = {
      requirementKey: value.requirements[0].requirementKey,
      documentType: 'REVIEW_EVIDENCE',
      displayName: value.requirements[0].displayName,
      evidenceType: 'FILE_REFERENCE',
      originalFileName: 'evidence.pdf',
      mediaType: 'application/pdf',
      sizeBytes: 128,
      checksum: 'a'.repeat(64),
      storageReference: 'evidence:durable',
      verificationStatus: 'RECORDED',
      structuredNote: { purpose: 'required' }
    };
    const evidenceResult = await request(
      'admin',
      `/api/markreg/document-packages/${packageId}/documents`,
      'POST',
      { expectedVersion: value.version, evidence },
      'evidence-durable'
    );
    expect(evidenceResult.response.status).toBe(200);
    value = evidenceResult.value;
    versions.push(value.version);
    const blockedInstructions = await request(
      'admin',
      `/api/markreg/document-packages/${packageId}/mark-ready`,
      'POST',
      { expectedVersion: value.version },
      'ready-without-instructions'
    );
    expect(blockedInstructions.response.status).toBe(422);
    const stale = await request(
      'admin',
      `/api/markreg/document-packages/${packageId}`,
      'PATCH',
      { expectedVersion: value.version - 1, draft: { note: 'stale' } },
      'stale-draft'
    );
    expect(stale.response.status).toBe(409);
    const instructionA = {
      instructionType: 'FILING_SCOPE',
      targetJurisdiction: 'US',
      targetClass: 9,
      structuredPayload: { text: 'Instruction A' }
    };
    value = (
      await request(
        'admin',
        `/api/markreg/document-packages/${packageId}/instructions`,
        'POST',
        { expectedVersion: value.version, instruction: instructionA },
        'instruction-a'
      )
    ).value;
    versions.push(value.version);
    const entryA = structuredClone(value.instructionEntries[0]);
    const invalidSupersede = await request(
      'admin',
      `/api/markreg/document-packages/${packageId}/instructions/missing/supersede`,
      'POST',
      { expectedVersion: value.version, instruction: instructionA },
      'invalid-supersede'
    );
    expect(invalidSupersede.response.status).toBe(404);
    const instructionB = { ...instructionA, structuredPayload: { text: 'Instruction B' } };
    const crossPackage = await createPackage('cross-supersede');
    const crossResult = await request(
      'admin',
      `/api/markreg/document-packages/${crossPackage.created.value.documentPackageId}/instructions/${entryA.instructionEntryId}/supersede`,
      'POST',
      { expectedVersion: crossPackage.created.value.version, instruction: instructionB },
      'cross-package-supersede'
    );
    expect(crossResult.response.status).toBe(404);
    value = (
      await request(
        'admin',
        `/api/markreg/document-packages/${packageId}/instructions/${entryA.instructionEntryId}/supersede`,
        'POST',
        { expectedVersion: value.version, instruction: instructionB },
        'instruction-b'
      )
    ).value;
    versions.push(value.version);
    expect(value.instructionEntries[0]).toEqual(entryA);
    expect(value.instructionEntries[1].sequence).toBeGreaterThan(entryA.sequence);
    expect(value.instructionEntries[1].supersedesEntryId).toBe(entryA.instructionEntryId);
    value = (
      await request(
        'admin',
        `/api/markreg/document-packages/${packageId}`,
        'PATCH',
        { expectedVersion: value.version, draft: { note: 'exact durable draft' } },
        'save-durable'
      )
    ).value;
    versions.push(value.version);
    const readyResponse = await request(
      'admin',
      `/api/markreg/document-packages/${packageId}/mark-ready`,
      'POST',
      { expectedVersion: value.version },
      'ready-durable'
    );
    expect(readyResponse.response.status).toBe(200);
    value = readyResponse.value;
    versions.push(value.version);
    expect(value.status).toBe('READY_FOR_PREPARATION_LOCK');
    expect(value.canonicalEvidenceHash).toMatch(/^[0-9a-f]{64}$/);
    versions.slice(1).forEach((version, index) => expect(version).toBe(versions[index]! + 1));
    expect(
      (
        await request(
          'admin',
          `/api/markreg/document-packages/${packageId}/mark-ready`,
          'POST',
          { expectedVersion: versions.at(-2) },
          'ready-durable'
        )
      ).value
    ).toEqual(value);
    for (const [pathName, method, body, key] of [
      [
        `/api/markreg/document-packages/${packageId}`,
        'PATCH',
        { expectedVersion: value.version, draft: {} },
        'ready-draft'
      ],
      [
        `/api/markreg/document-packages/${packageId}/documents`,
        'POST',
        { expectedVersion: value.version, evidence },
        'ready-evidence'
      ],
      [
        `/api/markreg/document-packages/${packageId}/instructions`,
        'POST',
        { expectedVersion: value.version, instruction: instructionA },
        'ready-append'
      ],
      [
        `/api/markreg/document-packages/${packageId}/instructions/${entryA.instructionEntryId}/supersede`,
        'POST',
        { expectedVersion: value.version, instruction: instructionB },
        'ready-supersede'
      ]
    ] as const)
      expect((await request('admin', pathName, method, body, key)).response.status).toBe(409);
    const before = structuredClone(value);
    const pool = markregDatabase.getPool();
    for (const table of [
      'preparation_locks',
      'filing_authorizations',
      'execution_releases',
      'filing_execution_tasks'
    ]) {
      const result = await pool.query<{ name: string | null }>(
        'SELECT to_regclass($1)::text AS name',
        [table]
      );
      expect(result.rows[0]?.name).toBeNull();
    }
    await markreg.stop();
    await markregDatabase.close();
    await expect(fetch(`http://127.0.0.1:${markregPort}/health`)).rejects.toThrow();
    markreg = await constructMarkreg(markregPort);
    await markreg.start();
    const after = await request('admin', `/api/markreg/document-packages/${packageId}`);
    expect(after.response.status).toBe(200);
    expect(after.value).toEqual(before);
  }, 30_000);

  it('rejects incomplete and mismatched Review evidence and maps unavailable dependencies to 503', async () => {
    const incomplete = await createReview('incomplete', false);
    const incompleteResult = await request(
      'admin',
      '/api/markreg/document-packages',
      'POST',
      {
        professionalReviewCaseId: incomplete.review.reviewCaseId,
        expectedReviewVersion: incomplete.review.version,
        expectedCompletedDecisionId: at,
        expectedCompletedDecisionHash: 'b'.repeat(64)
      },
      'incomplete-package'
    );
    expect(incompleteResult.response.status).toBe(409);
    const completed = await createReview('mismatch');
    const mismatch = await request(
      'admin',
      '/api/markreg/document-packages',
      'POST',
      {
        professionalReviewCaseId: completed.review.reviewCaseId,
        expectedReviewVersion: completed.review.version - 1,
        expectedCompletedDecisionId: completed.review.decision.decidedAt,
        expectedCompletedDecisionHash: sha(completed.review.decision)
      },
      'mismatch-package'
    );
    expect(mismatch.response.status).toBe(409);
    const fingerprintMismatch = await request(
      'admin',
      '/api/markreg/document-packages',
      'POST',
      {
        professionalReviewCaseId: completed.review.reviewCaseId,
        expectedReviewVersion: completed.review.version,
        expectedCompletedDecisionId: completed.review.decision.decidedAt,
        expectedCompletedDecisionHash: 'c'.repeat(64)
      },
      'fingerprint-mismatch-package'
    );
    expect(fingerprintMismatch.response.status).toBe(409);
    const executionPort = execution.listeningPort!;
    await execution.stop();
    const unavailableExecution = await request(
      'admin',
      '/api/markreg/document-packages',
      'POST',
      {
        professionalReviewCaseId: completed.review.reviewCaseId,
        expectedReviewVersion: completed.review.version,
        expectedCompletedDecisionId: completed.review.decision.decidedAt,
        expectedCompletedDecisionHash: sha(completed.review.decision)
      },
      'execution-unavailable'
    );
    expect(unavailableExecution.response.status).toBe(503);
    execution = createExecution({
      port: executionPort,
      reviewRepositoryFactory: (workspace) =>
        new PostgresProfessionalReviewRepository(
          executionDatabase,
          executionDatabase.getPool(),
          workspace
        ),
      internalServiceSecret: secret,
      markRegUrl: `http://127.0.0.1:${markregPort}`,
      now: () => at
    });
    await execution.start();
    await markreg.stop();
    expect(
      (await request('admin', '/api/markreg/document-packages/not-found')).response.status
    ).toBe(503);
    markreg = await constructMarkreg(markregPort);
    await markreg.start();
  }, 30_000);
});
