import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { evidenceReviewAuthorityConsequences } from '@markorbit/contracts/evidence-lifecycle';
import { evidenceHandoffAuthorityConsequences } from '@markorbit/contracts/provider-execution';
import {
  ManagedDatabase,
  loadMigrationsForOwner,
  migrate,
  migrationStatus,
  verifyMigrations
} from '@markorbit/persistence';
import { PostgresEvidenceReviewRepository } from '../src/evidence-review-postgres.js';
import {
  EvidenceReviewService,
  type AuthenticatedEvidenceReviewerPrincipal
} from '../src/evidence-review.js';
import { PostgresProviderReturnEvidenceRepository } from '../src/provider-return-evidence-postgres.js';
import type { ExecutionProviderReturnEvidenceReceipt } from '../src/provider-return-evidence.js';

const url = process.env.EXECUTION_TEST_DATABASE_URL;
const required = process.env.EXECUTION_EVIDENCE_REVIEW_POSTGRES_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'EXECUTION_TEST_DATABASE_URL is required when EXECUTION_EVIDENCE_REVIEW_POSTGRES_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;

const workspaceId = '77777777-7777-4777-8777-777777777777';
const otherWorkspaceId = '66666666-6666-4666-8666-666666666666';
const evidenceHandoffId = 'evidence-handoff_wp02' as const;
const providerReturnId = 'provider-return_wp02' as const;
const providerReturnFingerprint = 'a'.repeat(64);
const correlationId = 'correlation_wp02' as const;
const fixedNow = '2026-08-10T06:45:00.000Z';

const reviewer: AuthenticatedEvidenceReviewerPrincipal = {
  workspaceId,
  userId: 'user_evidence_reviewer',
  permissions: ['review:read', 'review:perform']
};

const receipt: ExecutionProviderReturnEvidenceReceipt = {
  schemaVersion: 1,
  evidenceHandoff: {
    schemaVersion: 1,
    evidenceHandoffId,
    workspaceId,
    providerReturn: { id: providerReturnId, version: 2 },
    providerReturnFingerprintSha256: providerReturnFingerprint,
    executionRelease: { id: 'execution-release_wp02', version: 3 },
    filingExecutionTaskDraft: { id: 'filing-task-draft_wp02', version: 1 },
    correlationId,
    handedOffAt: '2026-08-10T06:30:00.000Z'
  },
  providerId: 'provider_wp02',
  providerWorkspaceId: '22222222-2222-4222-8222-222222222222',
  providerActorId: 'user_provider_wp02',
  workStatusClaim: 'Provider returns evidence for governed internal review.',
  artifacts: [
    {
      reference: 'artifact://provider/wp02/receipt.pdf',
      fileName: 'receipt.pdf',
      mediaType: 'application/pdf',
      sha256: 'b'.repeat(64)
    }
  ],
  assertions: [
    {
      code: 'PROVIDER_CLAIMS_EXTERNAL_ACTION_OCCURRED',
      value: true,
      evidenceReferences: ['artifact://provider/wp02/receipt.pdf']
    }
  ],
  reviewStatus: 'PENDING_REVIEW',
  authorityConsequences: evidenceHandoffAuthorityConsequences,
  receivedAt: '2026-08-10T06:30:00.000Z'
};

