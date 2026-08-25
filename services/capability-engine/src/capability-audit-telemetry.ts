import type { CapabilityLedgerEntry, CapabilityObservation } from '@markorbit/contracts';
import {
  MANAGED_AI_EXECUTION_CAPABILITY_ID,
  MANAGED_AI_EXECUTION_CONTRACT_VERSION,
  parseManagedAiExecutionOutcomeV1,
  type ManagedAiExecutionInputV1,
  type ManagedAiExecutionOutcomeV1
} from '@markorbit/contracts/managed-ai-execution';

export interface CapabilityAuditTelemetryAuthorityV1 {
  canonicalTruthCreated: false;
  capabilityCanonMutated: false;
  learningObservationCreated: false;
  professionalDecisionCreated: false;
  providerSelectionAuthorityGrantedToCaller: false;
  paymentCreated: false;
  filingSubmitted: false;
  externalMessageSent: false;
  externalProfessionalActionExecuted: false;
}

export const capabilityAuditTelemetryNoAuthority = Object.freeze({
  canonicalTruthCreated: false,
  capabilityCanonMutated: false,
  learningObservationCreated: false,
  professionalDecisionCreated: false,
  providerSelectionAuthorityGrantedToCaller: false,
  paymentCreated: false,
  filingSubmitted: false,
  externalMessageSent: false,
  externalProfessionalActionExecuted: false
}) satisfies Readonly<CapabilityAuditTelemetryAuthorityV1>;

export interface ManagedAiExecutionAuditTelemetryV1 {
  schemaVersion: 1;
  eventType:
    | 'MANAGED_AI_EXECUTION_OUTCOME'
    | 'MANAGED_AI_EXECUTOR_INVALID_RESULT'
    | 'MANAGED_AI_EXECUTOR_THROWN';
  executionId: string;
  correlationId: string;
  capability: Readonly<{
    id: typeof MANAGED_AI_EXECUTION_CAPABILITY_ID;
    version: typeof MANAGED_AI_EXECUTION_CONTRACT_VERSION;
  }>;
  outcome?: Readonly<{
    status: ManagedAiExecutionOutcomeV1['status'];
    deliveryState: ManagedAiExecutionOutcomeV1['deliveryState'];
    retryDisposition: ManagedAiExecutionOutcomeV1['retryDisposition'];
    errorCode?: NonNullable<ManagedAiExecutionOutcomeV1['error']>['code'];
  }>;
  implementation?: Readonly<{
    implementationProfileId: string;
    implementationProfileVersion: number;
    implementationKey: string;
    provider: string;
    model: string;
    promptPolicyId: string;
    promptPolicyVersion: string;
    outputSchemaId: string;
    inputSha256: string;
    providerRequestId?: string;
    startedAt: string;
    completedAt: string;
  }>;
  usage?: Readonly<{
    inputUnits?: number;
    outputUnits?: number;
    cachedInputUnits?: number;
    latencyMs?: number;
    costMinor?: number;
    currency?: string;
    retryCount?: number;
    fallbackCount?: number;
  }>;
  exactEvidence?: Readonly<{
    kind: 'INLINE_BASE64' | 'DURABLE_REF';
    mediaType: string;
    sha256: string;
    sizeBytes: number;
  }>;
  sensitiveContentRetained: false;
  errorMessageRetained: false;
  recordedAt: string;
  authority: Readonly<CapabilityAuditTelemetryAuthorityV1>;
}

export interface CapabilityObservationAuditTelemetryV1 {
  schemaVersion: 1;
  eventType: 'CAPABILITY_OBSERVATION_ADMISSION';
  runtimeCapability: Readonly<{
    id: CapabilityObservation['runtimeCapability']['id'];
    version: number;
  }>;
  workspaceId: string;
  subjectUserId: string;
  observationId: CapabilityObservation['capabilityObservationId'];
  ledgerEntryId: CapabilityLedgerEntry['capabilityLedgerEntryId'];
  source: Readonly<{
    owner: CapabilityObservation['source']['owner'];
    kind: CapabilityObservation['source']['kind'];
    sourceFingerprintSha256: string;
  }>;
  replayed: boolean;
  sensitiveContentRetained: false;
  recordedAt: string;
  authority: Readonly<CapabilityAuditTelemetryAuthorityV1>;
}

