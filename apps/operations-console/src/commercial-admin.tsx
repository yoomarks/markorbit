import { useState, type FormEvent } from 'react';
import { Alert, Button, Card, DataList, PageHeader, StatusBadge } from '@markorbit/ui';

type JsonObject = Record<string, unknown>;
type ResourceKind = 'account' | 'catalog' | 'orders' | 'payment' | 'matters' | 'provider';

interface OperatorView {
  kind: 'INTERNAL_OPERATOR';
  userId: string;
  sessionId: string;
  capabilities: readonly string[];
  sessionExpiresAt: string;
}

interface LoadState {
  resource: ResourceKind;
  title: string;
  value: unknown;
}

function object(value: unknown): JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

async function readJson(path: string, headers: Record<string, string> = {}): Promise<unknown> {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { accept: 'application/json', ...headers }
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    const record = object(value);
    throw new Error(
      typeof record.message === 'string'
        ? record.message
        : typeof record.code === 'string'
          ? record.code
          : `Request failed with HTTP ${response.status}.`
    );
  }
  return value;
}

async function login(email: string, password: string): Promise<void> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    const record = object(value);
    throw new Error(
      typeof record.message === 'string'
        ? record.message
        : typeof record.code === 'string'
          ? record.code
          : 'Internal operator sign-in failed.'
    );
  }
}

function JsonInspection({ state }: { state: LoadState | null }) {
  if (!state) return <p>No governed resource loaded.</p>;
  const record = object(state.value);
  const source = object(record.source);
  return (
    <div aria-live="polite">
      <DataList
        items={[
          { label: 'Resource', value: state.title },
          {
            label: 'Owner domain',
            value: typeof source.domain === 'string' ? source.domain : 'Owner response'
          },
          {
            label: 'Authority',
            value: typeof source.authority === 'string' ? source.authority : 'Preserved in payload'
          }
        ]}
      />
      <details>
        <summary>Governed payload</summary>
        <pre>{JSON.stringify(state.value, null, 2)}</pre>
      </details>
    </div>
  );
}

