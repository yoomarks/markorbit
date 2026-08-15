import { createHash, randomUUID } from 'node:crypto';
import type { Permission, WorkspacePrincipal } from '@markorbit/contracts';
import {
  assertCommercialPrice,
  assertCommercialProduct,
  isCommercialPriceActive,
  type CheckoutSession,
  type CheckoutSessionId,
  type CommercialCatalogItem,
  type CommercialCatalogQuery,
  type CommercialPrice,
  type CommercialProduct,
  type CreateCheckoutSessionCommand
} from '@markorbit/contracts/commercial';
import type { Order } from '@markorbit/contracts/order';

export type CommercialCheckoutErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'WORKSPACE_MISMATCH'
  | 'PERMISSION_DENIED'
  | 'PRODUCT_NOT_FOUND'
  | 'PRICE_NOT_FOUND'
  | 'ORDER_NOT_FOUND'
  | 'PRODUCT_INACTIVE'
  | 'PRICE_INACTIVE'
  | 'PRICE_NOT_APPLICABLE'
  | 'ORDER_NOT_ELIGIBLE'
  | 'PRICE_ORDER_MISMATCH'
  | 'VERSION_CONFLICT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'ACTIVE_CHECKOUT_EXISTS'
  | 'PERSISTENCE_UNAVAILABLE';

export class CommercialCheckoutError extends Error {
  constructor(
    readonly code: CommercialCheckoutErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'CommercialCheckoutError';
  }
}

export interface CheckoutReplay {
  fingerprint: string;
  checkout: CheckoutSession;
}

export interface CommercialCatalogRepository {
  listCatalog(query: CommercialCatalogQuery, at: string): Promise<CommercialCatalogItem[]>;
  findProduct(productId: string): Promise<CommercialProduct | null>;
  findPrice(priceId: string): Promise<CommercialPrice | null>;
  findCheckoutByIdempotencyKey(workspaceId: string, key: string): Promise<CheckoutReplay | null>;
  findActiveCheckoutByOrder(workspaceId: string, orderId: string): Promise<CheckoutSession | null>;
  createCheckoutAtomically(
    checkout: CheckoutSession,
    idempotencyKey: string,
    fingerprint: string
  ): Promise<CheckoutSession>;
  findCheckout(workspaceId: string, checkoutSessionId: string): Promise<CheckoutSession | null>;
}

export interface CheckoutOrderSource {
  findById(workspaceId: string, orderId: string): Promise<Order | null>;
}

const clone = <T>(value: T): T => structuredClone(value);

function authorize(
  principal: WorkspacePrincipal,
  workspaceId: string,
  permission: Permission
): void {
  if (principal.kind !== 'WORKSPACE')
    throw new CommercialCheckoutError(
      'AUTHENTICATION_REQUIRED',
      'A Workspace Principal is required.'
    );
  if (principal.workspaceId !== workspaceId)
    throw new CommercialCheckoutError('WORKSPACE_MISMATCH', 'Workspace context does not match.');
  if (!principal.permissions.includes(permission))
    throw new CommercialCheckoutError('PERMISSION_DENIED', `${permission} permission is required.`);
}

function fingerprint(command: CreateCheckoutSessionCommand): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        workspaceId: command.workspaceId,
        orderId: command.orderId,
        productId: command.productId,
        expectedProductVersion: command.expectedProductVersion,
        priceId: command.priceId,
        expectedPriceVersion: command.expectedPriceVersion
      })
    )
    .digest('hex');
}

function translateContract(work: () => void): void {
  try {
    work();
  } catch (cause) {
    throw new CommercialCheckoutError(
      'PERSISTENCE_UNAVAILABLE',
      'Persisted commercial catalog data is invalid.',
      { cause: cause instanceof Error ? cause : undefined }
    );
  }
}

export class InMemoryCommercialCatalogRepository implements CommercialCatalogRepository {
  private readonly products = new Map<string, CommercialProduct>();
  private readonly prices = new Map<string, CommercialPrice>();
  private readonly checkouts = new Map<string, CheckoutSession>();
  private readonly commands = new Map<string, CheckoutReplay>();
  private chain: Promise<void> = Promise.resolve();

  putProduct(product: CommercialProduct): void {
    assertCommercialProduct(product);
    this.products.set(product.productId, clone(product));
  }

  putPrice(price: CommercialPrice): void {
    assertCommercialPrice(price);
    if (!this.products.has(price.productId))
      throw new CommercialCheckoutError('PRODUCT_NOT_FOUND', 'Commercial Product was not found.');
    this.prices.set(price.priceId, clone(price));
  }

