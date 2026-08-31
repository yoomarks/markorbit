import {
  Alert,
  Button,
  Card,
  ErrorState,
  KeyValueList,
  LoadingState,
  PageHeader
} from '@markorbit/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { MarkregApp } from './App.js';
import { MarkregApiError } from './api/errors.js';
import {
  createOrderClient,
  type OrderClient,
  type OrderListView,
  type OrderView
} from './api/order.js';
import { serializeMarkregRoute } from './routing/markreg-route.js';

const PAGE_SIZE = 10;

const currentWorkspaceId = () =>
  typeof sessionStorage === 'undefined'
    ? undefined
    : (sessionStorage.getItem('markorbit-workspace-id') ?? undefined);

const orderRoute = (order: OrderView) =>
  serializeMarkregRoute({
    view: 'order',
    recordId: order.orderId,
    expectedVersion: String(order.version)
  });

const matterRoute = (order: OrderView) =>
  order.matter
    ? serializeMarkregRoute({
        view: 'formal-matter',
        recordId: order.matter.formalMatterId,
        expectedVersion: String(order.matter.formalMatterVersion)
      })
    : undefined;

type HomeState =
  | { kind: 'LOADING' }
  | { kind: 'READY'; result: OrderListView }
  | { kind: 'ERROR'; title: string; description: string; retryable: boolean };

function failure(error: unknown): Extract<HomeState, { kind: 'ERROR' }> {
  if (error instanceof MarkregApiError) {
    if (error.kind === 'offline')
      return {
        kind: 'ERROR',
        title: 'You are offline',
        description: 'Reconnect to load the durable Orders in this Workspace.',
        retryable: true
      };
    if (error.kind === 'recoverable')
      return {
        kind: 'ERROR',
        title: 'Workspace temporarily unavailable',
        description:
          'The Order service could not be reached. Existing Orders are unchanged; retry the same Workspace read.',
        retryable: true
      };
    if (error.code?.includes('PERMISSION'))
      return {
        kind: 'ERROR',
        title: 'Workspace permission required',
        description: 'Your current Workspace role cannot read these Orders.',
        retryable: false
      };
  }
  return {
    kind: 'ERROR',
    title: 'Workspace could not be loaded',
    description:
      'MarkReg could not safely load durable Order truth. This is not being treated as an empty Workspace.',
    retryable: true
  };
}

const defaultOrderClient = createOrderClient();

export function MarkregWorkspaceHome({
  client = defaultOrderClient,
  renderPlanning = () => <MarkregApp />
}: {
  client?: OrderClient;
  renderPlanning?: () => ReactNode;
}) {
  const [planning, setPlanning] = useState(false);
  const [workspaceId, setWorkspaceId] = useState(currentWorkspaceId);
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<HomeState>({ kind: 'LOADING' });

  useEffect(() => {
    let active = true;
    if (!workspaceId) {
      setState({
        kind: 'ERROR',
        title: 'Choose a Workspace',
        description:
          'A current authenticated Workspace is required before MarkReg can load Orders.',
        retryable: false
      });
      return () => {
        active = false;
      };
    }

    setState({ kind: 'LOADING' });
    void client
      .list({ page, pageSize: PAGE_SIZE })
      .then((result) => {
        if (active) setState({ kind: 'READY', result });
      })
      .catch((error: unknown) => {
        if (active) setState(failure(error));
      });

    return () => {
      active = false;
    };
  }, [client, page, reloadToken, workspaceId]);

  useEffect(() => {
    const reconcileWorkspace = () => {
      const nextWorkspaceId = currentWorkspaceId();
      if (nextWorkspaceId === workspaceId) return;
      setState({ kind: 'LOADING' });
      setPage(1);
      setWorkspaceId(nextWorkspaceId);
    };
    addEventListener('focus', reconcileWorkspace);
    addEventListener('storage', reconcileWorkspace);
    return () => {
      removeEventListener('focus', reconcileWorkspace);
      removeEventListener('storage', reconcileWorkspace);
    };
  }, [workspaceId]);

  if (planning)
    return (
      <>
        <div className="markreg-workspace-planning-nav">
          <Button variant="secondary" onClick={() => setPlanning(false)}>
            Back to Workspace
          </Button>
        </div>
        {renderPlanning()}
      </>
    );

  if (state.kind === 'LOADING')
    return (
      <main className="markreg-workspace-home" aria-label="MarkReg Workspace">
        <LoadingState label="Loading durable trademark work" />
      </main>
    );

  if (state.kind === 'ERROR')
    return (
      <main className="markreg-workspace-home" aria-label="MarkReg Workspace">
        <PageHeader
          title="Trademark Workspace"
          description="Orders and linked Matters are loaded from durable Workspace truth."
        />
        <ErrorState
          title={state.title}
          description={state.description}
          {...(state.retryable ? { onRetry: () => setReloadToken((value) => value + 1) } : {})}
        />
      </main>
    );

  const { result } = state;
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <main className="markreg-workspace-home" aria-label="MarkReg Workspace">
      <PageHeader
        title="Trademark Workspace"
        description="Track durable service Orders and linked Formal Matters. Planning a new filing remains a separate fixture-only consultation until its production gates are complete."
      />
      <Alert tone="warning" title="Authority boundary">
        Order ≠ Matter ≠ Payment ≠ Invoice ≠ Filing. A linked Formal Matter does not mean an
        external filing has occurred.
      </Alert>
      <div className="markreg-workspace-primary-actions">
        <Button onClick={() => setPlanning(true)}>Plan a new filing</Button>
      </div>

      {result.items.length === 0 ? (
        <Card>
          <h2>No service Orders yet</h2>
          <p>
            This Workspace has no durable Orders. You can start a planning-only consultation without
            creating an Order, Payment, Matter, or Filing.
          </p>
          <Button onClick={() => setPlanning(true)}>Plan a new filing</Button>
        </Card>
      ) : (
        <section className="markreg-workspace-list" aria-labelledby="workspace-orders-heading">
          <h2 id="workspace-orders-heading">Service Orders</h2>
          {result.items.map((order) => {
            const linkedMatterRoute = matterRoute(order);
            return (
              <Card key={order.orderId}>
                <KeyValueList
                  items={[
                    { key: 'Order ID', value: order.orderId },
                    { key: 'Status', value: order.status },
                    { key: 'Version', value: order.version },
                    { key: 'Updated', value: order.updatedAt },
                    {
                      key: 'Formal Matter',
                      value: order.matter
                        ? `${order.matter.formalMatterId} · version ${order.matter.formalMatterVersion}`
                        : 'Not created'
                    }
                  ]}
                />
                <div className="markreg-workspace-order-actions">
                  <a href={orderRoute(order)}>Open Order</a>
                  {linkedMatterRoute && <a href={linkedMatterRoute}>Open Formal Matter</a>}
                </div>
              </Card>
            );
          })}
        </section>
      )}

      {result.total > result.pageSize && (
        <nav className="markreg-workspace-pagination" aria-label="Order pages">
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            Previous
          </Button>
          <span>
            Page {result.page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
          >
            Next
          </Button>
        </nav>
      )}
    </main>
  );
}
