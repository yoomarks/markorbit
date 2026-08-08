import { createHash } from 'node:crypto';
import type { Order, OrderId, OrderStatus } from '@markorbit/contracts/order';
import type { QueryClient } from '@markorbit/persistence';

export type OrderPersistenceErrorCode =
  | 'ORDER_NOT_FOUND'
  | 'STALE_SOURCE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'DUPLICATE_SOURCE'
  | 'PERSISTENCE_UNAVAILABLE';

export class OrderPersistenceError extends Error {
  constructor(
    readonly code: OrderPersistenceErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'OrderPersistenceError';
  }
}

export type OrderPersistenceCommandType = 'CREATE' | 'UPDATE';
export type OrderAuditAction =
  'ORDER_CREATED' | 'ORDER_STATUS_CHANGED' | 'ORDER_MATTER_LINKED' | 'ORDER_CANCELLED';

export interface OrderAuditRecord {
  workspaceId: string;
  orderId: OrderId;
  action: OrderAuditAction;
  actorId: string;
  fromStatus?: OrderStatus;
  toStatus: OrderStatus;
  version: number;
  correlationId?: string;
  createdAt: string;
}

export interface OrderCommandReplay {
  fingerprint: string;
  commandType: OrderPersistenceCommandType;
  order: Order;
}

export interface OrderListQuery {
  status?: OrderStatus;
  customerId?: string;
  page: number;
  pageSize: number;
}

export interface OrderListResponse {
  items: Order[];
  page: number;
  pageSize: number;
  total: number;
}

export interface OrderAuditView extends OrderAuditRecord {
  auditId: number;
}

export interface OrderRepository {
  createAtomically(
    value: Order,
    idempotencyKey: string,
    fingerprint: string,
    audit: OrderAuditRecord
  ): Promise<Order>;
  updateAtomically(
    value: Order,
    expectedVersion: number,
    idempotencyKey: string,
    fingerprint: string,
    audit: OrderAuditRecord
  ): Promise<Order>;
  findById(workspaceId: string, orderId: string): Promise<Order | null>;
  findByIdempotencyKey(workspaceId: string, key: string): Promise<OrderCommandReplay | null>;
  list(workspaceId: string, query: OrderListQuery): Promise<OrderListResponse>;
  listAudit(workspaceId: string, orderId: string): Promise<OrderAuditView[]>;
}

export interface OrderTransactionHost {
  transact<T>(
    work: (client: QueryClient) => Promise<T>,
    options?: { isolation?: 'SERIALIZABLE' }
  ): Promise<T>;
}

const clone = <T>(value: T): T => structuredClone(value);

type Row = Record<string, unknown>;

export function canonicalOrderPersistenceValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalOrderPersistenceValue).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalOrderPersistenceValue(item)}`)
      .join(',')}}`;
  const encoded = JSON.stringify(value);
  return encoded === undefined ? 'null' : encoded;
}

export function hashOrderPersistenceValue(value: unknown): string {
  return createHash('sha256').update(canonicalOrderPersistenceValue(value)).digest('hex');
}

export function hashCommercialSourceSnapshot(value: Order['commercialSourceSnapshot']): string {
  return hashOrderPersistenceValue(value);
}

function sourceKey(value: Order): string {
  const source = value.commercialSourceSnapshot;
  return [
    value.workspaceId,
    source.quote.quoteId,
    source.quote.quoteVersion,
    source.customerConfirmation.confirmationId,
    source.customerConfirmation.confirmationVersion
  ].join(':');
}

function immutableSourceMatches(current: Order, proposed: Order): boolean {
  return (
    current.orderId === proposed.orderId &&
    current.workspaceId === proposed.workspaceId &&
    current.orderType === proposed.orderType &&
    current.customerId === proposed.customerId &&
    current.channel === proposed.channel &&
    current.relationshipModel === proposed.relationshipModel &&
    current.commercialSourceSnapshotSha256 === proposed.commercialSourceSnapshotSha256 &&
    canonicalOrderPersistenceValue(current.commercialSourceSnapshot) ===
      canonicalOrderPersistenceValue(proposed.commercialSourceSnapshot) &&
    current.createdByUserId === proposed.createdByUserId &&
    current.createdAt === proposed.createdAt
  );
}

