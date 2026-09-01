import type { FormalMatterListQuery, FormalMatterListResponse } from '@markorbit/contracts';
import {
  Alert,
  Button,
  Card,
  ErrorState,
  KeyValueList,
  LoadingState,
  PageHeader,
  Select,
  TextInput
} from '@markorbit/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { MarkregApp } from './App.js';
import { MarkregApiError } from './api/errors.js';
import { createFormalMatterListClient, type FormalMatterListClient } from './api/formal-matter.js';
import {
  createOrderClient,
  type OrderClient,
  type OrderListView,
  type OrderView
} from './api/order.js';
import { serializeMarkregRoute } from './routing/markreg-route.js';

const PAGE_SIZE = 10;

type MatterFilters = Pick<
  FormalMatterListQuery,
  'search' | 'status' | 'type' | 'createdFrom' | 'createdTo'
>;

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

const linkedMatterRoute = (order: OrderView) =>
  order.matter
    ? serializeMarkregRoute({
        view: 'formal-matter',
        recordId: order.matter.formalMatterId,
        expectedVersion: String(order.matter.formalMatterVersion)
      })
    : undefined;

type FormalMatterListItem = FormalMatterListResponse['items'][number];

const formalMatterRoute = (matter: FormalMatterListItem) =>
  serializeMarkregRoute({
    view: 'formal-matter',
    recordId: matter.formalMatterId,
    expectedVersion: String(matter.version)
  });

type CollectionState<T> =
  | { kind: 'LOADING' }
  | { kind: 'READY'; result: T }
  | { kind: 'ERROR'; title: string; description: string; retryable: boolean };

function failure<T>(
  error: unknown,
  subject: string
): Extract<CollectionState<T>, { kind: 'ERROR' }> {
  if (error instanceof MarkregApiError) {
    if (error.kind === 'offline')
      return {
        kind: 'ERROR',
        title: 'You are offline',
        description: `Reconnect to load durable ${subject} in this Workspace.`,
        retryable: true
      };
    if (error.kind === 'recoverable')
      return {
        kind: 'ERROR',
        title: `${subject} temporarily unavailable`,
        description: `The ${subject} read could not be completed. Existing durable records are unchanged; retry the same Workspace read.`,
        retryable: true
      };
    if (error.code?.includes('PERMISSION'))
      return {
        kind: 'ERROR',
        title: 'Workspace permission required',
        description: `Your current Workspace role cannot read ${subject}.`,
        retryable: false
      };
  }
  return {
    kind: 'ERROR',
    title: `${subject} could not be loaded`,
    description: `MarkReg could not safely load durable ${subject}. This failure is not being treated as an empty collection.`,
    retryable: true
  };
}

function hasMatterFilters(filters: MatterFilters): boolean {
  return Boolean(
    filters.search || filters.status || filters.type || filters.createdFrom || filters.createdTo
  );
}

const defaultOrderClient = createOrderClient();
const defaultMatterClient = createFormalMatterListClient();

