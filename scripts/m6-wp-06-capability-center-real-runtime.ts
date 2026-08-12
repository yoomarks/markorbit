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
  createRuntime as createCapabilityEngine,
  PostgresCapabilityObservationLedger,
  PostgresPrivateReflectionCandidateService,
  PostgresReflectionDispositionProfileService,
  PostgresRuntimeCapabilityRegistry,
  type CapabilityObservationSourceAuthority
} from '../services/capability-engine/src/index.js';

const url = process.env.CAPABILITY_CENTER_TEST_DATABASE_URL;
if (!url) throw new Error('CAPABILITY_CENTER_TEST_DATABASE_URL is required.');

const secret = 'wp06-capability-center-internal-secret-32-bytes';
const csrfSecret = 'wp06-capability-center-csrf-secret-32-bytes';
const origin = 'http://127.0.0.1:4485';
process.env.WEB_ORIGINS = origin;
const desktopWorkspaceId = '41414141-4141-4414-8414-414141414141';
const mobileWorkspaceId = '42424242-4242-4424-8424-424242424242';
const subjectUserId = 'user_wp06_capability_browser';
const at = '2026-08-12T02:30:00.000Z';

const database = new ManagedDatabase({
  connection: { url },
  applicationName: 'm6-wp06-capability-center-browser',
  poolMaximum: 10,
  connectionTimeoutMs: 2000,
  idleTimeoutMs: 2000,
  statementTimeoutMs: 5000,
  sslMode: 'disable',
  migrationNamespace: 'm6_wp06_capability_center_browser'
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
const core = createCore({ port: 4421, authentication: auth, internalServiceSecret: secret });
let capabilityEngine: ReturnType<typeof createCapabilityEngine>;
let gateway: ReturnType<typeof createGateway>;
let vite: ChildProcess;

const sourceAuthority: CapabilityObservationSourceAuthority = {
  async verify(locator) {
    const desktop = locator.sourceId === 'evidence-review-decision_wp06-desktop';
    const mobile = locator.sourceId === 'evidence-review-decision_wp06-mobile';
    if (!desktop && !mobile) throw new Error('Unexpected WP-06 source.');
    const workspaceId = desktop ? desktopWorkspaceId : mobileWorkspaceId;
    return {
      source: {
        owner: 'EXECUTION',
        kind: 'EXECUTION_EVIDENCE_REVIEW_DECISION',
        sourceId: locator.sourceId,
        sourceVersion: locator.sourceVersion,
        sourceFingerprintSha256: locator.sourceFingerprintSha256,
        observedAt: at,
        workspaceId,
        subjectUserId,
        correlationId: `correlation_wp06_${desktop ? 'desktop' : 'mobile'}`
      },
      subjectAttributionAuthority: 'OWNER_SOURCE'
    };
  }
};

async function seedWorkspace(
  registry: PostgresRuntimeCapabilityRegistry,
  ledger: PostgresCapabilityObservationLedger,
  candidates: PostgresPrivateReflectionCandidateService,
  workspaceId: string,
  slug: 'desktop' | 'mobile'
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
  const sourceFingerprintSha256 = slug === 'desktop' ? 'c'.repeat(64) : 'd'.repeat(64);
  const admitted = await ledger.admit(
    {
      runtimeCapability: {
        id: imported.definition.runtimeCapabilityDefinitionId,
        version: imported.definition.version
      },
      source: {
        owner: 'EXECUTION',
        kind: 'EXECUTION_EVIDENCE_REVIEW_DECISION',
        sourceId: `evidence-review-decision_wp06-${slug}`,
        sourceVersion: 1,
        sourceFingerprintSha256
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
  await database.start();
  await migrate(
    database.getPool(),
    'm6_wp06_capability_center_browser',
    await loadMigrationsForOwner(
      path.resolve('infrastructure/persistence/migrations'),
      path.resolve('infrastructure/persistence/migration-owners.json'),
      '@markorbit/capability-engine'
    )
  );
  await users.create({
    userId: subjectUserId,
    email: 'wp06-capability@example.test',
    displayName: 'WP06 Capability User'
  });

  const pool = database.getPool();
  const registry = new PostgresRuntimeCapabilityRegistry(database, pool, () => at);
  const ledger = new PostgresCapabilityObservationLedger(
    database,
    pool,
    registry,
    sourceAuthority,
    () => at
  );
  const candidates = new PostgresPrivateReflectionCandidateService(
    database,
    pool,
    registry,
    () => at
  );
  const reflections = new PostgresReflectionDispositionProfileService(database, pool, () => at);
  const [desktopCandidate, mobileCandidate] = await Promise.all([
    seedWorkspace(registry, ledger, candidates, desktopWorkspaceId, 'desktop'),
    seedWorkspace(registry, ledger, candidates, mobileWorkspaceId, 'mobile')
  ]);

  await core.start();
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
      env: { ...process.env, VITE_LITE_GATEWAY_URL: 'http://127.0.0.1:4420' },
      stdio: 'inherit'
    }
  );

  process.stdout.write(
    `M6_WP06_CAPABILITY_CENTER_READY ${JSON.stringify({
      desktopWorkspaceId,
      mobileWorkspaceId,
      desktopCandidateId: desktopCandidate.candidate.reflectionCandidateId,
      mobileCandidateId: mobileCandidate.candidate.reflectionCandidateId
    })}\n`
  );
}

async function stop() {
  vite?.kill('SIGTERM');
  await gateway?.stop();
  await capabilityEngine?.stop();
  await core.stop();
  await database.close();
}
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => void stop().finally(() => process.exit(0)));

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
