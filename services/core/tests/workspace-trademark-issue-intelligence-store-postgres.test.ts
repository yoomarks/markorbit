import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  BrainIntelligenceId,
  WorkspaceTrademarkIssueIntelligenceV1
} from '@markorbit/contracts/brain-workspace-intelligence';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import { PostgresWorkspaceTrademarkIssueIntelligenceRepository } from '../src/workspace-trademark-issue-intelligence-store.js';

const url =
  process.env.BRAIN_INTELLIGENCE_STORE_TEST_DATABASE_URL ??
  process.env.BRAIN_REGISTRY_TEST_DATABASE_URL;
const required =
  process.env.BRAIN_INTELLIGENCE_STORE_POSTGRES_TEST_REQUIRED === '1' ||
  process.env.BRAIN_REGISTRY_POSTGRES_TEST_REQUIRED === '1';
if (required && !url) {
  throw new Error('Brain intelligence PostgreSQL durability requires a test database URL.');
}
const integration = url ? describe : describe.skip;
const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const storeMigrations = async () =>
  (
    await loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/core-service')
  ).filter((migration) => migration.version === '0117');
const config = () =>
  parseDatabaseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DB_MIGRATION_NAMESPACE: 'core_workspace_trademark_issue_intelligence',
    DB_APPLICATION_NAME: 'markorbit-brain-intelligence-store-tests'
  });

const WORKSPACE_A = '11111111-1111-4111-8111-111111111111';
const WORKSPACE_B = '22222222-2222-4222-8222-222222222222';
const PRIVATE_KNOWLEDGE = 'wsp_01K4J3ABCD1234567890EFGHJK';
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

let database: ManagedDatabase;

function intelligence(
  workspaceId = WORKSPACE_A,
  suffix = '1',
  overrides: Partial<WorkspaceTrademarkIssueIntelligenceV1> = {}
): WorkspaceTrademarkIssueIntelligenceV1 {
  const intelligenceId: BrainIntelligenceId = `brain-intelligence_${suffix.repeat(64)}`;
  const evidenceId = `brain-knowledge-evidence_${HASH_A}` as const;
  return {
    schemaVersion: 1,
    intelligenceId,
    workspaceId,
    task: 'TRADEMARK_ISSUE_EXTRACTION',
    status: 'INTERPRETED',
    evidence: [
      {
        schemaVersion: 1,
        evidenceId,
        intakeId: 'knowledge-intake_test',
        knowledgeWorkspaceId: PRIVATE_KNOWLEDGE,
        readyPackageId: 'ready-package_test',
        readyPackageDigest: HASH_A,
        exportSha256: HASH_B,
        sourceId: 'source_test',
        rawArtifactId: 'raw-artifact_test',
        rawArtifactSha256: HASH_A,
        stagingDocumentId: 'staging-document_test',
        contentSha256: HASH_B,
        capturedAt: '2026-09-14T12:00:00.000Z'
      }
    ],
    primitives: [
      {
        primitiveId: `brain-intelligence-primitive_${HASH_B}`,
        kind: 'REQUIREMENT',
        summary: 'A governed issue primitive.',
        jurisdiction: 'US',
        confidence: 0.9,
        uncertainty: 'LOW',
        evidenceRefs: [evidenceId]
      }
    ],
    explanation: 'Governed evidence supports the extracted requirement.',
    interpreter: {
      profileId: 'brain.trademark-issue-extractor',
      version: '1.0.0',
      policyProfileId: 'brain.policy.governed-evidence.v1'
    },
    generatedAt: '2026-09-14T12:01:00.000Z',
    ...overrides
  };
}

async function reopen(): Promise<PostgresWorkspaceTrademarkIssueIntelligenceRepository> {
  await database.close();
  database = new ManagedDatabase(config());
  await database.start();
  return new PostgresWorkspaceTrademarkIssueIntelligenceRepository(database);
}

