import { describe, expect, it } from 'vitest';
import {
  projectCognitiveControlPlaneV1,
  type CognitiveControlPlaneInputV1,
  type CognitiveControlPlaneStateV1
} from '../src/cognitive-control-plane.js';

const proof = Object.freeze({
  kind: 'TEST_PROOF',
  id: 'proof_exact',
  fingerprintSha256: 'a'.repeat(64)
});

function base(overrides: Partial<CognitiveControlPlaneInputV1> = {}): CognitiveControlPlaneInputV1 {
  return {
    schemaVersion: 1,
    audit: 'AVAILABLE',
    governance: 'APPROVED',
    method: 'CURRENT',
    reference: 'CURRENT',
    sourceCurrentness: 'CURRENT',
    admission: 'PRODUCTION_ADMISSIBLE',
    improvement: 'NONE',
    proofs: [proof],
    ...overrides
  };
}

const cases: ReadonlyArray<readonly [CognitiveControlPlaneStateV1, Partial<CognitiveControlPlaneInputV1>]> = [
  ['READY', {}],
  ['PILOT', { admission: 'PILOT' }],
  ['BLOCKED_BY_GOVERNANCE', { governance: 'PENDING' }],
  ['BLOCKED_BY_SOURCE_CURRENTNESS', { sourceCurrentness: 'STALE' }],
  ['BLOCKED_BY_REFERENCE', { reference: 'MISSING' }],
  ['BLOCKED_BY_METHOD', { method: 'STALE' }],
  ['COVERAGE_GAP', { improvement: 'COVERAGE_GAP' }],
  ['RESEARCH_IN_PROGRESS', { improvement: 'RESEARCH_IN_PROGRESS' }],
  ['CANDIDATE_AVAILABLE', { improvement: 'CANDIDATE_AVAILABLE' }],
  ['AUDIT_UNAVAILABLE', { audit: 'UNAVAILABLE' }]
];

describe('projectCognitiveControlPlaneV1', () => {
  it.each(cases)('projects %s deterministically', (state, overrides) => {
    const input = base(overrides);
    expect(projectCognitiveControlPlaneV1(input)).toEqual(projectCognitiveControlPlaneV1(input));
    expect(projectCognitiveControlPlaneV1(input).state).toBe(state);
  });

  it('fails closed on source and governance ambiguity before READY', () => {
    expect(projectCognitiveControlPlaneV1(base({ sourceCurrentness: 'AMBIGUOUS' })).state).toBe(
      'BLOCKED_BY_SOURCE_CURRENTNESS'
    );
    expect(projectCognitiveControlPlaneV1(base({ governance: 'DENIED' })).state).toBe(
      'BLOCKED_BY_GOVERNANCE'
    );
    expect(projectCognitiveControlPlaneV1(base({ admission: 'NOT_ADMITTED' })).state).toBe(
      'BLOCKED_BY_GOVERNANCE'
    );
  });

  it('preserves exact proof identity without leaking mutation and grants no authority', () => {
    const input = base();
    const projected = projectCognitiveControlPlaneV1(input);
    expect(projected.proofs).toEqual([proof]);
    expect(projected.proofs).not.toBe(input.proofs);
    expect(Object.values(projected.authority).every((value) => value === false)).toBe(true);
  });

  it('prioritizes governed improvement state over ordinary readiness blockers', () => {
    expect(
      projectCognitiveControlPlaneV1(
        base({ improvement: 'RESEARCH_IN_PROGRESS', method: 'MISSING', governance: 'PENDING' })
      ).state
    ).toBe('RESEARCH_IN_PROGRESS');
  });

  it('does not reinterpret READY as downstream execution authority', () => {
    const ready = projectCognitiveControlPlaneV1(base());
    expect(ready.state).toBe('READY');
    expect(ready.authority.recommendationAuthorized).toBe(false);
    expect(ready.authority.officialTruthCreated).toBe(false);
    expect(ready.authority.filingAuthorized).toBe(false);
    expect(ready.authority.paymentAuthorized).toBe(false);
    expect(ready.authority.providerActionAuthorized).toBe(false);
  });
});
