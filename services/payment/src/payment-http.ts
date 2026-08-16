import {
  AuthenticationError,
  parseInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type { InitiatePaymentCommand, Payment, PaymentId } from '@markorbit/contracts/payment';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { PaymentServiceError, type PaymentService } from './payment-service.js';

export interface PaymentHttpOptions {
  service?: Pick<PaymentService, 'initiatePayment' | 'getPayment'>;
  internalServiceSecret?: string;
}

const spoofFields = [
  'actorId',
  'userId',
  'initiatedByUserId',
  'membershipId',
  'orderId',
  'productId',
  'productVersion',
  'priceId',
  'priceVersion',
  'amount',
  'amountMinor',
  'currency',
  'status',
  'provider',
  'providerPaymentReference'
] as const;

function bodyRecord(request: JsonRequest): Record<string, unknown> {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  return request.body as Record<string, unknown>;
}

function principalFor(request: JsonRequest, secret: string | undefined): WorkspacePrincipal {
  if (!secret || request.headers['x-markorbit-internal-authorization'] !== secret)
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

function paymentService(options: PaymentHttpOptions) {
  if (!options.service)
    throw new HttpError(503, 'PERSISTENCE_UNAVAILABLE', 'Payment service is unavailable.', true);
  return options.service;
}

function requiredText(body: Readonly<Record<string, unknown>>, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim().length === 0)
    throw new HttpError(400, 'INVALID_REQUEST', `${field} is required.`);
  return value;
}

function rejectSpoof(body: Readonly<Record<string, unknown>>): void {
  if (spoofFields.some((field) => Object.prototype.hasOwnProperty.call(body, field)))
    throw new HttpError(
      400,
      'MONETARY_OR_ACTOR_SPOOF_REJECTED',
      'Payment identity, provider state, and monetary truth are derived from governed server state.'
    );
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
  if (!(error instanceof PaymentServiceError)) throw error;
  const status =
    error.code === 'AUTHENTICATION_REQUIRED'
      ? 401
      : error.code === 'WORKSPACE_MISMATCH' || error.code === 'PERMISSION_DENIED'
        ? 403
        : error.code === 'CHECKOUT_NOT_FOUND' || error.code === 'PAYMENT_NOT_FOUND'
          ? 404
          : error.code === 'PERSISTENCE_UNAVAILABLE' || error.code === 'PROVIDER_UNAVAILABLE'
            ? 503
            : error.code === 'CHECKOUT_NOT_PAYABLE' || error.code === 'CHECKOUT_EXPIRED'
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

export function createPaymentHttpRoutes(options: PaymentHttpOptions): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/v1/payments',
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
        const command: InitiatePaymentCommand = {
          workspaceId: principal.workspaceId,
          checkoutSessionId: requiredText(
            body,
            'checkoutSessionId'
          ) as InitiatePaymentCommand['checkoutSessionId'],
          idempotencyKey: idempotencyKey(request, body)
        };
        return run(201, () => paymentService(options).initiatePayment(principal, command));
      }
    },
    {
      method: 'GET',
      path: '/v1/payments/:paymentId',
      handle: (request) => {
        const principal = principalFor(request, options.internalServiceSecret);
        return run<Readonly<Payment>>(200, () =>
          paymentService(options).getPayment(
            principal,
            principal.workspaceId,
            request.params.paymentId as PaymentId
          )
        );
      }
    }
  ];
}
