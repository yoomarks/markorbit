import { useEffect, useState } from 'react';
import { Alert, Card, DataList, PageHeader } from '@markorbit/ui';

export const DATA_PLATFORM_UNAVAILABLE_TEXT =
  'Unavailable is not the same as healthy, empty, zero, or no active work. No fallback state is inferred.';
export const DATA_PLATFORM_BOUNDARY_TEXT =
  'No job, run, file, error, subtask, ETA or next-action detail is exposed here. This is a Data Engine owner-local operational summary, not MO platform-wide health, product readiness, Recommendation, legal conclusion or Official Truth. Specialist Data Engine Admin remains authoritative for deeper owner operations.';

export interface DataOwnerSummary {
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

function timestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/(?:Z|[+-]\d{2}:\d{2})$/u.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

function stateCounts(value: unknown): Readonly<Record<string, number>> | undefined {
  const source = record(value);
  if (!source) return undefined;
  if (
    Object.entries(source).some(
      ([key, count]) => key.trim().length === 0 || !nonNegativeSafeInteger(count)
    )
  )
    return undefined;
  return Object.freeze({ ...(source as Record<string, number>) });
}

export function parseDataOwnerSummary(value: unknown): DataOwnerSummary | undefined {
  const source = record(value);
  const health = record(source?.health);
  const operations = record(source?.operations);
  const summary = record(operations?.summary);
  const domainProgress = record(source?.domain_progress);
  const counts = stateCounts(summary?.state_counts);

  if (
    !source ||
    source.contract_version !== 'MARKORBIT_DATA_ENGINE_INTEGRATION_V1' ||
    !nonEmptyString(source.engine_version) ||
    source.source_owner !== 'MARKORBIT_DATA_ENGINE' ||
    source.authority !== 'DATA_ENGINE_FACT_READ_MODEL' ||
    source.read_only !== true ||
    !timestamp(source.generated_at) ||
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
    contract_version: 'MARKORBIT_DATA_ENGINE_INTEGRATION_V1',
    engine_version: source.engine_version,
    source_owner: 'MARKORBIT_DATA_ENGINE',
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

export async function loadDataOwnerSummary(
  fetchImpl: typeof fetch = fetch
): Promise<DataOwnerSummary> {
  const response = await fetchImpl('/api/internal/control-plane/data/summary', {
    method: 'GET',
    credentials: 'include',
    headers: { accept: 'application/json' }
  });
  const value: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const failure = record(value);
    const code = typeof failure?.code === 'string' ? ` · ${failure.code}` : '';
    throw new Error(`Data owner summary unavailable (${response.status}${code}).`);
  }
  const parsed = parseDataOwnerSummary(value);
  if (!parsed) throw new Error('Data owner summary is malformed and cannot be trusted.');
  return parsed;
}

function stateCountLabel(counts: Readonly<Record<string, number>>): string {
  const entries = Object.entries(counts).sort(([left], [right]) => left.localeCompare(right));
  return entries.length
    ? entries.map(([state, count]) => `${state}: ${count}`).join(' · ')
    : 'Owner reports no state-count entries';
}

export function DataPlatformWorkspace() {
  const [summary, setSummary] = useState<DataOwnerSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void loadDataOwnerSummary()
      .then((value) => {
        if (!active) return;
        setSummary(value);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setSummary(null);
        setError(cause instanceof Error ? cause.message : 'Data owner summary is unavailable.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section id="data-platform">
      <PageHeader
        title="Data"
        description="Bounded read-only Data Engine owner summary. Owner truth remains in Data Engine; this surface does not reconstruct specialist operational detail."
      />

      {loading && (
        <Alert tone="info" title="Loading Data Engine owner summary">
          Reading the bounded owner projection through the governed Data Control Plane route.
        </Alert>
      )}

      {!loading && error && (
        <Alert tone="warning" title="Data owner summary unavailable">
          {error} {DATA_PLATFORM_UNAVAILABLE_TEXT}
        </Alert>
      )}

      {!loading && summary && (
        <>
          <Alert tone="info" title="Data Engine owner-reported dependency health">
            Owner-reported status: <strong>{summary.health.status}</strong>. This status is scoped
            only to the Data Engine dependencies represented by its owner projection; it is not an
            MO platform health score.
          </Alert>

          <div className="mo-grid" style={{ overflowWrap: 'anywhere' }}>
            <Card>
              <h2>Owner and currentness</h2>
              <DataList
                items={[
                  { label: 'Source owner', value: summary.source_owner },
                  { label: 'Authority', value: summary.authority },
                  { label: 'Contract', value: summary.contract_version },
                  { label: 'Engine version', value: summary.engine_version },
                  { label: 'Read only', value: 'Yes' },
                  {
                    label: 'Owner sample generated at',
                    value: new Date(summary.generated_at).toLocaleString()
                  },
                  {
                    label: 'Currentness',
                    value: 'Owner-generated sample time only · no Control Center freshness SLA'
                  }
                ]}
              />
            </Card>

            <Card>
              <h2>Operations aggregate</h2>
              <DataList
                items={[
                  { label: 'Operations version', value: summary.operations.version },
                  { label: 'Action authority', value: summary.operations.action_authority },
                  {
                    label: 'Operation count',
                    value: String(summary.operations.summary.operation_count)
                  },
                  {
                    label: 'State counts',
                    value: stateCountLabel(summary.operations.summary.state_counts)
                  },
                  {
                    label: 'Resume candidates',
                    value: String(summary.operations.summary.resume_candidates)
                  },
                  {
                    label: 'Retry candidates',
                    value: String(summary.operations.summary.retry_candidates)
                  },
                  {
                    label: 'Operator required',
                    value: String(summary.operations.summary.operator_required)
                  },
                  {
                    label: 'Partial-state preservation required',
                    value: String(summary.operations.summary.partial_state_preservation_required)
                  }
                ]}
              />
            </Card>

            <Card>
              <h2>Domain progress aggregate</h2>
              <DataList
                items={[
                  { label: 'Progress version', value: summary.domain_progress.version },
                  { label: 'Active count', value: String(summary.domain_progress.active_count) }
                ]}
              />
            </Card>

            <Card>
              <h2>Boundary</h2>
              <p>{DATA_PLATFORM_BOUNDARY_TEXT}</p>
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
