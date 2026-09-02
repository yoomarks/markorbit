import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type { ImplementationProfile } from '@markorbit/contracts/capability-runtime';
import { describe, expect, it, vi } from 'vitest';
import {
  GovernedCapabilityRuntime,
  type CapabilityRuntimeExecution,
  type CapabilityRuntimeIdFactory
} from '../src/capability-runtime.js';
import {
  CurrentCapabilitySourceAdmissionEvidenceMaterializerV5,
  CurrentCapabilitySourceAdmissionPolicyContentTrackingEvaluatorV1
} from '../src/current-source-admission-evidence-v5.js';
import type { CapabilitySourceAdmissionPolicyContentProvenanceAuthorityV1 } from '../src/source-admission-policy-content-provenance.js';
import {
  CapabilityProductionSourceExplainabilityError,
  projectCapabilityProductionSourceExplainabilityV1
} from '../src/production-source-explainability.js';

const evaluatedAt = '2026-09-03T00:10:00.000Z';

const definition: RuntimeCapabilityDefinition = {
  schemaVersion: 1,
  runtimeCapabilityDefinitionId: 'runtime-capability_explainability',
  version: 2,
  capabilityId: 'analysis.explainability',
  capabilityVersion: '1.0.0',
  title: 'Explainability Projection Test',
  description: 'Governed Capability fixture for bounded production-source explainability.',
  lineage: { capabilityId: 'analysis.explainability' },
  canonReference: {
    canonId: 'capability-explainability',
    canonVersion: '2026-09-03',
    sourceFingerprintSha256: 'a'.repeat(64)
  },
  acceptedCanonProjection: true,
  createdFromWorkEvidence: false,
  createdFromAiOutput: false,
  createdAt: '2026-09-03T00:00:00.000Z'
};

const profile: ImplementationProfile = {
  schemaVersion: 1,
  implementationProfileId: 'implementation-profile_explainability',
  version: 3,
  capabilityId: definition.capabilityId,
  capabilityVersion: definition.capabilityVersion,
  kind: 'DETERMINISTIC_SERVICE',
  status: 'APPROVED',
  implementationKey: 'capability-engine:test:explainability',
  inputSchemaId: 'explainability-input.v1',
  outputSchemaId: 'explainability-output.v1',
  allowedCallerProducts: ['MARKREG'],
  maximumRiskClass: 'LOW',
  timeoutMs: 1000,
  maxAttempts: 1,
  approvalPolicyVersion: 'explainability-binding.v1',
  createdAt: '2026-09-03T00:00:00.000Z'
};

function ids(): CapabilityRuntimeIdFactory {
  return {
    capabilityRequest: () => 'capreq_explainability',
    implementationBinding: () => 'implementation-binding_explainability',
    capabilityInvocation: () => 'capability-invocation_explainability',
    capabilityOutcome: () => 'capability-outcome_explainability',
    capabilityReturn: () => 'capability-return_explainability',
    sessionReceipt: () => 'session-receipt_explainability'
  };
}

async function execution(): Promise<CapabilityRuntimeExecution> {
  const runtime = new GovernedCapabilityRuntime({
    definitions: { findCurrent: vi.fn(() => Promise.resolve(definition)) },
    implementations: {
      select: vi.fn(() =>
        Promise.resolve({
          profile,
          policyVersion: 'explainability-selection.v1'
        })
      )
    },
    inputContracts: { validate: vi.fn(() => true) },
    outputContracts: { validate: vi.fn(() => true) },
    executor: {
      execute: vi.fn(() =>
        Promise.resolve({
          output: {
            confidentialRawOutput: 'must-never-appear-in-explainability-projection',
            answer: 'bounded-source-output'
          },
          evidenceRefs: ['producer-evidence:explainability']
        })
      )
    },
    now: () => '2026-09-03T00:05:00.000Z',
    ids: ids()
  });

  return runtime.invoke({
    schemaVersion: 2,
    capabilityId: definition.capabilityId,
    capabilityVersion: definition.capabilityVersion,
    caller: {
      workspaceId: 'workspace_explainability',
      principalId: 'principal_explainability',
      callerProduct: 'MARKREG',
      permissionContextRef: 'permission_explainability'
    },
    purpose: 'Produce bounded source material for explainability projection tests.',
    input: { secretInput: 'must-not-appear-in-projection' },
    inputSchemaId: profile.inputSchemaId,
    outputSchemaId: profile.outputSchemaId,
    riskClass: 'LOW',
    idempotencyKey: 'explainability-1',
    correlationId: 'correlation_explainability'
  });
}

