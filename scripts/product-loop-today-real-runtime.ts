import { createHash } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import type { ReadyPackageContentExportV1 } from '../packages/contracts/src/knowledge-content-export.js';
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
  fingerprintReadyPackageContentExport,
  MemoryKnowledgeReadyPackageContentRepository,
  validateReadyPackageContentExport
} from '../services/core/src/knowledge-content.js';
import {
  fingerprintCoreIntakeRequest,
  MemoryKnowledgeIntakeRepository,
  type KnowledgeIntake
} from '../services/core/src/knowledge-intake.js';
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
import { DailyOrbitService, PostgresDailySignalReader } from '../services/lite/src/daily-orbit.js';
import {
  HttpCoreDailyKnowledgeSourceAuthority,
  PostgresLiteDailySignalStore
} from '../services/lite/src/daily-signal.js';
import { PostgresProductLoopFeedbackStore } from '../services/lite/src/feedback.js';
import {
  handoffResult,
  PostgresPreparedActionStore,
  PreparedActionJourneyService,
  type PreparedActionHandoffAuthority
} from '../services/lite/src/prepared-action.js';
import { PostgresProductPreferenceStore } from '../services/lite/src/preference-feedback.js';
import { createProductPreferenceRoutes } from '../services/lite/src/preference-http.js';
import {
  DailyWorkspacePreferenceTargetResolver,
  ProductPreferenceService
} from '../services/lite/src/preference-target.js';
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
const coreUrl = 'http://127.0.0.1:4411';
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
const knowledgeIntakes = new MemoryKnowledgeIntakeRepository();
const knowledgeContents = new MemoryKnowledgeReadyPackageContentRepository();
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
  knowledgeIntakes,
  knowledgeContents,
  internalServiceSecret: secret
});
let liteRuntime: ReturnType<typeof createServiceRuntime>;
let gateway: ReturnType<typeof createGateway>;
let vite: ChildProcess;

const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');

