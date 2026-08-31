import type {
  CapabilityAuditTelemetryEventV1,
  CapabilityAuditTelemetrySinkV1
} from './capability-audit-telemetry.js';
import {
  GovernedCapabilityRuntimeError,
  type CapabilityRuntimeExecution,
  type GovernedCapabilityRuntimeErrorCode
} from './capability-runtime.js';

export const CAPABILITY_AUDIT_TELEMETRY_STDOUT_ENABLED_ENV =
  'MO_CAPABILITY_AUDIT_TELEMETRY_STDOUT_ENABLED' as const;

export interface CapabilityRuntimeQualityNoAuthorityV1 {
  methodCorrectnessEvaluated: false;
  methodImprovementTriggerCreated: false;
  capabilityGapCreated: false;
  coverageGapCreated: false;
  productStateCreated: false;
  officialTruthCreated: false;
}

export const capabilityRuntimeQualityNoAuthority = Object.freeze({
  methodCorrectnessEvaluated: false,
  methodImprovementTriggerCreated: false,
  capabilityGapCreated: false,
  coverageGapCreated: false,
  productStateCreated: false,
  officialTruthCreated: false
}) satisfies Readonly<CapabilityRuntimeQualityNoAuthorityV1>;

export interface GovernedCapabilityRuntimeQualityTelemetryV1 {
  schemaVersion: 1;
  eventType: 'GOVERNED_CAPABILITY_RUNTIME_QUALITY';
  request: Readonly<{
    capabilityRequestId: CapabilityRuntimeExecution['request']['capabilityRequestId'];
    correlationId: string;
    workspaceId: string;
    callerProduct: string;
  }>;
  runtimeCapability: CapabilityRuntimeExecution['binding']['runtimeCapability'];
  implementation: CapabilityRuntimeExecution['binding']['implementation'];
  invocation: Readonly<{
    capabilityInvocationId: CapabilityRuntimeExecution['invocation']['capabilityInvocationId'];
    attempt: number;
    status: CapabilityRuntimeExecution['invocation']['status'];
    measuredDurationMs?: number;
  }>;
  outcome: Readonly<{
    capabilityOutcomeId: CapabilityRuntimeExecution['outcome']['capabilityOutcomeId'];
    status: CapabilityRuntimeExecution['outcome']['status'];
    errorCode?: NonNullable<CapabilityRuntimeExecution['outcome']['error']>['code'];
  }>;
  result: Readonly<{
    capabilityReturnId: CapabilityRuntimeExecution['returnValue']['capabilityReturnId'];
    status: CapabilityRuntimeExecution['returnValue']['status'];
    sessionReceiptId: CapabilityRuntimeExecution['receipt']['sessionReceiptId'];
  }>;
  execution: Readonly<{
    attribution: 'CURRENT_CALL_EXECUTION' | 'HISTORICAL_REPLAY';
    replayed: boolean;
    implementationExecutedThisCall: boolean;
    runtimeFallbackAttempted: false;
  }>;
  usage?: Readonly<{
    attribution: 'CURRENT_EXECUTION' | 'HISTORICAL_EXECUTION';
    reportedLatencyMs?: number;
    inputUnits?: number;
    outputUnits?: number;
    costMinor?: number;
    currency?: string;
  }>;
  sensitiveContentRetained: false;
  errorMessageRetained: false;
  recordedAt: string;
  authority: Readonly<CapabilityRuntimeQualityNoAuthorityV1>;
}

export interface GovernedCapabilityRuntimeRejectionTelemetryV1 {
  schemaVersion: 1;
  eventType: 'GOVERNED_CAPABILITY_RUNTIME_REJECTED';
  rejection: Readonly<{
    errorCode: GovernedCapabilityRuntimeErrorCode | 'UNCLASSIFIED_RUNTIME_ERROR';
    httpStatus?: number;
  }>;
  execution: Readonly<{
    implementationExecution: 'NOT_STARTED' | 'UNKNOWN';
    runtimeFallbackAttempted: false;
  }>;
  sensitiveContentRetained: false;
  errorMessageRetained: false;
  recordedAt: string;
  authority: Readonly<CapabilityRuntimeQualityNoAuthorityV1>;
}

export type CapabilityRuntimeQualityTelemetryEventV1 =
  GovernedCapabilityRuntimeQualityTelemetryV1 | GovernedCapabilityRuntimeRejectionTelemetryV1;

export interface CapabilityRuntimeQualityTelemetrySinkV1 {
  record(event: Readonly<CapabilityRuntimeQualityTelemetryEventV1>): Promise<void>;
}

export interface GovernedCapabilityRuntimeLikeV1 {
  invoke(value: unknown): Promise<CapabilityRuntimeExecution>;
}

