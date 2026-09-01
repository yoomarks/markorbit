import { describe, expect, it } from 'vitest';
import type { CapabilityRuntimeExecution } from '../src/capability-runtime.js';
import {
  CN_DURATION_ANALYTICAL_CAPABILITY_DEFINITION,
  CN_DURATION_ANALYTICAL_IMPLEMENTATION_PROFILE
} from '../src/cn-duration-analytical-pilot.js';
import {
  CN_DURATION_BAND_CLASSIFICATION_CAPABILITY_DEFINITION,
  CN_DURATION_BAND_CLASSIFICATION_IMPLEMENTATION_PROFILE
} from '../src/cn-duration-band-classification-pilot.js';
import {
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_CAPABILITY_DEFINITION,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_IMPLEMENTATION_PROFILE
} from '../src/cn-preliminary-publication-discovery-pilot.js';
import type {
  CapabilitySourceAdmissionPolicyAuthority,
  CapabilitySourceAdmissionPolicyInput
} from '../src/current-source-admission.js';
import {
  CapabilitySourceAdmissionPolicyCatalogError,
  CapabilitySourceAdmissionPolicyCatalogV1,
  currentCapabilitySourceAdmissionPoliciesV1,
  currentCapabilitySourceAdmissionPolicyCatalogV1,
  type CapabilitySourceAdmissionPolicyEntryV1
} from '../src/source-admission-policy-catalog.js';
import {
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION,
  USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE
} from '../src/uspto-official-fee-resolver-pilot.js';

const currentPilots = [
  [CN_DURATION_ANALYTICAL_CAPABILITY_DEFINITION, CN_DURATION_ANALYTICAL_IMPLEMENTATION_PROFILE],
  [
    CN_DURATION_BAND_CLASSIFICATION_CAPABILITY_DEFINITION,
    CN_DURATION_BAND_CLASSIFICATION_IMPLEMENTATION_PROFILE
  ],
  [
    CN_PRELIMINARY_PUBLICATION_DISCOVERY_CAPABILITY_DEFINITION,
    CN_PRELIMINARY_PUBLICATION_DISCOVERY_IMPLEMENTATION_PROFILE
  ],
  [
    USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION,
    USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE
  ]
] as const;

function policyInput(
  definition = CN_DURATION_ANALYTICAL_CAPABILITY_DEFINITION,
  profile = CN_DURATION_ANALYTICAL_IMPLEMENTATION_PROFILE,
  overrides: {
    callerProduct?: string;
    riskClass?: 'LOW' | 'MODERATE' | 'HIGH' | 'PROTECTED';
    inputSchemaId?: string;
    outputSchemaId?: string;
  } = {}
): CapabilitySourceAdmissionPolicyInput {
  const execution = {
    request: {
      capabilityId: definition.capabilityId,
      capabilityVersion: definition.capabilityVersion,
      inputSchemaId: overrides.inputSchemaId ?? profile.inputSchemaId,
      outputSchemaId: overrides.outputSchemaId ?? profile.outputSchemaId,
      riskClass: overrides.riskClass ?? 'LOW',
      caller: {
        callerProduct: overrides.callerProduct ?? 'MARKREG'
      }
    }
  } as unknown as CapabilityRuntimeExecution;
  return {
    execution,
    currentCapability: definition,
    currentImplementation: profile
  };
}

function productionPolicy(
  overrides: Partial<CapabilitySourceAdmissionPolicyEntryV1> = {}
): CapabilitySourceAdmissionPolicyEntryV1 {
  return {
    schemaVersion: 1,
    policyId: 'source-admission-policy.test-production.v1',
    policyVersion: 1,
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
    methodCurrentness: 'REQUIRED',
    referenceCurrentness: 'REQUIRED',
    ...overrides
  } as CapabilitySourceAdmissionPolicyEntryV1;
}

