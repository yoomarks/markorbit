import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import type { ReadyPackageContentExportV1 } from '@markorbit/contracts/knowledge-content-export';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  migrationStatus,
  parseDatabaseConfig,
  verifyMigrations
} from '@markorbit/persistence';
import {
  PostgresMembershipRepository,
  PostgresUserRepository,
  PostgresWorkspaceRepository
} from '../src/identity.js';
import { CurrentWorkspaceAuthorityService } from '../src/current-workspace-authority.js';
import {
  fingerprintReadyPackageContentExport,
  PostgresKnowledgeReadyPackageContentRepository
} from '../src/knowledge-content.js';
import {
  fingerprintCoreIntakeRequest,
  PostgresKnowledgeIntakeRepository,
  type KnowledgeIntake
} from '../src/knowledge-intake.js';
import {
  PostgresWorkspacePrivateCaseEvidenceBindingRepository,
  WorkspacePrivateCaseEvidenceService,
  type FormalMatterCurrentSnapshot
} from '../src/workspace-private-case-evidence.js';

const url = process.env.KNOWLEDGE_INTAKE_TEST_DATABASE_URL;
const required = process.env.KNOWLEDGE_INTAKE_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'KNOWLEDGE_INTAKE_POSTGRES_TEST_REQUIRED=1 requires KNOWLEDGE_INTAKE_TEST_DATABASE_URL.'
  );
const integration = url ? describe : describe.skip;
const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const contentFixturePath = path.resolve(
  '../../packages/contracts/fixtures/ready-package-content-export-v1.json'
);
const migrations = () =>
  loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/core-service');
const config = () =>
  parseDatabaseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DB_MIGRATION_NAMESPACE: 'core_workspace_private_case_evidence',
    DB_APPLICATION_NAME: 'markorbit-core-workspace-private-case-evidence-tests'
  });

const workspaceId = '018f0000-0000-7000-8000-000000000601';
const userId = '018f0000-0000-7000-8000-000000000602';
const membershipId = '018f0000-0000-7000-8000-000000000603';
const bindingId = '018f0000-0000-7000-8000-000000000604';
const matter: FormalMatterCurrentSnapshot = {
  workspaceId,
  formalMatterId: 'formal-matter_postgres-case-601',
  version: 1,
  snapshotSha256: '6'.repeat(64),
  status: 'OPEN'
};
let database: ManagedDatabase;
let content: ReadyPackageContentExportV1;
let intake: KnowledgeIntake;
let exportSha256: string;

