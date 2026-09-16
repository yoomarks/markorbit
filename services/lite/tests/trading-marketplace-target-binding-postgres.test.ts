import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  noTradingMarketplaceTargetBindingAuthorityConsequencesV1,
  type TradingMarketplaceTargetBindingV1
} from '@markorbit/contracts/trading-marketplace-target-binding';
import {
  ManagedDatabase,
  loadMigrationsForOwner,
  migrate,
  type QueryClient
} from '@markorbit/persistence';
import {
  PostgresTradingMarketplaceTargetBindingStore,
  type TradingMarketplaceTargetCurrentnessV1
} from '../src/trading-marketplace-target-binding.js';

const url = process.env.LITE_TRADEMARK_ASSET_TEST_DATABASE_URL;
const required = process.env.LITE_TRADEMARK_ASSET_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error('LITE_TRADEMARK_ASSET_TEST_DATABASE_URL is required for PostgreSQL tests.');
const suite = url ? describe : describe.skip;
const workspaceA = '12121212-1212-4121-8121-121212121212';
const workspaceB = '34343434-3434-4343-8343-343434343434';
const workspaceMissing = '56565656-5656-4565-8565-565656565656';

suite('PostgreSQL Lite Trading marketplace target binding persistence', () => {
  let tick = 0;
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-trading-marketplace-target-test',
    poolMaximum: 6,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_trademark_asset_test'
  });
  const now = () => new Date(Date.UTC(2026, 8, 16, 2, 0, tick++)).toISOString();
  const store = (query: QueryClient = database.getPool()) =>
    new PostgresTradingMarketplaceTargetBindingStore(database, query, now);

  beforeAll(async () => {
    await database.start();
    await database
      .getPool()
      .query(
        'CREATE TABLE IF NOT EXISTS workspaces (workspace_id uuid PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE)'
      );
    const migrations = await loadMigrationsForOwner(
      path.resolve('../../infrastructure/persistence/migrations'),
      path.resolve('../../infrastructure/persistence/migration-owners.json'),
      '@markorbit/lite-service'
    );
    await migrate(database.getPool(), 'lite_trademark_asset_test', migrations);
    await database.getPool().query(
      `INSERT INTO workspaces(workspace_id,name,slug) VALUES
        ($1,'Target A','target-a'),($2,'Target B','target-b'),($3,'Target Missing','target-missing')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceA, workspaceB, workspaceMissing]
    );
  });
  beforeEach(async () => {
    tick = 0;
    await database
      .getPool()
      .query('TRUNCATE lite_trading_marketplace_target_binding_versions CASCADE');
  });
  afterAll(() => database.close());

  function binding(
    workspaceId: string,
    version = 1,
    lifecycle: TradingMarketplaceTargetBindingV1['lifecycle'] = 'ACTIVE'
  ): TradingMarketplaceTargetBindingV1 {
    const lastVerifiedAt = `2026-09-16T02:0${version}:00.000Z`;
    const stateTime = `2026-09-16T02:0${version}:30.000Z`;
    return {
      schemaVersion: 1,
      tradingMarketplaceTargetBindingId: 'trading-marketplace-target-binding_pg-shop-1',
      version,
      workspaceId,
      identity: {
        marketplaceId: 'SHOPIFY',
        externalAccountId: 'acct_pg-1',
        externalStoreId: 'store_pg-1',
        displayLabel: 'Orbit Store',
        handle: 'orbit-store'
      },
      lifecycle,
      connection: {
        sourceKind: 'MARKETPLACE_AUTH',
        evidenceRefs: [`connection-evidence_pg-${version}`]
      },
      createdAt: '2026-09-16T02:00:00.000Z',
      lastVerifiedAt,
      updatedAt: stateTime,
      ...(lifecycle === 'STALE' ? { staleAt: stateTime } : {}),
      ...(lifecycle === 'REVOKED' ? { revokedAt: stateTime } : {}),
      authority: noTradingMarketplaceTargetBindingAuthorityConsequencesV1
    };
  }
  const expectState = async (
    value: Promise<TradingMarketplaceTargetCurrentnessV1>,
    state: TradingMarketplaceTargetCurrentnessV1['state']
  ) => expect(value).resolves.toMatchObject({ state });

  it('persists one exact active target and resolves it CURRENT after restart', async () => {
    const first = binding(workspaceA);
    const command = {
      workspaceId: workspaceA,
      binding: first,
      expectedVersion: 0,
      idempotencyKey: 'target-create'
    };
    expect(await store().saveBinding(command)).toEqual(first);
    expect(await store().saveBinding(command)).toEqual(first);
    const restarted = store();
    expect(
      await restarted.getBindingVersion(workspaceA, first.tradingMarketplaceTargetBindingId, 1)
    ).toEqual(first);
    await expectState(
      restarted.resolveCurrentness(workspaceA, first.tradingMarketplaceTargetBindingId, 1),
      'CURRENT'
    );
  });

  it('keeps v1 exact but marks it STALE after v2 changes binding meaning', async () => {
    const first = binding(workspaceA, 1);
    await store().saveBinding({
      workspaceId: workspaceA,
      binding: first,
      expectedVersion: 0,
      idempotencyKey: 'target-v1'
    });
    const second = {
      ...binding(workspaceA, 2),
      identity: { ...first.identity, externalStoreId: 'store_pg-2' }
    };
    await store().saveBinding({
      workspaceId: workspaceA,
      binding: second,
      expectedVersion: 1,
      idempotencyKey: 'target-v2'
    });
    expect(
      await store().getBindingVersion(workspaceA, first.tradingMarketplaceTargetBindingId, 1)
    ).toEqual(first);
    await expectState(
      store().resolveCurrentness(workspaceA, first.tradingMarketplaceTargetBindingId, 1),
      'STALE'
    );
    await expectState(
      store().resolveCurrentness(workspaceA, second.tradingMarketplaceTargetBindingId, 2),
      'CURRENT'
    );
  });

  it.each(['STALE', 'REVOKED'] as const)(
    'returns explicit %s lifecycle currentness',
    async (lifecycle) => {
      const value = binding(workspaceA, 1, lifecycle);
      await store().saveBinding({
        workspaceId: workspaceA,
        binding: value,
        expectedVersion: 0,
        idempotencyKey: `target-${lifecycle}`
      });
      await expectState(
        store().resolveCurrentness(workspaceA, value.tradingMarketplaceTargetBindingId, 1),
        lifecycle
      );
    }
  );

  it('isolates target identity by trusted Workspace envelope', async () => {
    const a = binding(workspaceA);
    const b = binding(workspaceB);
    await store().saveBinding({
      workspaceId: workspaceA,
      binding: a,
      expectedVersion: 0,
      idempotencyKey: 'target-ws-a'
    });
    await store().saveBinding({
      workspaceId: workspaceB,
      binding: b,
      expectedVersion: 0,
      idempotencyKey: 'target-ws-b'
    });
    expect(
      await store().getBindingVersion(workspaceA, a.tradingMarketplaceTargetBindingId, 1)
    ).toEqual(a);
    expect(
      await store().getBindingVersion(workspaceB, b.tradingMarketplaceTargetBindingId, 1)
    ).toEqual(b);
    await expectState(
      store().resolveCurrentness(workspaceMissing, a.tradingMarketplaceTargetBindingId, 1),
      'UNKNOWN'
    );
  });

  it('rejects cross-Workspace payloads and idempotency reuse with changed effect', async () => {
    await expect(
      store().saveBinding({
        workspaceId: workspaceA,
        binding: binding(workspaceB),
        expectedVersion: 0,
        idempotencyKey: 'target-cross-workspace'
      })
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    const first = binding(workspaceA);
    await store().saveBinding({
      workspaceId: workspaceA,
      binding: first,
      expectedVersion: 0,
      idempotencyKey: 'target-conflict'
    });
    await expect(
      store().saveBinding({
        workspaceId: workspaceA,
        binding: binding(workspaceA, 2),
        expectedVersion: 1,
        idempotencyKey: 'target-conflict'
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('never substitutes latest when the requested exact version does not exist', async () => {
    const first = binding(workspaceA);
    await store().saveBinding({
      workspaceId: workspaceA,
      binding: first,
      expectedVersion: 0,
      idempotencyKey: 'target-exact'
    });
    await expect(
      store().getBindingVersion(workspaceA, first.tradingMarketplaceTargetBindingId, 2)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expectState(
      store().resolveCurrentness(workspaceA, first.tradingMarketplaceTargetBindingId, 2),
      'UNKNOWN'
    );
  });

  it('returns UNKNOWN when the exact version is absent even if a newer version exists', async () => {
    const first = binding(workspaceA, 1);
    const second = binding(workspaceA, 2);
    await store().saveBinding({
      workspaceId: workspaceA,
      binding: first,
      expectedVersion: 0,
      idempotencyKey: 'target-gap-v1'
    });
    await store().saveBinding({
      workspaceId: workspaceA,
      binding: second,
      expectedVersion: 1,
      idempotencyKey: 'target-gap-v2'
    });
    await database.getPool().query(
      `DELETE FROM lite_trading_marketplace_target_binding_versions
       WHERE workspace_id=$1 AND target_binding_id=$2 AND version=1`,
      [workspaceA, first.tradingMarketplaceTargetBindingId]
    );
    await expectState(
      store().resolveCurrentness(workspaceA, first.tradingMarketplaceTargetBindingId, 1),
      'UNKNOWN'
    );
  });

  it('returns UNKNOWN for corrupt durable state instead of treating it as current', async () => {
    const first = binding(workspaceA);
    await store().saveBinding({
      workspaceId: workspaceA,
      binding: first,
      expectedVersion: 0,
      idempotencyKey: 'target-integrity'
    });
    await database.getPool().query(
      `UPDATE lite_trading_marketplace_target_binding_versions SET document_json='{}'::jsonb
       WHERE workspace_id=$1 AND target_binding_id=$2 AND version=1`,
      [workspaceA, first.tradingMarketplaceTargetBindingId]
    );
    await expectState(
      store().resolveCurrentness(workspaceA, first.tradingMarketplaceTargetBindingId, 1),
      'UNKNOWN'
    );
    await expect(
      store().getBindingVersion(workspaceA, first.tradingMarketplaceTargetBindingId, 1)
    ).rejects.toMatchObject({ code: 'INTEGRITY_FAILURE' });
  });

  it('returns UNAVAILABLE when the currentness reader cannot reach persistence', async () => {
    const unavailableQuery = {
      query: () => Promise.reject(new Error('database unavailable'))
    } as unknown as QueryClient;
    await expectState(
      store(unavailableQuery).resolveCurrentness(
        workspaceA,
        'trading-marketplace-target-binding_pg-shop-1',
        1
      ),
      'UNAVAILABLE'
    );
  });
});
