import type { CustomerConfirmation } from '@markorbit/contracts';
import type { OrderStatus } from '@markorbit/contracts/order';
import {
  Alert,
  Button,
  Card,
  ErrorState,
  KeyValueList,
  LoadingState,
  PageHeader
} from '@markorbit/ui';
import { useEffect, useRef, useState } from 'react';
import { MarkregApiError } from './api/errors.js';
import {
  createOrderClient,
  type OrderClient,
  type OrderMatterConversionView,
  type OrderView
} from './api/order.js';
import { serializeMarkregRoute } from './routing/markreg-route.js';

export interface OrderCommercialSource {
  confirmation: CustomerConfirmation;
}

type Problem =
  'STALE_SOURCE' | 'VERSION_CONFLICT' | 'PERMISSION_DENIED' | 'SERVICE_UNAVAILABLE' | 'BLOCKING';

type JourneyState = 'LOADING' | 'NO_SOURCE' | 'READY' | 'MUTATING';

const defaultClient = createOrderClient();
const workspaceId = () =>
  typeof sessionStorage === 'undefined'
    ? undefined
    : (sessionStorage.getItem('markorbit-workspace-id') ?? undefined);
const confirmationVersion = (confirmation: CustomerConfirmation) =>
  (confirmation as CustomerConfirmation & { version?: number }).version ?? 1;
const orderRoute = (order: OrderView) =>
  serializeMarkregRoute({
    view: 'order',
    recordId: order.orderId,
    expectedVersion: String(order.version)
  });
const matterRoute = (matter: OrderMatterConversionView) =>
  serializeMarkregRoute({
    view: 'formal-matter',
    recordId: matter.formalMatterId,
    expectedVersion: String(matter.formalMatterVersion)
  });

function classify(error: unknown): Problem {
  if (!(error instanceof MarkregApiError)) return 'BLOCKING';
  if (error.code?.includes('STALE_SOURCE')) return 'STALE_SOURCE';
  if (error.code?.includes('VERSION_CONFLICT')) return 'VERSION_CONFLICT';
  if (error.kind === 'conflict') return 'VERSION_CONFLICT';
  if (error.kind === 'recoverable' || error.kind === 'offline') return 'SERVICE_UNAVAILABLE';
  if (error.kind === 'blocking' && error.code?.includes('PERMISSION')) return 'PERMISSION_DENIED';
  if (error.kind === 'blocking' && /permission/i.test(error.message)) return 'PERMISSION_DENIED';
  return 'BLOCKING';
}

function problemCopy(problem: Problem) {
  switch (problem) {
    case 'STALE_SOURCE':
      return {
        title: 'Commercial source changed',
        description:
          'The current confirmed commercial source no longer matches this Order. Reloading this same Order does not make its immutable captured source current. Return to MarkReg and continue from a current confirmed commercial source.'
      };
    case 'VERSION_CONFLICT':
      return {
        title: 'Order changed in another session',
        description:
          'This direct link points to a different Order version than the current durable Order shown here. Reload the current version before taking another action.'
      };
    case 'PERMISSION_DENIED':
      return {
        title: 'Permission required',
        description: 'Your current Workspace role cannot perform this Order action.'
      };
    case 'SERVICE_UNAVAILABLE':
      return {
        title: 'Order service temporarily unavailable',
        description:
          'The saved Order is unchanged. Retry the same governed action when the service is available.'
      };
    default:
      return {
        title: 'Order journey cannot continue',
        description: 'The requested governed action could not be completed safely.'
      };
  }
}

