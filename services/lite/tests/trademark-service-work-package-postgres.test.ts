import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import { PostgresLiteTrademarkAssetStore } from '../src/trademark-asset.js';
import { PostgresTrademarkServiceWorkPackageStore } from '../src/trademark-service-work-package.js';

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
const observedAt = '2026-08-21T03:00:00.000Z';
const admissionSource = {
  owner: 'WORKSPACE_USER',
  kind: 'WORKSPACE_ADMISSION',
  sourceId: 'admission_m12-wp02',
  sourceVersion: '1',
  observedAt,
  freshness: 'CURRENT'
} as const;
const renewalIntent = {
  kind: 'RENEWAL',
  jurisdiction: 'US',
  title: 'Prepare renewal review',
  rationale: 'The user chose to prepare a renewal-related professional service work package.',
  inferredFromProductContext: true,
  reviewedByUser: true,
  legalConclusionCreated: false,
  serviceAvailabilityVerified: false,
  legalDeadlineCertified: false
} as const;

suite('PostgreSQL M12-WP02 durable Trademark Service Work Package', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-trademark-service-work-package-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_trademark_service_work_package_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  const assetStore = () =>
    new PostgresLiteTrademarkAssetStore(
      database,
      database.getPool(),
      () => '2026-08-21T03:01:00.000Z'
    );
  const workPackageStore = () =>
    new PostgresTrademarkServiceWorkPackageStore(
      database,
      database.getPool(),
      () => '2026-08-21T03:02:00.000Z'
    );

  beforeAll(async () => {
    await database.start();
    await database
      .getPool()
      .query(
        'CREATE TABLE IF NOT EXISTS workspaces (workspace_id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE)'
      );
    const existingWorkPackageTable = await database
      .getPool()
      .query("SELECT to_regclass('public.lite_trademark_service_work_packages') AS table_name");
    const existingWorkPackageTableName = (
      existingWorkPackageTable.rows[0] as { table_name?: string | null } | undefined
    )?.table_name;
    if (!existingWorkPackageTableName) {
      const liteMigrations = await loadMigrationsForOwner(
        migrationsDirectory,
        migrationOwners,
        '@markorbit/lite-service'
      );
      await migrate(database.getPool(), 'lite_trademark_service_work_package_test', liteMigrations);
    }
    await database.getPool().query(
      `INSERT INTO workspaces (workspace_id,name,slug) VALUES
       ($1,'Service Workbench Test','service-workbench-test'),
       ($2,'Service Workbench Other','service-workbench-other')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceId, otherWorkspaceId]
    );
  });

  beforeEach(async () => {
    await database.getPool().query(
      `TRUNCATE
         lite_trademark_service_work_package_commands,
         lite_trademark_service_work_package_versions,
         lite_trademark_service_work_packages,
         lite_trademark_asset_commands,
         lite_trademark_asset_identifiers,
         lite_trademark_assets
       CASCADE`
    );
  });

  afterAll(() => database.close());

  async function admitAsset(targetWorkspaceId = workspaceId) {
    return assetStore().admit({
      workspaceId: targetWorkspaceId,
      identity: { jurisdiction: 'US', markText: 'MARKORBIT SERVICE' },
      workspaceRelationships: [{ kind: 'MANAGED', sourceAssetEditableByWorkspace: false }],
      sourceReferences: [admissionSource],
      idempotencyKey: `asset-${targetWorkspaceId}`
    });
  }

  it('creates an Asset-linked DRAFT package without creating legal or execution authority', async () => {
    const asset = await admitAsset();
    const created = await workPackageStore().create({
      workspaceId,
      asset: { id: asset.trademarkAssetId, version: asset.version },
      managementRecommendationReference: 'trademark-asset-management-recommendation_reviewed-1@1',
      intent: renewalIntent,
      createdByUserId: 'user_m12-wp02',
      idempotencyKey: 'create-renewal-work-package'
    });

    expect(created).toMatchObject({
      workspaceId,
      version: 1,
      readiness: {
        state: 'DRAFT',
        preparationCompletenessOnly: true,
        successProbabilityCalculated: false,
        filingEligibilityCertified: false,
        legalValidityCertified: false
      },
      parallelMatterLifecycleCreated: false,
      officialTruthCreated: false,
      protectedActionAuthorized: false
    });
    expect(created.requirementCandidates).toEqual([]);
    expect(created.capabilityCandidates).toEqual([]);
    expect(created.providerCandidates).toEqual([]);
    expect(created.communicationDrafts).toEqual([]);
  });

  it('replays create idempotently and rejects key reuse with a different command', async () => {
    const asset = await admitAsset();
    const command = {
      workspaceId,
      asset: { id: asset.trademarkAssetId, version: asset.version },
      intent: renewalIntent,
      createdByUserId: 'user_m12-wp02',
      idempotencyKey: 'idempotent-create'
    } as const;
    const first = await workPackageStore().create(command);
    const replay = await workPackageStore().create(command);
    expect(replay).toEqual(first);

    await expect(
      workPackageStore().create({
        ...command,
        matterReference: 'formal-matter_different'
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('requires at least one Asset or Matter anchor', async () => {
    await expect(
      workPackageStore().create({
        workspaceId,
        intent: renewalIntent,
        createdByUserId: 'user_m12-wp02',
        idempotencyKey: 'missing-anchor'
      })
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('accepts a Matter-only package without querying or copying MarkReg lifecycle state', async () => {
    const created = await workPackageStore().create({
      workspaceId,
      matterReference: 'formal-matter_markreg-owned-1@4',
      intent: renewalIntent,
      createdByUserId: 'user_m12-wp02',
      idempotencyKey: 'matter-only'
    });
    expect(created.matterReference).toBe('formal-matter_markreg-owned-1@4');
    expect(created).not.toHaveProperty('matterStatus');
    expect(created.parallelMatterLifecycleCreated).toBe(false);
  });

  it('protects direct Asset ID guessing across workspaces', async () => {
    const privateAsset = await admitAsset(workspaceId);
    await expect(
      workPackageStore().create({
        workspaceId: otherWorkspaceId,
        asset: { id: privateAsset.trademarkAssetId, version: privateAsset.version },
        intent: renewalIntent,
        createdByUserId: 'other_user',
        idempotencyKey: 'cross-workspace-asset'
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('protects direct Work Package ID guessing across workspaces', async () => {
    const asset = await admitAsset();
    const created = await workPackageStore().create({
      workspaceId,
      asset: { id: asset.trademarkAssetId, version: asset.version },
      intent: renewalIntent,
      createdByUserId: 'user_m12-wp02',
      idempotencyKey: 'private-work-package'
    });
    await expect(
      workPackageStore().get(otherWorkspaceId, created.workPackageId)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('uses optimistic versioning and keeps exact historical snapshots', async () => {
    const asset = await admitAsset();
    const store = workPackageStore();
    const created = await store.create({
      workspaceId,
      asset: { id: asset.trademarkAssetId, version: asset.version },
      intent: renewalIntent,
      createdByUserId: 'user_m12-wp02',
      idempotencyKey: 'version-create'
    });
    const updated = await store.updateContext({
      workspaceId,
      workPackageId: created.workPackageId,
      expectedVersion: 1,
      asset: { id: asset.trademarkAssetId, version: asset.version },
      matterReference: 'formal-matter_markreg-owned-2@1',
      managementRecommendationReference: 'recommendation_reviewed-2@2',
      intent: renewalIntent,
      idempotencyKey: 'version-update'
    });

    expect(updated.version).toBe(2);
    expect(updated.matterReference).toBe('formal-matter_markreg-owned-2@1');
    expect(await store.getVersion(workspaceId, created.workPackageId, 1)).toEqual(created);
    expect(await store.getVersion(workspaceId, created.workPackageId, 2)).toEqual(updated);

    await expect(
      store.updateContext({
        workspaceId,
        workPackageId: created.workPackageId,
        expectedVersion: 1,
        asset: { id: asset.trademarkAssetId, version: asset.version },
        matterReference: 'formal-matter_stale@1',
        intent: renewalIntent,
        idempotencyKey: 'stale-update'
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });

  it('survives store restart with the same exact current package', async () => {
    const asset = await admitAsset();
    const created = await workPackageStore().create({
      workspaceId,
      asset: { id: asset.trademarkAssetId, version: asset.version },
      intent: renewalIntent,
      createdByUserId: 'user_m12-wp02',
      idempotencyKey: 'restart-create'
    });
    const restarted = workPackageStore();
    expect(await restarted.get(workspaceId, created.workPackageId)).toEqual(created);
  });
});
