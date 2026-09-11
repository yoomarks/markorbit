import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import { PostgresTrademarkAssetRefreshLedger } from '../src/trademark-asset-refresh.js';
import { PostgresLiteTrademarkAssetStore } from '../src/trademark-asset.js';

const url = process.env.LITE_TRADEMARK_ASSET_TEST_DATABASE_URL;
const required = process.env.LITE_TRADEMARK_ASSET_POSTGRES_TEST_REQUIRED === '1';
if (required && !url) {
  throw new Error(
    'LITE_TRADEMARK_ASSET_TEST_DATABASE_URL is required when LITE_TRADEMARK_ASSET_POSTGRES_TEST_REQUIRED=1.'
  );
}
const suite = url ? describe : describe.skip;
const workspaceId = '94949494-9494-4949-8949-949494949494';
const otherWorkspaceId = '95959595-9595-4959-8959-959595959595';
const admissionSource = {
  owner: 'WORKSPACE_USER',
  kind: 'WORKSPACE_ADMISSION',
  sourceId: 'admission_m11-wp02',
  sourceVersion: '1',
  observedAt: '2026-08-20T15:00:00.000Z',
  freshness: 'CURRENT'
} as const;

const dataObservation = (version: string, freshness: 'CURRENT' | 'STALE' = 'CURRENT') =>
  ({
    owner: 'DATA_ENGINE',
    kind: 'DATA_ENGINE_TRADEMARK_RECORD',
    sourceId: 'record_m11-wp02',
    sourceVersion: version,
    sourceFingerprintSha256: version === '1' ? 'a'.repeat(64) : 'b'.repeat(64),
    observedAt: '2026-08-20T15:01:00.000Z',
    freshness
  }) as const;

const lifecycleObservation = {
  owner: 'MARKREG',
  kind: 'MARKREG_LIFECYCLE_PROJECTION',
  sourceId: 'lifecycle_m11-wp02',
  sourceVersion: '4',
  sourceFingerprintSha256: 'c'.repeat(64),
  observedAt: '2026-08-20T15:01:30.000Z',
  freshness: 'CURRENT'
} as const;

