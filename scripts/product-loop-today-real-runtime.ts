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
  AccountOnboardingService,
  InMemoryAccountOnboardingRepository
} from '../services/core/src/account-onboarding.js';
import {
  createRuntime as createGateway,
  HttpCoreAuthenticationClient
} from '../apps/gateway/src/index.js';
import { createServiceRuntime } from '../packages/service-kit/src/index.js';
import {
  PostgresLiteContentPreparationStore,
  type ProductLoopSourceAuthority
} from '../services/lite/src/content-preparation.js';
import { PostgresLiteCandidateQualificationStore } from '../services/lite/src/candidate-qualification.js';
import { PostgresProductLoopFeedbackStore } from '../services/lite/src/feedback.js';
import {
  handoffResult,
  PostgresPreparedActionStore,
  PreparedActionJourneyService,
  type PreparedActionHandoffAuthority
} from '../services/lite/src/prepared-action.js';
import { createLiteProductLoopRoutes } from '../services/lite/src/http.js';

const url = process.env.LITE_TODAY_TEST_DATABASE_URL;
if (!url) throw new Error('LITE_TODAY_TEST_DATABASE_URL is required for the Today real runtime.');

const secret = 'wp05-browser-internal-service-secret-32-bytes';
const csrfSecret = 'wp05-browser-csrf-secret-32-bytes-minimum';
const origin = 'http://127.0.0.1:4475';
process.env.WEB_ORIGINS = origin;
const desktopWorkspaceId = '31313131-3131-4313-8313-313131313131';
const mobileWorkspaceId = '32323232-3232-4323-8323-323232323232';
const at = '2026-08-11T11:45:00.000Z';

const database = new ManagedDatabase({
  connection: { url },
  applicationName: 'product-loop-today-browser',
  poolMaximum: 10,
  connectionTimeoutMs: 2000,
  idleTimeoutMs: 2000,
  statementTimeoutMs: 5000,
  sslMode: 'disable',
  migrationNamespace: 'product_loop_today_browser'
});

const users = new InMemoryUserRepository();
const workspaces = new InMemoryWorkspaceRepository();
const memberships = new InMemoryMembershipRepository(users, workspaces);
const sessions = new InMemorySessionRepository();
const auth = new AuthenticationService({
  users,
  workspaces,
  memberships,
  sessions,
  clock: () => new Date(at)
});
const onboarding = new AccountOnboardingService(
  new InMemoryAccountOnboardingRepository(users, workspaces, memberships)
);
const core = createCore({
  port: 4411,
  authentication: auth,
  accountOnboarding: onboarding,
  internalServiceSecret: secret
});
let liteRuntime: ReturnType<typeof createServiceRuntime>;
let gateway: ReturnType<typeof createGateway>;
let vite: ChildProcess;

const sourceAuthority: ProductLoopSourceAuthority = {
  resolve(workspaceId, locator) {
    if (![desktopWorkspaceId, mobileWorkspaceId].includes(workspaceId))
      throw new Error('Unexpected browser Workspace.');
    if (
      locator.owner !== 'KNOWLEDGE' ||
      locator.kind !== 'KNOWLEDGE_READY_PACKAGE' ||
      locator.sourceId !== `rdp_wp05-browser-${workspaceId}`
    )
      throw new Error('Unexpected browser source locator.');
    return Promise.resolve({
      schemaVersion: 1,
      owner: 'KNOWLEDGE',
      kind: 'KNOWLEDGE_READY_PACKAGE',
      sourceId: locator.sourceId,
      sourceVersion: 'accepted-v5',
      sourceFingerprintSha256: workspaceId === desktopWorkspaceId ? 'a'.repeat(64) : 'b'.repeat(64),
      observedAt: at,
      correlationId: `correlation_wp05-${workspaceId}`
    });
  }
};

async function seedWorkspace(
  contentStore: PostgresLiteContentPreparationStore,
  workspaceId: string,
  slug: string
) {
  await workspaces.create({ workspaceId, name: `WP05 ${slug}`, slug });
  await memberships.create({
    membershipId: `membership_${slug}`,
    workspaceId,
    userId: 'user_wp05_browser',
    role: 'WORKSPACE_ADMIN'
  });
  return contentStore.createRecommendation({
    workspaceId,
    title: 'Prepare the reviewed trademark maintenance update',
    explanation:
      'Accepted governed Knowledge changed the timing explanation and is ready for one bounded professional content preparation step.',
    sources: [
      {
        owner: 'KNOWLEDGE',
        kind: 'KNOWLEDGE_READY_PACKAGE',
        sourceId: `rdp_wp05-browser-${workspaceId}`
      }
    ],
    idempotencyKey: `wp05-browser-recommendation-${workspaceId}`
  });
}

