/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- test fixtures intentionally exercise exact cross-service contract snapshots. */
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ExecutionRelease, FilingExecutionTaskDraft } from '@markorbit/contracts';
import {
  evidenceHandoffAuthorityConsequences,
  type ProviderReturn
} from '@markorbit/contracts/provider-execution';
import {
  ManagedDatabase,
  loadMigrationsForOwner,
  migrate,
  migrationStatus,
  verifyMigrations
} from '@markorbit/persistence';
import type {
  ExecutionReleaseRepository,
  FilingExecutionTaskDraftRepository
} from '../src/filing-authorization.js';
import { PostgresProviderReturnEvidenceRepository } from '../src/provider-return-evidence-postgres.js';
import { ProviderReturnEvidenceService } from '../src/provider-return-evidence.js';

const url = process.env.EXECUTION_TEST_DATABASE_URL;
const required = process.env.EXECUTION_PROVIDER_RETURN_EVIDENCE_POSTGRES_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'EXECUTION_TEST_DATABASE_URL is required when EXECUTION_PROVIDER_RETURN_EVIDENCE_POSTGRES_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const workspaceId = '77777777-7777-4777-8777-777777777777';
const otherWorkspaceId = '66666666-6666-4666-8666-666666666666';
const releaseId = 'execution-release_wp06' as const;
const taskId = 'filing-task-draft_wp06' as const;
const providerReturnId = 'provider-return_wp06' as const;
const fingerprint = 'a'.repeat(64);
const correlationId = 'correlation_wp06' as const;
const receivedAt = '2026-08-09T11:30:00.000Z';

const release: ExecutionRelease = {
  schemaVersion: 1,
  version: 3,
  executionReleaseId: releaseId,
  filingAuthorizationId: 'filing-authorization_wp06',
  filingAuthorizationVersion: 2,
  preparationLockId: 'preparation-lock_wp06',
  preparationLockVersion: '1:1:2026-08-09T10:00:00.000Z',
  professionalReviewCaseId: 'professional-review_wp06',
  professionalReviewVersion: 'review-v1',
  customerId: 'customer_wp06',
  jurisdiction: 'US',
  requestedExecutionChannel: 'INTERNAL_MANUAL_PREPARATION',
  checks: [],
  assignment: {},
  decision: {
    decision: 'RELEASE',
    decidedBy: 'user_execution_manager',
    rationale: 'Ready for controlled provider execution.',
    decidedAt: '2026-08-09T10:05:00.000Z'
  },
  evidence: [],
  status: 'RELEASED_FOR_EXECUTION',
  createdAt: '2026-08-09T10:00:00.000Z',
  updatedAt: '2026-08-09T10:05:00.000Z',
  releasedAt: '2026-08-09T10:05:00.000Z'
};

const task: FilingExecutionTaskDraft = {
  schemaVersion: 1,
  filingExecutionTaskDraftId: taskId,
  executionReleaseId: releaseId,
  filingAuthorizationId: 'filing-authorization_wp06',
  preparationLockId: 'preparation-lock_wp06',
  executionSnapshot: {
    jurisdiction: 'US',
    applicantOwnerReference: 'owner_wp06',
    trademarkReference: 'MARK ORBIT',
    classes: ['25'],
    goodsServices: ['clothing'],
    filingBasis: '1(b)',
    useLockedDocuments: true,
    representativeUse: 'PERMITTED_WHERE_REQUIRED',
    permittedFilingChannel: 'INTERNAL_MANUAL_PREPARATION',
    permittedExecutionWindow: {
      startsAt: '2026-08-10T09:00:00.000Z',
      endsAt: '2026-08-10T17:00:00.000Z'
    }
  },
  jurisdiction: 'US',
  applicant: 'Applicant WP06',
  trademark: 'MARK ORBIT',
  classes: ['25'],
  goodsServices: ['clothing'],
  filingBasis: '1(b)',
  documentReferences: ['document_wp06'],
  instructionReferences: ['instruction_wp06'],
  representativeRequirement: 'REVIEW_REQUIRED',
  executionChannel: 'INTERNAL_MANUAL_PREPARATION',
  status: 'PREPARED',
  createdAt: '2026-08-09T10:05:00.000Z'
};

