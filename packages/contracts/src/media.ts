export type VoiceProfileId = `voice-profile_${string}`;
export type AvatarProfileId = `avatar-profile_${string}`;
export type AudioArtifactId = `audio-artifact_${string}`;
export type ClipArtifactId = `clip-artifact_${string}`;
export type VideoArtifactId = `video-artifact_${string}`;

export interface MediaRightsSnapshotRefV1 {
  snapshotId: string;
  version: number;
  fingerprintSha256: string;
  capturedAt: string;
  currentEligibilityRevalidationRequired: true;
}
export interface MediaImplementationRefV1 {
  implementationProfileId: `implementation-profile_${string}`;
  version: number;
}
export interface MediaProvenanceV1 {
  sourceKind: 'IMPORTED' | 'CAPABILITY_OUTCOME';
  sourceEvidenceRefs: readonly string[];
  capabilityInvocationId?: `capability-invocation_${string}`;
  capabilityOutcomeId?: `capability-outcome_${string}`;
  implementation?: Readonly<MediaImplementationRefV1>;
  providerExecutionRef?: string;
}
export type MediaSourceRefV1 =
  | Readonly<{
      kind: 'VOICE_PROFILE' | 'AVATAR_PROFILE';
      profileId: VoiceProfileId | AvatarProfileId;
      version: number;
    }>
  | Readonly<{
      kind: 'AUDIO_ARTIFACT' | 'CLIP_ARTIFACT' | 'VIDEO_ARTIFACT';
      artifactId: AudioArtifactId | ClipArtifactId | VideoArtifactId;
      version: number;
    }>
  | Readonly<{ kind: 'ASSET' | 'CONTENT'; owner: string; referenceId: string; version: string }>;

interface MediaProfileBaseV1 {
  schemaVersion: 1;
  version: number;
  workspaceId: string;
  subjectOwnerRef: string;
  implementation?: Readonly<MediaImplementationRefV1>;
  rightsSnapshot: Readonly<MediaRightsSnapshotRefV1>;
  referenceEvidenceRefs: readonly string[];
  provenance: Readonly<MediaProvenanceV1>;
  createdAt: string;
}
export interface VoiceProfileV1 extends MediaProfileBaseV1 {
  objectType: 'VOICE_PROFILE';
  voiceProfileId: VoiceProfileId;
  profileKind: 'HUMAN' | 'CHARACTER' | 'SYNTHETIC';
  localeCapabilities: readonly string[];
}
export interface AvatarProfileV1 extends MediaProfileBaseV1 {
  objectType: 'AVATAR_PROFILE';
  avatarProfileId: AvatarProfileId;
  avatarKind: 'HUMAN' | 'VIRTUAL' | 'CHARACTER';
  identityResponsibilityRef?: string;
}
interface MediaArtifactBaseV1 {
  schemaVersion: 1;
  version: number;
  workspaceId: string;
  mimeType: string;
  sha256: string;
  sizeBytes: number;
  durationMs: number;
  sourceRefs: readonly MediaSourceRefV1[];
  rightsSnapshot: Readonly<MediaRightsSnapshotRefV1>;
  provenance: Readonly<MediaProvenanceV1>;
  createdAt: string;
}
export interface AudioArtifactV1 extends MediaArtifactBaseV1 {
  objectType: 'AUDIO_ARTIFACT';
  audioArtifactId: AudioArtifactId;
}
export interface ClipArtifactV1 extends MediaArtifactBaseV1 {
  objectType: 'CLIP_ARTIFACT';
  clipArtifactId: ClipArtifactId;
}
export interface VideoArtifactV1 extends MediaArtifactBaseV1 {
  objectType: 'VIDEO_ARTIFACT';
  videoArtifactId: VideoArtifactId;
}
export type MediaRecordV1 =
  VoiceProfileV1 | AvatarProfileV1 | AudioArtifactV1 | ClipArtifactV1 | VideoArtifactV1;

