import type { QueryClient } from '@markorbit/persistence';
import {
  assertCommercialPrice,
  assertCommercialProduct,
  type CheckoutSession,
  type CheckoutSessionId,
  type CommercialCatalogItem,
  type CommercialCatalogQuery,
  type CommercialPrice,
  type CommercialPriceId,
  type CommercialProduct,
  type CommercialProductId
} from '@markorbit/contracts/commercial';
import type {
  CheckoutReplay,
  CommercialCatalogRepository
} from './commercial-checkout.js';
import { CommercialCheckoutError } from './commercial-checkout.js';

export interface CommercialCheckoutTransactionHost {
  transact<T>(
    work: (client: QueryClient) => Promise<T>,
    options?: { isolation?: 'SERIALIZABLE' }
  ): Promise<T>;
}

type Row = Record<string, unknown>;
const clone = <T>(value: T): T => structuredClone(value);

function unavailable(cause: unknown): CommercialCheckoutError {
  return new CommercialCheckoutError(
    'PERSISTENCE_UNAVAILABLE',
    'Commercial catalog persistence is unavailable.',
    { cause: cause instanceof Error ? cause : undefined }
  );
}

function postgresCode(cause: unknown): string | undefined {
  if (!cause || typeof cause !== 'object') return undefined;
  const code = (cause as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

export class PostgresCommercialCatalogRepository implements CommercialCatalogRepository {
  constructor(
    private readonly database: CommercialCheckoutTransactionHost,
    private readonly query: QueryClient
  ) {}

  async listCatalog(query: CommercialCatalogQuery, at: string): Promise<CommercialCatalogItem[]> {
    try {
      const effectiveAt = query.at ?? at;
      const result = await this.query.query(
        `SELECT
          p.product_id,p.code,p.name,p.service_type,p.status AS product_status,p.version AS product_version,
          p.created_at AS product_created_at,p.updated_at AS product_updated_at,
          pr.price_id,pr.price_version,pr.channel,pr.relationship_model,pr.amount_minor,pr.currency,
          pr.status AS price_status,pr.valid_from,pr.valid_until,pr.created_at AS price_created_at
        FROM commercial_products p
        JOIN commercial_prices pr ON pr.product_id=p.product_id
        WHERE p.status='ACTIVE'
          AND pr.status='ACTIVE'
          AND pr.channel=$1
          AND pr.relationship_model=$2
          AND pr.valid_from <= $3
          AND (pr.valid_until IS NULL OR pr.valid_until > $3)
        ORDER BY p.code ASC,pr.price_version DESC,pr.price_id ASC`,
        [query.channel, query.relationshipModel, effectiveAt]
      );
      const byProduct = new Map<string, CommercialCatalogItem>();
      for (const raw of result.rows) {
        const row = raw as Row;
        const product = this.mapProduct(row, 'product_');
        const price = this.mapPrice(row, 'price_');
        const current = byProduct.get(product.productId);
        if (current) {
          (current.prices as CommercialPrice[]).push(price);
        } else {
          byProduct.set(product.productId, { product, prices: [price] });
        }
      }
      return [...byProduct.values()].map(clone);
    } catch (cause) {
      if (cause instanceof CommercialCheckoutError) throw cause;
      throw unavailable(cause);
    }
  }

  async findProduct(productId: string): Promise<CommercialProduct | null> {
    try {
      const result = await this.query.query(
        'SELECT product_id,code,name,service_type,status,version,created_at,updated_at FROM commercial_products WHERE product_id=$1',
        [productId]
      );
      return result.rowCount ? this.mapProduct(result.rows[0] as Row) : null;
    } catch (cause) {
      if (cause instanceof CommercialCheckoutError) throw cause;
      throw unavailable(cause);
    }
  }

  async findPrice(priceId: string): Promise<CommercialPrice | null> {
    try {
      const result = await this.query.query(
        'SELECT price_id,product_id,price_version,channel,relationship_model,amount_minor,currency,status,valid_from,valid_until,created_at FROM commercial_prices WHERE price_id=$1',
        [priceId]
      );
      return result.rowCount ? this.mapPrice(result.rows[0] as Row) : null;
    } catch (cause) {
      if (cause instanceof CommercialCheckoutError) throw cause;
      throw unavailable(cause);
    }
  }

  async findCheckoutByIdempotencyKey(
    workspaceId: string,
    key: string
  ): Promise<CheckoutReplay | null> {
    try {
      return await this.findReplay(this.query, workspaceId, key, false);
    } catch (cause) {
      if (cause instanceof CommercialCheckoutError) throw cause;
      throw unavailable(cause);
    }
  }

  async findActiveCheckoutByOrder(
    workspaceId: string,
    orderId: string
  ): Promise<CheckoutSession | null> {
    try {
      const result = await this.query.query(
        "SELECT * FROM checkout_sessions WHERE workspace_id=$1 AND order_id=$2 AND status='INITIATED' ORDER BY created_at DESC LIMIT 1",
        [workspaceId, orderId]
      );
      return result.rowCount ? this.mapCheckout(result.rows[0] as Row) : null;
    } catch (cause) {
      throw unavailable(cause);
    }
  }

  async createCheckoutAtomically(
    checkout: CheckoutSession,
    idempotencyKey: string,
    fingerprint: string
  ): Promise<CheckoutSession> {
    try {
      return await this.database.transact(
        async (client) => {
          const replay = await this.findReplay(
            client,
            checkout.workspaceId,
            idempotencyKey,
            true
          );
          if (replay) return this.resolveReplay(replay, fingerprint);
          const active = await client.query(
            "SELECT * FROM checkout_sessions WHERE workspace_id=$1 AND order_id=$2 AND status='INITIATED' FOR UPDATE",
            [checkout.workspaceId, checkout.orderId]
          );
          if (active.rowCount)
            throw new CommercialCheckoutError(
              'ACTIVE_CHECKOUT_EXISTS',
              'Order already has an active checkout session.'
            );
          await client.query(
            `INSERT INTO checkout_sessions(
              checkout_session_id,workspace_id,order_id,initiated_by_user_id,
              product_id,product_version,price_id,price_version,amount_minor,currency,
              status,version,created_at,updated_at,expires_at,cancelled_reason
            ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
            [
              checkout.checkoutSessionId,
              checkout.workspaceId,
              checkout.orderId,
              checkout.initiatedByUserId,
              checkout.productId,
              checkout.productVersion,
              checkout.priceId,
              checkout.priceVersion,
              checkout.amount.amountMinor,
              checkout.amount.currency,
              checkout.status,
              checkout.version,
              checkout.createdAt,
              checkout.updatedAt,
              checkout.expiresAt,
              checkout.cancelledReason ?? null
            ]
          );
          await client.query(
            'INSERT INTO checkout_commands(workspace_id,idempotency_key,request_fingerprint,checkout_session_id,result_snapshot,created_at) VALUES($1,$2,$3,$4,$5::jsonb,$6)',
            [
              checkout.workspaceId,
              idempotencyKey,
              fingerprint,
              checkout.checkoutSessionId,
              JSON.stringify(checkout),
              checkout.createdAt
            ]
          );
          return clone(checkout);
        },
        { isolation: 'SERIALIZABLE' }
      );
    } catch (cause) {
      if (cause instanceof CommercialCheckoutError) throw cause;
      if (postgresCode(cause) === '23505') {
        const replay = await this.findCheckoutByIdempotencyKey(checkout.workspaceId, idempotencyKey);
        if (replay) return this.resolveReplay(replay, fingerprint);
        const active = await this.findActiveCheckoutByOrder(checkout.workspaceId, checkout.orderId);
        if (active)
          throw new CommercialCheckoutError(
            'ACTIVE_CHECKOUT_EXISTS',
            'Order already has an active checkout session.'
          );
      }
      throw unavailable(cause);
    }
  }

  async findCheckout(
    workspaceId: string,
    checkoutSessionId: string
  ): Promise<CheckoutSession | null> {
    try {
      const result = await this.query.query(
        'SELECT * FROM checkout_sessions WHERE workspace_id=$1 AND checkout_session_id=$2',
        [workspaceId, checkoutSessionId]
      );
      return result.rowCount ? this.mapCheckout(result.rows[0] as Row) : null;
    } catch (cause) {
      throw unavailable(cause);
    }
  }

  private async findReplay(
    client: QueryClient,
    workspaceId: string,
    key: string,
    lock: boolean
  ): Promise<CheckoutReplay | null> {
    const result = await client.query(
      `SELECT request_fingerprint,result_snapshot FROM checkout_commands WHERE workspace_id=$1 AND idempotency_key=$2${lock ? ' FOR UPDATE' : ''}`,
      [workspaceId, key]
    );
    if (!result.rowCount) return null;
    const row = result.rows[0] as Row;
    return {
      fingerprint: String(row.request_fingerprint),
      checkout: clone(row.result_snapshot as CheckoutSession)
    };
  }

  private resolveReplay(replay: CheckoutReplay, fingerprint: string): CheckoutSession {
    if (replay.fingerprint !== fingerprint)
      throw new CommercialCheckoutError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key has conflicting input.'
      );
    return clone(replay.checkout);
  }

  private mapProduct(row: Row, prefix = ''): CommercialProduct {
    const value: CommercialProduct = {
      schemaVersion: 1,
      productId: String(row[`${prefix}product_id`] ?? row.product_id) as CommercialProductId,
      code: String(row[`${prefix}code`] ?? row.code),
      name: String(row[`${prefix}name`] ?? row.name),
      serviceType: String(row[`${prefix}service_type`] ?? row.service_type) as CommercialProduct['serviceType'],
      status: String(row[`${prefix}status`] ?? row.status) as CommercialProduct['status'],
      version: Number(row[`${prefix}version`] ?? row.version),
      createdAt: new Date((row[`${prefix}created_at`] ?? row.created_at) as string).toISOString(),
      updatedAt: new Date((row[`${prefix}updated_at`] ?? row.updated_at) as string).toISOString()
    };
    assertCommercialProduct(value);
    return value;
  }

  private mapPrice(row: Row, prefix = ''): CommercialPrice {
    const validUntil = row[`${prefix}valid_until`] ?? row.valid_until;
    const value: CommercialPrice = {
      schemaVersion: 1,
      priceId: String(row[`${prefix}price_id`] ?? row.price_id) as CommercialPriceId,
      productId: String(row[`${prefix}product_id`] ?? row.product_id) as CommercialProductId,
      priceVersion: Number(row[`${prefix}price_version`] ?? row.price_version),
      channel: String(row[`${prefix}channel`] ?? row.channel) as CommercialPrice['channel'],
      relationshipModel: String(
        row[`${prefix}relationship_model`] ?? row.relationship_model
      ) as CommercialPrice['relationshipModel'],
      amount: {
        amountMinor: Number(row[`${prefix}amount_minor`] ?? row.amount_minor),
        currency: String(row[`${prefix}currency`] ?? row.currency)
      },
      status: String(row[`${prefix}status`] ?? row.status) as CommercialPrice['status'],
      validFrom: new Date((row[`${prefix}valid_from`] ?? row.valid_from) as string).toISOString(),
      ...(validUntil ? { validUntil: new Date(validUntil as string).toISOString() } : {}),
      createdAt: new Date((row[`${prefix}created_at`] ?? row.created_at) as string).toISOString()
    };
    assertCommercialPrice(value);
    return value;
  }

  private mapCheckout(row: Row): CheckoutSession {
    return {
      schemaVersion: 1,
      checkoutSessionId: String(row.checkout_session_id) as CheckoutSessionId,
      workspaceId: String(row.workspace_id),
      orderId: String(row.order_id) as CheckoutSession['orderId'],
      initiatedByUserId: String(row.initiated_by_user_id) as CheckoutSession['initiatedByUserId'],
      productId: String(row.product_id) as CommercialProductId,
      productVersion: Number(row.product_version),
      priceId: String(row.price_id) as CommercialPriceId,
      priceVersion: Number(row.price_version),
      amount: {
        amountMinor: Number(row.amount_minor),
        currency: String(row.currency)
      },
      status: String(row.status) as CheckoutSession['status'],
      version: Number(row.version),
      createdAt: new Date(row.created_at as string).toISOString(),
      updatedAt: new Date(row.updated_at as string).toISOString(),
      expiresAt: new Date(row.expires_at as string).toISOString(),
      ...(typeof row.cancelled_reason === 'string'
        ? { cancelledReason: row.cancelled_reason }
        : {})
    };
  }
}