export type CapabilityAuditTelemetryEventV1 =
  ManagedAiExecutionAuditTelemetryV1 | CapabilityObservationAuditTelemetryV1;

export interface CapabilityAuditTelemetrySinkV1 {
  record(event: Readonly<CapabilityAuditTelemetryEventV1>): Promise<void>;
}

export interface ManagedAiExecutionContextLikeV1 {
  executionId: string;
  correlationId: string;
}

export interface ManagedAiExecutionAuthorityLikeV1 {
  execute(
    input: Readonly<ManagedAiExecutionInputV1>,
    context: Readonly<ManagedAiExecutionContextLikeV1>
  ): Promise<unknown>;
}

function cloneUsage(
  usage: NonNullable<ManagedAiExecutionOutcomeV1['usage']>
): NonNullable<ManagedAiExecutionAuditTelemetryV1['usage']> {
  return {
    ...(usage.inputUnits === undefined ? {} : { inputUnits: usage.inputUnits }),
    ...(usage.outputUnits === undefined ? {} : { outputUnits: usage.outputUnits }),
    ...(usage.cachedInputUnits === undefined ? {} : { cachedInputUnits: usage.cachedInputUnits }),
    ...(usage.latencyMs === undefined ? {} : { latencyMs: usage.latencyMs }),
    ...(usage.costMinor === undefined ? {} : { costMinor: usage.costMinor }),
    ...(usage.currency === undefined ? {} : { currency: usage.currency }),
    ...(usage.retryCount === undefined ? {} : { retryCount: usage.retryCount }),
    ...(usage.fallbackCount === undefined ? {} : { fallbackCount: usage.fallbackCount })
  };
}

export function createManagedAiExecutionAuditTelemetryV1(
  context: Readonly<ManagedAiExecutionContextLikeV1>,
  outcome: Readonly<ManagedAiExecutionOutcomeV1>,
  recordedAt: string
): ManagedAiExecutionAuditTelemetryV1 {
  const provenance = outcome.provenance;
  const exactOutput = outcome.exactOutput;
  return {
    schemaVersion: 1,
    eventType: 'MANAGED_AI_EXECUTION_OUTCOME',
    executionId: context.executionId,
    correlationId: context.correlationId,
    capability: {
      id: MANAGED_AI_EXECUTION_CAPABILITY_ID,
      version: MANAGED_AI_EXECUTION_CONTRACT_VERSION
    },
    outcome: {
      status: outcome.status,
      deliveryState: outcome.deliveryState,
      retryDisposition: outcome.retryDisposition,
      ...(outcome.error === undefined ? {} : { errorCode: outcome.error.code })
    },
    ...(provenance === undefined
      ? {}
      : {
          implementation: {
            implementationProfileId: provenance.implementationProfileId,
            implementationProfileVersion: provenance.implementationProfileVersion,
            implementationKey: provenance.implementationKey,
            provider: provenance.provider,
            model: provenance.model,
            promptPolicyId: provenance.promptPolicyId,
            promptPolicyVersion: provenance.promptPolicyVersion,
            outputSchemaId: provenance.outputSchemaId,
            inputSha256: provenance.inputSha256,
            ...(provenance.providerRequestId === undefined
              ? {}
              : { providerRequestId: provenance.providerRequestId }),
            startedAt: provenance.startedAt,
            completedAt: provenance.completedAt
          }
        }),
    ...(outcome.usage === undefined ? {} : { usage: cloneUsage(outcome.usage) }),
    ...(exactOutput === undefined
      ? {}
      : {
          exactEvidence: {
            kind: exactOutput.kind,
            mediaType: exactOutput.mediaType,
            sha256: exactOutput.sha256,
            sizeBytes: exactOutput.sizeBytes
          }
        }),
    sensitiveContentRetained: false,
    errorMessageRetained: false,
    recordedAt: new Date(recordedAt).toISOString(),
    authority: capabilityAuditTelemetryNoAuthority
  };
}

