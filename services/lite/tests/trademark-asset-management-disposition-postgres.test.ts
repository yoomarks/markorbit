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
const internalServiceSecret = 'lite-management-disposition-postgres-secret';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 'session_management_disposition_postgres',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_management_disposition_postgres',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'matter:manage']
};
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
  let runtime: ServiceRuntime;
  let baseUrl: string;
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
    runtime = createServiceRuntime(
      { name: 'lite-management-disposition-postgres-test', port: 0, version: '0.1.0' },
      {
        routes: createTrademarkAssetReadRoutes({
          internalServiceSecret,
          assets: {},
          commerce: {},
          dispositions: dispositions(),
          portfolio: {},
          refreshLedger: {},
          aiGuide: {}
        } as unknown as TrademarkAssetReadRouteOptions)
      }
    );
    await runtime.start();
    baseUrl = `http://127.0.0.1:${runtime.listeningPort}`;
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
    await runtime?.stop();
    await database.close();
  });

  async function admitAsset(suffix = 'primary') {
    return assets().admit({
      workspaceId,
      identity: { jurisdiction: 'US', markText: `MARKORBIT ${suffix}` },
      workspaceRelationships: [{ kind: 'MANAGED', sourceAssetEditableByWorkspace: false }],
      sourceReferences: [admissionSource],
      idempotencyKey: `m11-wp07-admit-${suffix}`
    });
  }

  async function advanceAsset(suffix = 'primary') {
    const asset = await admitAsset(suffix);
    return assets().updateWorkspaceMetadata({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      expectedVersion: asset.version,
      workspaceTags: [],
      workspaceNotes: [],
      workspacePriority: 'High owner priority',
      idempotencyKey: `m11-wp07-update-${suffix}`
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
    signalIndex = 0,
    recommendationIndex: number | undefined = signalIndex
  ) {
    const current = projection(asset);
    const signal = current.signals[signalIndex]!;
    const recommendation =
      recommendationIndex === undefined ? undefined : current.recommendations[recommendationIndex]!;
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
      kind: 'WATCHED' as const,
      subjectUserId: 'user_m11-wp07',
      idempotencyKey
    };
  }

  async function recordThroughHttp(
    assetId: string,
    requestBody: Record<string, unknown>,
    idempotencyKey: string
  ) {
    const response = await fetch(
      `${baseUrl}/v1/trademark-assets/${assetId}/management-dispositions`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': internalServiceSecret,
          'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
          'x-markorbit-workspace-id': workspaceId,
          'idempotency-key': idempotencyKey
        },
        body: JSON.stringify(requestBody)
      }
    );
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  async function readThroughHttp(
    assetId: string,
    readPrincipal: WorkspacePrincipal = {
      ...principal,
      role: 'READ_ONLY',
      permissions: ['workspace:read']
    },
    requestedWorkspaceId = readPrincipal.workspaceId
  ) {
    const response = await fetch(
      `${baseUrl}/v1/trademark-assets/${assetId}/management-dispositions`,
      {
        headers: {
          'x-markorbit-internal-authorization': internalServiceSecret,
          'x-markorbit-principal': encodeInternalWorkspacePrincipal(readPrincipal),
          'x-markorbit-workspace-id': requestedWorkspaceId
        }
      }
    );
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  it('persists exact current Asset, Signal, and Recommendation versions instead of constants', async () => {
    const asset = await advanceAsset();
    const command = commandFor(asset, 'exact-current');
    const result = await dispositions().record(command);
    expect(asset.version).toBeGreaterThan(1);
    expect(result).toMatchObject({
      asset: { id: asset.trademarkAssetId, version: asset.version },
      signal: command.managementSignal,
      recommendation: command.recommendation,
      officialTruthCreated: false,
      legalConclusionVerified: false,
      capabilityVerified: false
    });
    const persisted = await database.getPool().query(
      `SELECT document_json FROM lite_trademark_asset_management_dispositions
        WHERE workspace_id=$1 AND disposition_id=$2`,
      [workspaceId, result.dispositionId]
    );
    const persistedDocument = (persisted.rows[0] as { document_json?: unknown } | undefined)
      ?.document_json;
    expect(persistedDocument).toMatchObject({
      asset: { version: asset.version },
      signal: { version: asset.version },
      recommendation: { version: asset.version }
    });
  });

  it('records and idempotently replays exact durable current-owner truth through authenticated HTTP', async () => {
    const asset = await advanceAsset('http');
    const command = commandFor(asset, 'http-exact-current');
    const requestBody = {
      expectedTrademarkAssetVersion: command.expectedTrademarkAssetVersion,
      managementSignal: command.managementSignal,
      recommendation: command.recommendation,
      kind: 'CONTINUED',
      note: 'Continue private Product management.'
    };

    const first = await recordThroughHttp(
      asset.trademarkAssetId,
      requestBody,
      command.idempotencyKey
    );
    expect(first).toMatchObject({
      status: 200,
      body: {
        disposition: {
          workspaceId,
          asset: { id: asset.trademarkAssetId, version: asset.version },
          signal: command.managementSignal,
          recommendation: command.recommendation,
          kind: 'CONTINUED',
          subjectUserId: principal.userId,
          officialTruthCreated: false,
          legalConclusionVerified: false,
          capabilityVerified: false
        }
      }
    });
    const replay = await recordThroughHttp(
      asset.trademarkAssetId,
      requestBody,
      command.idempotencyKey
    );
    expect(replay).toEqual(first);

    const returned = first.body.disposition as { dispositionId: string };
    const persisted = await database.getPool().query(
      `SELECT document_json FROM lite_trademark_asset_management_dispositions
        WHERE workspace_id=$1 AND disposition_id=$2`,
      [workspaceId, returned.dispositionId]
    );
    expect((persisted.rows[0] as { document_json: unknown }).document_json).toEqual(
      first.body.disposition
    );
    const recovery = await database.getPool().query(
      `SELECT payload_json FROM lite_trademark_asset_management_recovery_jobs
        WHERE workspace_id=$1 AND disposition_id=$2`,
      [workspaceId, returned.dispositionId]
    );
    expect(recovery.rows).toHaveLength(2);
    expect(
      recovery.rows.every(
        (row) =>
          (row as { payload_json: { protectedActionAuthorized: boolean } }).payload_json
            .protectedActionAuthorized === false
      )
    ).toBe(true);
  });

  it.each([
    'WATCHED',
    'DEFERRED',
    'DISMISSED',
    'CONTINUED',
    'RESOLVED_BY_WORKFLOW_REFERENCE'
  ] as const)('reloads the current %s disposition through workspace:read HTTP', async (kind) => {
    const asset = await advanceAsset(`read-${kind.toLowerCase()}`);
    const command = commandFor(asset, `read-${kind}`);
    const recorded = await dispositions().record({
      ...command,
      kind,
      ...(kind === 'RESOLVED_BY_WORKFLOW_REFERENCE'
        ? {
            workflowReference: {
              kind: 'MATTER' as const,
              owner: 'MARKREG' as const,
              referenceId: 'matter_read-current',
              referenceVersion: '1'
            }
          }
        : {})
    });

    const response = await readThroughHttp(asset.trademarkAssetId);
    expect(response).toMatchObject({
      status: 200,
      body: {
        schemaVersion: 1,
        workspaceId,
        asset: { id: asset.trademarkAssetId, version: asset.version }
      }
    });
    const items = response.body.items as Array<{
      signal: { id: string; version: number };
      disposition: unknown;
    }>;
    expect(items).toHaveLength(projection(asset).signals.length);
    expect(items.map((item) => item.signal.id)).toEqual(
      projection(asset).signals.map((signal) => signal.managementSignalId)
    );
    expect(
      items.find((item) => item.signal.id === command.managementSignal.id)?.disposition
    ).toEqual(recorded);
  });

  it('returns null for stale Signal-version history and survives a new store instance', async () => {
    const original = await advanceAsset('stale-read');
    const command = commandFor(original, 'stale-read');
    await dispositions().record(command);
    const current = await assets().updateWorkspaceMetadata({
      workspaceId,
      trademarkAssetId: original.trademarkAssetId,
      expectedVersion: original.version,
      workspaceTags: [],
      workspaceNotes: [],
      workspacePriority: 'High owner priority',
      idempotencyKey: 'stale-read-advance'
    });

    const restartedStore = new PostgresTrademarkAssetManagementDispositionStore(
      database,
      database.getPool(),
      now
    );
    const result = await restartedStore.listCurrentForAsset(workspaceId, current.trademarkAssetId);
    const currentItem = result.items.find((item) => item.signal.id === command.managementSignal.id);
    expect(result.asset.version).toBe(current.version);
    expect(currentItem).toMatchObject({
      signal: { id: command.managementSignal.id, version: current.version },
      disposition: null
    });
  });

  it('chooses the latest exact-current disposition by recordedAt then dispositionId', async () => {
    const asset = await advanceAsset('latest-read');
    const first = await dispositions().record({
      ...commandFor(asset, 'latest-read-first'),
      kind: 'WATCHED'
    });
    const second = await dispositions().record({
      ...commandFor(asset, 'latest-read-second'),
      kind: 'DISMISSED'
    });
    const tiedAt = '2026-08-21T03:00:00.000Z';
    await database.getPool().query(
      `UPDATE lite_trademark_asset_management_dispositions
          SET recorded_at=$3::timestamptz,
              document_json=jsonb_set(document_json,'{recordedAt}',to_jsonb($4::text))
        WHERE workspace_id=$1 AND disposition_id=ANY($2::text[])`,
      [workspaceId, [first.dispositionId, second.dispositionId], tiedAt, tiedAt]
    );
    const expected = [first, second].sort((left, right) =>
      right.dispositionId.localeCompare(left.dispositionId)
    )[0]!;
    const result = await dispositions().listCurrentForAsset(workspaceId, asset.trademarkAssetId);
    expect(
      result.items.find((item) => item.signal.id === first.signal.id)?.disposition
    ).toMatchObject({
      dispositionId: expected.dispositionId,
      kind: expected.kind,
      recordedAt: tiedAt
    });
  });

  it('excludes other Asset and cross-Workspace dispositions and hides guessed Assets', async () => {
    const asset = await advanceAsset('scoped-read');
    const otherAsset = await advanceAsset('other-read');
    const own = await dispositions().record(commandFor(asset, 'scoped-read-own'));
    const other = await dispositions().record(commandFor(otherAsset, 'scoped-read-other'));
    const result = await dispositions().listCurrentForAsset(workspaceId, asset.trademarkAssetId);
    expect(result.items.some((item) => item.disposition?.dispositionId === own.dispositionId)).toBe(
      true
    );
    expect(
      result.items.some((item) => item.disposition?.dispositionId === other.dispositionId)
    ).toBe(false);

    const otherPrincipal = { ...principal, workspaceId: otherWorkspaceId };
    expect(await readThroughHttp(asset.trademarkAssetId, otherPrincipal)).toMatchObject({
      status: 404,
      body: { code: 'NOT_FOUND' }
    });
  });

  it('fails closed for malformed persisted disposition lineage', async () => {
    const asset = await advanceAsset('corrupt-read');
    const recorded = await dispositions().record(commandFor(asset, 'corrupt-read'));
    await database.getPool().query(
      `UPDATE lite_trademark_asset_management_dispositions
          SET document_json=jsonb_set(document_json,'{signal,version}','"corrupt"'::jsonb)
        WHERE workspace_id=$1 AND disposition_id=$2`,
      [workspaceId, recorded.dispositionId]
    );
    await expect(
      dispositions().listCurrentForAsset(workspaceId, asset.trademarkAssetId)
    ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE', status: 503, retryable: true });
  });

  it('rejects guessed and stale current-owner references', async () => {
    const asset = await advanceAsset();
    const exact = commandFor(asset, 'validation-base');
    await expect(
      dispositions().record({
        ...exact,
        managementSignal: {
          ...exact.managementSignal,
          id: 'trademark-asset-management-signal_guessed'
        },
        idempotencyKey: 'guessed-signal'
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      dispositions().record({
        ...exact,
        recommendation: {
          ...exact.recommendation!,
          id: 'trademark-asset-management-recommendation_guessed'
        },
        idempotencyKey: 'guessed-recommendation'
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      dispositions().record({
        ...exact,
        expectedTrademarkAssetVersion: asset.version - 1,
        idempotencyKey: 'stale-asset'
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    await expect(
      dispositions().record({
        ...exact,
        managementSignal: { ...exact.managementSignal, version: asset.version - 1 },
        idempotencyKey: 'stale-signal'
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    await expect(
      dispositions().record({
        ...exact,
        recommendation: { ...exact.recommendation!, version: asset.version - 1 },
        idempotencyKey: 'stale-recommendation'
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });

  it('rejects cross-Asset and unlinked Signal/Recommendation references', async () => {
    const asset = await advanceAsset('first');
    const otherAsset = await advanceAsset('second');
    const exact = commandFor(asset, 'link-base');
    const other = commandFor(otherAsset, 'other-base');

    await expect(
      dispositions().record({
        ...exact,
        managementSignal: other.managementSignal,
        idempotencyKey: 'cross-asset-signal'
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      dispositions().record({
        ...exact,
        recommendation: other.recommendation!,
        idempotencyKey: 'cross-asset-recommendation'
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    const unlinked = commandFor(asset, 'unlinked', 0, 1);
    await expect(dispositions().record(unlinked)).rejects.toMatchObject({
      code: 'VERSION_CONFLICT'
    });
  });

  it('re-resolves new requests while preserving exact historical idempotent replay', async () => {
    const originalAsset = await admitAsset();
    const originalCommand = commandFor(originalAsset, 'historical-replay');
    const historical = await dispositions().record(originalCommand);
    const currentAsset = await assets().updateWorkspaceMetadata({
      workspaceId,
      trademarkAssetId: originalAsset.trademarkAssetId,
      expectedVersion: originalAsset.version,
      workspaceTags: [],
      workspaceNotes: [],
      workspacePriority: 'High owner priority',
      idempotencyKey: 'advance-after-disposition'
    });

    expect(currentAsset.version).toBeGreaterThan(originalAsset.version);
    await expect(dispositions().record(originalCommand)).resolves.toEqual(historical);
    await expect(
      dispositions().record({ ...originalCommand, idempotencyKey: 'new-after-owner-change' })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });

  it('keeps WATCHED, DEFERRED, and DISMISSED as private Product dispositions', async () => {
    const asset = await advanceAsset();
    for (const kind of ['WATCHED', 'DEFERRED', 'DISMISSED'] as const) {
      const result = await dispositions().record({
        ...commandFor(asset, `private-${kind}`),
        kind
      });
      expect(result).toMatchObject({
        kind,
        officialTruthCreated: false,
        legalConclusionVerified: false,
        capabilityVerified: false
      });
    }
  });

  it('exposes only current watch/defer state', async () => {
    const asset = await advanceAsset();
    const watched = await dispositions().record(commandFor(asset, 'watch-1'));
    expect(await dispositions().listWatchState(workspaceId)).toEqual([watched]);

    await dispositions().record({
      ...commandFor(asset, 'watch-continued'),
      kind: 'CONTINUED'
    });
    expect(await dispositions().listWatchState(workspaceId)).toEqual([]);
  });

  it('rejects idempotency key reuse for a different disposition', async () => {
    const asset = await advanceAsset();
    const base = commandFor(asset, 'same-key');
    await dispositions().record(base);
    await expect(dispositions().record({ ...base, kind: 'DISMISSED' })).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT'
    });
  });

  it('keeps workspace boundaries when a direct Asset ID is guessed', async () => {
    const asset = await admitAsset();
    const exact = commandFor(asset, 'cross-workspace');
    await expect(
      dispositions().record({
        ...exact,
        workspaceId: otherWorkspaceId,
        subjectUserId: 'user_other'
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('leases internal recovery work, retries with backoff, then dead-letters and replays explicitly', async () => {
    const asset = await advanceAsset();
    await dispositions().record({
      ...commandFor(asset, 'recovery-disposition'),
      kind: 'DEFERRED'
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