function measuredDurationMs(
  startedAt: string,
  completedAt: string | undefined
): number | undefined {
  if (completedAt === undefined) return undefined;
  const started = Date.parse(startedAt);
  const completed = Date.parse(completedAt);
  if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started) {
    return undefined;
  }
  return completed - started;
}

function assertExactRuntimeExecution(execution: Readonly<CapabilityRuntimeExecution>): void {
  const { request, binding, invocation, outcome, returnValue, receipt } = execution;
  const matches =
    binding.capabilityRequestId === request.capabilityRequestId &&
    invocation.capabilityRequestId === request.capabilityRequestId &&
    invocation.implementationBindingId === binding.implementationBindingId &&
    outcome.capabilityRequestId === request.capabilityRequestId &&
    outcome.capabilityInvocationId === invocation.capabilityInvocationId &&
    returnValue.capabilityRequestId === request.capabilityRequestId &&
    returnValue.capabilityOutcomeId === outcome.capabilityOutcomeId &&
    returnValue.outputSchemaId === outcome.outputSchemaId &&
    receipt.capabilityRequestId === request.capabilityRequestId &&
    receipt.correlationId === request.correlationId &&
    receipt.workspaceId === request.caller.workspaceId &&
    receipt.principalId === request.caller.principalId &&
    receipt.callerProduct === request.caller.callerProduct &&
    receipt.runtimeCapability.id === binding.runtimeCapability.id &&
    receipt.runtimeCapability.version === binding.runtimeCapability.version &&
    receipt.runtimeCapability.capabilityId === binding.runtimeCapability.capabilityId &&
    receipt.runtimeCapability.capabilityVersion === binding.runtimeCapability.capabilityVersion &&
    receipt.implementation.id === binding.implementation.id &&
    receipt.implementation.version === binding.implementation.version &&
    receipt.implementation.implementationKey === binding.implementation.implementationKey &&
    receipt.capabilityInvocationId === invocation.capabilityInvocationId &&
    receipt.capabilityOutcomeId === outcome.capabilityOutcomeId &&
    receipt.capabilityReturnId === returnValue.capabilityReturnId;

  if (!matches) {
    throw new Error(
      'Capability runtime quality telemetry requires exact execution identity pairing.'
    );
  }
}

function qualityUsage(
  execution: Readonly<CapabilityRuntimeExecution>
): GovernedCapabilityRuntimeQualityTelemetryV1['usage'] | undefined {
  const usage = execution.outcome.usage;
  if (usage === undefined) return undefined;
  return {
    attribution: execution.replayed ? 'HISTORICAL_EXECUTION' : 'CURRENT_EXECUTION',
    ...(usage.latencyMs === undefined ? {} : { reportedLatencyMs: usage.latencyMs }),
    ...(usage.inputUnits === undefined ? {} : { inputUnits: usage.inputUnits }),
    ...(usage.outputUnits === undefined ? {} : { outputUnits: usage.outputUnits }),
    ...(usage.costMinor === undefined ? {} : { costMinor: usage.costMinor }),
    ...(usage.currency === undefined ? {} : { currency: usage.currency })
  };
}

export function createGovernedCapabilityRuntimeQualityTelemetryV1(
  execution: Readonly<CapabilityRuntimeExecution>,
  recordedAt: string
): GovernedCapabilityRuntimeQualityTelemetryV1 {
  assertExactRuntimeExecution(execution);
  const duration = measuredDurationMs(
    execution.invocation.startedAt,
    execution.invocation.completedAt
  );
  const usage = qualityUsage(execution);

  return {
    schemaVersion: 1,
    eventType: 'GOVERNED_CAPABILITY_RUNTIME_QUALITY',
    request: {
      capabilityRequestId: execution.request.capabilityRequestId,
      correlationId: execution.request.correlationId,
      workspaceId: execution.request.caller.workspaceId,
      callerProduct: execution.request.caller.callerProduct
    },
    runtimeCapability: structuredClone(execution.binding.runtimeCapability),
    implementation: structuredClone(execution.binding.implementation),
    invocation: {
      capabilityInvocationId: execution.invocation.capabilityInvocationId,
      attempt: execution.invocation.attempt,
      status: execution.invocation.status,
      ...(duration === undefined ? {} : { measuredDurationMs: duration })
    },
    outcome: {
      capabilityOutcomeId: execution.outcome.capabilityOutcomeId,
      status: execution.outcome.status,
      ...(execution.outcome.error === undefined ? {} : { errorCode: execution.outcome.error.code })
    },
    result: {
      capabilityReturnId: execution.returnValue.capabilityReturnId,
      status: execution.returnValue.status,
      sessionReceiptId: execution.receipt.sessionReceiptId
    },
    execution: {
      attribution: execution.replayed ? 'HISTORICAL_REPLAY' : 'CURRENT_CALL_EXECUTION',
      replayed: execution.replayed,
      implementationExecutedThisCall: !execution.replayed,
      runtimeFallbackAttempted: false
    },
    ...(usage === undefined ? {} : { usage }),
    sensitiveContentRetained: false,
    errorMessageRetained: false,
    recordedAt: new Date(recordedAt).toISOString(),
    authority: capabilityRuntimeQualityNoAuthority
  };
}

