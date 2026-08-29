import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase } from '@markorbit/persistence';
import { CN_DURATION_BAND_ACCEPTED_DATASET_REF } from '@markorbit/contracts/brain-cn-duration-band-classification';
import {
  MatterIntelligenceError,
  PostgresMatterIntelligenceRepository,
  type MarkRegMatterIntelligenceObservationV1
} from '../src/matter-intelligence.js';
import {
  MARKREG_TEST_MIGRATION_NAMESPACE,
  resetAndMigrateMarkRegTestDatabase
} from './support/markreg-test-database.js';

const url =
  process.env.MARKREG_MATTER_INTELLIGENCE_TEST_DATABASE_URL ??
  process.env.MARKREG_TEST_DATABASE_URL;
const required = process.env.MARKREG_MATTER_INTELLIGENCE_POSTGRES_REQUIRED === '1';
if (required && !url) {
  throw new Error(
    'MARKREG_MATTER_INTELLIGENCE_TEST_DATABASE_URL or MARKREG_TEST_DATABASE_URL is required when MARKREG_MATTER_INTELLIGENCE_POSTGRES_REQUIRED=1.'
  );
}
const suite = url ? describe : describe.skip;
const workspaceId = '33333333-3333-4333-8333-333333333333';
const formalMatterId = 'formal-matter_phase5-postgres';
const evidenceRefs = [
  'brain-method-package:package_cn-duration@1',
  'brain-method:method_cn-duration',
  'brain-method-version:method-version_cn-duration',
  'brain-method-evaluation:evaluation_cn-duration',
  `research-dataset:${CN_DURATION_BAND_ACCEPTED_DATASET_REF}:accepted`
];

function observation(
  suffix: string,
  days = 336
): MarkRegMatterIntelligenceObservationV1 {
  return {
    schemaVersion: 1,
    matterIntelligenceObservationId: `matter-intelligence-observation_${suffix}`,
    workspaceId,
    formalMatter: {
      id: formalMatterId,
      version: 1,
      snapshotSha256: 'a'.repeat(64)
    },
    observationKind: 'CN_COMPLETED_DURATION_HISTORICAL_BAND',
    observedCompletedDurationDays: days,
    historicalBand: days <= 335 ? 'LOWER_QUARTILE_OR_BELOW' : 'LOWER_INTERQUARTILE',
    datasetRefId: CN_DURATION_BAND_ACCEPTED_DATASET_REF,
    capability: {
      id: 'interpretation.cn-completed-duration-historical-band',
      version: '1.0.0',
      inputSchemaId: 'brain-input.cn-completed-duration-historical-band.v1',
      outputSchemaId: 'brain.cn-completed-duration-historical-band.v1'
    },
    capabilityRequestId: `capreq_${suffix}`,
    capabilityInvocationId: `capability-invocation_${suffix}`,
    capabilityOutcomeId: `capability-outcome_${suffix}`,
    capabilityReturnId: `capability-return_${suffix}`,
    sessionReceiptId: `session-receipt_${suffix}`,
    implementation: {
      id: 'implementation-profile_cn-duration-band-classification-v1',
      version: 1,
      implementationKey: 'brain-method-package-runtime.cn-duration-band-classification.v1'
    },
    correlationId: `correlation-${suffix}`,
    methodPackageRef: evidenceRefs[0]!,
    methodRef: evidenceRefs[1]!,
    methodVersionRef: evidenceRefs[2]!,
    evaluationRef: evidenceRefs[3]!,
    researchDatasetRef: evidenceRefs[4]!,
    evidenceRefs,
    evidenceFingerprintSha256: 'b'.repeat(64),
    inputFingerprintSha256: suffix === 'two' ? 'e'.repeat(64) : 'c'.repeat(64),
    outputFingerprintSha256: suffix === 'two' ? 'f'.repeat(64) : 'd'.repeat(64),
    recordedByPrincipalId: 'user_phase5-postgres',
    recordedAt: suffix === 'two' ? '2026-08-30T00:04:00.000Z' : '2026-08-30T00:03:00.000Z'
  };
}

