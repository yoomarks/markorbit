import {
  AuthenticationError,
  channels,
  parseInternalWorkspacePrincipal,
  relationshipModels,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type {
  CheckoutSession,
  CommercialCatalogItem,
  CreateCheckoutSessionCommand
} from '@markorbit/contracts/commercial';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { CommercialCheckoutError, type CommercialCheckoutService } from './commercial-checkout.js';

export interface CommercialCheckoutHttpOptions {
  service?: Pick<CommercialCheckoutService, 'listCatalog' | 'createCheckout' | 'getCheckout'>;
  internalServiceSecret?: string;
}

const actorSpoofFields = [
  'actorId',
  'userId',
  'initiatedByUserId',
  'membershipId',
  'amount',
  'amountMinor',
  'currency'
] as const;

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
  try {
    const principal = parseInternalWorkspacePrincipal(request.headers['x-markorbit-principal']);
    const headerWorkspace = request.headers['x-markorbit-workspace-id'];
    if (headerWorkspace && headerWorkspace !== principal.workspaceId)
      throw new HttpError(
        403,
        'WORKSPACE_MISMATCH',
        'Workspace context does not match Principal truth.'
      );
    return principal;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof AuthenticationError) throw new HttpError(401, error.code, error.message);
    throw error;
  }
}

function service(options: CommercialCheckoutHttpOptions) {
  if (!options.service)
    throw new HttpError(
      503,
      'PERSISTENCE_UNAVAILABLE',
      'Commercial checkout service is unavailable.',
      true
    );
  return options.service;
}

function bodyRecord(request: JsonRequest): Record<string, unknown> {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Record<string, unknown>;
}

function rejectSpoof(body: Readonly<Record<string, unknown>>): void {
  if (actorSpoofFields.some((field) => Object.prototype.hasOwnProperty.call(body, field)))
    throw new HttpError(
      400,
      'ACTOR_SPOOF_REJECTED',
      'Identity and monetary truth are derived from governed server state.'
    );
}

function requiredText(body: Readonly<Record<string, unknown>>, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim().length === 0)
    throw new HttpError(400, 'INVALID_REQUEST', `${field} is required.`);
  return value;
}

function positiveInteger(body: Readonly<Record<string, unknown>>, field: string): number {
  const value = body[field];
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new HttpError(400, 'INVALID_REQUEST', `${field} must be a positive integer.`);
  return Number(value);
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

function translate(error: unknown): never {
  if (!(error instanceof CommercialCheckoutError)) throw error;
  const status =
    error.code === 'AUTHENTICATION_REQUIRED'
      ? 401
      : error.code === 'PERMISSION_DENIED' || error.code === 'WORKSPACE_MISMATCH'
        ? 403
        : error.code === 'PRODUCT_NOT_FOUND' ||
            error.code === 'PRICE_NOT_FOUND' ||
            error.code === 'ORDER_NOT_FOUND'
          ? 404
          : error.code === 'PERSISTENCE_UNAVAILABLE'
            ? 503
            : error.code === 'PRODUCT_INACTIVE' ||
                error.code === 'PRICE_INACTIVE' ||
                error.code === 'PRICE_NOT_APPLICABLE' ||
                error.code === 'ORDER_NOT_ELIGIBLE' ||
                error.code === 'PRICE_ORDER_MISMATCH'
              ? 422
              : 409;
  throw new HttpError(status, error.code, error.message, status === 503);
}

async function run<T>(status: number, work: () => Promise<T>) {
  try {
    return json(status, await work());
  } catch (error) {
    return translate(error);
  }
}

export function createCommercialCheckoutHttpRoutes(
  options: CommercialCheckoutHttpOptions
): readonly JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/v1/commercial/catalog',
      handle: (request) => {
        const principal = principalFor(request, options.internalServiceSecret);
        const channel = channels.find((value) => value === request.query.channel);
        const relationshipModel = relationshipModels.find(
          (value) => value === request.query.relationshipModel
        );
        if (!channel || !relationshipModel)
          throw new HttpError(
            400,
            'INVALID_REQUEST',
            'channel and relationshipModel are required and must be valid.'
          );
        return run<readonly Readonly<CommercialCatalogItem>[]>(200, () =>
          service(options).listCatalog(principal, principal.workspaceId, {
            channel,
            relationshipModel
          })
        );
      }
    },
    {
      method: 'POST',
      path: '/v1/checkouts',
      handle: (request) => {
        const body = bodyRecord(request);
        rejectSpoof(body);
        const principal = principalFor(request, options.internalServiceSecret);
        if (body.workspaceId !== undefined && body.workspaceId !== principal.workspaceId)
          throw new HttpError(
            403,
            'WORKSPACE_MISMATCH',
            'Workspace context does not match Principal truth.'
          );
        const command: CreateCheckoutSessionCommand = {
          workspaceId: principal.workspaceId,
          orderId: requiredText(body, 'orderId') as CreateCheckoutSessionCommand['orderId'],
          productId: requiredText(body, 'productId') as CreateCheckoutSessionCommand['productId'],
          expectedProductVersion: positiveInteger(body, 'expectedProductVersion'),
          priceId: requiredText(body, 'priceId') as CreateCheckoutSessionCommand['priceId'],
          expectedPriceVersion: positiveInteger(body, 'expectedPriceVersion'),
          idempotencyKey: idempotencyKey(request, body)
        };
        return run<Readonly<CheckoutSession>>(201, () =>
          service(options).createCheckout(principal, command)
        );
      }
    },
    {
      method: 'GET',
      path: '/v1/checkouts/:checkoutSessionId',
      handle: (request) => {
        const principal = principalFor(request, options.internalServiceSecret);
        return run<Readonly<CheckoutSession>>(200, () =>
          service(options).getCheckout(
            principal,
            principal.workspaceId,
            request.params.checkoutSessionId!
          )
        );
      }
    }
  ];
}
