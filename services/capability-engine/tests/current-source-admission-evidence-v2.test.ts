import { describe, expect, it, vi } from 'vitest';
import {
  CapabilitySourceOutputIdentityError,
  materializeCapabilitySourceOutputIdentityV1,
  resolveCapabilitySourceOutputIdentityV1
} from '../src/capability-source-output-identity.js';
import {
  capabilitySourceAdmissionNoAuthorityConsequences,
  type CapabilitySourceAdmissionDecision
} from '../src/current-source-admission.js';
import {
  CapabilitySourceAdmissionEvidenceV2Error,
  CurrentCapabilitySourceAdmissionEvidenceMaterializerV2,
  materializeCapabilitySourceAdmissionEvidenceV2
} from '../src/current-source-admission-evidence-v2.js';

const evaluatedAt = '2026-09-01T03:00:00.000Z';

const admissibleDecision: CapabilitySourceAdmissionDecision = {
  schemaVersion: 1,
  producer: 'CAPABILITY_ENGINE',
  decision: 'PRODUCTION_ADMISSIBLE',
  historical: {
    capabilityRequestId: 'capreq_output-evidence',
    implementationBindingId: 'implementation-binding_output-evidence',
    capabilityInvocationId: 'capability-invocation_output-evidence',
    capabilityOutcomeId: 'capability-outcome_output-evidence',
    capabilityReturnId: 'capability-return_output-evidence',
    sessionReceiptId: 'session-receipt_output-evidence',
    replayed: false
  },
  current: {
    capability: {
      runtimeCapabilityDefinitionId: 'runtime-capability_output-evidence',
      version: 2,
      capabilityId: 'analysis.output-evidence',
      capabilityVersion: '1.0.0'
    },
    implementation: {
      implementationProfileId: 'implementation-profile_output-evidence',
      version: 3,
      implementationKey: 'analysis.output-evidence.v1',
      status: 'APPROVED'
    }
  },
  authority: capabilitySourceAdmissionNoAuthorityConsequences
};

const deniedDecision: CapabilitySourceAdmissionDecision = {
  schemaVersion: 1,
  producer: 'CAPABILITY_ENGINE',
  decision: 'DENIED',
  historical: {
    capabilityRequestId: 'capreq_output-denied',
    implementationBindingId: 'implementation-binding_output-denied',
    capabilityInvocationId: 'capability-invocation_output-denied',
    capabilityOutcomeId: 'capability-outcome_output-denied',
    capabilityReturnId: 'capability-return_output-denied',
    sessionReceiptId: 'session-receipt_output-denied',
    replayed: false
  },
  denial: {
    code: 'UNSUPPORTED_APPLICABILITY',
    reason: 'The governed source remains PILOT and is not admitted for production.'
  },
  authority: capabilitySourceAdmissionNoAuthorityConsequences
};

function successfulExecution(output: unknown, outputSchemaId = 'analysis-output.v1') {
  return {
    outcome: {
      status: 'SUCCEEDED',
      outputSchemaId,
      output
    },
    returnValue: {
      status: 'COMPLETED',
      outputSchemaId,
      output: structuredClone(output)
    }
  };
}

