import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import {
  liteIntakeFieldPaths,
  liteIntakeInlineTextSha256V1,
  noLiteIntakeStagingAuthorityConsequencesV1,
  type LiteIntakeCaseCandidateId,
  type LiteIntakeFieldCandidateV1,
  type LiteIntakeReviewedMaterialV1
} from '@markorbit/contracts/lite-intake-staging';
import {
  noEarlyFunnelAuthorityConsequences,
  type CreateProductionIntakeCommandV1,
  type ProductionIntakeV1
} from '@markorbit/contracts/markreg-early-funnel';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import {
  LiteIntakeProductionIntakeClientError,
  LiteIntakeStagingService,
  PostgresLiteIntakeStagingStore,
  type LiteIntakeReviewedFieldInput
} from '../src/lite-intake-staging.js';

const url = process.env.LITE_INTAKE_STAGING_TEST_DATABASE_URL;
const required = process.env.LITE_INTAKE_STAGING_POSTGRES_TEST_REQUIRED === '1';
if (required && !url) throw new Error('LITE_INTAKE_STAGING_TEST_DATABASE_URL is required.');
const suite = url ? describe : describe.skip;
const workspaceId = '99999999-9999-4999-8999-999999999999';
const otherWorkspaceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const caseId = 'lite-intake-case_pg' as LiteIntakeCaseCandidateId;
const sourceId = 'lite-intake-source_pg' as const;
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: 'user_intake_pg',
  sessionId: 'session_intake_pg',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_intake_pg',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'matter:manage', 'matter:create']
};
type OwnerCreate = (
  principal: Readonly<WorkspacePrincipal>,
  command: Readonly<CreateProductionIntakeCommandV1>
) => Promise<Readonly<ProductionIntakeV1>>;

function material(mark = 'ORBIT CAT'): LiteIntakeReviewedMaterialV1 {
  return {
    channel: 'LITE_PROFESSIONAL',
    relationshipModel: 'DIRECT',
    input: {
      businessContext: 'New filing instruction',
      applicant: { type: 'ORGANIZATION', name: 'Orbit Cat LLC', country: 'US' },
      trademark: { type: 'WORD', representationText: mark },
      targetJurisdictions: ['US'],
      goodsServices: { sourceText: 'downloadable software' },
      filingGoal: 'Register the mark'
    }
  };
}
function valueForPath(reviewed: LiteIntakeReviewedMaterialV1, path: string) {
  const values: Record<string, string | readonly string[]> = {
    channel: reviewed.channel,
    relationshipModel: reviewed.relationshipModel,
    'input.businessContext': reviewed.input.businessContext,
    'input.applicant.type': reviewed.input.applicant.type,
    'input.applicant.name': reviewed.input.applicant.name,
    'input.applicant.country': reviewed.input.applicant.country,
    'input.trademark.type': reviewed.input.trademark.type,
    'input.trademark.representationText': reviewed.input.trademark.representationText,
    'input.targetJurisdictions': reviewed.input.targetJurisdictions,
    'input.goodsServices.sourceText': reviewed.input.goodsServices.sourceText,
    'input.filingGoal': reviewed.input.filingGoal
  };
  return values[path]!;
}

function unreviewedFields(reviewed = material()): LiteIntakeFieldCandidateV1[] {
  return liteIntakeFieldPaths.map((fieldPath, index) => ({
    fieldCandidateId: `lite-intake-field_pg_${index}`,
    fieldPath,
    proposedValue: valueForPath(reviewed, fieldPath),
    originClass: 'USER_SUPPLIED',
    sourceIds: [sourceId],
    aiExtractionIds: [],
    reviewState: 'UNREVIEWED',
    reviewedByPrincipalId: null,
    reviewedAt: null
  }));
}
function reviewedFields(reviewed = material()): LiteIntakeReviewedFieldInput[] {
  return liteIntakeFieldPaths.map((fieldPath, index) => ({
    fieldCandidateId: `lite-intake-field_pg_${index}`,
    fieldPath,
    proposedValue: valueForPath(reviewed, fieldPath),
    originClass: 'USER_SUPPLIED' as const,
    sourceIds: [sourceId],
    aiExtractionIds: [],
    reviewState: 'CONFIRMED' as const
  }));
}

