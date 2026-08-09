import {
  AuthenticationError,
  channels,
  parseInternalWorkspacePrincipal,
  relationshipModels,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import {
  isOrderStatus,
  orderTypes,
  type CancelOrderCommand,
  type ConfirmOrderCommand,
  type CreateMatterFromOrderCommand,
  type CreateOrderCommand,
  type EvaluateOrderReadinessCommand,
  type LinkExistingMatterToOrderCommand,
  type RequestOrderConfirmationCommand
} from '@markorbit/contracts/order';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  OrderMatterConversionError,
  type OrderMatterConversionResult,
  type PostgresOrderMatterConversionService
} from './order-matter-conversion.js';
import type { OrderListQuery } from './order-persistence.js';
import {
  OrderServiceError,
  type OrderProjection,
  type OrderProjectionListResponse,
  type OrderService
} from './order-service.js';

export interface OrderHttpOptions {
  orderService?: Pick<
    OrderService,
    'create' | 'get' | 'list' | 'requestConfirmation' | 'confirm' | 'evaluateReadiness' | 'cancel'
  >;
  conversionService?: Pick<
    PostgresOrderMatterConversionService,
    'createMatterFromOrder' | 'linkExistingMatter'
  >;
  internalServiceSecret?: string;
}

const actorSpoofFields = [
  'actorId',
  'userId',
  'createdByUserId',
  'updatedByUserId',
  'linkedByUserId',
  'membershipId'
] as const;

function bodyRecord(request: JsonRequest): Record<string, unknown> {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Record<string, unknown>;
}

function rejectActorSpoof(body: Readonly<Record<string, unknown>>): void {
  if (actorSpoofFields.some((field) => Object.prototype.hasOwnProperty.call(body, field)))
    throw new HttpError(
      400,
      'ACTOR_SPOOF_REJECTED',
      'Actor identity is derived from the authenticated Principal.'
    );
}

function principalFor(
  request: JsonRequest,
  internalServiceSecret: string | undefined
): WorkspacePrincipal {
  if (
    !internalServiceSecret ||
    request.headers['x-markorbit-internal-authorization'] !== internalServiceSecret
  )
    throw new HttpError(
      401,
      'INTERNAL_SERVICE_UNAUTHORIZED',
      'Internal service authentication is required.'
    );
  let principal: WorkspacePrincipal;
  try {
    principal = parseInternalWorkspacePrincipal(request.headers['x-markorbit-principal']);
  } catch (error) {
    if (error instanceof AuthenticationError) throw new HttpError(401, error.code, error.message);
    throw error;
  }
  const headerWorkspace = request.headers['x-markorbit-workspace-id'];
  if (headerWorkspace && headerWorkspace !== principal.workspaceId)
    throw new HttpError(
      403,
      'WORKSPACE_MISMATCH',
      'Workspace context does not match Principal truth.'
    );
  return principal;
}

function commandWorkspace(
  principal: WorkspacePrincipal,
  body: Readonly<Record<string, unknown>>
): string {
  const requested = body.workspaceId;
  if (requested !== undefined && requested !== principal.workspaceId)
    throw new HttpError(
      403,
      'WORKSPACE_MISMATCH',
      'Workspace context does not match Principal truth.'
    );
  return principal.workspaceId;
}

function idempotencyKey(request: JsonRequest, body: Readonly<Record<string, unknown>>): string {
  const header = request.headers['idempotency-key'];
  if (!header) throw new HttpError(400, 'INVALID_REQUEST', 'Idempotency-Key header is required.');
  if (body.idempotencyKey !== undefined && body.idempotencyKey !== header)
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'Request idempotencyKey must match Idempotency-Key header.'
    );
  return header;
}

function correlation(request: JsonRequest): string | undefined {
  return request.headers['x-correlation-id'];
}

function orderService(options: OrderHttpOptions) {
  if (!options.orderService)
    throw new HttpError(503, 'PERSISTENCE_UNAVAILABLE', 'Order service is unavailable.', true);
  return options.orderService;
}

function conversionService(options: OrderHttpOptions) {
  if (!options.conversionService)
    throw new HttpError(
      503,
      'PERSISTENCE_UNAVAILABLE',
      'Order-to-Matter conversion service is unavailable.',
      true
    );
  return options.conversionService;
}