function expectOutputError(run: () => unknown, code: CapabilitySourceOutputIdentityError['code']) {
  try {
    run();
    throw new Error(`expected source output identity error ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(CapabilitySourceOutputIdentityError);
    if (!(error instanceof CapabilitySourceOutputIdentityError)) throw error;
    expect(error.code).toBe(code);
  }
}

function expectEvidenceV2Error(
  run: () => unknown,
  code: CapabilitySourceAdmissionEvidenceV2Error['code']
) {
  try {
    run();
    throw new Error(`expected source admission evidence V2 error ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(CapabilitySourceAdmissionEvidenceV2Error);
    if (!(error instanceof CapabilitySourceAdmissionEvidenceV2Error)) throw error;
    expect(error.code).toBe(code);
  }
}

describe('Capability exact source output identity V1', () => {
  it('is deterministic across object key insertion order', () => {
    const left = materializeCapabilitySourceOutputIdentityV1('analysis-output.v1', {
      alpha: 1,
      nested: { beta: 2, gamma: [3, 4] }
    });
    const right = materializeCapabilitySourceOutputIdentityV1('analysis-output.v1', {
      nested: { gamma: [3, 4], beta: 2 },
      alpha: 1
    });

    expect(right).toEqual(left);
    expect(left.outputFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes fingerprint when exact output or output schema changes', () => {
    const baseline = materializeCapabilitySourceOutputIdentityV1('analysis-output.v1', {
      value: 1
    });
    const changedOutput = materializeCapabilitySourceOutputIdentityV1('analysis-output.v1', {
      value: 2
    });
    const changedSchema = materializeCapabilitySourceOutputIdentityV1('analysis-output.v2', {
      value: 1
    });

    expect(changedOutput.outputFingerprintSha256).not.toBe(baseline.outputFingerprintSha256);
    expect(changedSchema.outputFingerprintSha256).not.toBe(baseline.outputFingerprintSha256);
  });

  it('fails closed on non-canonical JSON output instead of silently omitting values', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const sparse: unknown[] = [];
    sparse.length = 2;
    sparse[1] = 'present';

    for (const output of [
      { value: BigInt(1) },
      { value: Number.NaN },
      { value: Number.POSITIVE_INFINITY },
      { value: undefined },
      cyclic,
      sparse,
      new Date('2026-09-01T00:00:00.000Z')
    ]) {
      expectOutputError(
        () => materializeCapabilitySourceOutputIdentityV1('analysis-output.v1', output),
        'INVALID_OUTPUT_SHAPE'
      );
    }
  });

  it('resolves identity only from one exact successful outcome/return pair', () => {
    const execution = successfulExecution({ beta: 2, alpha: 1 });
    expect(resolveCapabilitySourceOutputIdentityV1(execution)).toEqual(
      materializeCapabilitySourceOutputIdentityV1('analysis-output.v1', {
        alpha: 1,
        beta: 2
      })
    );

    expect(
      resolveCapabilitySourceOutputIdentityV1({
        outcome: { status: 'FAILED' },
        returnValue: { status: 'FAILED' }
      })
    ).toBeUndefined();
  });

  it('fails closed when a successful outcome and return disagree', () => {
    expectOutputError(
      () =>
        resolveCapabilitySourceOutputIdentityV1({
          outcome: {
            status: 'SUCCEEDED',
            outputSchemaId: 'analysis-output.v1',
            output: { value: 1 }
          },
          returnValue: {
            status: 'COMPLETED',
            outputSchemaId: 'analysis-output.v1',
            output: { value: 2 }
          }
        }),
      'INCONSISTENT_RUNTIME_OUTPUT'
    );
  });
});

describe('Capability source admission producer evidence V2', () => {
  it('pins exact source output into stable production evidence', () => {
    const sourceOutput = materializeCapabilitySourceOutputIdentityV1('analysis-output.v1', {
      alpha: 1,
      beta: 2
    });
    const evidence = materializeCapabilitySourceAdmissionEvidenceV2(
      admissibleDecision,
      evaluatedAt,
      sourceOutput
    );

    expect(evidence).toMatchObject({
      schemaVersion: 2,
      producer: 'CAPABILITY_ENGINE',
      evidenceVersion: 2,
      evaluatedAt,
      sourceOutput,
      decision: admissibleDecision,
      authority: capabilitySourceAdmissionNoAuthorityConsequences
    });
    expect(evidence.evidenceId).toBe(
      `capability-source-admission-evidence_${evidence.evidenceFingerprintSha256}`
    );
    expect(evidence.decisionFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(evidence.evidenceFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('requires exact output identity for production-admissible V2 evidence', () => {
    expectEvidenceV2Error(
      () => materializeCapabilitySourceAdmissionEvidenceV2(admissibleDecision, evaluatedAt),
      'INVALID_SOURCE_OUTPUT'
    );
  });

  it('allows denied evidence without output and pins output when a successful source was rejected', () => {
    const withoutOutput = materializeCapabilitySourceAdmissionEvidenceV2(
      deniedDecision,
      evaluatedAt
    );
    const sourceOutput = materializeCapabilitySourceOutputIdentityV1('analysis-output.v1', {
      value: 'pilot-result'
    });
    const withOutput = materializeCapabilitySourceAdmissionEvidenceV2(
      deniedDecision,
      evaluatedAt,
      sourceOutput
    );

    expect(withoutOutput.decision.decision).toBe('DENIED');
    expect(withoutOutput.sourceOutput).toBeUndefined();
    expect(withOutput.sourceOutput).toEqual(sourceOutput);
    expect(withOutput.evidenceId).not.toBe(withoutOutput.evidenceId);
  });

  it('changes V2 evidence identity when exact output changes while decision and time stay fixed', () => {
    const first = materializeCapabilitySourceAdmissionEvidenceV2(
      admissibleDecision,
      evaluatedAt,
      materializeCapabilitySourceOutputIdentityV1('analysis-output.v1', { value: 1 })
    );
    const second = materializeCapabilitySourceAdmissionEvidenceV2(
      admissibleDecision,
      evaluatedAt,
      materializeCapabilitySourceOutputIdentityV1('analysis-output.v1', { value: 2 })
    );

    expect(second.decisionFingerprintSha256).toBe(first.decisionFingerprintSha256);
    expect(second.evidenceFingerprintSha256).not.toBe(first.evidenceFingerprintSha256);
    expect(second.evidenceId).not.toBe(first.evidenceId);
  });

  it('delegates admission once and derives output identity from the same runtime execution', async () => {
    const evaluate = vi.fn(() => Promise.resolve(admissibleDecision));
    const materializer = new CurrentCapabilitySourceAdmissionEvidenceMaterializerV2({
      evaluator: { evaluate },
      now: () => evaluatedAt
    });
    const runtimeExecution = successfulExecution({ beta: 2, alpha: 1 });

    const evidence = await materializer.evaluateAndMaterialize(runtimeExecution);

    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(evaluate).toHaveBeenCalledWith(runtimeExecution);
    expect(evidence.sourceOutput).toEqual(
      materializeCapabilitySourceOutputIdentityV1('analysis-output.v1', {
        alpha: 1,
        beta: 2
      })
    );
  });

  it('pins a successful output even when admission denies the source as pilot or unsupported', async () => {
    const materializer = new CurrentCapabilitySourceAdmissionEvidenceMaterializerV2({
      evaluator: { evaluate: () => Promise.resolve(deniedDecision) },
      now: () => evaluatedAt
    });

    const evidence = await materializer.evaluateAndMaterialize(
      successfulExecution({ value: 'rejected-pilot-output' })
    );

    expect(evidence.decision.decision).toBe('DENIED');
    expect(evidence.sourceOutput).toEqual(
      materializeCapabilitySourceOutputIdentityV1('analysis-output.v1', {
        value: 'rejected-pilot-output'
      })
    );
  });

  it('fails closed when a successful runtime output cannot be safely canonicalized', async () => {
    const materializer = new CurrentCapabilitySourceAdmissionEvidenceMaterializerV2({
      evaluator: { evaluate: () => Promise.resolve(admissibleDecision) },
      now: () => evaluatedAt
    });
    const runtimeExecution = {
      outcome: {
        status: 'SUCCEEDED',
        outputSchemaId: 'analysis-output.v1',
        output: { value: BigInt(1) }
      },
      returnValue: {
        status: 'COMPLETED',
        outputSchemaId: 'analysis-output.v1',
        output: { value: BigInt(1) }
      }
    };

    await expect(materializer.evaluateAndMaterialize(runtimeExecution)).rejects.toMatchObject({
      code: 'INVALID_SOURCE_OUTPUT'
    });
  });
});
