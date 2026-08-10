import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import {
  ManagedDatabase,
  loadMigrationsForOwner,
  migrate
} from '../packages/persistence/src/index.js';
import {
  AuthenticationService,
  InMemoryMembershipRepository,
  InMemorySessionRepository,
  InMemoryUserRepository,
  InMemoryWorkspaceRepository,
  createRuntime as createCore
} from '../services/core/src/index.js';
import {
  createRuntime as createGateway,
  HttpCoreAuthenticationClient
} from '../apps/gateway/src/index.js';
import {
  createRuntime as createMarkReg,
  FormalMatterService,
  PostgresCustomerConfirmationRepository,
  PostgresMatterDraftRepository,
  PostgresFormalMatterRepository,
  PostgresDocumentPackageService,
  hashSnapshot
} from '../services/markreg/src/index.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from '../services/markreg/tests/support/markreg-test-database.js';
import {
  createRuntime as createExecution,
  PostgresProfessionalReviewRepository
} from '../services/execution/src/index.js';
import {
  encodeInternalWorkspacePrincipal,
  type ProfessionalReviewCase
} from '../packages/contracts/src/index.js';

const markregUrl = process.env.MARKREG_TEST_DATABASE_URL;
const executionUrl = process.env.EXECUTION_TEST_DATABASE_URL;
if (!markregUrl)
  throw new Error('MARKREG_TEST_DATABASE_URL is required for the Document Package real runtime.');
if (!executionUrl)
  throw new Error('EXECUTION_TEST_DATABASE_URL is required for the Document Package real runtime.');
const secret = 'task-024-browser-internal-service-secret';
const origin = 'http://127.0.0.1:4481';
process.env.WEB_ORIGINS = origin;
const scenarios = [
  {
    name: 'desktop',
    workspaceId: '66666666-6666-4666-8666-666666666666',
    otherWorkspaceId: '77777777-7777-4777-8777-777777777777'
  },
  {
    name: 'mobile',
    workspaceId: '88888888-8888-4888-8888-888888888888',
    otherWorkspaceId: '99999999-9999-4999-8999-999999999999'
  }
] as const;
const at = '2026-07-31T18:00:00.000Z';
const database = new ManagedDatabase({
  connection: { url: markregUrl },
  applicationName: 'lite-matter-browser',
  poolMaximum: 10,
  connectionTimeoutMs: 2000,
  idleTimeoutMs: 2000,
  statementTimeoutMs: 5000,
  sslMode: 'disable',
  migrationNamespace: MARKREG_TEST_MIGRATION_NAMESPACE
});
const executionDatabase = new ManagedDatabase({
  connection: { url: executionUrl },
  applicationName: 'document-package-browser-execution',
  poolMaximum: 10,
  connectionTimeoutMs: 2000,
  idleTimeoutMs: 2000,
  statementTimeoutMs: 5000,
  sslMode: 'disable',
  migrationNamespace: 'document_package_browser_execution'
});
const users = new InMemoryUserRepository(),
  workspaces = new InMemoryWorkspaceRepository(),
  memberships = new InMemoryMembershipRepository(users, workspaces),
  sessions = new InMemorySessionRepository();
