import { describe, expect, it, vi } from 'vitest';

import { materializeCapabilitySourceOutputIdentityV1 } from '../src/capability-source-output-identity.js';
import {
  CapabilitySourceAdmissionEvidenceV3Error,
  CurrentCapabilitySourceAdmissionEvidenceMaterializerV3,
  materializeCapabilitySourceAdmissionEvidenceV3,
  type CapabilitySourceUseContextResolutionV1
} from '../src/current-source-admission-evidence-v3.js';
import { materializeCapabilitySourceAdmissionEvidenceV2 } from '../src/current-source-admission-evidence-v2.js';
import {
  capabilitySourceAdmissionNoAuthorityConsequences,
  type CapabilitySourceAdmissionDecision
} from '../src/current-source-admission.js';
import { currentCapabilitySourceAdmissionPoliciesV1 } from '../src/source-admission-policy-catalog.js';

const evaluatedAt = '2026-09-01T09:45:00.000Z';

const admissibleDecision: CapabilitySourceAdmissionDecision = {
  schemaVersion: 1,
  producer: 'CAPABILITY_ENGINE',
  decision: 'PRODUCTION_ADMISSIBLE',
  historical: {
    capabilityRequestId: 'capreq_source-use',
    implementationBindingId: 'implementation-binding_source-use',
    capabilityInvocationId: 'capability-invocation_source-use',
    capabilityOutcomeId: 'capability-outcome_source-use',
    capabilityReturnId: 'capability-return_source-use',
    sessionReceiptId: 'session-receipt_source-use',
    replayed: false
  },
  current: {
    capability: {
      runtimeCapabilityDefinitionId: 'runtime-capability_source-use',
      version: 2,
      capabilityId: 'analysis.source-use',
      capabilityVersion: '1.0.0'
    },
    implementation: {
      implementationProfileId: 'implementation-profile_source-use',
      version: 3,
      implementationKey: 'analysis.source-use.v1',
      status: 'APPROVED'
    }
  },
  methodSource: {
    evidenceRef: 'brain-method-activation:decision_source-use:method-fingerprint',
    methodId: 'brain-method_source-use',
    methodVersionId: 'brain-method-version_source-use-v2',
    packageId: 'brain-method-package_source-use',
    packageVersion: '2',
    activationId: 'brain-method-activation_source-use',
    evaluationId: 'brain-method-evaluation_source-use'
  },
  referenceSources: [
    {
      evidenceRef: 'core-reference:official-source-v2',
      sourceId: 'official-source',
      sourceVersion: 2,
      sourceFingerprintSha256: '1'.repeat(64)
    }
  ],
  authority: capabilitySourceAdmissionNoAuthorityConsequences
};

const deniedDecision: CapabilitySourceAdmissionDecision = {
  schemaVersion: 1,
  producer: 'CAPABILITY_ENGINE',
  decision: 'DENIED',
  historical: {
    capabilityRequestId: 'capreq_source-use-denied',
    implementationBindingId: 'implementation-binding_source-use-denied',
    capabilityInvocationId: 'capability-invocation_source-use-denied',
    capabilityOutcomeId: 'capability-outcome_source-use-denied',
    capabilityReturnId: 'capability-return_source-use-denied',
    sessionReceiptId: 'session-receipt_source-use-denied',
    replayed: false
  },
  denial: {
    code: 'UNSUPPORTED_APPLICABILITY',
    reason: 'The governed source remains PILOT.'
  },
  authority: capabilitySourceAdmissionNoAuthorityConsequences
};

const sourceOutput = materializeCapabilitySourceOutputIdentityV1('analysis-output.v1', {
  answer: 'bounded-source-output'
});

function predecessor() {
  return materializeCapabilitySourceAdmissionEvidenceV2(
    admissibleDecision,
    evaluatedAt,
    sourceOutput
  );
}

function resolvedSourceUse(
  overrides: Partial<Extract<CapabilitySourceUseContextResolutionV1, { status: 'RESOLVED' }>> = {}
): Extract<CapabilitySourceUseContextResolutionV1, { status: 'RESOLVED' }> {
  return {
    status: 'RESOLVED',
    policy: {
      policyId: 'capability-source-use-policy.analysis-source-use.v1',
      policyVersion: 1
    },
    provenanceRefs: ['reviewed-evidence:bounded-v1'],
    assumptions: ['The request facts supplied by the caller are taken as input facts only.'],
    limitations: ['The result is analytical source material and is not a legal conclusion.'],
    ...overrides
  };
}