function validateUpdate(current: Order, proposed: Order, expectedVersion: number): void {
  if (current.version !== expectedVersion || proposed.version !== expectedVersion + 1)
    throw new OrderPersistenceError(
      'VERSION_CONFLICT',
      'Order version does not match expectedVersion.'
    );
  if (!immutableSourceMatches(current, proposed))
    throw new OrderPersistenceError(
      'STALE_SOURCE',
      'Order commercial source and immutable identity cannot be rewritten.'
    );
}

export class InMemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, Order>();
  private readonly commands = new Map<string, OrderCommandReplay>();
  private readonly sources = new Map<string, string>();
  private readonly audits: OrderAuditView[] = [];
  private chain: Promise<void> = Promise.resolve();
  private auditSequence = 0;

  async createAtomically(
    value: Order,
    key: string,
    fingerprint: string,
    audit: OrderAuditRecord
  ): Promise<Order> {
    let result!: Order;
    const work = this.chain.then(() => {
      const commandKey = `${value.workspaceId}:${key}`;
      const prior = this.commands.get(commandKey);
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          throw new OrderPersistenceError(
            'IDEMPOTENCY_CONFLICT',
            'Idempotency key has conflicting input.'
          );
        result = clone(prior.order);
        return;
      }
      if (this.sources.has(sourceKey(value)))
        throw new OrderPersistenceError(
          'DUPLICATE_SOURCE',
          'The exact commercial source already created an Order.'
        );
      this.orders.set(value.orderId, clone(value));
      this.sources.set(sourceKey(value), value.orderId);
      this.commands.set(commandKey, {
        fingerprint,
        commandType: 'CREATE',
        order: clone(value)
      });
      this.audits.push({ ...clone(audit), auditId: ++this.auditSequence });
      result = clone(value);
    });
    this.chain = work.then(
      () => undefined,
      () => undefined
    );
    await work;
    return result;
  }

  async updateAtomically(
    value: Order,
    expectedVersion: number,
    key: string,
    fingerprint: string,
    audit: OrderAuditRecord
  ): Promise<Order> {
    let result!: Order;
    const work = this.chain.then(() => {
      const commandKey = `${value.workspaceId}:${key}`;
      const prior = this.commands.get(commandKey);
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          throw new OrderPersistenceError(
            'IDEMPOTENCY_CONFLICT',
            'Idempotency key has conflicting input.'
          );
        result = clone(prior.order);
        return;
      }
      const current = this.orders.get(value.orderId);
      if (!current || current.workspaceId !== value.workspaceId)
        throw new OrderPersistenceError('ORDER_NOT_FOUND', 'Order was not found.');
      validateUpdate(current, value, expectedVersion);
      this.orders.set(value.orderId, clone(value));
      this.commands.set(commandKey, {
        fingerprint,
        commandType: 'UPDATE',
        order: clone(value)
      });
      this.audits.push({ ...clone(audit), auditId: ++this.auditSequence });
      result = clone(value);
    });
    this.chain = work.then(
      () => undefined,
      () => undefined
    );
    await work;
    return result;
  }

  findById(workspaceId: string, orderId: string): Promise<Order | null> {
    const value = this.orders.get(orderId);
    return Promise.resolve(value?.workspaceId === workspaceId ? clone(value) : null);
  }

  findByIdempotencyKey(workspaceId: string, key: string): Promise<OrderCommandReplay | null> {
    return Promise.resolve(clone(this.commands.get(`${workspaceId}:${key}`) ?? null));
  }

  list(workspaceId: string, query: OrderListQuery): Promise<OrderListResponse> {
    const filtered = [...this.orders.values()]
      .filter(
        (value) =>
          value.workspaceId === workspaceId &&
          (!query.status || value.status === query.status) &&
          (!query.customerId || value.customerId === query.customerId)
      )
      .sort(
        (left, right) =>
          right.updatedAt.localeCompare(left.updatedAt) || left.orderId.localeCompare(right.orderId)
      );
    const offset = (query.page - 1) * query.pageSize;
    return Promise.resolve({
      items: filtered.slice(offset, offset + query.pageSize).map(clone),
      page: query.page,
      pageSize: query.pageSize,
      total: filtered.length
    });
  }

  listAudit(workspaceId: string, orderId: string): Promise<OrderAuditView[]> {
    return Promise.resolve(
      this.audits
        .filter((value) => value.workspaceId === workspaceId && value.orderId === orderId)
        .map(clone)
    );
  }

  evidence() {
    return {
      orders: this.orders.size,
      commands: this.commands.size,
      audits: this.audits.length
    };
  }
}

