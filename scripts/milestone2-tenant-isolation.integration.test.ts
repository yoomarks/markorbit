import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
  PostgresCustomerConfirmationRepository,
  PostgresDocumentPackageService,
  PostgresFormalMatterRepository,
  PostgresMarkRegAuditRepository,
  PostgresMatterDraftRepository,
  createRuntime as createMarkReg
} from '../services/markreg/dist/index.js';
import {
  PostgresProfessionalReviewRepository,
  createRuntime as createExecution
} from '../services/execution/dist/index.js';
import {
  HttpCoreAuthenticationClient,
  createRuntime as createGateway
} from '../apps/gateway/dist/index.js';

const urls = {
  Core: process.env.MILESTONE2_CORE_DATABASE_URL,
  MarkReg: process.env.MILESTONE2_MARKREG_DATABASE_URL,
  Execution: process.env.MILESTONE2_EXECUTION_DATABASE_URL
} as const;
const required = process.env.MILESTONE2_TENANT_REQUIRED === '1';
if (required)
  for (const [owner, url] of Object.entries(urls))
    if (!url) throw new Error(`MILESTONE2_${owner.toUpperCase()}_DATABASE_URL is required.`);
const suite = Object.values(urls).every(Boolean) ? describe : describe.skip;
const secret = 'task-026-durable-tenant-secret-32-bytes';
const origin = 'https://tenant.test.markorbit.local';
const csrfSecret = 'task-026-durable-tenant-csrf-secret';
const A = 'aaaaaaaa-2600-4aaa-8aaa-aaaaaaaaaaaa',
  B = 'bbbbbbbb-2600-4bbb-8bbb-bbbbbbbbbbbb';
const users = {
  admin: '01900000-0000-7000-8000-260000001001',
  manager: '01900000-0000-7000-8000-260000001002',
  reviewer: '01900000-0000-7000-8000-260000001003',
  reader: '01900000-0000-7000-8000-260000001004',
  nonmember: '01900000-0000-7000-8000-260000001005'
};
const ownerPackage = {
  Core: '@markorbit/core-service',
  MarkReg: '@markorbit/markreg-service',
  Execution: '@markorbit/execution-service'
} as const;
const namespace = {
  Core: 'core_tenant',
  MarkReg: 'markreg_tenant',
  Execution: 'execution_tenant'
} as const;
const ids = (workspace: string, suffix: string) => ({
  matter: `formal-matter_${suffix}`,
  review: `professional-review_${suffix}`,
  package: `document-package_${suffix}`
});

