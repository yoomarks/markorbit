import type { AudioArtifactId, VoiceProfileId } from './media.js';
import type { MediaRightsBindingId } from './media-rights.js';

export const VOICE_SYNTHESIZE_CAPABILITY_ID = 'voice.synthesize' as const;
export const VOICE_CAPABILITY_CONTRACT_VERSION = '1.0.0' as const;
export const VOICE_CLONE_CAPABILITY_STATE = 'GATED_UNAVAILABLE' as const;

export interface VoiceProfileRefV1 {
  voiceProfileId: VoiceProfileId;
  version: number;
}

export type VoiceSynthesisSourceV1 =
  | Readonly<{ kind: 'TEXT'; text: string }>
  | Readonly<{ kind: 'CONTENT_REF'; owner: string; contentRef: string; version: string }>;

export interface VoiceSynthesisRightsPreconditionV1 {
  mediaRightsBindingId: MediaRightsBindingId;
  bindingVersion: number;
  purpose: string;
  territory: string;
  currentEligibilityAssessmentRequired: true;
}

export interface VoiceSynthesisInputV1 {
  schemaVersion: 1;
  capabilityId: typeof VOICE_SYNTHESIZE_CAPABILITY_ID;
  capabilityVersion: typeof VOICE_CAPABILITY_CONTRACT_VERSION;
  workspaceId: string;
  voiceProfile: Readonly<VoiceProfileRefV1>;
  source: VoiceSynthesisSourceV1;
  locale: string;
  outputMimeType: string;
  rights: Readonly<VoiceSynthesisRightsPreconditionV1>;
}

export interface VoiceSynthesisOutcomeV1 {
  schemaVersion: 1;
  capabilityId: typeof VOICE_SYNTHESIZE_CAPABILITY_ID;
  capabilityVersion: typeof VOICE_CAPABILITY_CONTRACT_VERSION;
  status: 'COMPLETED' | 'FAILED' | 'RIGHTS_REVIEW_REQUIRED';
  audioArtifact?: Readonly<{ audioArtifactId: AudioArtifactId; version: number }>;
  capabilityInvocationId: `capability-invocation_${string}`;
  capabilityOutcomeId: `capability-outcome_${string}`;
  evidenceRefs: readonly string[];
  createsExecutionAuthority: false;
}

export class VoiceCapabilityContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'VoiceCapabilityContractError';
  }
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new VoiceCapabilityContractError(`${field} must be an object.`);
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
    throw new VoiceCapabilityContractError(
      `${field} contains unsupported fields: ${unsupported.join(', ')}.`
    );
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '')
    throw new VoiceCapabilityContractError(`${field} must be a non-empty string.`);
  return value.trim();
}

function prefixed(value: unknown, field: string, prefix: string): string {
  const result = text(value, field);
  if (!result.startsWith(prefix)) throw new VoiceCapabilityContractError(`${field} is invalid.`);
  return result;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1)
    throw new VoiceCapabilityContractError(`${field} must be a positive safe integer.`);
  return value as number;
}

function strings(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value)) throw new VoiceCapabilityContractError(`${field} must be an array.`);
  const result = value.map((item, index) => text(item, `${field}[${index}]`));
  if (new Set(result).size !== result.length)
    throw new VoiceCapabilityContractError(`${field} must not contain duplicates.`);
  return result;
}

function assertIdentity(value: Record<string, unknown>): void {
  if (value.schemaVersion !== 1) throw new VoiceCapabilityContractError('schemaVersion must be 1.');
  if (value.capabilityId !== VOICE_SYNTHESIZE_CAPABILITY_ID)
    throw new VoiceCapabilityContractError('capabilityId is invalid.');
  if (value.capabilityVersion !== VOICE_CAPABILITY_CONTRACT_VERSION)
    throw new VoiceCapabilityContractError('capabilityVersion is invalid.');
}

