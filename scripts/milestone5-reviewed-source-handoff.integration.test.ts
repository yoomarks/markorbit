import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FormalMatterId, WorkspacePrincipal } from '@markorbit/contracts';
import { evidenceHandoffAuthorityConsequences } from '@markorbit/contracts/provider-execution';
import type { ReviewedSourceAdmissionEnvelope } from '@markorbit/contracts/evidence-lifecycle';
import {
  ManagedDatabase,
  loadMigrationsForOwner,
  migrate
} from '@markorbit/persistence';
import { createServiceRuntime, type ServiceRuntime } from '@markorbit/service-kit';
import { EvidenceReviewService } from '../services/execution/src/evidence-review.js';
import { PostgresEvidenceReviewRepository } from '../services/execution/src/evidence-review-postgres.js';
import { PostgresProviderReturnEvidenceRepository } from '../services/execution/src/provider-return-evidence-postgres.js';
import type { ExecutionProviderReturnEvidenceReceipt } from '../services/execution/src/provider-return-evidence.js';
import {
  PostgresReviewedSourceAdmissionRepository,
  ReviewedSourceAdmissionService,
  ReviewedSourceHandoffError,
  ReviewedSourceHandoffService,
  type DeliverReviewedSourceCommand,
  type MarkRegLifecycleProjectionClient
} from '../services/execution/src/reviewed-source-handoff.js';
import {
  createExecutionReviewedSourceInternalRoutes,
  HttpMarkRegLifecycleProjectionClient
} from '../services/execution/src/reviewed-source-handoff-http.js';
import { PostgresFormalMatterRepository } from '../services/markreg/src/formal-matter.js';
import {
  LifecycleProjectionService,
  PostgresLifecycleProjectionRepository
} from '../services/markreg/src/lifecycle-projection.js';
import {
  createMarkRegLifecycleHandoffRoutes,
  HttpReviewedSourceAdmissionReader
} from '../services/markreg/src/lifecycle-handoff-http.js';

const executionUrl = process.env.M5_REVIEWED_SOURCE_EXECUTION_DATABASE_URL;
const markRegUrl = process.env.M5_REVIEWED_SOURCE_MARKREG_DATABASE_URL;
const required = process.env.M5_REVIEWED_SOURCE_HANDOFF_POSTGRES_REQUIRED === '1';
if (required && (!executionUrl || !markRegUrl))
  throw new Error(
    'M5_REVIEWED_SOURCE_EXECUTION_DATABASE_URL and M5_REVIEWED_SOURCE_MARKREG_DATABASE_URL are required.'
  );
const suite = executionUrl && markRegUrl ? describe : describe.skip;

const workspaceId = '22222222-2222-4222-8222-222222222222';
const otherWorkspaceId = '33333333-3333-4333-8333-333333333333';
const secret = 'm5-wp05-internal-service-secret-32-bytes-minimum';
const fixedNow = '2026-08-10T02:30:00.000Z';
const sha = (character: string) => character.repeat(64);
const reviewer: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session_wp05',
  userId: 'user_wp05_reviewer',
  workspaceId,
  membershipId: 'membership_wp05',
  role: 'REVIEWER',
  permissions: ['review:read', 'review:perform'],
  sessionExpiresAt: '2026-08-11T02:30:00.000Z'
};

