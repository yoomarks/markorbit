import { describe, expect, it } from 'vitest';
import type { TradingBrandDnaV1 } from '@markorbit/contracts/trading-brand-dna';
import { noTradingAiAuthorityConsequencesV1 } from '@markorbit/contracts/trading-ai-provenance';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from '../src/content-preparation.js';
import { PostgresTradingBrandDnaStore } from '../src/trading-brand-dna.js';

const workspaceId = '98989898-9898-4989-8989-989898989898';
const asset = { id: 'trademark-asset_1' as const, version: 1 };
const profile = { id: 'trading-ai-derived_ai-profile_1' as const, version: 1 };
const run = { id: 'standard-studio-run_1' as const, version: 2 };

function value(): TradingBrandDnaV1 {
  const brandDnaId = 'trading-ai-derived_brand-dna_1' as const;
  const createdAt = '2026-09-08T01:00:00Z';
  return {
    schemaVersion: 1,
    brandDnaId,
    workspaceId,
    version: 1,
    studioRun: run,
    trademarkAsset: asset,
    aiProfile: profile,
    personality: ['Confident'],
    targetAudience: ['Founders'],
    positioning: ['Premium'],
    industry: ['Technology'],
    visualDirection: ['Orbital'],
    brandPromise: 'Clarity in motion.',
    emotionalTone: ['Optimistic'],
    colorTendencies: ['Blue'],
    typographyTendencies: ['Geometric'],
    visualLanguage: ['Minimal'],
    channelStrategy: ['Digital'],
    ipPotential: { summary: 'Expandable', rationale: 'Distinct system.' },
    benchmarkCapabilities: ['Recognition'],
    constraints: ['Do not imply legal scope.'],
    provenance: {
      schemaVersion: 1,
      derivedObject: { id: brandDnaId, version: 1 },
      truthClass: 'AI_INFERENCE',
      trademarkAsset: asset,
      sourceReferences: [
        { ownerReference: 'lite-ai-profile', sourceId: profile.id, sourceVersion: profile.version },
        { ownerReference: 'lite-studio-run', sourceId: run.id, sourceVersion: run.version }
      ],
      implementation: {
        implementationProfileId: 'implementation-profile_brand-dna',
        implementationProfileVersion: 1,
        implementationKey: 'orbit-studio/brand-dna',
        provider: 'provider',
        model: 'model',
        promptPolicyId: 'prompt-policy_brand-dna',
        promptPolicyVersion: '1',
        outputSchemaId: 'trading-brand-dna-v1',
        inputSha256: 'b'.repeat(64),
        startedAt: '2026-09-08T00:59:58Z',
        completedAt: '2026-09-08T00:59:59Z'
      },
      createdAt,
      currentness: { state: 'CURRENT', evaluatedAt: createdAt },
      authorityConsequences: noTradingAiAuthorityConsequencesV1
    },
    createdAt
  };
}

function store(assetVersion = 1) {
  let saved: TradingBrandDnaV1 | undefined;
  let fingerprint: unknown;
  const query = async (sql: string, values?: readonly unknown[]) => {
    await Promise.resolve();
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
    if (sql.includes('idempotency_key=$2'))
      return {
        rows: saved ? [{ request_fingerprint_sha256: fingerprint, document_json: saved }] : []
      };
    if (sql.includes('SELECT version FROM lite_trading_brand_dna_versions'))
      return { rows: saved ? [{ version: 1 }] : [] };
    if (sql.includes('SELECT a.version AS asset_version'))
      return {
        rows: [
          {
            asset_version: assetVersion,
            profile_json: { trademarkAsset: asset },
            run_json: { trademarkAsset: asset, aiProfile: profile }
          }
        ]
      };
    if (sql.includes('INSERT INTO lite_trading_brand_dna_versions')) {
      saved = JSON.parse(String(values?.[11])) as TradingBrandDnaV1;
      fingerprint = values?.[10];
      return { rows: [] };
    }
    if (sql.includes('SELECT document_json FROM lite_trading_brand_dna_versions'))
      return { rows: saved ? [{ document_json: saved }] : [] };
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const database = {
    transact: (work: (client: { query: typeof query }) => unknown) => work({ query })
  };
  return new PostgresTradingBrandDnaStore(
    database as unknown as LiteTransactionHost,
    { query } as unknown as QueryClient
  );
}

describe('Lite Trading BrandDNA persistence', () => {
  it('saves, replays and reloads one exact version', async () => {
    const repository = store();
    const command = { brandDna: value(), expectedVersion: 0, idempotencyKey: 'brand-dna-1' };
    expect(await repository.save(command)).toEqual(value());
    expect(await repository.save(command)).toEqual(value());
    expect(await repository.getExact(workspaceId, value().brandDnaId, 1)).toEqual(value());
  });

  it('rejects a stale Trademark Asset source', async () => {
    await expect(
      store(2).save({ brandDna: value(), expectedVersion: 0, idempotencyKey: 'stale' })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });
});