export class PostgresOrderRepository implements OrderRepository {
  constructor(
    private readonly database: OrderTransactionHost,
    private readonly query: QueryClient
  ) {}

  async createAtomically(
    value: Order,
    key: string,
    fingerprint: string,
    audit: OrderAuditRecord
  ): Promise<Order> {
    try {
      return await this.database.transact(
        async (client) => {
          const replay = await this.findReplayWithClient(client, value.workspaceId, key, true);
          if (replay) return this.resolveReplay(replay, fingerprint);
          await client.query(
            `INSERT INTO orders (
              order_id,workspace_id,order_type,status,version,customer_id,channel,relationship_model,
              source_quote_id,source_quote_version,source_customer_confirmation_id,source_customer_confirmation_version,
              commercial_source_snapshot,commercial_source_snapshot_sha256,matter_reference,
              created_by_user_id,updated_by_user_id,created_at,updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15::jsonb,$16,$17,$18,$19)`,
            [
              value.orderId,
              value.workspaceId,
              value.orderType,
              value.status,
              value.version,
              value.customerId,
              value.channel,
              value.relationshipModel,
              value.commercialSourceSnapshot.quote.quoteId,
              value.commercialSourceSnapshot.quote.quoteVersion,
              value.commercialSourceSnapshot.customerConfirmation.confirmationId,
              value.commercialSourceSnapshot.customerConfirmation.confirmationVersion,
              JSON.stringify(value.commercialSourceSnapshot),
              value.commercialSourceSnapshotSha256,
              value.matter ? JSON.stringify(value.matter) : null,
              value.createdByUserId,
              value.updatedByUserId,
              value.createdAt,
              value.updatedAt
            ]
          );
          await this.insertCommand(client, value, key, fingerprint, 'CREATE');
          await this.insertAudit(client, audit);
          return clone(value);
        },
        { isolation: 'SERIALIZABLE' }
      );
    } catch (cause) {
      if (cause instanceof OrderPersistenceError) throw cause;
      if (isConcurrentConflict(cause)) return this.resolveConcurrentCreate(value, key, fingerprint);
      throw unavailable(cause);
    }
  }

  async updateAtomically(
    value: Order,
    expectedVersion: number,
    key: string,
    fingerprint: string,
    audit: OrderAuditRecord
  ): Promise<Order> {
    try {
      return await this.database.transact(
        async (client) => {
          const replay = await this.findReplayWithClient(client, value.workspaceId, key, true);
          if (replay) return this.resolveReplay(replay, fingerprint);
          const selected = await client.query(
            'SELECT * FROM orders WHERE workspace_id=$1 AND order_id=$2 FOR UPDATE',
            [value.workspaceId, value.orderId]
          );
          if (!selected.rowCount)
            throw new OrderPersistenceError('ORDER_NOT_FOUND', 'Order was not found.');
          const current = this.map(selected.rows[0] as Row);
          validateUpdate(current, value, expectedVersion);
          const updated = await client.query(
            'UPDATE orders SET status=$1,version=$2,matter_reference=$3::jsonb,updated_by_user_id=$4,updated_at=$5 WHERE workspace_id=$6 AND order_id=$7 AND version=$8',
            [
              value.status,
              value.version,
              value.matter ? JSON.stringify(value.matter) : null,
              value.updatedByUserId,
              value.updatedAt,
              value.workspaceId,
              value.orderId,
              expectedVersion
            ]
          );
          if (updated.rowCount !== 1)
            throw new OrderPersistenceError(
              'VERSION_CONFLICT',
              'Order version does not match expectedVersion.'
            );
          await this.insertCommand(client, value, key, fingerprint, 'UPDATE');
          await this.insertAudit(client, audit);
          return clone(value);
        },
        { isolation: 'SERIALIZABLE' }
      );
    } catch (cause) {
      if (cause instanceof OrderPersistenceError) throw cause;
      if (isConcurrentConflict(cause))
        return this.resolveConcurrentUpdate(value, expectedVersion, key, fingerprint);
      throw unavailable(cause);
    }
  }

