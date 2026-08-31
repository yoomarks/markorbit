import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { TrademarkAssetId } from '@markorbit/contracts/trademark-asset-workspace';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import { PostgresLiteTrademarkAssetStore } from '../src/trademark-asset.js';
import { PostgresTrademarkAssetCommerceStore } from '../src/trademark-asset-commerce.js';

const url = process.env.LITE_TRADEMARK_ASSET_TEST_DATABASE_URL;
const required = process.env.LITE_TRADEMARK_ASSET_POSTGRES_TEST_REQUIRED === '1';
if (required && !url) {
  throw new Error(
    'LITE_TRADEMARK_ASSET_TEST_DATABASE_URL is required when LITE_TRADEMARK_ASSET_POSTGRES_TEST_REQUIRED=1.'
  );
}
const suite = url ? describe : describe.skip;
const workspaceId = '96969696-9696-4969-8969-969696969696';
const observedAt = '2026-08-19T06:45:00.000Z';
const internalServiceSecret = 'lite-352-commerce-runtime-secret-012345';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 'session_commerce_runtime',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_commerce_runtime',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'matter:manage']
};
const admissionSource = {
  owner: 'WORKSPACE_USER',
  kind: 'WORKSPACE_ADMISSION',
  sourceId: 'admission_m10-wp05',
  sourceVersion: '1',
  observedAt,
  freshness: 'CURRENT'
} as const;
const marketplaceSource = {
  owner: 'MARKETPLACE',
  kind: 'MARKETPLACE_LISTING',
  sourceId: 'listing_m10-wp05',
  sourceVersion: '1',
  observedAt,
  freshness: 'CURRENT'
} as const;

