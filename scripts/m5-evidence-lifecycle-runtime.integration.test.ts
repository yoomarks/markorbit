import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FormalMatterId } from '@markorbit/contracts';
import { evidenceHandoffAuthorityConsequences } from '@markorbit/contracts/provider-execution';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import {
  AuthenticationService,
  PostgresMembershipRepository,
  PostgresSessionRepository,
  PostgresUserRepository,
  PostgresWorkspaceRepository,
  createRuntime as createCore
} from '../services/core/src/index.js';
import { createRuntime as createExecution } from '../services/execution/src/index.js';
import { EvidenceReviewService } from '../services/execution/src/evidence-review.js';
import { PostgresEvidenceReviewRepository } from '../services/execution/src/evidence-review-postgres.js';
import { PostgresEvidenceReviewQueueReader } from '../services/execution/src/evidence-review-queue-postgres.js';
import { createExecutionEvidenceProvenanceRoutes } from '../services/execution/src/evidence-provenance-http.js';
import { PostgresProviderReturnEvidenceRepository } from '../services/execution/src/provider-return-evidence-postgres.js';
import type { ExecutionProviderReturnEvidenceReceipt } from '../services/execution/src/provider-return-evidence.js';
import {
  PostgresReviewedSourceAdmissionRepository,
  ReviewedSourceAdmissionService,
  ReviewedSourceHandoffService,
  type MarkRegLifecycleProjectionClient
} from '../services/execution/src/reviewed-source-handoff.js';
import {
  createExecutionReviewedSourceInternalRoutes,
  HttpMarkRegLifecycleProjectionClient
} from '../services/execution/src/reviewed-source-handoff-http.js';
import {
  createRuntime as createMarkReg,
  PostgresFormalMatterRepository
} from '../services/markreg/src/index.js';
import {
  LifecycleProjectionService,
  PostgresLifecycleProjectionRepository
} from '../services/markreg/src/lifecycle-projection.js';
import {
  createMarkRegLifecycleHandoffRoutes,
  HttpReviewedSourceAdmissionReader
} from '../services/markreg/src/lifecycle-handoff-http.js';
import { createMarkRegLifecycleSurfaceRoutes } from '../services/markreg/src/lifecycle-surface-http.js';
import {
  PostgresRecommendedActionRepository,
  RecommendedActionService
} from '../services/markreg/src/recommended-action.js';
import {
  HttpCoreAuthenticationClient,
  createRuntime as createGateway,
  csrfToken
} from '../apps/gateway/src/index.js';

const coreUrl = process.env.M5_RUNTIME_CORE_DATABASE_URL;
const executionUrl = process.env.M5_RUNTIME_EXECUTION_DATABASE_URL;
const markRegUrl = process.env.M5_RUNTIME_MARKREG_DATABASE_URL;
const required = process.env.M5_RUNTIME_INTEGRATION_REQUIRED === '1';
if (required && (!coreUrl || !executionUrl || !markRegUrl))
  throw new Error(
    'M5_RUNTIME_CORE_DATABASE_URL, M5_RUNTIME_EXECUTION_DATABASE_URL and M5_RUNTIME_MARKREG_DATABASE_URL are required.'
  );
const suite = coreUrl && executionUrl && markRegUrl ? describe : describe.skip;

const secret = 'm5-runtime-internal-secret-32-bytes-minimum';
const csrfSecret = 'm5-runtime-csrf-secret-32-bytes-minimum';
const origin = 'https://m5-runtime.markorbit.test';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const otherWorkspaceId = '22222222-2222-4222-8222-222222222222';
const providerWorkspaceId = '77777777-7777-4777-8777-777777777777';
const operatorUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const operatorMembershipId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const fixedNow = '2026-08-11T00:00:00.000Z';
const formalMatterId = 'formal-matter_m5-runtime' as FormalMatterId;
const sha = (character: string) => character.repeat(64);

function database(url: string, applicationName: string, migrationNamespace: string) {
  return new ManagedDatabase({
    connection: { url },
    applicationName,
    poolMaximum: 8,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace
  });
}

