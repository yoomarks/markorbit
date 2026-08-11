import { describe, expect, it } from 'vitest';
import {
  acceptedCapabilityCanonDefinitionFingerprint,
  normalizeAcceptedCapabilityCanonDefinition,
  RuntimeCapabilityRegistryError
} from '../src/runtime-capability-registry.js';

const accepted = () => ({
  sourceAuthority: 'ACCEPTED_CAPABILITY_CANON',
  capabilityId: 'trademark-application-recommendation',
  capabilityVersion: '1.0.0',
  title: 'Trademark application recommendation',
  description: 'Builds a governed trademark application recommendation.',
  lineage: {
    domainId: 'trademark-services',
    capabilityId: 'trademark-application-recommendation',
    skillId: 'application-planning',
    actionId: 'recommend-application-plan'
  },
  canonReference: {
    canonId: 'capability-canon',
    canonVersion: '2026.08.12',
    sourceFingerprintSha256: 'a'.repeat(64)
  }
});

function errorCode(operation: () => unknown): string | undefined {
  try {
    operation();
    return undefined;
  } catch (error) {
    return error instanceof RuntimeCapabilityRegistryError ? error.code : undefined;
  }
}

describe('M6-WP-02 runtime Capability admission boundary', () => {
  it('normalizes one exact accepted Canon projection deterministically', () => {
    const first = normalizeAcceptedCapabilityCanonDefinition(accepted());
    const second = normalizeAcceptedCapabilityCanonDefinition(accepted());
    expect(first).toEqual(second);
    expect(acceptedCapabilityCanonDefinitionFingerprint(first)).toMatch(/^[0-9a-f]{64}$/);
    expect(acceptedCapabilityCanonDefinitionFingerprint(first)).toBe(
      acceptedCapabilityCanonDefinitionFingerprint(second)
    );
  });

  it('rejects the legacy fixture as completed Canon lineage', () => {
    expect(
      errorCode(() =>
        normalizeAcceptedCapabilityCanonDefinition({
          ...accepted(),
          capabilityVersion: '0.1.0-fixture'
        })
      )
    ).toBe('INVALID_INPUT');
  });

  it('rejects work evidence or AI as runtime Canon-definition authority', () => {
    expect(
      errorCode(() =>
        normalizeAcceptedCapabilityCanonDefinition({
          ...accepted(),
          sourceAuthority: 'WORK_EVIDENCE'
        })
      )
    ).toBe('INVALID_INPUT');
    expect(
      errorCode(() =>
        normalizeAcceptedCapabilityCanonDefinition({
          ...accepted(),
          sourceAuthority: 'AI_OUTPUT'
        })
      )
    ).toBe('INVALID_INPUT');
  });

  it('rejects workspace, subject and caller-supplied authority fields', () => {
    for (const field of [
      'workspaceId',
      'subjectUserId',
      'createdFromWorkEvidence',
      'createdFromAiOutput',
      'acceptedCanonProjection'
    ]) {
      expect(
        errorCode(() =>
          normalizeAcceptedCapabilityCanonDefinition({ ...accepted(), [field]: 'spoofed' })
        )
      ).toBe('INVALID_INPUT');
    }
  });

  it('requires lineage capability identity to match the accepted definition', () => {
    expect(
      errorCode(() =>
        normalizeAcceptedCapabilityCanonDefinition({
          ...accepted(),
          lineage: { ...accepted().lineage, capabilityId: 'another-capability' }
        })
      )
    ).toBe('INVALID_INPUT');
  });
});
