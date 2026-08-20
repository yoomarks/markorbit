import { describe, expect, it } from 'vitest';
import type { TrademarkAssetRefreshRun } from '../src/trademark-asset-refresh.js';

describe('M11-WP02 refresh authority contract', () => {
  it('keeps refresh results non-authoritative for official truth and execution', () => {
    const result: TrademarkAssetRefreshRun = {
      schemaVersion: 1,
      refreshRunId: 'trademark-asset-refresh_test',
      workspaceId: '94949494-9494-4949-8949-949494949494',
      trademarkAssetId: 'trademark-asset_test',
      sourceOwnerScope: ['DATA_ENGINE'],
      observations: [],
      changes: [],
      refreshedAt: '2026-08-20T15:00:00.000Z',
      officialTruthVerifiedByLite: false,
      legalDeadlineCertified: false,
      conflictResolvedByLite: false,
      executionAuthorized: false
    };

    expect(result).toMatchObject({
      officialTruthVerifiedByLite: false,
      legalDeadlineCertified: false,
      conflictResolvedByLite: false,
      executionAuthorized: false
    });
  });
});
