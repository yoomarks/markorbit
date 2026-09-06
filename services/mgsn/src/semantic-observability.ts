import type { JsonResult, JsonRoute } from '@markorbit/service-kit';

export type MgsnSemanticTelemetryOperationV1 =
  | 'PROVIDER_DISCOVERY_EVALUATE'
  | 'PROVIDER_SELECTION_CREATE_OR_REPLACE'
  | 'PROVIDER_SELECTION_REVOKE'
  | 'PROVIDER_SELECTION_VALIDATE_CURRENT'
  | 'CONTROLLED_HANDOFF_AUTHORIZE_OR_REPLACE'
  | 'CONTROLLED_HANDOFF_REVOKE'
  | 'CONTROLLED_HANDOFF_VALIDATE_CURRENT'
  | 'GOVERNED_ALLOCATION_COMMIT'
  | 'PROVIDER_ACCEPTANCE_RESPOND'
  | 'PROVIDER_RETURN_SUBMIT_OR_CORRECT';

export type MgsnSemanticTelemetryOutcomeClassV1 =
  'SUCCESS' | 'EMPTY' | 'DENIED' | 'UNAVAILABLE' | 'CONFLICT' | 'ERROR';

export type MgsnSemanticTelemetryResultCodeV1 =
  | 'CANDIDATES'
  | 'NO_AUTHORIZED_CANDIDATES'
  | 'AUTHORITY_UNAVAILABLE'
  | 'CREATED'
  | 'REPLACED'
  | 'REVOKED'
  | 'CURRENTLY_USABLE'
  | 'VALIDATION_DENIED'
  | 'AUTHORIZED'
  | 'ALLOCATED'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'RETURN_SUBMITTED'
  | 'RETURN_CORRECTED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'STALE_OR_VERSION_CONFLICT'
  | 'CURRENT_AUTHORITY_DENIED'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'NOT_FOUND'
  | 'INVALID_OR_FORBIDDEN'
  | 'INTERNAL_ERROR';

export interface MgsnSemanticTelemetryAuthorityV1 {
  canonicalTruthCreated: false;
  providerTrustEvidenceCreated: false;
  providerTrustAuthorityGranted: false;
  providerRankingAuthorityGranted: false;
  providerQualityInferenceCreated: false;
  professionalDecisionCreated: false;
  providerSelectionAuthorityGrantedToTelemetry: false;
  providerContactAuthorityGranted: false;
  filingSubmitted: false;
  paymentCreated: false;
  officialTruthCreated: false;
}

export const mgsnSemanticTelemetryNoAuthority = Object.freeze({
  canonicalTruthCreated: false,
  providerTrustEvidenceCreated: false,
  providerTrustAuthorityGranted: false,
  providerRankingAuthorityGranted: false,
  providerQualityInferenceCreated: false,
  professionalDecisionCreated: false,
  providerSelectionAuthorityGrantedToTelemetry: false,
  providerContactAuthorityGranted: false,
  filingSubmitted: false,
  paymentCreated: false,
  officialTruthCreated: false
}) satisfies Readonly<MgsnSemanticTelemetryAuthorityV1>;

export interface MgsnSemanticTelemetryEventV1 {
  schemaVersion: 1;
  eventType: 'MGSN_GOVERNED_NETWORK_OPERATION';
  operation: MgsnSemanticTelemetryOperationV1;
  outcomeClass: MgsnSemanticTelemetryOutcomeClassV1;
  resultCode: MgsnSemanticTelemetryResultCodeV1;
  candidateCount?: number;
  replayed?: boolean;
  latencyMs: number;
  recordedAt: string;
  sensitiveContentRetained: false;
  errorMessageRetained: false;
  rawPayloadRetained: false;
  authority: Readonly<MgsnSemanticTelemetryAuthorityV1>;
}

export interface MgsnSemanticTelemetrySinkV1 {
  record(event: Readonly<MgsnSemanticTelemetryEventV1>): Promise<void>;
}

