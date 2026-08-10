import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ManagedDatabase,
  loadMigrationsForOwner,
  migrationStatus,
  verifyMigrations
} from '@markorbit/persistence';
import type { FormalMatterId } from '@markorbit/contracts';
import type {
  ProjectLifecycleEventCommand,
  ReviewedSourceAdmissionEnvelope,
  ReviewedSourceAdmissionId
} from '@markorbit/contracts/evidence-lifecycle';
import { PostgresFormalMatterRepository } from '../src/formal-matter.js';
import {
  LifecycleProjectionService,
  PostgresLifecycleProjectionRepository,
  type LifecycleProjectionError,
  type ReviewedSourceAdmissionReader
} from '../src/lifecycle-projection.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from './support/markreg-test-database.js';

const url = process.env.MARKREG_TEST_DATABASE_URL;
const required = process.env.MARKREG_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error('MARKREG_TEST_DATABASE_URL is required when MARKREG_POSTGRES_TEST_REQUIRED=1.');
const suite = url ? describe : describe.skip;
const workspaceId = '22222222-2222-4222-8222-222222222222';
const otherWorkspaceId = '33333333-3333-4333-8333-333333333333';
const projectedAt = '2026-08-10T00:30:00.000Z';
const sha = (character: string) => character.repeat(64);

class FixtureAdmissionReader implements ReviewedSourceAdmissionReader {
  private readonly admissions = new Map<
    ReviewedSourceAdmissionId,
    ReviewedSourceAdmissionEnvelope
  >();

  add(admission: ReviewedSourceAdmissionEnvelope) {
    this.admissions.set(admission.reviewedSourceAdmissionId, structuredClone(admission));
  }

  findReviewedSourceAdmission(reviewedSourceAdmissionId: ReviewedSourceAdmissionId) {
    const admission = this.admissions.get(reviewedSourceAdmissionId);
    return Promise.resolve(admission ? structuredClone(admission) : undefined);
  }
}

function admission(
  suffix: string,
  formalMatterId: FormalMatterId,
  input: {
    workspace?: string;
    admittedAt?: string;
    correlationId?: string;
  } = {}
): ReviewedSourceAdmissionEnvelope {
  const sourceWorkspaceId = input.workspace ?? workspaceId;
  const correlationId = (input.correlationId ?? `correlation_${suffix}`) as never;
  return {
    schemaVersion: 1,
    reviewedSourceAdmissionId: `reviewed-source-admission_${suffix}`,
    workspaceId: sourceWorkspaceId,
    version: 1,
    formalMatter: { id: formalMatterId, version: 1 },
    reviewDecision: { id: `evidence-review-decision_${suffix}`, version: 1 },
    reviewDecisionFingerprintSha256: sha('b'),
    evidenceSource: {
      schemaVersion: 1,
      workspaceId: sourceWorkspaceId,
      evidenceReceipt: { id: `evidence-receipt_${suffix}`, version: 1 },
      evidenceReceiptFingerprintSha256: sha('c'),
      evidenceHandoffId: `evidence-handoff_${suffix}`,
      providerReturn: { id: `provider-return_${suffix}`, version: 1 },
      providerReturnFingerprintSha256: sha('d'),
      providerId: `provider_${suffix}`,
      correlationId,
      capturedAt: '2026-08-10T00:00:00.000Z'
    },
    admittedEvidenceReferences: [`provider-evidence://${suffix}`],
    admissionFingerprintSha256: sha('a'),
    admittedAt: input.admittedAt ?? '2026-08-10T00:10:00.000Z',
    correlationId
  };
}