function createCommand(key: string, targetWorkspace = workspaceId) {
  const text = 'Please file ORBIT CAT in the United States.';
  return {
    workspaceId: targetWorkspace,
    actorPrincipalId: principal.userId,
    idempotencyKey: key,
    sources: [
      {
        sourceId,
        kind: 'USER_INLINE_TEXT' as const,
        owner: 'LITE' as const,
        textSnapshot: text,
        sha256: liteIntakeInlineTextSha256V1(text),
        sizeBytes: Buffer.byteLength(text, 'utf8'),
        recordedByPrincipalId: principal.userId,
        recordedAt: '2026-09-11T10:00:00.000Z'
      }
    ],
    caseCandidates: [
      {
        caseCandidateId: caseId,
        state: 'NEEDS_REVIEW' as const,
        fieldCandidates: unreviewedFields()
      }
    ]
  };
}
suite('PostgreSQL Lite Intake Staging durable owner runtime', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-intake-staging-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_intake_staging_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  let tick = 0;
  let id = 0;
  const now = () => new Date(Date.UTC(2026, 8, 11, 11, 0, tick++)).toISOString();
  const ids = () => `lite-intake-staging_pg-${++id}` as `lite-intake-staging_${string}`;
  const store = () => new PostgresLiteIntakeStagingStore(database, database.getPool(), now, ids);

  beforeAll(async () => {
    await database.start();
    await database
      .getPool()
      .query(
        'CREATE TABLE IF NOT EXISTS workspaces (workspace_id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE)'
      );
    const migrations = await loadMigrationsForOwner(
      migrationsDirectory,
      migrationOwners,
      '@markorbit/lite-service'
    );
    await migrate(database.getPool(), 'lite_intake_staging_test', migrations);
    await database.getPool().query(
      `INSERT INTO workspaces(workspace_id,name,slug)
       VALUES($1,'Intake A','intake-a'),($2,'Intake B','intake-b')
       ON CONFLICT(workspace_id) DO NOTHING`,
      [workspaceId, otherWorkspaceId]
    );
  }, 30000);

  beforeEach(async () => {
    tick = 0;
    id = 0;
    await database
      .getPool()
      .query(
        'TRUNCATE lite_intake_staging_commands,lite_intake_staging_heads,lite_intake_staging_versions CASCADE'
      );
  });

  afterAll(async () => {
    await database.close();
  });

  it('replays exact create across store instances and isolates Workspace reads/commands', async () => {
    const first = store();
    const command = createCommand('pg-create-1');
    const created = await first.create(command);
    expect(await store().create(command)).toEqual(created);
    await expect(first.create({ ...command, caseCandidates: [] })).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT'
    });
    const other = await first.create(createCommand('pg-create-1', otherWorkspaceId));
    expect(await first.getLatest(workspaceId, other.stagingId)).toBeUndefined();
    expect(await first.getLatest(otherWorkspaceId, other.stagingId)).toEqual(other);
    expect(created.authorityConsequences).toEqual(noLiteIntakeStagingAuthorityConsequencesV1);
  });

  it('keeps immutable history and exact CAS through human review', async () => {
    const s = store();
    const created = await s.create(createCommand('pg-history-create'));
    const service = new LiteIntakeStagingService(s, {
      create: vi.fn().mockRejectedValue(new Error('not used'))
    });
    const reviewed = await service.reviewCase({
      workspaceId,
      actorPrincipalId: principal.userId,
      stagingId: created.stagingId,
      caseCandidateId: caseId,
      expectedVersion: 1,
      idempotencyKey: 'pg-review',
      fieldCandidates: reviewedFields(),
      material: material()
    });
    expect(reviewed).toMatchObject({ version: 2 });
    expect(reviewed.caseCandidates[0]).toMatchObject({
      state: 'READY_TO_COMMIT',
      contentVersion: 2,
      reviewedCommit: {
        reviewedStagingVersion: 2,
        reviewedContentVersion: 2,
        confirmedByPrincipalId: principal.userId
      }
    });
    expect(await store().getExact(workspaceId, created.stagingId, 1)).toEqual(created);
    expect(await store().getLatest(workspaceId, created.stagingId)).toEqual(reviewed);
    await expect(
      service.reviewCase({
        workspaceId,
        actorPrincipalId: principal.userId,
        stagingId: created.stagingId,
        caseCandidateId: caseId,
        expectedVersion: 1,
        idempotencyKey: 'pg-review-stale',
        fieldCandidates: reviewedFields(),
        material: material()
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });
  it('persists COMMIT_UNCERTAIN and reconciles after restart with the same MarkReg key/body', async () => {
    const s1 = store();
    const created = await s1.create(createCommand('pg-uncertain-create'));
    const uncertainOwner = vi.fn<OwnerCreate>((ownerPrincipal, command) => {
      void ownerPrincipal;
      void command;
      return Promise.reject(
        new LiteIntakeProductionIntakeClientError('timeout after dispatch', true)
      );
    });
    const firstService = new LiteIntakeStagingService(s1, { create: uncertainOwner });
    const reviewed = await firstService.reviewCase({
      workspaceId,
      actorPrincipalId: principal.userId,
      stagingId: created.stagingId,
      caseCandidateId: caseId,
      expectedVersion: 1,
      idempotencyKey: 'pg-uncertain-review',
      fieldCandidates: reviewedFields(),
      material: material()
    });
    const fingerprint = reviewed.caseCandidates[0]!.reviewedCommit!.reviewedFingerprintSha256;
    const first = await firstService.commitCase({
      workspaceId,
      stagingId: created.stagingId,
      caseCandidateId: caseId,
      expectedVersion: reviewed.version,
      expectedReviewedFingerprintSha256: fingerprint,
      idempotencyKey: 'pg-commit',
      principal
    });
    expect(first.status).toBe('COMMIT_UNCERTAIN');
    expect(first.staging.caseCandidates[0]?.state).toBe('COMMIT_UNCERTAIN');
    const firstOwnerCommand = uncertainOwner.mock.calls[0]![1];

    const replayOwner = vi.fn<OwnerCreate>((ownerPrincipal, command) => {
      void ownerPrincipal;
      return Promise.resolve({
        schemaVersion: 1,
        intakeId: 'intake_pg-replayed',
        workspaceId,
        version: 1,
        status: 'RECEIVED',
        channel: command.channel,
        relationshipModel: command.relationshipModel,
        input: command.input,
        sourceClass: 'CUSTOMER_SUPPLIED',
        fingerprintSha256: 'f'.repeat(64),
        createdAt: '2026-09-11T11:10:00.000Z',
        updatedAt: '2026-09-11T11:10:00.000Z',
        authorityConsequences: noEarlyFunnelAuthorityConsequences
      });
    });
    const restarted = new LiteIntakeStagingService(store(), { create: replayOwner });
    const second = await restarted.commitCase({
      workspaceId,
      stagingId: created.stagingId,
      caseCandidateId: caseId,
      expectedVersion: reviewed.version,
      expectedReviewedFingerprintSha256: fingerprint,
      idempotencyKey: 'pg-commit',
      principal
    });
    expect(second.status).toBe('COMMITTED');
    expect(second.staging.caseCandidates[0]).toMatchObject({
      state: 'COMMITTED',
      productionIntakeReceipt: {
        intakeId: 'intake_pg-replayed',
        reviewedFingerprintSha256: fingerprint
      }
    });
    expect(replayOwner).toHaveBeenCalledTimes(1);
    const replayCommand = replayOwner.mock.calls[0]![1];
    expect(replayCommand).toEqual(firstOwnerCommand);
    expect(replayCommand.idempotencyKey).toBe(firstOwnerCommand.idempotencyKey);

    const noReplayOwner = vi.fn<OwnerCreate>(() =>
      Promise.reject(new Error('COMMITTED replay must not call MarkReg'))
    );
    const replayed = await new LiteIntakeStagingService(store(), {
      create: noReplayOwner
    }).commitCase({
      workspaceId,
      stagingId: created.stagingId,
      caseCandidateId: caseId,
      expectedVersion: reviewed.version,
      expectedReviewedFingerprintSha256: fingerprint,
      idempotencyKey: 'pg-commit',
      principal
    });
    expect(replayed.status).toBe('COMMITTED');
    expect(noReplayOwner).not.toHaveBeenCalled();

    await expect(
      restarted.commitCase({
        workspaceId,
        stagingId: created.stagingId,
        caseCandidateId: caseId,
        expectedVersion: reviewed.version,
        expectedReviewedFingerprintSha256: 'a'.repeat(64),
        idempotencyKey: 'pg-commit',
        principal
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });
  it('fails closed when durable columns diverge from document_json', async () => {
    const s = store();
    const created = await s.create(createCommand('pg-corrupt-create'));
    await database.getPool().query(
      `UPDATE lite_intake_staging_versions
          SET document_json=jsonb_set(document_json,'{version}','99'::jsonb,false)
        WHERE workspace_id=$1 AND staging_id=$2 AND version=1`,
      [workspaceId, created.stagingId]
    );
    await expect(s.getExact(workspaceId, created.stagingId, 1)).rejects.toMatchObject({
      code: 'INTEGRITY_FAILURE'
    });
  });
});
