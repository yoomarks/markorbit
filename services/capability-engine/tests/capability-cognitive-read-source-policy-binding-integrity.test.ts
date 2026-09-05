import { describe, expect, it, vi } from 'vitest';
import { CapabilityCognitiveReadServiceV1 } from '../src/capability-cognitive-read.js';
import { CapabilitySourcePolicyBindingIntegrityAuditorV1 } from '../src/source-policy-binding-integrity.js';
import { usptoOfficialFeeSourceAdmissionPolicyV2 } from '../src/source-admission-policy-catalog.js';
import {
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION,
  USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE
} from '../src/uspto-official-fee-resolver-pilot.js';

function service(
  capabilities = [USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION],
  profiles = [USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE],
  policies = [usptoOfficialFeeSourceAdmissionPolicyV2]
) {
  const capabilityList = vi.fn(() => Promise.resolve(capabilities));
  const profileList = vi.fn(() => Promise.resolve(profiles));
  const policyList = vi.fn(() => policies);
  return {
    capabilityList,
    profileList,
    policyList,
    service: new CapabilityCognitiveReadServiceV1(
      { listCurrent: capabilityList },
      { listCurrent: profileList },
      () => '2026-09-05T02:30:00.000Z',
      { list: policyList }
    )
  };
}

describe('Capability cognitive source-policy binding integrity projection', () => {
  it('projects exact healthy owner audit from the same single-read snapshot', async () => {
    const fixture = service();
    const projection = await fixture.service.read();
    const ownerAudit = await new CapabilitySourcePolicyBindingIntegrityAuditorV1({
      capabilities: { listCurrent: () => [USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION] },
      implementations: { listCurrent: () => [USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE] },
      policies: { list: () => [usptoOfficialFeeSourceAdmissionPolicyV2] }
    }).audit();

    expect(fixture.capabilityList).toHaveBeenCalledOnce();
    expect(fixture.profileList).toHaveBeenCalledOnce();
    expect(fixture.policyList).toHaveBeenCalledOnce();
    expect(ownerAudit.status).toBe('SOURCE_POLICY_BINDINGS_HEALTHY');
    if (ownerAudit.status === 'SOURCE_POLICY_BINDING_AUDIT_UNAVAILABLE') {
      throw new Error('unexpected unavailable audit');
    }
    expect(projection.sourcePolicyBindingIntegrity).toEqual({
      status: ownerAudit.status,
      snapshotFingerprintSha256: ownerAudit.snapshot.snapshotFingerprintSha256,
      auditFingerprintSha256: ownerAudit.auditFingerprintSha256,
      findings: [],
      authority: ownerAudit.authority
    });
  });

  it('projects exact stale policy/profile finding identity without duplicating owner documents', async () => {
    const staleProfile = {
      ...USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE,
      version: USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.version + 1
    };
    const projection = await service(
      [USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION],
      [staleProfile],
      [usptoOfficialFeeSourceAdmissionPolicyV2]
    ).service.read();

    expect(projection.sourcePolicyBindingIntegrity.status).toBe('SOURCE_POLICY_BINDING_FINDINGS');
    if (projection.sourcePolicyBindingIntegrity.status !== 'SOURCE_POLICY_BINDING_FINDINGS') {
      throw new Error('expected source policy binding finding');
    }
    expect(projection.sourcePolicyBindingIntegrity.findings).toHaveLength(1);
    expect(projection.sourcePolicyBindingIntegrity.findings[0]).toMatchObject({
      code: 'STALE_SOURCE_POLICY_IMPLEMENTATION_VERSION',
      policy: {
        policyId: usptoOfficialFeeSourceAdmissionPolicyV2.policyId,
        policyVersion: usptoOfficialFeeSourceAdmissionPolicyV2.policyVersion,
        capabilityId: usptoOfficialFeeSourceAdmissionPolicyV2.capabilityId,
        implementationProfileId: usptoOfficialFeeSourceAdmissionPolicyV2.implementationProfileId
      },
      currentImplementationProfile: {
        implementationProfileId: staleProfile.implementationProfileId,
        version: staleProfile.version,
        status: 'APPROVED'
      }
    });
    expect(projection.sourcePolicyBindingIntegrity.findings[0]).not.toHaveProperty(
      'allowedCallerProducts'
    );
    expect(projection.sourcePolicyBindingIntegrity.findings[0]).not.toHaveProperty('timeoutMs');
  });

  it('keeps source-policy binding integrity separate from Runtime/Profile catalog integrity', async () => {
    const staleProfile = {
      ...USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE,
      version: USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.version + 1
    };
    const projection = await service(
      [USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION],
      [staleProfile],
      [usptoOfficialFeeSourceAdmissionPolicyV2]
    ).service.read();

    expect(projection.catalogIntegrity.status).toBe('CATALOG_HEALTHY');
    expect(projection.sourcePolicyBindingIntegrity.status).toBe('SOURCE_POLICY_BINDING_FINDINGS');
  });
});