suite.sequential('M5 zero-interception evidence review and lifecycle runtime', () => {
  const coreDatabase = database(coreUrl!, 'm5-runtime-core', 'm5_runtime_core');
  const executionDatabase = database(executionUrl!, 'm5-runtime-execution', 'm5_runtime_execution');
  const markRegDatabase = database(markRegUrl!, 'm5-runtime-markreg', 'm5_runtime_markreg');
  let core: ReturnType<typeof createCore>;
  let execution: ReturnType<typeof createExecution>;
  let markReg: ReturnType<typeof createMarkReg>;
  let gateway: ReturnType<typeof createGateway>;
  let operatorToken = '';
  let operatorCsrf = '';
  let markRegBaseUrl = '';
  let priorExecutionUrl: string | undefined;

  async function resetOwner(
    value: ManagedDatabase,
    owner:
      '@markorbit/core-service' | '@markorbit/execution-service' | '@markorbit/markreg-service',
    namespace: string
  ) {
    await value.start();
    const pool = value.getPool();
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await pool.query('CREATE SCHEMA public');
    await pool.query('DROP SCHEMA IF EXISTS markorbit_persistence CASCADE');
    const migrations = await loadMigrationsForOwner(
      path.resolve('infrastructure/persistence/migrations'),
      path.resolve('infrastructure/persistence/migration-owners.json'),
      owner
    );
    await migrate(pool, namespace, migrations);
  }

  async function seedExecutionPrerequisites() {
    const pool = executionDatabase.getPool();
    await pool.query(
      `INSERT INTO filing_authorizations(
         filing_authorization_id,workspace_id,preparation_lock_id,preparation_lock_version,status,version,
         authorization_record,created_by,updated_by,created_at,updated_at
       ) VALUES('filing-authorization_m5-runtime',$1,'preparation-lock_m5-runtime','1','AUTHORIZED',2,'{}'::jsonb,$2,$2,$3,$3)`,
      [workspaceId, operatorUserId, fixedNow]
    );
    await pool.query(
      `INSERT INTO execution_releases(
         execution_release_id,workspace_id,filing_authorization_id,filing_authorization_version,status,version,
         release_record,created_by,updated_by,created_at,updated_at
       ) VALUES('execution-release_m5-runtime',$1,'filing-authorization_m5-runtime',2,'RELEASED_FOR_EXECUTION',3,'{}'::jsonb,$2,$2,$3,$3)`,
      [workspaceId, operatorUserId, fixedNow]
    );
    await pool.query(
      `INSERT INTO filing_execution_task_drafts(
         filing_execution_task_draft_id,workspace_id,execution_release_id,filing_authorization_id,status,
         task_record,created_by,updated_by,created_at,updated_at
       ) VALUES('filing-task-draft_m5-runtime',$1,'execution-release_m5-runtime','filing-authorization_m5-runtime','PREPARED','{}'::jsonb,$2,$2,$3,$3)`,
      [workspaceId, operatorUserId, fixedNow]
    );
  }

  async function seedMatter() {
    await markRegDatabase.getPool().query(
      `INSERT INTO formal_matters(
         formal_matter_id,workspace_id,kind,status,version,
         source_customer_confirmation_id,source_customer_confirmation_version,
         source_matter_draft_id,source_matter_draft_version,source_quote_id,source_quote_version,
         source_snapshot,snapshot_schema_version,snapshot_sha256,created_by_user_id,created_at,updated_at
       ) VALUES($1,$2,'TRADEMARK_REGISTRATION','OPEN',1,$3,1,$4,1,$5,'quote-v1',$6::jsonb,1,$7,$8,$9,$9)`,
      [
        formalMatterId,
        workspaceId,
        `confirmation_${formalMatterId}`,
        `matter-draft_${formalMatterId}`,
        `quote_${formalMatterId}`,
        JSON.stringify({ preparation: { applicantName: 'Orbit Ltd', trademark: 'MARK ORBIT' } }),
        sha('f'),
        operatorUserId,
        fixedNow
      ]
    );
  }

  function receipt(suffix: string, correlationId: string): ExecutionProviderReturnEvidenceReceipt {
    return {
      schemaVersion: 1,
      evidenceHandoff: {
        schemaVersion: 1,
        evidenceHandoffId: `evidence-handoff_${suffix}`,
        workspaceId,
        providerReturn: { id: `provider-return_${suffix}`, version: 1 },
        providerReturnFingerprintSha256: sha(suffix === 'correction' ? 'c' : 'a'),
        executionRelease: { id: 'execution-release_m5-runtime', version: 3 },
        filingExecutionTaskDraft: { id: 'filing-task-draft_m5-runtime', version: 1 },
        correlationId: correlationId as `correlation_${string}`,
        handedOffAt: fixedNow
      },
      providerId: 'provider_m5-runtime',
      providerWorkspaceId,
      providerActorId: 'provider-actor-m5-runtime',
      workStatusClaim: 'Provider evidence awaits explicit internal review.',
      artifacts: [
        {
          reference: `artifact://m5-runtime/${suffix}/receipt.pdf`,
          fileName: 'receipt.pdf',
          mediaType: 'application/pdf',
          sha256: sha('b')
        }
      ],
      assertions: [
        {
          code: 'PROVIDER_CLAIMS_EXTERNAL_ACTION_OCCURRED',
          value: true,
          evidenceReferences: [`artifact://m5-runtime/${suffix}/receipt.pdf`]
        }
      ],
      reviewStatus: 'PENDING_REVIEW',
      authorityConsequences: evidenceHandoffAuthorityConsequences,
      receivedAt: fixedNow
    };
  }

  function browserHeaders(key?: string, correlationId?: string, requestedWorkspace = workspaceId) {
    return {
      cookie: `mo_session=${operatorToken}`,
      'x-markorbit-workspace-id': requestedWorkspace,
      ...(key
        ? {
            origin,
            'x-markorbit-csrf-token': operatorCsrf,
            'idempotency-key': key,
            'x-correlation-id': correlationId ?? key,
            'content-type': 'application/json'
          }
        : {})
    };
  }

  async function get(pathname: string, requestedWorkspace = workspaceId) {
    const response = await fetch(`http://127.0.0.1:${gateway.listeningPort}${pathname}`, {
      headers: browserHeaders(undefined, undefined, requestedWorkspace)
    });
    return { response, body: (await response.json()) as Record<string, any> };
  }

  async function post(pathname: string, body: unknown, key: string, correlationId?: string) {
    const response = await fetch(`http://127.0.0.1:${gateway.listeningPort}${pathname}`, {
      method: 'POST',
      headers: browserHeaders(key, correlationId),
      body: JSON.stringify(body)
    });
    return { response, body: (await response.json()) as Record<string, any> };
  }

  beforeAll(async () => {
    await resetOwner(coreDatabase, '@markorbit/core-service', 'm5_runtime_core');
    await resetOwner(executionDatabase, '@markorbit/execution-service', 'm5_runtime_execution');
    await resetOwner(markRegDatabase, '@markorbit/markreg-service', 'm5_runtime_markreg');

    const corePool = coreDatabase.getPool();
    const users = new PostgresUserRepository(corePool);
    const workspaces = new PostgresWorkspaceRepository(corePool);
    const memberships = new PostgresMembershipRepository(corePool);
    const sessions = new PostgresSessionRepository(corePool);
    const authentication = new AuthenticationService({ users, workspaces, memberships, sessions });
    await workspaces.create({
      workspaceId,
      name: 'M5 Runtime Workspace',
      slug: 'm5-runtime-workspace'
    });
    await workspaces.create({
      workspaceId: otherWorkspaceId,
      name: 'M5 Other Workspace',
      slug: 'm5-other-workspace'
    });
    await users.create({
      userId: operatorUserId,
      email: 'operator@m5-runtime.test',
      displayName: 'M5 Operator'
    });
    await memberships.create({
      membershipId: operatorMembershipId,
      workspaceId,
      userId: operatorUserId,
      role: 'WORKSPACE_ADMIN'
    });
    const session = await authentication.issueSession(operatorUserId);
    operatorToken = session.rawToken;
    operatorCsrf = csrfToken(session.session.sessionId, csrfSecret);

    core = createCore({
      port: 0,
      authentication,
      workspaces,
      internalServiceSecret: secret
    });
    await core.start();

    await seedExecutionPrerequisites();
    await seedMatter();
    const evidenceReceiptRepository = new PostgresProviderReturnEvidenceRepository(
      executionDatabase,
      executionDatabase.getPool()
    );
    await evidenceReceiptRepository.saveReceipt(
      receipt('primary', 'correlation_m5-runtime-primary'),
      'seed-primary',
      sha('e')
    );

    const reviewRepository = new PostgresEvidenceReviewRepository(
      executionDatabase,
      executionDatabase.getPool()
    );
    const reviewService = new EvidenceReviewService(reviewRepository, evidenceReceiptRepository);
    const queueReader = new PostgresEvidenceReviewQueueReader(executionDatabase.getPool());
    const admissionRepository = new PostgresReviewedSourceAdmissionRepository(
      executionDatabase,
      executionDatabase.getPool()
    );
    const admissionService = new ReviewedSourceAdmissionService(
      admissionRepository,
      reviewRepository
    );
    class DynamicMarkRegClient implements MarkRegLifecycleProjectionClient {
      async project(command: Parameters<MarkRegLifecycleProjectionClient['project']>[0]) {
        if (!markRegBaseUrl) throw new Error('MarkReg runtime is not ready.');
        return new HttpMarkRegLifecycleProjectionClient(markRegBaseUrl, secret).project(command);
      }
    }
    const handoffService = new ReviewedSourceHandoffService(
      admissionRepository,
      new DynamicMarkRegClient()
    );
    execution = createExecution({
      port: 0,
      internalServiceSecret: secret,
      providerExecutionRoutes: [
        ...createExecutionReviewedSourceInternalRoutes({
          internalServiceSecret: secret,
          admissionServiceFor: () => admissionService,
          handoffServiceFor: () => handoffService
        }),
        ...createExecutionEvidenceProvenanceRoutes({
          internalServiceSecret: secret,
          admissionServiceFor: () => admissionService,
          handoffServiceFor: () => handoffService,
          evidenceReviewServiceFor: () => reviewService,
          reviewQueueFor: () => queueReader
        })
      ]
    });
    await execution.start();
    const executionBaseUrl = `http://127.0.0.1:${execution.listeningPort}`;

    const formalMatterRepository = new PostgresFormalMatterRepository(
      markRegDatabase,
      markRegDatabase.getPool()
    );
    const lifecycleRepository = new PostgresLifecycleProjectionRepository(
      markRegDatabase,
      markRegDatabase.getPool()
    );
    const recommendedActionRepository = new PostgresRecommendedActionRepository(
      markRegDatabase,
      markRegDatabase.getPool()
    );
    const lifecycleServiceFor = (requestedWorkspaceId: string) =>
      new LifecycleProjectionService(
        lifecycleRepository,
        formalMatterRepository,
        new HttpReviewedSourceAdmissionReader(executionBaseUrl, secret, requestedWorkspaceId)
      );
    const recommendedActionServiceFor = () =>
      new RecommendedActionService(recommendedActionRepository, lifecycleRepository);
    markReg = createMarkReg({
      port: 0,
      internalServiceSecret: secret,
      executionUrl: executionBaseUrl,
      extraRoutes: [
        ...createMarkRegLifecycleHandoffRoutes({
          internalServiceSecret: secret,
          lifecycleServiceFor,
          recommendedActionServiceFor
        }),
        ...createMarkRegLifecycleSurfaceRoutes({
          internalServiceSecret: secret,
          formalMatterRepository,
          lifecycleServiceFor,
          recommendedActionServiceFor
        })
      ]
    });
    await markReg.start();
    markRegBaseUrl = `http://127.0.0.1:${markReg.listeningPort}`;

    priorExecutionUrl = process.env.EXECUTION_URL;
    process.env.EXECUTION_URL = executionBaseUrl;
    gateway = createGateway({
      port: 0,
      markRegUrl: markRegBaseUrl,
      executionUrl: executionBaseUrl,
      coreUrl: `http://127.0.0.1:${core.listeningPort}`,
      authenticationClient: new HttpCoreAuthenticationClient(
        `http://127.0.0.1:${core.listeningPort}`,
        secret
      ),
      internalServiceSecret: secret,
      csrfSecret,
      allowedOrigins: [origin]
    });
    await gateway.start();
  });

  afterAll(async () => {
    await Promise.allSettled([gateway?.stop(), markReg?.stop(), execution?.stop(), core?.stop()]);
    await Promise.allSettled([
      markRegDatabase.close(),
      executionDatabase.close(),
      coreDatabase.close()
    ]);
    if (priorExecutionUrl === undefined) delete process.env.EXECUTION_URL;
    else process.env.EXECUTION_URL = priorExecutionUrl;
  });

  it('runs PENDING_REVIEW evidence through explicit review, admission, lifecycle, action and acknowledgement', async () => {
    const queue = await get('/api/operations/evidence-review/queue');
    expect(queue.response.status).toBe(200);
    expect(queue.body.items).toHaveLength(1);
    const handoffId = queue.body.items[0].receipt.evidenceHandoff.evidenceHandoffId as string;

    const capture = await post(
      '/api/operations/evidence-review/sources/capture',
      { evidenceHandoffId: handoffId },
      'm5-capture-primary',
      'correlation_m5-runtime-primary'
    );
    expect(capture.response.status).toBe(200);
    const source = capture.body.source;
    expect(source.evidenceHandoffId).toBe(handoffId);

    const capturedAudit = await executionDatabase
      .getPool()
      .query(
        "SELECT actor_id FROM execution_evidence_review_audit WHERE workspace_id=$1 AND action='EVIDENCE_RECEIPT_SOURCE_CAPTURED' ORDER BY audit_id DESC LIMIT 1",
        [workspaceId]
      );
    expect(capturedAudit.rows[0]?.actor_id).toBe(operatorUserId);

    const spoof = await post(
      '/api/operations/evidence-review/decisions',
      {
        reviewerPrincipalId: 'spoofed-reviewer',
        evidenceReceiptId: source.evidenceReceipt.id,
        expectedEvidenceReceiptVersion: source.evidenceReceipt.version,
        expectedEvidenceReceiptFingerprintSha256: source.evidenceReceiptFingerprintSha256,
        outcome: 'ADMITTED_FOR_INTERNAL_USE',
        rationale: 'Spoof attempt must fail.'
      },
      'm5-spoof-primary',
      source.correlationId
    );
    expect(spoof.response.status).toBe(400);
    expect(spoof.body.code).toBe('ACTOR_SPOOF_REJECTED');

    const review = await post(
      '/api/operations/evidence-review/decisions',
      {
        evidenceReceiptId: source.evidenceReceipt.id,
        expectedEvidenceReceiptVersion: source.evidenceReceipt.version,
        expectedEvidenceReceiptFingerprintSha256: source.evidenceReceiptFingerprintSha256,
        outcome: 'ADMITTED_FOR_INTERNAL_USE',
        rationale: 'Authenticated reviewer admits the exact evidence for bounded internal use.',
        correctionReasons: []
      },
      'm5-review-primary',
      source.correlationId
    );
    expect(review.response.status).toBe(201);
    const decision = review.body.decision;
    expect(decision.reviewerPrincipalId).toBe(operatorUserId);
    expect(decision.outcome).toBe('ADMITTED_FOR_INTERNAL_USE');

    const admissionResult = await post(
      '/api/operations/reviewed-source-admissions',
      {
        evidenceReviewDecisionId: decision.evidenceReviewDecisionId,
        expectedEvidenceReviewDecisionVersion: decision.version,
        expectedEvidenceReviewDecisionFingerprintSha256: decision.decisionFingerprintSha256,
        formalMatterId,
        expectedFormalMatterVersion: 1,
        admittedEvidenceReferences: [`provider-evidence://${source.evidenceReceipt.id}`]
      },
      'm5-admit-primary',
      source.correlationId
    );
    expect(admissionResult.response.status).toBe(201);
    const admission = admissionResult.body.admission;

    const delivery = await post(
      '/api/operations/reviewed-source-handoffs/deliver',
      {
        reviewedSourceAdmissionId: admission.reviewedSourceAdmissionId,
        expectedReviewedSourceAdmissionVersion: admission.version,
        expectedAdmissionFingerprintSha256: admission.admissionFingerprintSha256,
        formalMatterId,
        expectedFormalMatterVersion: 1,
        state: 'CUSTOMER_ACTION_NEEDED',
        eventCode: 'CUSTOMER_DOCUMENT_REQUIRED',
        customerSafeLabel: 'Action required',
        customerSafeSummary: 'Please review the requested document action for this Matter.',
        occurredAt: fixedNow
      },
      'm5-deliver-primary',
      source.correlationId
    );
    expect(delivery.response.status).toBe(200);
    expect(delivery.body.result.currentView).toMatchObject({
      state: 'CUSTOMER_ACTION_NEEDED',
      officialStatusVerified: false
    });

    const customer = await get(`/api/markreg/formal-matters/${formalMatterId}/lifecycle`);
    expect(customer.response.status).toBe(200);
    expect(customer.body.lifecycle).toMatchObject({
      state: 'CUSTOMER_ACTION_NEEDED',
      officialStatusVerified: false
    });
    expect(customer.body.recommendedAction).toMatchObject({
      status: 'OPEN',
      executionAuthorized: false
    });
    expect(JSON.stringify(customer.body)).not.toContain('FingerprintSha256');

    const provenance = await get(
      `/api/operations/formal-matters/${formalMatterId}/lifecycle-provenance`
    );
    expect(provenance.response.status).toBe(200);
    expect(provenance.body.reviewSources[0]).toMatchObject({
      admission: { reviewedSourceAdmissionId: admission.reviewedSourceAdmissionId },
      reviewDecision: {
        evidenceReviewDecisionId: decision.evidenceReviewDecisionId,
        reviewerPrincipalId: operatorUserId
      },
      handoff: { status: 'DELIVERED' }
    });

    const crossWorkspace = await get('/api/operations/evidence-review/queue', otherWorkspaceId);
    expect(crossWorkspace.response.status).toBe(403);

    const action = customer.body.recommendedAction;
    const acknowledge = await post(
      `/api/markreg/recommended-actions/${action.recommendedActionId}/acknowledge`,
      { expectedVersion: action.version },
      'm5-action-ack',
      source.correlationId
    );
    expect(acknowledge.response.status).toBe(200);
    expect(acknowledge.body.recommendedAction).toMatchObject({
      status: 'ACKNOWLEDGED',
      executionAuthorized: false
    });
  });

  it('records correction requirements durably without admitting the evidence', async () => {
    const evidenceReceiptRepository = new PostgresProviderReturnEvidenceRepository(
      executionDatabase,
      executionDatabase.getPool()
    );
    await evidenceReceiptRepository.saveReceipt(
      receipt('correction', 'correlation_m5-runtime-correction'),
      'seed-correction',
      sha('d')
    );
    const capture = await post(
      '/api/operations/evidence-review/sources/capture',
      { evidenceHandoffId: 'evidence-handoff_correction' },
      'm5-capture-correction',
      'correlation_m5-runtime-correction'
    );
    expect(capture.response.status).toBe(200);
    const source = capture.body.source;
    const review = await post(
      '/api/operations/evidence-review/decisions',
      {
        evidenceReceiptId: source.evidenceReceipt.id,
        expectedEvidenceReceiptVersion: source.evidenceReceipt.version,
        expectedEvidenceReceiptFingerprintSha256: source.evidenceReceiptFingerprintSha256,
        outcome: 'CORRECTION_REQUIRED',
        rationale: 'A corrected artifact is required before internal admission.',
        correctionReasons: [
          {
            code: 'ARTIFACT_CORRECTION_REQUIRED',
            message: 'Return a corrected artifact with verifiable evidence.',
            evidenceReferences: ['artifact://m5-runtime/correction/receipt.pdf']
          }
        ]
      },
      'm5-review-correction',
      source.correlationId
    );
    expect(review.response.status).toBe(201);
    expect(review.body.correctionRequest).toMatchObject({ status: 'OPEN' });

    const decision = review.body.decision;
    const admission = await post(
      '/api/operations/reviewed-source-admissions',
      {
        evidenceReviewDecisionId: decision.evidenceReviewDecisionId,
        expectedEvidenceReviewDecisionVersion: decision.version,
        expectedEvidenceReviewDecisionFingerprintSha256: decision.decisionFingerprintSha256,
        formalMatterId,
        expectedFormalMatterVersion: 1,
        admittedEvidenceReferences: []
      },
      'm5-admit-correction',
      source.correlationId
    );
    expect(admission.response.status).toBe(409);
    expect(admission.body.code).toBe('REVIEW_DECISION_NOT_ADMISSIBLE');
  });
});