function expectCatalogError(run: () => unknown, code: CapabilitySourceAdmissionPolicyCatalogError['code']) {
  try {
    run();
    throw new Error(`expected Capability source-admission policy catalog error ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(CapabilitySourceAdmissionPolicyCatalogError);
    if (!(error instanceof CapabilitySourceAdmissionPolicyCatalogError)) throw error;
    expect(error.code).toBe(code);
  }
}

describe('Capability source-admission policy catalog V1', () => {
  it('explicitly classifies all four current Phase 4 families as PILOT and denies production admission', () => {
    expect(currentCapabilitySourceAdmissionPoliciesV1).toHaveLength(4);
    expect(currentCapabilitySourceAdmissionPoliciesV1.map((entry) => entry.maturityClass)).toEqual([
      'PILOT',
      'PILOT',
      'PILOT',
      'PILOT'
    ]);

    for (const [definition, profile] of currentPilots) {
      expect(
        currentCapabilitySourceAdmissionPolicyCatalogV1.evaluate(policyInput(definition, profile))
      ).toMatchObject({
        applicability: 'UNSUPPORTED'
      });
    }
  });

  it('fails closed when no policy exists for the exact current binding', () => {
    const unknownDefinition = {
      ...CN_DURATION_ANALYTICAL_CAPABILITY_DEFINITION,
      capabilityId: 'analytics.unknown-source'
    };
    const unknownProfile = {
      ...CN_DURATION_ANALYTICAL_IMPLEMENTATION_PROFILE,
      capabilityId: 'analytics.unknown-source',
      implementationProfileId: 'implementation-profile_unknown-source'
    };

    expect(
      currentCapabilitySourceAdmissionPolicyCatalogV1.evaluate(
        policyInput(unknownDefinition, unknownProfile)
      )
    ).toEqual({
      applicability: 'UNSUPPORTED',
      reason:
        'No explicit producer source-admission policy exists for the exact current Capability and Implementation Profile binding.'
    });
  });

  it('allows an explicit test-only production policy to continue #397 currentness checks', () => {
    const catalog = new CapabilitySourceAdmissionPolicyCatalogV1([productionPolicy()]);
    const authority: CapabilitySourceAdmissionPolicyAuthority = catalog;

    expect(authority.evaluate(policyInput())).toEqual({
      applicability: 'SUPPORTED',
      methodCurrentness: 'REQUIRED',
      referenceCurrentness: 'REQUIRED'
    });
  });

  it('denies production policy use outside exact caller, risk or schema applicability', () => {
    const catalog = new CapabilitySourceAdmissionPolicyCatalogV1([productionPolicy()]);

    for (const input of [
      policyInput(undefined, undefined, { callerProduct: 'LITE' }),
      policyInput(undefined, undefined, { riskClass: 'MODERATE' }),
      policyInput(undefined, undefined, { inputSchemaId: 'unexpected-input.v1' }),
      policyInput(undefined, undefined, { outputSchemaId: 'unexpected-output.v1' })
    ]) {
      expect(catalog.evaluate(input)).toMatchObject({ applicability: 'UNSUPPORTED' });
    }
  });

  it('denies stale or changed current implementation bindings instead of using an older policy', () => {
    const catalog = new CapabilitySourceAdmissionPolicyCatalogV1([productionPolicy()]);
    const newerProfile = {
      ...CN_DURATION_ANALYTICAL_IMPLEMENTATION_PROFILE,
      version: CN_DURATION_ANALYTICAL_IMPLEMENTATION_PROFILE.version + 1
    };

    expect(
      catalog.evaluate(policyInput(CN_DURATION_ANALYTICAL_CAPABILITY_DEFINITION, newerProfile))
    ).toMatchObject({ applicability: 'UNSUPPORTED' });
  });

  it('keeps fixture/test and unsupported entries explicitly non-production', () => {
    const fixture = {
      ...productionPolicy(),
      policyId: 'source-admission-policy.fixture.v1',
      maturityClass: 'FIXTURE_TEST',
      reason: 'Fixture-only source.',
      methodCurrentness: undefined,
      referenceCurrentness: undefined
    } as unknown as CapabilitySourceAdmissionPolicyEntryV1;
    const unsupported = {
      ...fixture,
      policyId: 'source-admission-policy.unsupported.v1',
      implementationProfileId: 'implementation-profile_unsupported',
      maturityClass: 'UNSUPPORTED',
      reason: 'No accepted production source exists.'
    } as CapabilitySourceAdmissionPolicyEntryV1;
    const catalog = new CapabilitySourceAdmissionPolicyCatalogV1([fixture]);
    const fixtureDecision = catalog.evaluate(policyInput());

    expect(fixtureDecision.applicability).toBe('UNSUPPORTED');
    if (fixtureDecision.applicability !== 'UNSUPPORTED')
      throw new Error('fixture policy unexpectedly became supported');
    expect(fixtureDecision.reason).toContain('FIXTURE_TEST');
    expect(new CapabilitySourceAdmissionPolicyCatalogV1([unsupported]).list()[0]).toMatchObject({
      maturityClass: 'UNSUPPORTED'
    });
  });

  it('rejects duplicate policy ids and duplicate exact bindings', () => {
    const first = productionPolicy();
    const sameIdDifferentBinding = productionPolicy({
      implementationProfileId: 'implementation-profile_other-binding',
      policyId: first.policyId
    });
    const sameBindingDifferentId = productionPolicy({
      policyId: 'source-admission-policy.same-binding.v2'
    });

    expectCatalogError(
      () => new CapabilitySourceAdmissionPolicyCatalogV1([first, sameIdDifferentBinding]),
      'DUPLICATE_POLICY_ID'
    );
    expectCatalogError(
      () => new CapabilitySourceAdmissionPolicyCatalogV1([first, sameBindingDifferentId]),
      'DUPLICATE_POLICY_BINDING'
    );
  });

  it('rejects unbounded wildcard callers for production-admissible policies', () => {
    expectCatalogError(
      () =>
        new CapabilitySourceAdmissionPolicyCatalogV1([
          productionPolicy({ allowedCallerProducts: ['*'] })
        ]),
      'INVALID_POLICY_ENTRY'
    );
  });

  it('returns defensive policy snapshots rather than mutable catalog state', () => {
    const catalog = new CapabilitySourceAdmissionPolicyCatalogV1([productionPolicy()]);
    const first = catalog.list();
    const second = catalog.list();

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
  });
});
