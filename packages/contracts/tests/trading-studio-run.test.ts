import { describe, expect, it } from 'vitest';
import {
  assertTradingStudioRunV1,
  noTradingStudioRunAuthorityConsequencesV1,
  type TradingStudioRunV1
} from '../src/trading-studio-run.js';

const completedRun = (): TradingStudioRunV1 => ({
  schemaVersion: 1,
  studioRunId: 'standard-studio-run_1',
  workspaceId: 'workspace-1',
  version: 4,
  status: 'COMPLETED',
  currentness: 'CURRENT',
  checkpoint: 'COMMERCIAL_DIRECTIONS',
  trademarkAsset: { id: 'trademark-asset_1', version: 3 },
  aiProfile: { id: 'trading-ai-derived_ai-profile_1', version: 1 },
  brandDna: { id: 'trading-ai-derived_brand-dna_1', version: 1 },
  directionSet: { id: 'commercial-direction-set_1', version: 1 },
  canResume: false,
  createdAt: '2026-09-07T00:00:00Z',
  updatedAt: '2026-09-07T00:01:00Z',
  completedAt: '2026-09-07T00:01:00Z',
  authorityConsequences: noTradingStudioRunAuthorityConsequencesV1
});

describe('Lite Trading resumable Studio Run V1 contract', () => {
  it('restores a completed run with exact sequential artifact references', () => {
    expect(() => assertTradingStudioRunV1(completedRun())).not.toThrow();
  });

  it('allows a current failed run to resume from its last durable checkpoint', () => {
    const base = completedRun();
    delete base.directionSet;
    delete base.completedAt;
    const failed: TradingStudioRunV1 = {
      ...base,
      version: 3,
      status: 'FAILED',
      checkpoint: 'BRAND_DNA',
      failure: { code: 'PROVIDER_TIMEOUT', message: 'Generation timed out.', retryable: true },
      canResume: true
    };
    expect(() => assertTradingStudioRunV1(failed)).not.toThrow();
  });

  it('fails closed when source state is stale', () => {
    const base = completedRun();
    delete base.directionSet;
    delete base.completedAt;
    const stale: TradingStudioRunV1 = {
      ...base,
      version: 3,
      status: 'RUNNING',
      currentness: 'STALE',
      checkpoint: 'BRAND_DNA',
      canResume: false
    };
    expect(() => assertTradingStudioRunV1(stale)).not.toThrow();
    expect(() => assertTradingStudioRunV1({ ...stale, canResume: true })).toThrow(/stale/u);
  });

  it('rejects skipped checkpoints and false completion', () => {
    const skipped = completedRun();
    delete skipped.aiProfile;
    expect(() => assertTradingStudioRunV1(skipped)).toThrow(/sequential durable checkpoint/u);
    const falseCompletion = completedRun();
    falseCompletion.status = 'RUNNING';
    delete falseCompletion.completedAt;
    expect(() => assertTradingStudioRunV1(falseCompletion)).toThrow(/COMPLETED/u);
  });

  it('does not select a direction or start Deep Build', () => {
    expect(noTradingStudioRunAuthorityConsequencesV1).toEqual({
      humanSelectionCreated: false,
      deepBuildStarted: false,
      listingCreated: false,
      trademarkTruthMutated: false
    });
  });
});