  listCatalog(query: CommercialCatalogQuery, at: string): Promise<CommercialCatalogItem[]> {
    const eligible = [...this.prices.values()].filter(
      (price) =>
        price.channel === query.channel &&
        price.relationshipModel === query.relationshipModel &&
        isCommercialPriceActive(price, query.at ?? at)
    );
    const items = [...this.products.values()]
      .filter((product) => product.status === 'ACTIVE')
      .map((product) => ({
        product: clone(product),
        prices: eligible
          .filter((price) => price.productId === product.productId)
          .map((price) => clone(price))
      }))
      .filter((item) => item.prices.length > 0);
    return Promise.resolve(clone(items));
  }

  findProduct(productId: string): Promise<CommercialProduct | null> {
    const value = this.products.get(productId);
    return Promise.resolve(value ? clone(value) : null);
  }

  findPrice(priceId: string): Promise<CommercialPrice | null> {
    const value = this.prices.get(priceId);
    return Promise.resolve(value ? clone(value) : null);
  }

  findCheckoutByIdempotencyKey(workspaceId: string, key: string): Promise<CheckoutReplay | null> {
    const value = this.commands.get(`${workspaceId}:${key}`);
    return Promise.resolve(value ? clone(value) : null);
  }

  findActiveCheckoutByOrder(workspaceId: string, orderId: string): Promise<CheckoutSession | null> {
    const value = [...this.checkouts.values()].find(
      (checkout) =>
        checkout.workspaceId === workspaceId &&
        checkout.orderId === orderId &&
        checkout.status === 'INITIATED'
    );
    return Promise.resolve(value ? clone(value) : null);
  }

  async createCheckoutAtomically(
    checkout: CheckoutSession,
    idempotencyKey: string,
    commandFingerprint: string
  ): Promise<CheckoutSession> {
    let result!: CheckoutSession;
    const work = this.chain.then(() => {
      const commandKey = `${checkout.workspaceId}:${idempotencyKey}`;
      const replay = this.commands.get(commandKey);
      if (replay) {
        if (replay.fingerprint !== commandFingerprint)
          throw new CommercialCheckoutError(
            'IDEMPOTENCY_CONFLICT',
            'Idempotency key has conflicting input.'
          );
        result = clone(replay.checkout);
        return;
      }
      const active = [...this.checkouts.values()].find(
        (value) =>
          value.workspaceId === checkout.workspaceId &&
          value.orderId === checkout.orderId &&
          value.status === 'INITIATED'
      );
      if (active)
        throw new CommercialCheckoutError(
          'ACTIVE_CHECKOUT_EXISTS',
          'Order already has an active checkout session.'
        );
      this.checkouts.set(checkout.checkoutSessionId, clone(checkout));
      this.commands.set(commandKey, {
        fingerprint: commandFingerprint,
        checkout: clone(checkout)
      });
      result = clone(checkout);
    });
    this.chain = work.then(
      () => undefined,
      () => undefined
    );
    await work;
    return result;
  }

  findCheckout(workspaceId: string, checkoutSessionId: string): Promise<CheckoutSession | null> {
    const value = this.checkouts.get(checkoutSessionId);
    return Promise.resolve(value?.workspaceId === workspaceId ? clone(value) : null);
  }
}

export class CommercialCheckoutService {
  constructor(
    private readonly repository: CommercialCatalogRepository,
    private readonly orders: CheckoutOrderSource,
    private readonly now = () => new Date().toISOString(),
    private readonly checkoutId = () => `checkout_${randomUUID()}` as CheckoutSessionId,
    private readonly ttlMs = 30 * 60 * 1000
  ) {}

  async listCatalog(
    principal: WorkspacePrincipal,
    workspaceId: string,
    query: CommercialCatalogQuery
  ): Promise<readonly Readonly<CommercialCatalogItem>[]> {
    authorize(principal, workspaceId, 'order:read');
    const at = query.at ?? this.now();
    if (!Number.isFinite(Date.parse(at)))
      throw new CommercialCheckoutError('PRICE_NOT_APPLICABLE', 'Catalog effective time is invalid.');
    const values = await this.repository.listCatalog(query, at);
    for (const item of values) {
      translateContract(() => assertCommercialProduct(item.product));
      for (const price of item.prices) translateContract(() => assertCommercialPrice(price));
    }
    return Object.freeze(values.map((value) => Object.freeze(clone(value))));
  }

