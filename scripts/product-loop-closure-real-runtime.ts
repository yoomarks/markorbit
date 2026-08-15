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

const url = process.env.LITE_PRODUCT_LOOP_CLOSURE_BROWSER_DATABASE_URL;
if (!url)
  throw new Error(
    'LITE_PRODUCT_LOOP_CLOSURE_BROWSER_DATABASE_URL is required for the PLC-WP-07 browser runtime.'
  );

const secret = 'plc-wp07-browser-internal-secret-32-bytes';
const csrfSecret = 'plc-wp07-browser-csrf-secret-32-bytes';
const corePort = 4491;
const litePort = 4497;
const gatewayPort = 4490;
const webPort = 4495;
const origin = `http://127.0.0.1:${webPort}`;
process.env.WEB_ORIGINS = origin;
const desktopWorkspaceId = '43434343-4343-4434-8434-434343434343';
const mobileWorkspaceId = '44444444-4444-4444-8444-444444444444';
const at = '2026-08-11T15:30:00.000Z';
const primaryTitle = 'Prepare the reviewed trademark maintenance update';
const feedbackPackageTitle = 'WP07 reviewed manual-use package';

const database = new ManagedDatabase({
  connection: { url },
  applicationName: 'product-loop-closure-browser',
  poolMaximum: 10,
  connectionTimeoutMs: 2000,
  idleTimeoutMs: 2000,
  statementTimeoutMs: 5000,
  sslMode: 'disable',
  migrationNamespace: 'product_loop_closure_browser'
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
const accountOnboarding = new AccountOnboardingService(
  new InMemoryAccountOnboardingRepository(users, workspaces, memberships)
);
const core = createCore({
  port: corePort,
  authentication: auth,
  accountOnboarding,
  internalServiceSecret: secret
});
let liteRuntime: ReturnType<typeof createServiceRuntime>;
let gateway: ReturnType<typeof createGateway>;
let vite: ChildProcess;

function sourceId(workspaceId: string, purpose: 'primary' | 'feedback') {
  return `rdp_wp07-browser-${purpose}-${workspaceId}`;
}

const sourceAuthority: ProductLoopSourceAuthority = {
  resolve(workspaceId, locator) {
    if (![desktopWorkspaceId, mobileWorkspaceId].includes(workspaceId))
      throw new Error('Unexpected WP-07 browser Workspace.');
    if (locator.owner !== 'KNOWLEDGE' || locator.kind !== 'KNOWLEDGE_READY_PACKAGE')
      throw new Error('Unexpected WP-07 browser source owner/kind.');
    const purpose =
      locator.sourceId === sourceId(workspaceId, 'primary')
        ? 'primary'
        : locator.sourceId === sourceId(workspaceId, 'feedback')
          ? 'feedback'
          : undefined;
    if (!purpose) throw new Error('Unexpected WP-07 browser source locator.');
    const desktop = workspaceId === desktopWorkspaceId;
    const fingerprintCharacter = desktop
      ? purpose === 'primary'
        ? 'c'
        : 'd'
      : purpose === 'primary'
        ? 'e'
        : 'f';
    return Promise.resolve({
      schemaVersion: 1,
      owner: 'KNOWLEDGE',
      kind: 'KNOWLEDGE_READY_PACKAGE',
      sourceId: locator.sourceId,
      sourceVersion: 'accepted-v7',
      sourceFingerprintSha256: fingerprintCharacter.repeat(64),
      observedAt: at,
      correlationId: `correlation_wp07-${purpose}-${workspaceId}`
    });
  }
};

async function seedWorkspace(
  contentStore: PostgresLiteContentPreparationStore,
  workspaceId: string,
  slug: string
) {
  await workspaces.create({ workspaceId, name: `WP07 ${slug}`, slug });
  await memberships.create({
    membershipId: `membership_${slug}`,
    workspaceId,
    userId: 'user_wp07_browser',
    role: 'WORKSPACE_ADMIN'
  });

  const primaryRecommendation = await contentStore.createRecommendation({
    workspaceId,
    title: primaryTitle,
    explanation:
      'Accepted governed Knowledge changed the timing explanation and is ready for one bounded professional content preparation step.',
    sources: [
      {
        owner: 'KNOWLEDGE',
        kind: 'KNOWLEDGE_READY_PACKAGE',
        sourceId: sourceId(workspaceId, 'primary')
      }
    ],
    idempotencyKey: `wp07-browser-primary-${workspaceId}`
  });

  const feedbackRecommendation = await contentStore.createRecommendation({
    workspaceId,
    title: 'Prepare one reviewed package for manual external use',
    explanation:
      'A second exact governed source is used only to seed the reviewed PublishPackage feedback path.',
    sources: [
      {
        owner: 'KNOWLEDGE',
        kind: 'KNOWLEDGE_READY_PACKAGE',
        sourceId: sourceId(workspaceId, 'feedback')
      }
    ],
    idempotencyKey: `wp07-browser-feedback-recommendation-${workspaceId}`
  });
  const contentOpportunity = await contentStore.acceptContentOpportunity({
    workspaceId,
    recommendation: {
      id: feedbackRecommendation.todayRecommendationId,
      version: feedbackRecommendation.version
    },
    expectedRecommendationFingerprintSha256: feedbackRecommendation.recommendationFingerprintSha256,
    title: 'Prepare reviewed manual-use package',
    rationale: 'Seed the real pending-feedback path from exact accepted Knowledge.',
    idempotencyKey: `wp07-browser-feedback-opportunity-${workspaceId}`
  });
  const draft = await contentStore.createDraft({
    workspaceId,
    contentOpportunity: {
      id: contentOpportunity.contentOpportunityId,
      version: contentOpportunity.version
    },
    expectedContentOpportunityFingerprintSha256:
      contentOpportunity.contentOpportunityFingerprintSha256,
    title: feedbackPackageTitle,
    body: 'Reviewed content prepared for a manual external workflow.',
    idempotencyKey: `wp07-browser-feedback-draft-${workspaceId}`
  });
  const ready = await contentStore.markDraftReadyForReview({
    workspaceId,
    contentDraftId: draft.contentDraftId,
    expectedVersion: draft.version,
    expectedContentDraftFingerprintSha256: draft.contentDraftFingerprintSha256,
    idempotencyKey: `wp07-browser-feedback-ready-${workspaceId}`
  });
  const review = await contentStore.recordReview({
    workspaceId,
    contentDraft: { id: ready.contentDraftId, version: ready.version },
    expectedContentDraftFingerprintSha256: ready.contentDraftFingerprintSha256,
    outcome: 'APPROVED_FOR_PUBLISH_PACKAGE',
    reviewerPrincipalId: 'user_wp07_browser',
    rationale: 'Approved only for a prepared manual-use package.',
    idempotencyKey: `wp07-browser-feedback-review-${workspaceId}`
  });
  const publishPackage = await contentStore.preparePublishPackage({
    workspaceId,
    contentDraft: { id: ready.contentDraftId, version: ready.version },
    expectedContentDraftFingerprintSha256: ready.contentDraftFingerprintSha256,
    reviewDecision: { id: review.contentReviewDecisionId, version: review.version },
    idempotencyKey: `wp07-browser-feedback-package-${workspaceId}`
  });

  return { primaryRecommendation, publishPackage };
}

async function main() {
  await database.start();
  const pool = database.getPool();
  await pool.query(
    'CREATE TABLE IF NOT EXISTS workspaces (workspace_id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE)'
  );
  await migrate(
    pool,
    'product_loop_closure_browser',
    await loadMigrationsForOwner(
      path.resolve('infrastructure/persistence/migrations'),
      path.resolve('infrastructure/persistence/migration-owners.json'),
      '@markorbit/lite-service'
    )
  );
  await pool.query(
    `INSERT INTO workspaces(workspace_id,name,slug) VALUES
      ($1,'WP07 Browser Desktop','wp07-browser-desktop-db'),
      ($2,'WP07 Browser Mobile','wp07-browser-mobile-db')
     ON CONFLICT(workspace_id) DO NOTHING`,
    [desktopWorkspaceId, mobileWorkspaceId]
  );

  await users.create({
    userId: 'user_wp07_browser',
    email: 'wp07-browser@example.test',
    displayName: 'WP07 Browser User'
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
        throw new Error('WP-07 browser mainline only accepts PREPARE_CONTENT.');
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

  const desktopSeed = await seedWorkspace(contentStore, desktopWorkspaceId, 'wp07-browser-desktop');
  const mobileSeed = await seedWorkspace(contentStore, mobileWorkspaceId, 'wp07-browser-mobile');

  await core.start();
  liteRuntime = createServiceRuntime(
    { name: 'wp07-lite', port: litePort, version: '0.1.0' },
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
    port: gatewayPort,
    liteUrl: `http://127.0.0.1:${litePort}`,
    authenticationClient: new HttpCoreAuthenticationClient(`http://127.0.0.1:${corePort}`, secret),
    internalServiceSecret: secret,
    milestoneTestRuntime: true,
    fixtureUsers: { wp07: 'user_wp07_browser' },
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
      String(webPort),
      '--strictPort'
    ],
    {
      env: {
        ...process.env,
        VITE_LITE_GATEWAY_URL: `http://127.0.0.1:${gatewayPort}`
      },
      stdio: 'inherit'
    }
  );

  process.stdout.write(
    `WP07_PRODUCT_LOOP_READY ${JSON.stringify({
      desktopWorkspaceId,
      mobileWorkspaceId,
      desktopRecommendationId: desktopSeed.primaryRecommendation.todayRecommendationId,
      mobileRecommendationId: mobileSeed.primaryRecommendation.todayRecommendationId,
      desktopPublishPackageId: desktopSeed.publishPackage.publishPackageId,
      mobilePublishPackageId: mobileSeed.publishPackage.publishPackageId,
      feedbackPackageTitle
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
