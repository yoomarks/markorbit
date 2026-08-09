import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ManagedDatabase,
  loadMigrationsForOwner,
  migrate,
  migrationStatus,
  verifyMigrations
} from '@markorbit/persistence';
import type { MatterDraftReviewSnapshot } from '@markorbit/contracts';
import {
  ProfessionalReviewService,
  type ProfessionalReviewError
} from '../src/professional-review.js';
import { PostgresProfessionalReviewRepository } from '../src/professional-review-postgres.js';

const url = process.env.EXECUTION_TEST_DATABASE_URL;
const required = process.env.EXECUTION_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'EXECUTION_TEST_DATABASE_URL is required when EXECUTION_POSTGRES_TEST_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const workspaceId = '88888888-8888-4888-8888-888888888888';
const otherWorkspaceId = '99999999-9999-4999-8999-999999999999';
const at = '2026-07-31T20:00:00.000Z';
const hash = 'a'.repeat(64);
const source: MatterDraftReviewSnapshot = {
  schemaVersion: 1,
  matterDraftId: 'matter-draft_task024',
  matterDraftVersion: '1',
  confirmationId: 'confirmation_task024',
  customerId: 'customer_task024',
  status: 'READY_FOR_PROFESSIONAL_REVIEW',
  preparation: {
    applicantName: 'Northstar Holdings',
    trademark: 'DURABLE ORBIT',
    targetJurisdiction: 'US',
    classes: [9, 35],
    goodsServices: 'Software and business services',
    documentReferences: ['document_task024']
  },
  readiness: { evaluatedAt: at, readyForProfessionalReview: true, checks: [] },
  readinessTimestamp: at
};

