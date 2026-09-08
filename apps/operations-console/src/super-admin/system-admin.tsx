import { useEffect, useState } from 'react';
import { Alert, Button, Card, DataList, PageHeader } from '@markorbit/ui';

export type SystemAdministrationProjection = Readonly<{
  schemaVersion: 1;
  objectType: 'SYSTEM_ADMINISTRATION_PROJECTION';
  owner: 'CORE_CONTROL_PLANE';
  access: 'READ_ONLY';
  requiredAuthority: 'system-admin:read';
  observedAt: string;
  portfolio: Readonly<{
    availability: 'NOT_YET_MODELED';
    reason: string;
  }>;
}>;

function parseProjection(value: unknown): SystemAdministrationProjection {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('System administration owner contract mismatch.');
  const record = value as Record<string, unknown>;
  const portfolio = record.portfolio as Record<string, unknown> | undefined;
  if (
    record.schemaVersion !== 1 ||
    record.objectType !== 'SYSTEM_ADMINISTRATION_PROJECTION' ||
    record.owner !== 'CORE_CONTROL_PLANE' ||
    record.access !== 'READ_ONLY' ||
    record.requiredAuthority !== 'system-admin:read' ||
    typeof record.observedAt !== 'string' ||
    !Number.isFinite(Date.parse(record.observedAt)) ||
    !portfolio ||
    portfolio.availability !== 'NOT_YET_MODELED' ||
    typeof portfolio.reason !== 'string' ||
    !portfolio.reason.trim()
  )
    throw new Error('System administration owner contract mismatch.');
  return value as SystemAdministrationProjection;
}

export async function loadSystemAdministration(): Promise<SystemAdministrationProjection> {
  const response = await fetch('/api/internal/super-admin/system', {
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

export function SystemAdminWorkspace() {
  const [projection, setProjection] = useState<SystemAdministrationProjection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      setProjection(await loadSystemAdministration());
    } catch (cause) {
      setProjection(null);
      setError(cause instanceof Error ? cause.message : 'System owner read failed.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <section id="super-admin-system" aria-labelledby="super-admin-system-heading">
      <PageHeader
        title="System"
        description="Read-only System platform administration through the dedicated Core control-plane owner boundary."
      />
      <Alert tone="info" title="System truth stays owner-scoped">
        System administration does not promote HTTP reachability into readiness, correctness,
        business health, domain owner truth, legal truth or Official Truth.
      </Alert>
      {error ? (
        <Alert tone="warning" title="System owner unavailable">
          {error} This is not rendered as an empty, healthy or zero System portfolio.
        </Alert>
      ) : null}
      <Card>
        <h3 id="super-admin-system-heading">Administration availability</h3>
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
            <Alert tone="warning" title="Global System portfolio not yet modeled">
              {projection.portfolio.reason} No platform health score, incident count or readiness
              state is inferred from generic per-service health reachability.
            </Alert>
          </>
        ) : (
          <p>System administration truth has not been established from the owner read.</p>
        )}
      </Card>
      <Alert tone="info" title="Read-only boundary">
        This surface cannot reveal secrets, edit configuration, restart processes, deploy services
        or perform infrastructure mutations.
      </Alert>
    </section>
  );
}
