import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
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
const observedAt = '2026-08-19T01:00:00.000Z';

const admissionSource = {
  owner: 'WORKSPACE_USER',
  kind: 'WORKSPACE_ADMISSION',
  sourceId: 'admission_m10-wp02',
  sourceVersion: '1',
  observedAt,
  freshness: 'CURRENT'
} as const;
const dataSource = {
  owner: 'DATA_ENGINE',
  kind: 'DATA_ENGINE_TRADEMARK_RECORD',
  sourceId: 'record_m10-wp02',
  sourceVersion: '2026-08-19',
  observedAt,
  freshness: 'CURRENT'
} as const;
const marketplaceSource = {
  owner: 'MARKETPLACE',
  kind: 'MARKETPLACE_LISTING',
  sourceId: 'listing_m10-wp02',
  sourceVersion: '3',
  observedAt,
  freshness: 'CURRENT'
} as const;

suite('PostgreSQL M10-WP-02 Trademark Asset Anchor', () => {
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-trademark-asset-test',
    poolMaximum: 10,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_trademark_asset_test'
  });
  const migrationsDirectory = path.resolve('../../infrastructure/persistence/migrations');
  const migrationOwners = path.resolve('../../infrastructure/persistence/migration-owners.json');
  const store = () =>
    new PostgresLiteTrademarkAssetStore(
      database,
      database.getPool(),
      () => '2026-08-19T01:05:00.000Z'
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
      `INSERT INTO workspaces (workspace_id,name,slug) VALUES
       ($1,'Trademark Asset Test','trademark-asset-test'),
       ($2,'Trademark Asset Other','trademark-asset-other')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceId, otherWorkspaceId]
    );
  });

  beforeEach(async () => {
    await database
      .getPool()
      .query(
        'TRUNCATE lite_trademark_asset_commands,lite_trademark_asset_identifiers,lite_trademark_assets CASCADE'
      );
  });

  afterAll(() => database.close());

  it('keeps one stable Asset ID when a registration number is added later', async () => {
    const writer = store();
    const admitted = await writer.admit({
      workspaceId,
      identity: { jurisdiction: 'US', markText: 'MARKORBIT' },
      externalIdentifiers: [
        {
          kind: 'APPLICATION_NUMBER',
          jurisdiction: 'US',
          value: '98123456',
          sourceReference: dataSource,
          officialTruthVerifiedByLite: false
        }
      ],
      workspaceRelationships: [{ kind: 'MANAGED', sourceAssetEditableByWorkspace: false }],
      sourceReferences: [admissionSource, dataSource],
      workspaceTags: ['client-a'],
      idempotencyKey: 'admit-markorbit'
    });

    const updated = await writer.addExternalIdentifier({
      workspaceId,
      trademarkAssetId: admitted.trademarkAssetId,
      expectedVersion: admitted.version,
      identifier: {
        kind: 'REGISTRATION_NUMBER',
        jurisdiction: 'US',
        value: '7654321',
        sourceReference: dataSource,
        officialTruthVerifiedByLite: false
      },
      idempotencyKey: 'add-registration-number'
    });

    expect(updated.trademarkAssetId).toBe(admitted.trademarkAssetId);
    expect(updated.version).toBe(2);
    expect(updated.externalIdentifiers.map((identifier) => identifier.kind)).toEqual([
      'APPLICATION_NUMBER',
      'REGISTRATION_NUMBER'
    ]);
    expect(updated).not.toHaveProperty('sourceObservedStatus');
    expect(updated).not.toHaveProperty('registrationDate');

    const restartedReader = store();
    const afterRestart = await restartedReader.get(workspaceId, admitted.trademarkAssetId);
    expect(afterRestart).toEqual(updated);
  });

  it('allows pre-registration assets without application or registration numbers', async () => {
    const admitted = await store().admit({
      workspaceId,
      identity: { jurisdiction: 'EU', markText: 'EARLY BRAND' },
      workspaceRelationships: [{ kind: 'OWNED', sourceAssetEditableByWorkspace: false }],
      sourceReferences: [admissionSource],
      idempotencyKey: 'admit-pre-filing'
    });

    expect(admitted.externalIdentifiers).toEqual([]);
    expect(admitted.trademarkAssetId).toMatch(/^trademark-asset_/);
  });

  it('persists Marketplace references without granting mutation of the source asset', async () => {
    const admitted = await store().admit({
      workspaceId,
      identity: { jurisdiction: 'US', markText: 'SALEMARK' },
      externalIdentifiers: [
        {
          kind: 'REGISTRATION_NUMBER',
          jurisdiction: 'US',
          value: '7000001',
          sourceReference: marketplaceSource,
          officialTruthVerifiedByLite: false
        }
      ],
      workspaceRelationships: [
        {
          kind: 'MARKETPLACE_ADDED',
          sourceAssetId: 'marketplace-asset_sale-001',
          sourceReference: marketplaceSource,
          sourceAssetEditableByWorkspace: false
        }
      ],
      sourceReferences: [marketplaceSource],
      workspaceTags: ['sale-source'],
      idempotencyKey: 'admit-marketplace-reference'
    });

    expect(admitted.workspaceRelationships[0]).toMatchObject({
      kind: 'MARKETPLACE_ADDED',
      sourceAssetId: 'marketplace-asset_sale-001',
      sourceAssetEditableByWorkspace: false
    });
  });

  it('rejects any attempt to make a Marketplace source asset editable', async () => {
    await expect(
      store().admit({
        workspaceId,
        identity: { jurisdiction: 'US', markText: 'READONLY' },
        workspaceRelationships: [
          {
            kind: 'MARKETPLACE_ADDED',
            sourceAssetId: 'marketplace-asset_readonly',
            sourceReference: marketplaceSource,
            sourceAssetEditableByWorkspace: true
          }
        ],
        sourceReferences: [marketplaceSource],
        idempotencyKey: 'invalid-marketplace-mutation'
      })
    ).rejects.toMatchObject({
      code: 'READ_ONLY_SOURCE'
    });
  });

  it('isolates Asset Anchors by workspace', async () => {
    const admitted = await store().admit({
      workspaceId,
      identity: { jurisdiction: 'CN', markText: 'PRIVATE MARK' },
      workspaceRelationships: [{ kind: 'MANAGED', sourceAssetEditableByWorkspace: false }],
      sourceReferences: [admissionSource],
      idempotencyKey: 'workspace-one'
    });

    await expect(store().get(otherWorkspaceId, admitted.trademarkAssetId)).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });

  it('enforces workspace-scoped external identifier uniqueness', async () => {
    const first = await store().admit({
      workspaceId,
      identity: { jurisdiction: 'US', markText: 'FIRST' },
      externalIdentifiers: [
        {
          kind: 'APPLICATION_NUMBER',
          jurisdiction: 'US',
          value: '99000001',
          sourceReference: dataSource,
          officialTruthVerifiedByLite: false
        }
      ],
      workspaceRelationships: [{ kind: 'MANAGED', sourceAssetEditableByWorkspace: false }],
      sourceReferences: [admissionSource, dataSource],
      idempotencyKey: 'identifier-first'
    });
    expect(first.externalIdentifiers).toHaveLength(1);

    await expect(
      store().admit({
        workspaceId,
        identity: { jurisdiction: 'US', markText: 'SECOND' },
        externalIdentifiers: [
          {
            kind: 'APPLICATION_NUMBER',
            jurisdiction: 'US',
            value: '99000001',
            sourceReference: dataSource,
            officialTruthVerifiedByLite: false
          }
        ],
        workspaceRelationships: [{ kind: 'MANAGED', sourceAssetEditableByWorkspace: false }],
        sourceReferences: [admissionSource, dataSource],
        idempotencyKey: 'identifier-second'
      })
    ).rejects.toMatchObject({
      code: 'IDENTIFIER_CONFLICT'
    });
  });
});
