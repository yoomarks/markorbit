import { describe, expect, it } from 'vitest';
import type {
  TradingCommercialDirectionRole,
  TradingCommercialDirectionSetV1,
  TradingCommercialDirectionVersionV1
} from '@markorbit/contracts/trading-commercial-direction';
import { noTradingDirectionAuthorityConsequencesV1 } from '@markorbit/contracts/trading-commercial-direction';
import { noTradingAiAuthorityConsequencesV1 } from '@markorbit/contracts/trading-ai-provenance';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from '../src/content-preparation.js';
import { PostgresTradingDirectionSetStore } from '../src/trading-direction-set.js';

const workspaceId = '98989898-9898-4989-8989-989898989898';
const asset = { id: 'trademark-asset_1' as const, version: 1 };
const run = { id: 'standard-studio-run_1' as const, version: 1 };
const brandDna = { id: 'trading-ai-derived_brand-dna_1' as const, version: 1 };

function direction(
  role: TradingCommercialDirectionRole,
  suffix: string
): TradingCommercialDirectionVersionV1 {
  const id = `trading-ai-derived_commercial-direction_${suffix}` as const;
  return {
    schemaVersion: 1,
    commercialDirectionId: id,
    version: 1,
    role,
    studioRun: run,
    brandDna,
    title: role,
    summary: role,
    rationale: role,
    constraints: ['preserve mark'],
    status: 'CANDIDATE',
    provenance: {
      schemaVersion: 1,
      derivedObject: { id, version: 1 },
      truthClass: 'AI_CONCEPT',
      trademarkAsset: asset,
      sourceReferences: [
        { ownerReference: 'lite-trading', sourceId: run.id, sourceVersion: run.version },
        { ownerReference: 'lite-trading', sourceId: brandDna.id, sourceVersion: brandDna.version }
      ],
      implementation: {
        implementationProfileId: 'implementation-profile_direction',
        implementationProfileVersion: 1,
        implementationKey: 'direction',
        provider: 'provider',
        model: 'model',
        promptPolicyId: 'prompt-policy_direction',
        promptPolicyVersion: '1',
        outputSchemaId: 'direction-v1',
        inputSha256: 'a'.repeat(64),
        startedAt: '2026-09-07T00:00:00Z',
        completedAt: '2026-09-07T00:00:01Z'
      },
      createdAt: '2026-09-07T00:00:02Z',
      currentness: { state: 'CURRENT', evaluatedAt: '2026-09-07T00:00:02Z' },
      authorityConsequences: noTradingAiAuthorityConsequencesV1
    },
    authorityConsequences: noTradingDirectionAuthorityConsequencesV1,
    createdAt: '2026-09-07T00:00:02Z'
  };
}

function directionSet(): TradingCommercialDirectionSetV1 {
  return {
    schemaVersion: 1,
    commercialDirectionSetId: 'commercial-direction-set_1',
    workspaceId,
    version: 1,
    studioRun: run,
    trademarkAsset: asset,
    brandDna,
    directions: [
      direction('BEST_FIT', 'best'),
      direction('VALUE_UP', 'value'),
      direction('POSSIBILITY', 'possible')
    ],
    createdAt: '2026-09-07T00:00:03Z'
  };
}

function store(assetVersion = 1) {
  let saved: TradingCommercialDirectionSetV1 | undefined;
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
    if (sql.includes('SELECT version FROM lite_trading_direction_set_versions'))
      return Promise.resolve({ rows: saved ? [{ version: saved.version }] : [] });
    if (sql.includes('FROM lite_trading_studio_run_versions'))
      return Promise.resolve({
        rows: [{ trademark_asset_id: asset.id, document_json: { trademarkAsset: asset } }]
      });
    if (sql.includes('SELECT version FROM lite_trademark_assets'))
      return Promise.resolve({ rows: [{ version: assetVersion }] });
    if (sql.includes('INSERT INTO lite_trading_direction_set_versions')) {
      saved = JSON.parse(String(values?.[9])) as TradingCommercialDirectionSetV1;
      savedKey = String(values?.[7]);
      savedFingerprint = String(values?.[8]);
      return Promise.resolve({ rows: [] });
    }
    if (sql.includes('SELECT document_json FROM lite_trading_direction_set_versions'))
      return Promise.resolve({ rows: saved ? [{ document_json: saved }] : [] });
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const database = {
    transact: (work: (client: { query: typeof query }) => unknown) => work({ query })
  };
  return new PostgresTradingDirectionSetStore(
    database as unknown as LiteTransactionHost,
    { query } as unknown as QueryClient,
    () => '2026-09-07T00:00:04Z'
  );
}

describe('Lite Trading Direction Set persistence', () => {
  it('saves, replays and reloads the immutable set', async () => {
    const repository = store();
    const value = directionSet();
    const command = { directionSet: value, expectedVersion: 0, idempotencyKey: 'create-set' };
    expect(await repository.save(command)).toEqual(value);
    expect(await repository.save(command)).toEqual(value);
    expect(await repository.getLatest(workspaceId, value.commercialDirectionSetId)).toEqual(value);
    expect(
      await repository.getExact(workspaceId, value.commercialDirectionSetId, value.version)
    ).toEqual(value);
  });

  it('fails closed when the current Trademark Asset version changed', async () => {
    await expect(
      store(2).save({
        directionSet: directionSet(),
        expectedVersion: 0,
        idempotencyKey: 'stale-asset'
      })
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });

  it('persists only the explicitly targeted candidate refinement', async () => {
    const repository = store();
    const before = directionSet();
    await repository.save({
      directionSet: before,
      expectedVersion: 0,
      idempotencyKey: 'create-set'
    });
    const target = before.directions[0];
    const refined: TradingCommercialDirectionSetV1 = {
      ...before,
      version: 2,
      directions: [
        {
          ...target,
          version: 2,
          previousVersion: { id: target.commercialDirectionId, version: 1 },
          summary: 'Refined Best Fit.',
          provenance: {
            ...target.provenance,
            derivedObject: { id: target.commercialDirectionId, version: 2 }
          }
        },
        before.directions[1],
        before.directions[2]
      ],
      createdAt: '2026-09-07T00:01:00Z'
    };
    const command = {
      schemaVersion: 1 as const,
      directionSetId: before.commercialDirectionSetId,
      expectedDirectionSetVersion: 1,
      commercialDirectionId: target.commercialDirectionId,
      expectedDirectionVersion: 1,
      refinementBrief: 'Refine Best Fit.',
      idempotencyKey: 'refine-best-fit',
      correlationId: 'correlation_refine-best-fit' as const
    };
    await expect(
      repository.refine(command, {
        ...refined,
        directions: [
          refined.directions[0],
          { ...refined.directions[1], summary: 'Unexpected second change.' },
          refined.directions[2]
        ]
      })
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(await repository.refine(command, refined)).toEqual(refined);
  });
});
