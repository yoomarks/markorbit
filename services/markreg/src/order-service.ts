import { randomUUID } from 'node:crypto';
import {
  canTransitionOrder,
  type CancelOrderCommand,
  type CommercialSourceSnapshot,
  type ConfirmOrderCommand,
  type CreateOrderCommand,
  type EvaluateOrderReadinessCommand,
  type MarkOrbitId,
  type Order,
  type OrderId,
  type OrderMatterReference,
  type OrderStatus,
  type Permission,
  type RequestOrderConfirmationCommand,
  type WorkspacePrincipal
} from '@markorbit/contracts/order';
import type { WorkspacePrincipal as CanonicalWorkspacePrincipal } from '@markorbit/contracts';
import {
  hashCommercialSourceSnapshot,
  hashOrderPersistenceValue,
  OrderPersistenceError,
  type OrderAuditAction,
  type OrderAuditRecord,
  type OrderListQuery,
  type OrderRepository
} from './order-persistence.js';

export type OrderServiceErrorCode =
  | 'ORDER_NOT_FOUND'
  | 'AUTHENTICATION_REQUIRED'
  | 'WORKSPACE_MISMATCH'
  | 'STALE_SOURCE'
  | 'INVALID_TRANSITION'
  | 'PERMISSION_DENIED'
  | 'POLICY_DENIED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'DUPLICATE_SOURCE'
  | 'PERSISTENCE_UNAVAILABLE';

export class OrderServiceError extends Error {
  constructor(
    readonly code: OrderServiceErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'OrderServiceError';
  }
}

/**
 * MarkReg-owned port for the exact commercial evidence admitted into an Order.
 * The service validates returned identity/version/channel values before persistence;
 * later runtime wiring may resolve the source from Quote/Confirmation/preparation truth.
 */
export interface OrderCommercialSourceProvider {
  resolve(command: CreateOrderCommand): Promise<CommercialSourceSnapshot | null>;
  isCurrent(workspaceId: string, source: Readonly<CommercialSourceSnapshot>): Promise<boolean>;
}