export function CommercialAdminWorkspace() {
  const [operator, setOperator] = useState<OperatorView | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountId, setAccountId] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [state, setState] = useState<LoadState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (name: string, work: () => Promise<void>) => {
    setBusy(name);
    setError(null);
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Commercial admin request failed.');
    } finally {
      setBusy(null);
    }
  };

  const resolveOperator = () =>
    run('operator', async () => {
      const value = (await readJson('/api/internal/commercial-admin/operator')) as OperatorView;
      setOperator(value);
    });

  const signIn = (event: FormEvent) => {
    event.preventDefault();
    void run('login', async () => {
      await login(email.trim(), password);
      const value = (await readJson('/api/internal/commercial-admin/operator')) as OperatorView;
      setOperator(value);
      setPassword('');
    });
  };

  const load = (
    resource: ResourceKind,
    title: string,
    path: string,
    headers?: Record<string, string>
  ) =>
    run(resource, async () => {
      setState({ resource, title, value: await readJson(path, headers) });
    });

  const hasRead = operator?.capabilities.includes('commercial-admin:read') ?? false;
  const disabled = !hasRead || busy !== null;

  return (
    <section id="commercial-admin" aria-labelledby="commercial-admin-heading">
      <PageHeader
        title="Commercial operations"
        description="Internal owner-routed inspection for Accounts, Workspaces, Catalogue, Orders, Payments, Matters and Providers."
      />
      <Alert tone="info" title="Owner authority is preserved">
        The console does not author Account Type, Workspace Role, Product/Price, Order, Payment,
        Matter, Provider, Filing or Official Truth. Each view is loaded through its owner domain.
      </Alert>

      <div className="mo-grid">
        <Card>
          <h3 id="commercial-admin-heading">Internal operator</h3>
          {operator ? (
            <DataList
              items={[
                { label: 'Status', value: <StatusBadge status="success" /> },
                { label: 'User', value: operator.userId },
                { label: 'Capabilities', value: operator.capabilities.join(', ') || 'None' },
                { label: 'Session expires', value: operator.sessionExpiresAt }
              ]}
            />
          ) : (
            <form onSubmit={signIn}>
              <label htmlFor="commercial-admin-email">Internal operator email</label>
              <input
                id="commercial-admin-email"
                autoComplete="username"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <label htmlFor="commercial-admin-password">Password</label>
              <input
                id="commercial-admin-password"
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <Button disabled={busy !== null || !email.trim() || !password} type="submit">
                {busy === 'login' ? 'Signing in…' : 'Sign in as internal operator'}
              </Button>
              <Button disabled={busy !== null} onClick={() => void resolveOperator()} type="button">
                {busy === 'operator' ? 'Checking…' : 'Use existing session'}
              </Button>
            </form>
          )}
        </Card>

        <Card>
          <h3>Scope</h3>
          <label htmlFor="commercial-admin-workspace">Workspace ID</label>
          <input
            id="commercial-admin-workspace"
            value={workspaceId}
            onChange={(event) => setWorkspaceId(event.target.value)}
          />
          <label htmlFor="commercial-admin-customer">Customer/User ID</label>
          <input
            id="commercial-admin-customer"
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
          />
          <p>
            Workspace-scoped resources require an explicit Workspace ID. The browser value selects
            the scope only; owner services still enforce the INTERNAL operator principal.
          </p>
        </Card>
      </div>

      {error && (
        <Alert tone="critical" title="Commercial admin request failed">
          {error}
        </Alert>
      )}

      <div className="mo-grid">
        <Card>
          <h3>Accounts & Workspaces</h3>
          <label htmlFor="commercial-admin-account">User ID</label>
          <input
            id="commercial-admin-account"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          />
          <Button
            disabled={disabled || !accountId.trim()}
            onClick={() =>
              void load(
                'account',
                `Core account ${accountId.trim()}`,
                `/api/internal/commercial-admin/accounts/${encodeURIComponent(accountId.trim())}`
              )
            }
          >
            Inspect account
          </Button>
        </Card>

        <Card>
          <h3>Catalogue</h3>
          <p>Authoritative active Product/Price catalogue for MarkReg direct commercial flow.</p>
          <Button
            disabled={disabled}
            onClick={() =>
              void load(
                'catalog',
                'MarkReg commercial catalogue',
                '/api/internal/commercial-admin/catalog?channel=MARKREG_DIRECT&relationshipModel=DIRECT'
              )
            }
          >
            Load catalogue
          </Button>
        </Card>

        <Card>
          <h3>Orders</h3>
          <Button
            disabled={disabled || !workspaceId.trim()}
            onClick={() => {
              const search = new URLSearchParams({ page: '1', pageSize: '20' });
              if (customerId.trim()) search.set('customerId', customerId.trim());
              void load(
                'orders',
                `MarkReg orders for ${workspaceId.trim()}`,
                `/api/internal/commercial-admin/workspaces/${encodeURIComponent(workspaceId.trim())}/orders?${search}`
              );
            }}
          >
            Load orders
          </Button>
        </Card>

        <Card>
          <h3>Payments</h3>
          <label htmlFor="commercial-admin-payment">Payment ID</label>
          <input
            id="commercial-admin-payment"
            value={paymentId}
            onChange={(event) => setPaymentId(event.target.value)}
          />
          <Button
            disabled={disabled || !workspaceId.trim() || !paymentId.trim()}
            onClick={() =>
              void load(
                'payment',
                `Payment ${paymentId.trim()}`,
                `/api/internal/commercial-admin/payments/${encodeURIComponent(paymentId.trim())}`,
                { 'x-markorbit-workspace-id': workspaceId.trim() }
              )
            }
          >
            Inspect payment history
          </Button>
        </Card>

        <Card>
          <h3>Matters</h3>
          <Button
            disabled={disabled || !workspaceId.trim()}
            onClick={() =>
              void load(
                'matters',
                `Formal Matters for ${workspaceId.trim()}`,
                `/api/internal/commercial-admin/workspaces/${encodeURIComponent(workspaceId.trim())}/matters?page=1&pageSize=20`
              )
            }
          >
            Load matters
          </Button>
        </Card>

        <Card>
          <h3>Providers</h3>
          <label htmlFor="commercial-admin-provider">Provider ID</label>
          <input
            id="commercial-admin-provider"
            value={providerId}
            onChange={(event) => setProviderId(event.target.value)}
          />
          <Button
            disabled={disabled}
            onClick={() =>
              void load(
                'provider',
                providerId.trim() ? `Provider ${providerId.trim()}` : 'Provider Registry',
                providerId.trim()
                  ? `/api/internal/commercial-admin/providers/${encodeURIComponent(providerId.trim())}`
                  : '/api/internal/commercial-admin/providers'
              )
            }
          >
            {providerId.trim() ? 'Inspect provider' : 'Load providers'}
          </Button>
        </Card>
      </div>

      <Card>
        <h3>Governed inspection</h3>
        <JsonInspection state={state} />
      </Card>
    </section>
  );
}
