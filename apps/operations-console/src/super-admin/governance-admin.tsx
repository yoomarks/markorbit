import { useEffect, useState } from 'react';
import { Alert, Button, Card, DataList, PageHeader } from '@markorbit/ui';

export type GovernanceAdministrationProjection = Readonly<{
  schemaVersion: 1;
  objectType: 'GOVERNANCE_ADMINISTRATION_PROJECTION';
  owner: 'CORE_CONTROL_PLANE';
  access: 'READ_ONLY';
  requiredAuthority: 'governance-admin:read';
  observedAt: string;
  portfolio: Readonly<{
    availability: 'NOT_YET_MODELED';
    reason: string;
  }>;
}>;

function parseProjection(value: unknown): GovernanceAdministrationProjection {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Governance administration owner contract mismatch.');
  const record = value as Record<string, unknown>;
  const portfolio = record.portfolio as Record<string, unknown> | undefined;
  if (
    record.schemaVersion !== 1 ||
    record.objectType !== 'GOVERNANCE_ADMINISTRATION_PROJECTION' ||
    record.owner !== 'CORE_CONTROL_PLANE' ||
    record.access !== 'READ_ONLY' ||
    record.requiredAuthority !== 'governance-admin:read' ||
    typeof record.observedAt !== 'string' ||
    !Number.isFinite(Date.parse(record.observedAt)) ||
    !portfolio ||
    portfolio.availability !== 'NOT_YET_MODELED' ||
    typeof portfolio.reason !== 'string' ||
    !portfolio.reason.trim()
  )
    throw new Error('Governance administration owner contract mismatch.');
  return value as GovernanceAdministrationProjection;
}

export async function loadGovernanceAdministration(): Promise<GovernanceAdministrationProjection> {
  const response = await fetch('/api/internal/super-admin/governance', {
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

export function GovernanceAdminWorkspace() {
  const [projection, setProjection] = useState<GovernanceAdministrationProjection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      setProjection(await loadGovernanceAdministration());
    } catch (cause) {
      setProjection(null);
      setError(cause instanceof Error ? cause.message : 'Governance owner read failed.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <section id="super-admin-governance" aria-labelledby="super-admin-governance-heading">
      <PageHeader
        title="Governance & Audit"
        description="Read-only Governance administration through the dedicated Core control-plane owner boundary."
      />
      <Alert tone="info" title="Governance truth stays owner-scoped">
        Governance administration does not merge owner-specific audit or provenance into synthetic
        platform completeness, cleanliness, causality, business correctness, legal correctness or
        Official Truth.
      </Alert>
      {error ? (
        <Alert tone="warning" title="Governance owner unavailable">
          {error} This is not rendered as an empty, complete, clean or no-risk Governance portfolio.
        </Alert>
      ) : null}
      <Card>
        <h3 id="super-admin-governance-heading">Administration availability</h3>
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
                { label: 'Cross-owner portfolio', value: projection.portfolio.availability }
              ]}
            />
            <Alert
              tone="warning"
              title="Cross-owner Governance and Audit portfolio not yet modeled"
            >
              {projection.portfolio.reason} Absence of a global audit index is not evidence of no
              activity, no risk or complete governance coverage.
            </Alert>
          </>
        ) : (
          <p>Governance administration truth has not been established from the owner read.</p>
        )}
      </Card>
      <Alert tone="info" title="Read-only boundary">
        This surface cannot delete or edit audit evidence, approve governed actions, expose raw
        secrets or tokens, or perform cross-owner mutations.
      </Alert>
    </section>
  );
}
