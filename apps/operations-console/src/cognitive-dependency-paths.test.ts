import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_INTEGRITY_BOUNDARY,
  buildCapabilityDependencyPaths,
  buildCoreDependencyPaths
} from './cognitive-dependency-paths.js';

describe('Core owner-truth dependency paths', () => {
  it('never heuristically joins an open BrainGap to Method Improvement and only connects exact trigger lineage', () => {
    const paths = buildCoreDependencyPaths({
      brainGaps: [
        {
          brainGapRegistryKey: 'brain-gap:cn-duration',
          identityFingerprintSha256: 'a'.repeat(64),
          status: 'OPEN',
          gapType: 'PERFORMANCE_GAP',
          severity: 'HIGH',
          businessImpact: 'Duration confidence is insufficient.',
          detectionSource: 'BRAIN_RUNTIME',
          targetModule: 'cn-duration',
          reasonCode: 'INSUFFICIENT_EVIDENCE',
          firstDetectedAt: '2026-09-01T00:00:00.000Z',
          lastDetectedAt: '2026-09-05T00:00:00.000Z',
          occurrenceCount: 3
        }
      ],
      methodImprovements: [
        {
          trigger: {
            triggerId: 'trigger-1',
            triggerType: 'PERFORMANCE_GAP',
            triggerFingerprintSha256: 'b'.repeat(64),
            admittedAt: '2026-09-05T01:00:00.000Z',
            source: {
              kind: 'CORE_METHOD_OUTCOME_REPORT_V1',
              reportFingerprintSha256: 'c'.repeat(64)
            }
          },
          researchMission: {
            researchMissionId: 'mission-1',
            missionFingerprintSha256: 'd'.repeat(64),
            triggerId: 'trigger-1',
            triggerFingerprintSha256: 'b'.repeat(64),
            createdAt: '2026-09-05T01:01:00.000Z'
          }
        }
      ],
      brainBuildRuns: {
        availability: 'NOT_DURABLY_RECORDED',
        inventory: null,
        reasonCode: 'NO_DURABLE_BUILD_RUN_REGISTRY'
      }
    });

    const gap = paths.find((path) => path.id === 'core-gap:brain-gap:cn-duration');
    const improvement = paths.find((path) => path.id === 'core-method:trigger-1');

    expect(gap?.dependency).toContain('No Method Improvement admission dependency is established');
    expect(gap?.dependency).not.toContain('mission-1');
    expect(improvement?.currentState).toContain('trigger-1');
    expect(improvement?.currentState).toContain('mission-1');
    expect(improvement?.dependency).toContain('NOT_DURABLY_RECORDED');
    expect(improvement?.affects).toContain('does not establish a candidate method');
  });

  it('fails closed when trigger and Research Mission fingerprints do not exactly bind', () => {
    const paths = buildCoreDependencyPaths({
      brainGaps: [],
      methodImprovements: [
        {
          trigger: {
            triggerId: 'trigger-2',
            triggerType: 'COVERAGE_GAP',
            triggerFingerprintSha256: 'e'.repeat(64),
            admittedAt: '2026-09-05T02:00:00.000Z'
          },
          researchMission: {
            researchMissionId: 'mission-2',
            triggerId: 'trigger-2',
            triggerFingerprintSha256: 'f'.repeat(64)
          }
        }
      ],
      brainBuildRuns: { availability: 'AVAILABLE', inventory: [] }
    });

    const path = paths.find((item) => item.id === 'core-method-unestablished:trigger-2');
    expect(path?.kind).toBe('UNKNOWN');
    expect(path?.title).toBe('Method Improvement dependency is not established');
    expect(path?.why).toContain('refuses to join');
  });

  it('renders NOT_DURABLY_RECORDED as a recording limitation, never zero or health', () => {
    const paths = buildCoreDependencyPaths({
      brainGaps: [],
      methodImprovements: [],
      brainBuildRuns: {
        availability: 'NOT_DURABLY_RECORDED',
        inventory: null,
        reasonCode: 'NO_DURABLE_BUILD_RUN_REGISTRY'
      }
    });

    const path = paths.find((item) => item.id === 'core-build-runs:not-durably-recorded');
    expect(path?.currentState).toContain('NOT_DURABLY_RECORDED');
    expect(path?.affects).toContain('cannot establish zero runs');
    expect(path?.affects).not.toContain('healthy');
  });
});

