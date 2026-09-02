import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import { createServiceRuntime, type ServiceRuntime } from '@markorbit/service-kit';
import {
  createTrademarkAssetReadRoutes,
  type TrademarkAssetReadRouteOptions
} from '../src/trademark-asset-http.js';
import { PostgresTrademarkAssetManagementDispositionStore } from '../src/trademark-asset-management-disposition.js';
import { prepareTrademarkAssetManagementRecommendations } from '../src/trademark-asset-management-recommendation.js';
import { deriveTrademarkAssetManagementSignals } from '../src/trademark-asset-management-signal.js';
import { composeTrademarkAssetView } from '../src/trademark-asset-view.js';
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
const secret = 'lite-management-disposition-read-postgres-secret';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 'session_management_disposition_read_postgres',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_management_disposition_read_postgres',
  role: 'READ_ONLY',
  permissions: ['workspace:read']
};
const admissionSource = {
  owner: 'WORKSPACE_USER',
  kind: 'WORKSPACE_ADMISSION',
  sourceId: 'admission_m11-wp09-read',
  sourceVersion: '1',
  observedAt: '2026-08-21T01:00:00.000Z',
  freshness: 'CURRENT'
} as const;

suite('PostgreSQL exact-current Trademark Asset management disposition read', () => {
  let clock = 0;
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-trademark-asset-management-disposition-read-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_trademark_asset_management_disposition_read_test'
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
      'lite_trademark_asset_management_disposition_read_test',
      liteMigrations
    );
    await database.getPool().query(
      `INSERT INTO workspaces (workspace_id,name,slug) VALUES
       ($1,'Disposition Read Test','disposition-read-test'),
       ($2,'Disposition Read Other','disposition-read-other')
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

  afterAll(async () => {
    await database.close();
  });

  async function admitAsset(suffix = 'primary') {
    return assets().admit({
      workspaceId,
      identity: { jurisdiction: 'US', markText: `MARKORBIT READ ${suffix}` },
      workspaceRelationships: [{ kind: 'MANAGED', sourceAssetEditableByWorkspace: false }],
      sourceReferences: [admissionSource],
      idempotencyKey: `m11-wp09-read-admit-${suffix}`
    });
  }

  function projection(asset: Awaited<ReturnType<typeof admitAsset>>) {
    const composedAt = '2026-08-21T02:00:00.000Z';
    const view = composeTrademarkAssetView({ anchor: asset, composedAt });
    const signals = deriveTrademarkAssetManagementSignals(view, undefined, composedAt);
    const recommendations = prepareTrademarkAssetManagementRecommendations({
      signals,
      relatedOwnerReferences: view.anchor.relations,
      createdAt: composedAt
    });
    return { signals, recommendations };
  }

  function commandFor(
    asset: Awaited<ReturnType<typeof admitAsset>>,
    idempotencyKey: string,
    kind: 'WATCHED' | 'DEFERRED' | 'DISMISSED' | 'CONTINUED' = 'WATCHED'
  ) {
    const current = projection(asset);
    const signal = current.signals[0]!;
    const recommendation = current.recommendations.find((candidate) =>
      candidate.signalReferences.some(
        (reference) =>
          reference.id === signal.managementSignalId && reference.version === signal.version
      )
    );
    return {
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      expectedTrademarkAssetVersion: asset.version,
      managementSignal: { id: signal.managementSignalId, version: signal.version },
      ...(recommendation
        ? {
            recommendation: {
              id: recommendation.recommendationId,
              version: recommendation.version
            }
          }
        : {}),
      kind,
      subjectUserId: principal.userId,
      idempotencyKey
    };
  }

  async function startReadRuntime(store: PostgresTrademarkAssetManagementDispositionStore) {
    const runtime = createServiceRuntime(
      { name: 'lite-management-disposition-read-postgres-test', port: 0, version: '0.1.0' },
      {
        routes: createTrademarkAssetReadRoutes({
          internalServiceSecret: secret,
          assets: {},
          commerce: {},
          dispositions: store,
          portfolio: {},
          refreshLedger: {},
          aiGuide: {}
        } as unknown as TrademarkAssetReadRouteOptions)
      }
    );
    await runtime.start();
    return runtime;
  }

  async function readThroughHttp(runtime: ServiceRuntime, assetId: string) {
    const response = await fetch(
      `http://127.0.0.1:${runtime.listeningPort}/v1/trademark-assets/${assetId}/management-dispositions`,
      {
        headers: {
          'x-markorbit-internal-authorization': secret,
          'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
          'x-markorbit-workspace-id': workspaceId
        }
      }
    );
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  it('returns each exact current Product disposition kind and deterministically selects the latest exact Signal record', async () => {
    const asset = await admitAsset();
    const store = dispositions();
    const currentSignal = projection(asset).signals[0]!;

    for (const kind of ['WATCHED', 'DEFERRED', 'DISMISSED', 'CONTINUED'] as const) {
      const recorded = await store.record(
        commandFor(asset, `current-kind-${kind.toLowerCase()}`, kind)
      );
      const read = await store.listCurrentForAsset(workspaceId, asset.trademarkAssetId);
      expect(read.asset).toEqual({ id: asset.trademarkAssetId, version: asset.version });
      expect(read.items).toHaveLength(projection(asset).signals.length);
      const item = read.items.find(
        (candidate) =>
          candidate.signal.id === currentSignal.managementSignalId &&
          candidate.signal.version === currentSignal.version
      );
      expect(item?.disposition).toEqual(recorded);
      expect(item?.disposition?.kind).toBe(kind);
      expect(item?.disposition?.officialTruthCreated).toBe(false);
      expect(item?.disposition?.legalConclusionVerified).toBe(false);
      expect(item?.disposition?.capabilityVerified).toBe(false);
    }
  });

  it('returns an internally-governed RESOLVED_BY_WORKFLOW_REFERENCE disposition without creating authority', async () => {
    const asset = await admitAsset('workflow');
    const base = commandFor(asset, 'workflow-resolution');
    const workflowReference = {
      kind: 'MATTER' as const,
      owner: 'MARKREG' as const,
      referenceId: 'matter_read_projection',
      referenceVersion: '2'
    };
    const recorded = await dispositions().record({
      ...base,
      kind: 'RESOLVED_BY_WORKFLOW_REFERENCE',
      workflowReference
    });

    const read = await dispositions().listCurrentForAsset(workspaceId, asset.trademarkAssetId);
    const item = read.items.find(
      (candidate) => candidate.signal.id === base.managementSignal.id
    );
    expect(item?.disposition).toEqual(recorded);
    expect(item?.disposition?.workflowReference).toEqual(workflowReference);
    expect(item?.disposition?.officialTruthCreated).toBe(false);
  });

  it('does not inherit an old disposition when the same stable Signal id advances to a new version', async () => {
    const original = await admitAsset('stale-version');
    const oldSignal = projection(original).signals[0]!;
    await dispositions().record(commandFor(original, 'old-version'));

    const current = await assets().updateWorkspaceMetadata({
      workspaceId,
      trademarkAssetId: original.trademarkAssetId,
      expectedVersion: original.version,
      workspaceTags: [],
      workspaceNotes: [],
      workspacePriority: 'High owner priority',
      idempotencyKey: 'advance-read-version'
    });
    const currentSignal = projection(current).signals.find(
      (candidate) => candidate.managementSignalId === oldSignal.managementSignalId
    );
    expect(currentSignal).toBeDefined();
    expect(currentSignal!.version).toBeGreaterThan(oldSignal.version);

    const read = await dispositions().listCurrentForAsset(workspaceId, current.trademarkAssetId);
    const item = read.items.find(
      (candidate) => candidate.signal.id === oldSignal.managementSignalId
    );
    expect(item).toEqual({
      signal: { id: currentSignal!.managementSignalId, version: currentSignal!.version },
      disposition: null
    });
  });

  it('isolates Assets and Workspaces and returns privacy-safe NOT_FOUND for a foreign Workspace', async () => {
    const first = await admitAsset('first');
    const second = await admitAsset('second');
    const firstRecorded = await dispositions().record(commandFor(first, 'first-record'));
    await dispositions().record(commandFor(second, 'second-record'));

    const read = await dispositions().listCurrentForAsset(workspaceId, first.trademarkAssetId);
    expect(
      read.items.some((item) => item.disposition?.dispositionId === firstRecorded.dispositionId)
    ).toBe(true);
    expect(
      read.items.some((item) => item.disposition?.asset.id === second.trademarkAssetId)
    ).toBe(false);
    await expect(
      dispositions().listCurrentForAsset(otherWorkspaceId, first.trademarkAssetId)
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  it('survives service restart from durable PostgreSQL truth', async () => {
    const asset = await admitAsset('restart');
    const recorded = await dispositions().record(
      commandFor(asset, 'restart-record', 'DISMISSED')
    );

    const firstRuntime = await startReadRuntime(dispositions());
    const first = await readThroughHttp(firstRuntime, asset.trademarkAssetId);
    await firstRuntime.stop();
    expect(first.status).toBe(200);

    const restartedRuntime = await startReadRuntime(dispositions());
    try {
      const replay = await readThroughHttp(restartedRuntime, asset.trademarkAssetId);
      expect(replay).toEqual(first);
      const items = replay.body.items as Array<{ disposition: { dispositionId: string } | null }>;
      expect(items.some((item) => item.disposition?.dispositionId === recorded.dispositionId)).toBe(
        true
      );
    } finally {
      await restartedRuntime.stop();
    }
  });

  it('fails closed when persisted disposition document lineage is corrupt', async () => {
    const asset = await admitAsset('corrupt');
    const recorded = await dispositions().record(commandFor(asset, 'corrupt-record'));
    await database.getPool().query(
      `UPDATE lite_trademark_asset_management_dispositions
          SET document_json=jsonb_set(document_json,'{asset,version}','999'::jsonb,false)
        WHERE workspace_id=$1 AND disposition_id=$2`,
      [workspaceId, recorded.dispositionId]
    );

    await expect(
      dispositions().listCurrentForAsset(workspaceId, asset.trademarkAssetId)
    ).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
      status: 503,
      retryable: true
    });
  });
});
