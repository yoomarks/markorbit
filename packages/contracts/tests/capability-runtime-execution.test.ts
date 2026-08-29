import { describe, expect, it } from 'vitest';
import {
  CN_DURATION_BAND_ACCEPTED_DATASET_REF,
  CN_DURATION_BAND_EXECUTABLE_KIND
} from '../src/brain-cn-duration-band-classification.js';
import { capabilityRuntimeNoAuthorityConsequences } from '../src/capability-runtime.js';
import {
  CapabilityRuntimeExecutionContractError,
  parseCnDurationBandClassificationOutputV1,
  parseGovernedCapabilityRuntimeExecutionV2
} from '../src/capability-runtime-execution.js';

function fixture() {
  const evidenceRefs = [
    'brain-method-package:package_one@1',
    'brain-method:method_one',
    'brain-method-version:method-version_one',
    'brain-method-evaluation:evaluation_one'
  ];
  return {
    request: {
      schemaVersion: 2,
      capabilityId: 'capability.one',
      capabilityVersion: '1.0.0',
      caller: {
        workspaceId: '00000000-0000-4000-8000-000000000001',
        principalId: 'user_one',
        callerProduct: 'MARKREG',
        permissionContextRef: 'core-workspace-membership:membership_one'
      },
      purpose: 'Test governed response parser.',
      input: { value: 1 },
      inputSchemaId: 'input.one',
      outputSchemaId: 'output.one',
      riskClass: 'LOW',
      idempotencyKey: 'key_one',
      correlationId: 'correlation_one',
      capabilityRequestId: 'capreq_one',
      receivedAt: '2026-08-30T01:00:00.000Z'
    },
    eligibility: {
      schemaVersion: 1,
      capabilityRequestId: 'capreq_one',
      decision: 'ELIGIBLE',
      eligible: true,
      policyVersion: 'policy_one',
      reason: 'Exact accepted runtime binding.',
      decidedAt: '2026-08-30T01:00:00.010Z'
    },
    composition: {
      schemaVersion: 1,
      capabilityRequestId: 'capreq_one',
      mode: 'SINGLE_IMPLEMENTATION',
      primaryImplementationProfileId: 'implementation-profile_one',
      supportingImplementationProfileIds: [],
      criticImplementationProfileIds: [],
      composedAt: '2026-08-30T01:00:00.020Z'
    },
    binding: {
      schemaVersion: 1,
      implementationBindingId: 'implementation-binding_one',
      capabilityRequestId: 'capreq_one',
      runtimeCapability: {
        id: 'runtime-capability-definition_one',
        version: 1,
        capabilityId: 'capability.one',
        capabilityVersion: '1.0.0'
      },
      implementation: {
        id: 'implementation-profile_one',
        version: 2,
        implementationKey: 'implementation.one',
        kind: 'DETERMINISTIC_SERVICE'
      },
      selectionPolicyVersion: 'policy_one',
      boundAt: '2026-08-30T01:00:00.030Z'
    },
    invocation: {
      schemaVersion: 1,
      capabilityInvocationId: 'capability-invocation_one',
      capabilityRequestId: 'capreq_one',
      implementationBindingId: 'implementation-binding_one',
      attempt: 1,
      timeoutMs: 5000,
      status: 'COMPLETED',
      startedAt: '2026-08-30T01:00:00.040Z',
      completedAt: '2026-08-30T01:00:00.050Z'
    },
    outcome: {
      schemaVersion: 1,
      capabilityOutcomeId: 'capability-outcome_one',
      capabilityRequestId: 'capreq_one',
      capabilityInvocationId: 'capability-invocation_one',
      status: 'SUCCEEDED',
      outputSchemaId: 'output.one',
      output: { result: 'ok' },
      evidenceRefs,
      completedAt: '2026-08-30T01:00:00.050Z',
      authority: capabilityRuntimeNoAuthorityConsequences
    },
    returnValue: {
      schemaVersion: 1,
      capabilityReturnId: 'capability-return_one',
      capabilityRequestId: 'capreq_one',
      capabilityOutcomeId: 'capability-outcome_one',
      status: 'COMPLETED',
      outputSchemaId: 'output.one',
      output: { result: 'ok' },
      evidenceRefs,
      returnedAt: '2026-08-30T01:00:00.060Z',
      authority: capabilityRuntimeNoAuthorityConsequences
    },
    receipt: {
      schemaVersion: 1,
      sessionReceiptId: 'session-receipt_one',
      capabilityRequestId: 'capreq_one',
      correlationId: 'correlation_one',
      workspaceId: '00000000-0000-4000-8000-000000000001',
      principalId: 'user_one',
      callerProduct: 'MARKREG',
      runtimeCapability: {
        id: 'runtime-capability-definition_one',
        version: 1,
        capabilityId: 'capability.one',
        capabilityVersion: '1.0.0'
      },
      implementation: {
        id: 'implementation-profile_one',
        version: 2,
        implementationKey: 'implementation.one'
      },
      capabilityInvocationId: 'capability-invocation_one',
      capabilityOutcomeId: 'capability-outcome_one',
      capabilityReturnId: 'capability-return_one',
      evidenceRefs,
      createdAt: '2026-08-30T01:00:00.060Z',
      authority: capabilityRuntimeNoAuthorityConsequences
    },
    replayed: false
  };
}

