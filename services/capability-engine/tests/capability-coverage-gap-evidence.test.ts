import { describe, expect, it } from 'vitest';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type { ImplementationProfile } from '@markorbit/contracts/capability-runtime';
import {
  CapabilityDemandCoverageAuditorV1,
  capabilityDemandCoverageNoAuthority
} from '../src/capability-demand-coverage.js';
import {
  CapabilityCoverageGapEvidenceError,
  capabilityCoverageGapEvidenceNoAuthority,
  materializeCapabilityCoverageGapEvidenceV1
} from '../src/capability-coverage-gap-evidence.js';
import {
  capabilitySourceAdmissionNoAuthorityConsequences,
  type CapabilitySourceAdmissionDecision
} from '../src/current-source-admission.js';

const capability = {
  schemaVersion: 1,
  runtimeCapabilityDefinitionId: 'runtime-capability_gap-evidence',
  version: 3,
  capabilityId: 'trademark-analysis',
  capabilityVersion: '2.1.0',
  title: 'Trademark analysis',
  description: 'Accepted deterministic analytical capability.',
  lineage: { capabilityId: 'trademark-analysis' },
  canonReference: {
    canonId: 'capability-canon:trademark-analysis',
    canonVersion: '2026-08-31',
    sourceFingerprintSha256: 'a'.repeat(64)
  },
  acceptedCanonProjection: true,
  createdFromWorkEvidence: false,
  createdFromAiOutput: false,
  createdAt: '2026-08-31T00:00:00.000Z'
} satisfies RuntimeCapabilityDefinition;