export function createCapabilityObservationAuditTelemetryV1(
  observation: Readonly<CapabilityObservation>,
  ledgerEntry: Readonly<CapabilityLedgerEntry>,
  replayed: boolean
): CapabilityObservationAuditTelemetryV1 {
  if (
    ledgerEntry.workspaceId !== observation.workspaceId ||
    ledgerEntry.subjectUserId !== observation.subjectUserId ||
    ledgerEntry.runtimeCapability.id !== observation.runtimeCapability.id ||
    ledgerEntry.runtimeCapability.version !== observation.runtimeCapability.version ||
    ledgerEntry.observation.id !== observation.capabilityObservationId ||
    ledgerEntry.observation.sourceOwner !== observation.source.owner ||
    ledgerEntry.observation.sourceKind !== observation.source.kind ||
    ledgerEntry.observation.sourceFingerprintSha256 !== observation.source.sourceFingerprintSha256
  ) {
    throw new Error(
      'Capability Observation telemetry requires an exact Observation/Ledger pairing.'
    );
  }
  return {
    schemaVersion: 1,
    eventType: 'CAPABILITY_OBSERVATION_ADMISSION',
    runtimeCapability: {
      id: observation.runtimeCapability.id,
      version: observation.runtimeCapability.version
    },
    workspaceId: observation.workspaceId,
    subjectUserId: observation.subjectUserId,
    observationId: observation.capabilityObservationId,
    ledgerEntryId: ledgerEntry.capabilityLedgerEntryId,
    source: {
      owner: observation.source.owner,
      kind: observation.source.kind,
      sourceFingerprintSha256: observation.source.sourceFingerprintSha256
    },
    replayed,
    sensitiveContentRetained: false,
    recordedAt: ledgerEntry.recordedAt,
    authority: capabilityAuditTelemetryNoAuthority
  };
}

async function bestEffortRecord(
  sink: Readonly<CapabilityAuditTelemetrySinkV1>,
  event: Readonly<CapabilityAuditTelemetryEventV1>
): Promise<void> {
  try {
    await sink.record(event);
  } catch {
    // Audit telemetry must never cause a second provider attempt or change a governed outcome.
  }
}

export class ObservedManagedAiExecutionAuthorityV1 implements ManagedAiExecutionAuthorityLikeV1 {
  constructor(
    private readonly inner: Readonly<ManagedAiExecutionAuthorityLikeV1>,
    private readonly sink: Readonly<CapabilityAuditTelemetrySinkV1>,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async execute(
    input: Readonly<ManagedAiExecutionInputV1>,
    context: Readonly<ManagedAiExecutionContextLikeV1>
  ): Promise<unknown> {
    try {
      const result = await this.inner.execute(input, context);
      let outcome: ManagedAiExecutionOutcomeV1;
      try {
        outcome = parseManagedAiExecutionOutcomeV1(result);
      } catch {
        await bestEffortRecord(this.sink, {
          schemaVersion: 1,
          eventType: 'MANAGED_AI_EXECUTOR_INVALID_RESULT',
          executionId: context.executionId,
          correlationId: context.correlationId,
          capability: {
            id: MANAGED_AI_EXECUTION_CAPABILITY_ID,
            version: MANAGED_AI_EXECUTION_CONTRACT_VERSION
          },
          sensitiveContentRetained: false,
          errorMessageRetained: false,
          recordedAt: new Date(this.now()).toISOString(),
          authority: capabilityAuditTelemetryNoAuthority
        });
        return result;
      }
      await bestEffortRecord(
        this.sink,
        createManagedAiExecutionAuditTelemetryV1(context, outcome, this.now())
      );
      return result;
    } catch (error) {
      await bestEffortRecord(this.sink, {
        schemaVersion: 1,
        eventType: 'MANAGED_AI_EXECUTOR_THROWN',
        executionId: context.executionId,
        correlationId: context.correlationId,
        capability: {
          id: MANAGED_AI_EXECUTION_CAPABILITY_ID,
          version: MANAGED_AI_EXECUTION_CONTRACT_VERSION
        },
        sensitiveContentRetained: false,
        errorMessageRetained: false,
        recordedAt: new Date(this.now()).toISOString(),
        authority: capabilityAuditTelemetryNoAuthority
      });
      throw error;
    }
  }
}

export class InMemoryCapabilityAuditTelemetrySinkV1 implements CapabilityAuditTelemetrySinkV1 {
  private readonly events: CapabilityAuditTelemetryEventV1[] = [];

  record(event: Readonly<CapabilityAuditTelemetryEventV1>): Promise<void> {
    this.events.push(structuredClone(event));
    return Promise.resolve();
  }

  list(): readonly Readonly<CapabilityAuditTelemetryEventV1>[] {
    return structuredClone(this.events);
  }
}