const providerReturn: ProviderReturn & { providerActorId: string } = {
  schemaVersion: 1,
  providerReturnId,
  workspaceId,
  version: 2,
  servicePackage: { id: 'service-package_wp06', version: 1 },
  allocation: { id: 'allocation_wp06', version: 1 },
  providerAcceptance: { id: 'provider-acceptance_wp06', version: 1 },
  providerId: 'provider_wp06',
  providerWorkspaceId: '22222222-2222-4222-8222-222222222222',
  providerActorId: 'user_provider_wp06',
  workStatusClaim: 'Provider reports work completed and returns evidence for review.',
  artifacts: [
    {
      reference: 'artifact://provider/wp06/receipt.pdf',
      fileName: 'receipt.pdf',
      mediaType: 'application/pdf',
      sha256: 'b'.repeat(64)
    }
  ],
  assertions: [
    {
      code: 'PROVIDER_CLAIMS_EXTERNAL_ACTION_OCCURRED',
      value: true,
      evidenceReferences: ['artifact://provider/wp06/receipt.pdf']
    }
  ],
  returnFingerprintSha256: fingerprint,
  status: 'CURRENT',
  supersedes: { id: providerReturnId, version: 1 },
  submittedAt: '2026-08-09T11:20:00.000Z',
  correlationId
};

