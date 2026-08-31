import { describe, expect, it, vi } from 'vitest';
import { capabilityRuntimeNoAuthorityConsequences } from '@markorbit/contracts/capability-runtime';
import {
  CAPABILITY_AUDIT_TELEMETRY_STDOUT_ENABLED_ENV,
  InMemoryCapabilityRuntimeQualityTelemetrySinkV1,
  ObservedGovernedCapabilityRuntimeV1,
  capabilityRuntimeQualityNoAuthority,
  createCapabilityAuditTelemetrySinkFromEnvironmentV1,
  createGovernedCapabilityRuntimeQualityTelemetryV1,
  type CapabilityRuntimeQualityTelemetrySinkV1
} from '../src/capability-runtime-quality-telemetry.js';
import {
  GovernedCapabilityRuntimeError,
  type CapabilityRuntimeExecution
} from '../src/capability-runtime.js';

const sensitiveInput = 'SECRET CUSTOMER INPUT';
const sensitiveOutput = 'SECRET CAPABILITY OUTPUT';
const sensitiveEvidenceRef = 'evidence_SECRET_PRIVATE';

function executionFixture(
  options: {
    status?: 'SUCCEEDED' | 'FAILED' | 'REQUIRES_REVIEW';
    errorCode?: 'IMPLEMENTATION_FAILED' | 'OUTPUT_CONTRACT_INVALID';
    invocationStatus?: 'COMPLETED' | 'FAILED';
    replayed?: boolean;
    startedAt?: string;
    completedAt?: string;
  } = {}
): CapabilityRuntimeExecution {
  const status = options.status ?? 'SUCCEEDED';
  const errorCode = options.errorCode;
  const invocationStatus =
    options.invocationStatus ?? (errorCode === 'IMPLEMENTATION_FAILED' ? 'FAILED' : 'COMPLETED');
  const replayed = options.replayed ?? false;
  const startedAt = options.startedAt ?? '2026-09-01T00:00:00.000Z';
  const completedAt = options.completedAt ?? '2026-09-01T00:00:00.250Z';
  const returnStatus =
    status === 'SUCCEEDED'
      ? 'COMPLETED'
      : status === 'REQUIRES_REVIEW'
        ? 'REVIEW_REQUIRED'
        : 'FAILED';

  return {
    request: {
      schemaVersion: 2,
      capabilityRequestId: 'capreq_quality',
      capabilityId: 'capability-quality-test',
      capabilityVersion: '1.0.0',
      caller: {
        workspaceId: 'workspace_quality',
        principalId: 'principal_quality',
        callerProduct: 'MARKREG',
        permissionContextRef: 'permission_quality'
      },
      purpose: 'DO NOT RETAIN PURPOSE DETAIL',
      input: { private: sensitiveInput },
      inputSchemaId: 'quality-input.v1',
      outputSchemaId: 'quality-output.v1',
      riskClass: 'LOW',
      idempotencyKey: 'idempotency_SECRET',
      correlationId: 'correlation_quality',
      receivedAt: '2026-09-01T00:00:00.000Z'
    },
    eligibility: {
      schemaVersion: 1,
      capabilityRequestId: 'capreq_quality',
      decision: 'ELIGIBLE',
      eligible: true,
      policyVersion: 'selection.v1',
      reason: 'Accepted exact test binding.',
      decidedAt: '2026-09-01T00:00:00.010Z'
    },
    composition: {
      schemaVersion: 1,
      capabilityRequestId: 'capreq_quality',
      mode: 'SINGLE_IMPLEMENTATION',
      primaryImplementationProfileId: 'implementation-profile_quality',
      supportingImplementationProfileIds: [],
      criticImplementationProfileIds: [],
      composedAt: '2026-09-01T00:00:00.020Z'
    },
    binding: {
      schemaVersion: 1,
      implementationBindingId: 'implementation-binding_quality',
      capabilityRequestId: 'capreq_quality',
      runtimeCapability: {
        id: 'runtime-capability_quality',
        version: 3,
        capabilityId: 'capability-quality-test',
        capabilityVersion: '1.0.0'
      },
      implementation: {
        id: 'implementation-profile_quality',
        version: 2,
        implementationKey: 'quality:test',
        kind: 'DETERMINISTIC_SERVICE'
      },
      selectionPolicyVersion: 'selection.v1',
      boundAt: '2026-09-01T00:00:00.020Z'
    },
    invocation: {
      schemaVersion: 1,
      capabilityInvocationId: 'capability-invocation_quality',
      capabilityRequestId: 'capreq_quality',
      implementationBindingId: 'implementation-binding_quality',
      attempt: 1,
      timeoutMs: 1000,
      status: invocationStatus,
      startedAt,
      completedAt
    },
    outcome: {
      schemaVersion: 1,
      capabilityOutcomeId: 'capability-outcome_quality',
      capabilityRequestId: 'capreq_quality',
      capabilityInvocationId: 'capability-invocation_quality',
      status,
      outputSchemaId: 'quality-output.v1',
      ...(status === 'SUCCEEDED' || status === 'REQUIRES_REVIEW'
        ? { output: { private: sensitiveOutput } }
        : {}),
      ...(errorCode === undefined
        ? {}
        : {
            error: {
              code: errorCode,
              message: 'SENSITIVE INTERNAL IMPLEMENTATION ERROR',
              retryable: false
            }
          }),
      evidenceRefs: [sensitiveEvidenceRef],
      usage: {
        latencyMs: 200,
        inputUnits: 4,
        outputUnits: 2,
        costMinor: 1,
        currency: 'USD'
      },
      completedAt,
      authority: capabilityRuntimeNoAuthorityConsequences
    },
    returnValue: {
      schemaVersion: 1,
      capabilityReturnId: 'capability-return_quality',
      capabilityRequestId: 'capreq_quality',
      capabilityOutcomeId: 'capability-outcome_quality',
      status: returnStatus,
      outputSchemaId: 'quality-output.v1',
      ...(status === 'SUCCEEDED' || status === 'REQUIRES_REVIEW'
        ? { output: { private: sensitiveOutput } }
        : {}),
      ...(errorCode === undefined
        ? {}
        : {
            error: {
              code: errorCode,
              message: 'SENSITIVE INTERNAL IMPLEMENTATION ERROR',
              retryable: false
            }
          }),
      evidenceRefs: [sensitiveEvidenceRef],
      returnedAt: '2026-09-01T00:00:00.260Z',
      authority: capabilityRuntimeNoAuthorityConsequences
    },
    receipt: {
      schemaVersion: 1,
      sessionReceiptId: 'session-receipt_quality',
      capabilityRequestId: 'capreq_quality',
      correlationId: 'correlation_quality',
      workspaceId: 'workspace_quality',
      principalId: 'principal_quality',
      callerProduct: 'MARKREG',
      runtimeCapability: {
        id: 'runtime-capability_quality',
        version: 3,
        capabilityId: 'capability-quality-test',
        capabilityVersion: '1.0.0'
      },
      implementation: {
        id: 'implementation-profile_quality',
        version: 2,
        implementationKey: 'quality:test'
      },
      capabilityInvocationId: 'capability-invocation_quality',
      capabilityOutcomeId: 'capability-outcome_quality',
      capabilityReturnId: 'capability-return_quality',
      evidenceRefs: [sensitiveEvidenceRef],
      createdAt: '2026-09-01T00:00:00.270Z',
      authority: capabilityRuntimeNoAuthorityConsequences
    },
    replayed
  };
}