suite('PostgreSQL MarkReg lifecycle projection', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'markreg-lifecycle-projection-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: MARKREG_TEST_MIGRATION_NAMESPACE
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  const migrations = () =>
    loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/markreg-service');

  beforeAll(async () => {
    await database.start();
    await resetAndMigrateMarkRegTestDatabase({
      pool: database.getPool(),
      migrationsDirectory,
      migrationOwners
    });
  });

  beforeEach(() =>
    database
      .getPool()
      .query(
        'TRUNCATE markreg_lifecycle_commands,markreg_lifecycle_views,markreg_lifecycle_events,formal_matters RESTART IDENTITY CASCADE'
      )
  );

  afterAll(() => database.close());

  async function insertMatter(suffix: string, workspace = workspaceId) {
    const formalMatterId = `formal-matter_${suffix}` as FormalMatterId;
    await database
      .getPool()
      .query(
        'INSERT INTO formal_matters (formal_matter_id,workspace_id,kind,status,version,source_customer_confirmation_id,source_customer_confirmation_version,source_matter_draft_id,source_matter_draft_version,source_quote_id,source_quote_version,source_snapshot,snapshot_schema_version,snapshot_sha256,created_by_user_id,created_at,updated_at) VALUES ($1,$2,$3,$4,1,$5,1,$6,1,$7,$8,$9::jsonb,1,$10,$11,$12,$12)',
        [
          formalMatterId,
          workspace,
          'TRADEMARK_REGISTRATION',
          'OPEN',
          `confirmation_${suffix}`,
          `matter-draft_${suffix}`,
          `quote_${suffix}`,
          'quote-v1',
          JSON.stringify({
            preparation: {
              applicantName: 'Orbit Ltd',
              trademark: 'ORBIT',
              targetJurisdiction: 'US',
              classes: [9]
            }
          }),
          sha('f'),
          `user_${suffix}`,
          '2026-08-10T00:00:00.000Z'
        ]
      );
    return formalMatterId;
  }

  function fixture(reader: FixtureAdmissionReader) {
    const repository = new PostgresLifecycleProjectionRepository(database, database.getPool());
    const formalMatters = new PostgresFormalMatterRepository(database, database.getPool());
    const service = new LifecycleProjectionService(
      repository,
      formalMatters,
      reader,
      () => projectedAt
    );
    return { repository, service };
  }

  function command(
    source: ReviewedSourceAdmissionEnvelope,
    input: Partial<ProjectLifecycleEventCommand> = {}
  ): ProjectLifecycleEventCommand {
    return {
      workspaceId,
      reviewedSourceAdmissionId: source.reviewedSourceAdmissionId,
      expectedReviewedSourceAdmissionVersion: 1,
      expectedAdmissionFingerprintSha256: source.admissionFingerprintSha256,
      formalMatterId: source.formalMatter.id,
      expectedFormalMatterVersion: source.formalMatter.version,
      state: 'REVIEWED_PROVIDER_EVIDENCE',
      eventCode: 'PROVIDER_EVIDENCE_REVIEWED',
      customerSafeLabel: 'Evidence reviewed',
      customerSafeSummary:
        'Reviewed provider evidence is available for internal lifecycle tracking.',
      occurredAt: '2026-08-10T00:20:00.000Z',
      idempotencyKey: `project-${source.reviewedSourceAdmissionId}`,
      correlationId: source.correlationId,
      ...input
    };
  }

  it('applies and verifies owner migration 0034', async () => {
    const owned = await migrations();
    expect(owned.map((migration) => migration.version)).toContain('0034');
    expect(
      (await migrationStatus(database.getPool(), MARKREG_TEST_MIGRATION_NAMESPACE, owned)).every(
        (migration) => migration.state === 'applied'
      )
    ).toBe(true);
    await verifyMigrations(database.getPool(), MARKREG_TEST_MIGRATION_NAMESPACE, owned);
  });

  it('persists exact admitted-source provenance and reloads the durable event and current view', async () => {
    const formalMatterId = await insertMatter('reload');
    const reader = new FixtureAdmissionReader();
    const source = admission('reload', formalMatterId);
    reader.add(source);
    const { repository, service } = fixture(reader);

    const result = await service.project(command(source));
    expect(result.event).toMatchObject({
      workspaceId,
      formalMatter: { id: formalMatterId, version: 1 },
      version: 1,
      source: {
        reviewedSourceAdmission: { id: source.reviewedSourceAdmissionId, version: 1 },
        admissionFingerprintSha256: source.admissionFingerprintSha256,
        evidenceReviewDecision: source.reviewDecision,
        evidenceReceipt: source.evidenceSource.evidenceReceipt,
        providerReturn: source.evidenceSource.providerReturn
      },
      state: 'REVIEWED_PROVIDER_EVIDENCE',
      officialStatusVerified: false
    });
    expect(result.currentView).toMatchObject({
      workspaceId,
      formalMatter: { id: formalMatterId, version: 1 },
      version: 1,
      currentEvent: { id: result.event.lifecycleEventId, version: 1 },
      state: 'REVIEWED_PROVIDER_EVIDENCE',
      officialStatusVerified: false
    });

    const restartedRepository = new PostgresLifecycleProjectionRepository(
      database,
      database.getPool()
    );
    await expect(restartedRepository.getCurrentView(workspaceId, formalMatterId)).resolves.toEqual(
      result.currentView
    );
    await expect(restartedRepository.listEvents(workspaceId, formalMatterId)).resolves.toEqual([
      result.event
    ]);
    expect((await repository.listEvents(workspaceId, formalMatterId))[0]).not.toHaveProperty(
      'officialApplicationNumber'
    );
  });

  it('replays one idempotency key and deduplicates a repeated exact admission with another key', async () => {
    const formalMatterId = await insertMatter('replay');
    const reader = new FixtureAdmissionReader();
    const source = admission('replay', formalMatterId);
    reader.add(source);
    const { service } = fixture(reader);
    const firstCommand = command(source, { idempotencyKey: 'project-replay-1' });
    const first = await service.project(firstCommand);
    await expect(service.project(firstCommand)).resolves.toEqual(first);

    const duplicate = await service.project(
      command(source, { idempotencyKey: 'project-replay-2' })
    );
    expect(duplicate.event.lifecycleEventId).toBe(first.event.lifecycleEventId);
    const counts = await database
      .getPool()
      .query(
        'SELECT (SELECT count(*) FROM markreg_lifecycle_events) events,(SELECT count(*) FROM markreg_lifecycle_commands) commands'
      );
    expect(counts.rows[0]).toMatchObject({ events: '1', commands: '2' });
  });

  it('rejects conflicting key reuse and a conflicting projection for an already consumed admission', async () => {
    const formalMatterId = await insertMatter('conflict');
    const reader = new FixtureAdmissionReader();
    const source = admission('conflict', formalMatterId);
    reader.add(source);
    const { service } = fixture(reader);
    await service.project(command(source, { idempotencyKey: 'project-conflict' }));

    await expect(
      service.project(
        command(source, {
          idempotencyKey: 'project-conflict',
          customerSafeSummary: 'Different payload.'
        })
      )
    ).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT'
    } satisfies Partial<LifecycleProjectionError>);
    await expect(
      service.project(
        command(source, {
          idempotencyKey: 'project-conflict-other-key',
          state: 'CUSTOMER_ACTION_NEEDED',
          eventCode: 'CUSTOMER_ACTION_REQUIRED'
        })
      )
    ).rejects.toMatchObject({
      code: 'VERSION_CONFLICT'
    } satisfies Partial<LifecycleProjectionError>);
  });

  it('fails closed for missing, wrong-Workspace, version-mismatched and fingerprint-mismatched sources', async () => {
    const formalMatterId = await insertMatter('negative');
    const reader = new FixtureAdmissionReader();
    const source = admission('negative', formalMatterId);
    reader.add(source);
    const { service } = fixture(reader);

    await expect(
      service.project(
        command(source, {
          reviewedSourceAdmissionId: 'reviewed-source-admission_missing',
          idempotencyKey: 'missing-source'
        })
      )
    ).rejects.toMatchObject({
      code: 'LIFECYCLE_SOURCE_NOT_ADMITTED'
    } satisfies Partial<LifecycleProjectionError>);
    await expect(
      service.project(
        command(source, {
          workspaceId: otherWorkspaceId,
          idempotencyKey: 'other-workspace'
        })
      )
    ).rejects.toMatchObject({
      code: 'LIFECYCLE_SOURCE_NOT_ADMITTED',
      status: 403
    } satisfies Partial<LifecycleProjectionError>);
    await expect(
      service.project(
        command(source, {
          expectedReviewedSourceAdmissionVersion: 2,
          idempotencyKey: 'wrong-version'
        })
      )
    ).rejects.toMatchObject({
      code: 'SOURCE_VERSION_MISMATCH'
    } satisfies Partial<LifecycleProjectionError>);
    await expect(
      service.project(
        command(source, {
          expectedAdmissionFingerprintSha256: sha('e'),
          idempotencyKey: 'wrong-fingerprint'
        })
      )
    ).rejects.toMatchObject({
      code: 'SOURCE_FINGERPRINT_MISMATCH'
    } satisfies Partial<LifecycleProjectionError>);
    expect(
      await database.getPool().query('SELECT count(*) FROM markreg_lifecycle_events')
    ).toMatchObject({ rows: [{ count: '0' }] });
  });

  it('keeps reads Workspace-bounded and does not expose another Workspace Matter lifecycle', async () => {
    const formalMatterId = await insertMatter('scope');
    const reader = new FixtureAdmissionReader();
    const source = admission('scope', formalMatterId);
    reader.add(source);
    const { service } = fixture(reader);
    await service.project(command(source));

    await expect(service.getCurrentView(otherWorkspaceId, formalMatterId)).resolves.toBeUndefined();
    await expect(service.listEvents(otherWorkspaceId, formalMatterId)).resolves.toEqual([]);
  });

  it('uses occurredAt first and explicit state precedence as a deterministic current-view tie breaker', async () => {
    const formalMatterId = await insertMatter('precedence');
    const reader = new FixtureAdmissionReader();
    const later = admission('precedence-later', formalMatterId, {
      correlationId: 'correlation_precedence_later'
    });
    const olderIssue = admission('precedence-older-issue', formalMatterId, {
      correlationId: 'correlation_precedence_older_issue'
    });
    const sameTimeAction = admission('precedence-same-time-action', formalMatterId, {
      correlationId: 'correlation_precedence_same_time_action'
    });
    reader.add(later);
    reader.add(olderIssue);
    reader.add(sameTimeAction);
    const { service } = fixture(reader);

    const first = await service.project(
      command(later, {
        state: 'WAITING_NO_ACTION',
        eventCode: 'WAITING',
        occurredAt: '2026-08-10T01:00:00.000Z',
        idempotencyKey: 'precedence-1'
      })
    );
    const second = await service.project(
      command(olderIssue, {
        state: 'CORRECTION_OR_REVIEW_ISSUE',
        eventCode: 'ISSUE',
        occurredAt: '2026-08-10T00:59:00.000Z',
        idempotencyKey: 'precedence-2'
      })
    );
    expect(second.currentView.currentEvent.id).toBe(first.event.lifecycleEventId);
    expect(second.currentView.state).toBe('WAITING_NO_ACTION');

    const third = await service.project(
      command(sameTimeAction, {
        state: 'CUSTOMER_ACTION_NEEDED',
        eventCode: 'ACTION',
        occurredAt: '2026-08-10T01:00:00.000Z',
        idempotencyKey: 'precedence-3'
      })
    );
    expect(third.currentView.currentEvent.id).toBe(third.event.lifecycleEventId);
    expect(third.currentView.state).toBe('CUSTOMER_ACTION_NEEDED');
    expect(third.currentView.version).toBe(3);
  });

  it('keeps lifecycle events append-only at the database boundary', async () => {
    const formalMatterId = await insertMatter('append-only');
    const reader = new FixtureAdmissionReader();
    const source = admission('append-only', formalMatterId);
    reader.add(source);
    const { service } = fixture(reader);
    const result = await service.project(command(source));

    await expect(
      database
        .getPool()
        .query(
          'UPDATE markreg_lifecycle_events SET customer_safe_label=$1 WHERE lifecycle_event_id=$2',
          ['mutated', result.event.lifecycleEventId]
        )
    ).rejects.toMatchObject({ code: '55000' });
  });
});
