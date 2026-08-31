import { describe, expect, it } from 'vitest';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type { ImplementationProfile } from '@markorbit/contracts/capability-runtime';
import {
  capabilitySourceAdmissionNoAuthorityConsequences,
  type CapabilitySourceAdmissionDecision
} from '../src/current-source-admission.js';
import {
  CapabilityDemandCoverageAuditorV1,
  capabilityDemandCoverageNoAuthority,
  productCapabilityDemandIdentityV1
} from '../src/capability-demand-coverage.js';

const capability = {
  schemaVersion: 1,
  runtimeCapabilityDefinitionId: 'runtime-capability_demand-coverage',
  version: 3,
  capabilityId: 'trademark-analysis',
  capabilityVersion: '2.1.0',
  title: 'Trademark analysis',
  description: 'Accepted deterministic analytical capability.',
  lineage: {
    capabilityId: 'trademark-analysis'
  },
  canonReference: {
    canonId: 'capability-canon:trademark-analysis',
    canonVersion: '2026-08-30',
    sourceFingerprintSha256: 'a'.repeat(64)
  },
  acceptedCanonProjection: true,
  createdFromWorkEvidence: false,
  createdFromAiOutput: false,
  createdAt: '2026-08-30T00:00:00.000Z'
} satisfies RuntimeCapabilityDefinition;

function profile(options: Partial<ImplementationProfile> = {}): ImplementationProfile {
  return {
    schemaVersion: 1,
    implementationProfileId: 'implementation-profile_analysis-primary',
    version: 4,
    capabilityId: capability.capabilityId,
    capabilityVersion: capability.capabilityVersion,
    kind: 'DETERMINISTIC_SERVICE',
    status: 'APPROVED',
    implementationKey: 'analysis:primary',
    inputSchemaId: 'trademark-analysis-input.v1',
    outputSchemaId: 'trademark-analysis-output.v1',
    allowedCallerProducts: ['MARKREG'],
    maximumRiskClass: 'MODERATE',
    timeoutMs: 5000,
    maxAttempts: 1,
    approvalPolicyVersion: 'capability-approval.v1',
    createdAt: '2026-08-30T00:01:00.000Z',
    ...options
  };
}

const demand = {
  schemaVersion: 1,
  demandKey: 'markreg:recommendation:analysis',
  consumerProduct: 'MARKREG',
  capabilityId: capability.capabilityId,
  inputSchemaId: 'trademark-analysis-input.v1',
  outputSchemaId: 'trademark-analysis-output.v1',
  riskClass: 'MODERATE',
  requiresProductionAdmissibleSource: true
} as const;

function productionAdmission(
  selected: ImplementationProfile = profile(),
  capabilityOverride: Partial<
    CapabilitySourceAdmissionDecision & { decision: 'PRODUCTION_ADMISSIBLE' }
  > = {}
): CapabilitySourceAdmissionDecision {
  const decision: CapabilitySourceAdmissionDecision = {
    schemaVersion: 1,
    producer: 'CAPABILITY_ENGINE',
    decision: 'PRODUCTION_ADMISSIBLE',
    historical: {
      capabilityRequestId: 'capreq_coverage',
      implementationBindingId: 'implementation-binding_coverage',
      capabilityInvocationId: 'capability-invocation_coverage',
      capabilityOutcomeId: 'capability-outcome_coverage',
      capabilityReturnId: 'capability-return_coverage',
      sessionReceiptId: 'session-receipt_coverage',
      replayed: false
    },
    current: {
      capability: {
        runtimeCapabilityDefinitionId: capability.runtimeCapabilityDefinitionId,
        version: capability.version,
        capabilityId: capability.capabilityId,
        capabilityVersion: capability.capabilityVersion
      },
      implementation: {
        implementationProfileId: selected.implementationProfileId,
        version: selected.version,
        implementationKey: selected.implementationKey,
        status: 'APPROVED'
      }
    },
    authority: capabilitySourceAdmissionNoAuthorityConsequences
  };
  return { ...decision, ...capabilityOverride };
}

function deniedAdmission(): CapabilitySourceAdmissionDecision {
  return {
    schemaVersion: 1,
    producer: 'CAPABILITY_ENGINE',
    decision: 'DENIED',
    historical: {
      capabilityRequestId: 'capreq_coverage',
      implementationBindingId: 'implementation-binding_coverage',
      capabilityInvocationId: 'capability-invocation_coverage',
      capabilityOutcomeId: 'capability-outcome_coverage',
      capabilityReturnId: 'capability-return_coverage',
      sessionReceiptId: 'session-receipt_coverage',
      replayed: false
    },
    denial: {
      code: 'SOURCE_REFERENCE_NOT_CURRENT',
      reason: 'Historical source reference is no longer current.'
    },
    authority: capabilitySourceAdmissionNoAuthorityConsequences
  };
}