suite('PostgreSQL Professional Review migration and repository', () => {
  const namespace = 'execution_professional_review_test';
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
  const migrations = () =>
    loadMigrationsForOwner(
      path.resolve('../../infrastructure/persistence/migrations'),
      path.resolve('../../infrastructure/persistence/migration-owners.json'),
      '@markorbit/execution-service'
    );
  const truncate = () =>
    database
      .getPool()
      .query(
        'TRUNCATE professional_review_audit, professional_review_commands, professional_review_cases RESTART IDENTITY'
      );
  const repository = (workspace = workspaceId) =>
    new PostgresProfessionalReviewRepository(database, database.getPool(), workspace);
  const service = (workspace = workspaceId) =>
    new ProfessionalReviewService(
      repository(workspace),
      { getMatterDraft: () => Promise.resolve(structuredClone(source)) },
      () => at
    );
  const command = (suffix: string) => ({
    matterDraftId: source.matterDraftId,
    matterDraftVersion: source.matterDraftVersion,
    idempotencyKey: `review-${suffix}`,
    requestedBy: 'user_reviewer' as const,
    workspaceId,
    formalMatterId: `formal-matter_${suffix}` as const,
    sourceFormalMatterVersion: 1,
    sourceSnapshotSha256: hash
  });
  async function claimed(suffix: string) {
    const reviewService = service();
    const opened = await reviewService.create(command(suffix));
    const value = await reviewService.claim(opened.reviewCaseId, 'user_reviewer', opened.version);
    return { reviewService, value };
  }
  async function completed(suffix: string) {
    const { reviewService, value } = await claimed(suffix);
    const draft = await reviewService.updateChecklist(
      value.reviewCaseId,
      'user_reviewer',
      value.checklist.map((item) => ({
        code: item.code,
        status: 'PASS' as const,
        reviewerNote: 'Exact source evidence checked.'
      })),
      value.version
    );
    const done = await reviewService.complete(
      value.reviewCaseId,
      'user_reviewer',
      'MARK_READY_FOR_NEXT_STEP',
      'The bounded evidence supports the next governed step.',
      draft.version,
      `complete-${suffix}`
    );
    return { reviewService, draft, done };
  }

  beforeAll(async () => {
    await database.start();
    const pool = database.getPool();
    await pool.query(
      `DROP TABLE IF EXISTS
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
  beforeEach(truncate);
  afterAll(() => database.close());

  it('loads and verifies every migration declared for the Execution owner', async () => {
    const owned = await migrations();
    expect(owned.map((migration) => `${migration.version}_${migration.name}`)).toContain(
      '0023_execution_professional_reviews'
    );
    expect(
      (await migrationStatus(database.getPool(), namespace, owned)).every(
        (migration) => migration.state === 'applied'
      )
    ).toBe(true);
    await verifyMigrations(database.getPool(), namespace, owned);
  });

  it('creates and reloads exact Workspace, Formal Matter lineage and bounded evidence', async () => {
    const created = await service().create(command('reload'));
    await expect(repository().findById(created.reviewCaseId)).resolves.toEqual(created);
    expect(created).toMatchObject({
      workspaceId,
      formalMatterId: 'formal-matter_reload',
      sourceFormalMatterVersion: 1,
      sourceSnapshotSha256: hash,
      version: 1
    });
    expect(created.checklist.length).toBeGreaterThan(0);
  });

  it('opens or resumes one Review Case for one Formal Matter', async () => {
    const reviewService = service();
    const first = await reviewService.create(command('single'));
    expect((await reviewService.create(command('single'))).reviewCaseId).toBe(first.reviewCaseId);
    await expect(
      reviewService.create({ ...command('single'), idempotencyKey: 'review-second-key' })
    ).rejects.toMatchObject({ code: 'ACTIVE_REVIEW_CASE_EXISTS' });
  });

  it('increments the exact version for a durable draft update', async () => {
    const { reviewService, value } = await claimed('increment');
    const updated = await reviewService.updateChecklist(
      value.reviewCaseId,
      'user_reviewer',
      [{ code: 'APPLICANT_INFORMATION_REVIEWED', status: 'PASS', reviewerNote: 'Checked.' }],
      value.version
    );
    expect(updated.version).toBe((value.version ?? 0) + 1);
    await expect(repository().findById(value.reviewCaseId)).resolves.toEqual(updated);
  });

  it('allows exactly one concurrent same-version update and rejects the stale writer', async () => {
    const { reviewService, value } = await claimed('concurrent');
    const results = await Promise.allSettled([
      reviewService.updateChecklist(value.reviewCaseId, 'user_reviewer', [], value.version),
      reviewService.updateChecklist(value.reviewCaseId, 'user_reviewer', [], value.version)
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(
      (results.find((result) => result.status === 'rejected') as PromiseRejectedResult).reason
    ).toMatchObject({ code: 'STALE_PROFESSIONAL_REVIEW' });
  });

  it('returns an identical completion retry and rejects conflicting reuse without rewriting', async () => {
    const { reviewService, draft, done } = await completed('completion');
    await expect(
      reviewService.complete(
        done.reviewCaseId,
        'user_reviewer',
        'MARK_READY_FOR_NEXT_STEP',
        'The bounded evidence supports the next governed step.',
        draft.version,
        'complete-completion'
      )
    ).resolves.toEqual(done);
    await expect(
      reviewService.complete(
        done.reviewCaseId,
        'user_reviewer',
        'MARK_READY_FOR_NEXT_STEP',
        'Conflicting rationale',
        draft.version,
        'complete-completion'
      )
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    await expect(repository().findById(done.reviewCaseId)).resolves.toEqual(done);
  });

  it('prevents edits to a completed Review', async () => {
    const { reviewService, done } = await completed('immutable');
    await expect(
      reviewService.updateChecklist(done.reviewCaseId, 'user_reviewer', [], done.version)
    ).rejects.toMatchObject({ code: 'STALE_PROFESSIONAL_REVIEW' });
  });

  it('fails cross-Workspace reads and mutations closed', async () => {
    const created = await service().create(command('scope'));
    await expect(
      repository(otherWorkspaceId).findById(created.reviewCaseId)
    ).resolves.toBeUndefined();
    await expect(
      repository(otherWorkspaceId).updateChecklist({ ...created, version: 2 })
    ).rejects.toMatchObject({ code: 'WORKSPACE_MISMATCH', status: 404 });
  });

  it('rolls back case, command and audit when transactional creation fails', async () => {
    const value = await service().create(command('rollback-seed'));
    await truncate();
    await expect(
      repository().create(
        { ...value, reviewCaseId: 'professional-review_rollback', requestedBy: null as never },
        'rollback',
        'fingerprint'
      )
    ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE', status: 503 });
    const counts = await database
      .getPool()
      .query(
        'SELECT (SELECT count(*) FROM professional_review_cases) cases,(SELECT count(*) FROM professional_review_commands) commands,(SELECT count(*) FROM professional_review_audit) audits'
      );
    expect(counts.rows[0]).toMatchObject({ cases: '0', commands: '0', audits: '0' });
  });

  it('reloads the immutable decision through a fresh pool and repository', async () => {
    const { done } = await completed('reconnect');
    const fresh = new ManagedDatabase({
      connection: { url: url! },
      applicationName: `${namespace}-reconnect`,
      poolMaximum: 2,
      connectionTimeoutMs: 2000,
      idleTimeoutMs: 2000,
      statementTimeoutMs: 5000,
      sslMode: 'disable',
      migrationNamespace: namespace
    });
    await fresh.start();
    try {
      await expect(
        new PostgresProfessionalReviewRepository(fresh, fresh.getPool(), workspaceId).findById(
          done.reviewCaseId
        )
      ).resolves.toEqual(done);
    } finally {
      await fresh.close();
    }
  });

  it('maps database unavailability to the canonical 503-class error', async () => {
    const unavailable = new PostgresProfessionalReviewRepository(
      database,
      {
        query: () => Promise.reject(new Error('database unavailable'))
      } as never,
      workspaceId
    );
    await expect(unavailable.list()).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
      status: 503
    });
    await expect(unavailable.findById('professional-review_missing')).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
      status: 503
    } satisfies Partial<ProfessionalReviewError>);
  });
});
