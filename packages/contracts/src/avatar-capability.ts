import type { AudioArtifactId, AvatarProfileId, ClipArtifactId } from './media.js';
import type { MediaRightsBindingId } from './media-rights.js';

export const AVATAR_RENDER_SPEECH_CAPABILITY_ID = 'avatar.renderSpeech' as const;
export const AVATAR_RENDER_EXPRESSION_CAPABILITY_ID = 'avatar.renderExpression' as const;
export const AVATAR_CAPABILITY_CONTRACT_VERSION = '1.0.0' as const;
export const AVATAR_STREAM_CAPABILITY_STATE = 'FUTURE_UNAVAILABLE' as const;

export interface AvatarProfileRefV1 {
  avatarProfileId: AvatarProfileId;
  version: number;
}
export interface AvatarRightsPreconditionV1 {
  mediaRightsBindingId: MediaRightsBindingId;
  bindingVersion: number;
  purpose: string;
  territory: string;
  currentEligibilityAssessmentRequired: true;
}
interface AvatarRenderInputBaseV1 {
  schemaVersion: 1;
  capabilityVersion: typeof AVATAR_CAPABILITY_CONTRACT_VERSION;
  workspaceId: string;
  avatarProfile: Readonly<AvatarProfileRefV1>;
  rights: Readonly<AvatarRightsPreconditionV1>;
  outputMimeType: string;
}
export interface AvatarRenderSpeechInputV1 extends AvatarRenderInputBaseV1 {
  capabilityId: typeof AVATAR_RENDER_SPEECH_CAPABILITY_ID;
  audioArtifact: Readonly<{ audioArtifactId: AudioArtifactId; version: number }>;
}
export interface AvatarRenderExpressionInputV1 extends AvatarRenderInputBaseV1 {
  capabilityId: typeof AVATAR_RENDER_EXPRESSION_CAPABILITY_ID;
  expressionIntent: string;
  durationMs: number;
}
export type AvatarRenderInputV1 = AvatarRenderSpeechInputV1 | AvatarRenderExpressionInputV1;

export interface AvatarRenderOutcomeV1 {
  schemaVersion: 1;
  capabilityId:
    typeof AVATAR_RENDER_SPEECH_CAPABILITY_ID | typeof AVATAR_RENDER_EXPRESSION_CAPABILITY_ID;
  capabilityVersion: typeof AVATAR_CAPABILITY_CONTRACT_VERSION;
  status: 'COMPLETED' | 'FAILED' | 'RIGHTS_REVIEW_REQUIRED';
  clipArtifact?: Readonly<{ clipArtifactId: ClipArtifactId; version: number }>;
  capabilityInvocationId: `capability-invocation_${string}`;
  capabilityOutcomeId: `capability-outcome_${string}`;
  evidenceRefs: readonly string[];
  createsExecutionAuthority: false;
}

export class AvatarCapabilityContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'AvatarCapabilityContractError';
  }
}
function object(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new AvatarCapabilityContractError(`${field} must be an object.`);
  return value as Record<string, unknown>;
}
function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string
): void {
  const supported = new Set(allowed);
  const unsupported = Object.keys(value).filter((key) => !supported.has(key));
  if (unsupported.length)
    throw new AvatarCapabilityContractError(
      `${field} contains unsupported fields: ${unsupported.join(', ')}.`
    );
}
function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '')
    throw new AvatarCapabilityContractError(`${field} must be a non-empty string.`);
  return value.trim();
}
function prefixed(value: unknown, field: string, prefix: string): string {
  const result = text(value, field);
  if (!result.startsWith(prefix)) throw new AvatarCapabilityContractError(`${field} is invalid.`);
  return result;
}
function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1)
    throw new AvatarCapabilityContractError(`${field} must be a positive safe integer.`);
  return value as number;
}
function strings(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value)) throw new AvatarCapabilityContractError(`${field} must be an array.`);
  const result = value.map((item, index) => text(item, `${field}[${index}]`));
  if (new Set(result).size !== result.length)
    throw new AvatarCapabilityContractError(`${field} must not contain duplicates.`);
  return result;
}
function capabilityId(value: unknown): AvatarRenderOutcomeV1['capabilityId'] {
  if (
    value !== AVATAR_RENDER_SPEECH_CAPABILITY_ID &&
    value !== AVATAR_RENDER_EXPRESSION_CAPABILITY_ID
  )
    throw new AvatarCapabilityContractError('capabilityId is invalid.');
  return value;
}
function commonInput(item: Record<string, unknown>) {
  if (item.schemaVersion !== 1) throw new AvatarCapabilityContractError('schemaVersion must be 1.');
  if (item.capabilityVersion !== AVATAR_CAPABILITY_CONTRACT_VERSION)
    throw new AvatarCapabilityContractError('capabilityVersion is invalid.');
  const profile = object(item.avatarProfile, 'avatarProfile');
  exactKeys(profile, ['avatarProfileId', 'version'], 'avatarProfile');
  const rights = object(item.rights, 'rights');
  exactKeys(
    rights,
    [
      'mediaRightsBindingId',
      'bindingVersion',
      'purpose',
      'territory',
      'currentEligibilityAssessmentRequired'
    ],
    'rights'
  );
  if (rights.currentEligibilityAssessmentRequired !== true)
    throw new AvatarCapabilityContractError(
      'rights must require a current eligibility assessment.'
    );
  return {
    schemaVersion: 1 as const,
    capabilityVersion: AVATAR_CAPABILITY_CONTRACT_VERSION,
    workspaceId: text(item.workspaceId, 'workspaceId'),
    avatarProfile: {
      avatarProfileId: prefixed(
        profile.avatarProfileId,
        'avatarProfile.avatarProfileId',
        'avatar-profile_'
      ) as AvatarProfileId,
      version: positiveInteger(profile.version, 'avatarProfile.version')
    },
    rights: {
      mediaRightsBindingId: prefixed(
        rights.mediaRightsBindingId,
        'rights.mediaRightsBindingId',
        'media-rights-binding_'
      ) as MediaRightsBindingId,
      bindingVersion: positiveInteger(rights.bindingVersion, 'rights.bindingVersion'),
      purpose: text(rights.purpose, 'rights.purpose'),
      territory: text(rights.territory, 'rights.territory'),
      currentEligibilityAssessmentRequired: true as const
    },
    outputMimeType: text(item.outputMimeType, 'outputMimeType')
  };
}