const auth = new AuthenticationService({
  users,
  workspaces,
  memberships,
  sessions,
  clock: () => new Date(at)
});
const core = createCore({ port: 4401, authentication: auth, internalServiceSecret: secret });
let markreg: ReturnType<typeof createMarkReg>;
const markregRuntime = () =>
  createMarkReg({
    port: 4405,
    customerConfirmationRepository: new PostgresCustomerConfirmationRepository(database.getPool()),
    matterDraftRepository: new PostgresMatterDraftRepository(database.getPool()),
    formalMatterRepository: new PostgresFormalMatterRepository(database, database.getPool()),
    internalServiceSecret: secret,
    executionUrl: 'http://127.0.0.1:4404',
    documentPackageService: new PostgresDocumentPackageService(database, database.getPool(), {
      async get(principal, reviewCaseId, correlationId) {
        const response = await fetch(
          `http://127.0.0.1:4404/v1/professional-review-cases/${encodeURIComponent(reviewCaseId)}`,
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
      }
    }),
    now: () => at
  });
let gateway: ReturnType<typeof createGateway>;
let execution: ReturnType<typeof createExecution>;
let vite: ChildProcess;
async function main() {
  await Promise.all([database.start(), executionDatabase.start()]);
  const pool = database.getPool();
  const executionPool = executionDatabase.getPool();
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
      "DELETE FROM markorbit_persistence.migration_history WHERE namespace = 'document_package_browser_execution'"
    );
  await resetAndMigrateMarkRegTestDatabase({
    pool,
    migrationsDirectory: path.resolve('infrastructure/persistence/migrations'),
    migrationOwners: path.resolve('infrastructure/persistence/migration-owners.json')
  });
  const executionOwned = await loadMigrationsForOwner(
    path.resolve('infrastructure/persistence/migrations'),
    path.resolve('infrastructure/persistence/migration-owners.json'),
    '@markorbit/execution-service'
  );
  await migrate(executionPool, 'document_package_browser_execution', executionOwned);
  const confirmations = new PostgresCustomerConfirmationRepository(pool);
  const drafts = new PostgresMatterDraftRepository(pool);
  const formalMatters = new FormalMatterService(
    new PostgresFormalMatterRepository(database, pool),
    confirmations,
    drafts,
    () => at
  );
  const matters: Record<string, string> = {};
  for (const scenario of scenarios) {
    const suffix = `task025_${scenario.name}`;
    const userId = `user_${suffix}`;
    const membershipId = `membership_${suffix}`;
    await workspaces.create({
      workspaceId: scenario.workspaceId,
      name: `Professional Review ${scenario.name}`,
      slug: `professional-review-${scenario.name}`
    });
    await workspaces.create({
      workspaceId: scenario.otherWorkspaceId,
      name: `Other ${scenario.name}`,
      slug: `other-${scenario.name}`
    });
    await users.create({
      userId,
      email: `${suffix}@example.test`,
      displayName: `Task 025 ${scenario.name}`
    });
    await memberships.create({
      membershipId,
      workspaceId: scenario.workspaceId,
      userId,
      role: 'WORKSPACE_ADMIN'
    });
    await memberships.create({
      membershipId: `${membershipId}_other`,
      workspaceId: scenario.otherWorkspaceId,
      userId,
      role: 'READ_ONLY'
    });
    const snapshot = {
      schemaVersion: 1 as const,
      quoteId: `quote_${suffix}`,
      quoteVersion: 'quote-v24',
      planId: `plan_${suffix}`,
      planVersion: 'plan-v1',
      currency: 'USD',
      totalMinor: 12300,
      lineItems: [
        { code: 'SERVICE', description: 'Service', category: 'SERVICE_FEE', amountMinor: 12300 }
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
      workspaceId: scenario.workspaceId,
      sourceQuoteId: snapshot.quoteId,
      sourceQuoteVersion: snapshot.quoteVersion,
      status: 'CONFIRMED' as const,
      version: 1,
      snapshotSchemaVersion: 1 as const,
      sourceSnapshot: snapshot,
      sourceSnapshotHash: hashSnapshot(snapshot),
      acceptedAt: at,
      updatedAt: at,
      withdrawnAt: null
    };
    await confirmations.create(confirmation);
    const draft = {
      schemaVersion: 1 as const,
      matterDraftId: `matter-draft_${suffix}`,
      workspaceId: scenario.workspaceId,
      customerConfirmationId: confirmation.confirmationId,
      customerConfirmationVersion: 1,
      sourceQuoteId: snapshot.quoteId,
      sourceQuoteVersion: snapshot.quoteVersion,
      preparation: {
        applicantName: 'Northstar Holdings',
        applicantAddress: '1 Orbit Way',
        trademark: `DURABLE ORBIT ${scenario.name.toUpperCase()}`,
        targetJurisdiction: 'US',
        classes: [9, 35],
        goodsServices: 'Software and business services',
        filingBasis: 'USE',
        representativeRequired: false,
        documentReferences: [`document_${suffix}`],
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
            explanation: 'Captured at creation.',
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
    const matter = await formalMatters.create(
      {
        kind: 'WORKSPACE' as const,
        userId,
        sessionId: 'seed',
        sessionExpiresAt: '2030-01-01T00:00:00.000Z',
        workspaceId: scenario.workspaceId,
        membershipId,
        role: 'WORKSPACE_ADMIN' as const,
        permissions: ['workspace:read', 'matter:read', 'matter:create', 'matter:manage'] as const
      },
      {
        workspaceId: scenario.workspaceId,
        customerConfirmationId: confirmation.confirmationId as never,
        expectedCustomerConfirmationVersion: 1,
        matterDraftId: draft.matterDraftId as never,
        expectedMatterDraftVersion: 1,
        idempotencyKey: `formal-${suffix}`
      }
    );
    matters[scenario.name] = matter.formalMatterId;
  }
  await core.start();
  markreg = markregRuntime();
  await markreg.start();
  execution = createExecution({
    port: 4404,
    reviewRepositoryFactory: (workspace) =>
      new PostgresProfessionalReviewRepository(executionDatabase, executionPool, workspace),
    internalServiceSecret: secret,
    markRegUrl: 'http://127.0.0.1:4405',
    now: () => at
  });
  await execution.start();
  gateway = createGateway({
    port: 4400,
    markRegUrl: 'http://127.0.0.1:4405',
    executionUrl: 'http://127.0.0.1:4404',
    authenticationClient: new HttpCoreAuthenticationClient('http://127.0.0.1:4401', secret),
    internalServiceSecret: secret,
    milestoneTestRuntime: true,
    fixtureUsers: { task025Desktop: 'user_task025_desktop', task025Mobile: 'user_task025_mobile' },
    csrfSecret: 'task-024-browser-csrf-secret',
    allowedOrigins: [origin]
  });
  await gateway.start();
  vite = spawn(
    'pnpm',
    [
      '--filter',
      '@markorbit/lite-web',
      'dev',
      '--host',
      '127.0.0.1',
      '--port',
      '4481',
      '--strictPort'
    ],
    { env: { ...process.env, VITE_LITE_GATEWAY_URL: 'http://127.0.0.1:4400' }, stdio: 'inherit' }
  );
  process.stdout.write(`TASK025_READY ${JSON.stringify({ scenarios, matters })}\n`);
}
async function stop() {
  vite?.kill('SIGTERM');
  await gateway?.stop();
  await execution?.stop();
  await markreg?.stop();
  await core.stop();
  await Promise.all([database.close(), executionDatabase.close()]);
}
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => void stop().finally(() => process.exit(0)));
void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
