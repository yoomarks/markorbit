import type { Channel, MarkOrbitId, RelationshipModel } from '@markorbit/contracts';
import type {
  CancelOrderCommand,
  ConfirmOrderCommand,
  CreateMatterFromOrderCommand,
  CreateOrderCommand,
  EvaluateOrderReadinessCommand,
  LinkExistingMatterToOrderCommand,
  OrderId,
  OrderMatterLinkKind,
  OrderMatterReference,
  OrderStatus,
  OrderType,
  RequestOrderConfirmationCommand
} from '@markorbit/contracts/order';
import { createApiClient, type ApiClient } from './client.js';

export interface OrderView {
  orderId: OrderId;
  orderType: OrderType;
  status: OrderStatus;
  version: number;
  customerId: MarkOrbitId;
  channel: Channel;
  relationshipModel: RelationshipModel;
  source: Readonly<{
    quoteId: MarkOrbitId;
    quoteVersion: string;
    customerConfirmationId: string;
    customerConfirmationVersion: number;
    applicantReference: string;
    trademarkReference: string;
    jurisdictionReference: string;
    classNumbers: readonly number[];
    selectedPlanId: MarkOrbitId;
    selectedPlanVersion: string;
    snapshotSha256: string;
  }>;
  matter?: Readonly<OrderMatterReference>;
  createdAt: string;
  updatedAt: string;
}

export interface OrderListView {
  items: readonly Readonly<OrderView>[];
  page: number;
  pageSize: number;
  total: number;
}

export interface OrderMatterConversionView {
  orderId: OrderId;
  orderStatus: 'MatterCreated';
  orderVersion: number;
  formalMatterId: string;
  formalMatterVersion: number;
  linkKind: OrderMatterLinkKind;
  linkedAt: string;
}

export interface OrderClient {
  create(command: CreateOrderCommand): Promise<OrderView>;
  get(orderId: string): Promise<OrderView>;
  list(query?: {
    status?: OrderStatus;
    customerId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<OrderListView>;
  requestConfirmation(command: RequestOrderConfirmationCommand): Promise<OrderView>;
  confirm(command: ConfirmOrderCommand): Promise<OrderView>;
  evaluateReadiness(command: EvaluateOrderReadinessCommand): Promise<OrderView>;
  createMatter(command: CreateMatterFromOrderCommand): Promise<OrderMatterConversionView>;
  linkMatter(command: LinkExistingMatterToOrderCommand): Promise<OrderMatterConversionView>;
  cancel(command: CancelOrderCommand): Promise<OrderView>;
}

function key(command: { idempotencyKey: string }) {
  return { 'Idempotency-Key': command.idempotencyKey };
}

export function createOrderClient(api: ApiClient = createApiClient()): OrderClient {
  return {
    create(command) {
      return api.post<OrderView>('/api/markreg/orders', command, key(command));
    },
    get(orderId) {
      return api.get<OrderView>(`/api/markreg/orders/${encodeURIComponent(orderId)}`);
    },
    list(query = {}) {
      const search = new URLSearchParams();
      if (query.status) search.set('status', query.status);
      if (query.customerId) search.set('customerId', query.customerId);
      if (query.page !== undefined) search.set('page', String(query.page));
      if (query.pageSize !== undefined) search.set('pageSize', String(query.pageSize));
      const suffix = search.toString();
      return api.get<OrderListView>(`/api/markreg/orders${suffix ? `?${suffix}` : ''}`);
    },
    requestConfirmation(command) {
      return api.post<OrderView>(
        `/api/markreg/orders/${encodeURIComponent(command.orderId)}/request-confirmation`,
        command,
        key(command)
      );
    },
    confirm(command) {
      return api.post<OrderView>(
        `/api/markreg/orders/${encodeURIComponent(command.orderId)}/confirm`,
        command,
        key(command)
      );
    },
    evaluateReadiness(command) {
      return api.post<OrderView>(
        `/api/markreg/orders/${encodeURIComponent(command.orderId)}/evaluate-readiness`,
        command,
        key(command)
      );
    },
    createMatter(command) {
      return api.post<OrderMatterConversionView>(
        `/api/markreg/orders/${encodeURIComponent(command.orderId)}/create-matter`,
        command,
        key(command)
      );
    },
    linkMatter(command) {
      return api.post<OrderMatterConversionView>(
        `/api/markreg/orders/${encodeURIComponent(command.orderId)}/link-matter`,
        command,
        key(command)
      );
    },
    cancel(command) {
      return api.post<OrderView>(
        `/api/markreg/orders/${encodeURIComponent(command.orderId)}/cancel`,
        command,
        key(command)
      );
    }
  };
}