export interface MgsnSemanticTelemetryEventInputV1 {
  operation: MgsnSemanticTelemetryOperationV1;
  outcomeClass: MgsnSemanticTelemetryOutcomeClassV1;
  resultCode: MgsnSemanticTelemetryResultCodeV1;
  candidateCount?: number;
  replayed?: boolean;
  latencyMs: number;
  recordedAt?: string;
}

export function createMgsnSemanticTelemetryEventV1(
  input: Readonly<MgsnSemanticTelemetryEventInputV1>
): MgsnSemanticTelemetryEventV1 {
  if (!Number.isFinite(input.latencyMs) || input.latencyMs < 0)
    throw new Error('MGSN semantic telemetry latency must be a non-negative finite number.');
  if (
    input.candidateCount !== undefined &&
    (!Number.isInteger(input.candidateCount) || input.candidateCount < 0)
  )
    throw new Error('MGSN semantic telemetry candidate count must be a non-negative integer.');
  return {
    schemaVersion: 1,
    eventType: 'MGSN_GOVERNED_NETWORK_OPERATION',
    operation: input.operation,
    outcomeClass: input.outcomeClass,
    resultCode: input.resultCode,
    ...(input.candidateCount === undefined ? {} : { candidateCount: input.candidateCount }),
    ...(input.replayed === undefined ? {} : { replayed: input.replayed }),
    latencyMs: Math.round(input.latencyMs),
    recordedAt: new Date(input.recordedAt ?? new Date().toISOString()).toISOString(),
    sensitiveContentRetained: false,
    errorMessageRetained: false,
    rawPayloadRetained: false,
    authority: mgsnSemanticTelemetryNoAuthority
  };
}

export async function recordMgsnSemanticTelemetryBestEffort(
  sink: Readonly<MgsnSemanticTelemetrySinkV1> | undefined,
  input: Readonly<MgsnSemanticTelemetryEventInputV1>
): Promise<void> {
  if (!sink) return;
  try {
    await sink.record(createMgsnSemanticTelemetryEventV1(input));
  } catch {
    // Operational telemetry must never mutate, retry, deny, or otherwise alter governed truth.
  }
}

export function classifyMgsnSemanticFailure(
  error: unknown
): Pick<MgsnSemanticTelemetryEventInputV1, 'outcomeClass' | 'resultCode'> {
  const value = error as { code?: unknown; status?: unknown };
  const code = typeof value?.code === 'string' ? value.code : '';
  const status = typeof value?.status === 'number' ? value.status : undefined;
  if (code === 'IDEMPOTENCY_CONFLICT')
    return { outcomeClass: 'CONFLICT', resultCode: 'IDEMPOTENCY_CONFLICT' };
  if (
    code.includes('STALE') ||
    code.includes('VERSION_MISMATCH') ||
    code.includes('NOT_CURRENT') ||
    code.includes('ALREADY_EXISTS')
  )
    return { outcomeClass: 'CONFLICT', resultCode: 'STALE_OR_VERSION_CONFLICT' };
  if (code.includes('AUTHORITY_UNAVAILABLE') || status === 503)
    return { outcomeClass: 'UNAVAILABLE', resultCode: 'AUTHORITY_UNAVAILABLE' };
  if (code.includes('NOT_FOUND') || status === 404)
    return { outcomeClass: 'DENIED', resultCode: 'NOT_FOUND' };
  if (code.includes('AUTHORITY_DENIED') || code.includes('DENIED'))
    return { outcomeClass: 'DENIED', resultCode: 'CURRENT_AUTHORITY_DENIED' };
  if (status !== undefined && status >= 400 && status < 500)
    return { outcomeClass: 'DENIED', resultCode: 'INVALID_OR_FORBIDDEN' };
  return { outcomeClass: 'ERROR', resultCode: 'INTERNAL_ERROR' };
}

export async function observeMgsnSemanticOperationV1<T>(
  sink: Readonly<MgsnSemanticTelemetrySinkV1> | undefined,
  operation: MgsnSemanticTelemetryOperationV1,
  work: () => Promise<T>,
  classifySuccess: (
    result: Readonly<T>
  ) => Pick<
    MgsnSemanticTelemetryEventInputV1,
    'outcomeClass' | 'resultCode' | 'candidateCount' | 'replayed'
  >
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await work();
    await recordMgsnSemanticTelemetryBestEffort(sink, {
      operation,
      ...classifySuccess(result),
      latencyMs: Date.now() - startedAt
    });
    return result;
  } catch (error) {
    await recordMgsnSemanticTelemetryBestEffort(sink, {
      operation,
      ...classifyMgsnSemanticFailure(error),
      latencyMs: Date.now() - startedAt
    });
    throw error;
  }
}

