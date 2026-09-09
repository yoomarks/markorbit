import type { AvatarProfileId, ClipArtifactId, MediaSourceRefV1, VoiceProfileId } from './media.js';
import type { TradingAiProfileId } from './trading-ai-profile.js';
import type { TradingCommercialDirectionId } from './trading-commercial-direction.js';

export type MediaPlanId = `media-plan_${string}`;
export type MediaShotId = `media-shot_${string}`;
export type MediaCommercialIntentRefV1 =
  | Readonly<{ kind: 'TRADING_AI_PROFILE'; profileId: TradingAiProfileId; version: number }>
  | Readonly<{
      kind: 'TRADING_COMMERCIAL_DIRECTION';
      commercialDirectionId: TradingCommercialDirectionId;
      version: number;
    }>;
export type MediaProfileRefV1 =
  | Readonly<{ kind: 'VOICE_PROFILE'; profileId: VoiceProfileId; version: number }>
  | Readonly<{ kind: 'AVATAR_PROFILE'; profileId: AvatarProfileId; version: number }>;

export interface MediaShotV1 {
  shotId: MediaShotId;
  semanticPurpose: string;
  shotType: 'AVATAR' | 'PRODUCT_ASSET' | 'SCREEN_DOCUMENT' | 'BROLL' | 'TEXT_TITLE';
  durationIntentMs: number;
  sourceRefs: readonly MediaSourceRefV1[];
  profileRefs: readonly MediaProfileRefV1[];
  reusableClip?: Readonly<{ clipArtifactId: ClipArtifactId; version: number }>;
  fulfillment: 'REUSE_REQUIRED' | 'REUSE_PREFERRED' | 'GENERATION_ALLOWED';
}
export interface MediaPlanV1 {
  schemaVersion: 1;
  mediaPlanId: MediaPlanId;
  version: number;
  workspaceId: string;
  purpose: string;
  audienceRefs: readonly string[];
  commercialIntentRefs: readonly MediaCommercialIntentRefV1[];
  shots: readonly MediaShotV1[];
  sequence: readonly MediaShotId[];
  reusePolicy: 'REUSE_FIRST_GENERATE_LAST';
  renderIntent: Readonly<{ aspectRatio: string; locale: string; targetDurationMs: number }>;
  constraints: readonly string[];
  evidenceRefs: readonly string[];
  createdAt: string;
  authority: Readonly<{
    renderStarted: false;
    artifactCreated: false;
    executionAuthorized: false;
    externalPublished: false;
    tradingTruthMutated: false;
  }>;
}