function auditor(
  options: {
    currentCapability?: RuntimeCapabilityDefinition;
    profiles?: ImplementationProfile[];
    capabilityFailure?: boolean;
    implementationFailure?: boolean;
  } = {}
): CapabilityDemandCoverageAuditorV1 {
  const currentCapability = 'currentCapability' in options ? options.currentCapability : capability;
  const profiles = options.profiles ?? [profile()];
  return new CapabilityDemandCoverageAuditorV1({
    capabilities: {
      findCurrent: () => {
        if (options.capabilityFailure) throw new Error('database secret should not escape');
        return Promise.resolve(currentCapability);
      }
    },
    implementations: {
      listCurrent: () => {
        if (options.implementationFailure) throw new Error('database secret should not escape');
        return Promise.resolve(profiles);
      }
    }
  });
}

describe('Capability product demand coverage audit V1', () => {
  it('returns production covered only for exact current capability, implementation, and source proof', async () => {
    const selected = profile();
    const result = await auditor({ profiles: [selected] }).audit(
      demand,
      productionAdmission(selected)
    );

    expect(result.status).toBe('PRODUCTION_COVERED');
    expect(result.gapCandidate).toBeUndefined();
    expect(result.evidence.currentCapability).toMatchObject({
      runtimeCapabilityDefinitionId: capability.runtimeCapabilityDefinitionId,
      version: capability.version,
      capabilityId: capability.capabilityId,
      capabilityVersion: capability.capabilityVersion
    });
    expect(result.evidence.selectedImplementation).toMatchObject({
      implementationProfileId: selected.implementationProfileId,
      version: selected.version,
      implementationKey: selected.implementationKey,
      status: 'APPROVED'
    });
    expect(result.evidence.sourceProof?.decision).toBe('PRODUCTION_ADMISSIBLE');
    expect(result.authority).toEqual(capabilityDemandCoverageNoAuthority);
  });

  it('distinguishes runtime coverage when production source proof is not required', async () => {
    const result = await auditor().audit({
      ...demand,
      requiresProductionAdmissibleSource: false
    });

    expect(result.status).toBe('RUNTIME_COVERED');
    expect(result.gapCandidate).toBeUndefined();
    expect(result.evidence.sourceProof).toBeUndefined();
  });

  it('returns a not-admitted candidate when the runtime capability is missing', async () => {
    const result = await auditor({ currentCapability: undefined }).audit(demand);

    expect(result.status).toBe('MISSING_RUNTIME_CAPABILITY');
    expect(result.gapCandidate).toMatchObject({
      admissionStatus: 'NOT_ADMITTED',
      reasonCode: 'MISSING_RUNTIME_CAPABILITY',
      authority: capabilityDemandCoverageNoAuthority
    });
    expect(result.gapCandidate?.candidateId).toBe(
      `capability-coverage-gap-candidate_${result.gapCandidate?.candidateFingerprintSha256}`
    );
  });

  it('requires one current approved implementation matching schemas, caller, risk, and capability version', async () => {
    const result = await auditor({
      profiles: [
        profile({ status: 'RETIRED' }),
        profile({
          implementationProfileId: 'implementation-profile_wrong-schema',
          implementationKey: 'analysis:wrong-schema',
          inputSchemaId: 'other-input.v1'
        }),
        profile({
          implementationProfileId: 'implementation-profile_wrong-caller',
          implementationKey: 'analysis:wrong-caller',
          allowedCallerProducts: ['LITE']
        }),
        profile({
          implementationProfileId: 'implementation-profile_low-risk',
          implementationKey: 'analysis:low-risk',
          maximumRiskClass: 'LOW'
        })
      ]
    }).audit(demand);

    expect(result.status).toBe('NO_APPROVED_IMPLEMENTATION');
    expect(result.evidence.qualifyingImplementations).toEqual([]);
    expect(result.gapCandidate?.reasonCode).toBe('NO_APPROVED_IMPLEMENTATION');
  });

  it('fails closed when multiple current implementations qualify without an exact demand pin', async () => {
    const result = await auditor({
      profiles: [
        profile(),
        profile({
          implementationProfileId: 'implementation-profile_analysis-secondary',
          implementationKey: 'analysis:secondary'
        })
      ]
    }).audit(demand);

    expect(result.status).toBe('AMBIGUOUS_CURRENT_IMPLEMENTATION');
    expect(result.evidence.qualifyingImplementations.map((item) => item.implementationKey)).toEqual(
      ['analysis:primary', 'analysis:secondary']
    );
    expect(result.evidence.selectedImplementation).toBeUndefined();
    expect(result.gapCandidate?.reasonCode).toBe('AMBIGUOUS_CURRENT_IMPLEMENTATION');
  });

  it('uses an exact implementation-key demand pin only when that current profile qualifies', async () => {
    const primary = profile();
    const secondary = profile({
      implementationProfileId: 'implementation-profile_analysis-secondary',
      implementationKey: 'analysis:secondary'
    });
    const pinnedDemand = {
      ...demand,
      requiredImplementationKey: 'analysis:secondary'
    };
    const result = await auditor({ profiles: [primary, secondary] }).audit(
      pinnedDemand,
      productionAdmission(secondary)
    );

    expect(result.status).toBe('PRODUCTION_COVERED');
    expect(result.evidence.qualifyingImplementations).toHaveLength(1);
    expect(result.evidence.selectedImplementation?.implementationKey).toBe('analysis:secondary');
  });

  it('keeps exact runtime coverage non-production when required source proof is absent', async () => {
    const result = await auditor().audit(demand);

    expect(result.status).toBe('RUNTIME_COVERED_SOURCE_UNPROVEN');
    expect(result.gapCandidate?.reasonCode).toBe('RUNTIME_COVERED_SOURCE_UNPROVEN');
    expect(result.evidence.selectedImplementation?.implementationKey).toBe('analysis:primary');
  });

  it('preserves a bounded denied source decision without promoting it to gap truth', async () => {
    const result = await auditor().audit(demand, deniedAdmission());

    expect(result.status).toBe('SOURCE_ADMISSION_DENIED');
    expect(result.evidence.sourceProof).toEqual({
      decision: 'DENIED',
      denialCode: 'SOURCE_REFERENCE_NOT_CURRENT'
    });
    expect(result.gapCandidate).toMatchObject({
      admissionStatus: 'NOT_ADMITTED',
      reasonCode: 'SOURCE_ADMISSION_DENIED',
      authority: capabilityDemandCoverageNoAuthority
    });
  });

  it('rejects a positive source proof whose current binding has drifted', async () => {
    const proof = productionAdmission();
    if (proof.decision !== 'PRODUCTION_ADMISSIBLE') throw new Error('unexpected fixture');
    const drifted: CapabilitySourceAdmissionDecision = {
      ...proof,
      current: {
        ...proof.current,
        capability: {
          ...proof.current.capability,
          version: proof.current.capability.version + 1
        }
      }
    };
    const result = await auditor().audit(demand, drifted);

    expect(result.status).toBe('SOURCE_PROOF_NOT_CURRENT');
    expect(result.gapCandidate?.reasonCode).toBe('SOURCE_PROOF_NOT_CURRENT');
    expect(result.evidence.sourceProof?.decision).toBe('PRODUCTION_ADMISSIBLE');
  });

  it.each([
    ['CURRENT_CAPABILITY_AUTHORITY', { capabilityFailure: true }],
    ['CURRENT_IMPLEMENTATION_AUTHORITY', { implementationFailure: true }]
  ] as const)(
    'fails closed as unavailable for %s without fabricating a governed gap candidate',
    async (dependency, options) => {
      const result = await auditor(options).audit(demand, productionAdmission());

      expect(result.status).toBe('COVERAGE_AUDIT_UNAVAILABLE');
      expect(result.unavailableDependency).toBe(dependency);
      expect(result.gapCandidate).toBeUndefined();
      expect(JSON.stringify(result)).not.toContain('database secret');
      expect(result.authority).toEqual(capabilityDemandCoverageNoAuthority);
    }
  );

  it('derives deterministic demand and gap identities from bounded semantic inputs', async () => {
    const demandIdentity = productCapabilityDemandIdentityV1(demand);
    const first = await auditor({ currentCapability: undefined }).audit(demand);
    const second = await auditor({ currentCapability: undefined }).audit({ ...demand });

    expect(demandIdentity.demandId).toBe(
      `capability-demand_${demandIdentity.demandFingerprintSha256}`
    );
    expect(first).toEqual(second);
    expect(first.demand).toEqual(demandIdentity);
    expect(first.gapCandidate?.candidateFingerprintSha256).toBe(
      second.gapCandidate?.candidateFingerprintSha256
    );
  });

  it('rejects unbounded or invalid demand fields before querying current authorities', async () => {
    await expect(
      auditor().audit({
        ...demand,
        riskClass: 'SUPER_HIGH'
      })
    ).rejects.toThrow(/riskClass is invalid/u);

    await expect(
      auditor().audit({
        ...demand,
        unexpectedAuthority: true
      })
    ).rejects.toThrow(/unsupported fields/u);
  });
});
