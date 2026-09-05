import { describe, expect, it } from 'vitest';
import { buildCognitiveAttentionItems } from './cognitive-attention.js';

describe('Cognitive attention derivation', () => {
  it('does not promote ordinary exact dependency chains into attention', () => {
    const items = buildCognitiveAttentionItems({
      core: {
        status: 'available',
        value: {
          brainGaps: [],
          methodImprovements: [],
          brainBuildRuns: { availability: 'AVAILABLE', inventory: [] }
        }
      },
      capability: {
        status: 'available',
        value: {
          catalogIntegrity: { status: 'CATALOG_HEALTHY', findings: [] },
          sourcePolicyBindingIntegrity: {
            status: 'SOURCE_POLICY_BINDINGS_HEALTHY',
            findings: []
          },
          runtimeCapabilities: [
            {
              runtimeCapabilityDefinitionId: 'runtime-alpha',
              version: 1,
              capabilityId: 'capability.alpha',
              capabilityVersion: '1'
            }
          ],
          implementationProfiles: [
            {
              implementationProfileId: 'profile-alpha',
              version: 2,
              status: 'APPROVED',
              capabilityId: 'capability.alpha',
              capabilityVersion: '1'
            }
          ],
          sourceAdmissionPolicies: [
            {
              policyId: 'policy-alpha',
              policyVersion: 3,
              implementationProfileId: 'profile-alpha',
              implementationProfileVersion: 2,
              capabilityId: 'capability.alpha',
              capabilityVersion: '1',
              maturityClass: 'PRODUCTION_ADMISSIBLE'
            }
          ]
        }
      }
    });

    expect(items).toEqual([]);
  });

  it('maps blocker and recording limitation without creating mutation authority', () => {
    const items = buildCognitiveAttentionItems({
      core: {
        status: 'available',
        value: {
          brainGaps: [
            {
              brainGapRegistryKey: 'brain-gap:duration',
              status: 'OPEN',
              gapType: 'PERFORMANCE_GAP',
              businessImpact: 'Duration confidence is insufficient.',
              targetModule: 'cn-duration',
              reasonCode: 'INSUFFICIENT_EVIDENCE'
            }
          ],
          methodImprovements: [],
          brainBuildRuns: {
            availability: 'NOT_DURABLY_RECORDED',
            inventory: null,
            reasonCode: 'NO_DURABLE_BUILD_RUN_REGISTRY'
          }
        }
      },
      capability: {
        status: 'available',
        value: {
          catalogIntegrity: { status: 'CATALOG_HEALTHY', findings: [] },
          sourcePolicyBindingIntegrity: {
            status: 'SOURCE_POLICY_BINDINGS_HEALTHY',
            findings: []
          },
          implementationProfiles: []
        }
      }
    });

    expect(items.map((item) => item.group)).toEqual([
      'HUMAN_GOVERNANCE_ATTENTION',
      'OBSERVABILITY_RECORDING_LIMITATION'
    ]);
    expect(items.every((item) => item.controlMode === 'VIEW_ONLY')).toBe(true);
    expect(items.every((item) => item.resolutionMode === 'EXTERNAL_OWNER_DEPENDENCY')).toBe(true);
    expect(items[0]?.nextLegalStep).toContain('No operator mutation');
    expect(items[1]?.currentState).toContain('NOT_DURABLY_RECORDED');
  });

  it('preserves exact capability findings and groups unavailable owner audit separately', () => {
    const items = buildCognitiveAttentionItems({
      core: {
        status: 'available',
        value: {
          brainGaps: [],
          methodImprovements: [],
          brainBuildRuns: { availability: 'AVAILABLE', inventory: [] }
        }
      },
      capability: {
        status: 'available',
        value: {
          catalogIntegrity: {
            status: 'CATALOG_AUDIT_UNAVAILABLE',
            unavailableDependency: 'CAPABILITY_CATALOG_SOURCE'
          },
          sourcePolicyBindingIntegrity: {
            status: 'SOURCE_POLICY_BINDING_FINDINGS',
            findings: [
              {
                findingId: 'binding-finding-1',
                findingFingerprintSha256: 'a'.repeat(64),
                code: 'PROFILE_VERSION_MISMATCH',
                policy: {
                  policyId: 'policy-alpha',
                  policyVersion: 4,
                  policyFingerprintSha256: 'b'.repeat(64),
                  capabilityId: 'capability.alpha',
                  capabilityVersion: '1',
                  implementationProfileId: 'profile-alpha',
                  implementationProfileVersion: 2
                }
              }
            ]
          },
          implementationProfiles: []
        }
      }
    });

    expect(items.map((item) => item.group)).toEqual([
      'INTEGRITY_CURRENTNESS_FINDING',
      'SOURCE_DEPENDENCY_UNAVAILABLE'
    ]);
    expect(items[0]?.evidence).toContainEqual({
      label: 'Finding fingerprint',
      value: 'a'.repeat(64)
    });
    expect(items[0]?.why).toContain('PROFILE_VERSION_MISMATCH');
    expect(items[1]?.currentState).toContain('CATALOG_AUDIT_UNAVAILABLE');
  });

  it('keeps owner read unavailable distinct from known-empty owner state', () => {
    const items = buildCognitiveAttentionItems({
      core: {
        status: 'unavailable',
        error: {
          status: 503,
          code: 'CORE_OWNER_UNAVAILABLE',
          message: 'Core read dependency is unavailable.'
        }
      },
      capability: {
        status: 'available',
        value: {
          catalogIntegrity: { status: 'CATALOG_HEALTHY', findings: [] },
          sourcePolicyBindingIntegrity: {
            status: 'SOURCE_POLICY_BINDINGS_HEALTHY',
            findings: []
          },
          implementationProfiles: []
        }
      }
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      owner: 'CORE',
      group: 'SOURCE_DEPENDENCY_UNAVAILABLE',
      controlMode: 'VIEW_ONLY',
      resolutionMode: 'EXTERNAL_OWNER_DEPENDENCY'
    });
    expect(items[0]?.affects).toContain('unavailable is not known-empty, healthy or ready');
    expect(items[0]?.evidence).toContainEqual({ label: 'HTTP status', value: '503' });
  });

  it('treats missing exact structural bindings as unavailable dependency attention, not a finding', () => {
    const items = buildCognitiveAttentionItems({
      core: {
        status: 'available',
        value: {
          brainGaps: [],
          methodImprovements: [],
          brainBuildRuns: { availability: 'AVAILABLE', inventory: [] }
        }
      },
      capability: {
        status: 'available',
        value: {
          catalogIntegrity: { status: 'CATALOG_HEALTHY', findings: [] },
          sourcePolicyBindingIntegrity: {
            status: 'SOURCE_POLICY_BINDINGS_HEALTHY',
            findings: []
          },
          runtimeCapabilities: [],
          implementationProfiles: [
            {
              implementationProfileId: 'profile-unbound',
              version: 1,
              status: 'APPROVED',
              capabilityId: 'capability.unbound',
              capabilityVersion: '1'
            }
          ],
          sourceAdmissionPolicies: []
        }
      }
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.group).toBe('SOURCE_DEPENDENCY_UNAVAILABLE');
    expect(items[0]?.needsAttention).toContain('not established');
    expect(items[0]?.nextLegalStep).toContain('Owner truth must establish the relationship');
  });
});