function translate(error: unknown): never {
  if (!(error instanceof OrderServiceError) && !(error instanceof OrderMatterConversionError))
    throw error;
  const code = error.code;
  const status =
    code === 'AUTHENTICATION_REQUIRED'
      ? 401
      : code === 'PERMISSION_DENIED' || code === 'WORKSPACE_MISMATCH'
        ? 403
        : code === 'ORDER_NOT_FOUND' ||
            code === 'FORMAL_MATTER_NOT_FOUND' ||
            code === 'SOURCE_NOT_FOUND'
          ? 404
          : code === 'PERSISTENCE_UNAVAILABLE'
            ? 503
            : code === 'POLICY_DENIED'
              ? 400
              : 409;
  throw new HttpError(status, code, error.message, status === 503);
}

async function run<T>(status: number, work: () => Promise<T>) {
  try {
    return json(status, await work());
  } catch (error) {
    return translate(error);
  }
}

function expectedVersion(
  body: Readonly<Record<string, unknown>>,
  field = 'expectedVersion'
): number {
  const value = body[field];
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be a positive integer.`);
  return Number(value);
}

function requiredText(body: Readonly<Record<string, unknown>>, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim().length === 0)
    throw new HttpError(400, 'INVALID_REQUEST', `${field} is required.`);
  return value;
}

function requiredEnum<const T extends readonly string[]>(
  body: Readonly<Record<string, unknown>>,
  field: string,
  values: T
): T[number] {
  const value = requiredText(body, field);
  const match = values.find((candidate) => candidate === value);
  if (!match) throw new HttpError(400, 'INVALID_REQUEST', `${field} is invalid.`);
  return match;
}

export function createOrderHttpRoutes(options: OrderHttpOptions): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/v1/orders',
      handle: (request) => {
        const body = bodyRecord(request);
        rejectActorSpoof(body);
        const principal = principalFor(request, options.internalServiceSecret);
        const workspaceId = commandWorkspace(principal, body);
        const key = idempotencyKey(request, body);
        const command: CreateOrderCommand = {
          workspaceId,
          orderType: requiredEnum(body, 'orderType', orderTypes),
          quoteId: requiredText(body, 'quoteId') as CreateOrderCommand['quoteId'],
          expectedQuoteVersion: requiredText(body, 'expectedQuoteVersion'),
          customerConfirmationId: requiredText(
            body,
            'customerConfirmationId'
          ) as CreateOrderCommand['customerConfirmationId'],
          expectedCustomerConfirmationVersion: expectedVersion(
            body,
            'expectedCustomerConfirmationVersion'
          ),
          channel: requiredEnum(body, 'channel', channels),
          relationshipModel: requiredEnum(body, 'relationshipModel', relationshipModels),
          idempotencyKey: key
        };
        return run<Readonly<OrderProjection>>(201, () =>
          orderService(options).create(principal, command, correlation(request))
        );
      }
    },
    {
      method: 'GET',
      path: '/v1/orders',
      handle: (request) => {
        const principal = principalFor(request, options.internalServiceSecret);
        const page = request.query.page === undefined ? 1 : Number(request.query.page);
        const pageSize = request.query.pageSize === undefined ? 20 : Number(request.query.pageSize);
        if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize))
          throw new HttpError(400, 'INVALID_REQUEST', 'Order pagination is invalid.');
        const status = request.query.status;
        if (status && !isOrderStatus(status))
          throw new HttpError(400, 'INVALID_REQUEST', 'Order status filter is invalid.');
        const query: OrderListQuery = { page, pageSize };
        if (status) query.status = status;
        if (request.query.customerId) query.customerId = request.query.customerId;
        return run<Readonly<OrderProjectionListResponse>>(200, () =>
          orderService(options).list(principal, principal.workspaceId, query)
        );
      }
    },
    {
      method: 'GET',
      path: '/v1/orders/:orderId',
      handle: (request) => {
        const principal = principalFor(request, options.internalServiceSecret);
        return run<Readonly<OrderProjection>>(200, () =>
          orderService(options).get(principal, principal.workspaceId, request.params.orderId!)
        );
      }
    },
    {
      method: 'POST',
      path: '/v1/orders/:orderId/request-confirmation',
      handle: (request) => {
        const body = bodyRecord(request);
        rejectActorSpoof(body);
        const principal = principalFor(request, options.internalServiceSecret);
        const command: RequestOrderConfirmationCommand = {
          workspaceId: commandWorkspace(principal, body),
          orderId: request.params.orderId as RequestOrderConfirmationCommand['orderId'],
          expectedVersion: expectedVersion(body),
          idempotencyKey: idempotencyKey(request, body)
        };
        return run(200, () =>
          orderService(options).requestConfirmation(principal, command, correlation(request))
        );
      }
    },
    {
      method: 'POST',
      path: '/v1/orders/:orderId/confirm',
      handle: (request) => {
        const body = bodyRecord(request);
        rejectActorSpoof(body);
        const principal = principalFor(request, options.internalServiceSecret);
        const command: ConfirmOrderCommand = {
          workspaceId: commandWorkspace(principal, body),
          orderId: request.params.orderId as ConfirmOrderCommand['orderId'],
          expectedVersion: expectedVersion(body),
          idempotencyKey: idempotencyKey(request, body)
        };
        return run(200, () =>
          orderService(options).confirm(principal, command, correlation(request))
        );
      }
    },
    {
      method: 'POST',
      path: '/v1/orders/:orderId/evaluate-readiness',
      handle: (request) => {
        const body = bodyRecord(request);
        rejectActorSpoof(body);
        const principal = principalFor(request, options.internalServiceSecret);
        const command: EvaluateOrderReadinessCommand = {
          workspaceId: commandWorkspace(principal, body),
          orderId: request.params.orderId as EvaluateOrderReadinessCommand['orderId'],
          expectedVersion: expectedVersion(body),
          idempotencyKey: idempotencyKey(request, body)
        };
        return run(200, () =>
          orderService(options).evaluateReadiness(principal, command, correlation(request))
        );
      }
    },
    {
      method: 'POST',
      path: '/v1/orders/:orderId/create-matter',
      handle: (request) => {
        const body = bodyRecord(request);
        rejectActorSpoof(body);
        const principal = principalFor(request, options.internalServiceSecret);
        const command: CreateMatterFromOrderCommand = {
          workspaceId: commandWorkspace(principal, body),
          orderId: request.params.orderId as CreateMatterFromOrderCommand['orderId'],
          expectedOrderVersion: expectedVersion(body, 'expectedOrderVersion'),
          expectedCommercialSourceSha256: requiredText(body, 'expectedCommercialSourceSha256'),
          idempotencyKey: idempotencyKey(request, body)
        };
        return run<OrderMatterConversionResult>(200, () =>
          conversionService(options).createMatterFromOrder(principal, command, correlation(request))
        );
      }
    },
    {
      method: 'POST',
      path: '/v1/orders/:orderId/link-matter',
      handle: (request) => {
        const body = bodyRecord(request);
        rejectActorSpoof(body);
        const principal = principalFor(request, options.internalServiceSecret);
        const command: LinkExistingMatterToOrderCommand = {
          workspaceId: commandWorkspace(principal, body),
          orderId: request.params.orderId as LinkExistingMatterToOrderCommand['orderId'],
          expectedOrderVersion: expectedVersion(body, 'expectedOrderVersion'),
          formalMatterId: requiredText(
            body,
            'formalMatterId'
          ) as LinkExistingMatterToOrderCommand['formalMatterId'],
          expectedFormalMatterVersion: expectedVersion(body, 'expectedFormalMatterVersion'),
          expectedCommercialSourceSha256: requiredText(body, 'expectedCommercialSourceSha256'),
          idempotencyKey: idempotencyKey(request, body)
        };
        return run<OrderMatterConversionResult>(200, () =>
          conversionService(options).linkExistingMatter(principal, command, correlation(request))
        );
      }
    },
    {
      method: 'POST',
      path: '/v1/orders/:orderId/cancel',
      handle: (request) => {
        const body = bodyRecord(request);
        rejectActorSpoof(body);
        const principal = principalFor(request, options.internalServiceSecret);
        const command: CancelOrderCommand = {
          workspaceId: commandWorkspace(principal, body),
          orderId: request.params.orderId as CancelOrderCommand['orderId'],
          expectedVersion: expectedVersion(body),
          reason: requiredText(body, 'reason'),
          idempotencyKey: idempotencyKey(request, body)
        };
        return run(200, () =>
          orderService(options).cancel(principal, command, correlation(request))
        );
      }
    }
  ];
}