async function cleanup(): Promise<void> {
  await database
    .getPool()
    .query('TRUNCATE core_workspace_trademark_issue_intelligence RESTART IDENTITY CASCADE');
}

integration('PostgreSQL workspace trademark issue intelligence store', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    await database.getPool().query(
      `DROP TABLE IF EXISTS core_workspace_trademark_issue_intelligence CASCADE;
       DROP SCHEMA IF EXISTS markorbit_persistence CASCADE`
    );
    await migrate(
      database.getPool(),
      'core_workspace_trademark_issue_intelligence',
      await storeMigrations()
    );
  });

  afterAll(async () => database.close());

  it('replays the exact intelligence snapshot after restart without duplicating rows', async () => {
    await cleanup();
    const value = intelligence();
    const repository = new PostgresWorkspaceTrademarkIssueIntelligenceRepository(database);
    const first = await repository.record(value);

    const restarted = await reopen();
    const replay = await restarted.record(structuredClone(value));

    expect(first.replayed).toBe(false);
    expect(replay).toEqual({ intelligence: first.intelligence, replayed: true });
    expect(
      (await database.getPool().query('SELECT 1 FROM core_workspace_trademark_issue_intelligence'))
        .rowCount
    ).toBe(1);
  });

  it('does not reveal another Workspace record when queried with the wrong Workspace', async () => {
    await cleanup();
    const repository = new PostgresWorkspaceTrademarkIssueIntelligenceRepository(database);
    const a = intelligence(WORKSPACE_A, '1');
    const b = intelligence(WORKSPACE_B, '2');
    await repository.record(a);
    await repository.record(b);

    expect(await repository.find(WORKSPACE_A, a.intelligenceId)).toEqual(a);
    expect(await repository.find(WORKSPACE_A, b.intelligenceId)).toBeUndefined();
    expect(await repository.find(WORKSPACE_B, a.intelligenceId)).toBeUndefined();
    expect(await repository.find(WORKSPACE_B, b.intelligenceId)).toEqual(b);
  });

  it('fails closed when the same intelligence id is replayed with changed content', async () => {
    await cleanup();
    const repository = new PostgresWorkspaceTrademarkIssueIntelligenceRepository(database);
    const value = intelligence();
    await repository.record(value);

    await expect(
      repository.record({
        ...value,
        explanation: 'Materially changed explanation under the same deterministic id.'
      })
    ).rejects.toMatchObject({ code: 'IDENTITY_CONFLICT' });
  });

  it('detects persisted metadata drift before returning intelligence', async () => {
    await cleanup();
    const repository = new PostgresWorkspaceTrademarkIssueIntelligenceRepository(database);
    const value = intelligence();
    await repository.record(value);
    await database.getPool().query(
      `UPDATE core_workspace_trademark_issue_intelligence
          SET status='CONFLICTED'
        WHERE workspace_id=$1 AND intelligence_id=$2`,
      [value.workspaceId, value.intelligenceId]
    );

    await expect(repository.find(value.workspaceId, value.intelligenceId)).rejects.toMatchObject({
      code: 'PERSISTENCE_INTEGRITY_FAILURE'
    });
  });

  it('detects persisted snapshot tampering before returning intelligence', async () => {
    await cleanup();
    const repository = new PostgresWorkspaceTrademarkIssueIntelligenceRepository(database);
    const value = intelligence();
    await repository.record(value);
    await database.getPool().query(
      `UPDATE core_workspace_trademark_issue_intelligence
          SET intelligence_json = jsonb_set(
            intelligence_json,
            '{explanation}',
            to_jsonb('tampered persisted explanation'::text)
          )
        WHERE workspace_id=$1 AND intelligence_id=$2`,
      [value.workspaceId, value.intelligenceId]
    );

    await expect(repository.find(value.workspaceId, value.intelligenceId)).rejects.toMatchObject({
      code: 'PERSISTENCE_INTEGRITY_FAILURE'
    });
  });
});
