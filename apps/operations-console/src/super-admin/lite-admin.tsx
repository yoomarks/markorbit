import { useEffect, useState } from 'react';
import { Alert, Button, Card, DataList, PageHeader } from '@markorbit/ui';

export type LiteAdministrationProjection = Readonly<{
  schemaVersion: 1;
  objectType: 'LITE_ADMINISTRATION_PROJECTION';
  owner: 'LITE';
  access: 'READ_ONLY';
  requiredAuthority: 'lite-admin:read';
  observedAt: string;
  portfolio: Readonly<{
    availability: 'NOT_YET_MODELED';
    reason: string;
  }>;
}>;

function parseProjection(value: unknown): LiteAdministrationProjection {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Lite administration owner contract mismatch.');
  const record = value as Record<string, unknown>;
  const portfolio = record.portfolio as Record<string, unknown> | undefined;
  if (
    record.schemaVersion !== 1 ||
    record.objectType !== 'LITE_ADMINISTRATION_PROJECTION' ||
    record.owner !== 'LITE' ||
    record.access !== 'READ_ONLY' ||
    record.requiredAuthority !== 'lite-admin:read' ||
    typeof record.observedAt !== 'string' ||
    !Number.isFinite(Date.parse(record.observedAt)) ||
    !portfolio ||
    portfolio.availability !== 'NOT_YET_MODELED' ||
    typeof portfolio.reason !== 'string' ||
    !portfolio.reason.trim()
  )
    throw new Error('Lite administration owner contract mismatch.');
  return value as LiteAdministrationProjection;
}

export async function loadLiteAdministration(): Promise<LiteAdministrationProjection> {
  const response = await fetch('/api/internal/super-admin/lite', {
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

export function LiteAdminWorkspace() {
  const [projection, setProjection] = useState<LiteAdministrationProjection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      setProjection(await loadLiteAdministration());
    } catch (cause) {
      setProjection(null);
      setError(cause instanceof Error ? cause.message : 'Lite owner read failed.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <section id="super-admin-lite" aria-labelledby="super-admin-lite-heading">
      <PageHeader
        title="Lite"
        description="Read-only Lite platform administration through the dedicated owner-routed boundary."
      />
      <Alert tone="info" title="Lite truth stays owner-scoped">
        Lite product state is not Core Workspace truth, Commercial entitlement or payment truth,
        legal truth, Filing state or Official Truth. Creative and AI output is not promoted across
        those authority boundaries.
      </Alert>
      {error ? (
        <Alert tone="warning" title="Lite owner unavailable">
          {error} This is not rendered as an empty, healthy or zero Lite portfolio.
        </Alert>
      ) : null}
      <Card>
        <h3 id="super-admin-lite-heading">Administration availability</h3>
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
            <Alert tone="warning" title="Global Lite portfolio not yet modeled">
              {projection.portfolio.reason} No Workspace count, feature entitlement, quota, usage,
              Trading state or AI artifact count is inferred from customer-facing Lite routes.
            </Alert>
          </>
        ) : (
          <p>Lite administration truth has not been established from the owner read.</p>
        )}
      </Card>
      <Alert tone="info" title="Read-only boundary">
        This surface cannot enable or disable Lite modules, override quota, mutate assets, trigger
        AI work, change Trading disposition, publish content or perform external actions.
      </Alert>
    </section>
  );
}