function successfulExecution(output: unknown) {
  return {
    callerSuppliedAssumptions: ['must-not-be-used'],
    outcome: {
      status: 'SUCCEEDED',
      outputSchemaId: 'analysis-output.v1',
      output
    },
    returnValue: {
      status: 'COMPLETED',
      outputSchemaId: 'analysis-output.v1',
      output: structuredClone(output)
    }
  };
}

function expectV3Error(
  run: () => unknown,
  code: CapabilitySourceAdmissionEvidenceV3Error['code']
) {
  try {
    run();
    throw new Error(`expected Capability source admission V3 error ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(CapabilitySourceAdmissionEvidenceV3Error);
    if (!(error instanceof CapabilitySourceAdmissionEvidenceV3Error)) throw error;
    expect(error.code).toBe(code);
  }
}

describe('Capability production source-use evidence V3', () => {
  it('adds bounded current source-use context while preserving exact V2 predecessor lineage', () => {
    const v2 = predecessor();
    const before = structuredClone(v2);
    const evidence = materializeCapabilitySourceAdmissionEvidenceV3(v2, resolvedSourceUse());

    expect(evidence).toMatchObject({
      schemaVersion: 3,
      producer: 'CAPABILITY_ENGINE',
      evidenceVersion: 3,
      evaluatedAt,
      decisionFingerprintSha256: v2.decisionFingerprintSha256,
      predecessorEvidence: {
        evidenceId: v2.evidenceId,
        evidenceVersion: 2,
        evidenceFingerprintSha256: v2.evidenceFingerprintSha256
      },
      decision: admissibleDecision,
      sourceOutput,
      sourceUse: {
        schemaVersion: 1,
        currentness: 'CURRENT',
        currentnessCheckedAt: evaluatedAt,
        policy: {
          policyId: 'capability-source-use-policy.analysis-source-use.v1',
          policyVersion: 1
        },
        assumptions: ['The request facts supplied by the caller are taken as input facts only.'],
        limitations: ['The result is analytical source material and is not a legal conclusion.']
      },
      authority: capabilitySourceAdmissionNoAuthorityConsequences
    });
    expect(evidence.sourceUse.provenanceRefs).toEqual(
      [
        `capability-source-admission-evidence:${v2.evidenceId}:${v2.evidenceFingerprintSha256}`,
        'brain-method-activation:decision_source-use:method-fingerprint',
        'core-reference:official-source-v2',
        'reviewed-evidence:bounded-v1'
      ].sort()
    );
    expect(evidence.evidenceId).toBe(
      `capability-source-admission-evidence_${evidence.evidenceFingerprintSha256}`
    );
    expect(v2).toEqual(before);
  });

  it('normalizes provenance ordering and duplicate refs for deterministic replay', () => {
    const v2 = predecessor();
    const first = materializeCapabilitySourceAdmissionEvidenceV3(
      v2,
      resolvedSourceUse({
        provenanceRefs: ['z-ref', 'a-ref', 'z-ref']
      })
    );
    const second = materializeCapabilitySourceAdmissionEvidenceV3(
      v2,
      resolvedSourceUse({
        provenanceRefs: ['a-ref', 'z-ref']
      })
    );

    expect(second).toEqual(first);
    expect(first.sourceUse.provenanceRefs).toEqual([...first.sourceUse.provenanceRefs].sort());
  });

  it('changes V3 identity when producer assumptions, limitations or source-use policy drift', () => {
    const v2 = predecessor();
    const baseline = materializeCapabilitySourceAdmissionEvidenceV3(v2, resolvedSourceUse());
    const changedAssumption = materializeCapabilitySourceAdmissionEvidenceV3(
      v2,
      resolvedSourceUse({ assumptions: ['A materially different producer assumption.'] })
    );
    const changedLimitation = materializeCapabilitySourceAdmissionEvidenceV3(
      v2,
      resolvedSourceUse({ limitations: ['A materially different producer limitation.'] })
    );
    const changedPolicy = materializeCapabilitySourceAdmissionEvidenceV3(
      v2,
      resolvedSourceUse({
        policy: {
          policyId: 'capability-source-use-policy.analysis-source-use.v2',
          policyVersion: 2
        }
      })
    );

    for (const changed of [changedAssumption, changedLimitation, changedPolicy]) {
      expect(changed.predecessorEvidence).toEqual(baseline.predecessorEvidence);
      expect(changed.decisionFingerprintSha256).toBe(baseline.decisionFingerprintSha256);
      expect(changed.evidenceFingerprintSha256).not.toBe(baseline.evidenceFingerprintSha256);
      expect(changed.evidenceId).not.toBe(baseline.evidenceId);
    }
  });

  it('fails closed on unresolved or malformed producer source-use context', () => {
    const v2 = predecessor();

    expectV3Error(
      () =>
        materializeCapabilitySourceAdmissionEvidenceV3(v2, {
          status: 'UNAVAILABLE',
          reason: 'Producer policy store is unavailable.'
        }),
      'SOURCE_USE_CONTEXT_UNAVAILABLE'
    );
    expectV3Error(
      () =>
        materializeCapabilitySourceAdmissionEvidenceV3(
          v2,
          resolvedSourceUse({ assumptions: ['duplicate', 'duplicate'] })
        ),
      'INVALID_SOURCE_USE_CONTEXT'
    );
    expectV3Error(
      () =>
        materializeCapabilitySourceAdmissionEvidenceV3(
          v2,
          resolvedSourceUse({ limitations: ['   '] })
        ),
      'INVALID_SOURCE_USE_CONTEXT'
    );
  });

  it('never upgrades denied source evidence into production source-use evidence', () => {
    const denied = materializeCapabilitySourceAdmissionEvidenceV2(
      deniedDecision,
      evaluatedAt,
      sourceOutput
    );

    expectV3Error(
      () => materializeCapabilitySourceAdmissionEvidenceV3(denied, resolvedSourceUse()),
      'SOURCE_NOT_PRODUCTION_ADMISSIBLE'
    );
  });

  it('delegates admission once, ignores caller text, and obtains constraints only from producer authority', async () => {
    const evaluate = vi.fn(() => Promise.resolve(admissibleDecision));
    const resolve = vi.fn(
      (
        input: Readonly<{
          runtimeExecution: unknown;
          evidence: ReturnType<typeof predecessor>;
        }>
      ): CapabilitySourceUseContextResolutionV1 => {
        void input;
        return resolvedSourceUse({
          assumptions: ['Producer-owned assumption.'],
          limitations: ['Producer-owned limitation.']
        });
      }
    );
    const materializer = new CurrentCapabilitySourceAdmissionEvidenceMaterializerV3({
      evaluator: { evaluate },
      sourceUse: { resolve },
      now: () => evaluatedAt
    });
    const runtimeExecution = successfulExecution({ answer: 'bounded-source-output' });

    const evidence = await materializer.evaluateAndMaterialize(runtimeExecution);

    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(evaluate).toHaveBeenCalledWith(runtimeExecution);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve.mock.calls[0]?.[0]?.runtimeExecution).toBe(runtimeExecution);
    expect(resolve.mock.calls[0]?.[0]?.evidence.decision.decision).toBe('PRODUCTION_ADMISSIBLE');
    expect(evidence.sourceUse.assumptions).toEqual(['Producer-owned assumption.']);
    expect(evidence.sourceUse.limitations).toEqual(['Producer-owned limitation.']);
    expect(evidence.sourceUse.assumptions).not.toContain('must-not-be-used');
  });

  it('does not call source-use authority for a denied source', async () => {
    const resolve = vi.fn(() => resolvedSourceUse());
    const materializer = new CurrentCapabilitySourceAdmissionEvidenceMaterializerV3({
      evaluator: { evaluate: () => Promise.resolve(deniedDecision) },
      sourceUse: { resolve },
      now: () => evaluatedAt
    });

    await expect(
      materializer.evaluateAndMaterialize(successfulExecution({ answer: 'pilot-output' }))
    ).rejects.toMatchObject({ code: 'SOURCE_NOT_PRODUCTION_ADMISSIBLE' });
    expect(resolve).not.toHaveBeenCalled();
  });

  it('converts producer source-use authority failure into a fail-closed availability error', async () => {
    const materializer = new CurrentCapabilitySourceAdmissionEvidenceMaterializerV3({
      evaluator: { evaluate: () => Promise.resolve(admissibleDecision) },
      sourceUse: {
        resolve: () => {
          throw new Error('internal source-use policy failure');
        }
      },
      now: () => evaluatedAt
    });

    await expect(
      materializer.evaluateAndMaterialize(
        successfulExecution({ answer: 'bounded-source-output' })
      )
    ).rejects.toMatchObject({ code: 'SOURCE_USE_CONTEXT_UNAVAILABLE' });
  });

  it('keeps every current Phase 4 source-admission policy explicitly PILOT', () => {
    expect(currentCapabilitySourceAdmissionPoliciesV1).toHaveLength(4);
    expect(
      currentCapabilitySourceAdmissionPoliciesV1.every((entry) => entry.maturityClass === 'PILOT')
    ).toBe(true);
  });
});
