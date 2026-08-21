/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/require-await -- fixture sources intentionally implement async service boundaries and adapter-role casts. */
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PreparationLock } from '@markorbit/contracts';
import {
  ManagedDatabase,
  loadMigrationsForOwner,
  migrate,
  migrationStatus,
  verifyMigrations
} from '@markorbit/persistence';
import {
  FilingGovernanceService,
  type FilingGovernanceError
} from '../src/filing-authorization.js';
import { PostgresFilingGovernanceRepository } from '../src/filing-authorization-postgres.js';

const url = process.env.EXECUTION_TEST_DATABASE_URL;
const required = process.env.EXECUTION_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'EXECUTION_TEST_DATABASE_URL is required when EXECUTION_POSTGRES_TEST_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const workspaceId = '77777777-7777-4777-8777-777777777777';
const otherWorkspaceId = '66666666-6666-4666-8666-666666666666';
const actorId = 'user_execution_manager';
const at = '2026-08-09T04:00:00.000Z';
const sourceVersion = `2:3:${at}`;
const codes = [
  'APPLICANT_OWNER_CONFIRMED',
  'MARK_CONFIRMED',
  'JURISDICTION_CLASSES_GOODS_CONFIRMED',
  'LOCKED_DOCUMENT_USE_AUTHORIZED',
  'FILING_INSTRUCTION_PREPARATION_AUTHORIZED',
  'AUTHORIZATION_IS_NOT_SUBMISSION',
  'REPRESENTATIVE_APPOINTMENT_MAY_BE_REQUIRED',
  'SCOPE_CHANGE_REQUIRES_REAUTHORIZATION',
  'OFFICE_ACCEPTANCE_NOT_GUARANTEED'
] as const;
const lock: PreparationLock = {
  schemaVersion: 1,
  preparationLockId: 'preparation-lock_wp02',
  documentPackageId: 'document-package_wp02',
  documentPackageVersion: 2,
  instructionLedgerId: 'instruction-ledger_wp02',
  instructionLedgerVersion: 3,
  lockedAt: at,
  snapshot: {
    sourceReviewDecisionVersion: 'review-wp02-v1',
    sourceMatterDraftVersion: 'matter-wp02-v1',
    commercialScopeUnchanged: true,
    documentPackage: {
      schemaVersion: 1,
      documentPackageId: 'document-package_wp02',
      version: 2,
      professionalReviewCaseId: 'professional-review_wp02',
      professionalReviewDecisionVersion: 'review-wp02-v1',
      matterDraftId: 'matter-draft_wp02',
      matterDraftVersion: 'matter-wp02-v1',
      customerConfirmationId: 'confirmation_wp02',
      customerId: 'customer_wp02',
      jurisdiction: 'US',
      trademarkReference: 'MARK ORBIT WP02',
      requirements: [],
      documentItems: [],
      validationChecks: [],
      missingRequirements: [],
      status: 'LOCKED_FOR_PREPARATION',
      createdAt: at,
      updatedAt: at,
      lockedAt: at
    },
    instructionLedger: {
      schemaVersion: 1,
      instructionLedgerId: 'instruction-ledger_wp02',
      version: 3,
      documentPackageId: 'document-package_wp02',
      documentPackageVersion: 2,
      customerId: 'customer_wp02',
      matterDraftId: 'matter-draft_wp02',
      matterDraftVersion: 'matter-wp02-v1',
      professionalReviewCaseId: 'professional-review_wp02',
      professionalReviewDecisionVersion: 'review-wp02-v1',
      entries: [],
      acknowledgements: [],
      status: 'LOCKED_FOR_PREPARATION',
      currentEffectiveInstructionSet: {},
      createdAt: at,
      updatedAt: at,
      lockedAt: at
    }
  },
  nextPermittedAction: 'GOVERNED_FILING_AUTHORITY_REVIEW',
  consequences: {
    orderCreated: false,
    paymentCreated: false,
    formalMatterCreated: false,
    professionalAppointed: false,
    filingCreated: false,
    filingSubmitted: false,
    customerMessageSent: false,
    externalDocumentSent: false,
    trademarkOfficeContacted: false
  }
};

