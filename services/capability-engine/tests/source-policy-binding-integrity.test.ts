import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  CapabilitySourcePolicyBindingIntegrityAuditorV1,
  capabilitySourcePolicyBindingIntegrityNoAuthority
} from '../src/source-policy-binding-integrity.js';
import {
  usptoOfficialFeeSourceAdmissionPolicyV2,
  type CapabilitySourceAdmissionPolicyEntryV1
} from '../src/source-admission-policy-catalog.js';
import { materializeCapabilitySourceAdmissionPolicyContentIdentityV1 } from '../src/source-admission-policy-content-provenance.js';
import {
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION,
  USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE
} from '../src/uspto-official-fee-resolver-pilot.js';

function auditor(
  capabilities = [USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION],
  profiles = [USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE],
  policies: readonly Readonly<CapabilitySourceAdmissionPolicyEntryV1>[] = [
    usptoOfficialFeeSourceAdmissionPolicyV2
  ]
) {
  return new CapabilitySourcePolicyBindingIntegrityAuditorV1({
    capabilities: { listCurrent: () => capabilities },
    implementations: { listCurrent: () => profiles },
    policies: { list: () => policies }
  });
}

test('healthy current source-policy binding is deterministic and preserves exact policy content identity', async () => {
  const result = await auditor().audit();
  assert.equal(result.status, 'SOURCE_POLICY_BINDINGS_HEALTHY');
  assert.deepEqual(result.findings, []);
  assert.match(result.snapshot.snapshotFingerprintSha256, /^[0-9a-f]{64}$/);
  assert.match(result.auditFingerprintSha256, /^[0-9a-f]{64}$/);
  assert.equal(
    result.snapshot.sourceAdmissionPolicies[0]?.policyFingerprintSha256,
    materializeCapabilitySourceAdmissionPolicyContentIdentityV1(
      usptoOfficialFeeSourceAdmissionPolicyV2
    ).policyFingerprintSha256
  );
  assert.deepEqual(result.authority, capabilitySourcePolicyBindingIntegrityNoAuthority);
});

test('detects orphan and stale Capability bindings without changing policy maturity', async () => {
  const orphan = await auditor([], [USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE]).audit();
  assert.equal(orphan.status, 'SOURCE_POLICY_BINDING_FINDINGS');
  assert.equal(orphan.findings[0]?.code, 'ORPHAN_SOURCE_POLICY_CAPABILITY');
  assert.equal(
    orphan.findings[0]?.policy.maturityClass,
    usptoOfficialFeeSourceAdmissionPolicyV2.maturityClass
  );

  const staleCapability = {
    ...USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION,
    capabilityVersion: `${USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION.capabilityVersion}.next`
  };
  const stale = await auditor([staleCapability]).audit();
  assert.equal(stale.status, 'SOURCE_POLICY_BINDING_FINDINGS');
  assert.ok(stale.findings.some((item) => item.code === 'STALE_SOURCE_POLICY_CAPABILITY_VERSION'));
});

test('detects orphan, stale, mismatched and retired current Implementation Profile bindings', async () => {
  const orphan = await auditor([USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION], []).audit();
  assert.equal(orphan.status, 'SOURCE_POLICY_BINDING_FINDINGS');
  assert.equal(orphan.findings[0]?.code, 'ORPHAN_SOURCE_POLICY_IMPLEMENTATION');

  const staleProfile = {
    ...USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE,
    version: USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.version + 1
  };
  const stale = await auditor(
    [USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION],
    [staleProfile]
  ).audit();
  assert.equal(stale.status, 'SOURCE_POLICY_BINDING_FINDINGS');
  assert.equal(stale.findings[0]?.code, 'STALE_SOURCE_POLICY_IMPLEMENTATION_VERSION');

  const mismatchedPolicy = {
    ...usptoOfficialFeeSourceAdmissionPolicyV2,
    implementationKey: `${usptoOfficialFeeSourceAdmissionPolicyV2.implementationKey}.drift`
  } satisfies CapabilitySourceAdmissionPolicyEntryV1;
  const mismatched = await auditor(
    [USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION],
    [USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE],
    [mismatchedPolicy]
  ).audit();
  assert.equal(mismatched.status, 'SOURCE_POLICY_BINDING_FINDINGS');
  assert.equal(mismatched.findings[0]?.code, 'SOURCE_POLICY_IMPLEMENTATION_BINDING_MISMATCH');

  const retiredProfile = {
    ...USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE,
    status: 'RETIRED' as const
  };
  const retired = await auditor(
    [USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION],
    [retiredProfile]
  ).audit();
  assert.equal(retired.status, 'SOURCE_POLICY_BINDING_FINDINGS');
  assert.equal(retired.findings[0]?.code, 'SOURCE_POLICY_IMPLEMENTATION_NOT_APPROVED');
});