export function parseAvatarRenderInputV1(value: unknown): AvatarRenderInputV1 {
  const item = object(value, 'avatarRenderInput');
  const id = capabilityId(item.capabilityId);
  const shared = [
    'schemaVersion',
    'capabilityId',
    'capabilityVersion',
    'workspaceId',
    'avatarProfile',
    'rights',
    'outputMimeType'
  ];
  if (id === AVATAR_RENDER_SPEECH_CAPABILITY_ID) {
    exactKeys(item, [...shared, 'audioArtifact'], 'avatarRenderInput');
    const audio = object(item.audioArtifact, 'audioArtifact');
    exactKeys(audio, ['audioArtifactId', 'version'], 'audioArtifact');
    return {
      ...commonInput(item),
      capabilityId: id,
      audioArtifact: {
        audioArtifactId: prefixed(
          audio.audioArtifactId,
          'audioArtifact.audioArtifactId',
          'audio-artifact_'
        ) as AudioArtifactId,
        version: positiveInteger(audio.version, 'audioArtifact.version')
      }
    };
  }
  exactKeys(item, [...shared, 'expressionIntent', 'durationMs'], 'avatarRenderInput');
  return {
    ...commonInput(item),
    capabilityId: id,
    expressionIntent: text(item.expressionIntent, 'expressionIntent'),
    durationMs: positiveInteger(item.durationMs, 'durationMs')
  };
}

export function parseAvatarRenderOutcomeV1(value: unknown): AvatarRenderOutcomeV1 {
  const item = object(value, 'avatarRenderOutcome');
  exactKeys(
    item,
    [
      'schemaVersion',
      'capabilityId',
      'capabilityVersion',
      'status',
      'clipArtifact',
      'capabilityInvocationId',
      'capabilityOutcomeId',
      'evidenceRefs',
      'createsExecutionAuthority'
    ],
    'avatarRenderOutcome'
  );
  if (item.schemaVersion !== 1 || item.capabilityVersion !== AVATAR_CAPABILITY_CONTRACT_VERSION)
    throw new AvatarCapabilityContractError('Avatar outcome contract identity is invalid.');
  if (!['COMPLETED', 'FAILED', 'RIGHTS_REVIEW_REQUIRED'].includes(String(item.status)))
    throw new AvatarCapabilityContractError('status is invalid.');
  if (item.createsExecutionAuthority !== false)
    throw new AvatarCapabilityContractError('createsExecutionAuthority must be false.');
  const clip =
    item.clipArtifact === undefined ? undefined : object(item.clipArtifact, 'clipArtifact');
  if (item.status === 'COMPLETED' && !clip)
    throw new AvatarCapabilityContractError('COMPLETED outcome requires a ClipArtifact reference.');
  if (item.status !== 'COMPLETED' && clip)
    throw new AvatarCapabilityContractError('Non-completed outcome cannot claim a ClipArtifact.');
  if (clip) exactKeys(clip, ['clipArtifactId', 'version'], 'clipArtifact');
  return {
    schemaVersion: 1,
    capabilityId: capabilityId(item.capabilityId),
    capabilityVersion: AVATAR_CAPABILITY_CONTRACT_VERSION,
    status: item.status as AvatarRenderOutcomeV1['status'],
    ...(clip
      ? {
          clipArtifact: {
            clipArtifactId: prefixed(
              clip.clipArtifactId,
              'clipArtifact.clipArtifactId',
              'clip-artifact_'
            ) as ClipArtifactId,
            version: positiveInteger(clip.version, 'clipArtifact.version')
          }
        }
      : {}),
    capabilityInvocationId: prefixed(
      item.capabilityInvocationId,
      'capabilityInvocationId',
      'capability-invocation_'
    ) as AvatarRenderOutcomeV1['capabilityInvocationId'],
    capabilityOutcomeId: prefixed(
      item.capabilityOutcomeId,
      'capabilityOutcomeId',
      'capability-outcome_'
    ) as AvatarRenderOutcomeV1['capabilityOutcomeId'],
    evidenceRefs: strings(item.evidenceRefs, 'evidenceRefs'),
    createsExecutionAuthority: false
  };
}
