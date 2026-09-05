import { describe, expect, it, vi } from 'vitest';
import {
  CapabilityCognitiveReadServiceV1,
  type CurrentSourceAdmissionPolicyReadV1
} from '../src/capability-cognitive-read.js';
import {
  currentCapabilitySourceAdmissionPolicyCatalogV1
} from '../src/source-admission-policy-catalog.js';
import {
  materializeCapabilitySourceAdmissionPolicyContentIdentityV1
} from '../src/source-admission-policy-content-provenance.js';

function service(
  sourceAdmissionPolicies?: Readonly<CurrentSourceAdmissionPolicyReadV1>
) {
  return new CapabilityCognitiveReadServiceV1(
    { listCurrent: vi.fn(() => Promise.resolve([])) },
    { listCurrent: vi.fn(() => Promise.resolve([])) },
    () => '2026-09-05T00:00:00.000Z',
    sourceAdmissionPolicies
  );
}

function pilotPolicy(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    policyId: 'source-admission-policy.test.v1',
    policyVersion: 1,
    maturityClass: 'PILOT',
    capabilityId: 'test-capability',
    capabilityVersion: '1.0.0',
    implementationProfileId: 'implementation-profile_test',
    implementationProfileVersion: 1,
    implementationKey: 'test:implementation:v1',
    inputSchemaId: 'test-input.v1',
    outputSchemaId: 'test-output.v1',
    allowedCallerProducts: ['MARKREG', 'LITE'],
    maximumRiskClass: 'MODERATE',
    reason: 'This source remains a bounded pilot.',
    ...overrides
  };
}

describe('Capability cognitive read source-policy content identity', () => {
  it('projects exact current policy fingerprints', async () => {
    const projection = await service().read();
    const expected = new Map(
      currentCapabilitySourceAdmissionPolicyCatalogV1.list().map((entry) => [
        entry.policyId,
        materializeCapabilitySourceAdmissionPolicyContentIdentityV1(entry)
          .policyFingerprintSha256
      ])
    );

    expect(projection.sourceAdmissionPolicies).toHaveLength(expected.size);
    for (const policy of projection.sourceAdmissionPolicies) {
      expect(policy.policyFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(policy.policyFingerprintSha256).toBe(expected.get(policy.policyId));
    }
  });

  it('detects material drift at the same id and version', async () => {
    const original = await service({ list: () => [pilotPolicy()] }).read();
    const changed = await service({
      list: () => [
        pilotPolicy({
          reason: 'This source remains pilot for a materially new reason.'
        })
      ]
    }).read();

    expect(original.sourceAdmissionPolicies[0]?.policyId).toBe(
      changed.sourceAdmissionPolicies[0]?.policyId
    );
    expect(original.sourceAdmissionPolicies[0]?.policyVersion).toBe(
      changed.sourceAdmissionPolicies[0]?.policyVersion
    );
    expect(original.sourceAdmissionPolicies[0]?.policyFingerprintSha256).not.toBe(
      changed.sourceAdmissionPolicies[0]?.policyFingerprintSha256
    );
  });

  it('preserves caller-order canonicalization', async () => {
    const first = await service({
      list: () => [
        pilotPolicy({ allowedCallerProducts: ['MARKREG', 'LITE'] })
      ]
    }).read();
    const reordered = await service({
      list: () => [
        pilotPolicy({ allowedCallerProducts: ['LITE', 'MARKREG'] })
      ]
    }).read();

    expect(first.sourceAdmissionPolicies[0]?.allowedCallerProducts).toEqual([
      'LITE',
      'MARKREG'
    ]);
    expect(reordered.sourceAdmissionPolicies[0]?.allowedCallerProducts).toEqual([
      'LITE',
      'MARKREG'
    ]);
    expect(first.sourceAdmissionPolicies[0]?.policyFingerprintSha256).toBe(
      reordered.sourceAdmissionPolicies[0]?.policyFingerprintSha256
    );
  });

  it('does not synthesize decision authority', async () => {
    const projection = await service().read();

    for (const policy of projection.sourceAdmissionPolicies) {
      expect(policy).not.toHaveProperty('admissionDecision');
      expect(policy).not.toHaveProperty('currentness');
      expect(policy).not.toHaveProperty('currentnessStatus');
      expect(policy).not.toHaveProperty('recommendationCapability');
      expect(policy).not.toHaveProperty('officialTruth');
    }
  });
});
