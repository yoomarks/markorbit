import type { TradingAiProfileV1 } from '@markorbit/contracts/trading-ai-profile';
import type { TradingStudioRunV1 } from '@markorbit/contracts/trading-studio-run';
import type { TradingStandardStudioRunId } from '@markorbit/contracts/trading-studio-usage';
import type { PostgresTradingAiProfileStore } from './trading-ai-profile.js';
import type { TradingAiProfileGenerator } from './trading-ai-profile-generation.js';
import type { PostgresTradingStudioRunStore } from './trading-studio-run.js';
import type { PostgresLiteTrademarkAssetStore } from './trademark-asset.js';

export interface GenerateTradingAiProfileCheckpointCommand {
  workspaceId: string;
  studioRunId: TradingStandardStudioRunId;
  userBrief?: string;
  idempotencyKey: string;
  correlationId: string;
}

export interface TradingAiProfileCheckpointResult {
  run: Readonly<TradingStudioRunV1>;
  aiProfile: Readonly<TradingAiProfileV1>;
  replayed: boolean;
}

export class TradingAiProfileCheckpointError extends Error {
  constructor(
    readonly code: 'INVALID_RUN_STATE' | 'STALE_SOURCE',
    message: string
  ) {
    super(message);
    this.name = 'TradingAiProfileCheckpointError';
  }
}

export class TradingAiProfileCheckpointService {
  constructor(
    private readonly runs: Pick<PostgresTradingStudioRunStore, 'getLatest' | 'save'>,
    private readonly assets: Pick<PostgresLiteTrademarkAssetStore, 'get'>,
    private readonly profiles: Pick<PostgresTradingAiProfileStore, 'getExact' | 'save'>,
    private readonly generator: Pick<TradingAiProfileGenerator, 'generate'>
  ) {}

  async generate(
    command: Readonly<GenerateTradingAiProfileCheckpointCommand>
  ): Promise<TradingAiProfileCheckpointResult> {
    const run = await this.runs.getLatest(command.workspaceId, command.studioRunId);
    if (run.aiProfile) {
      return {
        run,
        aiProfile: await this.profiles.getExact(
          command.workspaceId,
          run.aiProfile.id,
          Number(run.aiProfile.version)
        ),
        replayed: true
      };
    }
    if (
      run.currentness !== 'CURRENT' ||
      !run.canResume ||
      run.checkpoint !== 'NONE' ||
      (run.status !== 'QUEUED' && run.status !== 'RUNNING')
    )
      throw new TradingAiProfileCheckpointError(
        'INVALID_RUN_STATE',
        'Studio Run cannot generate its AI Profile from the current checkpoint.'
      );

    const asset = await this.assets.get(command.workspaceId, run.trademarkAsset.id);
    if (asset.version !== run.trademarkAsset.version)
      throw new TradingAiProfileCheckpointError(
        'STALE_SOURCE',
        'Studio Run references a stale Trademark Asset version.'
      );

    const profileId =
      `trading-ai-derived_ai-profile_${run.studioRunId.slice('standard-studio-run_'.length)}` as const;
    const aiProfile = await this.generator.generate({
      workspaceId: command.workspaceId,
      studioRun: { id: run.studioRunId, version: run.version },
      trademarkAsset: asset,
      aiProfileId: profileId,
      version: 1,
      ...(command.userBrief === undefined ? {} : { userBrief: command.userBrief }),
      idempotencyKey: `${command.idempotencyKey}:managed-ai`,
      correlationId: command.correlationId
    });
    const savedProfile = await this.profiles.save({
      profile: aiProfile,
      expectedVersion: 0,
      idempotencyKey: `${command.idempotencyKey}:profile`
    });
    const advancedRun = await this.runs.save({
      run: {
        ...run,
        version: run.version + 1,
        status: 'RUNNING',
        checkpoint: 'AI_PROFILE',
        aiProfile: { id: savedProfile.aiProfileId, version: savedProfile.version },
        updatedAt: savedProfile.createdAt
      },
      expectedVersion: run.version,
      idempotencyKey: `${command.idempotencyKey}:run`
    });
    return { run: advancedRun, aiProfile: savedProfile, replayed: false };
  }
}