test('policy caller and risk narrowing are not treated as structural binding corruption', async () => {
  const narrowedPolicy = {
    ...usptoOfficialFeeSourceAdmissionPolicyV2,
    allowedCallerProducts: [usptoOfficialFeeSourceAdmissionPolicyV2.allowedCallerProducts[0]!]
  } satisfies CapabilitySourceAdmissionPolicyEntryV1;
  const result = await auditor(
    [USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION],
    [USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE],
    [narrowedPolicy]
  ).audit();
  assert.equal(result.status, 'SOURCE_POLICY_BINDINGS_HEALTHY');
});

test('input ordering does not change snapshot or audit fingerprints', async () => {
  const secondPolicy = {
    ...usptoOfficialFeeSourceAdmissionPolicyV2,
    policyId: `${usptoOfficialFeeSourceAdmissionPolicyV2.policyId}.second`
  } satisfies CapabilitySourceAdmissionPolicyEntryV1;
  const forward = await auditor(
    [USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION],
    [USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE],
    [usptoOfficialFeeSourceAdmissionPolicyV2, secondPolicy]
  ).audit();
  const reversed = await auditor(
    [USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION],
    [USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE],
    [secondPolicy, usptoOfficialFeeSourceAdmissionPolicyV2]
  ).audit();
  assert.notEqual(forward.status, 'SOURCE_POLICY_BINDING_AUDIT_UNAVAILABLE');
  assert.notEqual(reversed.status, 'SOURCE_POLICY_BINDING_AUDIT_UNAVAILABLE');
  if (
    forward.status === 'SOURCE_POLICY_BINDING_AUDIT_UNAVAILABLE' ||
    reversed.status === 'SOURCE_POLICY_BINDING_AUDIT_UNAVAILABLE'
  )
    assert.fail('audit unavailable');
  assert.equal(
    forward.snapshot.snapshotFingerprintSha256,
    reversed.snapshot.snapshotFingerprintSha256
  );
  assert.equal(forward.auditFingerprintSha256, reversed.auditFingerprintSha256);
  assert.deepEqual(forward.findings, reversed.findings);
});

test('empty policy catalog is a known healthy state', async () => {
  const result = await auditor([], [], []).audit();
  assert.equal(result.status, 'SOURCE_POLICY_BINDINGS_HEALTHY');
  assert.deepEqual(result.snapshot.sourceAdmissionPolicies, []);
  assert.deepEqual(result.findings, []);
});

test('dependency failures are explicit and never become healthy empty results', async () => {
  const capabilityUnavailable = await new CapabilitySourcePolicyBindingIntegrityAuditorV1({
    capabilities: {
      listCurrent: () => Promise.reject(new Error('capability unavailable'))
    },
    implementations: { listCurrent: () => [USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE] },
    policies: { list: () => [usptoOfficialFeeSourceAdmissionPolicyV2] }
  }).audit();
  assert.deepEqual(capabilityUnavailable, {
    schemaVersion: 1,
    status: 'SOURCE_POLICY_BINDING_AUDIT_UNAVAILABLE',
    unavailableDependency: 'CURRENT_CAPABILITY_CATALOG_AUTHORITY',
    findings: [],
    authority: capabilitySourcePolicyBindingIntegrityNoAuthority
  });

  const implementationUnavailable = await new CapabilitySourcePolicyBindingIntegrityAuditorV1({
    capabilities: { listCurrent: () => [USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION] },
    implementations: {
      listCurrent: () => Promise.reject(new Error('implementation unavailable'))
    },
    policies: { list: () => [usptoOfficialFeeSourceAdmissionPolicyV2] }
  }).audit();
  assert.equal(
    implementationUnavailable.status === 'SOURCE_POLICY_BINDING_AUDIT_UNAVAILABLE'
      ? implementationUnavailable.unavailableDependency
      : undefined,
    'CURRENT_IMPLEMENTATION_CATALOG_AUTHORITY'
  );

  const policyUnavailable = await new CapabilitySourcePolicyBindingIntegrityAuditorV1({
    capabilities: { listCurrent: () => [USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION] },
    implementations: { listCurrent: () => [USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE] },
    policies: { list: () => Promise.reject(new Error('policy unavailable')) }
  }).audit();
  assert.equal(
    policyUnavailable.status === 'SOURCE_POLICY_BINDING_AUDIT_UNAVAILABLE'
      ? policyUnavailable.unavailableDependency
      : undefined,
    'SOURCE_ADMISSION_POLICY_CATALOG_AUTHORITY'
  );
});
