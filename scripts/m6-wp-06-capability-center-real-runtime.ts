import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { evidenceHandoffAuthorityConsequences } from '@markorbit/contracts/provider-execution';
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
import {
  HttpExecutionCapabilityObservationSourceAuthority,
  createRuntime as createCapabilityEngine,
  PostgresCapabilityObservationLedger,
  PostgresPrivateReflectionCandidateService,
  PostgresReflectionDispositionProfileService,
  PostgresRuntimeCapabilityRegistry
} from '../services/capability-engine/src/index.js';
import { createRuntime as createExecution } from '../services/execution/src/index.js';
import { createExecutionCapabilityObservationSourceRoutes } from '../services/execution/src/capability-observation-source-http.js';
import { EvidenceReviewService } from '../services/execution/src/evidence-review.js';
import { PostgresEvidenceReviewRepository } from '../services/execution/src/evidence-review-postgres.js';
import { PostgresProviderReturnEvidenceRepository } from '../services/execution/src/provider-return-evidence-postgres.js';
import type { ExecutionProviderReturnEvidenceReceipt } from '../services/execution/src/provider-return-evidence.js';

const capabilityUrl = Reflect.get(process.env, 'CAPABILITY_CENTER_TEST_DATABASE_URL') as
  string | undefined;
const executionUrl = Reflect.get(process.env, 'CAPABILITY_CENTER_EXECUTION_TEST_DATABASE_URL') as
  string | undefined;
if (!capabilityUrl || !executionUrl)
  throw new Error(
    'CAPABILITY_CENTER_TEST_DATABASE_URL and CAPABILITY_CENTER_EXECUTION_TEST_DATABASE_URL are required.'
  );

const secret = 'wp06-capability-center-internal-secret-32-bytes';
const csrfSecret = 'wp06-capability-center-csrf-secret-32-bytes';
const origin = 'http://127.0.0.1:4485';
Reflect.set(process.env, 'WEB_ORIGINS', origin);
const desktopWorkspaceId = '41414141-4141-4414-8414-414141414141';
const mobileWorkspaceId = '42424242-4242-4424-8424-424242424242';
const desktopProviderWorkspaceId = '51515151-5151-4515-8515-515151515151';
const mobileProviderWorkspaceId = '52525252-5252-4525-8525-525252525252';
const subjectUserId = 'user_wp06_capability_browser';
const at = '2026-08-12T02:30:00.000Z';
const sha = (character: string) => character.repeat(64);

function managedDatabase(url: string, applicationName: string, migrationNamespace: string) {
  return new ManagedDatabase({
    connection: { url },
    applicationName,
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace
  });
}

const capabilityDatabase = managedDatabase(
  capabilityUrl,
  'm6-wp06-capability-center-browser',
  'm6_wp06_capability_center_browser'
);
const executionDatabase = managedDatabase(
  executionUrl,
  'm6-wp06-execution-source-browser',
  'm6_wp06_execution_source_browser'
);
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
  port: 4421,
  authentication: auth,
  accountOnboarding,
  internalServiceSecret: secret
});
let execution: ReturnType<typeof createExecution>;
let capabilityEngine: ReturnType<typeof createCapabilityEngine>;
let gateway: ReturnType<typeof createGateway>;
let vite: ChildProcess;

async function resetAndMigrate(
  database: ManagedDatabase,
  owner: '@markorbit/capability-engine' | '@markorbit/execution-service',
  namespace: string
) {
  await database.start();
  const pool = database.getPool();
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
  await pool.query('CREATE SCHEMA public');
  await pool.query('DROP SCHEMA IF EXISTS markorbit_persistence CASCADE');
  await migrate(
    pool,
    namespace,
    await loadMigrationsForOwner(
      path.resolve('infrastructure/persistence/migrations'),
      path.resolve('infrastructure/persistence/migration-owners.json'),
      owner
    )
  );
}