export const MGSN_PROVIDER_EXECUTION_SEMANTIC_ROUTES = Object.freeze([
  {
    method: 'POST',
    path: '/v1/provider/allocations/:allocationId/respond',
    operation: 'PROVIDER_ACCEPTANCE_RESPOND'
  },
  {
    method: 'POST',
    path: '/v1/provider/returns',
    operation: 'PROVIDER_RETURN_SUBMIT_OR_CORRECT'
  }
] as const);

function object(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;
}

function classifyProviderExecutionSuccess(
  operation: Extract<
    MgsnSemanticTelemetryOperationV1,
    'PROVIDER_ACCEPTANCE_RESPOND' | 'PROVIDER_RETURN_SUBMIT_OR_CORRECT'
  >,
  result: Readonly<JsonResult>
): Pick<MgsnSemanticTelemetryEventInputV1, 'outcomeClass' | 'resultCode'> {
  const body = object(result.body);
  if (operation === 'PROVIDER_ACCEPTANCE_RESPOND') {
    const acceptance = object(body?.providerAcceptance);
    if (acceptance?.decision === 'ACCEPTED')
      return { outcomeClass: 'SUCCESS', resultCode: 'ACCEPTED' };
    if (acceptance?.decision === 'DECLINED')
      // A recorded decline is a successful Provider decision, never negative quality evidence.
      return { outcomeClass: 'SUCCESS', resultCode: 'DECLINED' };
    return { outcomeClass: 'ERROR', resultCode: 'INTERNAL_ERROR' };
  }
  const providerReturn = object(body?.providerReturn);
  if (!providerReturn) return { outcomeClass: 'ERROR', resultCode: 'INTERNAL_ERROR' };
  return object(providerReturn.supersedes)
    ? { outcomeClass: 'SUCCESS', resultCode: 'RETURN_CORRECTED' }
    : { outcomeClass: 'SUCCESS', resultCode: 'RETURN_SUBMITTED' };
}

export function observeMgsnProviderExecutionSemanticRoutesV1(
  routes: readonly JsonRoute[],
  sink: Readonly<MgsnSemanticTelemetrySinkV1> | undefined
): JsonRoute[] {
  if (!sink) return [...routes];
  return routes.map((route) => {
    const observed = MGSN_PROVIDER_EXECUTION_SEMANTIC_ROUTES.find(
      (item) => item.method === route.method && item.path === route.path
    );
    if (!observed) return route;
    return {
      ...route,
      handle: (request) =>
        observeMgsnSemanticOperationV1(
          sink,
          observed.operation,
          async () => await route.handle(request),
          (result) => classifyProviderExecutionSuccess(observed.operation, result)
        )
    };
  });
}

export class JsonLineMgsnSemanticTelemetrySinkV1 implements MgsnSemanticTelemetrySinkV1 {
  constructor(
    private readonly writeLine: (line: string) => void = (line) => {
      process.stdout.write(line);
    }
  ) {}

  record(event: Readonly<MgsnSemanticTelemetryEventV1>): Promise<void> {
    this.writeLine(`${JSON.stringify({ kind: 'mgsn.semantic.v1', event })}\n`);
    return Promise.resolve();
  }
}

export class InMemoryMgsnSemanticTelemetrySinkV1 implements MgsnSemanticTelemetrySinkV1 {
  private readonly events: MgsnSemanticTelemetryEventV1[] = [];

  record(event: Readonly<MgsnSemanticTelemetryEventV1>): Promise<void> {
    this.events.push(structuredClone(event));
    return Promise.resolve();
  }

  list(): readonly Readonly<MgsnSemanticTelemetryEventV1>[] {
    return structuredClone(this.events);
  }
}