  async findById(workspaceId: string, orderId: string): Promise<Order | null> {
    try {
      const result = await this.query.query(
        'SELECT * FROM orders WHERE workspace_id=$1 AND order_id=$2',
        [workspaceId, orderId]
      );
      return result.rowCount ? this.map(result.rows[0] as Row) : null;
    } catch (cause) {
      throw unavailable(cause);
    }
  }

  async findByIdempotencyKey(workspaceId: string, key: string): Promise<OrderCommandReplay | null> {
    try {
      return await this.findReplayWithClient(this.query, workspaceId, key, false);
    } catch (cause) {
      if (cause instanceof OrderPersistenceError) throw cause;
      throw unavailable(cause);
    }
  }

  async list(workspaceId: string, query: OrderListQuery): Promise<OrderListResponse> {
    try {
      const where = ['workspace_id=$1'];
      const values: unknown[] = [workspaceId];
      if (query.status) {
        values.push(query.status);
        where.push(`status=$${values.length}`);
      }
      if (query.customerId) {
        values.push(query.customerId);
        where.push(`customer_id=$${values.length}`);
      }
      const predicate = where.join(' AND ');
      const count = await this.query.query(
        `SELECT count(*)::int AS total FROM orders WHERE ${predicate}`,
        values
      );
      values.push(query.pageSize, (query.page - 1) * query.pageSize);
      const rows = await this.query.query(
        `SELECT * FROM orders WHERE ${predicate} ORDER BY updated_at DESC,order_id ASC LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values
      );
      return {
        items: rows.rows.map((row) => this.map(row as Row)),
        page: query.page,
        pageSize: query.pageSize,
        total: Number((count.rows[0] as Row).total)
      };
    } catch (cause) {
      throw unavailable(cause);
    }
  }

  async listAudit(workspaceId: string, orderId: string): Promise<OrderAuditView[]> {
    try {
      const result = await this.query.query(
        'SELECT audit_id,workspace_id,order_id,action,actor_id,from_status,to_status,version,correlation_id,occurred_at FROM order_audit WHERE workspace_id=$1 AND order_id=$2 ORDER BY audit_id ASC',
        [workspaceId, orderId]
      );
      return result.rows.map((row) => {
        const value = row as Row;
        return {
          auditId: Number(value.audit_id),
          workspaceId: String(value.workspace_id),
          orderId: String(value.order_id) as OrderId,
          action: String(value.action) as OrderAuditAction,
          actorId: String(value.actor_id),
          ...(value.from_status ? { fromStatus: String(value.from_status) as OrderStatus } : {}),
          toStatus: String(value.to_status) as OrderStatus,
          version: Number(value.version),
          ...(value.correlation_id ? { correlationId: String(value.correlation_id) } : {}),
          createdAt: new Date(value.occurred_at as string).toISOString()
        };
      });
    } catch (cause) {
      throw unavailable(cause);
    }
  }

  private async insertCommand(
    client: QueryClient,
    value: Order,
    key: string,
    fingerprint: string,
    commandType: OrderPersistenceCommandType
  ) {
    await client.query(
      'INSERT INTO order_commands(workspace_id,idempotency_key,request_fingerprint,order_id,command_type,result_version,result_snapshot,created_at) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8)',
      [
        value.workspaceId,
        key,
        fingerprint,
        value.orderId,
        commandType,
        value.version,
        JSON.stringify(value),
        value.updatedAt
      ]
    );
  }

  private async insertAudit(client: QueryClient, audit: OrderAuditRecord) {
    await client.query(
      'INSERT INTO order_audit(workspace_id,order_id,action,actor_id,from_status,to_status,version,correlation_id,occurred_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [
        audit.workspaceId,
        audit.orderId,
        audit.action,
        audit.actorId,
        audit.fromStatus ?? null,
        audit.toStatus,
        audit.version,
        audit.correlationId ?? null,
        audit.createdAt
      ]
    );
  }

  private async findReplayWithClient(
    client: QueryClient,
    workspaceId: string,
    key: string,
    lock: boolean
  ): Promise<OrderCommandReplay | null> {
    const result = await client.query(
      `SELECT request_fingerprint,command_type,result_snapshot FROM order_commands WHERE workspace_id=$1 AND idempotency_key=$2${lock ? ' FOR UPDATE' : ''}`,
      [workspaceId, key]
    );
    if (!result.rowCount) return null;
    const row = result.rows[0] as Row;
    return {
      fingerprint: String(row.request_fingerprint),
      commandType: String(row.command_type) as OrderPersistenceCommandType,
      order: clone(row.result_snapshot as Order)
    };
  }

  private resolveReplay(replay: OrderCommandReplay, fingerprint: string): Order {
    if (replay.fingerprint !== fingerprint)
      throw new OrderPersistenceError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key has conflicting input.'
      );
    return clone(replay.order);
  }

  private async findBySource(value: Order): Promise<Order | null> {
    const source = value.commercialSourceSnapshot;
    const result = await this.query.query(
      'SELECT * FROM orders WHERE workspace_id=$1 AND source_quote_id=$2 AND source_quote_version=$3 AND source_customer_confirmation_id=$4 AND source_customer_confirmation_version=$5',
      [
        value.workspaceId,
        source.quote.quoteId,
        source.quote.quoteVersion,
        source.customerConfirmation.confirmationId,
        source.customerConfirmation.confirmationVersion
      ]
    );
    return result.rowCount ? this.map(result.rows[0] as Row) : null;
  }

  private async resolveConcurrentCreate(value: Order, key: string, fingerprint: string) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const replay = await this.findByIdempotencyKey(value.workspaceId, key);
      if (replay) return this.resolveReplay(replay, fingerprint);
      const source = await this.findBySource(value);
      if (source)
        throw new OrderPersistenceError(
          'DUPLICATE_SOURCE',
          'The exact commercial source already created an Order.'
        );
      if (attempt < 9) await delay(10 * (attempt + 1));
    }
    throw new OrderPersistenceError(
      'PERSISTENCE_UNAVAILABLE',
      'The concurrent Order result is not yet available.'
    );
  }

  private async resolveConcurrentUpdate(
    value: Order,
    expectedVersion: number,
    key: string,
    fingerprint: string
  ) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const replay = await this.findByIdempotencyKey(value.workspaceId, key);
      if (replay) return this.resolveReplay(replay, fingerprint);
      const current = await this.findById(value.workspaceId, value.orderId);
      if (!current) throw new OrderPersistenceError('ORDER_NOT_FOUND', 'Order was not found.');
      if (current.version !== expectedVersion)
        throw new OrderPersistenceError(
          'VERSION_CONFLICT',
          'Order version does not match expectedVersion.'
        );
      if (attempt < 9) await delay(10 * (attempt + 1));
    }
    throw new OrderPersistenceError(
      'PERSISTENCE_UNAVAILABLE',
      'The concurrent Order update result is not yet available.'
    );
  }

  private map(row: Row): Order {
    const matter = row.matter_reference
      ? clone(row.matter_reference as Order['matter'])
      : undefined;
    return {
      schemaVersion: 1,
      orderId: String(row.order_id) as OrderId,
      workspaceId: String(row.workspace_id),
      orderType: 'TrademarkFiling',
      status: String(row.status) as OrderStatus,
      version: Number(row.version),
      customerId: String(row.customer_id) as never,
      channel: String(row.channel) as never,
      relationshipModel: String(row.relationship_model) as never,
      commercialSourceSnapshot: clone(
        row.commercial_source_snapshot as Order['commercialSourceSnapshot']
      ),
      commercialSourceSnapshotSha256: String(row.commercial_source_snapshot_sha256),
      ...(matter ? { matter } : {}),
      createdByUserId: String(row.created_by_user_id) as never,
      updatedByUserId: String(row.updated_by_user_id) as never,
      createdAt: new Date(row.created_at as string).toISOString(),
      updatedAt: new Date(row.updated_at as string).toISOString()
    } as Order;
  }
}

function isConcurrentConflict(cause: unknown): boolean {
  const code = (cause as { code?: string }).code;
  return code === '23505' || code === '40001';
}

function unavailable(cause: unknown): OrderPersistenceError {
  return new OrderPersistenceError('PERSISTENCE_UNAVAILABLE', 'Order persistence is unavailable.', {
    cause: cause instanceof Error ? cause : undefined
  });
}

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