export class MediaPlanContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'MediaPlanContractError';
  }
}
function object(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new MediaPlanContractError(`${field} must be an object.`);
  return value as Record<string, unknown>;
}
function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string
): void {
  const supported = new Set(allowed);
  const extra = Object.keys(value).filter((key) => !supported.has(key));
  if (extra.length)
    throw new MediaPlanContractError(`${field} contains unsupported fields: ${extra.join(', ')}.`);
}
function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '')
    throw new MediaPlanContractError(`${field} must be a non-empty string.`);
  return value.trim();
}
function prefixed(value: unknown, field: string, prefix: string): string {
  const result = text(value, field);
  if (!result.startsWith(prefix)) throw new MediaPlanContractError(`${field} is invalid.`);
  return result;
}
function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1)
    throw new MediaPlanContractError(`${field} must be a positive safe integer.`);
  return value as number;
}
function strings(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value)) throw new MediaPlanContractError(`${field} must be an array.`);
  const result = value.map((part, index) => text(part, `${field}[${index}]`));
  if (new Set(result).size !== result.length)
    throw new MediaPlanContractError(`${field} must not contain duplicates.`);
  return result;
}
function sourceReference(value: unknown, field: string): MediaSourceRefV1 {
  const item = object(value, field);
  const kind = text(item.kind, `${field}.kind`);
  if (kind === 'VOICE_PROFILE' || kind === 'AVATAR_PROFILE') {
    exactKeys(item, ['kind', 'profileId', 'version'], field);
    const prefix = kind === 'VOICE_PROFILE' ? 'voice-profile_' : 'avatar-profile_';
    return {
      kind,
      profileId: prefixed(item.profileId, `${field}.profileId`, prefix) as never,
      version: positiveInteger(item.version, `${field}.version`)
    };
  }
  if (kind === 'AUDIO_ARTIFACT' || kind === 'CLIP_ARTIFACT' || kind === 'VIDEO_ARTIFACT') {
    exactKeys(item, ['kind', 'artifactId', 'version'], field);
    const prefix =
      kind === 'AUDIO_ARTIFACT'
        ? 'audio-artifact_'
        : kind === 'CLIP_ARTIFACT'
          ? 'clip-artifact_'
          : 'video-artifact_';
    return {
      kind,
      artifactId: prefixed(item.artifactId, `${field}.artifactId`, prefix) as never,
      version: positiveInteger(item.version, `${field}.version`)
    };
  }
  if (kind === 'ASSET' || kind === 'CONTENT') {
    exactKeys(item, ['kind', 'owner', 'referenceId', 'version'], field);
    return {
      kind,
      owner: text(item.owner, `${field}.owner`),
      referenceId: text(item.referenceId, `${field}.referenceId`),
      version: text(item.version, `${field}.version`)
    };
  }
  throw new MediaPlanContractError(`${field}.kind is invalid.`);
}
function profileReference(value: unknown, field: string): MediaProfileRefV1 {
  const item = object(value, field);
  exactKeys(item, ['kind', 'profileId', 'version'], field);
  if (item.kind !== 'VOICE_PROFILE' && item.kind !== 'AVATAR_PROFILE')
    throw new MediaPlanContractError(`${field}.kind is invalid.`);
  const prefix = item.kind === 'VOICE_PROFILE' ? 'voice-profile_' : 'avatar-profile_';
  return {
    kind: item.kind,
    profileId: prefixed(item.profileId, `${field}.profileId`, prefix) as never,
    version: positiveInteger(item.version, `${field}.version`)
  };
}
function commercialReference(value: unknown, field: string): MediaCommercialIntentRefV1 {
  const item = object(value, field);
  if (item.kind === 'TRADING_AI_PROFILE') {
    exactKeys(item, ['kind', 'profileId', 'version'], field);
    return {
      kind: item.kind,
      profileId: prefixed(
        item.profileId,
        `${field}.profileId`,
        'trading-ai-derived_ai-profile_'
      ) as TradingAiProfileId,
      version: positiveInteger(item.version, `${field}.version`)
    };
  }
  if (item.kind === 'TRADING_COMMERCIAL_DIRECTION') {
    exactKeys(item, ['kind', 'commercialDirectionId', 'version'], field);
    return {
      kind: item.kind,
      commercialDirectionId: prefixed(
        item.commercialDirectionId,
        `${field}.commercialDirectionId`,
        'trading-ai-derived_commercial_direction_'
      ) as TradingCommercialDirectionId,
      version: positiveInteger(item.version, `${field}.version`)
    };
  }
  throw new MediaPlanContractError(`${field}.kind is invalid.`);
}

