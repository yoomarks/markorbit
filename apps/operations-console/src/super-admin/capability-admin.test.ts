import { describe, expect, it } from 'vitest';
import { buildCapabilityAdminViewModel } from './capability-admin.js';

describe('Super Admin Capability owner projection', () => {
  it('preserves current registries, policies and owner integrity objects', () => {
    const catalogIntegrity = {
      status: 'CATALOG_HEALTHY',
      snapshotFingerprintSha256: 'a'.repeat(64),
      auditFingerprintSha256: 'b'.repeat(64),
      findings: []
    };
    const sourcePolicyBindingIntegrity = {
      status: 'SOURCE_POLICY_BINDINGS_HEALTHY',
      snapshotFingerprintSha256: 'c'.repeat(64),
      auditFingerprintSha256: 'd'.repeat(64),
      findings: []
    };
    const model = buildCapabilityAdminViewModel({
      source: { domain: 'CAPABILITY_ENGINE', authority: 'control-plane:cognitive:read' },
      sourceAdmissionPolicySource: { authority: 'CAPABILITY_ENGINE' },
      summary: {
        runtimeCapabilityCount: 1,
        implementationProfileCount: 1,
        sourceAdmissionPolicyCount: 1
      },
      runtimeCapabilities: [{ capabilityId: 'capability.alpha', capabilityVersion: '1' }],
      implementationProfiles: [{ implementationProfileId: 'profile-alpha', status: 'APPROVED' }],
      sourceAdmissionPolicies: [{ policyId: 'policy-alpha', policyVersion: 1 }],
      catalogIntegrity,
      sourcePolicyBindingIntegrity
    });
    expect(model.owner).toBe('CAPABILITY_ENGINE');
    expect(model.authority).toBe('control-plane:cognitive:read');
    expect(model.runtimeCount).toBe('1');
    expect(model.profileCount).toBe('1');
    expect(model.policyCount).toBe('1');
    expect(model.runtimeCapabilities).toHaveLength(1);
    expect(model.implementationProfiles).toHaveLength(1);
    expect(model.sourcePolicies).toHaveLength(1);
    expect(model.catalogIntegrity).toBe(catalogIntegrity);
    expect(model.sourcePolicyBindingIntegrity).toEqual(sourcePolicyBindingIntegrity);
  });

  it('keeps missing summary truth unavailable rather than zero', () => {
    const model = buildCapabilityAdminViewModel({
      runtimeCapabilities: [],
      implementationProfiles: [],
      sourceAdmissionPolicies: []
    });
    expect(model.runtimeCount).toBe('Unavailable');
    expect(model.profileCount).toBe('Unavailable');
    expect(model.policyCount).toBe('Unavailable');
    expect(model.sourcePolicyBindingIntegrity).toEqual({});
  });
});
