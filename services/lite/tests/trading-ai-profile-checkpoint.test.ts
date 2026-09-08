import { describe, expect, it, vi } from 'vitest';
import type { TradingAiProfileV1 } from '@markorbit/contracts/trading-ai-profile';
import type { TradingStudioRunV1 } from '@markorbit/contracts/trading-studio-run';
import type { TrademarkAsset } from '@markorbit/contracts/trademark-asset-workspace';
import { TradingAiProfileCheckpointService } from '../src/trading-ai-profile-checkpoint.js';

const workspaceId = '98989898-9898-4989-8989-989898989898';
const baseRun: TradingStudioRunV1 = {
  schemaVersion: 1,
  studioRunId: 'standard-studio-run_1',
  workspaceId,
  version: 1,
  status: 'QUEUED',
  currentness: 'CURRENT',
  checkpoint: 'NONE',
  trademarkAsset: { id: 'trademark-asset_1', version: 2 },
  canResume: true,
  createdAt: '2026-09-08T00:00:00Z',
  updatedAt: '2026-09-08T00:00:00Z',
  authorityConsequences: {
    humanSelectionCreated: false,
    deepBuildStarted: false,
    listingCreated: false,
    trademarkTruthMutated: false
  }
};
const asset = {
  trademarkAssetId: 'trademark-asset_1',
  workspaceId,
  version: 2
} as unknown as TrademarkAsset;
const profile = {
  aiProfileId: 'trading-ai-derived_ai-profile_1',
  version: 1,
  createdAt: '2026-09-08T00:00:02Z'
} as unknown as TradingAiProfileV1;

function service(run = baseRun, source = asset) {
  const runs = {
    getLatest: vi.fn(() => Promise.resolve(run)),
    save: vi.fn((command: { run: TradingStudioRunV1 }) => Promise.resolve(command.run))
  };
  const assets = { get: vi.fn(() => Promise.resolve(source)) };
  const profiles = {
    getExact: vi.fn(() => Promise.resolve(profile)),
    save: vi.fn(() => Promise.resolve(profile))
  };
  const generator = { generate: vi.fn(() => Promise.resolve(profile)) };
  return {
    subject: new TradingAiProfileCheckpointService(runs, assets, profiles, generator),
    runs,
    assets,
    profiles,
    generator
  };
}

const command = {
  workspaceId,
  studioRunId: baseRun.studioRunId,
  userBrief: 'Let AI lead',
  idempotencyKey: 'run-1:ai-profile',
  correlationId: 'run-1'
};

describe('Trading AI Profile checkpoint', () => {
  it('persists the governed profile before advancing the resumable run', async () => {
    const value = service();
    const result = await value.subject.generate(command);
    expect(value.generator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        studioRun: { id: baseRun.studioRunId, version: 1 },
        trademarkAsset: asset,
        aiProfileId: 'trading-ai-derived_ai-profile_1',
        idempotencyKey: 'run-1:ai-profile:managed-ai'
      })
    );
    expect(value.profiles.save).toHaveBeenCalledWith({
      profile,
      expectedVersion: 0,
      idempotencyKey: 'run-1:ai-profile:profile'
    });
    expect(result).toMatchObject({
      replayed: false,
      run: {
        version: 2,
        status: 'RUNNING',
        checkpoint: 'AI_PROFILE',
        aiProfile: { id: profile.aiProfileId, version: 1 }
      }
    });
  });

  it('replays the exact saved profile without invoking Managed AI again', async () => {
    const run = {
      ...baseRun,
      version: 2,
      status: 'RUNNING' as const,
      checkpoint: 'AI_PROFILE' as const,
      aiProfile: { id: profile.aiProfileId, version: 1 }
    };
    const value = service(run);
    expect(await value.subject.generate(command)).toEqual({
      run,
      aiProfile: profile,
      replayed: true
    });
    expect(value.generator.generate).not.toHaveBeenCalled();
  });

  it('fails closed before generation when the exact source is stale', async () => {
    const value = service(baseRun, { ...asset, version: 3 });
    await expect(value.subject.generate(command)).rejects.toMatchObject({ code: 'STALE_SOURCE' });
    expect(value.generator.generate).not.toHaveBeenCalled();
  });
});