async function seedExecutionReviewedDecision(
  workspaceId: string,
  providerWorkspaceId: string,
  slug: 'desktop' | 'mobile',
  evidenceReceipts: PostgresProviderReturnEvidenceRepository,
  reviews: PostgresEvidenceReviewRepository
) {
  const pool = executionDatabase.getPool();
  const filingAuthorizationId = `filing-authorization_wp06-${slug}`;
  const executionReleaseId = `execution-release_wp06-${slug}`;
  const filingTaskDraftId = `filing-task-draft_wp06-${slug}`;
  await pool.query(
    `INSERT INTO filing_authorizations(
       filing_authorization_id,workspace_id,preparation_lock_id,preparation_lock_version,status,version,
       authorization_record,created_by,updated_by,created_at,updated_at
     ) VALUES($1,$2,$3,'1','AUTHORIZED',2,'{}'::jsonb,$4,$4,$5,$5)`,
    [filingAuthorizationId, workspaceId, `preparation-lock_wp06-${slug}`, subjectUserId, at]
  );
  await pool.query(
    `INSERT INTO execution_releases(
       execution_release_id,workspace_id,filing_authorization_id,filing_authorization_version,status,version,
       release_record,created_by,updated_by,created_at,updated_at
     ) VALUES($1,$2,$3,2,'RELEASED_FOR_EXECUTION',3,'{}'::jsonb,$4,$4,$5,$5)`,
    [executionReleaseId, workspaceId, filingAuthorizationId, subjectUserId, at]
  );
  await pool.query(
    `INSERT INTO filing_execution_task_drafts(
       filing_execution_task_draft_id,workspace_id,execution_release_id,filing_authorization_id,status,
       task_record,created_by,updated_by,created_at,updated_at
     ) VALUES($1,$2,$3,$4,'PREPARED','{}'::jsonb,$5,$5,$6,$6)`,
    [filingTaskDraftId, workspaceId, executionReleaseId, filingAuthorizationId, subjectUserId, at]
  );

  const receipt: ExecutionProviderReturnEvidenceReceipt = {
    schemaVersion: 1,
    evidenceHandoff: {
      schemaVersion: 1,
      evidenceHandoffId: `evidence-handoff_wp06-${slug}`,
      workspaceId,
      providerReturn: { id: `provider-return_wp06-${slug}`, version: 1 },
      providerReturnFingerprintSha256: sha(slug === 'desktop' ? 'c' : 'd'),
      executionRelease: { id: executionReleaseId, version: 3 },
      filingExecutionTaskDraft: { id: filingTaskDraftId, version: 1 },
      correlationId: `correlation_wp06_${slug}`,
      handedOffAt: at
    },
    providerId: `provider_wp06-${slug}`,
    providerWorkspaceId,
    providerActorId: `provider-actor_wp06-${slug}`,
    workStatusClaim: 'Provider evidence awaits explicit internal review.',
    artifacts: [
      {
        reference: `artifact://wp06/${slug}/review-evidence.pdf`,
        fileName: 'review-evidence.pdf',
        mediaType: 'application/pdf',
        sha256: sha('b')
      }
    ],
    assertions: [
      {
        code: 'PROVIDER_CLAIMS_EXTERNAL_ACTION_OCCURRED',
        value: true,
        evidenceReferences: [`artifact://wp06/${slug}/review-evidence.pdf`]
      }
    ],
    reviewStatus: 'PENDING_REVIEW',
    authorityConsequences: evidenceHandoffAuthorityConsequences,
    receivedAt: at
  };
  await evidenceReceipts.saveReceipt(
    receipt,
    `wp06-evidence-${slug}`,
    sha(slug === 'desktop' ? 'e' : 'f')
  );

  const reviewService = new EvidenceReviewService(
    reviews,
    evidenceReceipts,
    () => at,
    () => `evidence-receipt_wp06-${slug}`,
    () => `evidence-review-decision_wp06-${slug}`,
    () => `evidence-correction-request_wp06-${slug}`
  );
  const principal = {
    workspaceId,
    userId: subjectUserId as `user_${string}`,
    permissions: ['review:read', 'review:perform']
  };
  const source = await reviewService.captureReviewSource(
    receipt.evidenceHandoff.evidenceHandoffId,
    principal
  );
  return reviewService.recordDecision(
    {
      workspaceId,
      evidenceReceiptId: source.evidenceReceipt.id,
      expectedEvidenceReceiptVersion: source.evidenceReceipt.version,
      expectedEvidenceReceiptFingerprintSha256: source.evidenceReceiptFingerprintSha256,
      outcome: 'ADMITTED_FOR_INTERNAL_USE',
      rationale:
        'Authenticated subject reviewer admits exact governed work evidence for bounded internal use.',
      correctionReasons: [],
      idempotencyKey: `wp06-review-${slug}`,
      correlationId: source.correlationId
    },
    principal
  );
}

async function seedWorkspace(
  registry: PostgresRuntimeCapabilityRegistry,
  ledger: PostgresCapabilityObservationLedger,
  candidates: PostgresPrivateReflectionCandidateService,
  workspaceId: string,
  slug: 'desktop' | 'mobile',
  decision: Awaited<ReturnType<typeof seedExecutionReviewedDecision>>
) {
  await workspaces.create({
    workspaceId,
    name: `WP06 Capability ${slug}`,
    slug: `wp06-capability-${slug}`
  });
  await memberships.create({
    membershipId: `membership_wp06_${slug}`,
    workspaceId,
    userId: subjectUserId,
    role: 'REVIEWER'
  });
  const imported = await registry.importAccepted({
    definition: {
      sourceAuthority: 'ACCEPTED_CAPABILITY_CANON',
      capabilityId: 'evidence-review-analysis',
      capabilityVersion: '1.0.0',
      title: 'Evidence review analysis',
      description: 'Reviews governed evidence and records a bounded decision.',
      lineage: {
        domainId: 'trademark-services',
        capabilityId: 'evidence-review-analysis',
        skillId: 'evidence-review',
        actionId: 'record-review-decision'
      },
      canonReference: {
        canonId: 'capability-canon',
        canonVersion: '2026.08.12',
        sourceFingerprintSha256: 'a'.repeat(64)
      }
    },
    idempotencyKey: 'wp06-runtime-capability'
  });
  const admitted = await ledger.admit(
    {
      runtimeCapability: {
        id: imported.definition.runtimeCapabilityDefinitionId,
        version: imported.definition.version
      },
      source: {
        owner: 'EXECUTION',
        kind: 'EXECUTION_EVIDENCE_REVIEW_DECISION',
        sourceId: decision.evidenceReviewDecisionId,
        sourceVersion: decision.version,
        sourceFingerprintSha256: decision.decisionFingerprintSha256
      }
    },
    `wp06-ledger-${slug}`
  );
  return candidates.generate(
    { ledgerEntryId: admitted.ledgerEntry.capabilityLedgerEntryId },
    `wp06-candidate-${slug}`
  );
}