function profile(options: Partial<ImplementationProfile> = {}): ImplementationProfile {
  return {
    schemaVersion: 1,
    implementationProfileId: 'implementation-profile_gap-primary',
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
    createdAt: '2026-08-31T00:01:00.000Z',
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

function auditor(
  options: {
    currentCapability?: RuntimeCapabilityDefinition | undefined;
    profiles?: ImplementationProfile[];
    capabilityFailure?: boolean;
  } = {}
): CapabilityDemandCoverageAuditorV1 {
  const currentCapability = 'currentCapability' in options ? options.currentCapability : capability;
  const profiles = options.profiles ?? [profile()];
  return new CapabilityDemandCoverageAuditorV1({
    capabilities: {
      findCurrent: () => {
        if (options.capabilityFailure) throw new Error('catalog unavailable');
        return Promise.resolve(currentCapability);
      }
    },
    implementations: { listCurrent: () => Promise.resolve(profiles) }
  });
}

function productionAdmission(
  selected: ImplementationProfile = profile()
): CapabilitySourceAdmissionDecision {
  return {
    schemaVersion: 1,
    producer: 'CAPABILITY_ENGINE',
    decision: 'PRODUCTION_ADMISSIBLE',
    historical: {
      capabilityRequestId: 'capreq_gap',
      implementationBindingId: 'implementation-binding_gap',
      capabilityInvocationId: 'capability-invocation_gap',
      capabilityOutcomeId: 'capability-outcome_gap',
      capabilityReturnId: 'capability-return_gap',
      sessionReceiptId: 'session-receipt_gap',
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
}

function deniedAdmission(): CapabilitySourceAdmissionDecision {
  return {
    schemaVersion: 1,
    producer: 'CAPABILITY_ENGINE',
    decision: 'DENIED',
    historical: {
      capabilityRequestId: 'capreq_gap',
      implementationBindingId: 'implementation-binding_gap',
      capabilityInvocationId: 'capability-invocation_gap',
      capabilityOutcomeId: 'capability-outcome_gap',
      capabilityReturnId: 'capability-return_gap',
      sessionReceiptId: 'session-receipt_gap',
      replayed: false
    },
    denial: {
      code: 'SOURCE_REFERENCE_NOT_CURRENT',
      reason: 'Historical source reference is no longer current.'
    },
    authority: capabilitySourceAdmissionNoAuthorityConsequences
  };
}

describe('Capability Coverage Gap evidence V1', () => {
  it('materializes deterministic bounded evidence from one governed uncovered demand audit', async () => {
    const audit = await auditor({ currentCapability: undefined }).audit(demand);
    const before = structuredClone(audit);
    const first = materializeCapabilityCoverageGapEvidenceV1(audit);
    const second = materializeCapabilityCoverageGapEvidenceV1(structuredClone(audit));

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      schemaVersion: 1,
      classification: 'COVERAGE_GAP_EVIDENCE',
      phase7AdmissionStatus: 'NOT_ADMITTED',
      sourceKind: 'CAPABILITY_DEMAND_COVERAGE_AUDIT_V1',
      coverageStatus: 'MISSING_RUNTIME_CAPABILITY',
      authority: capabilityCoverageGapEvidenceNoAuthority
    });
    expect(first?.evidenceId).toBe(
      `capability-coverage-gap-evidence_${first?.evidenceFingerprintSha256}`
    );
    expect(first?.sourceAuditFingerprintSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(first?.candidateFingerprintSha256).toBe(audit.gapCandidate?.candidateFingerprintSha256);
    expect(audit).toEqual(before);
  });

  it('does not materialize gap evidence for production-covered or runtime-covered demands', async () => {
    const productionCovered = await auditor().audit(demand, productionAdmission());
    const runtimeCovered = await auditor().audit({
      ...demand,
      requiresProductionAdmissibleSource: false
    });

    expect(materializeCapabilityCoverageGapEvidenceV1(productionCovered)).toBeUndefined();
    expect(materializeCapabilityCoverageGapEvidenceV1(runtimeCovered)).toBeUndefined();
  });

  it('does not fabricate gap evidence when the governed coverage audit is unavailable', async () => {
    const unavailable = await auditor({ capabilityFailure: true }).audit(demand);

    expect(unavailable.status).toBe('COVERAGE_AUDIT_UNAVAILABLE');
    expect(unavailable.gapCandidate).toBeUndefined();
    expect(materializeCapabilityCoverageGapEvidenceV1(unavailable)).toBeUndefined();
  });

  it('preserves a denied current-source proof as bounded evidence without admitting Phase 7 truth', async () => {
    const audit = await auditor().audit(demand, deniedAdmission());
    const evidence = materializeCapabilityCoverageGapEvidenceV1(audit);

    expect(evidence?.coverageStatus).toBe('SOURCE_ADMISSION_DENIED');
    expect(evidence?.evidence.sourceProof).toEqual({
      decision: 'DENIED',
      denialCode: 'SOURCE_REFERENCE_NOT_CURRENT'
    });
    expect(evidence?.authority.productionSourceAdmitted).toBe(false);
    expect(evidence?.authority.methodImprovementTriggerCreated).toBe(false);
    expect(evidence?.authority.researchMissionCreated).toBe(false);
    expect(evidence?.authority.methodLifecycleChanged).toBe(false);
  });

  it('preserves ambiguous qualifying implementations as evidence without selecting one', async () => {
    const audit = await auditor({
      profiles: [
        profile(),
        profile({
          implementationProfileId: 'implementation-profile_gap-secondary',
          implementationKey: 'analysis:secondary'
        })
      ]
    }).audit(demand);
    const evidence = materializeCapabilityCoverageGapEvidenceV1(audit);

    expect(evidence?.coverageStatus).toBe('AMBIGUOUS_CURRENT_IMPLEMENTATION');
    expect(evidence?.evidence.qualifyingImplementations).toHaveLength(2);
    expect(evidence?.evidence.selectedImplementation).toBeUndefined();
    expect(evidence?.authority.methodImprovementTriggerCreated).toBe(false);
  });

  it('fails closed when demand identity is tampered after the governed audit', async () => {
    const audit = await auditor({ currentCapability: undefined }).audit(demand);
    const tampered = structuredClone(audit) as unknown as {
      demand: { demandFingerprintSha256: string };
    };
    tampered.demand.demandFingerprintSha256 = 'f'.repeat(64);

    expect(() => materializeCapabilityCoverageGapEvidenceV1(tampered)).toThrowError(
      CapabilityCoverageGapEvidenceError
    );
  });

  it('fails closed when candidate reason, evidence, or fingerprint drifts from the audit', async () => {
    const audit = await auditor().audit(demand, deniedAdmission());
    const reasonDrift = structuredClone(audit) as unknown as {
      gapCandidate: { reasonCode: string };
    };
    reasonDrift.gapCandidate.reasonCode = 'NO_APPROVED_IMPLEMENTATION';
    expect(() => materializeCapabilityCoverageGapEvidenceV1(reasonDrift)).toThrow(
      /reasonCode must match/u
    );

    const evidenceDrift = structuredClone(audit) as unknown as {
      gapCandidate: { evidence: { sourceProof: { denialCode: string } } };
    };
    evidenceDrift.gapCandidate.evidence.sourceProof.denialCode = 'OTHER_DENIAL';
    expect(() => materializeCapabilityCoverageGapEvidenceV1(evidenceDrift)).toThrow(
      /evidence must match/u
    );

    const fingerprintDrift = structuredClone(audit) as unknown as {
      gapCandidate: { candidateFingerprintSha256: string };
    };
    fingerprintDrift.gapCandidate.candidateFingerprintSha256 = 'e'.repeat(64);
    expect(() => materializeCapabilityCoverageGapEvidenceV1(fingerprintDrift)).toThrow(
      /fingerprint does not match/u
    );
  });

  it('fails closed when producer no-authority flags are altered', async () => {
    const audit = await auditor({ currentCapability: undefined }).audit(demand);
    const auditAuthorityDrift = structuredClone(audit) as unknown as {
      authority: { methodImprovementTriggerCreated: boolean };
    };
    auditAuthorityDrift.authority.methodImprovementTriggerCreated = true;
    expect(() => materializeCapabilityCoverageGapEvidenceV1(auditAuthorityDrift)).toThrow(
      /no-authority flags/u
    );

    const candidateAuthorityDrift = structuredClone(audit) as unknown as {
      gapCandidate: { authority: { brainGapCreated: boolean } };
    };
    candidateAuthorityDrift.gapCandidate.authority.brainGapCreated = true;
    expect(() => materializeCapabilityCoverageGapEvidenceV1(candidateAuthorityDrift)).toThrow(
      /no-authority flags/u
    );
  });

  it('requires the exact governed NOT_ADMITTED candidate for every uncovered audit', async () => {
    const audit = await auditor({ currentCapability: undefined }).audit(demand);
    const missingCandidate = {
      schemaVersion: audit.schemaVersion,
      status: audit.status,
      demand: audit.demand,
      evidence: audit.evidence,
      authority: capabilityDemandCoverageNoAuthority
    };

    expect(() => materializeCapabilityCoverageGapEvidenceV1(missingCandidate)).toThrow(
      /requires the governed NOT_ADMITTED gap candidate/u
    );
  });
});
