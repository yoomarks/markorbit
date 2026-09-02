import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import { ManagedDatabase, loadMigrationsForOwner } from '@markorbit/persistence';
import { PostgresDurablePreparationLockService } from '../src/durable-preparation-lock.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from './support/markreg-test-database.js';

const url = process.env.MARKREG_TEST_DATABASE_URL;
const required = process.env.MARKREG_PREPARATION_LOCK_POSTGRES_REQUIRED === '1';
if (required && !url)
  throw new Error('MARKREG_TEST_DATABASE_URL is required in required Preparation Lock mode.');

const suite = url ? describe : describe.skip;
const workspaceId = '38383838-3838-4383-8383-383838383838';
const otherWorkspaceId = '39393939-3939-4393-8393-393939393939';
const at = '2026-09-02T00:00:00.000Z';
const canonicalEvidenceHash = 'd'.repeat(64);

const principal = (
  workspace = workspaceId,
  permissions: WorkspacePrincipal['permissions'] = [
    'workspace:read',
    'document-package:read',
    'document-package:mark-ready'
  ]
): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: 'session_task038',
  userId: 'user_task038',
  workspaceId: workspace,
  membershipId: 'membership_task038',
  role: 'WORKSPACE_ADMIN',
  permissions,
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
});

suite('PostgreSQL durable Preparation Lock', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: MARKREG_TEST_MIGRATION_NAMESPACE,
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: MARKREG_TEST_MIGRATION_NAMESPACE
  });

  const service = () =>
    new PostgresDurablePreparationLockService(database, database.getPool(), () => at);

  async function insertReadyPackage(suffix: string, workspace = workspaceId) {
    const documentPackageId = `document-package_${suffix}`;
    await database.getPool().query(
      `INSERT INTO document_packages (
        document_package_id,workspace_id,formal_matter_id,source_formal_matter_version,
        source_formal_matter_sha256,professional_review_case_id,source_review_version,
        source_completed_decision_id,source_completed_decision_sha256,status,version,schema_version,
        package_data,canonical_evidence_sha256,created_by,updated_by,created_at,updated_at,ready_at,ready_by
      ) VALUES ($1,$2,$3,3,$4,$5,5,$6,$7,'READY_FOR_PREPARATION_LOCK',4,1,$8::jsonb,$9,$10,$10,$11,$11,$11,$10)`,
      [
        documentPackageId,
        workspace,
        `formal-matter_${suffix}`,
        'a'.repeat(64),
        `professional-review_${suffix}`,
        `decision_${suffix}`,
        'b'.repeat(64),
        JSON.stringify({ requirements: [], draft: {} }),
        canonicalEvidenceHash,
        'user_task038',
        at
      ]
    );
    await database.getPool().query(
      `INSERT INTO document_instruction_entries (
        instruction_entry_id,document_package_id,workspace_id,sequence,instruction_type,
        structured_payload,actor_id,created_at,canonical_fingerprint
      ) VALUES ($1,$2,$3,1,'FILING_SCOPE',$4::jsonb,$5,$6,$7)`,
      [
        `instruction-entry_${suffix}`,
        documentPackageId,
        workspace,
        JSON.stringify({ text: 'reviewed scope' }),
        'user_task038',
        at,
        'c'.repeat(64)
      ]
    );
    return { documentPackageId, version: 4, canonicalEvidenceHash };
  }

  const create = (
    packageValue: Awaited<ReturnType<typeof insertReadyPackage>>,
    idempotencyKey: string,
    overrides: Partial<{
      expectedDocumentPackageVersion: number;
      expectedCanonicalEvidenceHash: string;
    }> = {}
  ) =>
    service().create(principal(), {
      documentPackageId: packageValue.documentPackageId,
      expectedDocumentPackageVersion:
        overrides.expectedDocumentPackageVersion ?? packageValue.version,
      expectedCanonicalEvidenceHash:
        overrides.expectedCanonicalEvidenceHash ?? packageValue.canonicalEvidenceHash,
      idempotencyKey
    });

  beforeAll(async () => {
    await database.start();
    await resetAndMigrateMarkRegTestDatabase({
      pool: database.getPool(),
      migrationsDirectory: path.resolve('../../infrastructure/persistence/migrations'),
      migrationOwners: path.resolve('../../infrastructure/persistence/migration-owners.json')
    });
  });

  beforeEach(() =>
    database
      .getPool()
      .query(
        'TRUNCATE markreg_preparation_lock_audit,markreg_preparation_lock_commands,markreg_preparation_locks,document_package_audit,document_package_commands,document_instruction_entries,document_package_items,document_packages RESTART IDENTITY CASCADE'
      )
  );

  afterAll(() => database.close());

  it('loads migration 0082 under MarkReg ownership', async () => {
    const migrations = await loadMigrationsForOwner(
      path.resolve('../../infrastructure/persistence/migrations'),
      path.resolve('../../infrastructure/persistence/migration-owners.json'),
      '@markorbit/markreg-service'
    );
    expect(migrations.map((value) => `${value.version}_${value.name}`)).toContain(
      '0082_markreg_preparation_locks'
    );
  });

  it('pins exact READY lineage and replays across service restart', async () => {
    const packageValue = await insertReadyPackage('task038-replay');
    const first = await create(packageValue, 'lock-replay-task038');

    expect(first).toMatchObject({
      workspaceId,
      version: 1,
      source: {
        documentPackageId: packageValue.documentPackageId,
        documentPackageVersion: 4,
        canonicalEvidenceHash,
        formalMatterId: 'formal-matter_task038-replay',
        formalMatterVersion: 3,
        professionalReviewCaseId: 'professional-review_task038-replay',
        reviewVersion: 5,
        completedDecisionId: 'decision_task038-replay',
        instructionEntryCount: 1
      },
      authority: {
        filingAuthorizationCreated: false,
        executionReleaseCreated: false,
        externalFilingCreated: false,
        paymentCreated: false,
        providerContacted: false,
        officialTruthCreated: false
      }
    });

    const restarted = new PostgresDurablePreparationLockService(
      database,
      database.getPool(),
      () => at
    );
    const replay = await restarted.create(principal(), {
      documentPackageId: packageValue.documentPackageId,
      expectedDocumentPackageVersion: packageValue.version,
      expectedCanonicalEvidenceHash: canonicalEvidenceHash,
      idempotencyKey: 'lock-replay-task038'
    });
    expect(replay).toEqual(first);

    const sameSource = await create(packageValue, 'lock-same-source-task038');
    expect(sameSource.preparationLockId).toBe(first.preparationLockId);
    expect(
      (await database.getPool().query('SELECT 1 FROM markreg_preparation_locks')).rowCount
    ).toBe(1);
  });

  it('rejects conflicting idempotency reuse and stale source identity', async () => {
    const packageValue = await insertReadyPackage('task038-stale');
    await create(packageValue, 'lock-stale-task038');

    await expect(
      create(packageValue, 'lock-stale-task038', {
        expectedCanonicalEvidenceHash: 'e'.repeat(64)
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    await expect(
      create(packageValue, 'lock-stale-version-task038', {
        expectedDocumentPackageVersion: packageValue.version + 1
      })
    ).rejects.toMatchObject({ code: 'STALE_PREPARATION_SOURCE', status: 409 });
    await expect(
      create(packageValue, 'lock-stale-hash-task038', {
        expectedCanonicalEvidenceHash: 'e'.repeat(64)
      })
    ).rejects.toMatchObject({ code: 'STALE_PREPARATION_SOURCE', status: 409 });
  });

  it('enforces create/read permissions and Workspace isolation', async () => {
    const packageValue = await insertReadyPackage('task038-auth');
    await expect(
      service().create(principal(workspaceId, ['document-package:read']), {
        documentPackageId: packageValue.documentPackageId,
        expectedDocumentPackageVersion: packageValue.version,
        expectedCanonicalEvidenceHash: canonicalEvidenceHash,
        idempotencyKey: 'lock-permission-task038'
      })
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED', status: 403 });

    const lock = await create(packageValue, 'lock-auth-task038');
    await expect(
      service().get(principal(workspaceId, ['document-package:mark-ready']), lock.preparationLockId)
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED', status: 403 });
    await expect(
      service().get(principal(otherWorkspaceId), lock.preparationLockId)
    ).rejects.toMatchObject({ code: 'PREPARATION_LOCK_NOT_FOUND', status: 404 });
  });

  it('fails closed when canonical instruction truth changes', async () => {
    const packageValue = await insertReadyPackage('task038-current');
    const lock = await create(packageValue, 'lock-current-task038');
    expect(await service().validateCurrent(principal(), lock.preparationLockId)).toEqual(lock);

    await database.getPool().query(
      `INSERT INTO document_instruction_entries (
        instruction_entry_id,document_package_id,workspace_id,sequence,instruction_type,
        structured_payload,actor_id,created_at,canonical_fingerprint
      ) VALUES ($1,$2,$3,2,'FILING_SCOPE',$4::jsonb,$5,$6,$7)`,
      [
        'instruction-entry_task038-current-late',
        packageValue.documentPackageId,
        workspaceId,
        JSON.stringify({ text: 'late mutation' }),
        'user_task038',
        at,
        'e'.repeat(64)
      ]
    );

    await expect(
      service().validateCurrent(principal(), lock.preparationLockId)
    ).rejects.toMatchObject({ code: 'STALE_PREPARATION_SOURCE', status: 409 });
  });

  it('maps database unavailability to canonical retryable 503', async () => {
    const unavailable = new PostgresDurablePreparationLockService(
      { transact: () => Promise.reject(new Error('offline')) },
      { query: () => Promise.reject(new Error('offline')) } as never
    );
    await expect(unavailable.get(principal(), 'preparation-lock_missing')).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
      status: 503,
      retryable: true
    });
  });
});