export function parseVoiceSynthesisInputV1(value: unknown): VoiceSynthesisInputV1 {
  const item = object(value, 'voiceSynthesisInput');
  exactKeys(
    item,
    [
      'schemaVersion',
      'capabilityId',
      'capabilityVersion',
      'workspaceId',
      'voiceProfile',
      'source',
      'locale',
      'outputMimeType',
      'rights'
    ],
    'voiceSynthesisInput'
  );
  assertIdentity(item);
  const profile = object(item.voiceProfile, 'voiceProfile');
  exactKeys(profile, ['voiceProfileId', 'version'], 'voiceProfile');
  const source = object(item.source, 'source');
  let parsedSource: VoiceSynthesisSourceV1;
  if (source.kind === 'TEXT') {
    exactKeys(source, ['kind', 'text'], 'source');
    parsedSource = { kind: 'TEXT', text: text(source.text, 'source.text') };
  } else if (source.kind === 'CONTENT_REF') {
    exactKeys(source, ['kind', 'owner', 'contentRef', 'version'], 'source');
    parsedSource = {
      kind: 'CONTENT_REF',
      owner: text(source.owner, 'source.owner'),
      contentRef: text(source.contentRef, 'source.contentRef'),
      version: text(source.version, 'source.version')
    };
  } else throw new VoiceCapabilityContractError('source.kind is invalid.');
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
    throw new VoiceCapabilityContractError('rights must require a current eligibility assessment.');
  return {
    schemaVersion: 1,
    capabilityId: VOICE_SYNTHESIZE_CAPABILITY_ID,
    capabilityVersion: VOICE_CAPABILITY_CONTRACT_VERSION,
    workspaceId: text(item.workspaceId, 'workspaceId'),
    voiceProfile: {
      voiceProfileId: prefixed(
        profile.voiceProfileId,
        'voiceProfile.voiceProfileId',
        'voice-profile_'
      ) as VoiceProfileId,
      version: positiveInteger(profile.version, 'voiceProfile.version')
    },
    source: parsedSource,
    locale: text(item.locale, 'locale'),
    outputMimeType: text(item.outputMimeType, 'outputMimeType'),
    rights: {
      mediaRightsBindingId: prefixed(
        rights.mediaRightsBindingId,
        'rights.mediaRightsBindingId',
        'media-rights-binding_'
      ) as MediaRightsBindingId,
      bindingVersion: positiveInteger(rights.bindingVersion, 'rights.bindingVersion'),
      purpose: text(rights.purpose, 'rights.purpose'),
      territory: text(rights.territory, 'rights.territory'),
      currentEligibilityAssessmentRequired: true
    }
  };
}

export function parseVoiceSynthesisOutcomeV1(value: unknown): VoiceSynthesisOutcomeV1 {
  const item = object(value, 'voiceSynthesisOutcome');
  exactKeys(
    item,
    [
      'schemaVersion',
      'capabilityId',
      'capabilityVersion',
      'status',
      'audioArtifact',
      'capabilityInvocationId',
      'capabilityOutcomeId',
      'evidenceRefs',
      'createsExecutionAuthority'
    ],
    'voiceSynthesisOutcome'
  );
  assertIdentity(item);
  if (!['COMPLETED', 'FAILED', 'RIGHTS_REVIEW_REQUIRED'].includes(String(item.status)))
    throw new VoiceCapabilityContractError('status is invalid.');
  if (item.createsExecutionAuthority !== false)
    throw new VoiceCapabilityContractError('createsExecutionAuthority must be false.');
  const audio =
    item.audioArtifact === undefined ? undefined : object(item.audioArtifact, 'audioArtifact');
  if (item.status === 'COMPLETED' && !audio)
    throw new VoiceCapabilityContractError(
      'COMPLETED outcome requires an AudioArtifact reference.'
    );
  if (item.status !== 'COMPLETED' && audio)
    throw new VoiceCapabilityContractError('Non-completed outcome cannot claim an AudioArtifact.');
  if (audio) exactKeys(audio, ['audioArtifactId', 'version'], 'audioArtifact');
  return {
    schemaVersion: 1,
    capabilityId: VOICE_SYNTHESIZE_CAPABILITY_ID,
    capabilityVersion: VOICE_CAPABILITY_CONTRACT_VERSION,
    status: item.status as VoiceSynthesisOutcomeV1['status'],
    ...(audio
      ? {
          audioArtifact: {
            audioArtifactId: prefixed(
              audio.audioArtifactId,
              'audioArtifact.audioArtifactId',
              'audio-artifact_'
            ) as AudioArtifactId,
            version: positiveInteger(audio.version, 'audioArtifact.version')
          }
        }
      : {}),
    capabilityInvocationId: prefixed(
      item.capabilityInvocationId,
      'capabilityInvocationId',
      'capability-invocation_'
    ) as VoiceSynthesisOutcomeV1['capabilityInvocationId'],
    capabilityOutcomeId: prefixed(
      item.capabilityOutcomeId,
      'capabilityOutcomeId',
      'capability-outcome_'
    ) as VoiceSynthesisOutcomeV1['capabilityOutcomeId'],
    evidenceRefs: strings(item.evidenceRefs, 'evidenceRefs'),
    createsExecutionAuthority: false
  };
}