const principal = (): WorkspacePrincipal => ({
  kind: 'WORKSPACE',
  sessionId: 'session_postgres_case_601',
  userId,
  workspaceId,
  membershipId,
  role: 'WORKSPACE_ADMIN',
  permissions: ['matter:read', 'matter:manage'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
});

async function seedCoreEvidence() {
  content = JSON.parse(await readFile(contentFixturePath, 'utf8')) as ReadyPackageContentExportV1;
  const request = {
    readyPackageId: content.readyPackageId,
    workspaceId,
    digest: content.readyPackageDigest,
    evidence: {
      artifactIds: [content.rawArtifact.artifactId],
      stagingDocumentId: content.stagingDocument.documentId
    },
    submittedAt: '2026-09-30T11:00:00.000Z'
  };
  intake = {
    intakeId: crypto.randomUUID(),
    idempotencyKey: 'case-evidence-postgres-intake',
    request,
    requestSha256: fingerprintCoreIntakeRequest(request),
    status: 'ACCEPTED',
    receivedAt: '2026-09-30T11:00:01.000Z'
  };
  exportSha256 = fingerprintReadyPackageContentExport(content);
  await new PostgresKnowledgeIntakeRepository(database.getPool()).createOrFind(intake);
  await new PostgresKnowledgeReadyPackageContentRepository(database.getPool()).createOrFind({
    intakeId: intake.intakeId,
    workspaceId,
    readyPackageId: content.readyPackageId,
    export: content,
    exportSha256,
    consumedAt: '2026-09-30T11:00:02.000Z'
  });
}

function service(id = bindingId) {
  const pool = database.getPool();
  return new WorkspacePrivateCaseEvidenceService({
    repository: new PostgresWorkspacePrivateCaseEvidenceBindingRepository(pool),
    currentWorkspaceAuthority: new CurrentWorkspaceAuthorityService({
      users: new PostgresUserRepository(pool),
      workspaces: new PostgresWorkspaceRepository(pool),
      memberships: new PostgresMembershipRepository(pool)
    }),
    knowledgeIntakes: new PostgresKnowledgeIntakeRepository(pool),
    knowledgeContents: new PostgresKnowledgeReadyPackageContentRepository(pool),
    formalMatters: {
      async read() {
        await Promise.resolve();
        return structuredClone(matter);
      }
    },
    clock: () => new Date('2026-09-30T12:00:00.000Z'),
    newId: () => id
  });
}

function suggestion(key = 'postgres-suggest-601') {
  return {
    idempotencyKey: key,
    formalMatterId: matter.formalMatterId,
    expectedFormalMatterVersion: matter.version,
    expectedFormalMatterSnapshotSha256: matter.snapshotSha256,
    readyPackageId: content.readyPackageId,
    expectedKnowledgeWorkspaceId: content.knowledgeWorkspaceId,
    expectedReadyPackageDigest: content.readyPackageDigest,
    expectedCoreIntakeId: intake.intakeId,
    expectedContentExportSha256: exportSha256,
    expectedStagingDocumentId: content.stagingDocument.documentId,
    expectedStagingSha256: content.stagingDocument.sha256,
    expectedRawArtifactId: content.rawArtifact.artifactId,
    expectedRawArtifactSha256: content.rawArtifact.sha256,
    sourceLocators: ['knowledge://postgres/private/case-601'],
    methodProvenanceRefs: ['method://oa-p2a/postgres-case-binding-v1']
  };
}

integration('PostgreSQL Workspace-private exact CASE evidence binding', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    await database
      .getPool()
      .query(
        'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS markorbit_persistence CASCADE'
      );
    await migrate(database.getPool(), 'core_workspace_private_case_evidence', await migrations());
    await new PostgresUserRepository(database.getPool()).create({
      userId,
      email: 'case-evidence@example.test',
      displayName: 'Case Evidence'
    });
    await new PostgresWorkspaceRepository(database.getPool()).create({
      workspaceId,
      name: 'Case Evidence',
      slug: 'case-evidence'
    });
    await new PostgresMembershipRepository(database.getPool()).create({
      membershipId,
      userId,
      workspaceId,
      role: 'WORKSPACE_ADMIN'
    });
    await seedCoreEvidence();
  });
  afterAll(async () => database.close());

  it('applies and verifies migration 0148 under the Core owner', async () => {
    const owned = await migrations();
    expect(owned.map((migration) => migration.name)).toContain(
      'core_workspace_private_case_evidence'
    );
    await migrate(database.getPool(), 'core_workspace_private_case_evidence', owned);
    expect(
      (
        await migrationStatus(database.getPool(), 'core_workspace_private_case_evidence', owned)
      ).every((migration) => migration.state === 'applied')
    ).toBe(true);
    await verifyMigrations(database.getPool(), 'core_workspace_private_case_evidence', owned);
  });

  it('persists suggestion and explicit acceptance across database restart', async () => {
    const first = service();
    const suggested = await first.suggest(principal(), suggestion());
    expect(suggested).toMatchObject({ bindingId, version: 1, status: 'SUGGESTED' });
    const accepted = await first.decide(principal(), {
      bindingId,
      expectedVersion: 1,
      idempotencyKey: 'postgres-accept-601',
      decision: 'ACCEPT'
    });
    expect(accepted).toMatchObject({ version: 2, status: 'ACCEPTED' });

    await database.close();
    database = new ManagedDatabase(config());
    await database.start();
    const reloaded = await new PostgresWorkspacePrivateCaseEvidenceBindingRepository(
      database.getPool()
    ).findById(bindingId);
    expect(reloaded).toEqual(accepted);
    const grant = await service().readGrant(principal(), {
      bindingId,
      expectedVersion: 2
    });
    expect(grant).toMatchObject({
      bindingVersion: 2,
      caseId: matter.formalMatterId,
      rawArtifactSha256: content.rawArtifact.sha256
    });
  });

  it('serializes concurrent same-key suggestions to one durable row', async () => {
    const key = 'postgres-concurrent-602';
    const first = service('018f0000-0000-7000-8000-000000000605');
    const second = service('018f0000-0000-7000-8000-000000000606');
    const results = await Promise.all([
      first.suggest(principal(), suggestion(key)),
      second.suggest(principal(), suggestion(key))
    ]);
    expect(new Set(results.map((item) => item.bindingId)).size).toBe(1);
    const count = await database
      .getPool()
      .query<{ count: number }>(
        'SELECT count(*)::int AS count FROM core_workspace_private_case_evidence_bindings WHERE workspace_id=$1 AND suggestion_idempotency_key=$2',
        [workspaceId, key]
      );
    expect(count.rows[0]!.count).toBe(1);
  });

  it('rejects same idempotency key with a different exact source fingerprint', async () => {
    const key = 'postgres-conflict-603';
    await service('018f0000-0000-7000-8000-000000000607').suggest(principal(), suggestion(key));
    await expect(
      service('018f0000-0000-7000-8000-000000000608').suggest(principal(), {
        ...suggestion(key),
        sourceLocators: ['knowledge://postgres/private/different-case-source']
      })
    ).rejects.toMatchObject({
      code: 'WORKSPACE_PRIVATE_CASE_EVIDENCE_REPLAY_CONFLICT',
      status: 409
    });
  });

  it('stores evidence identity only and never persists private staging Markdown', async () => {
    const columns = await database
      .getPool()
      .query<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name='core_workspace_private_case_evidence_bindings' ORDER BY ordinal_position"
      );
    expect(columns.rows.map((row) => row.column_name)).not.toContain('staging_markdown');
    const serialized = await database
      .getPool()
      .query<{ payload: string }>(
        'SELECT row_to_json(b)::text AS payload FROM core_workspace_private_case_evidence_bindings b WHERE binding_id=$1',
        [bindingId]
      );
    expect(serialized.rows[0]!.payload).not.toContain(content.stagingDocument.content);
  });
});
