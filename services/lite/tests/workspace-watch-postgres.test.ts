import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import {
  DATA_ENGINE_FACT_AUTHORITY,
  DATA_ENGINE_SOURCE_OWNER
} from '@markorbit/contracts/data-engine';
import { PostgresWorkspaceWatchStore } from '../src/workspace-watch.js';

const url = process.env.LITE_WORKSPACE_WATCH_TEST_DATABASE_URL;
const required = process.env.LITE_WORKSPACE_WATCH_POSTGRES_TEST_REQUIRED === '1';
if (required && !url) throw new Error('LITE_WORKSPACE_WATCH_TEST_DATABASE_URL is required.');
const suite = url ? describe : describe.skip;
const workspaceId = '41414141-4141-4414-8414-414141414141';
const otherWorkspaceId = '51515151-5151-4515-8515-515151515151';

function applicant(id = 'applicant-watch-1') {
  return {
    applicant_candidate_id: id,
    source_reference: {
      owner: DATA_ENGINE_SOURCE_OWNER,
      authority: DATA_ENGINE_FACT_AUTHORITY,
      jurisdiction: 'CN' as const,
      source_kind: 'APPLICANT_IDENTITY' as const,
      source_id: `source-${id}`,
      source_version: 'M1.9-watch',
      source_fingerprint_sha256: `sha256:${'a'.repeat(64)}`,
      observed_at: '2026-09-10T09:00:00.000Z'
    }
  };
}
const applicantTarget = () => ({ targetKind: 'APPLICANT' as const, applicant: applicant() });
const trademarkTarget = () => ({
  targetKind: 'TRADEMARK' as const,
  trademarkCandidateId: 'trademark-watch-1',
  applicant: applicant(),
  sourceReference: {
    owner: DATA_ENGINE_SOURCE_OWNER,
    authority: DATA_ENGINE_FACT_AUTHORITY,
    jurisdiction: 'CN' as const,
    source_kind: 'TRADEMARK_RECORD' as const,
    source_id: 'trademark-source-watch-1',
    source_version: 'M1.9-watch',
    source_fingerprint_sha256: `sha256:${'b'.repeat(64)}`,
    observed_at: '2026-09-10T09:10:00.000Z'
  }
});