describe('Governed Capability runtime quality telemetry V1', () => {
  it('records exact governed identities and separates measured duration from reported latency', () => {
    const event = createGovernedCapabilityRuntimeQualityTelemetryV1(
      executionFixture(),
      '2026-09-01T00:00:01.000Z'
    );

    expect(event).toMatchObject({
      eventType: 'GOVERNED_CAPABILITY_RUNTIME_QUALITY',
      request: {
        capabilityRequestId: 'capreq_quality',
        correlationId: 'correlation_quality',
        workspaceId: 'workspace_quality',
        callerProduct: 'MARKREG'
      },
      runtimeCapability: {
        id: 'runtime-capability_quality',
        version: 3,
        capabilityId: 'capability-quality-test',
        capabilityVersion: '1.0.0'
      },
      implementation: {
        id: 'implementation-profile_quality',
        version: 2,
        implementationKey: 'quality:test',
        kind: 'DETERMINISTIC_SERVICE'
      },
      invocation: {
        capabilityInvocationId: 'capability-invocation_quality',
        attempt: 1,
        status: 'COMPLETED',
        measuredDurationMs: 250
      },
      outcome: {
        capabilityOutcomeId: 'capability-outcome_quality',
        status: 'SUCCEEDED'
      },
      result: {
        capabilityReturnId: 'capability-return_quality',
        status: 'COMPLETED',
        sessionReceiptId: 'session-receipt_quality'
      },
      execution: {
        attribution: 'CURRENT_CALL_EXECUTION',
        replayed: false,
        implementationExecutedThisCall: true,
        runtimeFallbackAttempted: false
      },
      usage: {
        attribution: 'CURRENT_EXECUTION',
        reportedLatencyMs: 200,
        inputUnits: 4,
        outputUnits: 2,
        costMinor: 1,
        currency: 'USD'
      },
      sensitiveContentRetained: false,
      errorMessageRetained: false,
      authority: capabilityRuntimeQualityNoAuthority
    });

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain(sensitiveInput);
    expect(serialized).not.toContain(sensitiveOutput);
    expect(serialized).not.toContain(sensitiveEvidenceRef);
    expect(serialized).not.toContain('idempotency_SECRET');
    expect(serialized).not.toContain('DO NOT RETAIN PURPOSE DETAIL');
    expect(serialized).not.toContain('SENSITIVE INTERNAL IMPLEMENTATION ERROR');
  });

  it('marks historical replay without claiming a new implementation execution or new cost', () => {
    const event = createGovernedCapabilityRuntimeQualityTelemetryV1(
      executionFixture({ replayed: true }),
      '2026-09-01T00:00:02.000Z'
    );

    expect(event.execution).toEqual({
      attribution: 'HISTORICAL_REPLAY',
      replayed: true,
      implementationExecutedThisCall: false,
      runtimeFallbackAttempted: false
    });
    expect(event.usage).toMatchObject({
      attribution: 'HISTORICAL_EXECUTION',
      costMinor: 1,
      reportedLatencyMs: 200
    });
    expect(JSON.stringify(event)).not.toContain('fallbackCount');
  });

  it.each([
    {
      name: 'review-required result',
      options: { status: 'REQUIRES_REVIEW' as const },
      expected: { status: 'REQUIRES_REVIEW', returnStatus: 'REVIEW_REQUIRED' }
    },
    {
      name: 'implementation failure',
      options: {
        status: 'FAILED' as const,
        errorCode: 'IMPLEMENTATION_FAILED' as const,
        invocationStatus: 'FAILED' as const
      },
      expected: {
        status: 'FAILED',
        returnStatus: 'FAILED',
        errorCode: 'IMPLEMENTATION_FAILED'
      }
    },
    {
      name: 'output-contract failure',
      options: {
        status: 'FAILED' as const,
        errorCode: 'OUTPUT_CONTRACT_INVALID' as const,
        invocationStatus: 'COMPLETED' as const
      },
      expected: {
        status: 'FAILED',
        returnStatus: 'FAILED',
        errorCode: 'OUTPUT_CONTRACT_INVALID'
      }
    }
  ])('normalizes $name without correctness or gap semantics', ({ options, expected }) => {
    const event = createGovernedCapabilityRuntimeQualityTelemetryV1(
      executionFixture(options),
      '2026-09-01T00:00:03.000Z'
    );

    expect(event.outcome.status).toBe(expected.status);
    expect(event.result.status).toBe(expected.returnStatus);
    if ('errorCode' in expected) expect(event.outcome.errorCode).toBe(expected.errorCode);
    expect(event.authority).toEqual({
      methodCorrectnessEvaluated: false,
      methodImprovementTriggerCreated: false,
      capabilityGapCreated: false,
      coverageGapCreated: false,
      productStateCreated: false,
      officialTruthCreated: false
    });
  });

  it('omits measured duration when invocation timestamps are invalid or inverted', () => {
    const invalid = createGovernedCapabilityRuntimeQualityTelemetryV1(
      executionFixture({ startedAt: 'not-a-date' }),
      '2026-09-01T00:00:04.000Z'
    );
    const inverted = createGovernedCapabilityRuntimeQualityTelemetryV1(
      executionFixture({
        startedAt: '2026-09-01T00:00:01.000Z',
        completedAt: '2026-09-01T00:00:00.000Z'
      }),
      '2026-09-01T00:00:04.000Z'
    );

    expect(invalid.invocation).not.toHaveProperty('measuredDurationMs');
    expect(inverted.invocation).not.toHaveProperty('measuredDurationMs');
    expect(invalid.usage?.reportedLatencyMs).toBe(200);
  });

  it('rejects telemetry construction when persisted execution identities drift', () => {
    const execution = executionFixture();
    const drifted: CapabilityRuntimeExecution = {
      ...execution,
      receipt: {
        ...execution.receipt,
        capabilityOutcomeId: 'capability-outcome_other'
      }
    };

    expect(() =>
      createGovernedCapabilityRuntimeQualityTelemetryV1(drifted, '2026-09-01T00:00:05.000Z')
    ).toThrow(/exact execution identity pairing/u);
  });

  it('records one best-effort event without changing the governed result', async () => {
    const result = executionFixture();
    const invoke = vi.fn(() => Promise.resolve(result));
    const sink = new InMemoryCapabilityRuntimeQualityTelemetrySinkV1();
    const observed = new ObservedGovernedCapabilityRuntimeV1(
      { invoke },
      sink,
      () => '2026-09-01T00:00:06.000Z'
    );

    await expect(observed.invoke({ private: sensitiveInput })).resolves.toBe(result);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(sink.list()).toHaveLength(1);
    expect(sink.list()[0]?.eventType).toBe('GOVERNED_CAPABILITY_RUNTIME_QUALITY');
  });

  it('never retries or changes the governed result when the telemetry sink fails', async () => {
    const result = executionFixture();
    const invoke = vi.fn(() => Promise.resolve(result));
    const record = vi.fn(() => Promise.reject(new Error('telemetry unavailable')));
    const sink: CapabilityRuntimeQualityTelemetrySinkV1 = { record };
    const observed = new ObservedGovernedCapabilityRuntimeV1({ invoke }, sink);

    await expect(observed.invoke({ private: sensitiveInput })).resolves.toBe(result);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledTimes(1);
  });

  it('records only safe governed rejection metadata and rethrows the exact runtime error', async () => {
    const rejection = new GovernedCapabilityRuntimeError(
      'NO_APPROVED_IMPLEMENTATION',
      'SENSITIVE REJECTION DETAIL',
      409
    );
    const invoke = vi.fn(() => Promise.reject(rejection));
    const sink = new InMemoryCapabilityRuntimeQualityTelemetrySinkV1();
    const observed = new ObservedGovernedCapabilityRuntimeV1(
      { invoke },
      sink,
      () => '2026-09-01T00:00:07.000Z'
    );

    await expect(observed.invoke({ private: sensitiveInput })).rejects.toBe(rejection);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(sink.list()).toEqual([
      {
        schemaVersion: 1,
        eventType: 'GOVERNED_CAPABILITY_RUNTIME_REJECTED',
        rejection: {
          errorCode: 'NO_APPROVED_IMPLEMENTATION',
          httpStatus: 409
        },
        execution: {
          implementationExecution: 'NOT_STARTED',
          runtimeFallbackAttempted: false
        },
        sensitiveContentRetained: false,
        errorMessageRetained: false,
        recordedAt: '2026-09-01T00:00:07.000Z',
        authority: capabilityRuntimeQualityNoAuthority
      }
    ]);
    expect(JSON.stringify(sink.list())).not.toContain('SENSITIVE REJECTION DETAIL');
    expect(JSON.stringify(sink.list())).not.toContain(sensitiveInput);
  });

  it('redacts unclassified runtime failures without inventing implementation execution facts', async () => {
    const rejection = new Error('SENSITIVE UNKNOWN FAILURE');
    const invoke = vi.fn(() => Promise.reject(rejection));
    const sink = new InMemoryCapabilityRuntimeQualityTelemetrySinkV1();
    const observed = new ObservedGovernedCapabilityRuntimeV1(
      { invoke },
      sink,
      () => '2026-09-01T00:00:08.000Z'
    );

    await expect(observed.invoke({ private: sensitiveInput })).rejects.toBe(rejection);
    expect(sink.list()[0]).toMatchObject({
      eventType: 'GOVERNED_CAPABILITY_RUNTIME_REJECTED',
      rejection: { errorCode: 'UNCLASSIFIED_RUNTIME_ERROR' },
      execution: { implementationExecution: 'UNKNOWN' }
    });
    expect(JSON.stringify(sink.list())).not.toContain('SENSITIVE UNKNOWN FAILURE');
  });

  it('creates an explicitly enabled redacted JSONL sink and keeps it disabled by default', async () => {
    const lines: string[] = [];
    const disabled = createCapabilityAuditTelemetrySinkFromEnvironmentV1({});
    const enabled = createCapabilityAuditTelemetrySinkFromEnvironmentV1(
      { [CAPABILITY_AUDIT_TELEMETRY_STDOUT_ENABLED_ENV]: '1' },
      (line) => lines.push(line)
    );
    const event = createGovernedCapabilityRuntimeQualityTelemetryV1(
      executionFixture(),
      '2026-09-01T00:00:09.000Z'
    );

    expect(disabled).toBeNull();
    expect(enabled).not.toBeNull();
    await enabled?.record(event);
    expect(lines).toEqual([`${JSON.stringify(event)}\n`]);
    expect(lines[0]).not.toContain(sensitiveInput);
    expect(lines[0]).not.toContain(sensitiveOutput);
  });

  it('fails fast on an ambiguous production telemetry toggle', () => {
    expect(() =>
      createCapabilityAuditTelemetrySinkFromEnvironmentV1({
        [CAPABILITY_AUDIT_TELEMETRY_STDOUT_ENABLED_ENV]: 'true'
      })
    ).toThrow(/must be exactly '0' or '1'/u);
  });
});