suite('M5-WP-02 durable Execution Evidence Review Decision', () => {
  const namespace = 'execution_evidence_review_wp02_test';
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: namespace,
    poolMaximum: 8,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: namespace
  });
  const migrations = () =>
    loadMigrationsForOwner(
      path.resolve('../../infrastructure/persistence/migrations'),
      path.resolve('../../infrastructure/persistence/migration-owners.json'),
      '@markorbit/execution-service'
    );
  const evidenceRepository = () =>
    new PostgresProviderReturnEvidenceRepository(database, database.getPool());
  const reviewRepository = () => new PostgresEvidenceReviewRepository(database, database.getPool());
  const service = () =>
    new EvidenceReviewService(
      reviewRepository(),
      evidenceRepository(),
      () => fixedNow,
      () => 'evidence-receipt_wp02',
      () => 'evidence-review-decision_wp02',
      () => 'evidence-correction-request_wp02'
    );

  const decisionCommand = (
    source: Awaited<ReturnType<EvidenceReviewService['captureReviewSource']>>,
    key = 'review-wp02',
    outcome:
      'ADMITTED_FOR_INTERNAL_USE' | 'CORRECTION_REQUIRED' | 'REJECTED' = 'ADMITTED_FOR_INTERNAL_USE'
  ) => ({
    workspaceId,
    evidenceReceiptId: source.evidenceReceipt.id,
    expectedEvidenceReceiptVersion: Number(source.evidenceReceipt.version),
    expectedEvidenceReceiptFingerprintSha256: source.evidenceReceiptFingerprintSha256,
    outcome,
    rationale:
      outcome === 'CORRECTION_REQUIRED'
        ? 'The returned evidence needs a corrected artifact before internal admission.'
        : 'The exact evidence receipt is suitable for bounded internal use.',
    correctionReasons:
      outcome === 'CORRECTION_REQUIRED'
        ? [
            {
              code: 'ARTIFACT_HASH_MISSING',
              message: 'Provide a corrected artifact with verifiable content hash.',
              evidenceReferences: ['artifact://provider/wp02/receipt.pdf']
            }
          ]
        : [],
    idempotencyKey: key,
    correlationId
  });

  async function seedReceipt(value = receipt) {
    const pool = database.getPool();
    await pool.query(
      `INSERT INTO execution_provider_return_evidence_receipts(
         evidence_handoff_id,workspace_id,provider_return_id,provider_return_version,
         provider_return_fingerprint_sha256,provider_id,provider_workspace_id,provider_actor_id,
         execution_release_id,execution_release_version,filing_execution_task_draft_id,
         filing_execution_task_draft_version,correlation_id,review_status,receipt_record,received_at
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16)`,
      [
        value.evidenceHandoff.evidenceHandoffId,
        value.evidenceHandoff.workspaceId,
        value.evidenceHandoff.providerReturn.id,
        Number(value.evidenceHandoff.providerReturn.version),
        value.evidenceHandoff.providerReturnFingerprintSha256,
        value.providerId,
        value.providerWorkspaceId,
        value.providerActorId,
        value.evidenceHandoff.executionRelease.id,
        Number(value.evidenceHandoff.executionRelease.version),
        value.evidenceHandoff.filingExecutionTaskDraft.id,
        String(value.evidenceHandoff.filingExecutionTaskDraft.version),
        value.evidenceHandoff.correlationId,
        value.reviewStatus,
        JSON.stringify(value),
        value.receivedAt
      ]
    );
  }

  async function seedNewerReceipt() {
    const newer: ExecutionProviderReturnEvidenceReceipt = {
      ...structuredClone(receipt),
      evidenceHandoff: {
        ...structuredClone(receipt.evidenceHandoff),
        evidenceHandoffId: 'evidence-handoff_wp02_v3',
        providerReturn: { id: providerReturnId, version: 3 },
        providerReturnFingerprintSha256: 'c'.repeat(64),
        handedOffAt: '2026-08-10T06:40:00.000Z'
      },
      receivedAt: '2026-08-10T06:40:00.000Z'
    };
    await seedReceipt(newer);
  }

  beforeAll(async () => {
    await database.start();
    const pool = database.getPool();
    await pool.query(
      `DROP TABLE IF EXISTS
         execution_evidence_review_audit,
         execution_evidence_review_commands,
         execution_evidence_correction_requests,
         execution_evidence_review_decisions,
         execution_evidence_review_sources,
         execution_provider_return_evidence_audit,
         execution_provider_return_evidence_commands,
         execution_provider_return_evidence_receipts,
         filing_governance_audit,
         filing_governance_commands,
         filing_execution_task_drafts,
         execution_releases,
         filing_authorizations,
         professional_review_audit,
         professional_review_commands,
         professional_review_idempotency,
         professional_review_cases
       CASCADE`
    );
    await pool.query(
      'DROP FUNCTION IF EXISTS reject_execution_evidence_review_audit_mutation() CASCADE'
    );
    await pool.query(
      'DROP FUNCTION IF EXISTS reject_execution_provider_return_evidence_audit_mutation() CASCADE'
    );
    const history = await pool.query<{ migration_history: string | null }>(
      "SELECT to_regclass('markorbit_persistence.migration_history')::text AS migration_history"
    );
    if (history.rows[0]?.migration_history)
      await pool.query('DELETE FROM markorbit_persistence.migration_history WHERE namespace=$1', [
        namespace
      ]);
    await migrate(pool, namespace, await migrations());
  });

  beforeEach(async () => {
    const pool = database.getPool();
    await pool.query(
      `TRUNCATE
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
    await pool.query(
      `INSERT INTO filing_authorizations(
         filing_authorization_id,workspace_id,preparation_lock_id,preparation_lock_version,status,version,
         authorization_record,created_by,updated_by,created_at,updated_at
       ) VALUES('filing-authorization_wp02',$1,'preparation-lock_wp02','1','AUTHORIZED',2,'{}'::jsonb,$2,$2,$3,$3)`,
      [workspaceId, reviewer.userId, fixedNow]
    );
    await pool.query(
      `INSERT INTO execution_releases(
         execution_release_id,workspace_id,filing_authorization_id,filing_authorization_version,status,version,
         release_record,created_by,updated_by,created_at,updated_at
       ) VALUES('execution-release_wp02',$1,'filing-authorization_wp02',2,'RELEASED_FOR_EXECUTION',3,'{}'::jsonb,$2,$2,$3,$3)`,
      [workspaceId, reviewer.userId, fixedNow]
    );
    await pool.query(
      `INSERT INTO filing_execution_task_drafts(
         filing_execution_task_draft_id,workspace_id,execution_release_id,filing_authorization_id,status,
         task_record,created_by,updated_by,created_at,updated_at
       ) VALUES('filing-task-draft_wp02',$1,'execution-release_wp02','filing-authorization_wp02','PREPARED','{}'::jsonb,$2,$2,$3,$3)`,
      [workspaceId, reviewer.userId, fixedNow]
    );
    await seedReceipt();
  });

  afterAll(() => database.close());

  it('owns and verifies migration 0033 after the M4 evidence receipt migration', async () => {
    const owned = await migrations();
    expect(owned.map((migration) => `${migration.version}_${migration.name}`)).toEqual(
      expect.arrayContaining([
        '0023_execution_professional_reviews',
        '0027_execution_filing_governance',
        '0032_execution_provider_return_evidence',
        '0033_execution_evidence_review'
      ])
    );
    expect(
      (await migrationStatus(database.getPool(), namespace, owned)).every(
        (migration) => migration.state === 'applied'
      )
    ).toBe(true);
    await verifyMigrations(database.getPool(), namespace, owned);
  });

  it('captures one stable exact receipt identity and records an authenticated admitted decision idempotently', async () => {
    const firstSource = await service().captureReviewSource(evidenceHandoffId, reviewer);
    const replayedSource = await service().captureReviewSource(evidenceHandoffId, reviewer);
    expect(replayedSource).toEqual(firstSource);
    expect(firstSource).toMatchObject({
      workspaceId,
      evidenceReceipt: { id: 'evidence-receipt_wp02', version: 1 },
      evidenceHandoffId,
      providerReturn: { id: providerReturnId, version: 2 },
      providerReturnFingerprintSha256: providerReturnFingerprint,
      providerId: receipt.providerId,
      correlationId
    });
    expect(firstSource.evidenceReceiptFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);

    const first = await service().recordDecision(decisionCommand(firstSource), reviewer);
    const replay = await service().recordDecision(decisionCommand(firstSource), reviewer);
    expect(replay).toEqual(first);
    expect(first).toMatchObject({
      evidenceReviewDecisionId: 'evidence-review-decision_wp02',
      workspaceId,
      version: 1,
      outcome: 'ADMITTED_FOR_INTERNAL_USE',
      reviewerPrincipalId: reviewer.userId,
      source: firstSource
    });
    expect(first.authorityConsequences).toEqual(evidenceReviewAuthorityConsequences);
    expect(first.authorityConsequences.providerReturnCertifiedAsOfficialTruth).toBe(false);
    expect(first.authorityConsequences.filingSubmitted).toBe(false);
    expect(first.authorityConsequences.trademarkOfficeAcceptance).toBe(false);
    expect(first.authorityConsequences.formalMatterCompletedAutomatically).toBe(false);
  });

  it('creates a durable correction request without mutating historical evidence receipt content', async () => {
    const source = await service().captureReviewSource(evidenceHandoffId, reviewer);
    const before = await database
      .getPool()
      .query<{ receipt_record: unknown }>(
        'SELECT receipt_record FROM execution_provider_return_evidence_receipts WHERE evidence_handoff_id=$1',
        [evidenceHandoffId]
      );
    const decision = await service().recordDecision(
      decisionCommand(source, 'correction-wp02', 'CORRECTION_REQUIRED'),
      reviewer
    );
    expect(decision.correctionRequest).toEqual({
      id: 'evidence-correction-request_wp02',
      version: 1
    });
    const correction = await service().getCorrectionRequest(
      decision.evidenceReviewDecisionId,
      reviewer
    );
    expect(correction).toMatchObject({
      workspaceId,
      status: 'OPEN',
      providerReturn: { id: providerReturnId, version: 2 },
      requestedBy: reviewer.userId
    });
    const after = await database
      .getPool()
      .query<{ receipt_record: unknown }>(
        'SELECT receipt_record FROM execution_provider_return_evidence_receipts WHERE evidence_handoff_id=$1',
        [evidenceHandoffId]
      );
    expect(after.rows[0]?.receipt_record).toEqual(before.rows[0]?.receipt_record);
  });

  it('fails closed on superseded receipt, exact-version mismatch and fingerprint mismatch', async () => {
    const source = await service().captureReviewSource(evidenceHandoffId, reviewer);
    await expect(
      service().recordDecision(
        { ...decisionCommand(source, 'version-mismatch'), expectedEvidenceReceiptVersion: 2 },
        reviewer
      )
    ).rejects.toMatchObject({ code: 'SOURCE_VERSION_MISMATCH' });
    await expect(
      service().recordDecision(
        {
          ...decisionCommand(source, 'fingerprint-mismatch'),
          expectedEvidenceReceiptFingerprintSha256: 'd'.repeat(64)
        },
        reviewer
      )
    ).rejects.toMatchObject({ code: 'SOURCE_FINGERPRINT_MISMATCH' });
    await seedNewerReceipt();
    await expect(
      service().recordDecision(decisionCommand(source, 'superseded'), reviewer)
    ).rejects.toMatchObject({ code: 'STALE_SOURCE' });
  });

  it('binds reviewer identity to the authenticated principal and fails closed on Workspace or permission spoofing', async () => {
    const source = await service().captureReviewSource(evidenceHandoffId, reviewer);
    const spoofed = {
      ...decisionCommand(source, 'identity-spoof'),
      reviewerPrincipalId: 'user_attacker'
    } as ReturnType<typeof decisionCommand> & { reviewerPrincipalId: string };
    const decision = await service().recordDecision(spoofed, reviewer);
    expect(decision.reviewerPrincipalId).toBe(reviewer.userId);

    const freshDatabaseSource = async () => {
      await database.getPool().query(
        `DELETE FROM execution_evidence_review_commands;
         DELETE FROM execution_evidence_correction_requests;
         DELETE FROM execution_evidence_review_decisions;
         DELETE FROM execution_evidence_review_audit;
         DELETE FROM execution_evidence_review_sources;`
      );
      return service().captureReviewSource(evidenceHandoffId, reviewer);
    };
    const fresh = await freshDatabaseSource();
    await expect(
      service().recordDecision(
        { ...decisionCommand(fresh, 'workspace-spoof'), workspaceId: otherWorkspaceId },
        reviewer
      )
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(
      service().recordDecision(decisionCommand(fresh, 'permission-spoof'), {
        ...reviewer,
        permissions: ['review:read']
      })
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('serializes concurrent conflicting decisions so only one authoritative decision exists', async () => {
    const source = await service().captureReviewSource(evidenceHandoffId, reviewer);
    const admitted = service().recordDecision(
      decisionCommand(source, 'concurrent-admit'),
      reviewer
    );
    const rejected = service().recordDecision(
      decisionCommand(source, 'concurrent-reject', 'REJECTED'),
      reviewer
    );
    const results = await Promise.allSettled([admitted, rejected]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejectedResult = results.find((result) => result.status === 'rejected');
    expect(rejectedResult).toMatchObject({
      status: 'rejected',
      reason: { code: 'VERSION_CONFLICT' }
    });
    const rows = await database
      .getPool()
      .query('SELECT evidence_review_decision_id FROM execution_evidence_review_decisions');
    expect(rows.rowCount).toBe(1);
  });

  it('keeps review audit provenance append-only', async () => {
    const source = await service().captureReviewSource(evidenceHandoffId, reviewer);
    await service().recordDecision(decisionCommand(source, 'audit-wp02'), reviewer);
    await expect(
      database
        .getPool()
        .query(
          "UPDATE execution_evidence_review_audit SET action='EVIDENCE_REVIEW_DECISION_RECORDED'"
        )
    ).rejects.toThrow(/append-only/);
  });
});