function policyAuthority(): CapabilitySourceAdmissionPolicyContentProvenanceAuthorityV1 {
  return {
    evaluate: vi.fn(() => ({
      applicability: 'SUPPORTED' as const,
      policy: {
        policyId: 'source-admission-policy.explainability.v1',
        policyVersion: 1,
        policyFingerprintSha256: 'b'.repeat(64)
      },
      methodCurrentness: 'NOT_REQUIRED' as const,
      referenceCurrentness: 'NOT_REQUIRED' as const
    }))
  };
}

function materializer() {
  return new CurrentCapabilitySourceAdmissionEvidenceMaterializerV5({
    evaluator: new CurrentCapabilitySourceAdmissionPolicyContentTrackingEvaluatorV1({
      admission: {
        capabilities: { findCurrent: vi.fn(() => Promise.resolve(definition)) },
        implementations: { findCurrent: vi.fn(() => profile) }
      },
      policy: policyAuthority()
    }),
    sourceUse: {
      resolve: vi.fn(() => ({
        status: 'RESOLVED' as const,
        policy: {
          policyId: 'capability-source-use-policy.explainability.v1',
          policyVersion: 1
        },
        provenanceRefs: ['reviewed-evidence:explainability'],
        assumptions: ['Caller-supplied facts remain bounded input facts.'],
        limitations: ['The source material creates no legal conclusion or product authorization.']
      }))
    },
    now: () => evaluatedAt
  });
}

describe('Capability production-source explainability projection', () => {
  it('projects exact V5 trust metadata without exposing raw request/input/output payloads', async () => {
    const evidence = await materializer().evaluateAndMaterialize(await execution());
    const projection = projectCapabilityProductionSourceExplainabilityV1(evidence);

    expect(projection).toMatchObject({
      schemaVersion: 1,
      producer: 'CAPABILITY_ENGINE',
      admission: 'PRODUCTION_ADMISSIBLE',
      evidence: {
        evidenceId: evidence.evidenceId,
        evidenceVersion: 5,
        evidenceFingerprintSha256: evidence.evidenceFingerprintSha256,
        evaluatedAt
      },
      current: evidence.decision.current,
      admissionPolicy: evidence.admissionPolicy,
      sourceUse: {
        currentness: 'CURRENT',
        currentnessCheckedAt: evaluatedAt,
        policy: {
          policyId: 'capability-source-use-policy.explainability.v1',
          policyVersion: 1
        },
        assumptions: ['Caller-supplied facts remain bounded input facts.'],
        limitations: ['The source material creates no legal conclusion or product authorization.']
      },
      sourceOutput: evidence.sourceOutput
    });
    expect(projection.methodSource).toBeUndefined();
    expect(projection.referenceSources).toEqual([]);

    const serialized = JSON.stringify(projection);
    expect(serialized).not.toContain('must-never-appear-in-explainability-projection');
    expect(serialized).not.toContain('bounded-source-output');
    expect(serialized).not.toContain('must-not-appear-in-projection');
  });

  it('fails closed for a tampered V5 proof', async () => {
    const evidence = await materializer().evaluateAndMaterialize(await execution());
    const tampered = {
      ...structuredClone(evidence),
      evidenceFingerprintSha256: 'c'.repeat(64)
    };

    expect(() => projectCapabilityProductionSourceExplainabilityV1(tampered)).toThrow(
      CapabilityProductionSourceExplainabilityError
    );
  });

  it('reconstructs bounded arrays and identities so later input mutation cannot change projection truth', async () => {
    const evidence = structuredClone(
      await materializer().evaluateAndMaterialize(await execution())
    );
    const projection = projectCapabilityProductionSourceExplainabilityV1(evidence);
    const mutableEvidence = evidence as unknown as {
      sourceUse: { assumptions: string[]; provenanceRefs: string[] };
      admissionPolicy: { policyFingerprintSha256: string };
    };

    mutableEvidence.sourceUse.assumptions.push('later caller mutation');
    mutableEvidence.sourceUse.provenanceRefs.push('later-ref');
    mutableEvidence.admissionPolicy.policyFingerprintSha256 = 'd'.repeat(64);

    expect(projection.sourceUse.assumptions).toEqual([
      'Caller-supplied facts remain bounded input facts.'
    ]);
    expect(projection.sourceUse.provenanceRefs).not.toContain('later-ref');
    expect(projection.admissionPolicy.policyFingerprintSha256).toBe('b'.repeat(64));
  });

  it('preserves explicit all-false non-authority semantics', async () => {
    const projection = projectCapabilityProductionSourceExplainabilityV1(
      await materializer().evaluateAndMaterialize(await execution())
    );

    expect(Object.values(projection.authority).every((value) => value === false)).toBe(true);
  });
});
