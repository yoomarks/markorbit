import { describe, expect, it, vi } from 'vitest';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type { ImplementationProfile } from '@markorbit/contracts/capability-runtime';
import {
  GovernedCapabilityRuntime,
  type CapabilityRuntimeExecution,
  type CapabilityRuntimeIdFactory
} from '../src/capability-runtime.js';
import {
  CapabilitySourceAdmissionEvidenceV4Error,
  CurrentCapabilitySourceAdmissionEvidenceMaterializerV4,
  CurrentCapabilitySourceAdmissionPolicyTrackingEvaluatorV1,
  validCapabilitySourceAdmissionEvidenceV4
} from '../src/current-source-admission-evidence-v4.js';
import type { CapabilitySourceAdmissionPolicyProvenanceAuthorityV1 } from '../src/source-admission-policy-provenance.js';

const evaluatedAt = '2026-09-01T10:15:00.000Z';

const definition: RuntimeCapabilityDefinition = {
  schemaVersion: 1,
  runtimeCapabilityDefinitionId: 'runtime-capability_policy-proof',
  version: 2,
  capabilityId: 'analysis.policy-proof',
  capabilityVersion: '1.0.0',
  title: 'Policy Proof Test',
  description: 'Governed Capability fixture for admission policy provenance tests.',
  lineage: { capabilityId: 'analysis.policy-proof' },
  canonReference: {
    canonId: 'capability-policy-proof',
    canonVersion: '2026-09-01',
    sourceFingerprintSha256: 'a'.repeat(64)
  },
  acceptedCanonProjection: true,
  createdFromWorkEvidence: false,
  createdFromAiOutput: false,
  createdAt: '2026-09-01T00:00:00.000Z'
};

const profile: ImplementationProfile = {
  schemaVersion: 1,
  implementationProfileId: 'implementation-profile_policy-proof',
  version: 3,
  capabilityId: definition.capabilityId,
  capabilityVersion: definition.capabilityVersion,
  kind: 'DETERMINISTIC_SERVICE',
  status: 'APPROVED',
  implementationKey: 'capability-engine:test:policy-proof',
  inputSchemaId: 'policy-proof-input.v1',
  outputSchemaId: 'policy-proof-output.v1',
  allowedCallerProducts: ['MARKREG'],
  maximumRiskClass: 'LOW',
  timeoutMs: 1000,
  maxAttempts: 1,
  approvalPolicyVersion: 'policy-proof-binding.v1',
  createdAt: '2026-09-01T00:00:00.000Z'
};

function ids(): CapabilityRuntimeIdFactory {
  return {
    capabilityRequest: () => 'capreq_policy_proof',
    implementationBinding: () => 'implementation-binding_policy_proof',
    capabilityInvocation: () => 'capability-invocation_policy_proof',
    capabilityOutcome: () => 'capability-outcome_policy_proof',
    capabilityReturn: () => 'capability-return_policy_proof',
    sessionReceipt: () => 'session-receipt_policy_proof'
  };
}

async function execution(): Promise<CapabilityRuntimeExecution> {
  const runtime = new GovernedCapabilityRuntime({
    definitions: { findCurrent: vi.fn(() => Promise.resolve(definition)) },
    implementations: {
      select: vi.fn(() =>
        Promise.resolve({
          profile,
          policyVersion: 'policy-proof-selection.v1'
        })
      )
    },
    inputContracts: { validate: vi.fn(() => true) },
    outputContracts: { validate: vi.fn(() => true) },
    executor: {
      execute: vi.fn(() =>
        Promise.resolve({
          output: { answer: 'bounded-source-output' },
          evidenceRefs: ['producer-evidence:policy-proof']
        })
      )
    },
    now: () => '2026-09-01T10:10:00.000Z',
    ids: ids()
  });

  return runtime.invoke({
    schemaVersion: 2,
    capabilityId: definition.capabilityId,
    capabilityVersion: definition.capabilityVersion,
    caller: {
      workspaceId: 'workspace_policy_proof',
      principalId: 'principal_policy_proof',
      callerProduct: 'MARKREG',
      permissionContextRef: 'permission_policy_proof'
    },
    purpose: 'Materialize one bounded producer source proof.',
    input: { mark: 'MARKORBIT' },
    inputSchemaId: profile.inputSchemaId,
    outputSchemaId: profile.outputSchemaId,
    riskClass: 'LOW',
    idempotencyKey: 'policy-proof-1',
    correlationId: 'correlation_policy_proof'
  });
}

function policyAuthority(policyId = 'source-admission-policy.policy-proof.v1', policyVersion = 1) {
  const evaluate = vi.fn(() => ({
    applicability: 'SUPPORTED' as const,
    policy: { policyId, policyVersion },
    methodCurrentness: 'NOT_REQUIRED' as const,
    referenceCurrentness: 'NOT_REQUIRED' as const
  }));
  return {
    authority: { evaluate } satisfies CapabilitySourceAdmissionPolicyProvenanceAuthorityV1,
    evaluate
  };
}

