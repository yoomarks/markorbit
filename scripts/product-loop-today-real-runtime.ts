import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import type { DailySignal } from '../packages/contracts/src/daily-workspace.js';
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
  ContentKitService,
  PostgresContentKitLifecycleReader
} from '../services/lite/src/content-kit.js';
import { createContentKitRoutes } from '../services/lite/src/content-kit-http.js';
import {
  PostgresLiteContentPreparationStore,
  type ProductLoopSourceAuthority
} from '../services/lite/src/content-preparation.js';
import { PostgresLiteCandidateQualificationStore } from '../services/lite/src/candidate-qualification.js';
import { PostgresProductConversionAnalyticsStore } from '../services/lite/src/conversion-analytics.js';
import {
  DailyOrbitService,
  NoCreatorPreferenceProvider,
  PostgresDailySignalReader
} from '../services/lite/src/daily-orbit.js';
import { PostgresProductLoopFeedbackStore } from '../services/lite/src/feedback.js';
import {
  handoffResult,
  PostgresPreparedActionStore,
  PreparedActionJourneyService,
  type PreparedActionHandoffAuthority
} from '../services/lite/src/prepared-action.js';
import { createLiteProductLoopRoutes } from '../services/lite/src/http.js';
import {
  PostgresVisualBridgeStore,
  UnavailableVisualEngineConsumer,
  VisualBridgeService
} from '../services/lite/src/visual-bridge.js';
import { createVisualBridgeRoutes } from '../services/lite/src/visual-bridge-http.js';

const url = process.env.LITE_TODAY_TEST_DATABASE_URL;
if (!url) throw new Error('LITE_TODAY_TEST_DATABASE_URL is required for the Today real runtime.');

const secret = 'wp06-browser-internal-service-secret-32-bytes';
const csrfSecret = 'wp06-browser-csrf-secret-32-bytes-minimum';
const origin = 'http://127.0.0.1:4475';
process.env.WEB_ORIGINS = origin;
const desktopWorkspaceId = '31313131-3131-4313-8313-313131313131';
const mobileWorkspaceId = '32323232-3232-4323-8323-323232323232';
const at = '2026-08-18T08:15:00.000Z';

const database = new ManagedDatabase({
  connection: { url },
  applicationName: 'daily-workspace-browser',
  poolMaximum: 10,
  connectionTimeoutMs: 2000,
  idleTimeoutMs: 2000,
  statementTimeoutMs: 5000,
  sslMode: 'disable',
  migrationNamespace: 'daily_workspace_browser'
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

function sourceFingerprint(workspaceId: string) {
  return workspaceId === desktopWorkspaceId ? 'a'.repeat(64) : 'b'.repeat(64);
}

const sourceAuthority: ProductLoopSourceAuthority = {
  resolve(workspaceId, locator) {
    if (![desktopWorkspaceId, mobileWorkspaceId].includes(workspaceId))
      throw new Error('Unexpected browser Workspace.');
    if (
      locator.owner !== 'KNOWLEDGE' ||
      locator.kind !== 'KNOWLEDGE_READY_PACKAGE' ||
      locator.sourceId !== `rdp_wp06-browser-${workspaceId}`
    )
      throw new Error('Unexpected browser source locator.');
    return Promise.resolve({
      schemaVersion: 1,
      owner: 'KNOWLEDGE',
      kind: 'KNOWLEDGE_READY_PACKAGE',
      sourceId: locator.sourceId,
      sourceVersion: 'accepted-v6',
      sourceFingerprintSha256: sourceFingerprint(workspaceId),
      observedAt: at,
      correlationId: `correlation_wp06-${workspaceId}`
    });
  }
};

async function seedWorkspace(
  contentStore: PostgresLiteContentPreparationStore,
  workspaceId: string,
  slug: string
) {
  await workspaces.create({ workspaceId, name: `WP06 ${slug}`, slug });
  await memberships.create({
    membershipId: `membership_${slug}`,
    workspaceId,
    userId: 'user_wp06_browser',
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
        sourceId: `rdp_wp06-browser-${workspaceId}`
      }
    ],
    idempotencyKey: `wp06-browser-recommendation-${workspaceId}`
  });
}

