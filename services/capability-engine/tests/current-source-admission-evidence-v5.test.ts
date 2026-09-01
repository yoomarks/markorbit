import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type { ImplementationProfile } from '@markorbit/contracts/capability-runtime';
import { describe, expect, it, vi } from 'vitest';
import {
  GovernedCapabilityRuntime,
  type CapabilityRuntimeExecution,
  type CapabilityRuntimeIdFactory
} from '../src/capability-runtime.js';
import {
  CapabilitySourceAdmissionPolicyContentTrackingError,
  CurrentCapabilitySourceAdmissionEvidenceMaterializerV5,
  CurrentCapabilitySourceAdmissionPolicyContentTrackingEvaluatorV1,
  validCapabilitySourceAdmissionEvidenceV5
} from '../src/current-source-admission-evidence-v5.js';
import type { CapabilitySourceAdmissionPolicyContentProvenanceAuthorityV1 } from '../src/source-admission-policy-content-provenance.js';

const evaluatedAt = '2026-09-01T10:55:00.000Z';

const definition: RuntimeCapabilityDefinition = {
  schemaVersion: 1,
  runtimeCapabilityDefinitionId: 'runtime-capability_policy-content-proof',
  version: 2,
  capabilityId: 'analysis.policy-content-proof',
  capabilityVersion: '1.0.0',
  title: 'Policy Content Proof Test',
  description: 'Governed Capability fixture for content-addressed admission policy tests.',
  lineage: { capabilityId: 'analysis.policy-content-proof' },
  canonReference: {
    canonId: 'capability-policy-content-proof',
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
  implementationProfileId: 'implementation-profile_policy-content-proof',
  version: 3,
  capabilityId: definition.capabilityId,
  capabilityVersion: definition.capabilityVersion,
  kind: 'DETERMINISTIC_SERVICE',
  status: 'APPROVED',
  implementationKey: 'capability-engine:test:policy-content-proof',
  inputSchemaId: 'policy-content-proof-input.v1',
  outputSchemaId: 'policy-content-proof-output.v1',
  allowedCallerProducts: ['MARKREG'],
  maximumRiskClass: 'LOW',
  timeoutMs: 1000,
  maxAttempts: 1,
  approvalPolicyVersion: 'policy-content-proof-binding.v1',
  createdAt: '2026-09-01T00:00:00.000Z'
};

function ids(): CapabilityRuntimeIdFactory {
  return {
    capabilityRequest: () => 'capreq_policy_content_proof',
    implementationBinding: () => 'implementation-binding_policy_content_proof',
    capabilityInvocation: () => 'capability-invocation_policy_content_proof',
    capabilityOutcome: () => 'capability-outcome_policy_content_proof',
    capabilityReturn: () => 'capability-return_policy_content_proof',
    sessionReceipt: () => 'session-receipt_policy_content_proof'
  };
}

async function execution(): Promise<CapabilityRuntimeExecution> {
  const runtime = new GovernedCapabilityRuntime({
    definitions: { findCurrent: vi.fn(() => Promise.resolve(definition)) },
    implementations: {
      select: vi.fn(() =>
        Promise.resolve({
          profile,
          policyVersion: 'policy-content-proof-selection.v1'
        })
      )
    },
    inputContracts: { validate: vi.fn(() => true) },
    outputContracts: { validate: vi.fn(() => true) },
    executor: {
      execute: vi.fn(() =>
        Promise.resolve({
          output: { answer: 'bounded-source-output' },
          evidenceRefs: ['producer-evidence:policy-content-proof']
        })
      )
    },
    now: () => '2026-09-01T10:50:00.000Z',
    ids: ids()
  });

  return runtime.invoke({
    schemaVersion: 2,
    capabilityId: definition.capabilityId,
    capabilityVersion: definition.capabilityVersion,
    caller: {
      workspaceId: 'workspace_policy_content_proof',
      principalId: 'principal_policy_content_proof',
      callerProduct: 'MARKREG',
      permissionContextRef: 'permission_policy_content_proof'
    },
    purpose: 'Materialize one bounded content-addressed producer source proof.',
    input: { mark: 'MARKORBIT' },
    inputSchemaId: profile.inputSchemaId,
    outputSchemaId: profile.outputSchemaId,
    riskClass: 'LOW',
    idempotencyKey: 'policy-content-proof-1',
    correlationId: 'correlation_policy_content_proof'
  });
}

function policyAuthority(policyFingerprintSha256 = 'b'.repeat(64)) {
  const evaluate = vi.fn(() => ({
    applicability: 'SUPPORTED' as const,
    policy: {
      policyId: 'source-admission-policy.policy-content-proof.v1',
      policyVersion: 1,
      policyFingerprintSha256
    },
    methodCurrentness: 'NOT_REQUIRED' as const,
    referenceCurrentness: 'NOT_REQUIRED' as const
  }));
  return {
    authority: { evaluate } satisfies CapabilitySourceAdmissionPolicyContentProvenanceAuthorityV1,
    evaluate
  };
}

function trackingEvaluator(authority: CapabilitySourceAdmissionPolicyContentProvenanceAuthorityV1) {
  return new CurrentCapabilitySourceAdmissionPolicyContentTrackingEvaluatorV1({
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
        policyId: 'capability-source-use-policy.policy-content-proof.v1',
        policyVersion: 1
      },
      provenanceRefs: ['reviewed-evidence:policy-content-proof'],
      assumptions: ['Caller-supplied facts remain bounded input facts.'],
      limitations: ['The source result is analytical material and creates no legal conclusion.']
    }))
  };
}

