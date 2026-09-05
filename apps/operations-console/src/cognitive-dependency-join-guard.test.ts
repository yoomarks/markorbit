import { describe, expect, it } from 'vitest';
import { buildCapabilityDependencyPaths } from './cognitive-dependency-paths.js';

describe('Capability dependency exact identity guard', () => {
  it('does not connect records when required join identities are absent', () => {
    const paths = buildCapabilityDependencyPaths({
      catalogIntegrity: { status: 'CATALOG_HEALTHY', findings: [] },
      sourcePolicyBindingIntegrity: { status: 'SOURCE_POLICY_BINDINGS_HEALTHY', findings: [] },
      runtimeCapabilities: [
        {
          runtimeCapabilityDefinitionId: 'runtime-with-missing-identity',
          version: 1
        }
      ],
      implementationProfiles: [
        {
          implementationProfileId: 'profile-with-missing-identity',
          version: 1,
          status: 'APPROVED'
        }
      ],
      sourceAdmissionPolicies: [
        {
          policyId: 'policy-with-missing-identity',
          policyVersion: 1,
          implementationProfileVersion: 1
        }
      ]
    });

    const path = paths.find(
      (item) => item.id === 'capability-chain:profile-with-missing-identity:1'
    );

    expect(path?.kind).toBe('UNKNOWN');
    expect(path?.currentState).toContain('no exact Runtime Capability record');
    expect(path?.dependency).toContain('No source-admission policy binding is established');
    expect(path?.evidence).not.toContainEqual({
      label: 'Policy 1 id',
      value: 'policy-with-missing-identity'
    });
  });
});