function trackingEvaluator(authority: CapabilitySourceAdmissionPolicyProvenanceAuthorityV1) {
  return new CurrentCapabilitySourceAdmissionPolicyTrackingEvaluatorV1({
    admission: {
      capabilities: { findCurrent: vi.fn(() => Promise.resolve(definition)) },
      implementations: { findCurrent: vi.fn(() => profile) }
    },
    policy: authority
  });
}

function sourceUseAuthority() {
  return {
    resolve: vi.fn(() => ({
      status: 'RESOLVED' as const,
      policy: {
        policyId: 'capability-source-use-policy.policy-proof.v1',
        policyVersion: 1
      },
      provenanceRefs: ['reviewed-evidence:policy-proof'],
      assumptions: ['Caller-supplied facts remain bounded input facts.'],
      limitations: ['The source result is analytical material and creates no legal conclusion.']
    }))
  };
}

function materializer(authority: CapabilitySourceAdmissionPolicyProvenanceAuthorityV1) {
  return new CurrentCapabilitySourceAdmissionEvidenceMaterializerV4({
    evaluator: trackingEvaluator(authority),
    sourceUse: sourceUseAuthority(),
    now: () => evaluatedAt
  });
}

function expectV4Error(error: unknown, code: CapabilitySourceAdmissionEvidenceV4Error['code']) {
  expect(error).toBeInstanceOf(CapabilitySourceAdmissionEvidenceV4Error);
  if (!(error instanceof CapabilitySourceAdmissionEvidenceV4Error)) throw error;
  expect(error.code).toBe(code);
}

describe('Capability source-admission evidence V4', () => {
  it('captures the exact admission policy from the same #397 evaluation and materializes V4', async () => {
    const historical = await execution();
    const before = structuredClone(historical);
    const policy = policyAuthority();
    const evidence = await materializer(policy.authority).evaluateAndMaterialize(historical);

    expect(policy.evaluate).toHaveBeenCalledTimes(1);
    expect(evidence).toMatchObject({
      schemaVersion: 4,
      producer: 'CAPABILITY_ENGINE',
      evidenceVersion: 4,
      evaluatedAt,
      admissionPolicy: {
        policyId: 'source-admission-policy.policy-proof.v1',
        policyVersion: 1
      },
      predecessorEvidence: { evidenceVersion: 3 },
      decision: { decision: 'PRODUCTION_ADMISSIBLE' },
      sourceUse: {
        currentness: 'CURRENT',
        currentnessCheckedAt: evaluatedAt
      }
    });
    expect(validCapabilitySourceAdmissionEvidenceV4(evidence)).toBe(true);
    expect(historical).toEqual(before);
  });

  it('keeps V3 predecessor identity stable while admission policy drift changes only V4 identity', async () => {
    const historical = await execution();
    const first = await materializer(
      policyAuthority('source-admission-policy.policy-proof.v1', 1).authority
    ).evaluateAndMaterialize(historical);
    const second = await materializer(
      policyAuthority('source-admission-policy.policy-proof.v2', 2).authority
    ).evaluateAndMaterialize(historical);

    expect(second.predecessorEvidence).toEqual(first.predecessorEvidence);
    expect(second.decisionFingerprintSha256).toBe(first.decisionFingerprintSha256);
    expect(second.admissionPolicy).not.toEqual(first.admissionPolicy);
    expect(second.evidenceFingerprintSha256).not.toBe(first.evidenceFingerprintSha256);
    expect(second.evidenceId).not.toBe(first.evidenceId);
  });

  it('fails closed when a supported policy result omits exact policy provenance', async () => {
    const historical = await execution();
    const malformed = {
      evaluate: vi.fn(() => ({
        applicability: 'SUPPORTED' as const,
        methodCurrentness: 'NOT_REQUIRED' as const,
        referenceCurrentness: 'NOT_REQUIRED' as const
      }))
    } as unknown as CapabilitySourceAdmissionPolicyProvenanceAuthorityV1;

    try {
      await materializer(malformed).evaluateAndMaterialize(historical);
      throw new Error('expected V4 admission-policy provenance failure');
    } catch (error) {
      expectV4Error(error, 'INVALID_ADMISSION_POLICY_PROVENANCE');
    }
  });

  it('never upgrades an unsupported or PILOT-like policy result into V4 production evidence', async () => {
    const historical = await execution();
    const unsupported = {
      evaluate: vi.fn(() => ({
        applicability: 'UNSUPPORTED' as const,
        reason: 'The source remains PILOT.'
      }))
    } satisfies CapabilitySourceAdmissionPolicyProvenanceAuthorityV1;

    await expect(
      materializer(unsupported).evaluateAndMaterialize(historical)
    ).rejects.toMatchObject({
      code: 'SOURCE_NOT_PRODUCTION_ADMISSIBLE'
    });
  });

  it('detects post-materialization admission-policy tampering', async () => {
    const historical = await execution();
    const evidence = await materializer(policyAuthority().authority).evaluateAndMaterialize(
      historical
    );
    const tampered = {
      ...structuredClone(evidence),
      admissionPolicy: {
        ...evidence.admissionPolicy,
        policyVersion: evidence.admissionPolicy.policyVersion + 1
      }
    };

    expect(validCapabilitySourceAdmissionEvidenceV4(tampered)).toBe(false);
    expect(validCapabilitySourceAdmissionEvidenceV4(evidence)).toBe(true);
  });
});
