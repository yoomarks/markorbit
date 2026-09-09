import { describe, expect, it } from 'vitest';
import { MediaContractError, parseMediaRecordV1 } from '../src/media.js';

const rights = {
  snapshotId: 'rights_01',
  version: 2,
  fingerprintSha256: 'a'.repeat(64),
  capturedAt: '2026-09-09T00:00:00Z',
  currentEligibilityRevalidationRequired: true
} as const;
const generated = {
  sourceKind: 'CAPABILITY_OUTCOME',
  sourceEvidenceRefs: ['evidence:01'],
  capabilityInvocationId: 'capability-invocation_01',
  capabilityOutcomeId: 'capability-outcome_01',
  implementation: { implementationProfileId: 'implementation-profile_neutral', version: 3 }
} as const;
describe('media foundation', () => {
  it('keeps profile identity distinct from generated artifacts', () => {
    const voice = parseMediaRecordV1({
      schemaVersion: 1,
      objectType: 'VOICE_PROFILE',
      voiceProfileId: 'voice-profile_01',
      version: 1,
      workspaceId: 'workspace_01',
      subjectOwnerRef: 'subject:01:v1',
      profileKind: 'HUMAN',
      localeCapabilities: ['zh-CN'],
      rightsSnapshot: rights,
      referenceEvidenceRefs: ['evidence:consent'],
      provenance: { sourceKind: 'IMPORTED', sourceEvidenceRefs: ['evidence:source'] },
      createdAt: '2026-09-09T00:00:00Z'
    });
    const audio = parseMediaRecordV1({
      schemaVersion: 1,
      objectType: 'AUDIO_ARTIFACT',
      audioArtifactId: 'audio-artifact_01',
      version: 1,
      workspaceId: 'workspace_01',
      mimeType: 'audio/wav',
      sha256: 'b'.repeat(64),
      sizeBytes: 12,
      durationMs: 100,
      sourceRefs: [{ kind: 'VOICE_PROFILE', profileId: 'voice-profile_01', version: 1 }],
      rightsSnapshot: rights,
      provenance: generated,
      createdAt: '2026-09-09T00:01:00Z'
    });
    expect([voice.objectType, audio.objectType]).toEqual(['VOICE_PROFILE', 'AUDIO_ARTIFACT']);
  });
  it('keeps AvatarProfile distinct from VideoArtifact', () => {
    expect(
      parseMediaRecordV1({
        schemaVersion: 1,
        objectType: 'AVATAR_PROFILE',
        avatarProfileId: 'avatar-profile_01',
        version: 1,
        workspaceId: 'workspace_01',
        subjectOwnerRef: 'subject:01:v1',
        avatarKind: 'VIRTUAL',
        identityResponsibilityRef: 'responsibility:01:v1',
        rightsSnapshot: rights,
        referenceEvidenceRefs: [],
        provenance: { sourceKind: 'IMPORTED', sourceEvidenceRefs: ['evidence:source'] },
        createdAt: '2026-09-09T00:00:00Z'
      }).objectType
    ).toBe('AVATAR_PROFILE');
  });
  it('fails closed without exact generation lineage or future rights revalidation', () => {
    const base = {
      schemaVersion: 1,
      objectType: 'VIDEO_ARTIFACT',
      videoArtifactId: 'video-artifact_01',
      version: 1,
      workspaceId: 'workspace_01',
      mimeType: 'video/mp4',
      sha256: 'c'.repeat(64),
      sizeBytes: 1,
      durationMs: 1,
      sourceRefs: [],
      createdAt: '2026-09-09T00:00:00Z'
    };
    expect(() =>
      parseMediaRecordV1({
        ...base,
        rightsSnapshot: rights,
        provenance: { sourceKind: 'CAPABILITY_OUTCOME', sourceEvidenceRefs: [] }
      })
    ).toThrow('requires exact invocation');
    expect(() =>
      parseMediaRecordV1({
        ...base,
        rightsSnapshot: { ...rights, currentEligibilityRevalidationRequired: false },
        provenance: generated
      })
    ).toThrow(MediaContractError);
    expect(() =>
      parseMediaRecordV1({
        ...base,
        rightsSnapshot: rights,
        provenance: { ...generated, capabilityInvocationId: 'wrong_01' }
      })
    ).toThrow('capabilityInvocationId is invalid');
  });
  it('rejects mismatched source identity kinds', () => {
    expect(() =>
      parseMediaRecordV1({
        schemaVersion: 1,
        objectType: 'CLIP_ARTIFACT',
        clipArtifactId: 'clip-artifact_01',
        version: 1,
        workspaceId: 'workspace_01',
        mimeType: 'video/mp4',
        sha256: 'd'.repeat(64),
        sizeBytes: 1,
        durationMs: 1,
        sourceRefs: [{ kind: 'AVATAR_PROFILE', profileId: 'voice-profile_wrong', version: 1 }],
        rightsSnapshot: rights,
        provenance: generated,
        createdAt: '2026-09-09T00:00:00Z'
      })
    ).toThrow('does not match kind');
  });
});
