import { useEffect, useState } from 'react';
import { Alert, Button, Card, DataList, PageHeader } from '@markorbit/ui';

export type CoreAdministrationProjection = Readonly<{
  schemaVersion: 1;
  objectType: 'CORE_ADMINISTRATION_PROJECTION';
  owner: 'CORE';
  access: 'READ_ONLY';
  requiredAuthority: 'core-admin:read';
  observedAt: string;
  portfolio: Readonly<{
    availability: 'NOT_YET_MODELED';
    reason: string;
  }>;
}>;

function parseProjection(value: unknown): CoreAdministrationProjection {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Core administration owner contract mismatch.');
  const record = value as Record<string, unknown>;
  const portfolio = record.portfolio as Record<string, unknown> | undefined;
  if (
    record.schemaVersion !== 1 ||
    record.objectType !== 'CORE_ADMINISTRATION_PROJECTION' ||
    record.owner !== 'CORE' ||
    record.access !== 'READ_ONLY' ||
    record.requiredAuthority !== 'core-admin:read' ||
    typeof record.observedAt !== 'string' ||
    !Number.isFinite(Date.parse(record.observedAt)) ||
    !portfolio ||
    portfolio.availability !== 'NOT_YET_MODELED' ||
    typeof portfolio.reason !== 'string' ||
    !portfolio.reason.trim()
  )
    throw new Error('Core administration owner contract mismatch.');
  return value as CoreAdministrationProjection;
}

export async function loadCoreAdministration(): Promise<CoreAdministrationProjection> {
  const response = await fetch('/api/internal/super-admin/core', {
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

export function CoreAdminWorkspace() {
  const [projection, setProjection] = useState<CoreAdministrationProjection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      setProjection(await loadCoreAdministration());
    } catch (cause) {
      setProjection(null);
      setError(cause instanceof Error ? cause.message : 'Core owner read failed.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <section id="super-admin-core" aria-labelledby="super-admin-core-heading">
      <PageHeader
        title="Core"
        description="Read-only Core platform administration through the dedicated Core owner boundary."
      />
      <Alert tone="info" title="Core truth stays owner-scoped">
        Core administration requires the exact core-admin:read Internal Operator authority. INTERNAL
        account type, session presence, Commercial authority and Workspace authority do not
        substitute for this grant.
      </Alert>
      {error ? (
        <Alert tone="warning" title="Core owner unavailable">
          {error} This is not rendered as an empty, zero, clean or complete Core portfolio.
        </Alert>
      ) : null}
      <Card>
        <h3 id="super-admin-core-heading">Administration availability</h3>
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
            <Alert tone="warning" title="Global Core portfolio not yet modeled">
              {projection.portfolio.reason} Users, Internal Operators, Sessions, Access Control, API
              Keys, Feature Flags and Audit are not synthesized from other domain reads.
            </Alert>
          </>
        ) : (
          <p>Core administration truth has not been established from the owner read.</p>
        )}
      </Card>
      <Alert tone="info" title="Read-only boundary">
        This surface cannot reveal password hashes, raw session or API tokens, service secrets,
        arbitrary configuration or perform Core mutations. Workspace administration remains in its
        separate Core-owned Workspace surface.
      </Alert>
    </section>
  );
}