suite.sequential('TASK 026 fully durable multi-tenant authority matrix', () => {
  const db = {} as Record<keyof typeof urls, ManagedDatabase>;
  let core: ReturnType<typeof createCore> | undefined,
    markreg: ReturnType<typeof createMarkReg> | undefined,
    execution: ReturnType<typeof createExecution> | undefined,
    gateway: ReturnType<typeof createGateway> | undefined;
  const cookies: Record<string, string> = {},
    csrf: Record<string, string> = {};
  let expired = '',
    revoked = '';
  const headers = (actor: string, workspace = A) => ({
    cookie: cookies[actor]!,
    'x-markorbit-workspace-id': workspace
  });
  const base = () => `http://127.0.0.1:${gateway!.listeningPort}`;
  const safeStop = async (runtime: { stop(): Promise<void> } | undefined) => {
    if (runtime) await runtime.stop().catch(() => undefined);
  };
  beforeAll(async () => {
    for (const owner of Object.keys(urls) as (keyof typeof urls)[]) {
      db[owner] = new ManagedDatabase(
        parseDatabaseConfig({
          NODE_ENV: 'test',
          DATABASE_URL: urls[owner],
          DB_MIGRATION_NAMESPACE: namespace[owner],
          DB_APPLICATION_NAME: `task-026-tenant-${owner.toLowerCase()}`
        })
      );
      await db[owner].start();
    }
    await db.Core.getPool().query(
      'DROP TABLE IF EXISTS knowledge_v2_deliveries,knowledge_intake_contents,knowledge_intakes,password_credentials,account_profiles,sessions,workspace_memberships,workspaces,users CASCADE; DROP SCHEMA IF EXISTS markorbit_persistence CASCADE'
    );
    await db.MarkReg.getPool().query(
      'DROP TABLE IF EXISTS markreg_recommended_action_commands,markreg_recommended_action_audit,markreg_recommended_actions,markreg_lifecycle_commands,markreg_lifecycle_views,markreg_lifecycle_events,order_audit,order_commands,orders,markreg_denial_audit,document_package_audit,document_package_commands,document_instruction_entries,document_package_items,document_packages,formal_matter_audit,formal_matter_commands,formal_matters,matter_drafts,customer_confirmations CASCADE; DROP FUNCTION IF EXISTS reject_markreg_audit_mutation() CASCADE; DROP SCHEMA IF EXISTS markorbit_persistence CASCADE'
    );
    await db.Execution.getPool().query(
      'DROP TABLE IF EXISTS execution_reviewed_source_handoff_audit,execution_reviewed_source_handoffs,execution_reviewed_source_admission_commands,execution_reviewed_source_admissions,execution_evidence_review_audit,execution_evidence_review_commands,execution_evidence_correction_requests,execution_evidence_review_decisions,execution_evidence_review_sources,execution_provider_return_evidence_audit,execution_provider_return_evidence_commands,execution_provider_return_evidence_receipts,filing_execution_task_drafts,execution_releases,filing_authorizations,filing_governance_commands,filing_governance_audit,professional_review_audit,professional_review_commands,professional_review_cases CASCADE; DROP FUNCTION IF EXISTS reject_execution_evidence_review_audit_mutation() CASCADE; DROP FUNCTION IF EXISTS reject_execution_provider_return_evidence_audit_mutation() CASCADE; DROP FUNCTION IF EXISTS reject_filing_governance_audit_mutation() CASCADE; DROP SCHEMA IF EXISTS markorbit_persistence CASCADE'
    );
    const directory = path.resolve('infrastructure/persistence/migrations'),
      owners = path.resolve('infrastructure/persistence/migration-owners.json');
    for (const owner of Object.keys(urls) as (keyof typeof urls)[]) {
      const loaded = await loadMigrationsForOwner(directory, owners, ownerPackage[owner]);
      await migrate(db[owner].getPool(), namespace[owner], loaded);
      await verifyMigrations(db[owner].getPool(), namespace[owner], loaded);
    }
    const ur = new PostgresUserRepository(db.Core.getPool()),
      wr = new PostgresWorkspaceRepository(db.Core.getPool()),
      mr = new PostgresMembershipRepository(db.Core.getPool());
    await wr.create({ workspaceId: A, name: 'Workspace A', slug: 'workspace-a' });
    await wr.create({ workspaceId: B, name: 'Workspace B', slug: 'workspace-b' });
    for (const [name, id] of Object.entries(users))
      await ur.create({ userId: id, email: `${name}@tenant.test`, displayName: name });
    for (const [name, role] of [
      ['admin', 'WORKSPACE_ADMIN'],
      ['manager', 'MATTER_MANAGER'],
      ['reviewer', 'REVIEWER'],
      ['reader', 'READ_ONLY']
    ] as const)
      await mr.create({
        membershipId: `01900000-0000-7000-8000-26000000200${Object.keys(users).indexOf(name) + 1}`,
        workspaceId: A,
        userId: users[name],
        role
      });
    await mr.create({
      membershipId: '01900000-0000-7000-8000-260000002009',
      workspaceId: B,
      userId: users.manager,
      role: 'MATTER_MANAGER'
    });
    await mr.create({
      membershipId: '01900000-0000-7000-8000-260000002010',
      workspaceId: B,
      userId: users.admin,
      role: 'READ_ONLY'
    });
    const authentication = new AuthenticationService({
      sessions: new PostgresSessionRepository(db.Core.getPool()),
      users: ur,
      workspaces: wr,
      memberships: mr
    });
    core = createCore({ port: 0, authentication, internalServiceSecret: secret });
    await core.start();
    const markregPool = db.MarkReg.getPool();
    const packageService = new PostgresDocumentPackageService(db.MarkReg, markregPool, {
      get: () => Promise.reject(new Error('not used by tenant read matrix'))
    });
    markreg = createMarkReg({
      port: 0,
      customerConfirmationRepository: new PostgresCustomerConfirmationRepository(markregPool),
      matterDraftRepository: new PostgresMatterDraftRepository(markregPool),
      formalMatterRepository: new PostgresFormalMatterRepository(db.MarkReg, markregPool),
      documentPackageService: packageService,
      auditRepository: new PostgresMarkRegAuditRepository(markregPool),
      internalServiceSecret: secret
    });
    await markreg.start();
    execution = createExecution({
      port: 0,
      reviewRepositoryFactory: (workspace) =>
        new PostgresProfessionalReviewRepository(db.Execution, db.Execution.getPool(), workspace),
      internalServiceSecret: secret,
      markRegUrl: `http://127.0.0.1:${markreg.listeningPort}`
    });
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
      fixtureUsers: users,
      csrfSecret,
      allowedOrigins: [origin]
    });
    await gateway.start();
    for (const name of Object.keys(users)) {
      const boot = await fetch(`${base()}/__test/auth/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fixture: name })
      });
      cookies[name] = boot.headers.get('set-cookie')!;
      const session = await fetch(`${base()}/api/auth/session`, {
        headers: { cookie: cookies[name]! }
      });
      csrf[name] = ((await session.json()) as { csrfToken: string }).csrfToken;
    }
    const expiredAuth = new AuthenticationService({
      sessions: new PostgresSessionRepository(db.Core.getPool()),
      users: ur,
      workspaces: wr,
      memberships: mr,
      clock: () => new Date('2020-01-01'),
      tokenGenerator: () => 'e'.repeat(43)
    });
    expired = (await expiredAuth.issueSession(users.admin, 300)).rawToken;
    const revokedIssued = await authentication.issueSession(users.admin);
    await authentication.revokeCurrentSession(revokedIssued.session.sessionId);
    revoked = revokedIssued.rawToken;
    for (const [workspace, label] of [
      [A, 'a'],
      [B, 'b']
    ] as const)
      for (let n = 1; n <= 3; n++) {
        const value = ids(workspace, `${label}${n}`),
          hash = (label === 'a' ? 'a' : 'b').repeat(64),
          at = `2026-08-02T00:00:0${n}.000Z`;
        const sourceSnapshot = {
          schemaVersion: 1,
          customerConfirmation: {
            id: `confirmation_${label}${n}`,
            version: 1,
            status: 'CONFIRMED'
          },
          quote: {
            id: `quote_${label}${n}`,
            version: '1',
            currency: 'USD',
            totalMinor: 100
          },
          matterDraft: {
            id: `draft_${label}${n}`,
            version: 1,
            status: 'READY_FOR_PROFESSIONAL_REVIEW',
            readiness: {
              evaluatedAt: at,
              checks: [],
              readyForProfessionalReview: true
            }
          },
          preparation: {
            applicantName: `Tenant ${label.toUpperCase()} Applicant`,
            applicantAddress: `${n} Orbit Way`,
            trademark: `TENANT ${label.toUpperCase()} ${n}`,
            targetJurisdiction: 'US',
            classes: [9],
            goodsServices: 'Software',
            filingBasis: 'USE',
            representativeRequired: false,
            documentReferences: [`document_${label}${n}`],
            commercialScopeUnchanged: true
          }
        };
        await db.MarkReg.getPool().query(
          "INSERT INTO formal_matters(formal_matter_id,workspace_id,kind,status,version,source_customer_confirmation_id,source_customer_confirmation_version,source_matter_draft_id,source_matter_draft_version,source_quote_id,source_quote_version,source_snapshot,snapshot_schema_version,snapshot_sha256,created_by_user_id,created_at,updated_at) VALUES($1,$2,'TRADEMARK_REGISTRATION','OPEN',1,$3,1,$4,1,$5,'1',$6,1,$7,$8,$9,$9)",
          [
            value.matter,
            workspace,
            `confirmation_${label}${n}`,
            `draft_${label}${n}`,
            `quote_${label}${n}`,
            JSON.stringify(sourceSnapshot),
            hash,
            users.admin,
            at
          ]
        );
        await db.MarkReg.getPool().query(
          "INSERT INTO formal_matter_audit(workspace_id,formal_matter_id,action,actor_id,created_at) VALUES($1,$2,'FORMAL_MATTER_CREATED',$3,$4)",
          [workspace, value.matter, users.admin, at]
        );
        const review = {
          reviewCaseId: value.review,
          workspaceId: workspace,
          formalMatterId: value.matter,
          sourceFormalMatterVersion: 1,
          sourceSnapshotSha256: hash,
          status: 'IN_REVIEW',
          version: 1,
          requestedBy: users.admin,
          createdAt: at,
          updatedAt: at,
          source: { matterDraftId: `draft_${label}${n}`, matterDraftVersion: '1' }
        };
        await db.Execution.getPool().query(
          "INSERT INTO professional_review_cases(professional_review_case_id,workspace_id,formal_matter_id,source_formal_matter_version,source_snapshot_sha256,status,version,review_case,created_by,updated_by,created_at,updated_at) VALUES($1,$2,$3,1,$4,'IN_REVIEW',1,$5,$6,$6,$7,$7)",
          [value.review, workspace, value.matter, hash, review, users.admin, at]
        );
        await db.MarkReg.getPool().query(
          "INSERT INTO document_packages(document_package_id,workspace_id,formal_matter_id,source_formal_matter_version,source_formal_matter_sha256,professional_review_case_id,source_review_version,source_completed_decision_id,source_completed_decision_sha256,status,version,package_data,created_by,updated_by,created_at,updated_at) VALUES($1,$2,$3,1,$4,$5,1,$6,$4,'DRAFT',1,$7,$8,$8,$9,$9)",
          [
            value.package,
            workspace,
            value.matter,
            hash,
            value.review,
            `decision_${label}${n}`,
            { requirements: [], draft: { label } },
            users.admin,
            at
          ]
        );
      }
  });
  afterAll(async () => {
    await safeStop(gateway);
    await safeStop(execution);
    await safeStop(markreg);
    await safeStop(core);
    for (const owner of ['Execution', 'MarkReg', 'Core'] as const)
      await db[owner]?.close().catch(() => undefined);
  });
  it('TEN-001 returns exact Workspace-scoped Formal Matter, Review, Package and audit lists', async () => {
    for (const [workspace, label] of [
      [A, 'a'],
      [B, 'b']
    ] as const) {
      const h = headers(label === 'a' ? 'admin' : 'manager', workspace);
      for (const [path, key, prefix] of [
        ['/api/markreg/formal-matters?page=1&pageSize=10', 'items', 'formal-matter_'],
        ['/api/lite/professional-review-cases', 'reviewCases', 'professional-review_'],
        ['/api/markreg/document-packages', 'documentPackages', 'document-package_'],
        ['/api/markreg/audit-records?limit=10', 'records', '']
      ] as const) {
        const response = await fetch(`${base()}${path}`, { headers: h });
        expect(response.status).toBe(200);
        const body = (await response.json()) as any;
        expect(JSON.stringify(body)).not.toContain(`${label === 'a' ? 'b' : 'a'}1`);
        if (prefix)
          expect(
            (body[key] as any[])
              .map((v) =>
                Object.values(v).find((x) => typeof x === 'string' && x.startsWith(prefix))
              )
              .filter(Boolean)
          ).toHaveLength(3);
      }
    }
  });
  it('TEN-002 conceals exact cross-Workspace reads without identity or hash leakage', async () => {
    for (const path of [
      `/api/markreg/formal-matters/${ids(B, 'b1').matter}`,
      `/api/lite/professional-review-cases/${ids(B, 'b1').review}`,
      `/api/markreg/document-packages/${ids(B, 'b1').package}`
    ]) {
      const response = await fetch(`${base()}${path}`, { headers: headers('admin', A) });
      expect([403, 404]).toContain(response.status);
      expect(JSON.stringify(await response.json())).not.toMatch(/bbbbbbbb|b{64}|b1/iu);
    }
  });
  it('TEN-003 rejects cross-Workspace Review, Package and Instruction mutations with unchanged counts', async () => {
    const before = await Promise.all([
      db.Execution.getPool().query(
        'SELECT version FROM professional_review_cases WHERE professional_review_case_id=$1',
        [ids(B, 'b1').review]
      ),
      db.MarkReg.getPool().query(
        'SELECT version FROM document_packages WHERE document_package_id=$1',
        [ids(B, 'b1').package]
      ),
      db.MarkReg.getPool().query(
        'SELECT count(*)::int AS count FROM document_instruction_entries WHERE document_package_id=$1',
        [ids(B, 'b1').package]
      )
    ]);
    const common = {
      ...headers('admin', A),
      origin,
      'x-markorbit-csrf-token': csrf.admin,
      'content-type': 'application/json',
      'idempotency-key': 'tenant-cross-workspace'
    };
    for (const [path, method, body] of [
      [
        `/api/lite/professional-review-cases/${ids(B, 'b1').review}/claim`,
        'POST',
        JSON.stringify({ workspaceId: A, expectedVersion: 1 })
      ],
      [
        `/api/markreg/document-packages/${ids(B, 'b1').package}`,
        'PATCH',
        JSON.stringify({ workspaceId: A, expectedVersion: 1, draft: { forged: true } })
      ],
      [
        `/api/markreg/document-packages/${ids(B, 'b1').package}/instructions`,
        'POST',
        JSON.stringify({
          workspaceId: A,
          expectedVersion: 1,
          instruction: {
            instructionType: 'FILING_SCOPE',
            structuredPayload: { probe: 'cross-workspace' }
          }
        })
      ]
    ] as const)
      expect([403, 404]).toContain(
        (await fetch(`${base()}${path}`, { method, headers: common, body })).status
      );
    const after = await Promise.all([
      db.Execution.getPool().query(
        'SELECT version FROM professional_review_cases WHERE professional_review_case_id=$1',
        [ids(B, 'b1').review]
      ),
      db.MarkReg.getPool().query(
        'SELECT version FROM document_packages WHERE document_package_id=$1',
        [ids(B, 'b1').package]
      ),
      db.MarkReg.getPool().query(
        'SELECT count(*)::int AS count FROM document_instruction_entries WHERE document_package_id=$1',
        [ids(B, 'b1').package]
      )
    ]);
    expect(after.map((x) => x.rows)).toEqual(before.map((x) => x.rows));
  });
  it('TEN-004 ignores forged actor, Membership, role, permission and body/query Workspace authority', async () => {
    const response = await fetch(
      `${base()}/api/markreg/formal-matters?workspaceId=${B}&actorId=forged&role=WORKSPACE_ADMIN&permissions=audit:read`,
      {
        headers: {
          ...headers('reviewer', A),
          'x-markorbit-actor-id': 'forged',
          'x-markorbit-membership-id': 'forged',
          'x-markorbit-role': 'WORKSPACE_ADMIN',
          'x-markorbit-permissions': 'audit:read'
        }
      }
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toMatch(/formal-matter_b/);
    expect(
      (
        await fetch(`${base()}/api/markreg/audit-records?workspaceId=${B}`, {
          headers: { ...headers('reviewer', A), 'x-markorbit-permissions': 'audit:read' }
        })
      ).status
    ).toBe(403);
  });
  it('TEN-005 enforces durable anonymous, invalid, expired, revoked, non-member and permission state across Core restart', async () => {
    const path = `${base()}/api/markreg/formal-matters`;
    expect((await fetch(path, { headers: { 'x-markorbit-workspace-id': A } })).status).toBe(401);
    for (const token of ['invalid', expired, revoked])
      expect(
        (
          await fetch(path, {
            headers: { cookie: `mo_session=${token}`, 'x-markorbit-workspace-id': A }
          })
        ).status
      ).toBe(401);
    expect([401, 403]).toContain((await fetch(path, { headers: headers('nonmember', A) })).status);
    const port = core!.listeningPort;
    await core!.stop();
    core = createCore({
      port,
      authentication: new AuthenticationService({
        sessions: new PostgresSessionRepository(db.Core.getPool()),
        users: new PostgresUserRepository(db.Core.getPool()),
        workspaces: new PostgresWorkspaceRepository(db.Core.getPool()),
        memberships: new PostgresMembershipRepository(db.Core.getPool())
      }),
      internalServiceSecret: secret
    });
    await core.start();
    expect((await fetch(path, { headers: headers('admin', A) })).status).toBe(200);
    for (const token of [expired, revoked])
      expect(
        (
          await fetch(path, {
            headers: { cookie: `mo_session=${token}`, 'x-markorbit-workspace-id': A }
          })
        ).status
      ).toBe(401);
  });
  it('TEN-006 enforces durable audit:read roles and Workspace-scoped success/denial pagination', async () => {
    for (const [actor, status] of [
      ['admin', 200],
      ['manager', 200],
      ['reviewer', 403],
      ['reader', 403]
    ] as const) {
      const response = await fetch(`${base()}/api/markreg/audit-records?limit=2`, {
        headers: { ...headers(actor, A), 'x-markorbit-permissions': 'audit:read' }
      });
      expect(response.status).toBe(status);
      if (status === 200)
        expect(JSON.stringify(await response.json())).not.toContain('formal-matter_b');
    }
    expect(
      (await fetch(`${base()}/api/markreg/audit-records`, { headers: headers('nonmember', A) }))
        .status
    ).toBe(403);
    expect(
      (
        await fetch(`${base()}/api/markreg/audit-records`, {
          headers: { 'x-markorbit-workspace-id': A }
        })
      ).status
    ).toBe(401);
  });
  it('TEN-007 traverses interleaved pages exactly once and rejects invalid filters without Workspace escape', async () => {
    const seen: string[] = [];
    for (let page = 1; page <= 2; page++) {
      const response = await fetch(`${base()}/api/markreg/formal-matters?page=${page}&pageSize=2`, {
        headers: headers('admin', A)
      });
      expect(response.status).toBe(200);
      seen.push(...((await response.json()) as any).items.map((x: any) => x.formalMatterId));
    }
    expect(new Set(seen)).toEqual(
      new Set(['formal-matter_a1', 'formal-matter_a2', 'formal-matter_a3'])
    );
    expect(seen.every((x) => !x.includes('_b'))).toBe(true);
    expect(
      (
        await fetch(`${base()}/api/markreg/formal-matters?page=bad`, {
          headers: headers('admin', A)
        })
      ).status
    ).toBe(400);
    const contextA = (await (
      await fetch(`${base()}/api/workspaces/${A}/context`, { headers: { cookie: cookies.admin } })
    ).json()) as any;
    const contextB = (await (
      await fetch(`${base()}/api/workspaces/${B}/context`, { headers: { cookie: cookies.admin } })
    ).json()) as any;
    expect(contextA.role).toBe('WORKSPACE_ADMIN');
    expect(contextB.role).toBe('READ_ONLY');
    expect(
      (
        await fetch(`${base()}/api/markreg/formal-matters/${ids(A, 'a1').matter}`, {
          headers: headers('admin', B)
        })
      ).status
    ).toBe(404);
  });
  it('proves physical owner schema separation', async () => {
    const tables = async (owner: keyof typeof db) =>
      (
        await db[owner]
          .getPool()
          .query<{ name: string }>(
            "SELECT tablename AS name FROM pg_tables WHERE schemaname='public'"
          )
      ).rows.map((x) => x.name);
    expect(await tables('Core')).toEqual(expect.arrayContaining(['users', 'sessions']));
    expect(await tables('Core')).not.toEqual(
      expect.arrayContaining(['formal_matters', 'professional_review_cases'])
    );
    expect(await tables('MarkReg')).not.toContain('professional_review_cases');
    expect(await tables('Execution')).not.toContain('formal_matters');
  });
});
