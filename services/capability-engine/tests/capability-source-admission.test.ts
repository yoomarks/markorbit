import { describe, expect, it } from 'vitest';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type {
  CapabilityOutcome,
  ImplementationBinding,
  ImplementationProfile
} from '@markorbit/contracts/capability-runtime';
import {
  assessCapabilityProducerSourceV1,
  type CapabilityProducerSourceAdmissionPolicyV1
} from '../src/capability-source-admission.js';

const definition: RuntimeCapabilityDefinition = {
  schemaVersion: 1,
  runtimeCapabilityDefinitionId: 'runtime-capability_markreg-analytical-source',
  version: 5,
  capabilityId: 'markreg-analytical-source',
  capabilityVersion: '1.0.0',
  title: 'MarkReg analytical source',
  description: 'Deterministic test Capability for producer source-admission semantics.',
  lineage: { capabilityId: 'markreg-analytical-source' },
  canonReference: {
    canonId: 'capability-source-admission',
    canonVersion: '2026-09-02',
    sourceFingerprintSha256: 'a'.repeat(64)
  },
  acceptedCanonProjection: true,
  createdFromWorkEvidence: false,
  createdFromAiOutput: false,
  createdAt: '2026-09-02T14:00:00.000Z'
};

const profile: ImplementationProfile = {
  schemaVersion: 1,
  implementationProfileId: 'implementation-profile_markreg-analytical-source',
  version: 4,
  capabilityId: definition.capabilityId,
  capabilityVersion: definition.capabilityVersion,
  kind: 'DETERMINISTIC_SERVICE',
  status: 'APPROVED',
  implementationKey: 'capability-engine:test:markreg-analytical-source',
  inputSchemaId: 'markreg-source-input.v1',
  outputSchemaId: 'markreg-source-output.v1',
  allowedCallerProducts: ['MARKREG'],
  maximumRiskClass: 'MODERATE',
  timeoutMs: 1000,
  maxAttempts: 1,
  approvalPolicyVersion: 'capability-binding-policy.v1',
  createdAt: '2026-09-02T14:00:00.000Z'
};

const binding: ImplementationBinding = {
  schemaVersion: 1,
  implementationBindingId: 'implementation-binding_source-admission',
  capabilityRequestId: 'capreq_source-admission',
  runtimeCapability: {
    id: definition.runtimeCapabilityDefinitionId,
    version: definition.version,
    capabilityId: definition.capabilityId,
    capabilityVersion: definition.capabilityVersion
  },
  implementation: {
    id: profile.implementationProfileId,
    version: profile.version,
    implementationKey: profile.implementationKey,
    kind: profile.kind
  },
  selectionPolicyVersion: 'capability-binding-policy.v1',
  boundAt: '2026-09-02T14:01:00.000Z'
};

function outcome(output: unknown = { score: 0.72 }): CapabilityOutcome {
  return {
    schemaVersion: 1,
    capabilityOutcomeId: 'capability-outcome_source-admission',
    capabilityRequestId: binding.capabilityRequestId,
    capabilityInvocationId: 'capability-invocation_source-admission',
    status: 'SUCCEEDED',
    outputSchemaId: profile.outputSchemaId,
    output,
    evidenceRefs: ['evidence_b', 'evidence_a'],
    completedAt: '2026-09-02T14:02:00.000Z',
    authority: {
      canonicalTruthCreated: false,
      capabilityCanonMutated: false,
      professionalDecisionCreated: false,
      providerSelectionAuthorityGrantedToCaller: false,
      paymentCreated: false,
      filingSubmitted: false,
      externalMessageSent: false,
      externalProfessionalActionExecuted: false
    }
  };
}

function policy(
  overrides: Partial<CapabilityProducerSourceAdmissionPolicyV1> = {}
): CapabilityProducerSourceAdmissionPolicyV1 {
  return {
    schemaVersion: 1,
    policyVersion: 'markreg-source-admission.v1',
    admissionClass: 'PRODUCTION_ADMISSIBLE',
    runtimeCapability: {
      id: definition.runtimeCapabilityDefinitionId,
      version: definition.version,
      capabilityId: definition.capabilityId,
      capabilityVersion: definition.capabilityVersion,
      canonSourceFingerprintSha256: definition.canonReference.sourceFingerprintSha256
    },
    implementation: {
      id: profile.implementationProfileId,
      version: profile.version,
      implementationKey: profile.implementationKey,
      kind: profile.kind
    },
    selectionPolicyVersion: binding.selectionPolicyVersion,
    outputSchemaId: profile.outputSchemaId,
    assumptions: ['Structured output contract is satisfied.'],
    limitations: ['Analytical source only; no legal or professional authority.'],
    unknowns: ['Underlying evidence may remain incomplete.'],
    ...overrides
  };
}

