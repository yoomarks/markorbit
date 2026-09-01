import { describe, expect, it, vi } from 'vitest';

import {
  USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE,
  compileUsptoOfficialFeeMethodPackageV1,
  prepareUsptoOfficialFeeGovernedSuccessorV1
} from '@markorbit/contracts/brain-official-fee-method';
import {
  activateExecutableMethodPackageV1,
  executableMethodActivationEvidenceRefV1,
  prepareExecutableMethodPackageActivationDecisionV1
} from '@markorbit/contracts/brain-method-activation';
import type { ExecutableMethodPackageV1 } from '@markorbit/contracts/brain-method';
import type { CapabilityRequestV2Command } from '@markorbit/contracts/capability-runtime';

import {
  GovernedCapabilityRuntime,
  type CapabilityRuntimeExecution
} from '../src/capability-runtime.js';
import type { CapabilitySourceAdmissionPolicyInput } from '../src/current-source-admission.js';
import { currentCapabilitySourceAdmissionPolicyCatalogV1 } from '../src/source-admission-policy-catalog.js';
import {
  UsptoOfficialFeeMethodCurrentnessAuthorityV1,
  type UsptoOfficialFeeMethodActivationResolutionV1
} from '../src/uspto-official-fee-method-currentness.js';
import {
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_EVALUATION_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_VERSION_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_PACKAGE_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_PACKAGE_VERSION,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_SOURCE_IDENTITY_SHA256,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION,
  USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE,
  USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA,
  USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
  USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA,
  createUsptoOfficialFeeResolverCapabilityExecutorV1,
  validateUsptoOfficialFeeResolverInputV1,
  validateUsptoOfficialFeeResolverOutputV1
} from '../src/uspto-official-fee-resolver-pilot.js';

const EFFECTIVE_FROM = '2025-01-18T00:00:00.000-05:00';
const HISTORICAL_AS_OF = '2026-08-28T00:00:00.000Z';
const MATERIALIZED_AT = '2026-08-28T00:00:00.000Z';
const SYNTHETIC_APPROVED_AT = '2026-09-01T15:00:00.000Z';
const TEMPORAL_EVIDENCE_REF = 'USPTO_TRADEMARK_FEE_FINAL_RULE_EFFECTIVE_2025_01_18';
const CONFLICT_EVIDENCE_REF = 'USPTO_DUAL_SOURCE_AUTHORITY_RECONCILIATION_2026_08_28';

function compilationInput() {
  return {
    knowledgeSources: structuredClone(USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE),
    temporalResolution: {
      status: 'RESOLVED' as const,
      effectiveFrom: EFFECTIVE_FROM,
      evidenceRef: TEMPORAL_EVIDENCE_REF
    },
    conflictResolution: {
      status: 'NONE' as const,
      evidenceRef: CONFLICT_EVIDENCE_REF
    }
  };
}

function legacyPackage() {
  const compiled = compileUsptoOfficialFeeMethodPackageV1(compilationInput());
  if (compiled.status !== 'READY') throw new Error(`unexpected package status ${compiled.status}`);
  return compiled.package;
}

function governedPredecessor() {
  const prepared = prepareUsptoOfficialFeeGovernedSuccessorV1(compilationInput());
  if (prepared.status !== 'PREPARED') {
    throw new Error(`unexpected governed successor status ${prepared.status}`);
  }
  return prepared.validatedSuccessor;
}

function activationDecision(
  predecessor: Readonly<ExecutableMethodPackageV1>,
  decision: 'APPROVED' | 'REJECTED' = 'APPROVED'
) {
  return prepareExecutableMethodPackageActivationDecisionV1(predecessor, {
    decision,
    selectionPriority: 110,
    limitations: predecessor.limitations,
    policyVersion: 'test-only.brain-governance.uspto-fee.v1',
    approvedBy: 'synthetic-test-governance-actor',
    approvalTicketRef: 'TEST-ONLY-NOT-PRODUCTION-ACTIVATION',
    approvedAt: SYNTHETIC_APPROVED_AT,
    rationale: 'Synthetic test fixture proving canonical Method currentness mechanics only.'
  });
}

function approvedActivationFixture() {
  const predecessor = governedPredecessor();
  const decision = activationDecision(predecessor);
  const activePackage = activateExecutableMethodPackageV1(predecessor, decision);
  return Object.freeze({
    predecessor,
    decision,
    activePackage,
    activationEvidenceRef: executableMethodActivationEvidenceRefV1(decision)
  });
}

function acceptedReference() {
  const pkg = legacyPackage();
  return {
    schemaVersion: 1,
    referenceId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID,
    operation: USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
    jurisdiction: 'US',
    authority: 'USPTO',
    currency: 'USD',
    amountMinor: 35000,
    unit: 'PER_CLASS',
    effectiveFrom: EFFECTIVE_FROM,
    status: 'CURRENT',
    packageId: pkg.packageId,
    methodId: pkg.methodId,
    methodVersionId: pkg.methodVersionId,
    knowledgeSources: structuredClone(pkg.lineage.knowledgeSources),
    sourceIdentityFingerprintSha256: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_SOURCE_IDENTITY_SHA256,
    materializationFingerprintSha256: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256,
    materializedAt: MATERIALIZED_AT
  };
}