suite('M5-WP-05 retry-safe Execution-to-MarkReg Reviewed Source handoff', () => {
  const executionDatabase = new ManagedDatabase({
    connection: { url: executionUrl! },
    applicationName: 'm5-wp05-execution',
    poolMaximum: 8,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'm5_wp05_execution'
  });
  const markRegDatabase = new ManagedDatabase({
    connection: { url: markRegUrl! },
    applicationName: 'm5-wp05-markreg',
    poolMaximum: 8,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'm5_wp05_markreg'
  });
  const migrationsDirectory = path.resolve('infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('infrastructure/persistence/migration-owners.json');
  const executionMigrations = () =>
    loadMigrationsForOwner(
      migrationsDirectory,
      migrationOwners,
      '@markorbit/execution-service'
    );
  const markRegMigrations = () =>
    loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/markreg-service');

  const evidenceRepository = () =>
    new PostgresProviderReturnEvidenceRepository(executionDatabase, executionDatabase.getPool());
  const reviewRepository = () =>
    new PostgresEvidenceReviewRepository(executionDatabase, executionDatabase.getPool());
  const reviewedSourceRepository = () =>
    new PostgresReviewedSourceAdmissionRepository(executionDatabase, executionDatabase.getPool());
  const admissionService = () =>
    new ReviewedSourceAdmissionService(
      reviewedSourceRepository(),
      reviewRepository(),
      () => fixedNow,
      () => 'reviewed-source-admission_wp05'
    );

  beforeAll(async () => {
    await Promise.all([executionDatabase.start(), markRegDatabase.start()]);
    await migrate(
      executionDatabase.getPool(),
      'm5_wp05_execution',
      await executionMigrations()
    );
    await migrate(markRegDatabase.getPool(), 'm5_wp05_markreg', await markRegMigrations());
  });

  beforeEach(async () => {
    await executionDatabase.getPool().query(
      `TRUNCATE
         execution_reviewed_source_handoff_audit,
         execution_reviewed_source_handoffs,
         execution_reviewed_source_admission_commands,
         execution_reviewed_source_admissions,
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
         filing_authorizations
       RESTART IDENTITY CASCADE`
    );
    await markRegDatabase.getPool().query(
      `TRUNCATE
         markreg_recommended_action_commands,
         markreg_recommended_action_audit,
         markreg_recommended_actions,
         markreg_lifecycle_commands,
         markreg_lifecycle_views,
         markreg_lifecycle_events,
         formal_matters
       RESTART IDENTITY CASCADE`
    );
    await executionDatabase.getPool().query(
      `INSERT INTO filing_authorizations(
         filing_authorization_id,workspace_id,preparation_lock_id,preparation_lock_version,status,version,
         authorization_record,created_by,updated_by,created_at,updated_at
       ) VALUES('filing-authorization_wp05',$1,'preparation-lock_wp05','1','AUTHORIZED',2,'{}'::jsonb,$2,$2,$3,$3)`,
      [workspaceId, reviewer.userId, fixedNow]
    );
    await executionDatabase.getPool().query(
      `INSERT INTO execution_releases(
         execution_release_id,workspace_id,filing_authorization_id,filing_authorization_version,status,version,
         release_record,created_by,updated_by,created_at,updated_at
       ) VALUES('execution-release_wp05',$1,'filing-authorization_wp05',2,'RELEASED_FOR_EXECUTION',3,'{}'::jsonb,$2,$2,$3,$3)`,
      [workspaceId, reviewer.userId, fixedNow]
    );
    await executionDatabase.getPool().query(
      `INSERT INTO filing_execution_task_drafts(
         filing_execution_task_draft_id,workspace_id,execution_release_id,filing_authorization_id,status,
         task_record,created_by,updated_by,created_at,updated_at
       ) VALUES('filing-task-draft_wp05',$1,'execution-release_wp05','filing-authorization_wp05','PREPARED','{}'::jsonb,$2,$2,$3,$3)`,
      [workspaceId, reviewer.userId, fixedNow]
    );
  });

  afterAll(async () => {
    await Promise.all([executionDatabase.close(), markRegDatabase.close()]);
  });

  function receipt(
    suffix: string,
    providerReturnVersion: number,
    fingerprintCharacter: string
  ): ExecutionProviderReturnEvidenceReceipt {
    return {
      schemaVersion: 1,
      evidenceHandoff: {
        schemaVersion: 1,
        evidenceHandoffId: `evidence-handoff_${suffix}`,
        workspaceId,
        providerReturn: { id: `provider-return_${suffix.split('-')[0]}`, version: providerReturnVersion },
        providerReturnFingerprintSha256: sha(fingerprintCharacter),
        executionRelease: { id: 'execution-release_wp05', version: 3 },
        filingExecutionTaskDraft: { id: 'filing-task-draft_wp05', version: 1 },
        correlationId: `correlation_${suffix.split('-')[0]}`,
        handedOffAt: fixedNow
      },
      providerId: 'provider_wp05',
      providerWorkspaceId: '77777777-7777-4777-8777-777777777777',
      providerActorId: 'user_provider_wp05',
      workStatusClaim: 'Provider evidence is returned for governed internal review.',
      artifacts: [
        {
          reference: `artifact://provider/${suffix}/receipt.pdf`,
          fileName: 'receipt.pdf',
          mediaType: 'application/pdf',
          sha256: sha('b')
        }
      ],
      assertions: [
        {
          code: 'PROVIDER_CLAIMS_EXTERNAL_ACTION_OCCURRED',
          value: true,
          evidenceReferences: [`artifact://provider/${suffix}/receipt.pdf`]
        }
      ],
      reviewStatus: 'PENDING_REVIEW',
      authorityConsequences: evidenceHandoffAuthorityConsequences,
      receivedAt: fixedNow
    };
  }

  async function review(
    value: ExecutionProviderReturnEvidenceReceipt,
    suffix: string,
    outcome: 'ADMITTED_FOR_INTERNAL_USE' | 'CORRECTION_REQUIRED'
  ) {
    await evidenceRepository().saveReceipt(value, `seed-${suffix}`, sha('e'));
    const service = new EvidenceReviewService(
      reviewRepository(),
      evidenceRepository(),
      () => fixedNow,
      () => `evidence-receipt_${suffix}`,
      () => `evidence-review-decision_${suffix}`,
      () => `evidence-correction-request_${suffix}`
    );
    const source = await service.captureReviewSource(value.evidenceHandoff.evidenceHandoffId, reviewer);
    const decision = await service.recordDecision(
      {
        workspaceId,
        evidenceReceiptId: source.evidenceReceipt.id,
        expectedEvidenceReceiptVersion: Number(source.evidenceReceipt.version),
        expectedEvidenceReceiptFingerprintSha256: source.evidenceReceiptFingerprintSha256,
        outcome,
        rationale:
          outcome === 'CORRECTION_REQUIRED'
            ? 'Corrected provider evidence is required before internal admission.'
            : 'The exact reviewed evidence is suitable for bounded internal lifecycle use.',
        correctionReasons:
          outcome === 'CORRECTION_REQUIRED'
            ? [
                {
                  code: 'ARTIFACT_HASH_MISSING',
                  message: 'Return a corrected artifact with verifiable content hash.',
                  evidenceReferences: value.artifacts.map((artifact) => artifact.reference)
                }
              ]
            : [],
        idempotencyKey: `review-${suffix}`,
        correlationId: value.evidenceHandoff.correlationId
      },
      reviewer
    );
    return { source, decision };
  }

  async function insertMatter(formalMatterId: FormalMatterId) {
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
        JSON.stringify({ preparation: { applicantName: 'Orbit Ltd', trademark: 'ORBIT' } }),
        sha('f'),
        reviewer.userId,
        fixedNow
      ]
    );
  }

  async function admit(
    decision: Awaited<ReturnType<typeof review>>['decision'],
    formalMatterId: FormalMatterId,
    key: string,
    id = 'reviewed-source-admission_wp05'
  ) {
    const service = new ReviewedSourceAdmissionService(
      reviewedSourceRepository(),
      reviewRepository(),
      () => fixedNow,
      () => id as ReviewedSourceAdmissionEnvelope['reviewedSourceAdmissionId']
    );
    return service.admit(
      {
        workspaceId,
        evidenceReviewDecisionId: decision.evidenceReviewDecisionId,
        expectedEvidenceReviewDecisionVersion: Number(decision.version),
        expectedEvidenceReviewDecisionFingerprintSha256: decision.decisionFingerprintSha256,
        formalMatterId,
        expectedFormalMatterVersion: 1,
        admittedEvidenceReferences: decision.source.evidenceReceipt.id
          ? [`provider-evidence://${decision.source.evidenceReceipt.id}`]
          : [],
        idempotencyKey: key,
        correlationId: decision.correlationId
      },
      reviewer
    );
  }

  function deliveryCommand(admission: ReviewedSourceAdmissionEnvelope): DeliverReviewedSourceCommand {
    return {
      workspaceId,
      reviewedSourceAdmissionId: admission.reviewedSourceAdmissionId,
      expectedReviewedSourceAdmissionVersion: admission.version,
      expectedAdmissionFingerprintSha256: admission.admissionFingerprintSha256,
      formalMatterId: admission.formalMatter.id,
      expectedFormalMatterVersion: admission.formalMatter.version,
      state: 'REVIEWED_PROVIDER_EVIDENCE',
      eventCode: 'PROVIDER_EVIDENCE_REVIEWED',
      customerSafeLabel: 'Evidence reviewed',
      customerSafeSummary:
        'Reviewed provider evidence is available for internal lifecycle tracking.',
      occurredAt: fixedNow,
      idempotencyKey: `deliver-${admission.reviewedSourceAdmissionId}`,
      correlationId: admission.correlationId
    };
  }

  async function startExecutionRuntime(
    current: { service?: ReviewedSourceHandoffService }
  ): Promise<ServiceRuntime> {
    const admission = admissionService();
    const runtime = createServiceRuntime(
      { name: 'execution-wp05-test', port: 0, version: '1' },
      {
        routes: createExecutionReviewedSourceInternalRoutes({
          internalServiceSecret: secret,
          admissionServiceFor: () => admission,
          handoffServiceFor: () => {
            if (!current.service) throw new Error('Handoff service is not initialized.');
            return current.service;
          }
        })
      }
    );
    await runtime.start();
    return runtime;
  }

  async function startMarkRegRuntime(executionBaseUrl: string): Promise<ServiceRuntime> {
    const runtime = createServiceRuntime(
      { name: 'markreg-wp05-test', port: 0, version: '1' },
      {
        routes: createMarkRegLifecycleHandoffRoutes({
          internalServiceSecret: secret,
          lifecycleServiceFor: (requestedWorkspaceId) =>
            new LifecycleProjectionService(
              new PostgresLifecycleProjectionRepository(
                markRegDatabase,
                markRegDatabase.getPool()
              ),
              new PostgresFormalMatterRepository(markRegDatabase, markRegDatabase.getPool()),
              new HttpReviewedSourceAdmissionReader(
                executionBaseUrl,
                secret,
                requestedWorkspaceId
              ),
              () => fixedNow
            )
        })
      }
    );
    await runtime.start();
    return runtime;
  }

  async function deliverOverHttp(baseUrl: string, command: DeliverReviewedSourceCommand) {
    const response = await fetch(`${baseUrl}/internal/reviewed-source-handoffs/deliver`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-markorbit-internal-authorization': secret,
        'x-markorbit-workspace-id': command.workspaceId
      },
      body: JSON.stringify({ command })
    });
    return { response, body: (await response.json()) as Record<string, unknown> };
  }

  it('recovers from MarkReg response loss across restart without duplicate lifecycle state', async () => {
    const formalMatterId = 'formal-matter_wp05-loss' as FormalMatterId;
    await insertMatter(formalMatterId);
    const reviewed = await review(receipt('loss-v1', 1, 'a'), 'loss-v1', 'ADMITTED_FOR_INTERNAL_USE');
    const admission = await admit(reviewed.decision, formalMatterId, 'admit-loss');
    const handoff = { service: undefined as ReviewedSourceHandoffService | undefined };
    let executionRuntime = await startExecutionRuntime(handoff);
    const executionBaseUrl = `http://127.0.0.1:${executionRuntime.listeningPort}`;
    let markRegRuntime = await startMarkRegRuntime(executionBaseUrl);
    let markRegBaseUrl = `http://127.0.0.1:${markRegRuntime.listeningPort}`;
    const realClient = new HttpMarkRegLifecycleProjectionClient(markRegBaseUrl, secret);

    class LoseFirstResponse implements MarkRegLifecycleProjectionClient {
      calls = 0;
      constructor(private readonly inner: MarkRegLifecycleProjectionClient) {}
      async project(command: Parameters<MarkRegLifecycleProjectionClient['project']>[0]) {
        this.calls += 1;
        const result = await this.inner.project(command);
        if (this.calls === 1) throw new Error('simulated response loss after MarkReg commit');
        return result;
      }
    }
    const lossy = new LoseFirstResponse(realClient);
    handoff.service = new ReviewedSourceHandoffService(
      reviewedSourceRepository(),
      lossy,
      () => fixedNow
    );
    const command = deliveryCommand(admission);

    const first = await deliverOverHttp(executionBaseUrl, command);
    expect(first.response.status).toBe(503);
    expect(first.body).toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE', retryable: true });
    expect(await reviewedSourceRepository().getDelivery(workspaceId, admission.reviewedSourceAdmissionId)).toMatchObject({
      status: 'PENDING',
      attemptCount: 1,
      lastErrorCode: 'DEPENDENCY_UNAVAILABLE'
    });
    const committed = await markRegDatabase.getPool().query(
      'SELECT lifecycle_event_id FROM markreg_lifecycle_events'
    );
    expect(committed.rowCount).toBe(1);
    const committedEventId = String(committed.rows[0]!.lifecycle_event_id);

    await markRegRuntime.stop();
    markRegRuntime = await startMarkRegRuntime(executionBaseUrl);
    markRegBaseUrl = `http://127.0.0.1:${markRegRuntime.listeningPort}`;
    handoff.service = new ReviewedSourceHandoffService(
      reviewedSourceRepository(),
      new HttpMarkRegLifecycleProjectionClient(markRegBaseUrl, secret),
      () => fixedNow
    );

    const retry = await deliverOverHttp(executionBaseUrl, command);
    expect(retry.response.status).toBe(200);
    expect(retry.body).toMatchObject({
      result: { event: { lifecycleEventId: committedEventId, officialStatusVerified: false } }
    });
    expect(await reviewedSourceRepository().getDelivery(workspaceId, admission.reviewedSourceAdmissionId)).toMatchObject({
      status: 'DELIVERED',
      attemptCount: 2
    });
    expect(
      Number(
        (
          await markRegDatabase.getPool().query('SELECT count(*) AS count FROM markreg_lifecycle_events')
        ).rows[0]!.count
      )
    ).toBe(1);

    await executionRuntime.stop();
    executionRuntime = await startExecutionRuntime(handoff);
    const restartedExecutionUrl = `http://127.0.0.1:${executionRuntime.listeningPort}`;
    const replay = await deliverOverHttp(restartedExecutionUrl, command);
    expect(replay.response.status).toBe(200);
    expect(replay.body).toEqual(retry.body);
    expect(await reviewedSourceRepository().getDelivery(workspaceId, admission.reviewedSourceAdmissionId)).toMatchObject({
      status: 'DELIVERED',
      attemptCount: 2
    });
    expect(
      Number(
        (
          await markRegDatabase.getPool().query('SELECT count(*) AS count FROM markreg_lifecycle_events')
        ).rows[0]!.count
      )
    ).toBe(1);

    const denied = await fetch(
      `${restartedExecutionUrl}/internal/reviewed-source-admissions/${encodeURIComponent(admission.reviewedSourceAdmissionId)}`,
      {
        headers: {
          'x-markorbit-internal-authorization': secret,
          'x-markorbit-workspace-id': otherWorkspaceId
        }
      }
    );
    expect(denied.status).toBe(404);

    await Promise.all([executionRuntime.stop(), markRegRuntime.stop()]);
  });

  it('preserves correction history and admits only corrected newer reviewed evidence', async () => {
    const formalMatterId = 'formal-matter_wp05-correction' as FormalMatterId;
    await insertMatter(formalMatterId);
    const firstReceipt = receipt('correction-v1', 1, 'a');
    const correction = await review(firstReceipt, 'correction-v1', 'CORRECTION_REQUIRED');
    await expect(admit(correction.decision, formalMatterId, 'admit-correction-v1')).rejects.toMatchObject({
      code: 'REVIEW_DECISION_NOT_ADMISSIBLE'
    } satisfies Partial<ReviewedSourceHandoffError>);
    const correctionRows = await executionDatabase.getPool().query(
      'SELECT correction_request_id,status,evidence_review_decision_id FROM execution_evidence_correction_requests'
    );
    expect(correctionRows.rows).toMatchObject([
      {
        correction_request_id: 'evidence-correction-request_correction-v1',
        status: 'OPEN',
        evidence_review_decision_id: 'evidence-review-decision_correction-v1'
      }
    ]);

    const correctedReceipt = receipt('correction-v2', 2, 'c');
    const corrected = await review(correctedReceipt, 'correction-v2', 'ADMITTED_FOR_INTERNAL_USE');
    const admission = await admit(
      corrected.decision,
      formalMatterId,
      'admit-correction-v2',
      'reviewed-source-admission_wp05-correction-v2'
    );
    expect(admission).toMatchObject({
      evidenceSource: { providerReturn: { version: 2 } },
      reviewDecision: { id: 'evidence-review-decision_correction-v2' },
      formalMatter: { id: formalMatterId, version: 1 }
    });
    expect(
      (
        await executionDatabase.getPool().query(
          'SELECT correction_request_id,status FROM execution_evidence_correction_requests'
        )
      ).rows
    ).toEqual([
      {
        correction_request_id: 'evidence-correction-request_correction-v1',
        status: 'OPEN'
      }
    ]);
  });
});