suite('PostgreSQL Filing Authorization / Execution Release governance', () => {
  const namespace = 'execution_filing_governance_wp02_test';
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: namespace,
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: namespace
  });
  let currentLock: PreparationLock | undefined;
  const migrations = () =>
    loadMigrationsForOwner(
      path.resolve('../../infrastructure/persistence/migrations'),
      path.resolve('../../infrastructure/persistence/migration-owners.json'),
      '@markorbit/execution-service'
    );
  const truncate = () =>
    database.getPool().query(
      `TRUNCATE
         filing_execution_task_drafts,
         execution_releases,
         filing_authorizations,
         filing_governance_commands,
         filing_governance_audit
       RESTART IDENTITY CASCADE`
    );
  const repository = (workspace = workspaceId, actor = actorId) =>
    new PostgresFilingGovernanceRepository(
      database,
      database.getPool(),
      workspace,
      actor,
      'correlation-wp02',
      () => at
    );
  const service = (workspace = workspaceId, actor = actorId) => {
    const repo = repository(workspace, actor);
    return new FilingGovernanceService(
      repo as never,
      repo as never,
      repo as never,
      { getPreparationLock: async () => currentLock && structuredClone(currentLock) },
      () => at
    );
  };
  const createAuthorization = (value = service(), key = 'auth-create') =>
    value.createAuthorization({
      preparationLockId: lock.preparationLockId,
      preparationLockVersion: sourceVersion,
      authorizedParty: { partyId: 'customer_wp02', displayName: 'Owner WP02' },
      authorizationCapacity: 'OWNER',
      executionChannel: 'OFFICE_PORTAL',
      idempotencyKey: key
    });
  async function authorized(key = 'auth') {
    const value = service();
    const created = await createAuthorization(value, `${key}-create`);
    const confirmed = await value.confirmAuthorization(created.filingAuthorizationId, {
      acknowledgementCodes: [...codes],
      acknowledgedBy: actorId,
      idempotencyKey: `${key}-confirm`
    });
    return { value, confirmed };
  }
  async function readyRelease(key = 'release') {
    const { value, confirmed } = await authorized(`${key}-auth`);
    const created = await value.createRelease({
      filingAuthorizationId: confirmed.filingAuthorizationId,
      filingAuthorizationVersion: confirmed.version,
      requestedExecutionChannel: 'OFFICE_PORTAL',
      idempotencyKey: `${key}-create`
    });
    const evaluated = await value.evaluate(created.executionReleaseId);
    const assigned = await value.assign(evaluated.executionReleaseId, {
      internalExecutorId: 'user_internal_executor'
    });
    return { value, confirmed, created, evaluated, assigned };
  }

  beforeAll(async () => {
    await database.start();
    const pool = database.getPool();
    await pool.query(
      `DROP TABLE IF EXISTS
         execution_trademark_service_artifacts,
         execution_trademark_service_protected_action_replays,
         execution_trademark_service_sessions,
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
         filing_authorizations,
         filing_governance_commands,
         filing_governance_audit,
         professional_review_audit,
         professional_review_commands,
         professional_review_cases
       CASCADE`
    );
    await pool.query('DROP FUNCTION IF EXISTS reject_filing_governance_audit_mutation() CASCADE');
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
    currentLock = structuredClone(lock);
    await truncate();
  });
  afterAll(() => database.close());

  it('loads and verifies the Execution-owned 0027 migration', async () => {
    const owned = await migrations();
    expect(owned.map((migration) => `${migration.version}_${migration.name}`)).toContain(
      '0027_execution_filing_governance'
    );
    expect(
      (await migrationStatus(database.getPool(), namespace, owned)).every(
        (migration) => migration.state === 'applied'
      )
    ).toBe(true);
    await verifyMigrations(database.getPool(), namespace, owned);
  });

  it('creates durable exact-source authorization and reloads it through a fresh repository', async () => {
    const created = await createAuthorization();
    expect(created).toMatchObject({
      preparationLockId: lock.preparationLockId,
      preparationLockVersion: sourceVersion,
      status: 'PENDING_CONFIRMATION',
      version: 1
    });
    expect(created.preparationSnapshot).toEqual(lock.snapshot);
    await expect(repository().findById(created.filingAuthorizationId)).resolves.toEqual(created);
    const fresh = repository();
    await expect(fresh.findById(created.filingAuthorizationId)).resolves.toEqual(created);
  });

  it('persists confirmation idempotency across service recreation and rejects conflicting reuse', async () => {
    const firstService = service();
    const created = await createAuthorization(firstService, 'confirm-create');
    const command: Parameters<FilingGovernanceService['confirmAuthorization']>[1] = {
      acknowledgementCodes: [...codes],
      acknowledgedBy: actorId,
      idempotencyKey: 'confirm-durable'
    };
    const confirmed = await firstService.confirmAuthorization(
      created.filingAuthorizationId,
      command
    );
    const freshService = service();
    await expect(
      freshService.confirmAuthorization(created.filingAuthorizationId, command)
    ).resolves.toEqual(confirmed);
    await expect(
      freshService.confirmAuthorization(created.filingAuthorizationId, {
        ...command,
        acknowledgedBy: 'user_other'
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('increments release versions and enforces optimistic concurrency', async () => {
    const { value, created, evaluated } = await readyRelease('version');
    expect(evaluated.version).toBe(created.version + 1);
    const release = await value.getRelease(evaluated.executionReleaseId);
    const results = await Promise.allSettled([
      value.assign(
        release.executionReleaseId,
        { internalExecutorId: 'user_executor_a' },
        release.version
      ),
      value.assign(
        release.executionReleaseId,
        { internalExecutorId: 'user_executor_b' },
        release.version
      )
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(
      (results.find((result) => result.status === 'rejected') as PromiseRejectedResult).reason
    ).toMatchObject({ code: 'STALE_EXECUTION_RELEASE', status: 409 });
  });

  it('persists the explicit release decision and task draft across restart without external authority', async () => {
    const { value, assigned } = await readyRelease('decision');
    const result = await value.release(assigned.executionReleaseId, {
      decidedBy: actorId,
      rationale: 'All internal checks pass; release only for governed internal execution.',
      idempotencyKey: 'decision-release'
    });
    expect(result.release.status).toBe('RELEASED_FOR_EXECUTION');
    expect(result.taskDraft?.status).toBe('PREPARED');
    expect(value.consequences).toEqual(
      expect.objectContaining({
        paymentCreated: false,
        invoiceCreated: false,
        providerAssignedExternally: false,
        filingSubmitted: false,
        officialApplicationCreated: false,
        trademarkOfficeContacted: false
      })
    );
    const fresh = service();
    await expect(fresh.getRelease(result.release.executionReleaseId)).resolves.toEqual(
      result.release
    );
    await expect(fresh.getTaskForRelease(result.release.executionReleaseId)).resolves.toEqual(
      result.taskDraft
    );
    await expect(
      fresh.release(result.release.executionReleaseId, {
        decidedBy: actorId,
        rationale: 'All internal checks pass; release only for governed internal execution.',
        idempotencyKey: 'decision-release'
      })
    ).resolves.toEqual(result);
  });

  it('persists exact-source invalidation as STALE across restart', async () => {
    const created = await createAuthorization();
    currentLock = undefined;
    const stale = await service().getAuthorization(created.filingAuthorizationId);
    expect(stale).toMatchObject({ status: 'STALE', version: 2 });
    await expect(service().getAuthorization(created.filingAuthorizationId)).resolves.toEqual(stale);
  });

  it('fails cross-Workspace reads closed and records bounded denial evidence', async () => {
    const created = await createAuthorization();
    await expect(
      repository(otherWorkspaceId).findById(created.filingAuthorizationId)
    ).resolves.toBeUndefined();
    await repository().recordDenial({
      targetType: 'FILING_AUTHORIZATION',
      targetId: created.filingAuthorizationId,
      action: 'POST /v1/filing-authorizations',
      actorId,
      reasonCode: 'WORKSPACE_MISMATCH',
      correlationId: 'correlation-wp02',
      sourceFingerprint: 'a'.repeat(64),
      createdAt: at
    });
    const audit = await database
      .getPool()
      .query(
        "SELECT outcome,reason_code,actor_id FROM filing_governance_audit WHERE workspace_id=$1 AND outcome='DENIED'",
        [workspaceId]
      );
    expect(audit.rows).toContainEqual(
      expect.objectContaining({
        outcome: 'DENIED',
        reason_code: 'WORKSPACE_MISMATCH',
        actor_id: actorId
      })
    );
  });

  it('keeps audit evidence append-only', async () => {
    const created = await createAuthorization();
    const audit = await database
      .getPool()
      .query<{ audit_id: string }>(
        'SELECT audit_id FROM filing_governance_audit WHERE target_id=$1 ORDER BY audit_id LIMIT 1',
        [created.filingAuthorizationId]
      );
    const auditId = audit.rows[0]?.audit_id;
    expect(auditId).toBeDefined();
    await expect(
      database
        .getPool()
        .query('UPDATE filing_governance_audit SET action=$2 WHERE audit_id=$1', [
          auditId,
          'tampered'
        ])
    ).rejects.toThrow(/append-only/);
    await expect(
      database.getPool().query('DELETE FROM filing_governance_audit WHERE audit_id=$1', [auditId])
    ).rejects.toThrow(/append-only/);
  });

  it('maps database outage to the canonical 503-class error', async () => {
    const unavailable = new PostgresFilingGovernanceRepository(
      database,
      { query: () => Promise.reject(new Error('database unavailable')) } as never,
      workspaceId,
      actorId
    );
    await expect(unavailable.list()).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
      status: 503
    } satisfies Partial<FilingGovernanceError>);
    await expect(unavailable.findById('filing-authorization_missing')).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
      status: 503
    } satisfies Partial<FilingGovernanceError>);
  });
});