function resolverInput() {
  return {
    jurisdiction: 'US',
    authority: 'USPTO',
    objectType: 'TRADEMARK_APPLICATION',
    operation: USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
    procedure: 'ELECTRONIC_FILING',
    stage: 'NEW_APPLICATION',
    filingBasis: 'SECTION_1',
    segment: 'BASE_FEE',
    classCount: 2,
    asOf: HISTORICAL_AS_OF,
    acceptedReferenceId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID
  };
}

function command(overrides: Partial<CapabilityRequestV2Command> = {}): CapabilityRequestV2Command {
  return {
    schemaVersion: 2,
    capabilityId: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID,
    capabilityVersion: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION,
    caller: {
      workspaceId: 'workspace_method_currentness',
      principalId: 'principal_method_currentness',
      callerProduct: 'MARKREG',
      permissionContextRef: 'permission_method_currentness'
    },
    purpose: 'Resolve accepted USPTO fee evidence for Method currentness testing.',
    input: resolverInput(),
    inputSchemaId: USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA,
    outputSchemaId: USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA,
    riskClass: 'LOW',
    idempotencyKey: 'method-currentness-runtime',
    correlationId: 'correlation_method_currentness',
    ...overrides
  };
}

async function legacyExecution(): Promise<CapabilityRuntimeExecution> {
  const runtime = new GovernedCapabilityRuntime({
    definitions: {
      findCurrent: () => Promise.resolve(USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION)
    },
    implementations: {
      select: () =>
        Promise.resolve({
          profile: USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE,
          policyVersion: 'phase4-uspto-official-fee-method-selection.v1'
        })
    },
    inputContracts: {
      validate: (schemaId, value) =>
        schemaId === USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA &&
        validateUsptoOfficialFeeResolverInputV1(value)
    },
    outputContracts: {
      validate: (schemaId, value) =>
        schemaId === USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA &&
        validateUsptoOfficialFeeResolverOutputV1(value)
    },
    executor: createUsptoOfficialFeeResolverCapabilityExecutorV1(legacyPackage(), {
      resolveCurrent: () => acceptedReference()
    }),
    now: () => '2026-08-29T04:20:00.000Z'
  });
  const execution = await runtime.invoke(command());
  expect(execution.outcome.status).toBe('SUCCEEDED');
  return execution;
}

function policyInput(
  execution: Readonly<CapabilityRuntimeExecution>
): CapabilitySourceAdmissionPolicyInput {
  return {
    execution,
    currentCapability: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION,
    currentImplementation: USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE
  };
}

function executionWithActivePackageEvidence(
  execution: Readonly<CapabilityRuntimeExecution>,
  activePackage: Readonly<ExecutableMethodPackageV1>
): CapabilityRuntimeExecution {
  const evidenceRefs = execution.receipt.evidenceRefs.filter(
    (evidenceRef) => !evidenceRef.startsWith('brain-method-package:')
  );
  return {
    ...structuredClone(execution),
    receipt: {
      ...structuredClone(execution.receipt),
      evidenceRefs: [
        ...evidenceRefs,
        `brain-method-package:${activePackage.packageId}@${activePackage.packageVersion}`
      ]
    }
  };
}

function resolvedActivation(
  fixture: ReturnType<typeof approvedActivationFixture>
): Extract<UsptoOfficialFeeMethodActivationResolutionV1, { status: 'RESOLVED' }> {
  return {
    status: 'RESOLVED',
    predecessor: fixture.predecessor,
    decision: fixture.decision,
    activePackage: fixture.activePackage,
    activationEvidenceRef: fixture.activationEvidenceRef
  };
}

