import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ProfessionalReviewCase, WorkspacePrincipal } from '@markorbit/contracts';
import {
  ManagedDatabase,
  loadMigrationsForOwner,
  migrationStatus,
  verifyMigrations
} from '@markorbit/persistence';
import {
  completedDecisionFingerprint,
  PostgresDocumentPackageService
} from '../src/document-package.js';
import { resetAndMigrateMarkRegTestDatabase } from './support/markreg-test-database.js';

const url = process.env.MARKREG_TEST_DATABASE_URL;
const required = process.env.MARKREG_DOCUMENT_PACKAGE_POSTGRES_REQUIRED === '1';
if (required && !url)
  throw new Error('MARKREG_TEST_DATABASE_URL is required in required Document Package mode.');
const suite = url ? describe : describe.skip;
const workspaceId = '25252525-2525-4252-8252-252525252525';
const otherWorkspaceId = '26262626-2626-4262-8262-262626262626';
const permissions = [
  'workspace:read',
  'matter:read',
  'review:read',
  'document-package:read',
  'document-package:prepare',
  'instruction-ledger:read',
  'instruction-ledger:write',
  'document-package:mark-ready'
] as const;
const principal = (workspace = workspaceId): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: 'session_task025',
  userId: 'user_task025',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId: workspace,
  membershipId: 'membership_task025',
  role: 'WORKSPACE_ADMIN',
  permissions
});
const at = '2026-08-01T12:00:00.000Z';
const review: ProfessionalReviewCase = {
  schemaVersion: 1,
  reviewCaseId: 'professional-review_task025',
  workspaceId,
  formalMatterId: 'formal-matter_task025',
  sourceFormalMatterVersion: 3,
  sourceSnapshotSha256: 'a'.repeat(64),
  version: 5,
  status: 'REVIEWED_READY_FOR_NEXT_STEP',
  priority: 'NORMAL',
  requestedBy: 'user_task025',
  createdAt: at,
  updatedAt: at,
  completedAt: at,
  completedBy: 'user_task025',
  assignment: {
    status: 'CLAIMED',
    claimedBy: 'user_task025',
    claimedAt: at,
    professionalAppointed: false
  },
  checklist: [],
  evidence: [],
  source: {
    schemaVersion: 1,
    matterDraftId: 'matter-draft_task025',
    matterDraftVersion: '4',
    confirmationId: 'confirmation_task025',
    customerId: 'customer_task025',
    status: 'READY_FOR_PROFESSIONAL_REVIEW',
    preparation: { trademark: 'DURABLE ORBIT', classes: [9], documentReferences: [] },
    readiness: { evaluatedAt: at, readyForProfessionalReview: true, checks: [] },
    readinessTimestamp: at
  },
  decision: {
    code: 'MARK_READY_FOR_NEXT_STEP',
    reviewerId: 'user_task025',
    decidedAt: at,
    rationale: 'Completed source review.',
    checklistSnapshot: [],
    evidenceReferences: [],
    sourceMatterDraftVersion: '4',
    consequences: {
      orderCreated: false,
      paymentCreated: false,
      formalMatterCreated: false,
      providerAppointed: false,
      filingCreated: false,
      customerMessageSent: false
    }
  }
};

