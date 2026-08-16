import {
  AuthenticationError,
  parseInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type {
  CreatePaymentRefundCommand,
  PaymentId,
  PaymentProviderCode
} from '@markorbit/contracts/payment';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  PaymentLifecycleError,
  type PaymentLifecycleService
} from './payment-lifecycle.js';

export interface PaymentLifecycleHttpOptions {
  service?: Pick<PaymentLifecycleService, 'handleWebhook' | 'requestRefund' | 'reconcile'>;
  providerCode: PaymentProviderCode;
  internalServiceSecret?: string;
}

function lifecycleService(options: PaymentLifecycleHttpOptions) {
  if (!options.service)
    throw new HttpError(503, 'PERSISTENCE_UNAVAILABLE', 'Payment lifecycle service is unavailable.', true);
  return options.service;
}

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

function requiredText(body: Readonly<Record<string, unknown>>, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim().length === 0)
    throw new HttpError(400, 'INVALID_REQUEST', `${field} is required.`);
  return value.trim();
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

function rejectIdentitySpoof(body: Readonly<Record<string, unknown>>): void {
  for (const field of ['workspaceId', 'actorId', 'userId', 'requestedByUserId', 'membershipId'])
    if (Object.prototype.hasOwnProperty.call(body, field))
      throw new HttpError(
        400,
        'ACTOR_SPOOF_REJECTED',
        'Workspace and actor identity are derived from authenticated internal Principal truth.'
      );
}

function translate(error: unknown): never {
  if (!(error instanceof PaymentLifecycleError)) throw error;
  const status =
    error.code === 'AUTHENTICATION_REQUIRED' || error.code === 'WEBHOOK_VERIFICATION_FAILED'
      ? 401
      : error.code === 'WORKSPACE_MISMATCH' || error.code === 'PERMISSION_DENIED'
        ? 403
        : error.code === 'PAYMENT_NOT_FOUND' || error.code === 'REFUND_NOT_FOUND'
          ? 404
          : error.code === 'PROVIDER_UNAVAILABLE' || error.code === 'PERSISTENCE_UNAVAILABLE'
            ? 503
            : error.code === 'REFUND_NOT_ALLOWED' ||
                error.code === 'REFUND_AMOUNT_EXCEEDED' ||
                error.code === 'PROVIDER_EVENT_INVALID'
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

export function createPaymentLifecycleHttpRoutes(
  options: PaymentLifecycleHttpOptions
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/payment/provider-webhooks/:provider',
      bodyLimitBytes: 1024 * 1024,
      handle: (request) => {
        if (request.params.provider !== options.providerCode)
          throw new HttpError(404, 'PAYMENT_PROVIDER_NOT_FOUND', 'Payment provider is not configured.');
        if (!request.rawBody)
          throw new HttpError(
            400,
            'RAW_WEBHOOK_BODY_REQUIRED',
            'Exact webhook request bytes are required for provider signature verification.'
          );
        return run(200, () =>
          lifecycleService(options).handleWebhook({
            rawBody: request.rawBody!,
            headers: request.headers
          })
        );
      }
    },
    {
      method: 'POST',
      path: '/internal/payment/refunds',
      handle: (request) => {
        const body = bodyRecord(request);
        rejectIdentitySpoof(body);
        const principal = principalFor(request, options.internalServiceSecret);
        const command: CreatePaymentRefundCommand = {
          workspaceId: principal.workspaceId,
          paymentId: requiredText(body, 'paymentId') as PaymentId,
          amountMinor: positiveInteger(body, 'amountMinor'),
          reason: requiredText(body, 'reason'),
          idempotencyKey: idempotencyKey(request, body)
        };
        return run(201, () => lifecycleService(options).requestRefund(principal, command));
      }
    },
    {
      method: 'POST',
      path: '/internal/payment/payments/:paymentId/reconcile',
      handle: (request) => {
        const body = bodyRecord(request);
        rejectIdentitySpoof(body);
        const principal = principalFor(request, options.internalServiceSecret);
        return run(201, () =>
          lifecycleService(options).reconcile(
            principal,
            principal.workspaceId,
            request.params.paymentId as PaymentId
          )
        );
      }
    }
  ];
}