/** Bounded product-safe Order view; the immutable full commercial snapshot remains owner-only. */
export interface OrderProjection {
  orderId: OrderId;
  orderType: Order['orderType'];
  status: OrderStatus;
  version: number;
  customerId: MarkOrbitId;
  channel: Order['channel'];
  relationshipModel: Order['relationshipModel'];
  source: Readonly<{
    quoteId: MarkOrbitId;
    quoteVersion: string;
    customerConfirmationId: CommercialSourceSnapshot['customerConfirmation']['confirmationId'];
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

export interface OrderProjectionListResponse {
  items: readonly Readonly<OrderProjection>[];
  page: number;
  pageSize: number;
  total: number;
}

const clone = <T>(value: T): T => structuredClone(value);

function authorize(
  principal: CanonicalWorkspacePrincipal,
  workspaceId: string,
  permission: Permission
): void {
  if (principal.kind !== 'WORKSPACE')
    throw new OrderServiceError('AUTHENTICATION_REQUIRED', 'A Workspace Principal is required.');
  if (principal.workspaceId !== workspaceId)
    throw new OrderServiceError('WORKSPACE_MISMATCH', 'Workspace context does not match.');
  if (!principal.permissions.includes(permission))
    throw new OrderServiceError('PERMISSION_DENIED', `${permission} permission is required.`);
}

function fingerprint(operation: string, command: object): string {
  const semantic = { ...command } as Record<string, unknown>;
  delete semantic.idempotencyKey;
  return hashOrderPersistenceValue({ operation, command: semantic });
}

function sourceMatches(command: CreateOrderCommand, source: CommercialSourceSnapshot): boolean {
  return (
    source.quote.quoteId === command.quoteId &&
    source.quote.quoteVersion === command.expectedQuoteVersion &&
    source.customerConfirmation.confirmationId === command.customerConfirmationId &&
    source.customerConfirmation.confirmationVersion === command.expectedCustomerConfirmationVersion &&
    source.customerConfirmation.status === 'CONFIRMED' &&
    source.channel === command.channel &&
    source.relationshipModel === command.relationshipModel &&
    /^[0-9a-f]{64}$/u.test(source.sourceSha256) &&
    Number.isFinite(Date.parse(source.capturedAt))
  );
}

function ready(source: CommercialSourceSnapshot): boolean {
  const scope = source.commercialScope;
  return (
    source.customerConfirmation.status === 'CONFIRMED' &&
    scope.applicantReference.trim().length > 0 &&
    scope.trademarkReference.trim().length > 0 &&
    scope.jurisdictionReference.trim().length > 0 &&
    scope.classNumbers.length > 0 &&
    scope.classNumbers.every((value) => Number.isSafeInteger(value) && value > 0) &&
    scope.goodsServices.length > 0 &&
    scope.goodsServices.every((value) => value.trim().length > 0) &&
    scope.selectedPlanId.length > 0 &&
    scope.selectedPlanVersion.trim().length > 0
  );
}

function project(order: Order): Readonly<OrderProjection> {
  const source = order.commercialSourceSnapshot;
  return Object.freeze({
    orderId: order.orderId,
    orderType: order.orderType,
    status: order.status,
    version: order.version,
    customerId: order.customerId,
    channel: order.channel,
    relationshipModel: order.relationshipModel,
    source: Object.freeze({
      quoteId: source.quote.quoteId,
      quoteVersion: source.quote.quoteVersion,
      customerConfirmationId: source.customerConfirmation.confirmationId,
      customerConfirmationVersion: source.customerConfirmation.confirmationVersion,
      applicantReference: source.commercialScope.applicantReference,
      trademarkReference: source.commercialScope.trademarkReference,
      jurisdictionReference: source.commercialScope.jurisdictionReference,
      classNumbers: Object.freeze([...source.commercialScope.classNumbers]),
      selectedPlanId: source.commercialScope.selectedPlanId,
      selectedPlanVersion: source.commercialScope.selectedPlanVersion,
      snapshotSha256: order.commercialSourceSnapshotSha256
    }),
    ...(order.matter ? { matter: Object.freeze(clone(order.matter)) } : {}),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  });
}

function mapPersistence(error: OrderPersistenceError): OrderServiceError {
  const code = error.code === 'ORDER_NOT_FOUND' ? 'ORDER_NOT_FOUND' : error.code;
  return new OrderServiceError(code, error.message, { cause: error });
}

export class InMemoryOrderCommercialSourceProvider implements OrderCommercialSourceProvider {
  private readonly values = new Map<string, CommercialSourceSnapshot>();
  private readonly invalid = new Set<string>();

  put(workspaceId: string, source: CommercialSourceSnapshot): void {
    const key = this.key(workspaceId, source.customerConfirmation.confirmationId);
    this.values.set(key, clone(source));
    this.invalid.delete(key);
  }

  invalidate(workspaceId: string, confirmationId: string): void {
    this.invalid.add(this.key(workspaceId, confirmationId));
  }

  resolve(command: CreateOrderCommand): Promise<CommercialSourceSnapshot | null> {
    const value = this.values.get(this.key(command.workspaceId, command.customerConfirmationId));
    return Promise.resolve(value ? clone(value) : null);
  }

  isCurrent(workspaceId: string, source: Readonly<CommercialSourceSnapshot>): Promise<boolean> {
    const key = this.key(workspaceId, source.customerConfirmation.confirmationId);
    const current = this.values.get(key);
    return Promise.resolve(
      !this.invalid.has(key) &&
        !!current &&
        hashCommercialSourceSnapshot(current) === hashCommercialSourceSnapshot(source)
    );
  }

  private key(workspaceId: string, confirmationId: string): string {
    return `${workspaceId}:${confirmationId}`;
  }
}

export class OrderService {
  constructor(
    private readonly repository: OrderRepository,
    private readonly sources: OrderCommercialSourceProvider,
    private readonly now = () => new Date().toISOString(),
    private readonly orderId = () => `order_${randomUUID()}` as OrderId
  ) {}

  async create(
    principal: WorkspacePrincipal,
    command: CreateOrderCommand,
    correlationId?: string
  ): Promise<Readonly<OrderProjection>> {
    return this.translate(async () => {
      authorize(principal, command.workspaceId, 'order:create');
      const commandFingerprint = fingerprint('ORDER_CREATE', command);
      const replay = await this.replay(command.workspaceId, command.idempotencyKey, commandFingerprint);
      if (replay) return project(replay);
      const source = await this.sources.resolve(command);
      if (!source || !sourceMatches(command, source))
        throw new OrderServiceError(
          'STALE_SOURCE',
          'The exact commercial source is unavailable or stale.'
        );
      const at = this.now();
      const value: Order = {
        schemaVersion: 1,
        orderId: this.orderId(),
        workspaceId: command.workspaceId,
        orderType: command.orderType,
        status: 'Draft',
        version: 1,
        customerId: source.customerId,
        channel: source.channel,
        relationshipModel: source.relationshipModel,
        commercialSourceSnapshot: clone(source),
        commercialSourceSnapshotSha256: hashCommercialSourceSnapshot(source),
        createdByUserId: principal.userId as MarkOrbitId,
        updatedByUserId: principal.userId as MarkOrbitId,
        createdAt: at,
        updatedAt: at
      };
      const created = await this.repository.createAtomically(
        value,
        command.idempotencyKey,
        commandFingerprint,
        this.audit(value, 'ORDER_CREATED', principal, undefined, at, correlationId)
      );
      return project(created);
    });
  }

  async get(
    principal: WorkspacePrincipal,
    workspaceId: string,
    orderId: string
  ): Promise<Readonly<OrderProjection>> {
    return this.translate(async () => {
      authorize(principal, workspaceId, 'order:read');
      const value = await this.repository.findById(workspaceId, orderId);
      if (!value) throw new OrderServiceError('ORDER_NOT_FOUND', 'Order was not found.');
      return project(value);
    });
  }

  async list(
    principal: WorkspacePrincipal,
    workspaceId: string,
    query: OrderListQuery
  ): Promise<Readonly<OrderProjectionListResponse>> {
    return this.translate(async () => {
      authorize(principal, workspaceId, 'order:read');
      if (
        !Number.isSafeInteger(query.page) ||
        query.page < 1 ||
        !Number.isSafeInteger(query.pageSize) ||
        query.pageSize < 1 ||
        query.pageSize > 100
      )
        throw new OrderServiceError('POLICY_DENIED', 'Order list pagination is invalid.');
      const page = await this.repository.list(workspaceId, query);
      return Object.freeze({
        items: Object.freeze(page.items.map(project)),
        page: page.page,
        pageSize: page.pageSize,
        total: page.total
      });
    });
  }

  requestConfirmation(
    principal: WorkspacePrincipal,
    command: RequestOrderConfirmationCommand,
    correlationId?: string
  ): Promise<Readonly<OrderProjection>> {
    return this.transition(
      principal,
      command,
      'ORDER_REQUEST_CONFIRMATION',
      'PendingConfirmation',
      'order:update',
      true,
      correlationId
    );
  }

  confirm(
    principal: WorkspacePrincipal,
    command: ConfirmOrderCommand,
    correlationId?: string
  ): Promise<Readonly<OrderProjection>> {
    return this.transition(
      principal,
      command,
      'ORDER_CONFIRM',
      'Confirmed',
      'order:confirm',
      true,
      correlationId
    );
  }

  evaluateReadiness(
    principal: WorkspacePrincipal,
    command: EvaluateOrderReadinessCommand,
    correlationId?: string
  ): Promise<Readonly<OrderProjection>> {
    return this.transition(
      principal,
      command,
      'ORDER_EVALUATE_READINESS',
      'ReadyForMatter',
      'order:update',
      true,
      correlationId,
      (order) => {
        if (!ready(order.commercialSourceSnapshot))
          throw new OrderServiceError(
            'POLICY_DENIED',
            'Order commercial scope is not ready for Matter creation.'
          );
      }
    );
  }

  async cancel(
    principal: WorkspacePrincipal,
    command: CancelOrderCommand,
    correlationId?: string
  ): Promise<Readonly<OrderProjection>> {
    if (command.reason.trim().length === 0 || command.reason.length > 1000)
      throw new OrderServiceError('POLICY_DENIED', 'A bounded cancellation reason is required.');
    return this.transition(
      principal,
      command,
      'ORDER_CANCEL',
      'Cancelled',
      'order:cancel',
      false,
      correlationId,
      undefined,
      'ORDER_CANCELLED'
    );
  }

  private async transition(
    principal: WorkspacePrincipal,
    command: RequestOrderConfirmationCommand | ConfirmOrderCommand | EvaluateOrderReadinessCommand | CancelOrderCommand,
    operation: string,
    toStatus: OrderStatus,
    permission: Permission,
    requireCurrentSource: boolean,
    correlationId?: string,
    policy?: (order: Order) => void,
    action: OrderAuditAction = 'ORDER_STATUS_CHANGED'
  ): Promise<Readonly<OrderProjection>> {
    return this.translate(async () => {
      authorize(principal, command.workspaceId, permission);
      const commandFingerprint = fingerprint(operation, command);
      const replay = await this.replay(command.workspaceId, command.idempotencyKey, commandFingerprint);
      if (replay) return project(replay);
      const current = await this.repository.findById(command.workspaceId, command.orderId);
      if (!current) throw new OrderServiceError('ORDER_NOT_FOUND', 'Order was not found.');
      if (current.version !== command.expectedVersion)
        throw new OrderServiceError('VERSION_CONFLICT', 'Order version does not match expectedVersion.');
      if (!canTransitionOrder(current.status, toStatus))
        throw new OrderServiceError(
          'INVALID_TRANSITION',
          `Order cannot transition from ${current.status} to ${toStatus}.`
        );
      if (
        requireCurrentSource &&
        !(await this.sources.isCurrent(command.workspaceId, current.commercialSourceSnapshot))
      )
        throw new OrderServiceError('STALE_SOURCE', 'Order commercial source is no longer current.');
      policy?.(current);
      const at = this.now();
      const next = {
        ...current,
        status: toStatus,
        version: current.version + 1,
        updatedByUserId: principal.userId as MarkOrbitId,
        updatedAt: at
      } as Order;
      const updated = await this.repository.updateAtomically(
        next,
        command.expectedVersion,
        command.idempotencyKey,
        commandFingerprint,
        this.audit(next, action, principal, current.status, at, correlationId)
      );
      return project(updated);
    });
  }

  private async replay(
    workspaceId: string,
    key: string,
    commandFingerprint: string
  ): Promise<Order | null> {
    const replay = await this.repository.findByIdempotencyKey(workspaceId, key);
    if (!replay) return null;
    if (replay.fingerprint !== commandFingerprint)
      throw new OrderServiceError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key has conflicting input.'
      );
    return replay.order;
  }

  private audit(
    order: Order,
    action: OrderAuditAction,
    principal: WorkspacePrincipal,
    fromStatus: OrderStatus | undefined,
    at: string,
    correlationId: string | undefined
  ): OrderAuditRecord {
    return {
      workspaceId: order.workspaceId,
      orderId: order.orderId,
      action,
      actorId: principal.userId,
      ...(fromStatus ? { fromStatus } : {}),
      toStatus: order.status,
      version: order.version,
      ...(correlationId ? { correlationId } : {}),
      createdAt: at
    };
  }

  private async translate<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof OrderServiceError) throw error;
      if (error instanceof OrderPersistenceError) throw mapPersistence(error);
      throw new OrderServiceError('PERSISTENCE_UNAVAILABLE', 'Order service dependency is unavailable.', {
        cause: error instanceof Error ? error : undefined
      });
    }
  }
}
