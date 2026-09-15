import { describe, expect, it } from 'vitest';
import {
  WorkspaceCapabilityBindingContractError,
  parseWorkspaceCapabilityBindingV1,
  workspaceCapabilityBindingAuthorityV1,
  workspaceCapabilityBindingFingerprintSha256V1,
  workspaceCapabilityBindingIdV1
} from '../src/workspace-capability-binding.js';

const workspaceId = '018f0000-0000-7000-8000-000000000301';
const intelligenceId = `brain-intelligence_${'a'.repeat(64)}` as const;
const evidenceId = `brain-knowledge-evidence_${'b'.repeat(64)}` as const;
const primitiveId = `brain-intelligence-primitive_${'c'.repeat(64)}` as const;

function fixture() {
  const identity = {
    schemaVersion: 1 as const,
    workspaceId,
    source: {
      intelligenceId,
      task: 'TRADEMARK_ISSUE_EXTRACTION' as const,
      projectionSha256: 'e'.repeat(64),
      generatedAt: '2026-09-15T01:00:00.000Z',
      evidenceRefs: [evidenceId],
      primitiveRefs: [primitiveId],
      interpreter: {
        profileId: 'workspace-trademark-issue-v1',
        version: '1.0.0',
        policyProfileId: 'governed-knowledge-only-v1'
      }
    },
    runtimeCapability: {
      id: 'runtime-capability_trademark-issue-router-v1' as const,
      version: 1,
      capabilityId: 'brain.trademark-issue-router',
      capabilityVersion: '1.0.0',
      canonReference: {
        canonId: 'github:yoomarks/markorbit#future-canon',
        canonVersion: '1',
        sourceFingerprintSha256: 'f'.repeat(64)
      },
      acceptedCanonProjection: true as const
    },
    bindingPolicy: {
      policyId: 'workspace-trademark-issue-capability-binding',
      policyVersion: '1',
      ruleId: 'trademark-issue-router-v1',
      reason: 'Server-governed policy admits this intelligence task to the exact Capability.'
    },
    freshness: {
      status: 'NOT_EVALUATED' as const,
      plannedStage: 'WIF-08' as const
    },
    authority: workspaceCapabilityBindingAuthorityV1
  };
  return {
    ...identity,
    bindingId: workspaceCapabilityBindingIdV1(identity),
    boundAt: '2026-09-15T01:01:00.000Z'
  };
}

describe('Workspace Capability Binding V1 contract', () => {
  it('accepts one exact immutable Workspace-to-Capability binding snapshot', () => {
    const parsed = parseWorkspaceCapabilityBindingV1(fixture());
    expect(parsed.workspaceId).toBe(workspaceId);
    expect(parsed.runtimeCapability.acceptedCanonProjection).toBe(true);
    expect(parsed.freshness).toEqual({
      status: 'NOT_EVALUATED',
      plannedStage: 'WIF-08'
    });
    expect(parsed.authority.capabilityBindingCreated).toBe(true);
    expect(parsed.authority.capabilityInvocationAuthorized).toBe(false);
    expect(parsed.authority.implementationSelected).toBe(false);
  });

  it('has deterministic identity and full-snapshot fingerprints', () => {
    const parsed = parseWorkspaceCapabilityBindingV1(fixture());
    expect(parsed.bindingId).toMatch(/^workspace-capability-binding_[0-9a-f]{64}$/u);
    expect(workspaceCapabilityBindingFingerprintSha256V1(parsed)).toMatch(/^[0-9a-f]{64}$/u);
    expect(workspaceCapabilityBindingFingerprintSha256V1(parsed)).toBe(
      workspaceCapabilityBindingFingerprintSha256V1(parseWorkspaceCapabilityBindingV1(fixture()))
    );
  });

  it('rejects a binding id that does not match its semantic identity', () => {
    expect(() =>
      parseWorkspaceCapabilityBindingV1({
        ...fixture(),
        bindingId: `workspace-capability-binding_${'d'.repeat(64)}`
      })
    ).toThrow('deterministic binding identity');
  });

  it('rejects invocation authority escalation', () => {
    expect(() =>
      parseWorkspaceCapabilityBindingV1({
        ...fixture(),
        authority: {
          ...workspaceCapabilityBindingAuthorityV1,
          capabilityInvocationAuthorized: true
        }
      })
    ).toThrow(WorkspaceCapabilityBindingContractError);
  });

  it('rejects pretending freshness was evaluated in WIF-05', () => {
    expect(() =>
      parseWorkspaceCapabilityBindingV1({
        ...fixture(),
        freshness: { status: 'CURRENT', plannedStage: 'WIF-08' }
      })
    ).toThrow('freshness must remain deferred to WIF-08');
  });

  it('rejects non-Canon Capability targets', () => {
    expect(() =>
      parseWorkspaceCapabilityBindingV1({
        ...fixture(),
        runtimeCapability: {
          ...fixture().runtimeCapability,
          acceptedCanonProjection: false
        }
      })
    ).toThrow('accepted Capability Canon');
  });

  it('rejects expanded snapshots with implementation fields', () => {
    expect(() =>
      parseWorkspaceCapabilityBindingV1({
        ...fixture(),
        implementation: { implementationKey: 'must-not-exist-in-WIF-05' }
      })
    ).toThrow('unsupported fields');
  });
});