export function createGovernedCapabilityRuntimeRejectionTelemetryV1(
  error: unknown,
  recordedAt: string
): GovernedCapabilityRuntimeRejectionTelemetryV1 {
  const governed = error instanceof GovernedCapabilityRuntimeError;
  return {
    schemaVersion: 1,
    eventType: 'GOVERNED_CAPABILITY_RUNTIME_REJECTED',
    rejection: {
      errorCode: governed ? error.code : 'UNCLASSIFIED_RUNTIME_ERROR',
      ...(governed ? { httpStatus: error.status } : {})
    },
    execution: {
      implementationExecution: governed ? 'NOT_STARTED' : 'UNKNOWN',
      runtimeFallbackAttempted: false
    },
    sensitiveContentRetained: false,
    errorMessageRetained: false,
    recordedAt: new Date(recordedAt).toISOString(),
    authority: capabilityRuntimeQualityNoAuthority
  };
}

async function bestEffortRecordRuntimeQuality(
  sink: Readonly<CapabilityRuntimeQualityTelemetrySinkV1>,
  createEvent: () => CapabilityRuntimeQualityTelemetryEventV1
): Promise<void> {
  try {
    await sink.record(createEvent());
  } catch {
    // Runtime quality telemetry must never change execution, replay, retry, or failure semantics.
  }
}

export class ObservedGovernedCapabilityRuntimeV1 implements GovernedCapabilityRuntimeLikeV1 {
  constructor(
    private readonly inner: Readonly<GovernedCapabilityRuntimeLikeV1>,
    private readonly sink: Readonly<CapabilityRuntimeQualityTelemetrySinkV1>,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async invoke(value: unknown): Promise<CapabilityRuntimeExecution> {
    try {
      const execution = await this.inner.invoke(value);
      await bestEffortRecordRuntimeQuality(this.sink, () =>
        createGovernedCapabilityRuntimeQualityTelemetryV1(execution, this.now())
      );
      return execution;
    } catch (error) {
      await bestEffortRecordRuntimeQuality(this.sink, () =>
        createGovernedCapabilityRuntimeRejectionTelemetryV1(error, this.now())
      );
      throw error;
    }
  }
}

export type CapabilityAuditTelemetryLineWriterV1 = (line: string) => void;

export class JsonLineCapabilityAuditTelemetrySinkV1
  implements CapabilityAuditTelemetrySinkV1, CapabilityRuntimeQualityTelemetrySinkV1
{
  constructor(
    private readonly writeLine: CapabilityAuditTelemetryLineWriterV1 = (line) => {
      process.stdout.write(line);
    }
  ) {}

  record(
    event: Readonly<CapabilityAuditTelemetryEventV1 | CapabilityRuntimeQualityTelemetryEventV1>
  ): Promise<void> {
    this.writeLine(`${JSON.stringify(event)}\n`);
    return Promise.resolve();
  }
}

export function createCapabilityAuditTelemetrySinkFromEnvironmentV1(
  environment: NodeJS.ProcessEnv,
  writeLine?: CapabilityAuditTelemetryLineWriterV1
): JsonLineCapabilityAuditTelemetrySinkV1 | null {
  const value = environment[CAPABILITY_AUDIT_TELEMETRY_STDOUT_ENABLED_ENV];
  if (value === undefined || value === '' || value === '0') return null;
  if (value !== '1') {
    throw new Error(
      `${CAPABILITY_AUDIT_TELEMETRY_STDOUT_ENABLED_ENV} must be exactly '0' or '1' when configured.`
    );
  }
  return new JsonLineCapabilityAuditTelemetrySinkV1(writeLine);
}

export class InMemoryCapabilityRuntimeQualityTelemetrySinkV1 implements CapabilityRuntimeQualityTelemetrySinkV1 {
  private readonly events: CapabilityRuntimeQualityTelemetryEventV1[] = [];

  record(event: Readonly<CapabilityRuntimeQualityTelemetryEventV1>): Promise<void> {
    this.events.push(structuredClone(event));
    return Promise.resolve();
  }

  list(): readonly Readonly<CapabilityRuntimeQualityTelemetryEventV1>[] {
    return structuredClone(this.events);
  }
}
