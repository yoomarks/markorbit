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
  CapabilitySourceAdmissionPolicyCatalogProvenanceV1,
  currentCapabilitySourceAdmissionPolicyProvenanceV1
} from '../src/source-admission-policy-provenance.js';

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
    policyId: 'source-admission-policy.provenance-test.v1',
    policyVersion: 7,
    maturityClass: 'PRODUCTION_ADMISSIBLE',
    capabilityId: CN_DURATION_ANALYTICAL_CAPABILITY_DEFINITION.capabilityId,
    capabilityVersion: CN_DURATION_ANALYTICAL_CAPABILITY_DEFINITION.capabilityVersion,
    implementationProfileId: CN_DURATION_ANALYTICAL_IMPLEMENTATION_PROFILE.implementationProfileId,
    implementationProfileVersion: CN_DURATION_ANALYTICAL_IMPLEMENTATION_PROFILE.version,
    implementationKey: CN_DURATION_ANALYTICAL_IMPLEMENTATION_PROFILE.implementationKey,
    inputSchemaId: CN_DURATION_ANALYTICAL_IMPLEMENTATION_PROFILE.inputSchemaId,
    outputSchemaId: CN_DURATION_ANALYTICAL_IMPLEMENTATION_PROFILE.outputSchemaId,
    allowedCallerProducts: ['MARKREG'],
    maximumRiskClass: 'LOW',
    methodCurrentness: 'NOT_REQUIRED',
    referenceCurrentness: 'NOT_REQUIRED',
    ...overrides
  } as CapabilitySourceAdmissionPolicyEntryV1;
}

describe('Capability source-admission policy provenance', () => {
  it('binds a supported production result to the exact immutable catalog policy identity', () => {
    const authority = new CapabilitySourceAdmissionPolicyCatalogProvenanceV1(
      new CapabilitySourceAdmissionPolicyCatalogV1([productionPolicy()])
    );

    expect(authority.evaluate(policyInput())).toEqual({
      applicability: 'SUPPORTED',
      policy: {
        policyId: 'source-admission-policy.provenance-test.v1',
        policyVersion: 7
      },
      methodCurrentness: 'NOT_REQUIRED',
      referenceCurrentness: 'NOT_REQUIRED'
    });
  });

  it('changes provenance when the admitted policy version changes', () => {
    const first = new CapabilitySourceAdmissionPolicyCatalogProvenanceV1(
      new CapabilitySourceAdmissionPolicyCatalogV1([productionPolicy()])
    ).evaluate(policyInput());
    const second = new CapabilitySourceAdmissionPolicyCatalogProvenanceV1(
      new CapabilitySourceAdmissionPolicyCatalogV1([
        productionPolicy({
          policyId: 'source-admission-policy.provenance-test.v2',
          policyVersion: 8
        })
      ])
    ).evaluate(policyInput());

    expect(first.applicability).toBe('SUPPORTED');
    expect(second.applicability).toBe('SUPPORTED');
    if (first.applicability !== 'SUPPORTED' || second.applicability !== 'SUPPORTED') {
      throw new Error('test production policy unexpectedly failed admission');
    }
    expect(second.policy).not.toEqual(first.policy);
  });

  it('does not manufacture provenance for the three current CN PILOT policies', () => {
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
      currentCapabilitySourceAdmissionPolicyProvenanceV1.evaluate(policyInput())
    ).toMatchObject({
      applicability: 'UNSUPPORTED'
    });
  });
});
