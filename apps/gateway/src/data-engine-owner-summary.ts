import {
  DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
  DATA_ENGINE_SOURCE_OWNER
} from '@markorbit/contracts/data-engine';
import {
  DataEngineClientError,
  type DataEngineClient,
  type DataEngineRequestContext
} from './data-engine-http.js';

export interface DataEngineOwnerSummary {
  contract_version: string;
  engine_version: string;
  source_owner: string;
  authority: 'DATA_ENGINE_FACT_READ_MODEL';
  read_only: true;
  generated_at: string;
  health: {
    status: 'ok' | 'degraded';
  };
  operations: {
    version: string;
    action_authority: string;
    summary: {
      operation_count: number;
      state_counts: Readonly<Record<string, number>>;
      resume_candidates: number;
      retry_candidates: number;
      operator_required: number;
      partial_state_preservation_required: number;
    };
  };
  domain_progress: {
    version: string;
    active_count: number;
  };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function nonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function ownerTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/(?:Z|[+-]\d{2}:\d{2})$/u.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

function stateCounts(value: unknown): Readonly<Record<string, number>> | undefined {
  const source = record(value);
  if (!source) return undefined;
  const entries = Object.entries(source);
  if (entries.some(([key, count]) => key.trim().length === 0 || !nonNegativeSafeInteger(count)))
    return undefined;
  return Object.freeze(Object.fromEntries(entries) as Record<string, number>);
}

export function parseDataEngineOwnerSummary(value: unknown): DataEngineOwnerSummary | undefined {
  const source = record(value);
  const health = record(source?.health);
  const operations = record(source?.operations);
  const summary = record(operations?.summary);
  const domainProgress = record(source?.domain_progress);
  const counts = stateCounts(summary?.state_counts);

  if (
    !source ||
    source.contract_version !== DATA_ENGINE_INTEGRATION_CONTRACT_VERSION ||
    !nonEmptyString(source.engine_version) ||
    source.source_owner !== DATA_ENGINE_SOURCE_OWNER ||
    source.authority !== 'DATA_ENGINE_FACT_READ_MODEL' ||
    source.read_only !== true ||
    !ownerTimestamp(source.generated_at) ||
    !health ||
    !['ok', 'degraded'].includes(String(health.status)) ||
    !operations ||
    !nonEmptyString(operations.version) ||
    !nonEmptyString(operations.action_authority) ||
    !summary ||
    !nonNegativeSafeInteger(summary.operation_count) ||
    !counts ||
    !nonNegativeSafeInteger(summary.resume_candidates) ||
    !nonNegativeSafeInteger(summary.retry_candidates) ||
    !nonNegativeSafeInteger(summary.operator_required) ||
    !nonNegativeSafeInteger(summary.partial_state_preservation_required) ||
    !domainProgress ||
    !nonEmptyString(domainProgress.version) ||
    !nonNegativeSafeInteger(domainProgress.active_count)
  )
    return undefined;

  return Object.freeze({
    contract_version: DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
    engine_version: source.engine_version,
    source_owner: DATA_ENGINE_SOURCE_OWNER,
    authority: 'DATA_ENGINE_FACT_READ_MODEL',
    read_only: true,
    generated_at: source.generated_at,
    health: Object.freeze({ status: health.status as 'ok' | 'degraded' }),
    operations: Object.freeze({
      version: operations.version,
      action_authority: operations.action_authority,
      summary: Object.freeze({
        operation_count: summary.operation_count,
        state_counts: counts,
        resume_candidates: summary.resume_candidates,
        retry_candidates: summary.retry_candidates,
        operator_required: summary.operator_required,
        partial_state_preservation_required: summary.partial_state_preservation_required
      })
    }),
    domain_progress: Object.freeze({
      version: domainProgress.version,
      active_count: domainProgress.active_count
    })
  });
}

export async function readDataEngineOwnerSummary(
  client: DataEngineClient,
  context?: DataEngineRequestContext
): Promise<DataEngineOwnerSummary> {
  const parsed = parseDataEngineOwnerSummary(await client.rawGet('/api/v1/owner-summary', context));
  if (!parsed)
    throw new DataEngineClientError(
      'DATA_ENGINE_CONTRACT_MISMATCH',
      'Data Engine owner summary response is malformed.'
    );
  return parsed;
}
