import { createHash } from 'node:crypto';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import { PostgresWorkspaceRepository } from '../src/identity.js';
import {
  fingerprintReadyPackageContentExportV1,
  PostgresKnowledgeContentExportRepository,
  type KnowledgeContentExport,
  type ReadyPackageContentExportV1
} from '../src/knowledge-content.js';
import {
  fingerprintCoreIntakeRequest,
  PostgresKnowledgeIntakeRepository,
  type KnowledgeIntake
} from '../src/knowledge-intake.js';

const url = process.env.KNOWLEDGE_INTAKE_TEST_DATABASE_URL;
const required = process.env.KNOWLEDGE_INTAKE_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'KNOWLEDGE_INTAKE_POSTGRES_TEST_REQUIRED=1 requires KNOWLEDGE_INTAKE_TEST_DATABASE_URL.'
  );
const integration = url ? describe : describe.skip;
const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const migrations = () =>
  loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/core-service');
const config = () =>
  parseDatabaseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DB_MIGRATION_NAMESPACE: 'core_knowledge_content',
    DB_APPLICATION_NAME: 'markorbit-core-knowledge-content-tests'
  });

let database: ManagedDatabase;
const workspaceId = '018f0000-0000-7000-8000-000000000302';
const intakeId = '018f0000-0000-7000-8000-000000000303';
const suffix = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const markdown = '# Durable Knowledge\n';
const stagingSha256 = createHash('sha256').update(markdown, 'utf8').digest('hex');
const digest = 'a'.repeat(64);
const readyPackageId = `rdp_${suffix}`;
const artifactId = `art_${suffix}`;
const stagingDocumentId = `std_${suffix}`;

const value: ReadyPackageContentExportV1 = {
  contractVersion: '1.0',
  objectType: 'READY_PACKAGE_CONTENT_EXPORT',
  readyPackageId,
  knowledgeWorkspaceId: `wsp_${suffix}`,
  readyPackageDigest: digest,
  provenance: {
    sourceId: `src_${suffix}`,
    conversionRunId: `cvr_${suffix}`,
    verificationId: `svr_${suffix}`,
    verificationOutcome: 'PASS_WITH_WARNINGS',
    capturedAt: '2026-08-11T04:10:00.000Z',
    converter: { converterId: 'canonical-markdown', version: '1.0.0' },
    legalTruthVerified: false
  },
  rawArtifact: {
    artifactId,
    sha256: 'b'.repeat(64),
    sizeBytes: 500,
    mimeType: 'application/pdf',
    originalName: 'source.pdf'
  },
  stagingDocument: {
    documentId: stagingDocumentId,
    sha256: stagingSha256,
    sizeBytes: Buffer.byteLength(markdown, 'utf8'),
    mediaType: 'text/markdown',
    encoding: 'utf-8',
    content: markdown
  }
};

const intakeCandidate = (): KnowledgeIntake => {
  const request = {
    readyPackageId,
    workspaceId,
    digest,
    evidence: { artifactIds: [artifactId], stagingDocumentId },
    submittedAt: '2026-08-11T04:11:00.000Z'
  };
  return {
    intakeId,
    idempotencyKey: 'content-postgres-intake',
    request,
    requestSha256: fingerprintCoreIntakeRequest(request),
    status: 'RECEIVED',
    receivedAt: '2026-08-11T04:11:01.000Z'
  };
};

const contentCandidate = (): KnowledgeContentExport => ({
  intakeId,
  workspaceId,
  readyPackageId,
  readyPackageDigest: digest,
  contentExport: value,
  exportSha256: fingerprintReadyPackageContentExportV1(value),
  receivedAt: '2026-08-11T04:12:00.000Z'
});

integration('PostgreSQL ReadyPackage content consumption', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    await database
      .getPool()
      .query(
        'DROP TABLE IF EXISTS knowledge_content_exports,knowledge_intakes,sessions,workspace_memberships,workspaces,users CASCADE; DROP SCHEMA IF EXISTS markorbit_persistence CASCADE'
      );
    await migrate(database.getPool(), 'core_knowledge_content', await migrations());
    await new PostgresWorkspaceRepository(database.getPool()).create({
      workspaceId,
      name: 'Knowledge Content',
      slug: 'knowledge-content'
    });
    await new PostgresKnowledgeIntakeRepository(database.getPool()).createOrFind(intakeCandidate());
  });

  afterAll(async () => database.close());

  it('persists and replays one immutable export across a database restart', async () => {
    const repository = new PostgresKnowledgeContentExportRepository(database.getPool());
    const candidate = contentCandidate();
    const first = await repository.createOrFind(candidate);
    expect(first.created).toBe(true);
    expect(first.contentExport.contentExport.stagingDocument.content).toBe(markdown);

    await database.close();
    database = new ManagedDatabase(config());
    await database.start();
    const replay = await new PostgresKnowledgeContentExportRepository(
      database.getPool()
    ).createOrFind(candidate);
    expect(replay.created).toBe(false);
    expect(replay.contentExport.exportSha256).toBe(candidate.exportSha256);
    expect(replay.contentExport.receivedAt).toBe(candidate.receivedAt);
    const count = await database
      .getPool()
      .query<{ count: number }>(
        'SELECT count(*)::int AS count FROM knowledge_content_exports WHERE intake_id=$1',
        [intakeId]
      );
    expect(count.rows[0]!.count).toBe(1);
  });

  it('returns the original immutable row for a different replay candidate', async () => {
    const repository = new PostgresKnowledgeContentExportRepository(database.getPool());
    const changedValue = {
      ...value,
      rawArtifact: { ...value.rawArtifact, originalName: 'changed.pdf' }
    };
    const replay = await repository.createOrFind({
      ...contentCandidate(),
      contentExport: changedValue,
      exportSha256: fingerprintReadyPackageContentExportV1(changedValue),
      receivedAt: '2026-08-11T05:00:00.000Z'
    });
    expect(replay.created).toBe(false);
    expect(replay.contentExport.exportSha256).toBe(fingerprintReadyPackageContentExportV1(value));
    expect(replay.contentExport.contentExport.rawArtifact.originalName).toBe('source.pdf');
  });
});
