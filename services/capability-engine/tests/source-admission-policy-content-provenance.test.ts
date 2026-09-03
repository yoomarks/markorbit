import { describe, expect, it } from 'vitest';
import type { CapabilityRuntimeExecution } from '../src/capability-runtime.js';
import {
  CN_DURATION_ANALYTICAL_CAPABILITY_DEFINITION,
  CN_DURATION_ANALYTICAL_IMPLEMENTATION_PROFILE
} from '../src/cn-duration-analytical-pilot.js';
import type { CapabilitySourceAdmissionPolicyInput } from '../src/current-source-admission.js';
import {
  CapabilitySourceAdmissionPolicyCatalogV1,
  currentCapabilitySourceAdmissionPoliciesV1,
  currentCapabilitySourceAdmissionPolicyCatalogV1,
  type CapabilitySourceAdmissionPolicyEntryV1
} from '../src/source-admission-policy-catalog.js';
import {
  CapabilitySourceAdmissionPolicyCatalogContentProvenanceV1,
  capabilitySourceAdmissionPolicyFingerprintV1,
  currentCapabilitySourceAdmissionPolicyContentProvenanceV1
} from '../src/source-admission-policy-content-provenance.js';

function policyInput(): CapabilitySourceAdmissionPolicyInput {
  return {
    execution: {
      request: {
        capabilityId: CN_DURATION_ANALYTICAL_CAPABILITY_DEFINITION.capabilityId,
        capabilityVersion: CN_DURATION_ANALYTICAL_CAPABILITY_DEFINITION.capabilityVersion,
        inputSchemaId: CN_DURATION_ANALYTICAL_IMPLEMENTATION_PROFILE.inputSchemaId,
        outputSchemaId: CN_DURATION_ANALYTICAL_IMPLEMENTATION_PROFILE.outputSchemaId,
        riskClass: 'LOW',
        caller: { callerProduct: 'MARKREG' }
      }
    } as unknown as CapabilityRuntimeExecution,
    currentCapability: CN_DURATION_ANALYTICAL_CAPABILITY_DEFINITION,
    currentImplementation: CN_DURATION_ANALYTICAL_IMPLEMENTATION_PROFILE
  };
}

function productionPolicy(
  overrides: Partial<CapabilitySourceAdmissionPolicyEntryV1> = {}
): CapabilitySourceAdmissionPolicyEntryV1 {
  return {
    schemaVersion: 1,
    policyId: 'source-admission-policy.content-proof.v1',
    policyVersion: 7,
    maturityClass: 'PRODUCTION_ADMISSIBLE',
    capabilityId: CN_DURATION_ANALYTICAL_CAPABILITY_DEFINITION.capabilityId,
    capabilityVersion: CN_DURATION_ANALYTICAL_CAPABILITY_DEFINITION.capabilityVersion,
    implementationProfileId: CN_DURATION_ANALYTICAL_IMPLEMENTATION_PROFILE.implementationProfileId,
    implementationProfileVersion: CN_DURATION_ANALYTICAL_IMPLEMENTATION_PROFILE.version,
    implementationKey: CN_DURATION_ANALYTICAL_IMPLEMENTATION_PROFILE.implementationKey,
    inputSchemaId: CN_DURATION_ANALYTICAL_IMPLEMENTATION_PROFILE.inputSchemaId,
    outputSchemaId: CN_DURATION_ANALYTICAL_IMPLEMENTATION_PROFILE.outputSchemaId,
    allowedCallerProducts: ['MARKREG', 'LITE'],
    maximumRiskClass: 'LOW',
    methodCurrentness: 'NOT_REQUIRED',
    referenceCurrentness: 'NOT_REQUIRED',
    ...overrides
  } as CapabilitySourceAdmissionPolicyEntryV1;
}

describe('Capability source-admission policy content provenance', () => {
  it('binds a supported result to a deterministic content-addressed policy identity', () => {
    const authority = new CapabilitySourceAdmissionPolicyCatalogContentProvenanceV1(
      new CapabilitySourceAdmissionPolicyCatalogV1([productionPolicy()])
    );

    const result = authority.evaluate(policyInput());
    expect(result).toMatchObject({
      applicability: 'SUPPORTED',
      policy: {
        policyId: 'source-admission-policy.content-proof.v1',
        policyVersion: 7
      },
      methodCurrentness: 'NOT_REQUIRED',
      referenceCurrentness: 'NOT_REQUIRED'
    });
    if (result.applicability !== 'SUPPORTED') {
      throw new Error('test production policy unexpectedly failed admission');
    }
    expect(result.policy.policyFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.policy.policyFingerprintSha256).toBe(
      capabilitySourceAdmissionPolicyFingerprintV1(productionPolicy())
    );
  });

  it('changes content identity for semantic policy drift even when id and version are reused', () => {
    const first = new CapabilitySourceAdmissionPolicyCatalogContentProvenanceV1(
      new CapabilitySourceAdmissionPolicyCatalogV1([productionPolicy()])
    ).evaluate(policyInput());
    const second = new CapabilitySourceAdmissionPolicyCatalogContentProvenanceV1(
      new CapabilitySourceAdmissionPolicyCatalogV1([
        productionPolicy({ maximumRiskClass: 'MODERATE' })
      ])
    ).evaluate(policyInput());

    expect(first.applicability).toBe('SUPPORTED');
    expect(second.applicability).toBe('SUPPORTED');
    if (first.applicability !== 'SUPPORTED' || second.applicability !== 'SUPPORTED') {
      throw new Error('test production policy unexpectedly failed admission');
    }
    expect(second.policy.policyId).toBe(first.policy.policyId);
    expect(second.policy.policyVersion).toBe(first.policy.policyVersion);
    expect(second.policy.policyFingerprintSha256).not.toBe(first.policy.policyFingerprintSha256);
  });

  it('canonicalizes caller-product ordering because caller order has no admission semantics', () => {
    const first = capabilitySourceAdmissionPolicyFingerprintV1(
      productionPolicy({ allowedCallerProducts: ['MARKREG', 'LITE'] })
    );
    const second = capabilitySourceAdmissionPolicyFingerprintV1(
      productionPolicy({ allowedCallerProducts: ['LITE', 'MARKREG'] })
    );

    expect(second).toBe(first);
  });

  it('does not manufacture content provenance for the three current CN PILOT policies', () => {
    expect(currentCapabilitySourceAdmissionPoliciesV1).toHaveLength(4);
    expect(
      currentCapabilitySourceAdmissionPoliciesV1.filter((entry) => entry.maturityClass === 'PILOT')
    ).toHaveLength(3);
    expect(
      currentCapabilitySourceAdmissionPoliciesV1.filter(
        (entry) => entry.maturityClass === 'PRODUCTION_ADMISSIBLE'
      )
    ).toHaveLength(1);
    expect(currentCapabilitySourceAdmissionPolicyCatalogV1.evaluate(policyInput())).toMatchObject({
      applicability: 'UNSUPPORTED'
    });
    expect(
      currentCapabilitySourceAdmissionPolicyContentProvenanceV1.evaluate(policyInput())
    ).toMatchObject({
      applicability: 'UNSUPPORTED'
    });
  });
});