suite('M4-WP-06 Execution Provider Return evidence handoff', () => {
  const namespace = 'execution_provider_return_evidence_wp06_test';
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: namespace,
    poolMaximum: 6,
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
  let currentRelease: ExecutionRelease | undefined = release;
  let currentTask: FilingExecutionTaskDraft | undefined = task;
  const releases: ExecutionReleaseRepository = {
    create: () => Promise.resolve(),
    findById: () => Promise.resolve(currentRelease ? structuredClone(currentRelease) : undefined),
    list: () => Promise.resolve(currentRelease ? [structuredClone(currentRelease)] : []),
    findActiveByAuthorizationVersion: () => Promise.resolve(currentRelease),
    findByIdempotencyKey: () => Promise.resolve(undefined),
    evaluateChecks: () => Promise.resolve(),
    updateAssignment: () => Promise.resolve(),
    recordDecision: () => Promise.resolve(),
    release: () => Promise.resolve(),
    withdraw: () => Promise.resolve(),
    markStale: () => Promise.resolve()
  };
  const tasks: FilingExecutionTaskDraftRepository = {
    createFromReleasedExecution: () => Promise.resolve(),
    findById: () => Promise.resolve(currentTask ? structuredClone(currentTask) : undefined),
    findByExecutionRelease: () => Promise.resolve(currentTask),
    markStale: () => Promise.resolve(),
    cancel: () => Promise.resolve()
  };
  const service = () =>
    new ProviderReturnEvidenceService(
      evidenceRepository(),
      releases,
      tasks,
      () => receivedAt,
      () => 'evidence-handoff_wp06'
    );
  const command = (key = 'handoff-wp06') => ({
    workspaceId,
    providerReturnId,
    expectedProviderReturnVersion: 2,
    expectedProviderReturnFingerprintSha256: fingerprint,
    executionReleaseId: releaseId,
    expectedExecutionReleaseVersion: 3,
    filingExecutionTaskDraftId: taskId,
    expectedFilingExecutionTaskDraftVersion: 1,
    idempotencyKey: key,
    correlationId
  });

  beforeAll(async () => {
    await database.start();
    const pool = database.getPool();
    await pool.query(
      `DROP TABLE IF EXISTS
         execution_provider_return_evidence_audit,
         execution_provider_return_evidence_commands,
         execution_provider_return_evidence_receipts,
         filing_governance_audit,
         filing_governance_commands,
         filing_execution_task_drafts,
         execution_releases,
         filing_authorizations,
         professional_review_audit,
         professional_review_idempotency,
         professional_review_cases
       CASCADE`
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
    currentRelease = structuredClone(release);
    currentTask = structuredClone(task);
    await database.getPool().query(
      `TRUNCATE
         execution_provider_return_evidence_audit,
         execution_provider_return_evidence_commands,
         execution_provider_return_evidence_receipts
       RESTART IDENTITY CASCADE`
    );
  });

  afterAll(() => database.close());

  it('owns and verifies the Execution evidence migration without weakening prior ownership', async () => {
    const owned = await migrations();
    expect(owned.map((migration) => `${migration.version}_${migration.name}`)).toEqual(
      expect.arrayContaining([
        '0023_execution_professional_reviews',
        '0027_execution_filing_governance',
        '0032_execution_provider_return_evidence'
      ])
    );
    expect(
      (await migrationStatus(database.getPool(), namespace, owned)).every(
        (migration) => migration.state === 'applied'
      )
    ).toBe(true);
    await verifyMigrations(database.getPool(), namespace, owned);
  });

  it('persists one exact reviewable receipt and replays identically after response loss', async () => {
    const first = await service().handoffProviderReturnEvidence({
      command: command(),
      providerReturn
    });
    const replay = await service().handoffProviderReturnEvidence({
      command: command(),
      providerReturn
    });
    expect(replay).toEqual(first);
    expect(first).toMatchObject({
      evidenceHandoffId: 'evidence-handoff_wp06',
      providerReturn: { id: providerReturnId, version: 2 },
      providerReturnFingerprintSha256: fingerprint,
      executionRelease: { id: releaseId, version: 3 },
      filingExecutionTaskDraft: { id: taskId, version: 1 }
    });
    const receipt = await evidenceRepository().findReceipt(first.evidenceHandoffId);
    expect(receipt).toMatchObject({
      providerId: providerReturn.providerId,
      providerWorkspaceId: providerReturn.providerWorkspaceId,
      providerActorId: providerReturn.providerActorId,
      reviewStatus: 'PENDING_REVIEW'
    });
    expect(receipt?.authorityConsequences).toEqual(evidenceHandoffAuthorityConsequences);
    expect(receipt?.authorityConsequences.filingSubmitted).toBe(false);
    expect(receipt?.authorityConsequences.officialApplicationCreated).toBe(false);
    expect(receipt?.authorityConsequences.formalMatterCompletedAutomatically).toBe(false);
  });

  it('fails closed on stale return, changed fingerprint, source mismatch and cross-workspace input', async () => {
    await expect(
      service().handoffProviderReturnEvidence({
        command: { ...command('stale-return'), expectedProviderReturnVersion: 1 },
        providerReturn
      })
    ).rejects.toMatchObject({ code: 'RETURN_SUPERSEDED' });
    await expect(
      service().handoffProviderReturnEvidence({
        command: {
          ...command('bad-fingerprint'),
          expectedProviderReturnFingerprintSha256: 'c'.repeat(64)
        },
        providerReturn
      })
    ).rejects.toMatchObject({ code: 'SOURCE_FINGERPRINT_MISMATCH' });
    currentRelease = { ...release, version: 4 };
    await expect(
      service().handoffProviderReturnEvidence({
        command: command('stale-release'),
        providerReturn
      })
    ).rejects.toMatchObject({ code: 'STALE_SOURCE' });
    currentRelease = release;
    await expect(
      service().handoffProviderReturnEvidence({
        command: { ...command('cross-workspace'), workspaceId: otherWorkspaceId },
        providerReturn
      })
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('keeps evidence audit append-only', async () => {
    await service().handoffProviderReturnEvidence({ command: command('audit'), providerReturn });
    await expect(
      database
        .getPool()
        .query(
          "UPDATE execution_provider_return_evidence_audit SET action='PROVIDER_RETURN_EVIDENCE_RECEIVED'"
        )
    ).rejects.toThrow(/append-only/);
  });
});
