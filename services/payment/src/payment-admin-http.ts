import {
  AuthenticationError,
  parseInternalOperatorPrincipal,
  type InternalOperatorPrincipal
} from '@markorbit/contracts';
import type { PaymentId } from '@markorbit/contracts/payment';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { PaymentAdminReadError, type PaymentAdminReadService } from './payment-admin.js';

export interface PaymentAdminHttpOptions {
  service?: Pick<PaymentAdminReadService, 'inspectPayment'>;
  internalServiceSecret?: string;
}

function adminService(options: PaymentAdminHttpOptions) {
  if (!options.service)
    throw new HttpError(503, 'PERSISTENCE_UNAVAILABLE', 'Payment admin read service is unavailable.', true);
  return options.service;
}

function principalFor(
  request: JsonRequest,
  secret: string | undefined
): InternalOperatorPrincipal {
  if (!secret || request.headers['x-markorbit-internal-authorization'] !== secret)
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
  if (!(error instanceof PaymentAdminReadError)) throw error;
  const status =
    error.code === 'AUTHENTICATION_REQUIRED'
      ? 401
      : error.code === 'PERMISSION_DENIED'
        ? 403
        : error.code === 'PAYMENT_NOT_FOUND'
          ? 404
          : 503;
  throw new HttpError(status, error.code, error.message, status === 503);
}

export function createPaymentAdminHttpRoutes(options: PaymentAdminHttpOptions): readonly JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/internal/commercial-admin/payments/:paymentId',
      handle: async (request) => {
        const principal = principalFor(request, options.internalServiceSecret);
        const workspaceId = request.headers['x-markorbit-workspace-id'];
        if (!workspaceId)
          throw new HttpError(400, 'WORKSPACE_CONTEXT_REQUIRED', 'Workspace context is required.');
        try {
          return json(
            200,
            await adminService(options).inspectPayment(
              principal,
              workspaceId,
              request.params.paymentId! as PaymentId
            )
          );
        } catch (error) {
          return translate(error);
        }
      }
    }
  ];
}
