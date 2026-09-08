import { describe, expect, it } from 'vitest';
import type { TradingAiProfileV1 } from '@markorbit/contracts/trading-ai-profile';
import { noTradingAiAuthorityConsequencesV1 } from '@markorbit/contracts/trading-ai-provenance';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from '../src/content-preparation.js';
import { PostgresTradingAiProfileStore } from '../src/trading-ai-profile.js';

const workspaceId = '98989898-9898-4989-8989-989898989898';

function profile(version = 1): TradingAiProfileV1 {
  const aiProfileId = 'trading-ai-derived_ai-profile_1' as const;
  const createdAt = '2026-09-08T00:00:02Z';
  return {
    schemaVersion: 1,
    aiProfileId,
    workspaceId,
    version,
    trademarkAsset: { id: 'trademark-asset_1', version: 1 },
    summary: 'A commercially focused AI understanding.',
    tags: [
      {
        aiTagId: 'trading-ai-tag_industry-1',
        category: 'INDUSTRY',
        label: 'Technology',
        rationale: 'The supplied context describes technology services.'
      }
    ],
    provenance: {
      schemaVersion: 1,
      derivedObject: { id: aiProfileId, version },
      truthClass: 'AI_INFERENCE',
      trademarkAsset: { id: 'trademark-asset_1', version: 1 },
      sourceReferences: [
        {
          ownerReference: 'lite-trademark-asset',
          sourceId: 'trademark-asset_1',
          sourceVersion: 1
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

function store(assetVersion = 1) {
  let saved: TradingAiProfileV1 | undefined;
  let savedFingerprint: string | undefined;
  let savedKey: string | undefined;
  const query = (sql: string, values?: readonly unknown[]) => {
    if (sql.includes('pg_advisory_xact_lock')) return Promise.resolve({ rows: [] });
    if (sql.includes('idempotency_key=$2'))
      return Promise.resolve({
        rows:
          saved && values?.[1] === savedKey
            ? [{ request_fingerprint_sha256: savedFingerprint, document_json: saved }]
            : []
      });
    if (sql.includes('SELECT version FROM lite_trading_ai_profile_versions'))
      return Promise.resolve({ rows: saved ? [{ version: saved.version }] : [] });
    if (sql.includes('SELECT version FROM lite_trademark_assets'))
      return Promise.resolve({ rows: [{ version: assetVersion }] });
    if (sql.includes('INSERT INTO lite_trading_ai_profile_versions')) {
      saved = JSON.parse(String(values?.[7])) as TradingAiProfileV1;
      savedKey = String(values?.[5]);
      savedFingerprint = String(values?.[6]);
      return Promise.resolve({ rows: [] });
    }
    if (sql.includes('SELECT document_json FROM lite_trading_ai_profile_versions'))
      return Promise.resolve({ rows: saved ? [{ document_json: saved }] : [] });
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const database = {
    transact: (work: (client: { query: typeof query }) => unknown) => work({ query })
  };
  return new PostgresTradingAiProfileStore(
    database as unknown as LiteTransactionHost,
    { query } as unknown as QueryClient,
    () => '2026-09-08T00:00:03Z'
  );
}

describe('Lite Trading AI Profile persistence', () => {
  it('saves, idempotently replays and reloads one exact profile version', async () => {
    const repository = store();
    const value = profile();
    const command = { profile: value, expectedVersion: 0, idempotencyKey: 'ai-profile-1' };
    expect(await repository.save(command)).toEqual(value);
    expect(await repository.save(command)).toEqual(value);
    expect(await repository.getExact(workspaceId, value.aiProfileId, 1)).toEqual(value);
  });

  it('rejects stale source truth and stale profile versions', async () => {
    await expect(
      store(2).save({ profile: profile(), expectedVersion: 0, idempotencyKey: 'stale-source' })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    const repository = store();
    await repository.save({ profile: profile(), expectedVersion: 0, idempotencyKey: 'first' });
    await expect(
      repository.save({ profile: profile(), expectedVersion: 0, idempotencyKey: 'stale-profile' })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });

  it('rejects changed payload reuse and invalid AI authority semantics', async () => {
    const repository = store();
    await repository.save({ profile: profile(), expectedVersion: 0, idempotencyKey: 'same-key' });
    await expect(
      repository.save({
        profile: { ...profile(), summary: 'Changed' },
        expectedVersion: 0,
        idempotencyKey: 'same-key'
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    await expect(
      repository.save({
        profile: {
          ...profile(),
          provenance: { ...profile().provenance, truthClass: 'AI_CONCEPT' }
        },
        expectedVersion: 0,
        idempotencyKey: 'wrong-truth-class'
      })
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});