suite('PostgreSQL Workspace Watch owner runtime', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'workspace-watch-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_workspace_watch_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  let tick = 0;
  let id = 0;
  const now = () => new Date(Date.UTC(2026, 8, 10, 10, 0, tick++)).toISOString();
  const ids = () => `workspace-watch-target_test-${++id}` as `workspace-watch-target_${string}`;
  const store = () => new PostgresWorkspaceWatchStore(database, database.getPool(), now, ids);
  const create = (
    key: string,
    overrides: Partial<{
      workspaceId: string;
      reason: string;
      purpose: 'CLIENT_MONITORING' | 'COMPETITIVE';
      trademark: boolean;
    }> = {}
  ) => ({
    workspaceId: overrides.workspaceId ?? workspaceId,
    actorPrincipalId: 'user_watch_owner',
    idempotencyKey: key,
    target: overrides.trademark ? trademarkTarget() : applicantTarget(),
    purpose: overrides.purpose ?? ('CLIENT_MONITORING' as const),
    reason: overrides.reason ?? 'Monitor selected applicant'
  });

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
    await migrate(database.getPool(), 'lite_workspace_watch_test', migrations);
    await database.getPool().query(
      `INSERT INTO workspaces(workspace_id,name,slug) VALUES
      ($1,'Watch A','watch-a'),($2,'Watch B','watch-b') ON CONFLICT(workspace_id) DO NOTHING`,
      [workspaceId, otherWorkspaceId]
    );
  }, 30000);
  beforeEach(async () => {
    tick = 0;
    id = 0;
    await database
      .getPool()
      .query(
        'TRUNCATE lite_workspace_watch_commands,lite_workspace_watch_heads,lite_workspace_watch_versions CASCADE'
      );
  });
  afterAll(async () => {
    await database.close();
  });

  it('persists create/replay/conflict with Workspace isolation and safe authority', async () => {
    const first = store();
    const command = create('create-1');
    const created = await first.create(command);
    expect(await store().create(command)).toEqual(created);
    expect(created).toMatchObject({
      version: 1,
      status: 'ACTIVE',
      workspaceId,
      createdByPrincipalId: 'user_watch_owner'
    });
    expect(created.authorityConsequences.trademarkAssetCreated).toBe(false);
    expect(created.authorityConsequences.managedRelationshipEstablished).toBe(false);
    expect(created.authorityConsequences.officialTruthCreated).toBe(false);
    await expect(
      first.create(create('create-1', { reason: 'Changed intent' }))
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    const other = await first.create(create('create-1', { workspaceId: otherWorkspaceId }));
    expect(other.workspaceId).toBe(otherWorkspaceId);
    expect(await first.getLatest(workspaceId, other.workspaceWatchTargetId)).toBeUndefined();
    expect(await first.getLatest(otherWorkspaceId, other.workspaceWatchTargetId)).toEqual(other);
  });

  it('keeps exact history and rejects stale or repeated archive while allowing later re-watch', async () => {
    const service = store();
    const active = await service.create(create('archive-create'));
    const archived = await service.archive({
      workspaceId,
      workspaceWatchTargetId: active.workspaceWatchTargetId,
      expectedVersion: 1,
      idempotencyKey: 'archive-1'
    });
    expect(archived).toMatchObject({ version: 2, status: 'ARCHIVED' });
    expect(
      await store().archive({
        workspaceId,
        workspaceWatchTargetId: active.workspaceWatchTargetId,
        expectedVersion: 1,
        idempotencyKey: 'archive-1'
      })
    ).toEqual(archived);
    expect(await service.getExact(workspaceId, active.workspaceWatchTargetId, 1)).toEqual(active);
    expect(await service.getLatest(workspaceId, active.workspaceWatchTargetId)).toEqual(archived);
    await expect(
      service.archive({
        workspaceId,
        workspaceWatchTargetId: active.workspaceWatchTargetId,
        expectedVersion: 1,
        idempotencyKey: 'archive-stale'
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    await expect(
      service.archive({
        workspaceId,
        workspaceWatchTargetId: active.workspaceWatchTargetId,
        expectedVersion: 2,
        idempotencyKey: 'archive-again'
      })
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    const rewached = await service.create(create('rewatch'));
    expect(rewached.status).toBe('ACTIVE');
    expect(rewached.workspaceWatchTargetId).not.toBe(active.workspaceWatchTargetId);
  });

  it('prevents concurrent duplicate ACTIVE intent and rejects materially different details', async () => {
    const [left, right] = await Promise.all([
      store().create(create('parallel-a')),
      store().create(create('parallel-b'))
    ]);
    expect(right).toEqual(left);
    expect(await store().listLatest(workspaceId, { status: 'ACTIVE' })).toHaveLength(1);
    await expect(
      store().create(create('parallel-c', { reason: 'Different monitoring reason' }))
    ).rejects.toMatchObject({ code: 'ACTIVE_INTENT_CONFLICT' });
    const trademark = await store().create(
      create('parallel-trademark', { trademark: true, purpose: 'COMPETITIVE' })
    );
    expect(trademark.target.targetKind).toBe('TRADEMARK');
    expect(
      await store().listLatest(workspaceId, { targetKind: 'TRADEMARK', purpose: 'COMPETITIVE' })
    ).toEqual([trademark]);
  });

  it('fails closed on malformed Data Engine refs without creating durable Watch state', async () => {
    const malformed = structuredClone(applicantTarget()) as Record<string, unknown>;
    delete (
      (malformed.applicant as Record<string, unknown>).source_reference as Record<string, unknown>
    ).source_fingerprint_sha256;
    await expect(
      store().create({ ...create('malformed'), target: malformed as never })
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    const counts = await database
      .getPool()
      .query<{ versions: string; heads: string; commands: string }>(
        `SELECT (SELECT count(*) FROM lite_workspace_watch_versions)::text AS versions,
              (SELECT count(*) FROM lite_workspace_watch_heads)::text AS heads,
              (SELECT count(*) FROM lite_workspace_watch_commands)::text AS commands`
      );
    expect(counts.rows[0]).toEqual({ versions: '0', heads: '0', commands: '0' });
  });

  it('fails closed when persisted document/head integrity drifts', async () => {
    const service = store();
    const created = await service.create(create('corrupt-create'));
    await database.getPool().query(
      `UPDATE lite_workspace_watch_versions SET purpose='COMPETITIVE'
        WHERE workspace_id=$1 AND workspace_watch_target_id=$2 AND version=1`,
      [workspaceId, created.workspaceWatchTargetId]
    );
    await expect(
      service.getExact(workspaceId, created.workspaceWatchTargetId, 1)
    ).rejects.toMatchObject({ code: 'INTEGRITY_FAILURE' });
  });
});
