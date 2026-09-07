import { describe, expect, it } from 'vitest';
import type {
  TradingCommercialDirectionId,
  TradingCommercialDirectionSetV1
} from '@markorbit/contracts/trading-commercial-direction';
import { noTradingDirectionAuthorityConsequencesV1 } from '@markorbit/contracts/trading-commercial-direction';
import { noTradingAiAuthorityConsequencesV1 } from '@markorbit/contracts/trading-ai-provenance';
import {
  tradingDirectionSelectionAuthorityConsequencesV1,
  type TradingDirectionSelectionV1
} from '@markorbit/contracts/trading-direction-selection';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from '../src/content-preparation.js';
import { PostgresTradingDirectionSelectionStore } from '../src/trading-direction-selection.js';

const workspaceId = '98989898-9898-4989-8989-989898989898';

function directionSet(): TradingCommercialDirectionSetV1 {
  const studioRun = { id: 'standard-studio-run_1' as const, version: 1 };
  const trademarkAsset = { id: 'trademark-asset_1' as const, version: 1 };
  const brandDna = { id: 'trading-ai-derived_brand-dna_1' as const, version: 1 };
  const directions = (['BEST_FIT', 'VALUE_UP', 'POSSIBILITY'] as const).map((role, index) => {
    const id = `trading-ai-derived_commercial-direction_${index}` as const;
    return {
      schemaVersion: 1 as const,
      commercialDirectionId: id,
      version: 1,
      role,
      studioRun,
      brandDna,
      title: role,
      summary: role,
      rationale: role,
      constraints: ['preserve mark'],
      status: 'CANDIDATE' as const,
      provenance: {
        schemaVersion: 1 as const,
        derivedObject: { id, version: 1 },
        truthClass: 'AI_CONCEPT' as const,
        trademarkAsset,
        sourceReferences: [
          { ownerReference: 'lite-trading', sourceId: studioRun.id, sourceVersion: 1 },
          { ownerReference: 'lite-trading', sourceId: brandDna.id, sourceVersion: 1 }
        ],
        implementation: {
          implementationProfileId: 'implementation-profile_direction' as const,
          implementationProfileVersion: 1,
          implementationKey: 'direction',
          provider: 'provider',
          model: 'model',
          promptPolicyId: 'prompt-policy_direction' as const,
          promptPolicyVersion: '1',
          outputSchemaId: 'direction-v1',
          inputSha256: 'a'.repeat(64),
          startedAt: '2026-09-07T00:00:00Z',
          completedAt: '2026-09-07T00:00:01Z'
        },
        createdAt: '2026-09-07T00:00:02Z',
        currentness: { state: 'CURRENT' as const, evaluatedAt: '2026-09-07T00:00:02Z' },
        authorityConsequences: noTradingAiAuthorityConsequencesV1
      },
      authorityConsequences: noTradingDirectionAuthorityConsequencesV1,
      createdAt: '2026-09-07T00:00:02Z'
    };
  });
  return {
    schemaVersion: 1,
    commercialDirectionSetId: 'commercial-direction-set_1',
    workspaceId,
    version: 1,
    studioRun,
    trademarkAsset,
    brandDna,
    directions: [directions[0]!, directions[1]!, directions[2]!],
    createdAt: '2026-09-07T00:00:03Z'
  };
}

function selection(): TradingDirectionSelectionV1 {
  return {
    schemaVersion: 1,
    directionSelectionId: 'trading-direction-selection_1',
    workspaceId,
    version: 1,
    status: 'CURRENT',
    directionSet: { id: 'commercial-direction-set_1', version: 1 },
    selectedDirection: { id: 'trading-ai-derived_commercial-direction_0', version: 1 },
    selectionMethod: 'EXPLICIT_HUMAN_ACTION',
    selectedAt: '2026-09-07T00:01:00Z',
    correlationId: 'correlation_selection-1',
    authorityConsequences: tradingDirectionSelectionAuthorityConsequencesV1
  };
}

function repository() {
  const set = directionSet();
  let saved: TradingDirectionSelectionV1 | undefined;
  let savedKey: string | undefined;
  let savedFingerprint: string | undefined;
  const query = (sql: string, values?: readonly unknown[]) => {
    if (sql.includes('pg_advisory_xact_lock')) return Promise.resolve({ rows: [] });
    if (sql.includes('idempotency_key=$2'))
      return Promise.resolve({
        rows:
          saved && values?.[1] === savedKey
            ? [{ request_fingerprint_sha256: savedFingerprint, document_json: saved }]
            : []
      });
    if (sql.includes('SELECT version FROM lite_trading_direction_selection_versions'))
      return Promise.resolve({ rows: saved ? [{ version: saved.version }] : [] });
    if (sql.includes('FROM lite_trading_direction_set_versions') && !sql.includes('JOIN'))
      return Promise.resolve({ rows: [{ document_json: set }] });
    if (sql.includes('INSERT INTO lite_trading_direction_selection_versions')) {
      saved = JSON.parse(String(values?.[10])) as TradingDirectionSelectionV1;
      savedKey = String(values?.[8]);
      savedFingerprint = String(values?.[9]);
      return Promise.resolve({ rows: [] });
    }
    if (sql.includes('JOIN lite_trading_direction_set_versions'))
      return Promise.resolve({
        rows: saved ? [{ selection_json: saved, direction_set_json: set }] : []
      });
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const database = {
    transact: (work: (client: { query: typeof query }) => unknown) => work({ query })
  };
  return new PostgresTradingDirectionSelectionStore(
    database as unknown as LiteTransactionHost,
    { query } as unknown as QueryClient,
    () => '2026-09-07T00:01:01Z'
  );
}

describe('Lite Trading explicit Direction Selection persistence', () => {
  it('saves, replays and reloads one exact human selection', async () => {
    const store = repository();
    const value = selection();
    const command = { selection: value, expectedVersion: 0, idempotencyKey: 'select-direction' };
    expect(await store.save(command)).toEqual(value);
    expect(await store.save(command)).toEqual(value);
    expect(await store.getLatest(workspaceId, value.directionSelectionId)).toEqual(value);
    expect(value.authorityConsequences.deepBuildStarted).toBe(false);
  });

  it('rejects a candidate outside the exact persisted Direction Set', async () => {
    await expect(
      repository().save({
        selection: {
          ...selection(),
          selectedDirection: {
            id: 'trading-ai-derived_commercial_direction_other' as TradingCommercialDirectionId,
            version: 1
          }
        },
        expectedVersion: 0,
        idempotencyKey: 'invalid-selection'
      })
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});