describe('USPTO official-fee Method currentness authority V1', () => {
  it('keeps the historical direct-ACTIVE v1 pilot NOT_CURRENT without consulting activation state', async () => {
    const execution = await legacyExecution();
    const resolveCurrent = vi.fn(() => resolvedActivation(approvedActivationFixture()));
    const authority = new UsptoOfficialFeeMethodCurrentnessAuthorityV1({
      activation: { resolveCurrent }
    });

    const result = await authority.evaluate(policyInput(execution));

    expect(result).toMatchObject({ status: 'NOT_CURRENT' });
    expect(resolveCurrent).not.toHaveBeenCalled();
    expect(execution.receipt.evidenceRefs).toContain(
      `brain-method-package:${USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_PACKAGE_ID}@${USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_PACKAGE_VERSION}`
    );
  });

  it('returns CURRENT only for exact execution evidence bound to a canonical approved activation', async () => {
    const fixture = approvedActivationFixture();
    const historical = await legacyExecution();
    const execution = executionWithActivePackageEvidence(historical, fixture.activePackage);
    const resolveCurrent = vi.fn(() => resolvedActivation(fixture));
    const authority = new UsptoOfficialFeeMethodCurrentnessAuthorityV1({
      activation: { resolveCurrent }
    });

    const result = await authority.evaluate(policyInput(execution));

    expect(resolveCurrent).toHaveBeenCalledOnce();
    expect(resolveCurrent).toHaveBeenCalledWith({
      capabilityId: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID,
      capabilityVersion: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION,
      implementationProfileId:
        USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.implementationProfileId,
      methodId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_ID,
      methodVersionId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_VERSION_ID
    });
    expect(result).toEqual({
      status: 'CURRENT',
      identity: {
        evidenceRef: `brain-method-package:${fixture.activePackage.packageId}@${fixture.activePackage.packageVersion}`,
        methodId: fixture.activePackage.methodId,
        methodVersionId: fixture.activePackage.methodVersionId,
        packageId: fixture.activePackage.packageId,
        packageVersion: String(fixture.activePackage.packageVersion),
        activationId: fixture.decision.decisionId,
        evaluationId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_EVALUATION_ID
      }
    });
  });

  it('fails closed for rejected, non-canonical and mismatched activation state', async () => {
    const fixture = approvedActivationFixture();
    const execution = executionWithActivePackageEvidence(
      await legacyExecution(),
      fixture.activePackage
    );
    const rejectedDecision = activationDecision(fixture.predecessor, 'REJECTED');
    const nonCanonicalDecision = {
      ...fixture.decision,
      decisionId: `brain-method-activation_${'a'.repeat(64)}`
    };
    const mismatchedActivePackage = {
      ...fixture.activePackage,
      selectionPriority: fixture.activePackage.selectionPriority + 1
    };
    const cases: UsptoOfficialFeeMethodActivationResolutionV1[] = [
      {
        ...resolvedActivation(fixture),
        decision: rejectedDecision
      },
      {
        ...resolvedActivation(fixture),
        decision: nonCanonicalDecision
      },
      {
        ...resolvedActivation(fixture),
        activePackage: mismatchedActivePackage
      },
      {
        ...resolvedActivation(fixture),
        activationEvidenceRef: 'brain-method-activation:tampered'
      }
    ];

    for (const resolution of cases) {
      const authority = new UsptoOfficialFeeMethodCurrentnessAuthorityV1({
        activation: { resolveCurrent: () => resolution }
      });
      await expect(authority.evaluate(policyInput(execution))).resolves.toMatchObject({
        status: 'NOT_CURRENT'
      });
    }
  });

  it('returns NOT_CURRENT when governed activation is not established', async () => {
    const fixture = approvedActivationFixture();
    const execution = executionWithActivePackageEvidence(
      await legacyExecution(),
      fixture.activePackage
    );
    const authority = new UsptoOfficialFeeMethodCurrentnessAuthorityV1({
      activation: {
        resolveCurrent: () => ({
          status: 'NOT_ESTABLISHED',
          reason: 'No production BRAIN_GOVERNANCE approval exists.'
        })
      }
    });

    await expect(authority.evaluate(policyInput(execution))).resolves.toEqual({
      status: 'NOT_CURRENT',
      reason: 'No production BRAIN_GOVERNANCE approval exists.'
    });
  });

  it('reports activation authority failure as UNAVAILABLE without manufacturing currentness', async () => {
    const fixture = approvedActivationFixture();
    const execution = executionWithActivePackageEvidence(
      await legacyExecution(),
      fixture.activePackage
    );
    const authority = new UsptoOfficialFeeMethodCurrentnessAuthorityV1({
      activation: {
        resolveCurrent: () => {
          throw new Error('activation registry unavailable');
        }
      }
    });

    await expect(authority.evaluate(policyInput(execution))).resolves.toMatchObject({
      status: 'UNAVAILABLE'
    });
  });

  it('fails closed before activation lookup for foreign Capability applicability', async () => {
    const fixture = approvedActivationFixture();
    const execution = executionWithActivePackageEvidence(
      await legacyExecution(),
      fixture.activePackage
    );
    const resolveCurrent = vi.fn(() => resolvedActivation(fixture));
    const authority = new UsptoOfficialFeeMethodCurrentnessAuthorityV1({
      activation: { resolveCurrent }
    });
    const foreignInput = {
      ...policyInput(execution),
      currentCapability: {
        ...USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION,
        capabilityId: 'resolver.foreign'
      }
    };

    await expect(authority.evaluate(foreignInput)).resolves.toMatchObject({
      status: 'UNSUPPORTED_APPLICABILITY'
    });
    expect(resolveCurrent).not.toHaveBeenCalled();
  });

  it('does not promote the live USPTO source policy beyond PILOT', async () => {
    const fixture = approvedActivationFixture();
    const execution = executionWithActivePackageEvidence(
      await legacyExecution(),
      fixture.activePackage
    );

    const policy = currentCapabilitySourceAdmissionPolicyCatalogV1.evaluate(policyInput(execution));

    expect(policy).toMatchObject({ applicability: 'UNSUPPORTED' });
    if (policy.applicability !== 'UNSUPPORTED') throw new Error('expected PILOT policy rejection');
    expect(policy.reason).toContain('PILOT');
  });
});
