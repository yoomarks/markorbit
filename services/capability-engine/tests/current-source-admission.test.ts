import { describe, expect, it, vi } from 'vitest';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type { ImplementationProfile } from '@markorbit/contracts/capability-runtime';
import {
  GovernedCapabilityRuntime,
  type CapabilityRuntimeExecution,
  type CapabilityRuntimeIdFactory
} from '../src/capability-runtime.js';
import {
  CurrentCapabilitySourceAdmissionEvaluator,
  type CapabilityMethodCurrentnessResult,
  type CapabilityReferenceCurrentnessResult,
  type CapabilitySourceAdmissionPolicyResult,
  type CurrentCapabilitySourceAdmissionEvaluatorOptions
} from '../src/current-source-admission.js';

const definition: RuntimeCapabilityDefinition = {
  schemaVersion: 1,
  runtimeCapabilityDefinitionId: 'runtime-capability_source-admission-test',
  version: 3,
  capabilityId: 'source-admission-test',
  capabilityVersion: '1.0.0',
  title: 'Source Admission Test',
  description: 'Governed test capability for producer-side source admission.',
  lineage: { capabilityId: 'source-admission-test' },
  canonReference: {
    canonId: 'capability-source-admission-test',
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
  implementationProfileId: 'implementation-profile_source-admission-test',
  version: 2,
  capabilityId: definition.capabilityId,
  capabilityVersion: definition.capabilityVersion,
  kind: 'DETERMINISTIC_SERVICE',
  status: 'APPROVED',
  implementationKey: 'capability-engine:test:source-admission',
  inputSchemaId: 'source-admission-input.v1',
  outputSchemaId: 'source-admission-output.v1',
  allowedCallerProducts: ['MARKREG'],
  maximumRiskClass: 'MODERATE',
  timeoutMs: 1000,
  maxAttempts: 1,
  approvalPolicyVersion: 'capability-source-admission-binding.v1',
  createdAt: '2026-09-01T00:00:00.000Z'
};

const request = () => ({
  schemaVersion: 2 as const,
  capabilityId: definition.capabilityId,
  capabilityVersion: definition.capabilityVersion,
  caller: {
    workspaceId: 'workspace_source_admission',
    principalId: 'principal_source_admission',
    callerProduct: 'MARKREG',
    permissionContextRef: 'permission_source_admission'
  },
  purpose: 'Evaluate one governed analytical source.',
  input: { trademark: 'MARKORBIT' },
  inputSchemaId: profile.inputSchemaId,
  outputSchemaId: profile.outputSchemaId,
  riskClass: 'MODERATE' as const,
  idempotencyKey: 'source-admission-test-1',
  correlationId: 'correlation_source_admission'
});

function ids(): CapabilityRuntimeIdFactory {
  return {
    capabilityRequest: () => 'capreq_source_admission',
    implementationBinding: () => 'implementation-binding_source_admission',
    capabilityInvocation: () => 'capability-invocation_source_admission',
    capabilityOutcome: () => 'capability-outcome_source_admission',
    capabilityReturn: () => 'capability-return_source_admission',
    sessionReceipt: () => 'session-receipt_source_admission'
  };
}

async function execution(options?: { fail?: boolean }): Promise<CapabilityRuntimeExecution> {
  const runtime = new GovernedCapabilityRuntime({
    definitions: { findCurrent: vi.fn(() => Promise.resolve(definition)) },
    implementations: {
      select: vi.fn(() =>
        Promise.resolve({
          profile,
          policyVersion: 'capability-source-admission-selection.v1'
        })
      )
    },
    inputContracts: { validate: vi.fn(() => true) },
    outputContracts: { validate: vi.fn(() => true) },
    executor: {
      execute: vi.fn(() =>
        Promise.resolve({
          output: { band: 'HISTORICAL_REFERENCE' },
          evidenceRefs: ['evidence_method_1', 'evidence_source_1'],
          ...(options?.fail ? { failed: true } : {})
        })
      )
    },
    now: () => '2026-09-01T00:01:00.000Z',
    ids: ids()
  });
  return runtime.invoke(request());
}

const supportedPolicy: CapabilitySourceAdmissionPolicyResult = {
  applicability: 'SUPPORTED',
  methodCurrentness: 'NOT_REQUIRED',
  referenceCurrentness: 'NOT_REQUIRED'
};

function evaluator(
  overrides: Partial<CurrentCapabilitySourceAdmissionEvaluatorOptions> = {}
): CurrentCapabilitySourceAdmissionEvaluator {
  return new CurrentCapabilitySourceAdmissionEvaluator({
    capabilities: { findCurrent: vi.fn(() => Promise.resolve(definition)) },
    implementations: { findCurrent: vi.fn(() => profile) },
    policy: { evaluate: vi.fn(() => supportedPolicy) },
    ...overrides
  });
}

const currentMethod: CapabilityMethodCurrentnessResult = {
  status: 'CURRENT',
  identity: {
    evidenceRef: 'evidence_method_1',
    methodId: 'method_duration-band',
    methodVersionId: 'method-version_duration-band_v3',
    packageId: 'method-package_duration-band',
    packageVersion: '3.0.0',
    activationId: 'method-activation_duration-band_v3',
    evaluationId: 'method-evaluation_duration-band_v3'
  }
};

const currentReferences: CapabilityReferenceCurrentnessResult = {
  status: 'CURRENT',
  references: [
    {
      evidenceRef: 'evidence_source_1',
      sourceId: 'data-engine-query_cn-duration',
      sourceVersion: '2026-09-01',
      sourceFingerprintSha256: 'b'.repeat(64)
    }
  ]
};

describe('CurrentCapabilitySourceAdmissionEvaluator', () => {
  it('admits a successful exact current runtime result without creating downstream authority', async () => {
    const historical = await execution();
    const result = await evaluator().evaluate(historical);

    expect(result).toMatchObject({
      decision: 'PRODUCTION_ADMISSIBLE',
      producer: 'CAPABILITY_ENGINE',
      current: {
        capability: {
          runtimeCapabilityDefinitionId: definition.runtimeCapabilityDefinitionId,
          version: definition.version
        },
        implementation: {
          implementationProfileId: profile.implementationProfileId,
          version: profile.version,
          status: 'APPROVED'
        }
      }
    });
    expect(Object.values(result.authority).every((value) => value === false)).toBe(true);
  });

  it('fails closed when historical producer identity is internally inconsistent', async () => {
    const historical = await execution();
    const tampered = structuredClone(historical);
    tampered.receipt.capabilityReturnId = 'capability-return_tampered';

    await expect(evaluator().evaluate(tampered)).resolves.toMatchObject({
      decision: 'DENIED',
      denial: { code: 'INVALID_PRODUCER_EVIDENCE' }
    });
  });

  it('denies a historically successful replay after the Capability definition advances without mutation', async () => {
    const first = await execution();
    const replay = structuredClone(first);
    replay.replayed = true;
    const before = structuredClone(replay);
    const newerDefinition: RuntimeCapabilityDefinition = {
      ...definition,
      version: definition.version + 1,
      capabilityVersion: '1.1.0',
      canonReference: {
        ...definition.canonReference,
        canonVersion: '2026-09-02',
        sourceFingerprintSha256: 'c'.repeat(64)
      },
      createdAt: '2026-09-02T00:00:00.000Z'
    };

    const result = await evaluator({
      capabilities: { findCurrent: vi.fn(() => Promise.resolve(newerDefinition)) }
    }).evaluate(replay);

    expect(result).toMatchObject({
      decision: 'DENIED',
      denial: { code: 'NON_CURRENT_CAPABILITY_BINDING' },
      historical: { replayed: true }
    });
    expect(replay).toEqual(before);
  });

  it('denies a superseded Implementation Profile version for new consumption', async () => {
    const historical = await execution();
    const newerProfile: ImplementationProfile = {
      ...profile,
      version: profile.version + 1,
      maximumRiskClass: 'HIGH',
      createdAt: '2026-09-02T00:00:00.000Z'
    };

    await expect(
      evaluator({ implementations: { findCurrent: vi.fn(() => newerProfile) } }).evaluate(historical)
    ).resolves.toMatchObject({
      decision: 'DENIED',
      denial: { code: 'NON_CURRENT_IMPLEMENTATION_BINDING' }
    });
  });

  it('denies a latest RETIRED Implementation Profile without falling back to the older approval', async () => {
    const historical = await execution();
    const retiredProfile: ImplementationProfile = {
      ...profile,
      version: profile.version + 1,
      status: 'RETIRED',
      createdAt: '2026-09-02T00:00:00.000Z'
    };

    await expect(
      evaluator({ implementations: { findCurrent: vi.fn(() => retiredProfile) } }).evaluate(historical)
    ).resolves.toMatchObject({
      decision: 'DENIED',
      denial: { code: 'NON_CURRENT_IMPLEMENTATION_BINDING' }
    });
  });

  it('admits a method-backed result only when exact current method lineage is bound to runtime evidence', async () => {
    const historical = await execution();
    const result = await evaluator({
      policy: {
        evaluate: vi.fn(() => ({
          applicability: 'SUPPORTED' as const,
          methodCurrentness: 'REQUIRED' as const,
          referenceCurrentness: 'NOT_REQUIRED' as const
        }))
      },
      methodCurrentness: { evaluate: vi.fn(() => currentMethod) }
    }).evaluate(historical);

    expect(result).toMatchObject({
      decision: 'PRODUCTION_ADMISSIBLE',
      methodSource: currentMethod.status === 'CURRENT' ? currentMethod.identity : undefined
    });
  });

  it('denies a method package or activation that is no longer current', async () => {
    const historical = await execution();

    await expect(
      evaluator({
        policy: {
          evaluate: vi.fn(() => ({
            applicability: 'SUPPORTED' as const,
            methodCurrentness: 'REQUIRED' as const,
            referenceCurrentness: 'NOT_REQUIRED' as const
          }))
        },
        methodCurrentness: {
          evaluate: vi.fn(() => ({
            status: 'NOT_CURRENT' as const,
            reason: 'The governed method package is no longer active for new consumption.'
          }))
        }
      }).evaluate(historical)
    ).resolves.toMatchObject({
      decision: 'DENIED',
      denial: { code: 'SOURCE_REFERENCE_NOT_CURRENT' }
    });
  });

  it('rejects a claimed current method identity that is not bound to producer evidence', async () => {
    const historical = await execution();
    const wrongEvidence: CapabilityMethodCurrentnessResult = {
      status: 'CURRENT',
      identity: {
        ...(currentMethod.status === 'CURRENT' ? currentMethod.identity : neverMethod()),
        evidenceRef: 'evidence_not_in_receipt'
      }
    };

    await expect(
      evaluator({
        policy: {
          evaluate: vi.fn(() => ({
            applicability: 'SUPPORTED' as const,
            methodCurrentness: 'REQUIRED' as const,
            referenceCurrentness: 'NOT_REQUIRED' as const
          }))
        },
        methodCurrentness: { evaluate: vi.fn(() => wrongEvidence) }
      }).evaluate(historical)
    ).resolves.toMatchObject({
      decision: 'DENIED',
      denial: { code: 'INVALID_PRODUCER_EVIDENCE' }
    });
  });

  it('admits replaceable reference sources only after bounded currentness evaluation', async () => {
    const historical = await execution();
    const result = await evaluator({
      policy: {
        evaluate: vi.fn(() => ({
          applicability: 'SUPPORTED' as const,
          methodCurrentness: 'NOT_REQUIRED' as const,
          referenceCurrentness: 'REQUIRED' as const
        }))
      },
      referenceCurrentness: { evaluate: vi.fn(() => currentReferences) }
    }).evaluate(historical);

    expect(result).toMatchObject({
      decision: 'PRODUCTION_ADMISSIBLE',
      referenceSources:
        currentReferences.status === 'CURRENT' ? currentReferences.references : undefined
    });
  });

  it('distinguishes non-current source/reference denial from stale producer binding', async () => {
    const historical = await execution();

    await expect(
      evaluator({
        policy: {
          evaluate: vi.fn(() => ({
            applicability: 'SUPPORTED' as const,
            methodCurrentness: 'NOT_REQUIRED' as const,
            referenceCurrentness: 'REQUIRED' as const
          }))
        },
        referenceCurrentness: {
          evaluate: vi.fn(() => ({
            status: 'NOT_CURRENT' as const,
            reason: 'The referenced dataset has been replaced by a newer accepted population.'
          }))
        }
      }).evaluate(historical)
    ).resolves.toMatchObject({
      decision: 'DENIED',
      denial: { code: 'SOURCE_REFERENCE_NOT_CURRENT' }
    });
  });

  it('returns an explicit Coverage Gap for unsupported applicability', async () => {
    const historical = await execution();

    await expect(
      evaluator({
        policy: {
          evaluate: vi.fn(() => ({
            applicability: 'UNSUPPORTED' as const,
            reason: 'The requested jurisdiction is outside the accepted applicability envelope.'
          }))
        }
      }).evaluate(historical)
    ).resolves.toMatchObject({
      decision: 'DENIED',
      denial: { code: 'UNSUPPORTED_APPLICABILITY' }
    });
  });

  it('fails closed when a required currentness authority is absent or unavailable', async () => {
    const historical = await execution();
    const requiredPolicy = {
      evaluate: vi.fn(() => ({
        applicability: 'SUPPORTED' as const,
        methodCurrentness: 'REQUIRED' as const,
        referenceCurrentness: 'NOT_REQUIRED' as const
      }))
    };

    await expect(evaluator({ policy: requiredPolicy }).evaluate(historical)).resolves.toMatchObject({
      decision: 'DENIED',
      denial: { code: 'DEPENDENCY_RUNTIME_UNAVAILABLE' }
    });

    await expect(
      evaluator({
        policy: requiredPolicy,
        methodCurrentness: {
          evaluate: vi.fn(() => Promise.reject(new Error('method authority unavailable')))
        }
      }).evaluate(historical)
    ).resolves.toMatchObject({
      decision: 'DENIED',
      denial: { code: 'DEPENDENCY_RUNTIME_UNAVAILABLE' }
    });
  });

  it('fails closed when producer current-definition or profile authorities cannot establish currentness', async () => {
    const historical = await execution();

    await expect(
      evaluator({
        capabilities: {
          findCurrent: vi.fn(() => Promise.reject(new Error('registry unavailable')))
        }
      }).evaluate(historical)
    ).resolves.toMatchObject({
      decision: 'DENIED',
      denial: { code: 'DEPENDENCY_RUNTIME_UNAVAILABLE' }
    });

    await expect(
      evaluator({
        implementations: {
          findCurrent: vi.fn(() => Promise.reject(new Error('profile authority unavailable')))
        }
      }).evaluate(historical)
    ).resolves.toMatchObject({
      decision: 'DENIED',
      denial: { code: 'DEPENDENCY_RUNTIME_UNAVAILABLE' }
    });
  });

  it('does not convert a governed runtime failure into source admission or Method Improvement authority', async () => {
    const failed = await execution({ fail: true });
    const result = await evaluator().evaluate(failed);

    expect(result).toMatchObject({
      decision: 'DENIED',
      denial: { code: 'DEPENDENCY_RUNTIME_UNAVAILABLE' },
      authority: {
        methodImprovementTriggerCreated: false,
        officialTruthCreated: false,
        automaticFallbackExecuted: false,
        syntheticSourceCreated: false
      }
    });
  });

  it('rejects incomplete current reference identity instead of synthesizing missing provenance', async () => {
    const historical = await execution();
    const incomplete: CapabilityReferenceCurrentnessResult = {
      status: 'CURRENT',
      references: [
        {
          evidenceRef: 'evidence_source_1',
          sourceId: '',
          sourceVersion: '2026-09-01'
        }
      ]
    };

    await expect(
      evaluator({
        policy: {
          evaluate: vi.fn(() => ({
            applicability: 'SUPPORTED' as const,
            methodCurrentness: 'NOT_REQUIRED' as const,
            referenceCurrentness: 'REQUIRED' as const
          }))
        },
        referenceCurrentness: { evaluate: vi.fn(() => incomplete) }
      }).evaluate(historical)
    ).resolves.toMatchObject({
      decision: 'DENIED',
      denial: { code: 'INVALID_PRODUCER_EVIDENCE' },
      authority: {
        automaticFallbackExecuted: false,
        syntheticSourceCreated: false
      }
    });
  });
});

function neverMethod() {
  return {
    evidenceRef: 'never',
    methodId: 'never',
    methodVersionId: 'never',
    packageId: 'never',
    packageVersion: 'never',
    activationId: 'never',
    evaluationId: 'never'
  };
}