suite('PostgreSQL M11-WP02 Trademark Asset refresh ledger', () => {
  let clock = 0;
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-trademark-asset-refresh-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_trademark_asset_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  const now = () => new Date(Date.UTC(2026, 7, 20, 15, 5, clock++)).toISOString();
  const assets = () => new PostgresLiteTrademarkAssetStore(database, database.getPool(), now);
  const ledger = () => new PostgresTrademarkAssetRefreshLedger(database, database.getPool(), now);

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
    await migrate(database.getPool(), 'lite_trademark_asset_test', liteMigrations);
    await database.getPool().query(
      `INSERT INTO workspaces (workspace_id,name,slug) VALUES
       ($1,'Trademark Asset Refresh Test','trademark-asset-refresh-test'),
       ($2,'Trademark Asset Refresh Other','trademark-asset-refresh-other')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceId, otherWorkspaceId]
    );
  });

  beforeEach(async () => {
    clock = 0;
    await database.getPool().query(
      `TRUNCATE
        lite_trademark_asset_refresh_changes,
        lite_trademark_asset_refresh_observations,
        lite_trademark_asset_refresh_runs,
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
      idempotencyKey: 'm11-wp02-admit'
    });
  }

  it('records first observations as additions and preserves permanent authority locks', async () => {
    const asset = await admitAsset();
    const result = await ledger().refresh({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      sourceOwnerScope: ['DATA_ENGINE', 'MARKREG'],
      observations: [dataObservation('1'), lifecycleObservation],
      idempotencyKey: 'refresh-1'
    });

    expect(result.changes.map((change) => change.kind)).toEqual([
      'OBSERVATION_ADDED',
      'OBSERVATION_ADDED'
    ]);
    expect(result).toMatchObject({
      officialTruthVerifiedByLite: false,
      legalDeadlineCertified: false,
      conflictResolvedByLite: false,
      executionAuthorized: false
    });

    const afterRestart = await ledger().listRecent(workspaceId, asset.trademarkAssetId);
    expect(afterRestart).toEqual([result]);
  });

  it('does not report a change when only the polling timestamp changes', async () => {
    const asset = await admitAsset();
    await ledger().refresh({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      sourceOwnerScope: ['DATA_ENGINE'],
      observations: [dataObservation('1')],
      idempotencyKey: 'same-1'
    });

    const sameSource = {
      ...dataObservation('1'),
      observedAt: '2026-08-20T16:01:00.000Z'
    } as const;
    const second = await ledger().refresh({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      sourceOwnerScope: ['DATA_ENGINE'],
      observations: [sameSource],
      idempotencyKey: 'same-2'
    });

    expect(second.changes).toEqual([]);
  });

  it('distinguishes substantive source-version change from freshness-only change', async () => {
    const asset = await admitAsset();
    await ledger().refresh({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      sourceOwnerScope: ['DATA_ENGINE'],
      observations: [dataObservation('1')],
      idempotencyKey: 'change-1'
    });

    const versionChanged = await ledger().refresh({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      sourceOwnerScope: ['DATA_ENGINE'],
      observations: [dataObservation('2')],
      idempotencyKey: 'change-2'
    });
    expect(versionChanged.changes).toHaveLength(1);
    expect(versionChanged.changes[0]).toMatchObject({
      kind: 'OBSERVATION_CHANGED',
      previousSourceVersion: '1',
      currentSourceVersion: '2'
    });

    const freshnessChanged = await ledger().refresh({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      sourceOwnerScope: ['DATA_ENGINE'],
      observations: [dataObservation('2', 'STALE')],
      idempotencyKey: 'change-3'
    });
    expect(freshnessChanged.changes).toHaveLength(1);
    expect(freshnessChanged.changes[0]).toMatchObject({
      kind: 'FRESHNESS_CHANGED',
      freshness: 'STALE'
    });
  });

  it('does not invent removals outside the declared refresh scope', async () => {
    const asset = await admitAsset();
    await ledger().refresh({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      sourceOwnerScope: ['DATA_ENGINE', 'MARKREG'],
      observations: [dataObservation('1'), lifecycleObservation],
      idempotencyKey: 'scope-1'
    });

    const partial = await ledger().refresh({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      sourceOwnerScope: ['DATA_ENGINE'],
      observations: [dataObservation('1')],
      idempotencyKey: 'scope-2'
    });
    expect(partial.changes).toEqual([]);

    const full = await ledger().refresh({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      sourceOwnerScope: ['DATA_ENGINE', 'MARKREG'],
      observations: [dataObservation('1')],
      idempotencyKey: 'scope-3'
    });
    expect(full.changes).toHaveLength(1);
    expect(full.changes[0]?.kind).toBe('OBSERVATION_REMOVED');
    expect(full.changes[0]?.sourceReferences[0]?.owner).toBe('MARKREG');
  });

  it('replays the same idempotent refresh and rejects key reuse with different observations', async () => {
    const asset = await admitAsset();
    const command = {
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      sourceOwnerScope: ['DATA_ENGINE'] as const,
      observations: [dataObservation('1')],
      idempotencyKey: 'replay-refresh'
    };
    const first = await ledger().refresh(command);
    const replayed = await ledger().refresh(command);
    expect(replayed).toEqual(first);

    await expect(
      ledger().refresh({ ...command, observations: [dataObservation('2')] })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('does not allow a workspace to refresh another workspace Asset ID', async () => {
    const asset = await admitAsset();
    await expect(
      ledger().refresh({
        workspaceId: otherWorkspaceId,
        trademarkAssetId: asset.trademarkAssetId,
        sourceOwnerScope: ['DATA_ENGINE'],
        observations: [dataObservation('1')],
        idempotencyKey: 'cross-workspace'
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('does not manufacture removal for unavailable reads and resumes from the last complete read', async () => {
    const asset = await admitAsset();
    await ledger().refresh({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      sourceOwnerScope: ['DATA_ENGINE'],
      observations: [dataObservation('1')],
      idempotencyKey: 'availability-observed'
    });

    const unavailable = await ledger().refresh({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      sourceOwnerScope: ['DATA_ENGINE'],
      observations: [],
      sourceReadStates: [{ owner: 'DATA_ENGINE', state: 'UNAVAILABLE' }],
      idempotencyKey: 'availability-unavailable'
    });
    expect(unavailable.changes).toEqual([]);
    expect(unavailable.sourceReadStates).toEqual([{ owner: 'DATA_ENGINE', state: 'UNAVAILABLE' }]);

    const empty = await ledger().refresh({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      sourceOwnerScope: ['DATA_ENGINE'],
      observations: [],
      sourceReadStates: [{ owner: 'DATA_ENGINE', state: 'EMPTY' }],
      idempotencyKey: 'availability-empty'
    });
    expect(empty.changes).toHaveLength(1);
    expect(empty.changes[0]).toMatchObject({ kind: 'OBSERVATION_REMOVED' });
    expect(empty.changes[0]?.sourceReferences[0]?.sourceVersion).toBe('1');
  });

  it('restores reviewed communication and Workspace-confirmed claims after restart', async () => {
    const asset = await admitAsset();
    const communicationSource = {
      owner: 'MANAGED_COMMUNICATION',
      kind: 'MANAGED_COMMUNICATION_MESSAGE',
      sourceId: 'managed-message_pg-1165',
      sourceVersion: '3',
      sourceFingerprintSha256: 'd'.repeat(64),
      observedAt: '2026-09-11T11:00:00.000Z',
      freshness: 'CURRENT'
    } as const;
    await ledger().refresh({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      sourceOwnerScope: ['MANAGED_COMMUNICATION', 'WORKSPACE_USER'],
      observations: [],
      admittedClaims: [
        {
          claimClass: 'COMMUNICATION_CLAIM',
          claimId: 'claim_pg-email-status',
          factKind: 'APPLICATION_STATUS',
          value: 'REGISTERED',
          source: communicationSource,
          consequential: true,
          reviewedByPrincipalId: 'user_pg-reviewer',
          reviewedAt: '2026-09-11T11:05:00.000Z'
        },
        {
          claimClass: 'WORKSPACE_USER_CONFIRMATION',
          claimId: 'claim_pg-certificate',
          factKind: 'REGISTRATION_DATE',
          value: '2026-09-01',
          consequential: true,
          confirmedByPrincipalId: 'user_pg-agent',
          confirmedAt: '2026-09-11T11:06:00.000Z'
        }
      ],
      idempotencyKey: 'claims-persisted'
    });

    const restarted = new PostgresTrademarkAssetRefreshLedger(database, database.getPool(), now);
    const restored = await restarted.listCurrentAdmittedClaims(workspaceId, asset.trademarkAssetId);
    expect(restored).toHaveLength(2);
    expect(restored.map((claim) => claim.claimClass).sort()).toEqual([
      'COMMUNICATION_CLAIM',
      'WORKSPACE_USER_CONFIRMATION'
    ]);
    for (const claim of restored) {
      expect(claim.officialTruthVerifiedByLite).toBe(false);
      expect(claim.customerInstructionEstablished).toBe(false);
      expect(claim.legalConclusionCreated).toBe(false);
      expect(claim.admissionFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
