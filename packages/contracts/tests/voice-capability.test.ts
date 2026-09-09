import { describe, expect, it } from 'vitest';
import {
  VOICE_CLONE_CAPABILITY_STATE,
  parseVoiceSynthesisInputV1,
  parseVoiceSynthesisOutcomeV1
} from '../src/voice-capability.js';

const input = {
  schemaVersion: 1,
  capabilityId: 'voice.synthesize',
  capabilityVersion: '1.0.0',
  workspaceId: 'workspace_01',
  voiceProfile: { voiceProfileId: 'voice-profile_01', version: 2 },
  source: { kind: 'TEXT', text: 'Hello' },
  locale: 'en-US',
  outputMimeType: 'audio/wav',
  rights: {
    mediaRightsBindingId: 'media-rights-binding_01',
    bindingVersion: 3,
    purpose: 'MARKETING',
    territory: 'US',
    currentEligibilityAssessmentRequired: true
  }
} as const;
const outcome = {
  schemaVersion: 1,
  capabilityId: 'voice.synthesize',
  capabilityVersion: '1.0.0',
  status: 'COMPLETED',
  audioArtifact: { audioArtifactId: 'audio-artifact_01', version: 1 },
  capabilityInvocationId: 'capability-invocation_01',
  capabilityOutcomeId: 'capability-outcome_01',
  evidenceRefs: ['evidence:01'],
  createsExecutionAuthority: false
} as const;

describe('voice capability contract', () => {
  it('parses provider-neutral synthesis through canonical profile, rights and artifact refs', () => {
    expect(parseVoiceSynthesisInputV1(input)).toEqual(input);
    expect(parseVoiceSynthesisOutcomeV1(outcome)).toEqual(outcome);
  });
  it('keeps clone explicitly gated instead of manufacturing runtime availability', () => {
    expect(VOICE_CLONE_CAPABILITY_STATE).toBe('GATED_UNAVAILABLE');
  });
  it('fails closed when current rights eligibility is not required', () => {
    expect(() =>
      parseVoiceSynthesisInputV1({
        ...input,
        rights: { ...input.rights, currentEligibilityAssessmentRequired: false }
      })
    ).toThrow('current eligibility assessment');
  });
  it('does not allow failed outcomes to claim generated audio', () => {
    expect(() => parseVoiceSynthesisOutcomeV1({ ...outcome, status: 'FAILED' })).toThrow(
      'cannot claim an AudioArtifact'
    );
  });
  it('rejects provider-specific or unsupported product fields', () => {
    expect(() =>
      parseVoiceSynthesisInputV1({ ...input, providerModel: 'provider-product' })
    ).toThrow('unsupported fields');
  });
});