  async createCheckout(
    principal: WorkspacePrincipal,
    command: CreateCheckoutSessionCommand
  ): Promise<Readonly<CheckoutSession>> {
    authorize(principal, command.workspaceId, 'order:update');
    const commandFingerprint = fingerprint(command);
    const replay = await this.repository.findCheckoutByIdempotencyKey(
      command.workspaceId,
      command.idempotencyKey
    );
    if (replay) {
      if (replay.fingerprint !== commandFingerprint)
        throw new CommercialCheckoutError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key has conflicting input.'
        );
      return Object.freeze(clone(replay.checkout));
    }

    const [product, price, order] = await Promise.all([
      this.repository.findProduct(command.productId),
      this.repository.findPrice(command.priceId),
      this.orders.findById(command.workspaceId, command.orderId)
    ]);
    if (!product)
      throw new CommercialCheckoutError('PRODUCT_NOT_FOUND', 'Commercial Product was not found.');
    if (!price)
      throw new CommercialCheckoutError('PRICE_NOT_FOUND', 'Commercial Price was not found.');
    if (!order) throw new CommercialCheckoutError('ORDER_NOT_FOUND', 'Order was not found.');
    translateContract(() => assertCommercialProduct(product));
    translateContract(() => assertCommercialPrice(price));

    if (product.version !== command.expectedProductVersion)
      throw new CommercialCheckoutError(
        'VERSION_CONFLICT',
        'Commercial Product version does not match expectedProductVersion.'
      );
    if (price.priceVersion !== command.expectedPriceVersion)
      throw new CommercialCheckoutError(
        'VERSION_CONFLICT',
        'Commercial Price version does not match expectedPriceVersion.'
      );
    if (product.status !== 'ACTIVE')
      throw new CommercialCheckoutError('PRODUCT_INACTIVE', 'Commercial Product is not active.');
    const at = this.now();
    if (!isCommercialPriceActive(price, at))
      throw new CommercialCheckoutError('PRICE_INACTIVE', 'Commercial Price is not active.');
    if (price.productId !== product.productId)
      throw new CommercialCheckoutError(
        'PRICE_NOT_APPLICABLE',
        'Commercial Price does not belong to the selected Product.'
      );
    if (
      price.channel !== order.channel ||
      price.relationshipModel !== order.relationshipModel ||
      product.serviceType !== order.orderType
    )
      throw new CommercialCheckoutError(
        'PRICE_NOT_APPLICABLE',
        'Commercial Price is not applicable to this Order.'
      );
    if (order.status !== 'Confirmed')
      throw new CommercialCheckoutError(
        'ORDER_NOT_ELIGIBLE',
        'Only a Confirmed Order can initiate checkout.'
      );
    if (
      price.amount.currency !== order.commercialSourceSnapshot.quote.currency ||
      price.amount.amountMinor !== order.commercialSourceSnapshot.quote.totalMinor
    )
      throw new CommercialCheckoutError(
        'PRICE_ORDER_MISMATCH',
        'Governed Price no longer matches the immutable Order quote snapshot.'
      );

    const existing = await this.repository.findActiveCheckoutByOrder(
      command.workspaceId,
      command.orderId
    );
    if (existing)
      throw new CommercialCheckoutError(
        'ACTIVE_CHECKOUT_EXISTS',
        'Order already has an active checkout session.'
      );

    const checkout: CheckoutSession = {
      schemaVersion: 1,
      checkoutSessionId: this.checkoutId(),
      workspaceId: command.workspaceId,
      orderId: command.orderId,
      initiatedByUserId: principal.userId as CheckoutSession['initiatedByUserId'],
      productId: product.productId,
      productVersion: product.version,
      priceId: price.priceId,
      priceVersion: price.priceVersion,
      amount: clone(price.amount),
      status: 'INITIATED',
      version: 1,
      createdAt: at,
      updatedAt: at,
      expiresAt: new Date(Date.parse(at) + this.ttlMs).toISOString()
    };
    return Object.freeze(
      await this.repository.createCheckoutAtomically(
        checkout,
        command.idempotencyKey,
        commandFingerprint
      )
    );
  }

  async getCheckout(
    principal: WorkspacePrincipal,
    workspaceId: string,
    checkoutSessionId: string
  ): Promise<Readonly<CheckoutSession>> {
    authorize(principal, workspaceId, 'order:read');
    const value = await this.repository.findCheckout(workspaceId, checkoutSessionId);
    if (!value)
      throw new CommercialCheckoutError('ORDER_NOT_FOUND', 'Checkout session was not found.');
    return Object.freeze(clone(value));
  }
}
