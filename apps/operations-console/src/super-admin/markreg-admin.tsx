import { useState } from 'react';
import { Alert, Button, Card, DataList, PageHeader } from '@markorbit/ui';

type JsonObject = Record<string, unknown>;
type OwnerResource = 'catalogue' | 'orders' | 'matters';

type OwnerState = {
  resource: OwnerResource;
  title: string;
  value: unknown;
} | null;

function object(value: unknown): JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

async function readOwner(path: string): Promise<unknown> {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { accept: 'application/json' }
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    const record = object(value);
    throw new Error(
      typeof record.message === 'string'
        ? record.message
        : typeof record.code === 'string'
          ? record.code
          : `MarkReg owner read failed with HTTP ${response.status}.`
    );
  }
  return value;
}

export const loadMarkRegCatalogue = () =>
  readOwner(
    '/api/internal/commercial-admin/catalog?channel=MARKREG_DIRECT&relationshipModel=DIRECT'
  );

export const loadMarkRegOrders = (workspaceId: string) =>
  readOwner(
    `/api/internal/commercial-admin/workspaces/${encodeURIComponent(workspaceId)}/orders?page=1&pageSize=20`
  );

export const loadMarkRegMatters = (workspaceId: string) =>
  readOwner(
    `/api/internal/commercial-admin/workspaces/${encodeURIComponent(workspaceId)}/matters?page=1&pageSize=20`
  );

function describeCount(value: unknown): string {
  if (Array.isArray(value)) return String(value.length);
  const record = object(value);
  if (typeof record.total === 'number') return String(record.total);
  if (Array.isArray(record.items)) return String(record.items.length);
  return 'Unavailable';
}

export function MarkRegAdminWorkspace() {
  const [workspaceId, setWorkspaceId] = useState('');
  const [state, setState] = useState<OwnerState>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (resource: OwnerResource, title: string, work: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      setState({ resource, title, value: await work() });
    } catch (cause) {
      setState(null);
      setError(cause instanceof Error ? cause.message : 'MarkReg owner read failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="super-admin-markreg" aria-labelledby="super-admin-markreg-heading">
      <PageHeader
        title="MarkReg"
        description="Bounded commercial/admin inspection over existing owner-routed catalogue, Order and Formal Matter reads."
      />
      <Alert tone="info" title="Workspace scope is not authority">
        Catalogue is a MarkReg direct commercial owner read. Orders and Formal Matters remain
        Workspace-scoped; the entered Workspace ID selects scope only and does not grant authority.
      </Alert>
      {error ? (
        <Alert tone="warning" title="MarkReg owner unavailable">
          {error} This is not treated as an empty owner result.
        </Alert>
      ) : null}
      <div className="mo-grid">
        <Card>
          <h3 id="super-admin-markreg-heading">Catalogue / Services & Pricing</h3>
          <Button
            disabled={busy}
            onClick={() => void run('catalogue', 'MarkReg direct catalogue', loadMarkRegCatalogue)}
            type="button"
          >
            Load owner catalogue
          </Button>
          <p>
            Product/Price catalogue is not a Quote, entitlement, paid-state or Filing instruction.
          </p>
        </Card>
        <Card>
          <h3>Workspace-scoped inspection</h3>
          <label htmlFor="super-admin-markreg-workspace">Workspace ID</label>
          <input
            id="super-admin-markreg-workspace"
            value={workspaceId}
            onChange={(event) => setWorkspaceId(event.target.value)}
          />
          <Button
            disabled={busy || !workspaceId.trim()}
            onClick={() =>
              void run('orders', `Orders for ${workspaceId.trim()}`, () =>
                loadMarkRegOrders(workspaceId.trim())
              )
            }
            type="button"
          >
            Load Orders
          </Button>
          <Button
            disabled={busy || !workspaceId.trim()}
            onClick={() =>
              void run('matters', `Formal Matters for ${workspaceId.trim()}`, () =>
                loadMarkRegMatters(workspaceId.trim())
              )
            }
            type="button"
          >
            Load Formal Matters
          </Button>
        </Card>
      </div>
      <Card>
        <h3>Owner result & lineage</h3>
        {state ? (
          <>
            <DataList
              items={[
                { label: 'Resource', value: state.title },
                { label: 'Owner-reported count', value: describeCount(state.value) }
              ]}
            />
            <details>
              <summary>Governed owner payload</summary>
              <pre>{JSON.stringify(state.value, null, 2)}</pre>
            </details>
          </>
        ) : (
          <p>No MarkReg owner resource loaded. Not loaded is not empty.</p>
        )}
      </Card>
      <Alert tone="info" title="Read-only semantic boundary">
        Order is not Payment and not Formal Matter. Formal Matter lifecycle is not Filing
        Submission, Office action or Official Truth unless exact owner evidence establishes it. No
        create, edit, cancel, refund, filing, provider or payment mutation is exposed here.
      </Alert>
    </section>
  );
}