suite('PostgreSQL MarkReg Matter Intelligence persistence', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'markreg-matter-intelligence-test',
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

  beforeEach(async () => {
    const pool = database.getPool();
    await pool.query(
      'TRUNCATE markreg_matter_intelligence_commands,markreg_matter_intelligence_observations,formal_matters CASCADE'
    );
    await pool.query(
      `INSERT INTO formal_matters (
        formal_matter_id,workspace_id,kind,status,version,
        source_customer_confirmation_id,source_customer_confirmation_version,
        source_matter_draft_id,source_matter_draft_version,
        source_quote_id,source_quote_version,source_snapshot,snapshot_schema_version,
        snapshot_sha256,created_by_user_id,created_at,updated_at
      ) VALUES ($1,$2,'TRADEMARK_REGISTRATION','OPEN',1,$3,1,$4,1,$5,$6,$7::jsonb,1,$8,$9,$10,$10)`,
      [
        formalMatterId,
        workspaceId,
        'confirmation_phase5-postgres',
        'matter-draft_phase5-postgres',
        'quote_phase5-postgres',
        'quote-v1',
        JSON.stringify({ schemaVersion: 1, source: 'phase5-postgres-test' }),
        'a'.repeat(64),
        'user_phase5-postgres',
        '2026-08-30T00:00:00.000Z'
      ]
    );
  });

  afterAll(() => database.close());

  function repository() {
    return new PostgresMatterIntelligenceRepository(database, database.getPool());
  }

  it('persists one immutable observation with exact replay and rejects conflicting idempotency reuse', async () => {
    const store = repository();
    const firstObservation = observation('one');
    const first = await store.record({
      observation: firstObservation,
      idempotencyKey: 'phase5-key-one',
      requestFingerprintSha256: '1'.repeat(64),
      correlationId: firstObservation.correlationId,
      capabilityReplayed: false
    });
    expect(first).toMatchObject({ replayed: false, semanticDuplicate: false });

    const replay = await store.findCommandReplay(workspaceId, 'phase5-key-one');
    expect(replay?.result.observation).toEqual(first.observation);
    expect(replay?.requestFingerprintSha256).toBe('1'.repeat(64));

    const exactReplay = await store.record({
      observation: { ...observation('other'), matterIntelligenceObservationId: 'matter-intelligence-observation_other' },
      idempotencyKey: 'phase5-key-one',
      requestFingerprintSha256: '1'.repeat(64),
      correlationId: 'correlation-other',
      capabilityReplayed: true
    });
    expect(exactReplay).toEqual(first);

    await expect(
      store.record({
        observation: observation('conflict'),
        idempotencyKey: 'phase5-key-one',
        requestFingerprintSha256: '2'.repeat(64),
        correlationId: 'correlation-conflict',
        capabilityReplayed: false
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' } satisfies Partial<MatterIntelligenceError>);

    const counts = await database.getPool().query(
      'SELECT (SELECT count(*)::int FROM markreg_matter_intelligence_observations) AS observations,(SELECT count(*)::int FROM markreg_matter_intelligence_commands) AS commands'
    );
    expect(counts.rows[0]).toMatchObject({ observations: 1, commands: 1 });
  });

  it('semantically dedupes an exact Capability return/session across product keys and appends a changed execution', async () => {
    const store = repository();
    const firstObservation = observation('one');
    const first = await store.record({
      observation: firstObservation,
      idempotencyKey: 'phase5-key-one',
      requestFingerprintSha256: '1'.repeat(64),
      correlationId: firstObservation.correlationId,
      capabilityReplayed: false
    });

    const duplicateObservation = {
      ...observation('duplicate'),
      capabilityReturnId: firstObservation.capabilityReturnId,
      sessionReceiptId: firstObservation.sessionReceiptId
    };
    const duplicate = await store.record({
      observation: duplicateObservation,
      idempotencyKey: 'phase5-key-two',
      requestFingerprintSha256: '2'.repeat(64),
      correlationId: duplicateObservation.correlationId,
      capabilityReplayed: true
    });
    expect(duplicate.semanticDuplicate).toBe(true);
    expect(duplicate.observation).toEqual(first.observation);

    const changed = observation('two', 337);
    const appended = await store.record({
      observation: changed,
      idempotencyKey: 'phase5-key-three',
      requestFingerprintSha256: '3'.repeat(64),
      correlationId: changed.correlationId,
      capabilityReplayed: false
    });
    expect(appended.semanticDuplicate).toBe(false);
    expect(appended.observation.matterIntelligenceObservationId).toBe(
      'matter-intelligence-observation_two'
    );

    const counts = await database.getPool().query(
      'SELECT (SELECT count(*)::int FROM markreg_matter_intelligence_observations) AS observations,(SELECT count(*)::int FROM markreg_matter_intelligence_commands) AS commands'
    );
    expect(counts.rows[0]).toMatchObject({ observations: 2, commands: 3 });
  });

  it('keeps observation/command evidence append-only and does not mutate Matter or neighboring business-state tables', async () => {
    const store = repository();
    const value = observation('one');
    await store.record({
      observation: value,
      idempotencyKey: 'phase5-key-one',
      requestFingerprintSha256: '1'.repeat(64),
      correlationId: value.correlationId,
      capabilityReplayed: false
    });

    await expect(
      database
        .getPool()
        .query(
          'UPDATE markreg_matter_intelligence_observations SET observed_completed_duration_days=1 WHERE matter_intelligence_observation_id=$1',
          [value.matterIntelligenceObservationId]
        )
    ).rejects.toThrow(/append-only/i);
    await expect(
      database
        .getPool()
        .query('DELETE FROM markreg_matter_intelligence_commands WHERE workspace_id=$1', [workspaceId])
    ).rejects.toThrow(/append-only/i);

    const matterState = await database.getPool().query(
      'SELECT status,version,snapshot_sha256 FROM formal_matters WHERE formal_matter_id=$1',
      [formalMatterId]
    );
    expect(matterState.rows[0]).toMatchObject({
      status: 'OPEN',
      version: 1,
      snapshot_sha256: 'a'.repeat(64)
    });
    const neighbors = await database.getPool().query(
      'SELECT (SELECT count(*)::int FROM markreg_recommended_actions) AS recommended_actions,(SELECT count(*)::int FROM markreg_formal_trademark_service_opportunities) AS formal_opportunities'
    );
    expect(neighbors.rows[0]).toMatchObject({ recommended_actions: 0, formal_opportunities: 0 });
  });
});