suite('PostgreSQL durable Document Package and Instruction Ledger', () => {
  const namespace = 'markreg_document_package_test';
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
      '@markorbit/markreg-service'
    );
  const service = (source = review) =>
    new PostgresDocumentPackageService(
      database,
      database.getPool(),
      { get: () => Promise.resolve(structuredClone(source)) },
      () => at
    );
  const create = async (suffix: string, source = review) =>
    service(source).createOrOpen(principal(), {
      professionalReviewCaseId: source.reviewCaseId,
      expectedReviewVersion: source.version!,
      expectedCompletedDecisionId: source.decision!.decidedAt,
      expectedCompletedDecisionHash: completedDecisionFingerprint(source)!,
      idempotencyKey: `create-${suffix}-task025`
    });
  beforeAll(async () => {
    await database.start();
    await resetAndMigrateMarkRegTestDatabase({
      pool: database.getPool(),
      namespace,
      migrationsDirectory: path.resolve('../../infrastructure/persistence/migrations'),
      migrationOwners: path.resolve('../../infrastructure/persistence/migration-owners.json')
    });
  });
  beforeEach(() =>
    database
      .getPool()
      .query(
        'TRUNCATE document_package_audit,document_package_commands,document_instruction_entries,document_package_items,document_packages RESTART IDENTITY CASCADE'
      )
  );
  afterAll(() => database.close());
  it('loads migration 0024 under MarkReg ownership with zero foreign owner tables', async () => {
    const owned = await migrations();
    expect(owned.map((x) => `${x.version}_${x.name}`)).toContain('0024_markreg_document_packages');
    expect(
      (await migrationStatus(database.getPool(), namespace, owned)).every(
        (x) => x.state === 'applied'
      )
    ).toBe(true);
    await verifyMigrations(database.getPool(), namespace, owned);
  });
  it('creates/replays one exact Package and rejects conflicting key evidence', async () => {
    const first = await create('replay');
    const again = await create('replay');
    expect(again).toEqual(first);
    await expect(
      service().createOrOpen(principal(), {
        professionalReviewCaseId: review.reviewCaseId,
        expectedReviewVersion: review.version!,
        expectedCompletedDecisionId: review.decision!.decidedAt,
        expectedCompletedDecisionHash: 'f'.repeat(64),
        idempotencyKey: 'create-replay-task025'
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect((await database.getPool().query('SELECT * FROM document_packages')).rowCount).toBe(1);
  });
  it('preserves exact Formal Matter and completed Review lineage after reload and concurrent resume', async () => {
    const command = {
      professionalReviewCaseId: review.reviewCaseId,
      expectedReviewVersion: review.version!,
      expectedCompletedDecisionId: review.decision!.decidedAt,
      expectedCompletedDecisionHash: completedDecisionFingerprint(review)!,
      idempotencyKey: 'create-concurrent-task025'
    };
    const [first, second] = await Promise.all([
      service().createOrOpen(principal(), command),
      service().createOrOpen(principal(), command)
    ]);
    expect(second).toEqual(first);
    expect(
      (await database.getPool().query('SELECT document_package_id FROM document_packages')).rowCount
    ).toBe(1);
    const loaded = await service().get(principal(), first.documentPackageId);
    expect(loaded).toMatchObject({
      formalMatterId: review.formalMatterId,
      sourceFormalMatterVersion: review.sourceFormalMatterVersion,
      sourceFormalMatterHash: review.sourceSnapshotSha256,
      professionalReviewCaseId: review.reviewCaseId,
      sourceReviewVersion: review.version,
      sourceCompletedDecisionId: review.decision!.decidedAt,
      sourceCompletedDecisionHash: completedDecisionFingerprint(review)
    });
  });
  it('persists bounded evidence, exact versions, and permits one concurrent writer', async () => {
    const opened = await create('versions');
    const command = (key: string) =>
      service().upsertEvidence(principal(), opened.documentPackageId, {
        expectedVersion: opened.version,
        idempotencyKey: key,
        evidence: {
          requirementKey: 'MARK_REPRESENTATION_FILE',
          documentType: 'MARK_ARTWORK',
          displayName: 'Mark representation',
          evidenceType: 'FILE_REFERENCE',
          originalFileName: 'mark.pdf',
          mediaType: 'application/pdf',
          sizeBytes: 32,
          checksum: 'c'.repeat(64),
          storageReference: 'evidence:task025',
          verificationStatus: 'RECORDED'
        }
      });
    const settled = await Promise.allSettled([
      command('evidence-winner-task025'),
      command('evidence-stale-task025')
    ]);
    expect(settled.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter((x) => x.status === 'rejected')).toHaveLength(1);
    const loaded = await service().get(principal(), opened.documentPackageId);
    expect(loaded.version).toBe(2);
    expect(loaded.documentItems[0]).toMatchObject({ originalFileName: 'mark.pdf' });
  });
  it('appends monotonic history and supersedes without updating the old entry', async () => {
    let value = await create('ledger');
    value = await service().appendInstruction(principal(), value.documentPackageId, {
      expectedVersion: value.version,
      idempotencyKey: 'append-one-task025',
      instruction: { instructionType: 'FILING_SCOPE', structuredPayload: { text: 'first' } }
    });
    const first = String(value.instructionEntries[0]!.instructionEntryId);
    value = await service().supersedeInstruction(principal(), value.documentPackageId, first, {
      expectedVersion: value.version,
      idempotencyKey: 'supersede-task025',
      instruction: { instructionType: 'FILING_SCOPE', structuredPayload: { text: 'replacement' } }
    });
    expect(value.instructionEntries.map((x) => x.sequence)).toEqual([1, 2]);
    expect(value.instructionEntries[1]).toMatchObject({ supersedesEntryId: first });
    expect(value.instructionEntries[0]).not.toHaveProperty('supersededAt');
  });
  it('serializes concurrent instruction appends without duplicate sequence values', async () => {
    const value = await create('concurrent-ledger');
    const append = (key: string, text: string) =>
      service().appendInstruction(principal(), value.documentPackageId, {
        expectedVersion: value.version,
        idempotencyKey: key,
        instruction: { instructionType: 'FILING_SCOPE', structuredPayload: { text } }
      });
    const settled = await Promise.allSettled([
      append('append-concurrent-a-task025', 'a'),
      append('append-concurrent-b-task025', 'b')
    ]);
    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(
      (await service().get(principal(), value.documentPackageId)).instructionEntries.map(
        (entry) => entry.sequence
      )
    ).toEqual([1]);
  });
  it('blocks incomplete sources, missing readiness evidence, and cross-Workspace discovery', async () => {
    const withoutCompletion = structuredClone(review) as ProfessionalReviewCase & {
      completedAt?: string;
    };
    delete withoutCompletion.completedAt;
    const incomplete: ProfessionalReviewCase = { ...withoutCompletion, status: 'IN_REVIEW' };
    await expect(create('incomplete', incomplete)).rejects.toMatchObject({
      code: 'SOURCE_REVIEW_INCOMPLETE'
    });
    const opened = await create('blocked');
    await expect(
      service().markReady(principal(), opened.documentPackageId, {
        expectedVersion: opened.version,
        idempotencyKey: 'ready-blocked-task025'
      })
    ).rejects.toMatchObject({ code: 'READINESS_BLOCKED_DOCUMENTS' });
    const withEvidence = await service().upsertEvidence(principal(), opened.documentPackageId, {
      expectedVersion: opened.version,
      idempotencyKey: 'blocked-evidence-task025',
      evidence: {
        requirementKey: 'MARK_REPRESENTATION_FILE',
        documentType: 'MARK_ARTWORK',
        displayName: 'Mark representation',
        evidenceType: 'FILE_REFERENCE',
        checksum: 'e'.repeat(64),
        verificationStatus: 'VERIFIED'
      }
    });
    await expect(
      service().markReady(principal(), opened.documentPackageId, {
        expectedVersion: withEvidence.version,
        idempotencyKey: 'ready-instructions-blocked-task025'
      })
    ).rejects.toMatchObject({ code: 'READINESS_BLOCKED_INSTRUCTIONS' });
    await expect(
      service().get(principal(otherWorkspaceId), opened.documentPackageId)
    ).rejects.toMatchObject({ code: 'DOCUMENT_PACKAGE_NOT_FOUND' });
    await expect(
      service().updateDraft(principal(otherWorkspaceId), opened.documentPackageId, {
        expectedVersion: withEvidence.version,
        idempotencyKey: 'cross-workspace-task025',
        draft: { note: 'hidden' }
      })
    ).rejects.toMatchObject({ code: 'DOCUMENT_PACKAGE_NOT_FOUND' });
  });
  it('marks ready idempotently, freezes evidence, and survives a fresh repository object', async () => {
    let value = await create('ready');
    value = await service().upsertEvidence(principal(), value.documentPackageId, {
      expectedVersion: value.version,
      idempotencyKey: 'ready-evidence-task025',
      evidence: {
        requirementKey: 'MARK_REPRESENTATION_FILE',
        documentType: 'MARK_ARTWORK',
        displayName: 'Mark representation',
        evidenceType: 'FILE_REFERENCE',
        checksum: 'd'.repeat(64),
        verificationStatus: 'VERIFIED'
      }
    });
    value = await service().appendInstruction(principal(), value.documentPackageId, {
      expectedVersion: value.version,
      idempotencyKey: 'ready-instruction-task025',
      instruction: { instructionType: 'FILING_SCOPE', structuredPayload: { text: 'reviewed' } }
    });
    const command = { expectedVersion: value.version, idempotencyKey: 'mark-ready-task025' };
    const ready = await service().markReady(principal(), value.documentPackageId, command);
    expect(ready.status).toBe('READY_FOR_PREPARATION_LOCK');
    expect(await service().markReady(principal(), value.documentPackageId, command)).toEqual(ready);
    const readyHash = ready.canonicalEvidenceHash;
    await expect(
      service().markReady(principal(), value.documentPackageId, {
        expectedVersion: value.version + 1,
        idempotencyKey: command.idempotencyKey
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect((await service().get(principal(), value.documentPackageId)).canonicalEvidenceHash).toBe(
      readyHash
    );
    await expect(
      service().updateDraft(principal(), value.documentPackageId, {
        expectedVersion: ready.version,
        idempotencyKey: 'mutate-ready-task025',
        draft: { note: 'no' }
      })
    ).rejects.toMatchObject({ code: 'PACKAGE_IMMUTABLE' });
    await expect(
      service().upsertEvidence(principal(), value.documentPackageId, {
        expectedVersion: ready.version,
        idempotencyKey: 'evidence-ready-task025',
        evidence: {
          requirementKey: 'MARK_REPRESENTATION_FILE',
          documentType: 'MARK_ARTWORK',
          displayName: 'Mark representation',
          evidenceType: 'FILE_REFERENCE',
          checksum: 'd'.repeat(64),
          verificationStatus: 'VERIFIED'
        }
      })
    ).rejects.toMatchObject({ code: 'PACKAGE_IMMUTABLE' });
    await expect(
      service().appendInstruction(principal(), value.documentPackageId, {
        expectedVersion: ready.version,
        idempotencyKey: 'instruction-ready-task025',
        instruction: { instructionType: 'FILING_SCOPE', structuredPayload: { text: 'no' } }
      })
    ).rejects.toMatchObject({ code: 'PACKAGE_IMMUTABLE' });
    const reloaded = await service().get(principal(), value.documentPackageId);
    expect(reloaded).toEqual(ready);
    const noLock = await database
      .getPool()
      .query<{ locks: string | null }>("SELECT to_regclass('preparation_locks')::text AS locks");
    expect(noLock.rows[0]!.locks).toBeNull();
  });
  it('rolls back Package version, instruction, command, and audit when the audit write fails', async () => {
    const value = await create('rollback');
    await database
      .getPool()
      .query(
        `CREATE OR REPLACE FUNCTION task025_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='INSTRUCTION_APPENDED' THEN RAISE EXCEPTION 'forced task025 rollback'; END IF; RETURN NEW; END $$`
      );
    await database
      .getPool()
      .query(
        'CREATE TRIGGER task025_fail_audit BEFORE INSERT ON document_package_audit FOR EACH ROW EXECUTE FUNCTION task025_fail_audit()'
      );
    await expect(
      service().appendInstruction(principal(), value.documentPackageId, {
        expectedVersion: value.version,
        idempotencyKey: 'append-rollback-task025',
        instruction: { instructionType: 'FILING_SCOPE', structuredPayload: { text: 'rollback' } }
      })
    ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' });
    await database.getPool().query('DROP TRIGGER task025_fail_audit ON document_package_audit');
    await database.getPool().query('DROP FUNCTION task025_fail_audit()');
    expect((await service().get(principal(), value.documentPackageId)).version).toBe(value.version);
    expect(
      (await database.getPool().query('SELECT 1 FROM document_instruction_entries')).rowCount
    ).toBe(0);
    expect(
      (
        await database
          .getPool()
          .query(
            "SELECT 1 FROM document_package_commands WHERE idempotency_key='append-rollback-task025'"
          )
      ).rowCount
    ).toBe(0);
    expect(
      (
        await database
          .getPool()
          .query("SELECT 1 FROM document_package_audit WHERE action='INSTRUCTION_APPENDED'")
      ).rowCount
    ).toBe(0);
  });
  it('maps database unavailability to canonical 503', async () => {
    const unavailable = new PostgresDocumentPackageService(
      { transact: () => Promise.reject(new Error('offline')) },
      { query: () => Promise.reject(new Error('offline')) } as never,
      { get: () => Promise.resolve(review) }
    );
    await expect(unavailable.get(principal(), 'document-package_missing')).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
      status: 503
    });
  });
});
