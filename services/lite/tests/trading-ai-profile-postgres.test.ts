import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TradingAiProfileV1 } from '@markorbit/contracts/trading-ai-profile';
import { noTradingAiAuthorityConsequencesV1 } from '@markorbit/contracts/trading-ai-provenance';
import { ManagedDatabase, loadMigrationsForOwner, migrate } from '@markorbit/persistence';
import { PostgresTradingAiProfileStore } from '../src/trading-ai-profile.js';
import { PostgresLiteTrademarkAssetStore } from '../src/trademark-asset.js';

const url = process.env.LITE_TRADEMARK_ASSET_TEST_DATABASE_URL;
const required = process.env.LITE_TRADEMARK_ASSET_POSTGRES_TEST_REQUIRED === '1';
if (required && !url)
  throw new Error('LITE_TRADEMARK_ASSET_TEST_DATABASE_URL is required for PostgreSQL tests.');
const suite = url ? describe : describe.skip;
const workspaceId = '97979797-9797-4979-8979-979797979797';

suite('PostgreSQL Lite Trading AI Profile persistence', () => {
  let tick = 0;
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: 'lite-trading-ai-profile-test',
    poolMaximum: 6,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: 'lite_trademark_asset_test'
  });
  const now = () => new Date(Date.UTC(2026, 8, 8, 0, 0, tick++)).toISOString();
  const profiles = () => new PostgresTradingAiProfileStore(database, database.getPool(), now);

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
      `INSERT INTO workspaces(workspace_id,name,slug) VALUES($1,'AI Profile','ai-profile')
       ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceId]
    );
  });

  beforeEach(async () => {
    tick = 0;
    await database
      .getPool()
      .query(
        'TRUNCATE lite_trading_ai_profile_versions,lite_trademark_asset_commands,lite_trademark_assets CASCADE'
      );
  });
  afterAll(() => database.close());

  async function profile(): Promise<TradingAiProfileV1> {
    const asset = await new PostgresLiteTrademarkAssetStore(
      database,
      database.getPool(),
      now
    ).admit({
      workspaceId,
      identity: { jurisdiction: 'US', markText: 'ORBIT' },
      workspaceRelationships: [{ kind: 'OWNED', sourceAssetEditableByWorkspace: true }],
      sourceReferences: [
        {
          owner: 'WORKSPACE_USER',
          kind: 'WORKSPACE_ADMISSION',
          sourceId: 'admission_ai-profile',
          sourceVersion: '1',
          observedAt: '2026-09-08T00:00:00Z',
          freshness: 'CURRENT'
        }
      ],
      idempotencyKey: 'admit-ai-profile'
    });
    const aiProfileId = 'trading-ai-derived_ai-profile_1' as const;
    const createdAt = '2026-09-08T00:00:02Z';
    return {
      schemaVersion: 1,
      aiProfileId,
      workspaceId,
      version: 1,
      trademarkAsset: { id: asset.trademarkAssetId, version: asset.version },
      summary: 'A commercially focused AI understanding.',
      tags: [],
      provenance: {
        schemaVersion: 1,
        derivedObject: { id: aiProfileId, version: 1 },
        truthClass: 'AI_INFERENCE',
        trademarkAsset: { id: asset.trademarkAssetId, version: asset.version },
        sourceReferences: [
          {
            ownerReference: 'lite-trademark-asset',
            sourceId: asset.trademarkAssetId,
            sourceVersion: asset.version
          }
        ],
        implementation: {
          implementationProfileId: 'implementation-profile_ai-profile',
          implementationProfileVersion: 1,
          implementationKey: 'orbit-studio/ai-profile',
          provider: 'provider',
          model: 'model',
          promptPolicyId: 'prompt-policy_ai-profile',
          promptPolicyVersion: '1',
          outputSchemaId: 'trading-ai-profile-v1',
          inputSha256: 'a'.repeat(64),
          startedAt: '2026-09-08T00:00:00Z',
          completedAt: '2026-09-08T00:00:01Z'
        },
        createdAt,
        currentness: { state: 'CURRENT', evaluatedAt: createdAt },
        authorityConsequences: noTradingAiAuthorityConsequencesV1
      },
      createdAt
    };
  }

  it('replays a save and restores the exact profile after restart', async () => {
    const value = await profile();
    const command = { profile: value, expectedVersion: 0, idempotencyKey: 'save-profile-1' };
    expect(await profiles().save(command)).toEqual(value);
    expect(await profiles().save(command)).toEqual(value);
    expect(await profiles().getExact(workspaceId, value.aiProfileId, value.version)).toEqual(value);
  });
});
