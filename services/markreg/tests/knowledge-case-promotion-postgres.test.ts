import { createHash } from 'node:crypto';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ManagedDatabase,
  loadMigrationsForOwner,
  migrationStatus,
  verifyMigrations
} from '@markorbit/persistence';
import type {
  KnowledgeCasePromotionError,
  KnowledgeCaseCandidateV1,
  KnowledgeCasePromotionRecord
} from '../src/knowledge-case-promotion.js';
import { PostgresKnowledgeCasePromotionRepository } from '../src/knowledge-case-promotion-postgres.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from './support/markreg-test-database.js';

const url = process.env.MARKREG_TEST_DATABASE_URL;
const required = process.env.MARKREG_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error('MARKREG_TEST_DATABASE_URL is required when MARKREG_POSTGRES_TEST_REQUIRED=1.');
const suite = url ? describe : describe.skip;
const workspaceId = '77777777-7777-4777-8777-777777777777';
const at = '2026-08-26T06:00:00.000Z';
const dispatchedAt = '2026-08-26T06:00:01.000Z';
const reconciledAt = '2026-08-26T06:00:02.000Z';
const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

suite.sequential('PostgreSQL MarkReg Knowledge Case promotion durability', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'markreg-knowledge-case-promotion-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: MARKREG_TEST_MIGRATION_NAMESPACE
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');

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
        'TRUNCATE markreg_knowledge_case_promotion_commands, markreg_knowledge_case_promotions, formal_matters RESTART IDENTITY CASCADE'
      )
  );

  afterAll(() => database.close());

  async function insertMatter(suffix: string) {
    const formalMatterId = `formal-matter_${suffix}`;
    const snapshotSha256 = sha256(`snapshot:${suffix}`);
    await database
      .getPool()
      .query(
        'INSERT INTO formal_matters (formal_matter_id,workspace_id,kind,status,version,source_customer_confirmation_id,source_customer_confirmation_version,source_matter_draft_id,source_matter_draft_version,source_quote_id,source_quote_version,source_snapshot,snapshot_schema_version,snapshot_sha256,created_by_user_id,created_at,updated_at) VALUES ($1,$2,$3,$4,1,$5,1,$6,1,$7,$8,$9::jsonb,1,$10,$11,$12,$12)',
        [
          formalMatterId,
          workspaceId,
          'TRADEMARK_REGISTRATION',
          'OPEN',
          `confirmation_${suffix}`,
          `matter-draft_${suffix}`,
          `quote_${suffix}`,
          'quote-v1',
          JSON.stringify({ preparation: { applicantName: 'Orbit Ltd', trademark: 'ORBIT' } }),
          snapshotSha256,
          `user_${suffix}`,
          at
        ]
      );
    return { formalMatterId, snapshotSha256 };
  }

  function record(
    suffix: string,
    matter: { formalMatterId: string; snapshotSha256: string },
    input: { requestFingerprint?: string; candidateIdempotencyKey?: string } = {}
  ): KnowledgeCasePromotionRecord {
    const sourceIdentitySha256 = sha256(
      `${workspaceId}:${matter.formalMatterId}:1:${matter.snapshotSha256}`
    );
    const requestFingerprintSha256 = input.requestFingerprint ?? sha256(`request:${suffix}`);
    const candidate: KnowledgeCaseCandidateV1 = {
      protocolVersion: '1.0',
      objectType: 'CASE_CANDIDATE',
      candidateId: `case-candidate_${sourceIdentitySha256}`,
      sourceSystem: 'MARKREG',
      sourceMatterId: matter.formalMatterId,
      sourceMatterVersion: 1,
      sourceSnapshotSha256: matter.snapshotSha256,
      sourceRetrievalRef: `markreg:case-source:v1:${sourceIdentitySha256}`,
      promotedBy: `user_${suffix}`,
      promotedAt: at,
      accessScope: { sourceWorkspaceId: workspaceId, classification: 'INTERNAL' },
      idempotencyKey: input.candidateIdempotencyKey ?? `candidate-${suffix}-0001`
    };
    return {
      producerPromotionRef: `markreg:case-promotion:v1:${sourceIdentitySha256}`,
      workspaceId,
      sourceIdentitySha256,
      requestFingerprintSha256,
      candidate,
      state: 'CLAIMED',
      createdAt: at,
      updatedAt: at
    };
  }

  function repository() {
    return new PostgresKnowledgeCasePromotionRepository(database, database.getPool());
  }

  it('applies and verifies reserved MarkReg migration 0069', async () => {
    const migrations = await loadMigrationsForOwner(
      migrationsDirectory,
      migrationOwners,
      '@markorbit/markreg-service'
    );
    expect(migrations.map((migration) => migration.version)).toContain('0069');
    expect(
      (
        await migrationStatus(database.getPool(), MARKREG_TEST_MIGRATION_NAMESPACE, migrations)
      ).every((migration) => migration.state === 'applied')
    ).toBe(true);
    await verifyMigrations(database.getPool(), MARKREG_TEST_MIGRATION_NAMESPACE, migrations);
  });

  it('durably replays one command and aliases another key to the same source result', async () => {
    const matter = await insertMatter('replay');
    const value = record('replay', matter);
    const repo = repository();
    const first = await repo.claim({ record: value, idempotencyKey: 'promotion-replay-0001' });
    expect(first).toEqual({ acquired: true, record: value });

    const replay = await repo.claim({ record: value, idempotencyKey: 'promotion-replay-0001' });
    expect(replay).toEqual({ acquired: false, record: value });

    const aliasValue = record('replay', matter, {
      requestFingerprint: value.requestFingerprintSha256,
      candidateIdempotencyKey: 'candidate-replay-alias-0002'
    });
    const alias = await repo.claim({
      record: aliasValue,
      idempotencyKey: 'promotion-replay-alias-0002'
    });
    expect(alias.acquired).toBe(false);
    expect(alias.record).toEqual(value);

    const counts = await database
      .getPool()
      .query(
        'SELECT (SELECT count(*) FROM markreg_knowledge_case_promotions) promotions, (SELECT count(*) FROM markreg_knowledge_case_promotion_commands) commands'
      );
    expect(counts.rows[0]).toEqual({ promotions: '1', commands: '2' });
  });

  it('fails closed for conflicting key reuse and conflicting semantics for one source', async () => {
    const matter = await insertMatter('conflict');
    const value = record('conflict', matter);
    const repo = repository();
    await repo.claim({ record: value, idempotencyKey: 'promotion-conflict-0001' });

    const conflicting = record('conflict', matter, {
      requestFingerprint: sha256('different-semantics')
    });
    await expect(
      repo.claim({ record: conflicting, idempotencyKey: 'promotion-conflict-0001' })
    ).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT'
    } satisfies Partial<KnowledgeCasePromotionError>);
    await expect(
      repo.claim({ record: conflicting, idempotencyKey: 'promotion-conflict-0002' })
    ).rejects.toMatchObject({
      code: 'SOURCE_PROMOTION_CONFLICT'
    } satisfies Partial<KnowledgeCasePromotionError>);
  });

  it('survives a fresh database client and preserves dispatch plus reconciliation state', async () => {
    const matter = await insertMatter('restart');
    const value = record('restart', matter);
    const repo = repository();
    await repo.claim({ record: value, idempotencyKey: 'promotion-restart-0001' });
    const dispatching = await repo.markDispatching(value.producerPromotionRef, dispatchedAt);
    expect(dispatching).toMatchObject({ state: 'DISPATCHING', dispatchedAt });

    const restarted = new ManagedDatabase({
      connection: { url: url! },
      applicationName: 'markreg-knowledge-case-promotion-restart',
      poolMaximum: 2,
      connectionTimeoutMs: 2000,
      idleTimeoutMs: 2000,
      statementTimeoutMs: 5000,
      sslMode: 'disable',
      migrationNamespace: MARKREG_TEST_MIGRATION_NAMESPACE
    });
    await restarted.start();
    try {
      const restartedRepo = new PostgresKnowledgeCasePromotionRepository(
        restarted,
        restarted.getPool()
      );
      const reloaded = await restartedRepo.claim({
        record: value,
        idempotencyKey: 'promotion-restart-0001'
      });
      expect(reloaded).toMatchObject({
        acquired: false,
        record: { state: 'DISPATCHING', dispatchedAt }
      });
      const reconciled = await restartedRepo.markReconciliationRequired(
        value.producerPromotionRef,
        'Downstream delivery outcome is uncertain.',
        reconciledAt
      );
      expect(reconciled).toMatchObject({
        state: 'RECONCILIATION_REQUIRED',
        dispatchedAt,
        reconciliationReason: 'Downstream delivery outcome is uncertain.',
        updatedAt: reconciledAt
      });
    } finally {
      await restarted.close();
    }

    const secondRestart = repository();
    const durable = await secondRestart.claim({
      record: value,
      idempotencyKey: 'promotion-restart-alias-0002'
    });
    expect(durable).toMatchObject({
      acquired: false,
      record: {
        state: 'RECONCILIATION_REQUIRED',
        reconciliationReason: 'Downstream delivery outcome is uncertain.'
      }
    });
  });

  it('coalesces concurrent same-source aliases into one durable promotion', async () => {
    const matter = await insertMatter('concurrent');
    const value = record('concurrent', matter);
    const aliasValue = record('concurrent', matter, {
      requestFingerprint: value.requestFingerprintSha256,
      candidateIdempotencyKey: 'candidate-concurrent-alias-0002'
    });
    const firstRepo = repository();
    const secondRepo = repository();
    const results = await Promise.all([
      firstRepo.claim({ record: value, idempotencyKey: 'promotion-concurrent-0001' }),
      secondRepo.claim({ record: aliasValue, idempotencyKey: 'promotion-concurrent-0002' })
    ]);
    expect(results.filter((result) => result.acquired)).toHaveLength(1);
    expect(new Set(results.map((result) => result.record.producerPromotionRef)).size).toBe(1);

    const counts = await database
      .getPool()
      .query(
        'SELECT (SELECT count(*) FROM markreg_knowledge_case_promotions) promotions, (SELECT count(*) FROM markreg_knowledge_case_promotion_commands) commands'
      );
    expect(counts.rows[0]).toEqual({ promotions: '1', commands: '2' });
  });
});