async function main() {
  await resetAndMigrate(
    capabilityDatabase,
    '@markorbit/capability-engine',
    'm6_wp06_capability_center_browser'
  );
  await resetAndMigrate(
    executionDatabase,
    '@markorbit/execution-service',
    'm6_wp06_execution_source_browser'
  );
  await users.create({
    userId: subjectUserId,
    email: 'wp06-capability@example.test',
    displayName: 'WP06 Capability User'
  });

  const evidenceReceipts = new PostgresProviderReturnEvidenceRepository(
    executionDatabase,
    executionDatabase.getPool()
  );
  const reviews = new PostgresEvidenceReviewRepository(
    executionDatabase,
    executionDatabase.getPool()
  );
  const [desktopDecision, mobileDecision] = await Promise.all([
    seedExecutionReviewedDecision(
      desktopWorkspaceId,
      desktopProviderWorkspaceId,
      'desktop',
      evidenceReceipts,
      reviews
    ),
    seedExecutionReviewedDecision(
      mobileWorkspaceId,
      mobileProviderWorkspaceId,
      'mobile',
      evidenceReceipts,
      reviews
    )
  ]);

  await core.start();
  execution = createExecution({
    port: 4422,
    internalServiceSecret: secret,
    providerExecutionRoutes: createExecutionCapabilityObservationSourceRoutes({
      internalServiceSecret: secret,
      evidenceReviewReader: reviews
    })
  });
  await execution.start();

  const pool = capabilityDatabase.getPool();
  const registry = new PostgresRuntimeCapabilityRegistry(capabilityDatabase, pool, () => at);
  const sourceAuthority = new HttpExecutionCapabilityObservationSourceAuthority(
    `http://127.0.0.1:${execution.listeningPort}`,
    secret
  );
  const ledger = new PostgresCapabilityObservationLedger(
    capabilityDatabase,
    pool,
    registry,
    sourceAuthority,
    () => at
  );
  const candidates = new PostgresPrivateReflectionCandidateService(
    capabilityDatabase,
    pool,
    registry,
    () => at
  );
  const reflections = new PostgresReflectionDispositionProfileService(
    capabilityDatabase,
    pool,
    () => at
  );
  const [desktopCandidate, mobileCandidate] = await Promise.all([
    seedWorkspace(registry, ledger, candidates, desktopWorkspaceId, 'desktop', desktopDecision),
    seedWorkspace(registry, ledger, candidates, mobileWorkspaceId, 'mobile', mobileDecision)
  ]);

  capabilityEngine = createCapabilityEngine({
    port: 4423,
    runtimeCapabilityRegistry: registry,
    capabilityObservationLedger: ledger,
    privateReflectionCandidates: candidates,
    reflectionDispositionProfiles: reflections,
    internalServiceSecret: secret
  });
  await capabilityEngine.start();
  gateway = createGateway({
    port: 4420,
    capabilityEngineUrl: 'http://127.0.0.1:4423',
    authenticationClient: new HttpCoreAuthenticationClient('http://127.0.0.1:4421', secret),
    internalServiceSecret: secret,
    milestoneTestRuntime: true,
    fixtureUsers: { wp06: subjectUserId },
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
      '4485',
      '--strictPort'
    ],
    {
      env: Object.assign({}, process.env, {
        VITE_LITE_GATEWAY_URL: 'http://127.0.0.1:4420'
      }),
      stdio: 'inherit'
    }
  );

  process.stdout.write(
    `M6_WP06_CAPABILITY_CENTER_READY ${JSON.stringify({
      desktopWorkspaceId,
      mobileWorkspaceId,
      desktopDecisionId: desktopDecision.evidenceReviewDecisionId,
      mobileDecisionId: mobileDecision.evidenceReviewDecisionId,
      desktopCandidateId: desktopCandidate.candidate.reflectionCandidateId,
      mobileCandidateId: mobileCandidate.candidate.reflectionCandidateId
    })}\n`
  );
}

async function stop() {
  vite?.kill('SIGTERM');
  await gateway?.stop();
  await capabilityEngine?.stop();
  await execution?.stop();
  await core.stop();
  await capabilityDatabase.close();
  await executionDatabase.close();
}
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => void stop().finally(() => process.exit(0)));

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
