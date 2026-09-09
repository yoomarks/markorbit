import { describe, expect, it } from 'vitest';
import {
  AVATAR_STREAM_CAPABILITY_STATE,
  parseAvatarRenderInputV1,
  parseAvatarRenderOutcomeV1
} from '../src/avatar-capability.js';

const common = {
  schemaVersion: 1,
  capabilityVersion: '1.0.0',
  workspaceId: 'workspace_01',
  avatarProfile: { avatarProfileId: 'avatar-profile_01', version: 2 },
  rights: {
    mediaRightsBindingId: 'media-rights-binding_01',
    bindingVersion: 3,
    purpose: 'MARKETING',
    territory: 'US',
    currentEligibilityAssessmentRequired: true
  },
  outputMimeType: 'video/mp4'
} as const;
describe('avatar capability contract', () => {
  it('keeps speech and expression rendering orthogonal', () => {
    const speech = parseAvatarRenderInputV1({
      ...common,
      capabilityId: 'avatar.renderSpeech',
      audioArtifact: { audioArtifactId: 'audio-artifact_01', version: 1 }
    });
    const expression = parseAvatarRenderInputV1({
      ...common,
      capabilityId: 'avatar.renderExpression',
      expressionIntent: 'friendly acknowledgement',
      durationMs: 800
    });
    expect(speech.capabilityId).toBe('avatar.renderSpeech');
    expect(expression.capabilityId).toBe('avatar.renderExpression');
  });
  it('keeps streaming unavailable and omits an overlapping renderVideo contract', () => {
    expect(AVATAR_STREAM_CAPABILITY_STATE).toBe('FUTURE_UNAVAILABLE');
    expect(() =>
      parseAvatarRenderInputV1({ ...common, capabilityId: 'avatar.renderVideo' })
    ).toThrow('capabilityId is invalid');
  });
  it('requires current rights eligibility and rejects provider fields', () => {
    expect(() =>
      parseAvatarRenderInputV1({
        ...common,
        capabilityId: 'avatar.renderExpression',
        expressionIntent: 'calm',
        durationMs: 1,
        rights: { ...common.rights, currentEligibilityAssessmentRequired: false }
      })
    ).toThrow('current eligibility assessment');
    expect(() =>
      parseAvatarRenderInputV1({
        ...common,
        capabilityId: 'avatar.renderExpression',
        expressionIntent: 'calm',
        durationMs: 1,
        providerModel: 'provider-product'
      })
    ).toThrow('unsupported fields');
  });
  it('returns only an exact reusable ClipArtifact on completion', () => {
    const outcome = parseAvatarRenderOutcomeV1({
      schemaVersion: 1,
      capabilityId: 'avatar.renderSpeech',
      capabilityVersion: '1.0.0',
      status: 'COMPLETED',
      clipArtifact: { clipArtifactId: 'clip-artifact_01', version: 1 },
      capabilityInvocationId: 'capability-invocation_01',
      capabilityOutcomeId: 'capability-outcome_01',
      evidenceRefs: ['evidence:01'],
      createsExecutionAuthority: false
    });
    expect(outcome.clipArtifact?.clipArtifactId).toBe('clip-artifact_01');
  });
});