function stable(value: unknown): string {
  if (value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function readyPackageId(workspaceId: string) {
  return `rdp_wp06-browser-${workspaceId}`;
}

function acceptedKnowledgeIdentity(workspaceId: string) {
  if (workspaceId === desktopWorkspaceId)
    return {
      intakeId: '33333333-3333-4333-8333-333333333333',
      suffix: 'desktop'
    };
  if (workspaceId === mobileWorkspaceId)
    return {
      intakeId: '34343434-3434-4343-8343-343434343434',
      suffix: 'mobile'
    };
  throw new Error('Unexpected browser Workspace.');
}

async function seedAcceptedKnowledgeSource(workspaceId: string) {
  const { intakeId, suffix } = acceptedKnowledgeIdentity(workspaceId);
  const sourceReadyPackageId = readyPackageId(workspaceId);
  const markdown = [
    '# Trademark maintenance timing rule changes next month',
    '',
    'The USPTO published a trademark maintenance rule update effective from next month.',
    '',
    '- The reviewed timing explanation changes next month.',
    '- Practitioners should review maintenance plans before the effective date.'
  ].join('\n');
  const rawArtifact = {
    artifactId: `art_wp06-browser-${suffix}`,
    sha256: sha256(`raw:${workspaceId}:${markdown}`),
    sizeBytes: Buffer.byteLength(markdown),
    mimeType: 'text/html',
    originalName: `uspto-maintenance-${suffix}.html`
  };
  const stagingDocument = {
    documentId: `std_wp06-browser-${suffix}`,
    sha256: sha256(markdown),
    sizeBytes: Buffer.byteLength(markdown),
    mediaType: 'text/markdown' as const,
    encoding: 'utf-8' as const,
    content: markdown
  };
  const provenance = {
    sourceId: `src_wp06-browser-${suffix}`,
    conversionRunId: `cvr_wp06-browser-${suffix}`,
    verificationId: `svr_wp06-browser-${suffix}`,
    verificationOutcome: 'PASS' as const,
    capturedAt: at,
    converter: { converterId: 'markdown', version: '1.0.0' },
    legalTruthVerified: false as const
  };
  const readyPackageDigest = sha256(
    stable({
      artifactIds: [rawArtifact.artifactId],
      stagingDocumentId: stagingDocument.documentId,
      sourceId: provenance.sourceId,
      conversionRunId: provenance.conversionRunId,
      rawArtifactSha256: rawArtifact.sha256,
      stagingSha256: stagingDocument.sha256,
      verificationId: provenance.verificationId,
      verificationOutcome: provenance.verificationOutcome,
      converter: provenance.converter,
      capturedAt: provenance.capturedAt,
      legalTruthVerified: false
    })
  );
  const contentExport: ReadyPackageContentExportV1 = {
    contractVersion: '1.0',
    objectType: 'READY_PACKAGE_CONTENT_EXPORT',
    readyPackageId: sourceReadyPackageId,
    knowledgeWorkspaceId: `wsp_wp06-browser-${suffix}`,
    readyPackageDigest,
    provenance,
    rawArtifact,
    stagingDocument
  };
  const request = {
    readyPackageId: sourceReadyPackageId,
    workspaceId,
    digest: readyPackageDigest,
    evidence: {
      artifactIds: [rawArtifact.artifactId],
      stagingDocumentId: stagingDocument.documentId
    },
    submittedAt: at
  };
  const intake: KnowledgeIntake = {
    intakeId,
    idempotencyKey: `wp06-browser-knowledge-intake-${suffix}`,
    request,
    requestSha256: fingerprintCoreIntakeRequest(request),
    status: 'RECEIVED',
    receivedAt: at
  };
  const issue = validateReadyPackageContentExport(intake, contentExport);
  if (issue) throw new Error(`Browser Knowledge source validation failed: ${issue.code}`);
  await knowledgeIntakes.createOrFind(intake);
  await knowledgeContents.createOrFind({
    intakeId,
    workspaceId,
    readyPackageId: sourceReadyPackageId,
    export: contentExport,
    exportSha256: fingerprintReadyPackageContentExport(contentExport),
    consumedAt: at
  });
  const accepted = await knowledgeIntakes.markAccepted(intakeId);
  if (accepted?.status !== 'ACCEPTED')
    throw new Error('Browser Knowledge source was not accepted.');
}

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
        owner: 'CORE',
        kind: 'KNOWLEDGE_READY_PACKAGE',
        sourceId: readyPackageId(workspaceId)
      }
    ],
    idempotencyKey: `wp06-browser-recommendation-${workspaceId}`
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
  await seedAcceptedKnowledgeSource(desktopWorkspaceId);
  await seedAcceptedKnowledgeSource(mobileWorkspaceId);
  await core.start();

  const coreDailySourceAuthority = new HttpCoreDailyKnowledgeSourceAuthority(coreUrl, secret);
  const productLoopSourceAuthority: ProductLoopSourceAuthority = {
    async resolve(workspaceId, locator) {
      if (locator.owner !== 'CORE' || locator.kind !== 'KNOWLEDGE_READY_PACKAGE')
        throw new Error('Browser recommendation source must be accepted Core Knowledge.');
      const projection = await coreDailySourceAuthority.resolve(workspaceId, locator.sourceId);
      return projection.source;
    }
  };
  const contentStore = new PostgresLiteContentPreparationStore(
    database,
    pool,
    productLoopSourceAuthority,
    () => at
  );
  const candidateStore = new PostgresLiteCandidateQualificationStore(
    database,
    pool,
    productLoopSourceAuthority,
    { isAccessible: async () => true },
    () => at
  );
  const dailySignalStore = new PostgresLiteDailySignalStore(
    database,
    pool,
    coreDailySourceAuthority,
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
  const preferences = new PostgresProductPreferenceStore(database, pool, () => at);
  const dailySignalReader = new PostgresDailySignalReader(pool);
  const dailyOrbitService = new DailyOrbitService(
    dailySignalReader,
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
  const preferenceService = new ProductPreferenceService(
    preferences,
    new DailyWorkspacePreferenceTargetResolver(
      dailyOrbitService,
      dailySignalReader,
      contentKitService,
      visualStore
    )
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
  await dailySignalStore.importKnowledgeSource({
    workspaceId: desktopWorkspaceId,
    readyPackageId: readyPackageId(desktopWorkspaceId),
    idempotencyKey: 'wp06-browser-daily-source-desktop'
  });
  await dailySignalStore.importKnowledgeSource({
    workspaceId: mobileWorkspaceId,
    readyPackageId: readyPackageId(mobileWorkspaceId),
    idempotencyKey: 'wp06-browser-daily-source-mobile'
  });

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
          dailyOrbitService,
          useFeedbackPreferenceRecorder: preferenceService
        }),
        ...createContentKitRoutes({ internalServiceSecret: secret, contentKitService }),
        ...createProductPreferenceRoutes({
          internalServiceSecret: secret,
          service: preferenceService
        }),
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
    authenticationClient: new HttpCoreAuthenticationClient(coreUrl, secret),
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