async function seedDailySignal(workspaceId: string) {
  const signal: DailySignal = {
    schemaVersion: 1,
    dailySignalId: `daily-signal_wp06-${workspaceId}`,
    workspaceId,
    version: 1,
    source: {
      schemaVersion: 1,
      owner: 'KNOWLEDGE',
      kind: 'KNOWLEDGE_READY_PACKAGE',
      sourceId: `rdp_wp06-browser-${workspaceId}`,
      sourceVersion: 'accepted-v6',
      sourceFingerprintSha256: sourceFingerprint(workspaceId),
      observedAt: at,
      correlationId: `correlation_wp06-${workspaceId}`
    },
    title: 'Trademark maintenance timing rule changes next month',
    summary:
      'A reviewed source changes the timing explanation practitioners should use for trademark maintenance planning.',
    keyFacts: [
      'The reviewed timing explanation changes next month.',
      'Practitioners should review maintenance plans before the effective date.'
    ],
    jurisdictions: ['US'],
    institution: 'USPTO',
    topicTags: ['trademark'],
    changeType: 'RULE_CHANGE',
    observedAt: at,
    timeSensitivity: 'HIGH',
    dailySignalFingerprintSha256:
      workspaceId === desktopWorkspaceId ? 'c'.repeat(64) : 'd'.repeat(64),
    legalTruthVerified: false,
    recommendationCreatedAutomatically: false,
    createdAt: at
  };
  await database.getPool().query(
    `INSERT INTO lite_daily_signals(
      workspace_id,daily_signal_id,version,source_owner,source_kind,source_id,source_version,
      source_fingerprint_sha256,daily_signal_fingerprint_sha256,document_json,observed_at,created_at
    ) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
    ON CONFLICT (workspace_id,daily_signal_id,version) DO NOTHING`,
    [
      workspaceId,
      signal.dailySignalId,
      signal.source.owner,
      signal.source.kind,
      signal.source.sourceId,
      String(signal.source.sourceVersion),
      signal.source.sourceFingerprintSha256,
      signal.dailySignalFingerprintSha256,
      JSON.stringify(signal),
      signal.observedAt,
      signal.createdAt
    ]
  );
}

async function main() {
  await database.start();
  const pool = database.getPool();
  await pool.query(
    'CREATE TABLE IF NOT EXISTS workspaces (workspace_id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE)'
  );
  await migrate(
    pool,
    'daily_workspace_browser',
    await loadMigrationsForOwner(
      path.resolve('infrastructure/persistence/migrations'),
      path.resolve('infrastructure/persistence/migration-owners.json'),
      '@markorbit/lite-service'
    )
  );
  await pool.query(
    `INSERT INTO workspaces(workspace_id,name,slug) VALUES
      ($1,'WP06 Browser Desktop','wp06-browser-desktop-db'),
      ($2,'WP06 Browser Mobile','wp06-browser-mobile-db')
     ON CONFLICT(workspace_id) DO NOTHING`,
    [desktopWorkspaceId, mobileWorkspaceId]
  );

  await users.create({
    userId: 'user_wp06_browser',
    email: 'wp06-browser@example.test',
    displayName: 'WP06 Browser User'
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
  const analyticsStore = new PostgresProductConversionAnalyticsStore(pool);
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
  const journeyService = new PreparedActionJourneyService(preparedStore, handoffAuthority);
  const preferences = new NoCreatorPreferenceProvider();
  const dailyOrbitService = new DailyOrbitService(
    new PostgresDailySignalReader(pool),
    journeyService,
    preferences,
    () => at
  );
  const visualStore = new PostgresVisualBridgeStore(database, pool, () => at);
  const contentKitService = new ContentKitService(
    dailyOrbitService,
    new PostgresContentKitLifecycleReader(pool),
    preferences,
    visualStore
  );
  const visualBridgeService = new VisualBridgeService(
    contentKitService,
    visualStore,
    new UnavailableVisualEngineConsumer(),
    'markorbit-lite-editorial-v1'
  );

  const desktopRecommendation = await seedWorkspace(
    contentStore,
    desktopWorkspaceId,
    'wp06-browser-desktop'
  );
  const mobileRecommendation = await seedWorkspace(
    contentStore,
    mobileWorkspaceId,
    'wp06-browser-mobile'
  );
  await seedDailySignal(desktopWorkspaceId);
  await seedDailySignal(mobileWorkspaceId);

  await core.start();
  liteRuntime = createServiceRuntime(
    { name: 'wp06-lite', port: 4417, version: '0.1.0' },
    {
      routes: [
        ...createLiteProductLoopRoutes({
          internalServiceSecret: secret,
          journeyService,
          candidateStore,
          feedbackStore,
          analyticsStore,
          dailyOrbitService
        }),
        ...createContentKitRoutes({ internalServiceSecret: secret, contentKitService }),
        ...createVisualBridgeRoutes({
          internalServiceSecret: secret,
          visualBridgeService,
          visualBridgeStore: visualStore
        })
      ]
    }
  );
  await liteRuntime.start();
  gateway = createGateway({
    port: 4410,
    liteUrl: 'http://127.0.0.1:4417',
    authenticationClient: new HttpCoreAuthenticationClient('http://127.0.0.1:4411', secret),
    internalServiceSecret: secret,
    milestoneTestRuntime: true,
    fixtureUsers: { wp06: 'user_wp06_browser' },
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
    `WP06_DAILY_WORKSPACE_READY ${JSON.stringify({
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