function durationBandOutput() {
  return {
    schemaVersion: 1,
    kind: CN_DURATION_BAND_EXECUTABLE_KIND,
    jurisdiction: 'CN',
    procedure: 'FILING_TO_PRELIMINARY_PUBLICATION',
    observedCompletedDurationDays: 336,
    historicalBand: 'LOWER_INTERQUARTILE',
    datasetRefId: CN_DURATION_BAND_ACCEPTED_DATASET_REF,
    thresholds: { p25Days: 335, medianDays: 336, p75Days: 383 },
    semantics: 'COMPLETED_INTERVAL_RELATIVE_TO_ACCEPTED_HISTORICAL_DISTRIBUTION',
    descriptiveInterpretationOnly: true,
    legalConclusion: false,
    predictiveClaim: false,
    riskClaim: false,
    probabilityClaim: false,
    recommendation: false,
    currentCaseStatusInferred: false,
    productBusinessStateMutated: false
  };
}

describe('Governed Capability Runtime execution response contract', () => {
  it('parses one exact linked successful execution', () => {
    const parsed = parseGovernedCapabilityRuntimeExecutionV2(fixture());
    expect(parsed.receipt.capabilityReturnId).toBe(parsed.returnValue.capabilityReturnId);
    expect(parsed.binding.implementation.id).toBe(parsed.receipt.implementation.id);
    expect(parsed.receipt.evidenceRefs).toEqual(parsed.returnValue.evidenceRefs);
  });

  it('fails closed on linkage drift', () => {
    const value = fixture();
    value.receipt.capabilityReturnId = 'capability-return_other';
    expect(() => parseGovernedCapabilityRuntimeExecutionV2(value)).toThrow(
      CapabilityRuntimeExecutionContractError
    );
  });

  it('fails closed if the execution claims an authority consequence', () => {
    const base = fixture();
    const value = {
      ...base,
      outcome: {
        ...base.outcome,
        authority: {
          ...capabilityRuntimeNoAuthorityConsequences,
          filingSubmitted: true
        }
      }
    };
    expect(() => parseGovernedCapabilityRuntimeExecutionV2(value)).toThrow(
      CapabilityRuntimeExecutionContractError
    );
  });
});

describe('CN completed-duration historical-band output contract', () => {
  it('parses the exact descriptive Phase 4 output shape', () => {
    expect(parseCnDurationBandClassificationOutputV1(durationBandOutput())).toEqual(
      durationBandOutput()
    );
  });

  it('fails closed if a recommendation or other product authority appears', () => {
    const value = { ...durationBandOutput(), recommendation: true };
    expect(() => parseCnDurationBandClassificationOutputV1(value)).toThrow(
      CapabilityRuntimeExecutionContractError
    );
  });

  it('fails closed on dataset or threshold drift', () => {
    expect(() =>
      parseCnDurationBandClassificationOutputV1({
        ...durationBandOutput(),
        datasetRefId: 'research-dataset_drift'
      })
    ).toThrow(CapabilityRuntimeExecutionContractError);
    expect(() =>
      parseCnDurationBandClassificationOutputV1({
        ...durationBandOutput(),
        thresholds: { p25Days: 334, medianDays: 336, p75Days: 383 }
      })
    ).toThrow(CapabilityRuntimeExecutionContractError);
  });
});
