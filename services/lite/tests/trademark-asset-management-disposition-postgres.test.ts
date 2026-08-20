import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import { PostgresTrademarkAssetManagementDispositionStore } from '../src/trademark-asset-management-disposition.js';
import { PostgresLiteTrademarkAssetStore } from '../src/trademark-asset.js';

const url = process.env.LITE_TRADEMARK_ASSET_TEST_DATABASE_URL;
const required = process.env.LITE_TRADEMARK_ASSET_POSTGRES_TEST_REQUIRED === '1';
if (required && !url) {
  throw new Error(
    'LITE_TRADEMARK_ASSET_TEST_DATABASE_URL is required when LITE_TRADEMARK_ASSET_POSTGRES_TEST_REQUIRED=1.'
  );
}
const suite = url ? describe : describe.skip;
const workspaceId = '96969696-9696-4969-8969-969696969696';
const otherWorkspaceId = '97979797-9797-4979-8979-979797979797';
const admissionSource = {
  owner: 'WORKSPACE_USER',
  kind: 'WORKSPACE_ADMISSION',
  sourceId: 'admission_m11-wp07',
  sourceVersion: '1',
  observedAt: '2026-08-21T01:00:00.000Z',
  freshness: 'CURRENT'
} as const;

suite('PostgreSQL M11-WP07 Trademark Asset management disposition recovery', () => {
  let clock = 0;
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-trademark-asset-management-disposition-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_trademark_asset_management_disposition_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  const now = () => new Date(Date.UTC(2026, 7, 21, 1, 0, clock++)).toISOString();
  const assets = () => new PostgresLiteTrademarkAssetStore(database, database.getPool(), now);
  const dispositions = () =>
    new PostgresTrademarkAssetManagementDispositionStore(database, database.getPool(), now);

  beforeAll(async () => {
    await database.start();
    await database
      .getPool()
      .query(
        'CREATE TABLE IF NOT EXISTS workspaces (workspace_id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE)'
      );
    const liteMigrations = await loadMigrationsForOwner(
      migrationsDirectory,
      migrationOwners,
      '@markorbit/lite-service'
    );
    await migrate(
      database.getPool(),
      'lite_trademark_asset_management_disposition_test',
      liteMigrations
    );
    await database.getPool().query(
      `INSERT INTO workspaces (workspace_id,name,slug) VALUES
       ($1,'Disposition Test','disposition-test'),
       ($2,'Disposition Other','disposition-other')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceId, otherWorkspaceId]
    );
  });

  beforeEach(async () => {
    clock = 0;
    await database.getPool().query(
      `TRUNCATE
        lite_trademark_asset_management_recovery_jobs,
        lite_trademark_asset_management_disposition_commands,
        lite_trademark_asset_management_dispositions,
        lite_trademark_asset_commands,
        lite_trademark_asset_identifiers,
        lite_trademark_assets
       CASCADE`
    );
  });

  afterAll(() => database.close());

  async function admitAsset() {
    return assets().admit({
      workspaceId,
      identity: { jurisdiction: 'US', markText: 'MARKORBIT' },
      workspaceRelationships: [{ kind: 'MANAGED', sourceAssetEditableByWorkspace: false }],
      sourceReferences: [admissionSource],
      idempotencyKey: 'm11-wp07-admit'
    });
  }

  it('persists private dispositions idempotently and exposes only current watch/defer state', async () => {
    const asset = await admitAsset();
    const signal = 'trademark-asset-management-signal_watch-1' as const;
    const first = await dispositions().record({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      managementSignalId: signal,
      kind: 'WATCHED',
      subjectUserId: 'user_m11-wp07',
      note: 'Watch this source-owned change.',
      idempotencyKey: 'watch-1'
    });
    const replay = await dispositions().record({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      managementSignalId: signal,
      kind: 'WATCHED',
      subjectUserId: 'user_m11-wp07',
      note: 'Watch this source-owned change.',
      idempotencyKey: 'watch-1'
    });
    expect(replay).toEqual(first);
    expect(first).toMatchObject({
      officialTruthCreated: false,
      legalConclusionVerified: false,
      capabilityVerified: false
    });
    expect(await dispositions().listWatchState(workspaceId)).toEqual([first]);

    await dispositions().record({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      managementSignalId: signal,
      kind: 'CONTINUED',
      subjectUserId: 'user_m11-wp07',
      idempotencyKey: 'watch-continued'
    });
    expect(await dispositions().listWatchState(workspaceId)).toEqual([]);
  });

  it('rejects idempotency key reuse for a different disposition', async () => {
    const asset = await admitAsset();
    const base = {
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      managementSignalId: 'trademark-asset-management-signal_conflict' as const,
      kind: 'WATCHED' as const,
      subjectUserId: 'user_m11-wp07',
      idempotencyKey: 'same-key'
    };
    await dispositions().record(base);
    await expect(
      dispositions().record({ ...base, kind: 'DISMISSED' })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('keeps workspace boundaries when a direct Asset ID is guessed', async () => {
    const asset = await admitAsset();
    await expect(
      dispositions().record({
        workspaceId: otherWorkspaceId,
        trademarkAssetId: asset.trademarkAssetId,
        managementSignalId: 'trademark-asset-management-signal_cross-workspace',
        kind: 'WATCHED',
        subjectUserId: 'user_other',
        idempotencyKey: 'cross-workspace'
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('leases internal recovery work, retries with backoff, then dead-letters and replays explicitly', async () => {
    const asset = await admitAsset();
    await dispositions().record({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      managementSignalId: 'trademark-asset-management-signal_recovery',
      kind: 'DEFERRED',
      subjectUserId: 'user_m11-wp07',
      idempotencyKey: 'recovery-disposition'
    });

    const store = dispositions();
    let leased = await store.leaseRecoveryJobs(10, 60);
    expect(leased).toHaveLength(2);
    expect(leased.every((job) => job.protectedActionAuthorized === false)).toBe(true);

    let target = leased[0]!;
    for (let failure = 0; failure < 5; failure += 1) {
      const failed = await store.failRecoveryJob(
        workspaceId,
        target.recoveryJobId,
        `internal projection failure ${failure + 1}`
      );
      if (failed.status === 'DEAD_LETTER') {
        target = failed;
        break;
      }
      await database.getPool().query(
        `UPDATE lite_trademark_asset_management_recovery_jobs
            SET available_at='2026-08-21T00:00:00.000Z'
          WHERE workspace_id=$1 AND recovery_job_id=$2`,
        [workspaceId, target.recoveryJobId]
      );
      leased = await store.leaseRecoveryJobs(10, 60);
      target = leased.find((job) => job.recoveryJobId === target.recoveryJobId)!;
    }

    expect(target.status).toBe('DEAD_LETTER');
    const deadLetters = await store.listDeadLetters(workspaceId);
    expect(deadLetters.map((job) => job.recoveryJobId)).toContain(target.recoveryJobId);

    const replayed = await store.replayDeadLetter(workspaceId, target.recoveryJobId);
    expect(replayed).toMatchObject({ status: 'PENDING', attemptCount: 0 });
  });
});
