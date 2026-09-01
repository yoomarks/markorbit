import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BrainGap, BrainSelfAuditResult } from '@markorbit/contracts/brain-gap';
import {
  loadMigrationsForOwner,
  ManagedDatabase,
  migrate,
  parseDatabaseConfig
} from '@markorbit/persistence';
import { brainGapIdentityFingerprint } from '../src/brain-gap-registry.js';
import { PostgresBrainGapRegistry } from '../src/brain-gap-registry-postgres.js';

const url = process.env.BRAIN_GAP_REGISTRY_TEST_DATABASE_URL;
const required = process.env.BRAIN_GAP_REGISTRY_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'BRAIN_GAP_REGISTRY_POSTGRES_TEST_REQUIRED=1 requires BRAIN_GAP_REGISTRY_TEST_DATABASE_URL.'
  );
const integration = url ? describe : describe.skip;
const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
const coreMigrations = () =>
  loadMigrationsForOwner(migrationsDirectory, migrationOwners, '@markorbit/core-service');
const config = () =>
  parseDatabaseConfig({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DB_MIGRATION_NAMESPACE: 'core_brain_gap_registry',
    DB_APPLICATION_NAME: 'markorbit-brain-gap-tests'
  });

let database: ManagedDatabase;

function gap(
  detectedAt = '2026-09-02T00:00:00.000Z',
  overrides: Partial<BrainGap> = {}
): BrainGap {
  const base: BrainGap = {
    schemaVersion: 1,
    brainGapId: `brain-gap_${'0'.repeat(64)}`,
    fingerprintSha256: '0'.repeat(64),
    gapType: 'LOW_CONFIDENCE',
    severity: 'HIGH',
    businessImpact: 'MEDIUM',
    status: 'OPEN',
    detectionSource: 'BUILD_RUN',
    scope: {
      domain: 'TRADEMARK',
      jurisdiction: 'US',
      concept: 'brain.gap.postgres.test'
    },
    targetModule: 'BRAIN_BUILD',
    reasonCode: 'VALIDATION_BELOW_THRESHOLD',
    explanation: 'Validation evidence is below the governed threshold.',
    remediationHint: 'Collect materially stronger validation evidence.',
    evidenceRefs: [],
    relatedBrainBuildRunId: 'brain-build-run_pg-gap-test',
    detectedAt,
    ...overrides
  };
  const fingerprintSha256 = brainGapIdentityFingerprint(base);
  return {
    ...base,
    fingerprintSha256,
    brainGapId: `brain-gap_${fingerprintSha256}`
  };
}

function audit(
  gaps: readonly BrainGap[],
  auditedAt = '2026-09-02T00:05:00.000Z'
): BrainSelfAuditResult {
  return { schemaVersion: 1, gaps, auditedAt };
}

async function reopen(): Promise<PostgresBrainGapRegistry> {
  await database.close();
  database = new ManagedDatabase(config());
  await database.start();
  return new PostgresBrainGapRegistry(database);
}

async function cleanup(): Promise<void> {
  await database
    .getPool()
    .query(
      'TRUNCATE brain_gap_audit_occurrence_memberships,brain_gap_dispositions,brain_gap_occurrences,brain_gap_audit_admissions RESTART IDENTITY CASCADE'
    );
}

integration('PostgreSQL BrainGap Registry durability', () => {
  beforeAll(async () => {
    database = new ManagedDatabase(config());
    await database.start();
    await database.getPool().query(
      `DROP TABLE IF EXISTS brain_gap_audit_occurrence_memberships,brain_gap_dispositions,
        brain_gap_occurrences,brain_gap_audit_admissions CASCADE;
       DROP SCHEMA IF EXISTS markorbit_persistence CASCADE`
    );
    await migrate(database.getPool(), 'core_brain_gap_registry', await coreMigrations());
  });

  afterAll(async () => database.close());

  it('replays the exact audit after restart without duplicating occurrence or membership', async () => {
    await cleanup();
    const value = audit([gap()]);
    const firstRegistry = new PostgresBrainGapRegistry(database);
    const first = await firstRegistry.admitAudit(value);

    const restarted = await reopen();
    const replay = await restarted.admitAudit(value);

    expect(replay).toEqual(first);
    expect((await restarted.query())[0]?.occurrenceCount).toBe(1);
    expect((await database.getPool().query('SELECT 1 FROM brain_gap_occurrences')).rowCount).toBe(
      1
    );
    expect(
      (await database.getPool().query('SELECT 1 FROM brain_gap_audit_occurrence_memberships'))
        .rowCount
    ).toBe(1);
  });

  it('preserves a second audit membership for the same exact occurrence without incrementing count', async () => {
    await cleanup();
    const exactGap = gap();
    const registry = new PostgresBrainGapRegistry(database);
    await registry.admitAudit(audit([exactGap], '2026-09-02T00:05:00.000Z'));
    await registry.admitAudit(audit([exactGap], '2026-09-02T00:06:00.000Z'));

    expect((await registry.query())[0]?.occurrenceCount).toBe(1);
    expect((await database.getPool().query('SELECT 1 FROM brain_gap_occurrences')).rowCount).toBe(
      1
    );
    expect(
      (await database.getPool().query('SELECT 1 FROM brain_gap_audit_occurrence_memberships'))
        .rowCount
    ).toBe(2);
  });

  it('fails closed when the same audit admission identity is reused with a different payload', async () => {
    await cleanup();
    const registry = new PostgresBrainGapRegistry(database);
    const original = audit([gap()]);
    await registry.admitAudit(original);
    const conflicting = audit([gap('2026-09-02T00:00:00.000Z', { severity: 'CRITICAL' })]);

    await expect(registry.admitAudit(conflicting)).rejects.toMatchObject({
      code: 'IDENTITY_CONFLICT'
    });
    expect((await database.getPool().query('SELECT 1 FROM brain_gap_audit_admissions')).rowCount).toBe(
      1
    );
  });

  it('persists manual resolution and deterministic recurrence reopening across restart', async () => {
    await cleanup();
    const registry = new PostgresBrainGapRegistry(database);
    const first = (await registry.admitAudit(audit([gap()])))[0]!;
    await registry.transition({
      brainGapRegistryKey: first.brainGapRegistryKey,
      toStatus: 'RESOLVED',
      occurredAt: '2026-09-02T01:00:00.000Z',
      reason: 'The observed evidence gap was remediated.'
    });

    const restarted = await reopen();
    const resolved = await restarted.get(first.brainGapRegistryKey);
    expect(resolved?.status).toBe('RESOLVED');

    const recurrence = gap('2026-09-02T02:00:00.000Z', {
      explanation: 'The same governed gap was objectively observed again.'
    });
    await restarted.admitAudit(audit([recurrence], '2026-09-02T02:05:00.000Z'));
    const reopened = await restarted.get(first.brainGapRegistryKey);

    expect(reopened?.status).toBe('OPEN');
    expect(reopened?.occurrenceCount).toBe(2);
    expect(reopened?.latestDisposition).toMatchObject({
      status: 'OPEN',
      source: 'RECURRENCE',
      occurredAt: '2026-09-02T02:00:00.000Z'
    });
  });

  it('propagates database failure instead of returning empty healthy state', async () => {
    await cleanup();
    const registry = new PostgresBrainGapRegistry(database);
    await database.close();
    await expect(registry.query()).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE'
    });
    database = new ManagedDatabase(config());
    await database.start();
  });
});
