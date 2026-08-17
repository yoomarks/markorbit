import type { InternalOperatorPrincipal } from '@markorbit/contracts';
import type { FormalMatter, FormalMatterListQuery, FormalMatterListResponse } from '@markorbit/contracts';
import type { CheckoutSession, CommercialCatalogItem, CommercialCatalogQuery } from '@markorbit/contracts/commercial';
import type { Order } from '@markorbit/contracts/order';
import type { CommercialCatalogRepository } from './commercial-checkout.js';
import type { FormalMatterRepository } from './formal-matter.js';
import type { OrderAuditView, OrderListQuery, OrderListResponse, OrderRepository } from './order-persistence.js';

export type MarkRegCommercialAdminReadErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'ORDER_NOT_FOUND'
  | 'CHECKOUT_NOT_FOUND'
  | 'FORMAL_MATTER_NOT_FOUND';

export class MarkRegCommercialAdminReadError extends Error {
  constructor(
    readonly code: MarkRegCommercialAdminReadErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'MarkRegCommercialAdminReadError';
  }
}

export interface MarkRegAdminOrderInspection {
  schemaVersion: 1;
  source: Readonly<{ domain: 'MARKREG'; authority: 'ORDER' }>;
  order: Readonly<Order>;
  audit: readonly Readonly<OrderAuditView>[];
}

export interface MarkRegAdminCheckoutInspection {
  schemaVersion: 1;
  source: Readonly<{ domain: 'MARKREG'; authority: 'CHECKOUT' }>;
  checkout: Readonly<CheckoutSession>;
}

export interface MarkRegAdminMatterInspection {
  schemaVersion: 1;
  source: Readonly<{ domain: 'MARKREG'; authority: 'FORMAL_MATTER' }>;
  matter: Readonly<FormalMatter>;
}

function authorize(principal: InternalOperatorPrincipal): void {
  if (principal.kind !== 'INTERNAL_OPERATOR')
    throw new MarkRegCommercialAdminReadError(
      'AUTHENTICATION_REQUIRED',
      'An INTERNAL_OPERATOR Principal is required.'
    );
  if (!principal.capabilities.includes('commercial-admin:read'))
    throw new MarkRegCommercialAdminReadError(
      'PERMISSION_DENIED',
      'commercial-admin:read capability is required.'
    );
}

const freezeClone = <T>(value: T): Readonly<T> => Object.freeze(structuredClone(value));

export class MarkRegCommercialAdminReadService {
  constructor(
    private readonly commercial: CommercialCatalogRepository,
    private readonly orders: OrderRepository,
    private readonly matters: FormalMatterRepository,
    private readonly now = () => new Date().toISOString()
  ) {}

  async listCatalog(
    principal: InternalOperatorPrincipal,
    query: CommercialCatalogQuery
  ): Promise<readonly Readonly<CommercialCatalogItem>[]> {
    authorize(principal);
    const values = await this.commercial.listCatalog(query, query.at ?? this.now());
    return Object.freeze(values.map(freezeClone));
  }

  async inspectCheckout(
    principal: InternalOperatorPrincipal,
    workspaceId: string,
    checkoutSessionId: string
  ): Promise<Readonly<MarkRegAdminCheckoutInspection>> {
    authorize(principal);
    const checkout = await this.commercial.findCheckout(workspaceId, checkoutSessionId);
    if (!checkout)
      throw new MarkRegCommercialAdminReadError('CHECKOUT_NOT_FOUND', 'Checkout was not found.');
    return Object.freeze({
      schemaVersion: 1,
      source: Object.freeze({ domain: 'MARKREG', authority: 'CHECKOUT' }),
      checkout: freezeClone(checkout)
    });
  }

  async listOrders(
    principal: InternalOperatorPrincipal,
    workspaceId: string,
    query: OrderListQuery
  ): Promise<Readonly<OrderListResponse>> {
    authorize(principal);
    return freezeClone(await this.orders.list(workspaceId, query));
  }

  async inspectOrder(
    principal: InternalOperatorPrincipal,
    workspaceId: string,
    orderId: string
  ): Promise<Readonly<MarkRegAdminOrderInspection>> {
    authorize(principal);
    const order = await this.orders.findById(workspaceId, orderId);
    if (!order)
      throw new MarkRegCommercialAdminReadError('ORDER_NOT_FOUND', 'Order was not found.');
    const audit = await this.orders.listAudit(workspaceId, orderId);
    return Object.freeze({
      schemaVersion: 1,
      source: Object.freeze({ domain: 'MARKREG', authority: 'ORDER' }),
      order: freezeClone(order),
      audit: Object.freeze(audit.map(freezeClone))
    });
  }

  async listMatters(
    principal: InternalOperatorPrincipal,
    workspaceId: string,
    query: FormalMatterListQuery
  ): Promise<Readonly<FormalMatterListResponse>> {
    authorize(principal);
    return freezeClone(await this.matters.list(workspaceId, query));
  }

  async inspectMatter(
    principal: InternalOperatorPrincipal,
    workspaceId: string,
    formalMatterId: string
  ): Promise<Readonly<MarkRegAdminMatterInspection>> {
    authorize(principal);
    const matter = await this.matters.findById(workspaceId, formalMatterId);
    if (!matter)
      throw new MarkRegCommercialAdminReadError(
        'FORMAL_MATTER_NOT_FOUND',
        'Formal Matter was not found.'
      );
    return Object.freeze({
      schemaVersion: 1,
      source: Object.freeze({ domain: 'MARKREG', authority: 'FORMAL_MATTER' }),
      matter: freezeClone(matter)
    });
  }
}
