import { describe, expect, it } from 'vitest';
import {
  parseWorkspaceCapabilityBindingValidityObservationV1,
  workspaceCapabilityBindingValidityAuthorityV1,
  workspaceCapabilityBindingValidityFingerprintSha256V1,
  workspaceCapabilityBindingValidityIdentityProjectionV1,
  workspaceCapabilityBindingValidityObservationIdV1,
  type WorkspaceCapabilityBindingValidityIdentityV1
} from '../src/workspace-capability-binding-validity.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const bindingId = `workspace-capability-binding_${'a'.repeat(64)}` as const;
const evidenceId = `brain-knowledge-evidence_${'b'.repeat(64)}` as const;

function identity(
  status: WorkspaceCapabilityBindingValidityIdentityV1['status'] = 'CURRENT'
): WorkspaceCapabilityBindingValidityIdentityV1 {
  return {
    schemaVersion: 1,
    workspaceId,
    bindingId,
    bindingFingerprintSha256: 'c'.repeat(64),
    status,
    usable: status === 'CURRENT',
    reasonCode: status === 'CURRENT' ? 'ALL_CURRENT' : 'KNOWLEDGE_CURRENTNESS_UNAVAILABLE',
    basis: {
      sourceTruthSha256: 'd'.repeat(64),
      runtimeCapabilityTruthSha256: 'e'.repeat(64),
      policy: { status: 'CURRENT', fingerprintSha256: 'f'.repeat(64) },
      knowledge: {
        status: status === 'CURRENT' ? 'CURRENT' : 'CURRENTNESS_UNAVAILABLE',
        evidenceRefs: [evidenceId],
        ownerSnapshotSha256: '1'.repeat(64)
      },
      revocation: { status: 'NOT_REVOKED', fingerprintSha256: '2'.repeat(64) }
    },
    authority: workspaceCapabilityBindingValidityAuthorityV1
  };
}

function observation(status: WorkspaceCapabilityBindingValidityIdentityV1['status'] = 'CURRENT') {
  const value = identity(status);
  return {
    ...value,
    observationId: workspaceCapabilityBindingValidityObservationIdV1(value),
    evaluatedAt: '2026-09-15T09:45:00.000Z'
  };
}

describe('Workspace Capability binding validity contract', () => {
  it('accepts one immutable current-validity observation', () => {
    const parsed = parseWorkspaceCapabilityBindingValidityObservationV1(observation());
    expect(parsed.status).toBe('CURRENT');
    expect(parsed.usable).toBe(true);
    expect(parsed.authority.capabilityInvocationAuthorized).toBe(false);
  });
  it('derives deterministic identity separately from first evaluation time', () => {
    const first = observation();
    const second = { ...first, evaluatedAt: '2026-09-15T09:50:00.000Z' };
    expect(
      workspaceCapabilityBindingValidityObservationIdV1(
        workspaceCapabilityBindingValidityIdentityProjectionV1(first)
      )
    ).toBe(first.observationId);
    expect(workspaceCapabilityBindingValidityFingerprintSha256V1(first)).not.toBe(
      workspaceCapabilityBindingValidityFingerprintSha256V1(second)
    );
  });

  it('rejects a forged deterministic observation id', () => {
    expect(() =>
      parseWorkspaceCapabilityBindingValidityObservationV1({
        ...observation(),
        observationId: `workspace-capability-binding-validity_${'9'.repeat(64)}`
      })
    ).toThrow('deterministic validity identity');
  });

  it('rejects invocation authority escalation', () => {
    expect(() =>
      parseWorkspaceCapabilityBindingValidityObservationV1({
        ...observation(),
        authority: {
          ...workspaceCapabilityBindingValidityAuthorityV1,
          capabilityInvocationAuthorized: true
        }
      })
    ).toThrow('authority.capabilityInvocationAuthorized');
  });
  it('rejects claiming non-current observations are usable', () => {
    expect(() =>
      parseWorkspaceCapabilityBindingValidityObservationV1({
        ...observation('CURRENTNESS_UNAVAILABLE'),
        usable: true
      })
    ).toThrow('usable must be true only for CURRENT');
  });

  it('rejects expanded owner-truth fields', () => {
    const value = observation();
    expect(() =>
      parseWorkspaceCapabilityBindingValidityObservationV1({
        ...value,
        basis: {
          ...value.basis,
          knowledge: { ...value.basis.knowledge, inventedCurrent: true }
        }
      })
    ).toThrow('basis.knowledge contains unsupported fields');
  });
});