export class MediaContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'MediaContractError';
  }
}
function object(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new MediaContractError(`${field} must be an object.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '')
    throw new MediaContractError(`${field} must be a non-empty string.`);
  return value.trim();
}
function prefixed(value: unknown, field: string, prefix: string): string {
  const result = text(value, field);
  if (!result.startsWith(prefix)) throw new MediaContractError(`${field} is invalid.`);
  return result;
}
function integer(value: unknown, field: string, allowZero = false): number {
  if (!Number.isSafeInteger(value) || (value as number) < (allowZero ? 0 : 1))
    throw new MediaContractError(`${field} must be a valid integer.`);
  return value as number;
}
function stringList(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value)) throw new MediaContractError(`${field} must be an array.`);
  const result = value.map((part, index) => text(part, `${field}[${index}]`));
  if (new Set(result).size !== result.length)
    throw new MediaContractError(`${field} must not contain duplicates.`);
  return result;
}
function timestamp(value: unknown, field: string): string {
  const result = text(value, field);
  if (!Number.isFinite(Date.parse(result)))
    throw new MediaContractError(`${field} must be a timestamp.`);
  return result;
}
function implementation(value: unknown): MediaImplementationRefV1 {
  const item = object(value, 'implementation');
  const id = text(item.implementationProfileId, 'implementation.implementationProfileId');
  if (!id.startsWith('implementation-profile_'))
    throw new MediaContractError('implementationProfileId is invalid.');
  return {
    implementationProfileId: id as MediaImplementationRefV1['implementationProfileId'],
    version: integer(item.version, 'implementation.version')
  };
}
function rights(value: unknown): MediaRightsSnapshotRefV1 {
  const item = object(value, 'rightsSnapshot');
  const hash = text(item.fingerprintSha256, 'rightsSnapshot.fingerprintSha256');
  if (!/^[a-f0-9]{64}$/u.test(hash))
    throw new MediaContractError('rightsSnapshot fingerprint must be SHA-256 hex.');
  if (item.currentEligibilityRevalidationRequired !== true)
    throw new MediaContractError('rightsSnapshot must require current eligibility revalidation.');
  return {
    snapshotId: text(item.snapshotId, 'rightsSnapshot.snapshotId'),
    version: integer(item.version, 'rightsSnapshot.version'),
    fingerprintSha256: hash,
    capturedAt: timestamp(item.capturedAt, 'rightsSnapshot.capturedAt'),
    currentEligibilityRevalidationRequired: true
  };
}
function provenance(value: unknown): MediaProvenanceV1 {
  const item = object(value, 'provenance');
  if (item.sourceKind !== 'IMPORTED' && item.sourceKind !== 'CAPABILITY_OUTCOME')
    throw new MediaContractError('provenance.sourceKind is invalid.');
  const result: MediaProvenanceV1 = {
    sourceKind: item.sourceKind,
    sourceEvidenceRefs: stringList(item.sourceEvidenceRefs, 'provenance.sourceEvidenceRefs'),
    ...(item.capabilityInvocationId === undefined
      ? {}
      : {
          capabilityInvocationId: prefixed(
            item.capabilityInvocationId,
            'capabilityInvocationId',
            'capability-invocation_'
          ) as `capability-invocation_${string}`
        }),
    ...(item.capabilityOutcomeId === undefined
      ? {}
      : {
          capabilityOutcomeId: prefixed(
            item.capabilityOutcomeId,
            'capabilityOutcomeId',
            'capability-outcome_'
          ) as `capability-outcome_${string}`
        }),
    ...(item.implementation === undefined
      ? {}
      : { implementation: implementation(item.implementation) }),
    ...(item.providerExecutionRef === undefined
      ? {}
      : { providerExecutionRef: text(item.providerExecutionRef, 'providerExecutionRef') })
  };
  const exact = [result.capabilityInvocationId, result.capabilityOutcomeId, result.implementation];
  if (result.sourceKind === 'CAPABILITY_OUTCOME' && exact.some((part) => part === undefined))
    throw new MediaContractError(
      'CAPABILITY_OUTCOME provenance requires exact invocation, outcome and implementation references.'
    );
  if (result.sourceKind === 'IMPORTED' && exact.some((part) => part !== undefined))
    throw new MediaContractError('IMPORTED provenance cannot claim capability lineage.');
  return result;
}
function sources(value: unknown): readonly MediaSourceRefV1[] {
  if (!Array.isArray(value)) throw new MediaContractError('sourceRefs must be an array.');
  return value.map((source, index) => {
    const item = object(source, `sourceRefs[${index}]`);
    const kind = text(item.kind, `sourceRefs[${index}].kind`);
    if (kind === 'VOICE_PROFILE' || kind === 'AVATAR_PROFILE') {
      const id = text(item.profileId, `sourceRefs[${index}].profileId`);
      const prefix = kind === 'VOICE_PROFILE' ? 'voice-profile_' : 'avatar-profile_';
      if (!id.startsWith(prefix))
        throw new MediaContractError(`sourceRefs[${index}].profileId does not match kind.`);
      return {
        kind,
        profileId: id as VoiceProfileId | AvatarProfileId,
        version: integer(item.version, `sourceRefs[${index}].version`)
      };
    }
    if (kind === 'AUDIO_ARTIFACT' || kind === 'CLIP_ARTIFACT' || kind === 'VIDEO_ARTIFACT') {
      const id = text(item.artifactId, `sourceRefs[${index}].artifactId`);
      const prefix =
        kind === 'AUDIO_ARTIFACT'
          ? 'audio-artifact_'
          : kind === 'CLIP_ARTIFACT'
            ? 'clip-artifact_'
            : 'video-artifact_';
      if (!id.startsWith(prefix))
        throw new MediaContractError(`sourceRefs[${index}].artifactId does not match kind.`);
      return {
        kind,
        artifactId: id as AudioArtifactId | ClipArtifactId | VideoArtifactId,
        version: integer(item.version, `sourceRefs[${index}].version`)
      };
    }
    if (kind === 'ASSET' || kind === 'CONTENT')
      return {
        kind,
        owner: text(item.owner, 'source.owner'),
        referenceId: text(item.referenceId, 'source.referenceId'),
        version: text(item.version, 'source.version')
      };
    throw new MediaContractError(`sourceRefs[${index}].kind is invalid.`);
  });
}

export function parseMediaRecordV1(value: unknown): MediaRecordV1 {
  const item = object(value, 'mediaRecord');
  if (item.schemaVersion !== 1) throw new MediaContractError('schemaVersion must be 1.');
  const objectType = text(item.objectType, 'objectType');
  const common = {
    schemaVersion: 1 as const,
    version: integer(item.version, 'version'),
    workspaceId: text(item.workspaceId, 'workspaceId'),
    rightsSnapshot: rights(item.rightsSnapshot),
    provenance: provenance(item.provenance),
    createdAt: timestamp(item.createdAt, 'createdAt')
  };
  if (objectType === 'VOICE_PROFILE') {
    const id = text(item.voiceProfileId, 'voiceProfileId');
    if (
      !id.startsWith('voice-profile_') ||
      !['HUMAN', 'CHARACTER', 'SYNTHETIC'].includes(String(item.profileKind))
    )
      throw new MediaContractError('VoiceProfile identity or kind is invalid.');
    return {
      ...common,
      objectType,
      voiceProfileId: id as VoiceProfileId,
      profileKind: item.profileKind as VoiceProfileV1['profileKind'],
      subjectOwnerRef: text(item.subjectOwnerRef, 'subjectOwnerRef'),
      ...(item.implementation === undefined
        ? {}
        : { implementation: implementation(item.implementation) }),
      referenceEvidenceRefs: stringList(item.referenceEvidenceRefs, 'referenceEvidenceRefs'),
      localeCapabilities: stringList(item.localeCapabilities, 'localeCapabilities')
    };
  }
  if (objectType === 'AVATAR_PROFILE') {
    const id = text(item.avatarProfileId, 'avatarProfileId');
    if (
      !id.startsWith('avatar-profile_') ||
      !['HUMAN', 'VIRTUAL', 'CHARACTER'].includes(String(item.avatarKind))
    )
      throw new MediaContractError('AvatarProfile identity or kind is invalid.');
    return {
      ...common,
      objectType,
      avatarProfileId: id as AvatarProfileId,
      avatarKind: item.avatarKind as AvatarProfileV1['avatarKind'],
      subjectOwnerRef: text(item.subjectOwnerRef, 'subjectOwnerRef'),
      ...(item.implementation === undefined
        ? {}
        : { implementation: implementation(item.implementation) }),
      ...(item.identityResponsibilityRef === undefined
        ? {}
        : {
            identityResponsibilityRef: text(
              item.identityResponsibilityRef,
              'identityResponsibilityRef'
            )
          }),
      referenceEvidenceRefs: stringList(item.referenceEvidenceRefs, 'referenceEvidenceRefs')
    };
  }
  if (!['AUDIO_ARTIFACT', 'CLIP_ARTIFACT', 'VIDEO_ARTIFACT'].includes(objectType))
    throw new MediaContractError('objectType is invalid.');
  const idField =
    objectType === 'AUDIO_ARTIFACT'
      ? 'audioArtifactId'
      : objectType === 'CLIP_ARTIFACT'
        ? 'clipArtifactId'
        : 'videoArtifactId';
  const prefix =
    objectType === 'AUDIO_ARTIFACT'
      ? 'audio-artifact_'
      : objectType === 'CLIP_ARTIFACT'
        ? 'clip-artifact_'
        : 'video-artifact_';
  const id = text(item[idField], idField);
  if (!id.startsWith(prefix)) throw new MediaContractError(`${idField} is invalid.`);
  const hash = text(item.sha256, 'sha256');
  if (!/^[a-f0-9]{64}$/u.test(hash)) throw new MediaContractError('sha256 must be SHA-256 hex.');
  return {
    ...common,
    objectType,
    [idField]: id,
    mimeType: text(item.mimeType, 'mimeType'),
    sha256: hash,
    sizeBytes: integer(item.sizeBytes, 'sizeBytes', true),
    durationMs: integer(item.durationMs, 'durationMs'),
    sourceRefs: sources(item.sourceRefs)
  } as MediaRecordV1;
}