describe('Capability owner-truth dependency paths', () => {
  it('preserves exact catalog finding identity and affected owner references without recomputing the audit', () => {
    const findingFingerprint = '1'.repeat(64);
    const paths = buildCapabilityDependencyPaths({
      catalogIntegrity: {
        status: 'CATALOG_INTEGRITY_FINDINGS',
        findings: [
          {
            findingId: 'catalog-finding-1',
            findingFingerprintSha256: findingFingerprint,
            code: 'STALE_CAPABILITY_VERSION',
            capabilityId: 'capability.alpha',
            runtimeCapability: {
              runtimeCapabilityDefinitionId: 'runtime-capability_alpha',
              version: 2,
              capabilityId: 'capability.alpha',
              capabilityVersion: '2'
            },
            implementationProfiles: [
              {
                implementationProfileId: 'profile-alpha',
                version: 3,
                status: 'APPROVED',
                implementationKey: 'alpha.impl'
              }
            ]
          }
        ]
      },
      sourcePolicyBindingIntegrity: { status: 'SOURCE_POLICY_BINDINGS_HEALTHY', findings: [] },
      implementationProfiles: []
    });

    const path = paths.find((item) => item.id === 'capability-catalog:catalog-finding-1');
    expect(path?.why).toContain('STALE_CAPABILITY_VERSION');
    expect(path?.affects).toContain('runtime-capability_alpha');
    expect(path?.affects).toContain('profile-alpha');
    expect(path?.evidence).toContainEqual({
      label: 'Finding fingerprint',
      value: findingFingerprint
    });
    expect(path?.affects).toContain(
      'No source-currentness, method-correctness or product-readiness'
    );
  });

  it('preserves source-policy finding policy fingerprint and exact current binding references', () => {
    const policyFingerprint = '2'.repeat(64);
    const paths = buildCapabilityDependencyPaths({
      catalogIntegrity: { status: 'CATALOG_HEALTHY', findings: [] },
      sourcePolicyBindingIntegrity: {
        status: 'SOURCE_POLICY_BINDING_FINDINGS',
        findings: [
          {
            findingId: 'binding-finding-1',
            findingFingerprintSha256: '3'.repeat(64),
            code: 'PROFILE_VERSION_MISMATCH',
            policy: {
              policyId: 'policy-alpha',
              policyVersion: 4,
              policyFingerprintSha256: policyFingerprint,
              maturityClass: 'PRODUCTION_ADMISSIBLE',
              capabilityId: 'capability.alpha',
              capabilityVersion: '2',
              implementationProfileId: 'profile-alpha',
              implementationProfileVersion: 3
            },
            currentRuntimeCapability: {
              runtimeCapabilityDefinitionId: 'runtime-capability_alpha',
              version: 2,
              capabilityId: 'capability.alpha',
              capabilityVersion: '2'
            },
            currentImplementationProfile: {
              implementationProfileId: 'profile-alpha',
              version: 5,
              status: 'APPROVED',
              capabilityId: 'capability.alpha',
              capabilityVersion: '2',
              implementationKey: 'alpha.impl'
            }
          }
        ]
      },
      implementationProfiles: []
    });

    const path = paths.find((item) => item.id === 'capability-source-policy:binding-finding-1');
    expect(path?.currentState).toContain('policy-alpha v4');
    expect(path?.affects).toContain('profile-alpha v3');
    expect(path?.affects).toContain('current profile profile-alpha v5');
    expect(path?.evidence).toContainEqual({
      label: 'Policy fingerprint',
      value: policyFingerprint
    });
    expect(path?.affects).toContain('No Method/Reference currentness');
  });

  it('connects structural capability records only through exact owner identities and exact policy profile binding', () => {
    const paths = buildCapabilityDependencyPaths({
      catalogIntegrity: { status: 'CATALOG_HEALTHY', findings: [] },
      sourcePolicyBindingIntegrity: { status: 'SOURCE_POLICY_BINDINGS_HEALTHY', findings: [] },
      runtimeCapabilities: [
        {
          runtimeCapabilityDefinitionId: 'runtime-capability_alpha',
          version: 2,
          capabilityId: 'capability.alpha',
          capabilityVersion: '2',
          canonReference: { sourceFingerprintSha256: '4'.repeat(64) }
        }
      ],
      implementationProfiles: [
        {
          implementationProfileId: 'profile-alpha',
          version: 3,
          status: 'APPROVED',
          capabilityId: 'capability.alpha',
          capabilityVersion: '2',
          implementationKey: 'alpha.impl'
        }
      ],
      sourceAdmissionPolicies: [
        {
          policyId: 'policy-alpha',
          policyVersion: 4,
          policyFingerprintSha256: '5'.repeat(64),
          maturityClass: 'PRODUCTION_ADMISSIBLE',
          capabilityId: 'capability.alpha',
          capabilityVersion: '2',
          implementationProfileId: 'profile-alpha',
          implementationProfileVersion: 3
        },
        {
          policyId: 'policy-unrelated',
          policyVersion: 1,
          policyFingerprintSha256: '6'.repeat(64),
          maturityClass: 'PILOT',
          capabilityId: 'capability.alpha',
          capabilityVersion: '2',
          implementationProfileId: 'different-profile',
          implementationProfileVersion: 1
        }
      ]
    });

    const path = paths.find((item) => item.id === 'capability-chain:profile-alpha:3');
    expect(path?.kind).toBe('DEPENDENCY');
    expect(path?.dependency).toContain('1 source-admission policy record');
    expect(path?.evidence).toContainEqual({ label: 'Policy 1 id', value: 'policy-alpha' });
    expect(path?.evidence).not.toContainEqual({ label: 'Policy 2 id', value: 'policy-unrelated' });
    expect(path?.affects).toContain('APPROVED profile status is not source admission');
  });

  it('keeps missing or malformed owner audit states unknown instead of manufacturing health', () => {
    const paths = buildCapabilityDependencyPaths({
      implementationProfiles: [],
      catalogIntegrity: {},
      sourcePolicyBindingIntegrity: {}
    });

    expect(paths.map((path) => path.id)).toEqual([
      'capability-catalog:unestablished',
      'capability-source-policy:unestablished'
    ]);
    expect(paths.every((path) => path.kind === 'UNKNOWN')).toBe(true);
  });

  it('states the permanent integrity boundary explicitly', () => {
    expect(CAPABILITY_INTEGRITY_BOUNDARY).toContain(
      'Healthy integrity does not establish source currentness'
    );
    expect(CAPABILITY_INTEGRITY_BOUNDARY).toContain('method correctness');
    expect(CAPABILITY_INTEGRITY_BOUNDARY).toContain('product readiness');
    expect(CAPABILITY_INTEGRITY_BOUNDARY).toContain('Official Truth');
  });
});
