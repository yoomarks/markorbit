import { useEffect, useState } from 'react';
import { Alert, Button, Card, DataList, PageHeader } from '@markorbit/ui';

export type KnowledgeAdministrationProjection = Readonly<{
  schemaVersion: 1;
  objectType: 'KNOWLEDGE_PLATFORM_ADMINISTRATION_OWNER_RESULT';
  owner: 'KNOWLEDGE';
  access: 'READ_ONLY';
  requiredUpstreamAuthority: 'control-plane:knowledge:read';
  observedAt: string;
  portfolio: Readonly<{
    availability: 'NOT_YET_MODELED';
    reason: string;
  }>;
}>;

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function parseKnowledgeAdministration(value: unknown): KnowledgeAdministrationProjection {
  const record = object(value);
  const portfolio = object(record?.portfolio);
  if (
    !record ||
    !portfolio ||
    record.schemaVersion !== 1 ||
    record.objectType !== 'KNOWLEDGE_PLATFORM_ADMINISTRATION_OWNER_RESULT' ||
    record.owner !== 'KNOWLEDGE' ||
    record.access !== 'READ_ONLY' ||
    record.requiredUpstreamAuthority !== 'control-plane:knowledge:read' ||
    typeof record.observedAt !== 'string' ||
    !Number.isFinite(Date.parse(record.observedAt)) ||
    portfolio.availability !== 'NOT_YET_MODELED' ||
    typeof portfolio.reason !== 'string' ||
    !portfolio.reason.trim()
  )
    throw new Error('Knowledge administration owner contract mismatch.');

  return Object.freeze({
    schemaVersion: 1,
    objectType: 'KNOWLEDGE_PLATFORM_ADMINISTRATION_OWNER_RESULT',
    owner: 'KNOWLEDGE',
    access: 'READ_ONLY',
    requiredUpstreamAuthority: 'control-plane:knowledge:read',
    observedAt: record.observedAt,
    portfolio: Object.freeze({
      availability: 'NOT_YET_MODELED',
      reason: portfolio.reason
    })
  });
}

export async function loadKnowledgeAdministration(
  fetchImpl: typeof fetch = fetch
): Promise<KnowledgeAdministrationProjection> {
  const response = await fetchImpl('/api/internal/super-admin/knowledge', {
    credentials: 'include',
    headers: { accept: 'application/json' }
  });
  const value: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const failure = object(value) ?? {};
    const message = typeof failure.message === 'string' ? failure.message : undefined;
    const code = typeof failure.code === 'string' ? failure.code : undefined;
    throw new Error(message ?? code ?? `HTTP ${response.status}`);
  }
  return parseKnowledgeAdministration(value);
}

export const KNOWLEDGE_ADMIN_BOUNDARY_TEXT =
  'Platform availability is Knowledge owner truth only. It is not legal sufficiency, source authority ranking, Recommendation, product readiness, Workspace evidence-supply health, or Official Truth.';

export function KnowledgeAdminWorkspace() {
  const [projection, setProjection] = useState<KnowledgeAdministrationProjection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      setProjection(await loadKnowledgeAdministration());
    } catch (cause) {
      setProjection(null);
      setError(cause instanceof Error ? cause.message : 'Knowledge owner read failed.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <section id="super-admin-knowledge" aria-labelledby="super-admin-knowledge-heading">
      <PageHeader
        title="Knowledge"
        description="Platform-level, bounded read-only Knowledge administration through the dedicated owner route."
      />
      <Alert tone="info" title="Knowledge truth stays owner-scoped">
        {KNOWLEDGE_ADMIN_BOUNDARY_TEXT} A selected Workspace is not platform scope.
      </Alert>
      {error ? (
        <Alert tone="warning" title="Knowledge owner unavailable">
          {error} Unavailable is not rendered as an empty, healthy, zero or complete Knowledge
          portfolio.
        </Alert>
      ) : null}
      <Card>
        <h3 id="super-admin-knowledge-heading">Administration availability</h3>
        <Button disabled={busy} onClick={() => void refresh()} type="button">
          {busy ? 'Loading…' : 'Refresh owner truth'}
        </Button>
        {projection ? (
          <>
            <DataList
              items={[
                { label: 'Owner', value: projection.owner },
                { label: 'Authority', value: projection.requiredUpstreamAuthority },
                { label: 'Access', value: projection.access },
                { label: 'Observed at', value: projection.observedAt },
                { label: 'Platform portfolio', value: projection.portfolio.availability }
              ]}
            />
            <Alert tone="warning" title="Global Knowledge portfolio not yet modeled">
              {projection.portfolio.reason} Current canonical Evidence Supply Health remains
              Workspace-scoped. No Workspace fan-out, source count, job count, health score,
              coverage total or freshness summary is synthesized here.
            </Alert>
          </>
        ) : (
          <p>
            Knowledge platform administration truth has not been established from the owner read.
          </p>
        )}
      </Card>
      <Alert tone="info" title="Read-only boundary">
        This surface cannot enable or disable sources, trigger acquisition, change connector
        configuration, retry jobs, mutate documents, promote or publish evidence, or perform
        external actions. Deeper Workspace-scoped evidence inspection remains a separate owner
        surface.
      </Alert>
    </section>
  );
}