async function main() {
  await database.start();
  const pool = database.getPool();
  await pool.query(
    'CREATE TABLE IF NOT EXISTS workspaces (workspace_id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE)'
  );
  await migrate(
    pool,
    'product_loop_today_browser',
    await loadMigrationsForOwner(
      path.resolve('infrastructure/persistence/migrations'),
      path.resolve('infrastructure/persistence/migration-owners.json'),
      '@markorbit/lite-service'
    )
  );
  await pool.query(
    `INSERT INTO workspaces(workspace_id,name,slug) VALUES
      ($1,'WP05 Browser Desktop','wp05-browser-desktop-db'),
      ($2,'WP05 Browser Mobile','wp05-browser-mobile-db')
     ON CONFLICT(workspace_id) DO NOTHING`,
    [desktopWorkspaceId, mobileWorkspaceId]
  );

  await users.create({
    userId: 'user_wp05_browser',
    email: 'wp05-browser@example.test',
    displayName: 'WP05 Browser User'
  });

  const contentStore = new PostgresLiteContentPreparationStore(
    database,
    pool,
    sourceAuthority,
    () => at
  );
  const candidateStore = new PostgresLiteCandidateQualificationStore(
    database,
    pool,
    sourceAuthority,
    { isAccessible: async () => true },
    () => at
  );
  const feedbackStore = new PostgresProductLoopFeedbackStore(database, pool, () => at);
  const preparedStore = new PostgresPreparedActionStore(database, pool, () => at);
  const handoffAuthority: PreparedActionHandoffAuthority = {
    async perform(action, plan, _confirmation, idempotencyKey) {
      if (plan.kind !== 'PREPARE_CONTENT')
        throw new Error('Browser golden path only accepts PREPARE_CONTENT.');
      const opportunity = await contentStore.acceptContentOpportunity({
        workspaceId: action.workspaceId,
        recommendation: {
          id: action.recommendation.id,
          version: Number(action.recommendation.version)
        },
        expectedRecommendationFingerprintSha256: action.recommendationFingerprintSha256,
        title: plan.title,
        rationale: plan.rationale,
        idempotencyKey
      });
      return handoffResult({
        preparedAction: action,
        owner: 'LITE',
        ownerRecord: { id: opportunity.contentOpportunityId, version: opportunity.version },
        completedAt: opportunity.updatedAt
      });
    }
  };

  const desktopRecommendation = await seedWorkspace(
    contentStore,
    desktopWorkspaceId,
    'wp05-browser-desktop'
  );
  const mobileRecommendation = await seedWorkspace(
    contentStore,
    mobileWorkspaceId,
    'wp05-browser-mobile'
  );

  await core.start();
  liteRuntime = createServiceRuntime(
    { name: 'wp05-lite', port: 4417, version: '0.1.0' },
    {
      routes: createLiteProductLoopRoutes({
        internalServiceSecret: secret,
        journeyService: new PreparedActionJourneyService(preparedStore, handoffAuthority),
        candidateStore,
        feedbackStore
      })
    }
  );
  await liteRuntime.start();
  gateway = createGateway({
    port: 4410,
    liteUrl: 'http://127.0.0.1:4417',
    authenticationClient: new HttpCoreAuthenticationClient('http://127.0.0.1:4411', secret),
    internalServiceSecret: secret,
    milestoneTestRuntime: true,
    fixtureUsers: { wp05: 'user_wp05_browser' },
    csrfSecret,
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
      '4475',
      '--strictPort'
    ],
    {
      env: { ...process.env, VITE_LITE_GATEWAY_URL: 'http://127.0.0.1:4410' },
      stdio: 'inherit'
    }
  );

  process.stdout.write(
    `WP05_TODAY_READY ${JSON.stringify({
      desktopWorkspaceId,
      mobileWorkspaceId,
      desktopRecommendationId: desktopRecommendation.todayRecommendationId,
      mobileRecommendationId: mobileRecommendation.todayRecommendationId
    })}\n`
  );
}

async function stop() {
  vite?.kill('SIGTERM');
  await gateway?.stop();
  await liteRuntime?.stop();
  await core.stop();
  await database.close();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => void stop().finally(() => process.exit(0)));

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