describe('Capability producer source-admission assessment', () => {
  it('keeps a succeeded execution with an approved implementation non-production when no explicit source policy exists', () => {
    const assessment = assessCapabilityProducerSourceV1({
      definition,
      profile,
      binding,
      outcome: outcome()
    });

    expect(assessment).toMatchObject({
      admissionClass: 'UNSUPPORTED',
      currentness: 'UNKNOWN',
      reason: 'NO_EXPLICIT_ADMISSION'
    });
    expect(assessment.policyVersion).toBeUndefined();
    expect(Object.values(assessment.authority).every((value) => value === false)).toBe(true);
  });

  it('admits production source material only under an exact explicit current policy', () => {
    const assessment = assessCapabilityProducerSourceV1({
      definition,
      profile,
      binding,
      outcome: outcome(),
      policy: policy()
    });

    expect(assessment).toMatchObject({
      admissionClass: 'PRODUCTION_ADMISSIBLE',
      currentness: 'CURRENT',
      reason: 'EXPLICIT_POLICY',
      policyVersion: 'markreg-source-admission.v1'
    });
    expect(assessment.lineage).toMatchObject({
      capabilityId: definition.capabilityId,
      capabilityVersion: definition.capabilityVersion,
      runtimeCapabilityDefinitionId: definition.runtimeCapabilityDefinitionId,
      runtimeCapabilityDefinitionVersion: definition.version,
      canonSourceFingerprintSha256: definition.canonReference.sourceFingerprintSha256,
      implementationProfileId: profile.implementationProfileId,
      implementationProfileVersion: profile.version,
      implementationKey: profile.implementationKey,
      selectionPolicyVersion: binding.selectionPolicyVersion,
      outputSchemaId: profile.outputSchemaId,
      evidenceRefs: ['evidence_a', 'evidence_b']
    });
    expect(assessment.outputFingerprintSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(assessment.sourceFingerprintSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(assessment.assessmentFingerprintSha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('fails stale exact-lineage policy closed instead of inheriting production admission', () => {
    const stalePolicy = policy({
      runtimeCapability: {
        ...policy().runtimeCapability,
        version: definition.version - 1
      }
    });
    const assessment = assessCapabilityProducerSourceV1({
      definition,
      profile,
      binding,
      outcome: outcome(),
      policy: stalePolicy
    });

    expect(assessment).toMatchObject({
      admissionClass: 'UNSUPPORTED',
      currentness: 'STALE',
      reason: 'POLICY_LINEAGE_STALE'
    });
  });

  it('keeps an explicit pilot policy non-production even when execution succeeds', () => {
    const assessment = assessCapabilityProducerSourceV1({
      definition,
      profile,
      binding,
      outcome: outcome(),
      policy: policy({ admissionClass: 'PILOT_OR_FIXTURE' })
    });

    expect(assessment).toMatchObject({
      admissionClass: 'PILOT_OR_FIXTURE',
      currentness: 'CURRENT',
      reason: 'EXPLICIT_POLICY'
    });
  });

  it('does not admit a failed execution even under an exact production policy', () => {
    const failed: CapabilityOutcome = {
      ...outcome(),
      status: 'FAILED',
      output: undefined,
      error: {
        code: 'IMPLEMENTATION_FAILED',
        message: 'deterministic failure',
        retryable: false
      }
    };
    const assessment = assessCapabilityProducerSourceV1({
      definition,
      profile,
      binding,
      outcome: failed,
      policy: policy()
    });

    expect(assessment).toMatchObject({
      admissionClass: 'UNSUPPORTED',
      currentness: 'CURRENT',
      reason: 'EXECUTION_NOT_SUCCESSFUL'
    });
  });

  it('keeps exact replay fingerprints stable and changes them when canonical output changes', () => {
    const first = assessCapabilityProducerSourceV1({
      definition,
      profile,
      binding,
      outcome: outcome({ score: 0.72, reasons: ['a', 'b'] }),
      policy: policy()
    });
    const reorderedObject = assessCapabilityProducerSourceV1({
      definition,
      profile,
      binding,
      outcome: outcome({ reasons: ['a', 'b'], score: 0.72 }),
      policy: policy()
    });
    const changed = assessCapabilityProducerSourceV1({
      definition,
      profile,
      binding,
      outcome: outcome({ score: 0.73, reasons: ['a', 'b'] }),
      policy: policy()
    });

    expect(reorderedObject.outputFingerprintSha256).toBe(first.outputFingerprintSha256);
    expect(reorderedObject.sourceFingerprintSha256).toBe(first.sourceFingerprintSha256);
    expect(reorderedObject.assessmentFingerprintSha256).toBe(first.assessmentFingerprintSha256);
    expect(changed.outputFingerprintSha256).not.toBe(first.outputFingerprintSha256);
    expect(changed.sourceFingerprintSha256).not.toBe(first.sourceFingerprintSha256);
    expect(changed.assessmentFingerprintSha256).not.toBe(first.assessmentFingerprintSha256);
  });
});