suite('PostgreSQL M10-WP-05 Trademark Asset Commerce Profile', () => {
  let runtime: ChildProcess | undefined;
  let baseUrl: string;
  async function request(
    assetId: TrademarkAssetId,
    body?: Record<string, unknown>,
    actor = principal,
    idempotencyKey = 'runtime-commerce-create'
  ) {
    const response = await fetch(
      `${baseUrl}/v1/trademark-assets/${assetId}${body ? '/commerce-profile' : ''}`,
      {
        method: body ? 'POST' : 'GET',
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': internalServiceSecret,
          'x-markorbit-principal': encodeInternalWorkspacePrincipal(actor),
          'x-markorbit-workspace-id': actor.workspaceId,
          'idempotency-key': idempotencyKey
        },
        ...(body ? { body: JSON.stringify(body) } : {})
      }
    );
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-trademark-asset-commerce-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_trademark_asset_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  const assetStore = () =>
    new PostgresLiteTrademarkAssetStore(
      database,
      database.getPool(),
      () => '2026-08-19T06:46:00.000Z'
    );
  const commerceStore = () =>
    new PostgresTrademarkAssetCommerceStore(
      database,
      database.getPool(),
      assetStore(),
      () => '2026-08-19T06:47:00.000Z',
      () => '00000000-0000-4000-8000-000000000505'
    );

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
      `INSERT INTO workspaces (workspace_id,name,slug)
       VALUES ($1,'Trademark Asset Commerce Test','trademark-asset-commerce-test')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceId]
    );
    runtime = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
      cwd: path.resolve('.'),
      windowsHide: true,
      env: {
        ...process.env,
        LITE_DATABASE_URL: url!,
        PORT: '0',
        MO_INTERNAL_SERVICE_SECRET: internalServiceSecret
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const child = runtime;
    baseUrl = await new Promise<string>((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error(`Lite startup timed out: ${output}`)), 15000);
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`Lite exited (${code}): ${output}`));
      });
      child.stderr?.on('data', (chunk) => {
        output += String(chunk);
      });
      child.stdout?.on('data', (chunk) => {
        output += String(chunk);
        const match = /listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(output);
        if (match) {
          clearTimeout(timer);
          resolve(match[1]!);
        }
      });
    });
  }, 20000);

  beforeEach(async () => {
    await database
      .getPool()
      .query(
        'TRUNCATE lite_trademark_asset_commerce_commands,lite_trademark_asset_commerce_profiles,lite_trademark_asset_commands,lite_trademark_asset_identifiers,lite_trademark_assets CASCADE'
      );
  });

  afterAll(async () => {
    if (runtime && runtime.exitCode === null && runtime.signalCode === null) {
      const exited = once(runtime, 'exit');
      runtime.kill();
      await exited;
    }
    await database.close();
  });

  it.each(['OWNED', 'MANAGED', 'REPRESENTED'] as const)(
    'serves durable Commerce read/create/update/replay for %s through main.ts',
    async (kind) => {
      const asset = await assetStore().admit({
        workspaceId,
        identity: { jurisdiction: 'US', markText: `RUNTIME ${kind}` },
        workspaceRelationships: [{ kind, sourceAssetEditableByWorkspace: false }],
        sourceReferences: [admissionSource],
        idempotencyKey: 'runtime-asset'
      });
      expect(await request(asset.trademarkAssetId)).toMatchObject({
        status: 200,
        body: { commerceProfile: null }
      });
      const input = {
        expectedTrademarkAssetVersion: asset.version,
        saleIntent: 'FOR_SALE',
        sellerRole: 'AUTHORIZED_REPRESENTATIVE',
        askingPrice: { amountMinor: 12300, currency: 'usd' },
        negotiable: true,
        saleTerritories: ['us'],
        headline: 'Runtime sale context',
        sellingPoints: ['Short name'],
        aiTags: ['short'],
        showcaseTemplateReference: 'showcase_1',
        mediaAssetReferences: ['media_1']
      };
      const created = await request(asset.trademarkAssetId, input);
      expect(created).toMatchObject({
        status: 200,
        body: {
          commerceProfile: {
            workspaceId,
            trademarkAssetId: asset.trademarkAssetId,
            version: 1,
            askingPrice: { amountMinor: 12300, currency: 'USD' },
            marketplaceListingCreatedByLite: false,
            sourceTrademarkFactsMutatedByLite: false
          }
        }
      });
      expect(await request(asset.trademarkAssetId, input)).toEqual(created);
      expect(await request(asset.trademarkAssetId)).toMatchObject(created);
      const updated = await request(
        asset.trademarkAssetId,
        {
          ...input,
          expectedCommerceProfileVersion: 1,
          headline: 'Updated'
        },
        principal,
        'runtime-update'
      );
      expect(updated).toMatchObject({
        status: 200,
        body: {
          commerceProfile: {
            version: 2,
            headline: 'Updated',
            marketplaceListingCreatedByLite: false,
            sourceTrademarkFactsMutatedByLite: false
          }
        }
      });
      expect(await commerceStore().get(workspaceId, asset.trademarkAssetId)).toEqual(
        updated.body.commerceProfile
      );
      expect(await request(asset.trademarkAssetId, input)).toEqual(created);
      for (const expectedCommerceProfileVersion of [undefined, 1]) {
        expect(
          await request(
            asset.trademarkAssetId,
            {
              ...input,
              expectedCommerceProfileVersion
            },
            principal,
            `stale-profile-${expectedCommerceProfileVersion}`
          )
        ).toMatchObject({ status: 409, body: { code: 'VERSION_CONFLICT' } });
      }
      expect(
        await request(
          asset.trademarkAssetId,
          {
            ...input,
            expectedTrademarkAssetVersion: asset.version + 1,
            expectedCommerceProfileVersion: 2
          },
          principal,
          'stale-asset'
        )
      ).toMatchObject({
        status: 409,
        body: { code: 'ASSET_VERSION_CONFLICT' }
      });
      expect(
        await request(asset.trademarkAssetId, { ...input, headline: 'Conflicting replay' })
      ).toMatchObject({ status: 409, body: { code: 'IDEMPOTENCY_CONFLICT' } });
      const otherWorkspace = { ...principal, workspaceId: '97979797-9797-4979-8979-979797979797' };
      expect(await request(asset.trademarkAssetId, undefined, otherWorkspace)).toMatchObject({
        status: 404
      });
      expect(await request(asset.trademarkAssetId, input, otherWorkspace)).toMatchObject({
        status: 404
      });
      expect(await assetStore().get(workspaceId, asset.trademarkAssetId)).toEqual(asset);
    }
  );

  it('creates and version-controls workspace-owned sale configuration without publishing a listing', async () => {
    const asset = await assetStore().admit({
      workspaceId,
      identity: { jurisdiction: 'US', markText: 'SELLABLE' },
      workspaceRelationships: [
        { kind: 'REPRESENTED', sourceAssetEditableByWorkspace: false },
        { kind: 'MANAGED', sourceAssetEditableByWorkspace: false }
      ],
      sourceReferences: [admissionSource],
      idempotencyKey: 'commerce-asset'
    });

    const created = await commerceStore().upsert({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      expectedTrademarkAssetVersion: asset.version,
      saleIntent: 'FOR_SALE',
      askingPrice: { amountMinor: 280000, currency: 'usd' },
      negotiable: true,
      saleTerritories: ['us', 'gb'],
      sellerRole: 'AUTHORIZED_REPRESENTATIVE',
      headline: 'Short ecommerce-ready mark',
      sellingPoints: ['Short name', 'Easy pronunciation'],
      aiTags: ['ecommerce', 'short-name'],
      showcaseTemplateReference: 'showcase_clean_1',
      mediaAssetReferences: ['display_artwork_1'],
      idempotencyKey: 'commerce-create-1'
    });

    expect(created).toMatchObject({
      version: 1,
      saleIntent: 'FOR_SALE',
      askingPrice: { amountMinor: 280000, currency: 'USD' },
      marketplaceListingCreatedByLite: false,
      sourceTrademarkFactsMutatedByLite: false
    });
    expect(created.saleTerritories).toEqual(['GB', 'US']);

    const replay = await commerceStore().upsert({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      expectedTrademarkAssetVersion: asset.version,
      saleIntent: 'FOR_SALE',
      askingPrice: { amountMinor: 280000, currency: 'usd' },
      negotiable: true,
      saleTerritories: ['us', 'gb'],
      sellerRole: 'AUTHORIZED_REPRESENTATIVE',
      headline: 'Short ecommerce-ready mark',
      sellingPoints: ['Short name', 'Easy pronunciation'],
      aiTags: ['ecommerce', 'short-name'],
      showcaseTemplateReference: 'showcase_clean_1',
      mediaAssetReferences: ['display_artwork_1'],
      idempotencyKey: 'commerce-create-1'
    });
    expect(replay).toEqual(created);

    const updated = await commerceStore().upsert({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      expectedTrademarkAssetVersion: asset.version,
      expectedCommerceProfileVersion: 1,
      saleIntent: 'FOR_SALE',
      askingPrice: { amountMinor: 300000, currency: 'USD' },
      negotiable: false,
      saleTerritories: ['US'],
      sellerRole: 'AUTHORIZED_REPRESENTATIVE',
      headline: 'Updated sale presentation',
      sellingPoints: ['Short name'],
      aiTags: ['ecommerce'],
      idempotencyKey: 'commerce-update-2'
    });
    expect(updated.version).toBe(2);
    expect(updated.commerceProfileId).toBe(created.commerceProfileId);
    expect(updated.marketplaceListingCreatedByLite).toBe(false);
  });

  it('rejects a source Commerce Profile for a Marketplace-only Asset reference', async () => {
    const marketplace = await assetStore().admit({
      workspaceId,
      identity: { jurisdiction: 'US', markText: 'MARKET SOURCE' },
      workspaceRelationships: [
        {
          kind: 'MARKETPLACE_ADDED',
          sourceAssetId: 'market_asset_505',
          sourceReference: marketplaceSource,
          sourceAssetEditableByWorkspace: false
        }
      ],
      sourceReferences: [admissionSource, marketplaceSource],
      idempotencyKey: 'marketplace-only-asset'
    });

    await expect(
      commerceStore().upsert({
        workspaceId,
        trademarkAssetId: marketplace.trademarkAssetId,
        expectedTrademarkAssetVersion: marketplace.version,
        saleIntent: 'FOR_SALE',
        sellerRole: 'AUTHORIZED_REPRESENTATIVE',
        idempotencyKey: 'marketplace-commerce-blocked'
      })
    ).rejects.toMatchObject({
      code: 'READ_ONLY_SOURCE',
      status: 403
    });
    expect(
      await request(marketplace.trademarkAssetId, {
        expectedTrademarkAssetVersion: marketplace.version,
        saleIntent: 'FOR_SALE',
        sellerRole: 'AUTHORIZED_REPRESENTATIVE'
      })
    ).toMatchObject({ status: 403, body: { code: 'READ_ONLY_SOURCE' } });
    expect(await request(marketplace.trademarkAssetId)).toMatchObject({
      status: 200,
      body: { commerceProfile: null }
    });
  });

  it('does not mutate Trademark Asset source identity or relationships when commerce data changes', async () => {
    const writer = assetStore();
    const asset = await writer.admit({
      workspaceId,
      identity: { jurisdiction: 'CN', markText: 'ORIGINAL MARK' },
      workspaceRelationships: [{ kind: 'OWNED', sourceAssetEditableByWorkspace: false }],
      sourceReferences: [admissionSource],
      workspaceTags: ['managed'],
      idempotencyKey: 'source-boundary-asset'
    });

    await commerceStore().upsert({
      workspaceId,
      trademarkAssetId: asset.trademarkAssetId,
      expectedTrademarkAssetVersion: asset.version,
      saleIntent: 'FOR_SALE',
      sellerRole: 'OWNER',
      headline: 'Display-only headline',
      mediaAssetReferences: ['ai_enhanced_display_artwork'],
      idempotencyKey: 'source-boundary-commerce'
    });

    const unchanged = await writer.get(workspaceId, asset.trademarkAssetId);
    expect(unchanged.version).toBe(asset.version);
    expect(unchanged.identity).toEqual(asset.identity);
    expect(unchanged.workspaceRelationships).toEqual(asset.workspaceRelationships);
  });
});
