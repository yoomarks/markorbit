import { describe, expect, it, vi } from 'vitest';

import {
  USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE,
  compileUsptoOfficialFeeMethodPackageV1
} from '@markorbit/contracts/brain-official-fee-method';
import type { CapabilityRequestV2Command } from '@markorbit/contracts/capability-runtime';

import { GovernedCapabilityRuntime } from '../src/capability-runtime.js';
import {
  CurrentCapabilitySourceAdmissionEvaluator,
  type CapabilitySourceAdmissionPolicyInput
} from '../src/current-source-admission.js';
import { UsptoOfficialFeeReferenceCurrentnessAuthorityV1 } from '../src/uspto-official-fee-reference-currentness.js';
import {
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID,
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
  validateUsptoOfficialFeeResolverOutputV1,
  type OfficialFeeReferenceReaderV1
} from '../src/uspto-official-fee-resolver-pilot.js';

const EFFECTIVE_FROM = '2025-01-18T00:00:00.000-05:00';
const MATERIALIZED_AT = '2026-08-28T00:00:00.000Z';
const HISTORICAL_AS_OF = '2026-08-28T00:00:00.000Z';
const CURRENT_CHECK_AT = '2026-09-01T04:50:00.000Z';

function acceptedPackage() {
  const compiled = compileUsptoOfficialFeeMethodPackageV1({
    knowledgeSources: structuredClone(USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE),
    temporalResolution: {
      status: 'RESOLVED',
      effectiveFrom: EFFECTIVE_FROM,
      evidenceRef: 'USPTO_TRADEMARK_FEE_FINAL_RULE_EFFECTIVE_2025_01_18'
    },
    conflictResolution: {
      status: 'NONE',
      evidenceRef: 'USPTO_DUAL_SOURCE_AUTHORITY_RECONCILIATION_2026_08_28'
    }
  });
  if (compiled.status !== 'READY') throw new Error(`unexpected package status ${compiled.status}`);
  return compiled.package;
}

function acceptedReference(overrides: Record<string, unknown> = {}) {
  const pkg = acceptedPackage();
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
    materializedAt: MATERIALIZED_AT,
    ...overrides
  };
}

function resolverInput(overrides: Record<string, unknown> = {}) {
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
    acceptedReferenceId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID,
    ...overrides
  };
}

function command(overrides: Partial<CapabilityRequestV2Command> = {}): CapabilityRequestV2Command {
  return {
    schemaVersion: 2,
    capabilityId: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID,
    capabilityVersion: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION,
    caller: {
      workspaceId: 'workspace_reference_currentness',
      principalId: 'principal_reference_currentness',
      callerProduct: 'MARKREG',
      permissionContextRef: 'permission_reference_currentness'
    },
    purpose: 'Resolve the accepted USPTO fee reference for source-currentness testing.',
    input: resolverInput(),
    inputSchemaId: USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA,
    outputSchemaId: USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA,
    riskClass: 'LOW',
    idempotencyKey: 'reference-currentness-runtime',
    correlationId: 'correlation_reference_currentness',
    ...overrides
  };
}

async function historicalExecution() {
  const pkg = acceptedPackage();
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
    executor: createUsptoOfficialFeeResolverCapabilityExecutorV1(pkg, {
      resolveCurrent: () => acceptedReference()
    }),
    now: () => '2026-08-29T04:20:00.000Z'
  });
  const execution = await runtime.invoke(command());
  expect(execution.outcome.status).toBe('SUCCEEDED');
  return execution;
}

function policyInput(execution: Awaited<ReturnType<typeof historicalExecution>>) {
  return {
    execution,
    currentCapability: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION,
    currentImplementation: USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE
  } satisfies CapabilitySourceAdmissionPolicyInput;
}