export function MarkregWorkspaceHome({
  client = defaultOrderClient,
  matterClient = defaultMatterClient,
  renderPlanning = () => <MarkregApp />
}: {
  client?: OrderClient;
  matterClient?: FormalMatterListClient;
  renderPlanning?: () => ReactNode;
}) {
  const [planning, setPlanning] = useState(false);
  const [workspaceId, setWorkspaceId] = useState(currentWorkspaceId);
  const [orderPage, setOrderPage] = useState(1);
  const [matterPage, setMatterPage] = useState(1);
  const [matterSearchDraft, setMatterSearchDraft] = useState('');
  const [matterStatusDraft, setMatterStatusDraft] = useState('');
  const [matterTypeDraft, setMatterTypeDraft] = useState('');
  const [matterCreatedFromDraft, setMatterCreatedFromDraft] = useState('');
  const [matterCreatedToDraft, setMatterCreatedToDraft] = useState('');
  const [matterFilterError, setMatterFilterError] = useState('');
  const [matterFilters, setMatterFilters] = useState<MatterFilters>({});
  const [orderReloadToken, setOrderReloadToken] = useState(0);
  const [matterReloadToken, setMatterReloadToken] = useState(0);
  const [orderState, setOrderState] = useState<CollectionState<OrderListView>>({
    kind: 'LOADING'
  });
  const [matterState, setMatterState] = useState<CollectionState<FormalMatterListResponse>>({
    kind: 'LOADING'
  });

  useEffect(() => {
    let active = true;
    if (!workspaceId)
      return () => {
        active = false;
      };

    setOrderState({ kind: 'LOADING' });
    void client
      .list({ page: orderPage, pageSize: PAGE_SIZE })
      .then((result) => {
        if (active) setOrderState({ kind: 'READY', result });
      })
      .catch((error: unknown) => {
        if (active) setOrderState(failure(error, 'Service Orders'));
      });

    return () => {
      active = false;
    };
  }, [client, orderPage, orderReloadToken, workspaceId]);

  useEffect(() => {
    let active = true;
    if (!workspaceId)
      return () => {
        active = false;
      };

    setMatterState({ kind: 'LOADING' });
    void matterClient
      .list({ page: matterPage, pageSize: PAGE_SIZE, ...matterFilters })
      .then((result) => {
        if (active) setMatterState({ kind: 'READY', result });
      })
      .catch((error: unknown) => {
        if (active) setMatterState(failure(error, 'Formal Matters'));
      });

    return () => {
      active = false;
    };
  }, [matterClient, matterFilters, matterPage, matterReloadToken, workspaceId]);

  useEffect(() => {
    const reconcileWorkspace = () => {
      const nextWorkspaceId = currentWorkspaceId();
      if (nextWorkspaceId === workspaceId) return;
      setOrderState({ kind: 'LOADING' });
      setMatterState({ kind: 'LOADING' });
      setOrderPage(1);
      setMatterPage(1);
      setMatterSearchDraft('');
      setMatterStatusDraft('');
      setMatterTypeDraft('');
      setMatterCreatedFromDraft('');
      setMatterCreatedToDraft('');
      setMatterFilterError('');
      setMatterFilters({});
      setWorkspaceId(nextWorkspaceId);
    };
    addEventListener('focus', reconcileWorkspace);
    addEventListener('storage', reconcileWorkspace);
    return () => {
      removeEventListener('focus', reconcileWorkspace);
      removeEventListener('storage', reconcileWorkspace);
    };
  }, [workspaceId]);

  const applyMatterFilters = () => {
    if (
      matterCreatedFromDraft &&
      matterCreatedToDraft &&
      matterCreatedFromDraft > matterCreatedToDraft
    ) {
      setMatterFilterError('Created from must not be later than Created to.');
      return;
    }

    const search = matterSearchDraft.trim();
    setMatterFilterError('');
    setMatterPage(1);
    setMatterFilters({
      ...(search ? { search } : {}),
      ...(matterStatusDraft === 'OPEN' ? { status: 'OPEN' as const } : {}),
      ...(matterTypeDraft === 'TRADEMARK_REGISTRATION'
        ? { type: 'TRADEMARK_REGISTRATION' as const }
        : {}),
      ...(matterCreatedFromDraft ? { createdFrom: `${matterCreatedFromDraft}T00:00:00.000Z` } : {}),
      ...(matterCreatedToDraft ? { createdTo: `${matterCreatedToDraft}T23:59:59.999Z` } : {})
    });
  };

  const clearMatterFilters = () => {
    setMatterSearchDraft('');
    setMatterStatusDraft('');
    setMatterTypeDraft('');
    setMatterCreatedFromDraft('');
    setMatterCreatedToDraft('');
    setMatterFilterError('');
    setMatterPage(1);
    setMatterFilters({});
  };

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

  if (!workspaceId)
    return (
      <main className="markreg-workspace-home" aria-label="MarkReg Workspace">
        <PageHeader
          title="Trademark Workspace"
          description="Durable Service Orders and Formal Matters are loaded independently from the current Workspace."
        />
        <ErrorState
          title="Choose a Workspace"
          description="A current authenticated Workspace is required before MarkReg can load durable trademark work."
        />
      </main>
    );

  const orderTotalPages =
    orderState.kind === 'READY'
      ? Math.max(1, Math.ceil(orderState.result.total / orderState.result.pageSize))
      : 1;
  const matterTotalPages =
    matterState.kind === 'READY'
      ? Math.max(1, Math.ceil(matterState.result.total / matterState.result.pageSize))
      : 1;
  const matterFiltersActive = hasMatterFilters(matterFilters);

  return (
    <main className="markreg-workspace-home" aria-label="MarkReg Workspace">
      <PageHeader
        title="Trademark Workspace"
        description="Track durable Service Orders and Formal Matters as separate Workspace records. Planning a new filing remains a fixture-only consultation until its production gates are complete."
      />
      <Alert tone="warning" title="Authority boundary">
        Order ≠ Matter ≠ Payment ≠ Invoice ≠ Filing. A Formal Matter does not mean an external
        filing has occurred.
      </Alert>
      <div className="markreg-workspace-primary-actions">
        <Button onClick={() => setPlanning(true)}>Plan a new filing</Button>
      </div>

      <section className="markreg-workspace-list" aria-labelledby="workspace-orders-heading">
        <h2 id="workspace-orders-heading">Service Orders</h2>
        {orderState.kind === 'LOADING' && <LoadingState label="Loading durable Service Orders" />}
        {orderState.kind === 'ERROR' && (
          <ErrorState
            title={orderState.title}
            description={orderState.description}
            {...(orderState.retryable
              ? { onRetry: () => setOrderReloadToken((value) => value + 1) }
              : {})}
          />
        )}
        {orderState.kind === 'READY' && orderState.result.items.length === 0 && (
          <Card>
            <h3>No service Orders yet</h3>
            <p>
              This Workspace has no durable Orders. Formal Matters, if any, remain visible
              separately below. Planning a consultation does not create an Order, Payment, Matter,
              or Filing.
            </p>
            <Button onClick={() => setPlanning(true)}>Plan a new filing</Button>
          </Card>
        )}
        {orderState.kind === 'READY' &&
          orderState.result.items.map((order) => {
            const matterRoute = linkedMatterRoute(order);
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
                  {matterRoute && <a href={matterRoute}>Open linked Formal Matter</a>}
                </div>
              </Card>
            );
          })}
        {orderState.kind === 'READY' && orderState.result.total > orderState.result.pageSize && (
          <nav className="markreg-workspace-pagination" aria-label="Order pages">
            <Button
              variant="secondary"
              disabled={orderPage <= 1}
              onClick={() => setOrderPage((value) => Math.max(1, value - 1))}
            >
              Previous
            </Button>
            <span>
              Page {orderState.result.page} of {orderTotalPages}
            </span>
            <Button
              variant="secondary"
              disabled={orderPage >= orderTotalPages}
              onClick={() => setOrderPage((value) => Math.min(orderTotalPages, value + 1))}
            >
              Next
            </Button>
          </nav>
        )}
      </section>

      <section className="markreg-workspace-list" aria-labelledby="workspace-matters-heading">
        <h2 id="workspace-matters-heading">Formal Matters</h2>
        <div className="markreg-workspace-matter-filters" aria-label="Formal Matter filters">
          <TextInput
            label="Search Formal Matters"
            value={matterSearchDraft}
            onChange={(event) => setMatterSearchDraft(event.currentTarget.value)}
            hint="Search uses the existing MarkReg Formal Matter query boundary."
          />
          <Select
            label="Matter status"
            value={matterStatusDraft}
            onChange={(event) => setMatterStatusDraft(event.currentTarget.value)}
          >
            <option value="">All statuses</option>
            <option value="OPEN">Open</option>
          </Select>
          <Select
            label="Matter type"
            value={matterTypeDraft}
            onChange={(event) => setMatterTypeDraft(event.currentTarget.value)}
          >
            <option value="">All types</option>
            <option value="TRADEMARK_REGISTRATION">Trademark registration</option>
          </Select>
          <TextInput
            type="date"
            label="Created from (UTC)"
            value={matterCreatedFromDraft}
            onChange={(event) => setMatterCreatedFromDraft(event.currentTarget.value)}
            hint="MarkReg Matter creation date, not a trademark-office event date."
          />
          <TextInput
            type="date"
            label="Created to (UTC)"
            value={matterCreatedToDraft}
            onChange={(event) => setMatterCreatedToDraft(event.currentTarget.value)}
            hint="The selected UTC end day is included in full."
          />
          <div className="markreg-workspace-filter-actions">
            <Button onClick={applyMatterFilters}>Apply filters</Button>
            <Button variant="secondary" onClick={clearMatterFilters}>
              Clear filters
            </Button>
          </div>
        </div>
        {matterFilterError && (
          <Alert tone="danger" title="Invalid Formal Matter filters">
            {matterFilterError} Existing durable results are unchanged.
          </Alert>
        )}
        {matterState.kind === 'LOADING' && <LoadingState label="Loading durable Formal Matters" />}
        {matterState.kind === 'ERROR' && (
          <ErrorState
            title={matterState.title}
            description={matterState.description}
            {...(matterState.retryable
              ? { onRetry: () => setMatterReloadToken((value) => value + 1) }
              : {})}
          />
        )}
        {matterState.kind === 'READY' && matterState.result.items.length === 0 && (
          <Card>
            {matterFiltersActive ? (
              <>
                <h3>No Formal Matters match these filters</h3>
                <p>
                  The current producer query returned no matching Formal Matters. This does not mean
                  the Workspace has no Formal Matters.
                </p>
              </>
            ) : (
              <>
                <h3>No Formal Matters yet</h3>
                <p>
                  No durable Formal Matter is currently returned for this Workspace. This does not
                  change or reinterpret any Service Order state.
                </p>
              </>
            )}
          </Card>
        )}
        {matterState.kind === 'READY' &&
          matterState.result.items.map((matter) => (
            <Card key={matter.formalMatterId}>
              <KeyValueList
                items={[
                  { key: 'Matter ID', value: matter.formalMatterId },
                  { key: 'Status', value: matter.status },
                  { key: 'Type', value: matter.type },
                  { key: 'Version', value: matter.version },
                  { key: 'Applicant', value: matter.applicant ?? 'Not recorded' },
                  { key: 'Trademark', value: matter.trademark ?? 'Not recorded' },
                  { key: 'Jurisdiction', value: matter.jurisdiction ?? 'Not recorded' },
                  {
                    key: 'Classes',
                    value: matter.classes.length ? matter.classes.join(', ') : 'Not recorded'
                  },
                  {
                    key: 'Source Matter Draft',
                    value: `${matter.sourceMatterDraftId} · version ${matter.sourceMatterDraftVersion}`
                  },
                  { key: 'Created', value: matter.createdAt }
                ]}
              />
              <div className="markreg-workspace-order-actions">
                <a href={formalMatterRoute(matter)}>Open Matter</a>
              </div>
            </Card>
          ))}
        {matterState.kind === 'READY' && matterState.result.total > matterState.result.pageSize && (
          <nav className="markreg-workspace-pagination" aria-label="Matter pages">
            <Button
              variant="secondary"
              disabled={matterPage <= 1}
              onClick={() => setMatterPage((value) => Math.max(1, value - 1))}
            >
              Previous
            </Button>
            <span>
              Page {matterState.result.page} of {matterTotalPages}
            </span>
            <Button
              variant="secondary"
              disabled={matterPage >= matterTotalPages}
              onClick={() => setMatterPage((value) => Math.min(matterTotalPages, value + 1))}
            >
              Next
            </Button>
          </nav>
        )}
      </section>
    </main>
  );
}