export function OrderJourney({
  source,
  orderId,
  expectedVersion,
  client = defaultClient
}: {
  source?: OrderCommercialSource;
  orderId?: string;
  expectedVersion?: string | number;
  client?: OrderClient;
}) {
  const initialWorkspace = useRef(workspaceId());
  const [state, setState] = useState<JourneyState>(orderId ? 'LOADING' : 'READY');
  const [order, setOrder] = useState<OrderView>();
  const [conversion, setConversion] = useState<OrderMatterConversionView>();
  const [problem, setProblem] = useState<Problem>();

  const remember = (value: OrderView, mode: 'push' | 'replace' = 'replace') => {
    setOrder(value);
    setProblem(undefined);
    setState('READY');
    if (typeof sessionStorage !== 'undefined')
      sessionStorage.setItem('markreg-order-journey:last-order', value.orderId);
    if (typeof history !== 'undefined') {
      if (mode === 'push') history.pushState(null, '', orderRoute(value));
      else history.replaceState(null, '', orderRoute(value));
    }
  };

  useEffect(() => {
    if (!orderId) {
      setState(source ? 'READY' : 'NO_SOURCE');
      return;
    }
    let active = true;
    setState('LOADING');
    void client
      .get(orderId)
      .then((value) => {
        if (!active) return;
        setOrder(value);
        setState('READY');
        if (expectedVersion !== undefined && String(value.version) !== String(expectedVersion))
          setProblem('VERSION_CONFLICT');
      })
      .catch((error) => {
        if (!active) return;
        setProblem(classify(error));
        setState('READY');
      });
    return () => {
      active = false;
    };
  }, [client, expectedVersion, orderId, source]);

  useEffect(() => {
    const clearOnWorkspaceChange = () => {
      const current = workspaceId();
      if (!initialWorkspace.current || !current || current === initialWorkspace.current) return;
      initialWorkspace.current = current;
      sessionStorage.removeItem('markreg-order-journey:last-order');
      setOrder(undefined);
      setConversion(undefined);
      setProblem(undefined);
      setState('NO_SOURCE');
      if (new URLSearchParams(location.search).get('view') === 'order')
        history.replaceState(null, '', '/');
    };
    addEventListener('popstate', clearOnWorkspaceChange);
    addEventListener('focus', clearOnWorkspaceChange);
    addEventListener('storage', clearOnWorkspaceChange);
    return () => {
      removeEventListener('popstate', clearOnWorkspaceChange);
      removeEventListener('focus', clearOnWorkspaceChange);
      removeEventListener('storage', clearOnWorkspaceChange);
    };
  }, []);

  const mutate = async (operation: () => Promise<OrderView>) => {
    setState('MUTATING');
    setProblem(undefined);
    try {
      remember(await operation());
    } catch (error) {
      setProblem(classify(error));
      setState('READY');
    }
  };

  const create = async () => {
    const workspace = workspaceId();
    if (!source || !workspace) {
      setState('NO_SOURCE');
      return;
    }
    setState('MUTATING');
    setProblem(undefined);
    try {
      const value = await client.create({
        workspaceId: workspace,
        orderType: 'TrademarkFiling',
        quoteId: source.confirmation.quoteSnapshot.quoteId,
        expectedQuoteVersion: source.confirmation.quoteSnapshot.quoteVersion,
        customerConfirmationId: source.confirmation.confirmationId,
        expectedCustomerConfirmationVersion: confirmationVersion(source.confirmation),
        channel: 'MARKREG_DIRECT',
        relationshipModel: 'DIRECT',
        idempotencyKey: `order-create:${source.confirmation.confirmationId}:${confirmationVersion(source.confirmation)}`
      });
      remember(value, 'push');
    } catch (error) {
      setProblem(classify(error));
      setState('READY');
    }
  };

  const withOrder = (operation: (value: OrderView, workspace: string) => Promise<OrderView>) => {
    const workspace = workspaceId();
    if (!order || !workspace) return Promise.resolve();
    return mutate(() => operation(order, workspace));
  };

  const createMatter = async () => {
    const workspace = workspaceId();
    if (!order || !workspace) return;
    setState('MUTATING');
    setProblem(undefined);
    try {
      const value = await client.createMatter({
        workspaceId: workspace,
        orderId: order.orderId,
        expectedOrderVersion: order.version,
        expectedCommercialSourceSha256: order.source.snapshotSha256,
        idempotencyKey: `order-matter:${order.orderId}:${order.version}`
      });
      setConversion(value);
      const reloaded = await client.get(order.orderId);
      remember(reloaded);
    } catch (error) {
      setProblem(classify(error));
      setState('READY');
    }
  };

  const reload = async () => {
    if (!order?.orderId && !orderId) return;
    setState('LOADING');
    setProblem(undefined);
    try {
      const value = await client.get(order?.orderId ?? orderId!);
      remember(value);
    } catch (error) {
      setProblem(classify(error));
      setState('READY');
    }
  };

  if (state === 'LOADING')
    return (
      <main className="markreg-page" aria-label="Order journey">
        <LoadingState label="Loading durable Order" />
      </main>
    );
  if (state === 'MUTATING')
    return (
      <main className="markreg-page" aria-label="Order journey">
        <LoadingState label="Recording governed Order action" />
      </main>
    );
  if (state === 'NO_SOURCE')
    return (
      <main className="markreg-page" aria-label="Order journey">
        <PageHeader
          title="No eligible commercial source"
          description="A confirmed Quote and Customer Confirmation are required before an Order can be created."
        />
        <Alert tone="warning" title="Nothing was created">
          No Order, Payment, Invoice, Formal Matter or Filing was created by opening this page.
        </Alert>
        <a href="/">Return to MarkReg</a>
      </main>
    );

  const copy = problem ? problemCopy(problem) : undefined;
  const canRetryCreate = problem === 'SERVICE_UNAVAILABLE';
  const canReloadOrder = problem === 'VERSION_CONFLICT' || problem === 'SERVICE_UNAVAILABLE';
  if (!order)
    return (
      <main className="markreg-page" aria-label="Order journey">
        <PageHeader
          title="Create service Order"
          description="Create the governed commercial service request from the exact confirmed source."
        />
        {copy && (
          <ErrorState
            title={copy.title}
            description={copy.description}
            {...(canRetryCreate ? { onRetry: () => void create() } : {})}
          />
        )}
        <Card>
          <KeyValueList
            items={[
              { key: 'Quote', value: source?.confirmation.quoteSnapshot.quoteId ?? 'Unavailable' },
              {
                key: 'Customer Confirmation',
                value: source?.confirmation.confirmationId ?? 'Unavailable'
              },
              { key: 'Order', value: 'Not created' },
              { key: 'Payment', value: 'Not created' },
              { key: 'Invoice', value: 'Not created' },
              { key: 'Filing', value: 'Not created' }
            ]}
          />
          <Button disabled={!source || Boolean(problem)} onClick={() => void create()}>
            Create Order
          </Button>
        </Card>
      </main>
    );

  const progressionBlocked = Boolean(problem);
  const cancellationBlocked = Boolean(problem) && problem !== 'STALE_SOURCE';
  return (
    <main className="markreg-page" aria-label="Order journey">
      <PageHeader
        title="Service Order"
        description="A durable commercial request. Order state does not imply payment, invoicing or filing."
      />
      {copy && (
        <ErrorState
          title={copy.title}
          description={copy.description}
          {...(canReloadOrder ? { onRetry: () => void reload() } : {})}
        />
      )}
      <Card>
        <h2>Order status</h2>
        <KeyValueList
          items={[
            { key: 'Order ID', value: order.orderId },
            { key: 'Status', value: order.status },
            { key: 'Version', value: order.version },
            { key: 'Quote', value: `${order.source.quoteId} · ${order.source.quoteVersion}` },
            {
              key: 'Customer Confirmation',
              value: `${order.source.customerConfirmationId} · version ${order.source.customerConfirmationVersion}`
            },
            { key: 'Channel', value: order.channel },
            { key: 'Relationship', value: order.relationshipModel }
          ]}
        />
        <OrderAction
          status={order.status}
          progressionDisabled={progressionBlocked}
          cancelDisabled={cancellationBlocked}
          requestConfirmation={() =>
            void withOrder((value, workspace) =>
              client.requestConfirmation({
                workspaceId: workspace,
                orderId: value.orderId,
                expectedVersion: value.version,
                idempotencyKey: `order-request-confirmation:${value.orderId}:${value.version}`
              })
            )
          }
          confirm={() =>
            void withOrder((value, workspace) =>
              client.confirm({
                workspaceId: workspace,
                orderId: value.orderId,
                expectedVersion: value.version,
                idempotencyKey: `order-confirm:${value.orderId}:${value.version}`
              })
            )
          }
          evaluate={() =>
            void withOrder((value, workspace) =>
              client.evaluateReadiness({
                workspaceId: workspace,
                orderId: value.orderId,
                expectedVersion: value.version,
                idempotencyKey: `order-ready:${value.orderId}:${value.version}`
              })
            )
          }
          createMatter={() => void createMatter()}
          cancel={() =>
            void withOrder((value, workspace) =>
              client.cancel({
                workspaceId: workspace,
                orderId: value.orderId,
                expectedVersion: value.version,
                reason: 'Cancelled by customer from MarkReg Order journey',
                idempotencyKey: `order-cancel:${value.orderId}:${value.version}`
              })
            )
          }
        />
      </Card>
      <Card>
        <h2>Authority boundary</h2>
        <KeyValueList
          items={[
            { key: 'Order', value: 'Created' },
            {
              key: 'Formal Matter',
              value: order.status === 'MatterCreated' ? 'Created' : 'Not created'
            },
            { key: 'Payment', value: 'Not created' },
            { key: 'Invoice', value: 'Not created' },
            { key: 'Professional appointment', value: 'Not created' },
            { key: 'External filing', value: 'Not created' }
          ]}
        />
      </Card>
      {order.status === 'MatterCreated' && order.matter && (
        <Alert tone="success" title="Formal Matter linked">
          <p>
            Formal Matter {order.matter.formalMatterId} is linked to this Order. No external filing
            has been submitted.
          </p>
          <a
            href={
              conversion
                ? matterRoute(conversion)
                : serializeMarkregRoute({
                    view: 'formal-matter',
                    recordId: order.matter.formalMatterId,
                    expectedVersion: String(order.matter.formalMatterVersion)
                  })
            }
          >
            Open Formal Matter
          </a>
        </Alert>
      )}
    </main>
  );
}