describe('USPTO official-fee reference currentness authority V1', () => {
  it('proves the exact historical reference is still CURRENT using evaluation time, not historical asOf', async () => {
    const execution = await historicalExecution();
    const resolveCurrent = vi.fn(() => acceptedReference());
    const authority = new UsptoOfficialFeeReferenceCurrentnessAuthorityV1({
      references: { resolveCurrent },
      now: () => CURRENT_CHECK_AT
    });

    const result = authority.evaluate(policyInput(execution));

    expect(resolveCurrent).toHaveBeenCalledOnce();
    expect(resolveCurrent).toHaveBeenCalledWith({
      operation: USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
      jurisdiction: 'US',
      authority: 'USPTO',
      asOf: CURRENT_CHECK_AT
    });
    expect(result).toEqual({
      status: 'CURRENT',
      references: [
        {
          evidenceRef: `official-fee-reference:${USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID}`,
          sourceId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID,
          sourceVersion: MATERIALIZED_AT,
          sourceFingerprintSha256: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256
        }
      ]
    });
  });

  it('marks the historical source NOT_CURRENT when the controlled store has a different CURRENT reference', async () => {
    const execution = await historicalExecution();
    const authority = new UsptoOfficialFeeReferenceCurrentnessAuthorityV1({
      references: {
        resolveCurrent: () => ({
          referenceId: `official-fee-ref_${'b'.repeat(64)}`,
          operation: USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
          jurisdiction: 'US',
          authority: 'USPTO',
          status: 'CURRENT'
        })
      },
      now: () => CURRENT_CHECK_AT
    });

    expect(authority.evaluate(policyInput(execution))).toMatchObject({
      status: 'NOT_CURRENT'
    });
  });

  it('fails closed before store access for a foreign Capability or Resolver operation', async () => {
    const execution = await historicalExecution();
    const resolveCurrent = vi.fn(() => acceptedReference());
    const authority = new UsptoOfficialFeeReferenceCurrentnessAuthorityV1({
      references: { resolveCurrent },
      now: () => CURRENT_CHECK_AT
    });
    const foreignCapability = {
      ...policyInput(execution),
      currentCapability: {
        ...USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION,
        capabilityId: 'resolver.foreign'
      }
    };
    const foreignOperationExecution = structuredClone(execution);
    foreignOperationExecution.request.input = resolverInput({ operation: 'USPTO_OTHER_OPERATION' });

    expect(authority.evaluate(foreignCapability)).toMatchObject({
      status: 'UNSUPPORTED_APPLICABILITY'
    });
    expect(
      authority.evaluate({
        ...policyInput(execution),
        execution: foreignOperationExecution
      })
    ).toMatchObject({ status: 'UNSUPPORTED_APPLICABILITY' });
    expect(resolveCurrent).not.toHaveBeenCalled();
  });

  it('denies historical currentness when exact reference evidence is missing', async () => {
    const execution = structuredClone(await historicalExecution());
    execution.receipt.evidenceRefs = execution.receipt.evidenceRefs.filter(
      (value) => !value.startsWith('official-fee-materialization-sha256:')
    );
    const resolveCurrent = vi.fn(() => acceptedReference());
    const authority = new UsptoOfficialFeeReferenceCurrentnessAuthorityV1({
      references: { resolveCurrent },
      now: () => CURRENT_CHECK_AT
    });

    expect(authority.evaluate(policyInput(execution))).toMatchObject({ status: 'NOT_CURRENT' });
    expect(resolveCurrent).not.toHaveBeenCalled();
  });

  it('reports dependency unavailability without fabricating currentness', async () => {
    const execution = await historicalExecution();
    const authority = new UsptoOfficialFeeReferenceCurrentnessAuthorityV1({
      references: {
        resolveCurrent: () => {
          throw new Error('reference store unavailable');
        }
      },
      now: () => CURRENT_CHECK_AT
    });

    expect(authority.evaluate(policyInput(execution))).toMatchObject({ status: 'UNAVAILABLE' });
  });

  it('treats a tampered same-id current record as unavailable rather than current', async () => {
    const execution = await historicalExecution();
    const authority = new UsptoOfficialFeeReferenceCurrentnessAuthorityV1({
      references: {
        resolveCurrent: () => acceptedReference({ amountMinor: 99999 })
      },
      now: () => CURRENT_CHECK_AT
    });

    expect(authority.evaluate(policyInput(execution))).toMatchObject({ status: 'UNAVAILABLE' });
  });

  it('integrates with #397 without changing the current PILOT maturity catalog', async () => {
    const execution = await historicalExecution();
    const referenceCurrentness = new UsptoOfficialFeeReferenceCurrentnessAuthorityV1({
      references: { resolveCurrent: () => acceptedReference() },
      now: () => CURRENT_CHECK_AT
    });
    const evaluator = new CurrentCapabilitySourceAdmissionEvaluator({
      capabilities: {
        findCurrent: () => Promise.resolve(USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION)
      },
      implementations: {
        findCurrent: () => USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE
      },
      policy: {
        evaluate: () => ({
          applicability: 'SUPPORTED',
          methodCurrentness: 'NOT_REQUIRED',
          referenceCurrentness: 'REQUIRED'
        })
      },
      referenceCurrentness
    });

    const decision = await evaluator.evaluate(execution);

    expect(decision).toMatchObject({
      decision: 'PRODUCTION_ADMISSIBLE',
      referenceSources: [
        {
          evidenceRef: `official-fee-reference:${USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID}`,
          sourceId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID,
          sourceVersion: MATERIALIZED_AT,
          sourceFingerprintSha256: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256
        }
      ]
    });
  });
});
