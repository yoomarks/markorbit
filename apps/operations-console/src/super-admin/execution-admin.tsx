import { useEffect, useState } from 'react';
import { Alert, Button, Card, DataList, PageHeader } from '@markorbit/ui';

export type ExecutionAdministrationProjection = Readonly<{
  schemaVersion: 1;
  objectType: 'EXECUTION_ADMINISTRATION_PROJECTION';
  owner: 'EXECUTION';
  access: 'READ_ONLY';
  requiredAuthority: 'execution-admin:read';
  observedAt: string;
  portfolio: Readonly<{
    availability: 'NOT_YET_MODELED';
    reason: string;
  }>;
}>;

function parseProjection(value: unknown): ExecutionAdministrationProjection {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Execution administration owner contract mismatch.');
  const record = value as Record<string, unknown>;
  const portfolio = record.portfolio as Record<string, unknown> | undefined;
  if (
    record.schemaVersion !== 1 ||
    record.objectType !== 'EXECUTION_ADMINISTRATION_PROJECTION' ||
    record.owner !== 'EXECUTION' ||
    record.access !== 'READ_ONLY' ||
    record.requiredAuthority !== 'execution-admin:read' ||
    typeof record.observedAt !== 'string' ||
    !Number.isFinite(Date.parse(record.observedAt)) ||
    !portfolio ||
    portfolio.availability !== 'NOT_YET_MODELED' ||
    typeof portfolio.reason !== 'string' ||
    !portfolio.reason.trim()
  )
    throw new Error('Execution administration owner contract mismatch.');
  return value as ExecutionAdministrationProjection;
}

export async function loadExecutionAdministration(): Promise<ExecutionAdministrationProjection> {
  const response = await fetch('/api/internal/super-admin/execution', {
    credentials: 'include',
    headers: { accept: 'application/json' }
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    const record =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    const message = typeof record.message === 'string' ? record.message : undefined;
    const code = typeof record.code === 'string' ? record.code : undefined;
    throw new Error(message ?? code ?? `HTTP ${response.status}`);
  }
  return parseProjection(value);
}

export function ExecutionAdminWorkspace() {
  const [projection, setProjection] = useState<ExecutionAdministrationProjection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      setProjection(await loadExecutionAdministration());
    } catch (cause) {
      setProjection(null);
      setError(cause instanceof Error ? cause.message : 'Execution owner read failed.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <section id="super-admin-execution" aria-labelledby="super-admin-execution-heading">
      <PageHeader
        title="Execution"
        description="Read-only Execution platform administration through the dedicated owner-routed boundary."
      />
      <Alert tone="info" title="Execution truth stays owner-scoped">
        Execution state remains distinct from Workspace authority, provider
        Selection/Handoff/Allocation/Acceptance, legal correctness, Filing success and Official
        Truth.
      </Alert>
      {error ? (
        <Alert tone="warning" title="Execution owner unavailable">
          {error} This is not rendered as an empty, healthy or zero Execution portfolio.
        </Alert>
      ) : null}
      <Card>
        <h3 id="super-admin-execution-heading">Administration availability</h3>
        <Button disabled={busy} onClick={() => void refresh()} type="button">
          {busy ? 'Loading…' : 'Refresh owner truth'}
        </Button>
        {projection ? (
          <>
            <DataList
              items={[
                { label: 'Owner', value: projection.owner },
                { label: 'Authority', value: projection.requiredAuthority },
                { label: 'Access', value: projection.access },
                { label: 'Observed at', value: projection.observedAt },
                { label: 'Global portfolio', value: projection.portfolio.availability }
              ]}
            />
            <Alert tone="warning" title="Global Execution portfolio not yet modeled">
              {projection.portfolio.reason} No authorization, release, task, retry, readiness or
              provider-execution count is inferred from Workspace-scoped execution routes.
            </Alert>
          </>
        ) : (
          <p>Execution administration truth has not been established from the owner read.</p>
        )}
      </Card>
      <Alert tone="info" title="Read-only boundary">
        This surface cannot release, withdraw, assign, retry, authorize filing, validate, decide
        reviews or perform external execution actions.
      </Alert>
    </section>
  );
}
