import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { ManagedDatabase } from '../packages/persistence/src/index.js';
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
  hashSnapshot
} from '../services/markreg/src/index.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from '../services/markreg/tests/support/markreg-test-database.js';

const url = process.env.MARKREG_TEST_DATABASE_URL;
if (!url)
  throw new Error('MARKREG_TEST_DATABASE_URL is required for the Lite Matter real runtime.');
const secret = 'task-023-browser-internal-service-secret';
const origin = 'http://127.0.0.1:4471';
process.env.WEB_ORIGINS = origin;
const workspaceId = '66666666-6666-4666-8666-666666666666';
const otherWorkspaceId = '77777777-7777-4777-8777-777777777777';
const at = '2026-07-31T18:00:00.000Z';
const database = new ManagedDatabase({
  connection: { url },
  applicationName: 'lite-matter-browser',
  poolMaximum: 10,
  connectionTimeoutMs: 2000,
  idleTimeoutMs: 2000,
  statementTimeoutMs: 5000,
  sslMode: 'disable',
  migrationNamespace: MARKREG_TEST_MIGRATION_NAMESPACE
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
    now: () => at
  });
let gateway: ReturnType<typeof createGateway>;
let vite: ChildProcess;
async function main() {
  await database.start();
  const pool = database.getPool();
  await resetAndMigrateMarkRegTestDatabase({
    pool,
    migrationsDirectory: path.resolve('infrastructure/persistence/migrations'),
    migrationOwners: path.resolve('infrastructure/persistence/migration-owners.json')
  });
  await workspaces.create({ workspaceId, name: 'Northstar IP', slug: 'northstar-task023' });
  await workspaces.create({
    workspaceId: otherWorkspaceId,
    name: 'Other Workspace',
    slug: 'other-task023'
  });
  await users.create({
    userId: 'user_task023',
    email: 'task023@example.test',
    displayName: 'Task 023 User'
  });
  await memberships.create({
    membershipId: 'membership_task023',
    workspaceId,
    userId: 'user_task023',
    role: 'WORKSPACE_ADMIN'
  });
  await memberships.create({
    membershipId: 'membership_task023_other',
    workspaceId: otherWorkspaceId,
    userId: 'user_task023',
    role: 'READ_ONLY'
  });
  const confirmations = new PostgresCustomerConfirmationRepository(pool),
    drafts = new PostgresMatterDraftRepository(pool);
  const snapshot = {
    schemaVersion: 1 as const,
    quoteId: 'quote_task023',
    quoteVersion: 'quote-v23',
    planId: 'plan_task023',
    planVersion: 'plan-v1',
    currency: 'USD',
    totalMinor: 12300,
    lineItems: [
      { code: 'SERVICE', description: 'Service', category: 'SERVICE_FEE', amountMinor: 12300 }
    ],
    termsVersion: 'terms-v1',
    acknowledgementCodes: ['NO_FILING'],
    selectedOptionCode: 'A',
    recommendationId: 'recommendation_task023',
    assumptions: [],
    limitations: ['No filing']
  };
  const confirmation = {
    confirmationId: 'confirmation_task023',
    workspaceId,
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
  const checks = [
    {
      code: 'CUSTOMER_CONFIRMATION_VALID' as const,
      status: 'PASS' as const,
      explanation: 'Captured at creation.',
      blocking: true
    }
  ];
  const draft = {
    schemaVersion: 1 as const,
    matterDraftId: 'matter-draft_task023',
    workspaceId,
    customerConfirmationId: confirmation.confirmationId,
    customerConfirmationVersion: 1,
    sourceQuoteId: snapshot.quoteId,
    sourceQuoteVersion: snapshot.quoteVersion,
    preparation: {
      applicantName: 'Northstar Holdings',
      applicantAddress: '1 Orbit Way',
      trademark: 'DURABLE ORBIT',
      targetJurisdiction: 'US',
      classes: [9, 35],
      goodsServices: 'Software and business services',
      filingBasis: 'USE',
      representativeRequired: false,
      documentReferences: ['document_task023'],
      commercialScopeUnchanged: true
    },
    instructionCompleteness: 'COMPLETE' as const,
    documentReadiness: 'READY' as const,
    readiness: { evaluatedAt: at, checks, readyForProfessionalReview: true },
    missingInformation: [],
    status: 'READY_FOR_PROFESSIONAL_REVIEW' as const,
    version: 1,
    createdAt: at,
    updatedAt: at
  };
  await drafts.create(draft);
  const service = new FormalMatterService(
    new PostgresFormalMatterRepository(database, pool),
    confirmations,
    drafts,
    () => at
  );
  const principal = {
    kind: 'WORKSPACE' as const,
    userId: 'user_task023',
    sessionId: 'seed',
    sessionExpiresAt: '2030-01-01T00:00:00.000Z',
    workspaceId,
    membershipId: 'membership_task023',
    role: 'WORKSPACE_ADMIN' as const,
    permissions: ['workspace:read', 'matter:read', 'matter:create', 'matter:manage'] as const
  };
  const matter = await service.create(principal, {
    workspaceId,
    customerConfirmationId: confirmation.confirmationId as never,
    expectedCustomerConfirmationVersion: 1,
    matterDraftId: draft.matterDraftId as never,
    expectedMatterDraftVersion: 1,
    idempotencyKey: 'task023-browser'
  });
  await core.start();
  markreg = markregRuntime();
  await markreg.start();
  gateway = createGateway({
    port: 4400,
    markRegUrl: 'http://127.0.0.1:4405',
    authenticationClient: new HttpCoreAuthenticationClient('http://127.0.0.1:4401', secret),
    internalServiceSecret: secret,
    milestoneTestRuntime: true,
    fixtureUsers: { task023: 'user_task023' },
    csrfSecret: 'task-023-browser-csrf-secret',
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
      '4471',
      '--strictPort'
    ],
    { env: { ...process.env, VITE_LITE_GATEWAY_URL: 'http://127.0.0.1:4400' }, stdio: 'inherit' }
  );
  process.stdout.write(
    `TASK023_READY ${JSON.stringify({ workspaceId, otherWorkspaceId, formalMatterId: matter.formalMatterId })}\n`
  );
}
async function stop() {
  vite?.kill('SIGTERM');
  await gateway?.stop();
  await markreg?.stop();
  await core.stop();
  await database.close();
}
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => void stop().finally(() => process.exit(0)));
void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
