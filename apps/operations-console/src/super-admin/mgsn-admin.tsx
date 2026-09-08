import { useEffect, useState } from 'react';
import { Alert, Button, Card, DataList, PageHeader } from '@markorbit/ui';

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function text(value: unknown, fallback = 'Unavailable'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function scalar(value: unknown, fallback = 'Unavailable'): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
}

async function readOwnerJson(path: string): Promise<unknown> {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { accept: 'application/json' }
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    const record = object(value);
    throw new Error(text(record.message, text(record.code, `HTTP ${response.status}`)));
  }
  return value;
}

export async function loadMgsnProviders(): Promise<readonly JsonObject[]> {
  const value = await readOwnerJson('/api/internal/commercial-admin/providers');
  if (!Array.isArray(value)) throw new Error('MGSN Provider Registry owner contract mismatch.');
  return value.map(object);
}

export async function loadMgsnProvider(providerId: string): Promise<JsonObject> {
  const value = await readOwnerJson(
    `/api/internal/commercial-admin/providers/${encodeURIComponent(providerId)}`
  );
  const record = object(value);
  if (Object.keys(record).length === 0)
    throw new Error('MGSN Provider detail owner contract mismatch.');
  return record;
}

function ProviderDetail({ value }: { value: JsonObject | null }) {
  if (!value) return <p>Select a Provider to inspect exact owner detail.</p>;
  const source = object(value.source);
  const provider = object(value.provider);
  const supplyCapabilities = Array.isArray(value.supplyCapabilities)
    ? value.supplyCapabilities.map(object)
    : [];

  return (
    <>
      <DataList
        items={[
          { label: 'Owner domain', value: text(source.domain, 'MGSN') },
          { label: 'Owner authority', value: text(source.authority, 'PROVIDER_NETWORK') },
          { label: 'Provider ID', value: text(provider.providerId) },
          { label: 'Display name', value: text(provider.displayName) },
          { label: 'Operational status', value: text(provider.operationalStatus) },
          { label: 'Version', value: scalar(provider.version) },
          { label: 'Provider Workspace', value: text(provider.providerWorkspaceId) },
          { label: 'Updated', value: text(provider.updatedAt) },
          { label: 'Current supply capabilities', value: String(supplyCapabilities.length) }
        ]}
      />
      {supplyCapabilities.length === 0 ? (
        <p>Owner returned no current supply-capability records for this Provider.</p>
      ) : (
        <ol>
          {supplyCapabilities.map((capability, index) => (
            <li key={text(capability.providerSupplyCapabilityId, String(index))}>
              {text(capability.capabilityId, text(capability.serviceKey, 'Owner capability'))} ·{' '}
              {text(capability.status, 'Current owner record')}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

export function MgsnAdminWorkspace() {
  const [providers, setProviders] = useState<readonly JsonObject[] | null>(null);
  const [selected, setSelected] = useState<JsonObject | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      setProviders(await loadMgsnProviders());
    } catch (cause) {
      setProviders(null);
      setError(cause instanceof Error ? cause.message : 'MGSN owner read failed.');
    } finally {
      setBusy(false);
    }
  };

  const inspect = async (providerId: string) => {
    setBusy(true);
    setError(null);
    try {
      setSelected(await loadMgsnProvider(providerId));
    } catch (cause) {
      setSelected(null);
      setError(cause instanceof Error ? cause.message : 'MGSN Provider detail read failed.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <section id="super-admin-mgsn" aria-labelledby="super-admin-mgsn-heading">
      <PageHeader
        title="MGSN"
        description="Provider Registry administration read through the existing owner-routed commercial admin boundary."
      />
      <Alert tone="info" title="Provider Registry is not appointment authority">
        Provider presence, operational status and supply-capability records are MGSN owner truth
        only. Candidate, Selection, Controlled Handoff, Allocation and Provider Acceptance remain
        distinct.
      </Alert>
      {error ? (
        <Alert tone="warning" title="MGSN owner unavailable">
          {error} This is not rendered as an empty Provider Registry.
        </Alert>
      ) : null}

      <div className="mo-grid">
        <Card>
          <h3 id="super-admin-mgsn-heading">Providers</h3>
          <Button disabled={busy} onClick={() => void refresh()} type="button">
            {busy ? 'Loading…' : 'Refresh owner truth'}
          </Button>
          {providers === null ? (
            <p>Provider Registry has not been established from the owner read.</p>
          ) : providers.length === 0 ? (
            <p>MGSN owner returned a known-empty Provider Registry.</p>
          ) : (
            <ol>
              {providers.map((provider) => {
                const providerId = text(provider.providerId, '');
                return (
                  <li key={providerId || text(provider.displayName)}>
                    <strong>{text(provider.displayName, providerId || 'Provider')}</strong> ·{' '}
                    {providerId || 'Provider ID unavailable'} · {text(provider.operationalStatus)} ·
                    v{scalar(provider.version)}{' '}
                    <Button
                      disabled={busy || !providerId}
                      onClick={() => void inspect(providerId)}
                      type="button"
                    >
                      Inspect
                    </Button>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        <Card>
          <h3>Provider detail & provenance</h3>
          <ProviderDetail value={selected} />
        </Card>
      </div>

      <Alert tone="info" title="Read-only boundary">
        This surface cannot select, contact, appoint, hand off to, allocate work to or accept a
        Provider. It creates no Recommendation, Filing, Payment, execution or Official Truth
        consequence.
      </Alert>
    </section>
  );
}
