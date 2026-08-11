import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ReadyPackageContentExportV1 } from '@markorbit/contracts/knowledge-content-export';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  migrationStatus,
  parseDatabaseConfig,
  verifyMigrations
} from '@markorbit/persistence';
import { PostgresWorkspaceRepository } from '../src/identity.js';
import {
  fingerprintReadyPackageContentExport,
  PostgresKnowledgeReadyPackageContentRepository
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
const contentFixturePath = path.resolve(
  '../../packages/contracts/fixtures/ready-package-content-export-v1.json'
);
const migrations = () =>
  loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/core-service');
const config = () =>
  parseDatabaseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DB_MIGRATION_NAMESPACE: 'core_knowledge_intake',
    DB_APPLICATION_NAME: 'markorbit-core-knowledge-intake-tests'
  });
let database: ManagedDatabase;
const workspaceId = '018f0000-0000-7000-8000-000000000102';
const candidate = (key: string, readyPackageId = 'ready-one'): KnowledgeIntake => {
  const request = {
    readyPackageId,
    workspaceId,
    digest: 'digest-one',
    evidence: { artifactIds: ['artifact-one'], stagingDocumentId: 'staging-one' },
    submittedAt: '2026-08-10T12:00:00.000Z'
  };
  return {
    intakeId: crypto.randomUUID(),
    idempotencyKey: key,
    request,
    requestSha256: fingerprintCoreIntakeRequest(request),
    status: 'RECEIVED',
    receivedAt: new Date().toISOString()
  };
};

async function contentFixture(): Promise<ReadyPackageContentExportV1> {
  return JSON.parse(await readFile(contentFixturePath, 'utf8')) as ReadyPackageContentExportV1;
}

integration('PostgreSQL Knowledge intake repository', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    await database
      .getPool()
      .query(
        'DROP TABLE IF EXISTS knowledge_intake_contents,knowledge_intakes,sessions,workspace_memberships,workspaces,users CASCADE; DROP SCHEMA IF EXISTS markorbit_persistence CASCADE'
      );
    await migrate(database.getPool(), 'core_knowledge_intake', await migrations());
    await new PostgresWorkspaceRepository(database.getPool()).create({
      workspaceId,
      name: 'Knowledge Intake',
      slug: 'knowledge-intake'
    });
  });
  afterAll(async () => database.close());

  it('validates migration ownership, application, checksum, and repeatability', async () => {
    const owned = await migrations();
    expect(owned.at(-1)?.name).toBe('core_knowledge_intake_contents');
    await migrate(database.getPool(), 'core_knowledge_intake', owned);
    expect(
      (await migrationStatus(database.getPool(), 'core_knowledge_intake', owned)).every(
        (migration) => migration.state === 'applied'
      )
    ).toBe(true);
    await verifyMigrations(database.getPool(), 'core_knowledge_intake', owned);
  });

  it('persists and replays the original row across repository and database restart', async () => {
    const original = candidate('restart-key');
    const first = await new PostgresKnowledgeIntakeRepository(database.getPool()).createOrFind(
      original
    );
    expect(first.created).toBe(true);
    await database.close();
    database = new ManagedDatabase(config());
    await database.start();
    const replay = await new PostgresKnowledgeIntakeRepository(database.getPool()).createOrFind(
      candidate('restart-key')
    );
    expect(replay).toMatchObject({ created: false, intake: { intakeId: original.intakeId } });
    expect(replay.intake.receivedAt).toBe(original.receivedAt);
    expect(
      await new PostgresKnowledgeIntakeRepository(database.getPool()).findById(original.intakeId)
    ).toEqual(replay.intake);
    const count = await database
      .getPool()
      .query<{ count: number }>(
        "SELECT count(*)::int AS count FROM knowledge_intakes WHERE idempotency_key='restart-key'"
      );
    expect(count.rows[0]!.count).toBe(1);
  });

  it('allows exactly one concurrent same-key/same-body creation', async () => {
    const repository = new PostgresKnowledgeIntakeRepository(database.getPool());
    const results = await Promise.all([
      repository.createOrFind(candidate('same-race')),
      repository.createOrFind(candidate('same-race'))
    ]);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(new Set(results.map((result) => result.intake.intakeId)).size).toBe(1);
  });

  it('allows only one concurrent same-key/different-body durable intake', async () => {
    const repository = new PostgresKnowledgeIntakeRepository(database.getPool());
    const results = await Promise.all([
      repository.createOrFind(candidate('different-race', 'ready-a')),
      repository.createOrFind(candidate('different-race', 'ready-b'))
    ]);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(new Set(results.map((result) => result.intake.intakeId)).size).toBe(1);
    expect(new Set(results.map((result) => result.intake.requestSha256)).size).toBe(1);
  });

  it('persists canonical Markdown in Core and replays the immutable export after restart', async () => {
    const content = await contentFixture();
    const request = {
      readyPackageId: content.readyPackageId,
      workspaceId,
      digest: content.readyPackageDigest,
      evidence: {
        artifactIds: [content.rawArtifact.artifactId],
        stagingDocumentId: content.stagingDocument.documentId
      },
      submittedAt: '2026-08-11T01:00:00.000Z'
    };
    const intake: KnowledgeIntake = {
      intakeId: crypto.randomUUID(),
      idempotencyKey: 'content-restart',
      request,
      requestSha256: fingerprintCoreIntakeRequest(request),
      status: 'RECEIVED',
      receivedAt: '2026-08-11T01:00:01.000Z'
    };
    await new PostgresKnowledgeIntakeRepository(database.getPool()).createOrFind(intake);
    const storedContent = {
      intakeId: intake.intakeId,
      workspaceId,
      readyPackageId: content.readyPackageId,
      export: content,
      exportSha256: fingerprintReadyPackageContentExport(content),
      consumedAt: '2026-08-11T01:00:02.000Z'
    };
    const first = await new PostgresKnowledgeReadyPackageContentRepository(
      database.getPool()
    ).createOrFind(storedContent);
    expect(first.created).toBe(true);
    await database.close();
    database = new ManagedDatabase(config());
    await database.start();
    const replay = await new PostgresKnowledgeReadyPackageContentRepository(
      database.getPool()
    ).createOrFind({ ...storedContent, consumedAt: '2026-08-11T01:00:03.000Z' });
    expect(replay.created).toBe(false);
    expect(replay.content).toEqual(first.content);
    const persisted = await database.getPool().query<{
      count: number;
      staging_markdown: string;
      status: string;
    }>(
      `SELECT count(*) OVER()::int AS count,c.staging_markdown,i.status
       FROM knowledge_intake_contents c JOIN knowledge_intakes i USING(intake_id)
       WHERE c.intake_id=$1`,
      [intake.intakeId]
    );
    expect(persisted.rows[0]).toMatchObject({
      count: 1,
      staging_markdown: content.stagingDocument.content,
      status: 'RECEIVED'
    });
  });
});