function materializer(authority: CapabilitySourceAdmissionPolicyContentProvenanceAuthorityV1) {
  return new CurrentCapabilitySourceAdmissionEvidenceMaterializerV5({
    evaluator: trackingEvaluator(authority),
    sourceUse: sourceUseAuthority(),
    now: () => evaluatedAt
  });
}

describe('Capability source-admission evidence V5', () => {
  it('captures content-addressed policy provenance from the same admission evaluation', async () => {
    const historical = await execution();
    const before = structuredClone(historical);
    const policy = policyAuthority();
    const evidence = await materializer(policy.authority).evaluateAndMaterialize(historical);

    expect(policy.evaluate).toHaveBeenCalledTimes(1);
    expect(evidence).toMatchObject({
      schemaVersion: 5,
      producer: 'CAPABILITY_ENGINE',
      evidenceVersion: 5,
      evaluatedAt,
      admissionPolicy: {
        policyId: 'source-admission-policy.policy-content-proof.v1',
        policyVersion: 1,
        policyFingerprintSha256: 'b'.repeat(64)
      },
      predecessorEvidence: { evidenceVersion: 4 },
      decision: { decision: 'PRODUCTION_ADMISSIBLE' },
      sourceUse: {
        currentness: 'CURRENT',
        currentnessCheckedAt: evaluatedAt
      }
    });
    expect(validCapabilitySourceAdmissionEvidenceV5(evidence)).toBe(true);
    expect(historical).toEqual(before);
  });

  it('keeps the exact V4 predecessor stable while same-version policy-content drift changes V5', async () => {
    const historical = await execution();
    const first = await materializer(
      policyAuthority('b'.repeat(64)).authority
    ).evaluateAndMaterialize(historical);
    const second = await materializer(
      policyAuthority('c'.repeat(64)).authority
    ).evaluateAndMaterialize(historical);

    expect(second.predecessorEvidence).toEqual(first.predecessorEvidence);
    expect(second.decisionFingerprintSha256).toBe(first.decisionFingerprintSha256);
    expect(second.admissionPolicy.policyId).toBe(first.admissionPolicy.policyId);
    expect(second.admissionPolicy.policyVersion).toBe(first.admissionPolicy.policyVersion);
    expect(second.admissionPolicy.policyFingerprintSha256).not.toBe(
      first.admissionPolicy.policyFingerprintSha256
    );
    expect(second.evidenceFingerprintSha256).not.toBe(first.evidenceFingerprintSha256);
    expect(second.evidenceId).not.toBe(first.evidenceId);
  });

  it('fails closed when supported policy content provenance is malformed', async () => {
    const historical = await execution();
    const malformed = policyAuthority('not-a-sha256');

    await expect(
      materializer(malformed.authority).evaluateAndMaterialize(historical)
    ).rejects.toBeInstanceOf(CapabilitySourceAdmissionPolicyContentTrackingError);
  });

  it('never upgrades an unsupported or PILOT-like policy result into V5 production evidence', async () => {
    const historical = await execution();
    const unsupported = {
      evaluate: vi.fn(() => ({
        applicability: 'UNSUPPORTED' as const,
        reason: 'The source remains PILOT.'
      }))
    } satisfies CapabilitySourceAdmissionPolicyContentProvenanceAuthorityV1;

    await expect(
      materializer(unsupported).evaluateAndMaterialize(historical)
    ).rejects.toMatchObject({
      code: 'SOURCE_NOT_PRODUCTION_ADMISSIBLE'
    });
  });

  it('detects post-materialization policy-content fingerprint tampering', async () => {
    const historical = await execution();
    const evidence = await materializer(policyAuthority().authority).evaluateAndMaterialize(
      historical
    );
    const tampered = {
      ...structuredClone(evidence),
      admissionPolicy: {
        ...evidence.admissionPolicy,
        policyFingerprintSha256: 'd'.repeat(64)
      }
    };

    expect(validCapabilitySourceAdmissionEvidenceV5(tampered)).toBe(false);
    expect(validCapabilitySourceAdmissionEvidenceV5(evidence)).toBe(true);
  });
});
