import {
  AuthenticationError,
  channels,
  parseInternalOperatorPrincipal,
  relationshipModels,
  type FormalMatterListQuery,
  type InternalOperatorPrincipal
} from '@markorbit/contracts';
import { orderStatuses } from '@markorbit/contracts/order';
import type { CommercialCatalogQuery } from '@markorbit/contracts/commercial';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  MarkRegCommercialAdminReadError,
  type MarkRegCommercialAdminReadService
} from './commercial-admin-read.js';
import type { OrderListQuery } from './order-persistence.js';

export interface MarkRegCommercialAdminHttpOptions {
  service?: MarkRegCommercialAdminReadService;
  internalServiceSecret?: string;
}

function service(options: MarkRegCommercialAdminHttpOptions): MarkRegCommercialAdminReadService {
  if (!options.service)
    throw new HttpError(
      503,
      'PERSISTENCE_UNAVAILABLE',
      'MarkReg commercial admin read service is unavailable.',
      true
    );
  return options.service;
}

function principalFor(
  request: JsonRequest,
  internalServiceSecret: string | undefined
): InternalOperatorPrincipal {
  if (
    !internalServiceSecret ||
    request.headers['x-markorbit-internal-authorization'] !== internalServiceSecret
  )
    throw new HttpError(
      401,
      'INTERNAL_SERVICE_UNAUTHORIZED',
      'Internal service authentication is required.'
    );
  try {
    return parseInternalOperatorPrincipal(request.headers['x-markorbit-principal']);
  } catch (error) {
    if (error instanceof AuthenticationError) throw new HttpError(401, error.code, error.message);
    throw error;
  }
}

function translate(error: unknown): never {
  if (!(error instanceof MarkRegCommercialAdminReadError)) throw error;
  const status =
    error.code === 'AUTHENTICATION_REQUIRED'
      ? 401
      : error.code === 'PERMISSION_DENIED'
        ? 403
        : 404;
  throw new HttpError(status, error.code, error.message);
}

async function run<T>(work: () => Promise<T>) {
  try {
    return json(200, await work());
  } catch (error) {
    return translate(error);
  }
}

function positiveInteger(value: string | undefined, fallback: number, name: string): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1)
    throw new HttpError(400, 'INVALID_REQUEST', `${name} must be a positive integer.`);
  return parsed;
}

function workspace(request: JsonRequest): string {
  const value = request.params.workspaceId;
  if (!value) throw new HttpError(400, 'WORKSPACE_CONTEXT_REQUIRED', 'Workspace is required.');
  return value;
}

export function createMarkRegCommercialAdminHttpRoutes(
  options: MarkRegCommercialAdminHttpOptions
): readonly JsonRoute[] {
  const principal = (request: JsonRequest) => principalFor(request, options.internalServiceSecret);
  return [
    {
      method: 'GET',
      path: '/internal/commercial-admin/catalog',
      handle: (request) => {
        const channel = channels.find((value) => value === request.query.channel);
        const relationshipModel = relationshipModels.find(
          (value) => value === request.query.relationshipModel
        );
        if (!channel || !relationshipModel)
          throw new HttpError(
            400,
            'INVALID_REQUEST',
            'channel and relationshipModel are required.'
          );
        const query: CommercialCatalogQuery = {
          channel,
          relationshipModel,
          ...(request.query.at ? { at: request.query.at } : {})
        };
        return run(() => service(options).listCatalog(principal(request), query));
      }
    },
    {
      method: 'GET',
      path: '/internal/commercial-admin/workspaces/:workspaceId/orders',
      handle: (request) => {
        const status = request.query.status
          ? orderStatuses.find((value) => value === request.query.status)
          : undefined;
        if (request.query.status && !status)
          throw new HttpError(400, 'INVALID_REQUEST', 'Order status filter is invalid.');
        const query: OrderListQuery = {
          page: positiveInteger(request.query.page, 1, 'page'),
          pageSize: positiveInteger(request.query.pageSize, 20, 'pageSize'),
          ...(status ? { status } : {}),
          ...(request.query.customerId ? { customerId: request.query.customerId } : {})
        };
        if (query.pageSize > 100)
          throw new HttpError(400, 'INVALID_REQUEST', 'pageSize cannot exceed 100.');
        return run(() => service(options).listOrders(principal(request), workspace(request), query));
      }
    },
    {
      method: 'GET',
      path: '/internal/commercial-admin/workspaces/:workspaceId/orders/:orderId',
      handle: (request) =>
        run(() =>
          service(options).inspectOrder(
            principal(request),
            workspace(request),
            request.params.orderId!
          )
        )
    },
    {
      method: 'GET',
      path: '/internal/commercial-admin/workspaces/:workspaceId/checkouts/:checkoutSessionId',
      handle: (request) =>
        run(() =>
          service(options).inspectCheckout(
            principal(request),
            workspace(request),
            request.params.checkoutSessionId!
          )
        )
    },
    {
      method: 'GET',
      path: '/internal/commercial-admin/workspaces/:workspaceId/matters',
      handle: (request) => {
        if (request.query.status && request.query.status !== 'OPEN')
          throw new HttpError(400, 'INVALID_REQUEST', 'Formal Matter status filter is invalid.');
        if (request.query.type && request.query.type !== 'TRADEMARK_REGISTRATION')
          throw new HttpError(400, 'INVALID_REQUEST', 'Formal Matter type filter is invalid.');
        const query: FormalMatterListQuery = {
          page: positiveInteger(request.query.page, 1, 'page'),
          pageSize: positiveInteger(request.query.pageSize, 20, 'pageSize'),
          ...(request.query.status === 'OPEN' ? { status: 'OPEN' as const } : {}),
          ...(request.query.type === 'TRADEMARK_REGISTRATION'
            ? { type: 'TRADEMARK_REGISTRATION' as const }
            : {}),
          ...(request.query.search ? { search: request.query.search } : {}),
          ...(request.query.createdFrom ? { createdFrom: request.query.createdFrom } : {}),
          ...(request.query.createdTo ? { createdTo: request.query.createdTo } : {})
        };
        if (query.pageSize > 100)
          throw new HttpError(400, 'INVALID_REQUEST', 'pageSize cannot exceed 100.');
        return run(() => service(options).listMatters(principal(request), workspace(request), query));
      }
    },
    {
      method: 'GET',
      path: '/internal/commercial-admin/workspaces/:workspaceId/matters/:formalMatterId',
      handle: (request) =>
        run(() =>
          service(options).inspectMatter(
            principal(request),
            workspace(request),
            request.params.formalMatterId!
          )
        )
    }
  ];
}