function OrderAction({
  status,
  progressionDisabled,
  cancelDisabled,
  requestConfirmation,
  confirm,
  evaluate,
  createMatter,
  cancel
}: {
  status: OrderStatus;
  progressionDisabled: boolean;
  cancelDisabled: boolean;
  requestConfirmation: () => void;
  confirm: () => void;
  evaluate: () => void;
  createMatter: () => void;
  cancel: () => void;
}) {
  const primary =
    status === 'Draft'
      ? { label: 'Request Order Confirmation', action: requestConfirmation }
      : status === 'PendingConfirmation'
        ? { label: 'Confirm Order', action: confirm }
        : status === 'Confirmed'
          ? { label: 'Validate Ready for Matter', action: evaluate }
          : status === 'ReadyForMatter'
            ? { label: 'Create Formal Matter', action: createMatter }
            : undefined;
  const cancellable = ['Draft', 'PendingConfirmation', 'Confirmed', 'ReadyForMatter'].includes(
    status
  );
  return (
    <div className="markreg-actions">
      {primary && (
        <Button disabled={progressionDisabled} onClick={primary.action}>
          {primary.label}
        </Button>
      )}
      {cancellable && (
        <Button variant="secondary" disabled={cancelDisabled} onClick={cancel}>
          Cancel Order
        </Button>
      )}
    </div>
  );
}