export function parseMediaPlanV1(value: unknown): MediaPlanV1 {
  const item = object(value, 'mediaPlan');
  exactKeys(
    item,
    [
      'schemaVersion',
      'mediaPlanId',
      'version',
      'workspaceId',
      'purpose',
      'audienceRefs',
      'commercialIntentRefs',
      'shots',
      'sequence',
      'reusePolicy',
      'renderIntent',
      'constraints',
      'evidenceRefs',
      'createdAt',
      'authority'
    ],
    'mediaPlan'
  );
  if (item.schemaVersion !== 1) throw new MediaPlanContractError('schemaVersion must be 1.');
  if (item.reusePolicy !== 'REUSE_FIRST_GENERATE_LAST')
    throw new MediaPlanContractError('reusePolicy must be REUSE_FIRST_GENERATE_LAST.');
  if (!Array.isArray(item.shots) || item.shots.length === 0)
    throw new MediaPlanContractError('shots must be a non-empty array.');
  const shots = item.shots.map((value, index): MediaShotV1 => {
    const field = `shots[${index}]`;
    const shot = object(value, field);
    exactKeys(
      shot,
      [
        'shotId',
        'semanticPurpose',
        'shotType',
        'durationIntentMs',
        'sourceRefs',
        'profileRefs',
        'reusableClip',
        'fulfillment'
      ],
      field
    );
    if (
      !['AVATAR', 'PRODUCT_ASSET', 'SCREEN_DOCUMENT', 'BROLL', 'TEXT_TITLE'].includes(
        String(shot.shotType)
      )
    )
      throw new MediaPlanContractError(`${field}.shotType is invalid.`);
    if (
      !['REUSE_REQUIRED', 'REUSE_PREFERRED', 'GENERATION_ALLOWED'].includes(
        String(shot.fulfillment)
      )
    )
      throw new MediaPlanContractError(`${field}.fulfillment is invalid.`);
    const reusable =
      shot.reusableClip === undefined
        ? undefined
        : object(shot.reusableClip, `${field}.reusableClip`);
    if (shot.fulfillment === 'REUSE_REQUIRED' && !reusable)
      throw new MediaPlanContractError(`${field} requires a reusable ClipArtifact reference.`);
    if (reusable) exactKeys(reusable, ['clipArtifactId', 'version'], `${field}.reusableClip`);
    if (!Array.isArray(shot.sourceRefs) || !Array.isArray(shot.profileRefs))
      throw new MediaPlanContractError(`${field} references must be arrays.`);
    return {
      shotId: prefixed(shot.shotId, `${field}.shotId`, 'media-shot_') as MediaShotId,
      semanticPurpose: text(shot.semanticPurpose, `${field}.semanticPurpose`),
      shotType: shot.shotType as MediaShotV1['shotType'],
      durationIntentMs: positiveInteger(shot.durationIntentMs, `${field}.durationIntentMs`),
      sourceRefs: shot.sourceRefs.map((ref, i) =>
        sourceReference(ref, `${field}.sourceRefs[${i}]`)
      ),
      profileRefs: shot.profileRefs.map((ref, i) =>
        profileReference(ref, `${field}.profileRefs[${i}]`)
      ),
      ...(reusable
        ? {
            reusableClip: {
              clipArtifactId: prefixed(
                reusable.clipArtifactId,
                `${field}.reusableClip.clipArtifactId`,
                'clip-artifact_'
              ) as ClipArtifactId,
              version: positiveInteger(reusable.version, `${field}.reusableClip.version`)
            }
          }
        : {}),
      fulfillment: shot.fulfillment as MediaShotV1['fulfillment']
    };
  });
  const shotIds = shots.map(({ shotId }) => shotId);
  if (new Set(shotIds).size !== shotIds.length)
    throw new MediaPlanContractError('shot IDs must be unique.');
  const sequence = strings(item.sequence, 'sequence') as readonly MediaShotId[];
  if (sequence.length !== shotIds.length || sequence.some((id) => !shotIds.includes(id)))
    throw new MediaPlanContractError('sequence must reference every shot exactly once.');
  const render = object(item.renderIntent, 'renderIntent');
  exactKeys(render, ['aspectRatio', 'locale', 'targetDurationMs'], 'renderIntent');
  const authority = object(item.authority, 'authority');
  exactKeys(
    authority,
    [
      'renderStarted',
      'artifactCreated',
      'executionAuthorized',
      'externalPublished',
      'tradingTruthMutated'
    ],
    'authority'
  );
  if (Object.values(authority).some((claim) => claim !== false))
    throw new MediaPlanContractError('MediaPlan authority claims must all be false.');
  const createdAt = text(item.createdAt, 'createdAt');
  if (!Number.isFinite(Date.parse(createdAt)))
    throw new MediaPlanContractError('createdAt must be a timestamp.');
  if (!Array.isArray(item.commercialIntentRefs))
    throw new MediaPlanContractError('commercialIntentRefs must be an array.');
  return {
    schemaVersion: 1,
    mediaPlanId: prefixed(item.mediaPlanId, 'mediaPlanId', 'media-plan_') as MediaPlanId,
    version: positiveInteger(item.version, 'version'),
    workspaceId: text(item.workspaceId, 'workspaceId'),
    purpose: text(item.purpose, 'purpose'),
    audienceRefs: strings(item.audienceRefs, 'audienceRefs'),
    commercialIntentRefs: item.commercialIntentRefs.map((ref, i) =>
      commercialReference(ref, `commercialIntentRefs[${i}]`)
    ),
    shots,
    sequence,
    reusePolicy: 'REUSE_FIRST_GENERATE_LAST',
    renderIntent: {
      aspectRatio: text(render.aspectRatio, 'renderIntent.aspectRatio'),
      locale: text(render.locale, 'renderIntent.locale'),
      targetDurationMs: positiveInteger(render.targetDurationMs, 'renderIntent.targetDurationMs')
    },
    constraints: strings(item.constraints, 'constraints'),
    evidenceRefs: strings(item.evidenceRefs, 'evidenceRefs'),
    createdAt,
    authority: {
      renderStarted: false,
      artifactCreated: false,
      executionAuthorized: false,
      externalPublished: false,
      tradingTruthMutated: false
    }
  };
}
