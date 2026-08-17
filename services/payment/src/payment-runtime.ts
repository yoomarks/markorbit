import type { WorkspacePrincipal } from '@markorbit/contracts';
import { encodeInternalWorkspacePrincipal } from '@markorbit/contracts';
import type { CheckoutSession, CheckoutSessionId } from '@markorbit/contracts/commercial';
import type {
  PaymentProviderAction,
  PaymentProviderCode,
  VerifiedProviderPaymentEvent
} from '@markorbit/contracts/payment';
import type {
  PaymentLifecycleProviderAdapter,
  PaymentProviderRefundCommand,
  PaymentProviderRefundResult,
  PaymentProviderSnapshot,
  PaymentWebhookInput
} from './payment-lifecycle.js';
import { PaymentLifecycleError } from './payment-lifecycle.js';
import type {
  PaymentCheckoutSource,
  PaymentProviderAdapter,
  PaymentProviderCreateCommand,
  PaymentProviderCreateResult
} from './payment-service.js';
import { PaymentServiceError } from './payment-service.js';

export class HttpPaymentCheckoutSource implements PaymentCheckoutSource {
  constructor(
    private readonly markRegUrl: string,
    private readonly internalServiceSecret: string
  ) {}

  async findCheckout(
    principal: WorkspacePrincipal,
    workspaceId: string,
    checkoutSessionId: CheckoutSessionId
  ): Promise<CheckoutSession | null> {
    if (principal.workspaceId !== workspaceId)
      throw new PaymentServiceError('WORKSPACE_MISMATCH', 'Workspace context does not match.');
    let response: Response;
    try {
      response = await fetch(
        `${this.markRegUrl}/v1/checkouts/${encodeURIComponent(checkoutSessionId)}`,
        {
          headers: {
            'x-markorbit-internal-authorization': this.internalServiceSecret,
            'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
            'x-markorbit-workspace-id': workspaceId
          }
        }
      );
    } catch (cause) {
      throw new PaymentServiceError(
        'CHECKOUT_SOURCE_UNAVAILABLE',
        'Checkout authority is unavailable.',
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    if (response.status === 404) return null;
    if (!response.ok)
      throw new PaymentServiceError(
        'CHECKOUT_SOURCE_UNAVAILABLE',
        'Checkout authority is unavailable.'
      );
    return (await response.json()) as CheckoutSession;
  }
}

export class UnconfiguredPaymentProviderAdapter
  implements PaymentProviderAdapter, PaymentLifecycleProviderAdapter
{
  readonly code: PaymentProviderCode;

  constructor(code: PaymentProviderCode = 'UNCONFIGURED') {
    this.code = code;
  }

  createPayment(
    command: Readonly<PaymentProviderCreateCommand>
  ): Promise<PaymentProviderCreateResult> {
    void command;
    return Promise.reject(
      new PaymentServiceError('PROVIDER_UNAVAILABLE', 'Payment provider is not configured.')
    );
  }

  resumePayment(providerPaymentReference: string): Promise<PaymentProviderAction> {
    void providerPaymentReference;
    return Promise.reject(
      new PaymentServiceError('PROVIDER_UNAVAILABLE', 'Payment provider is not configured.')
    );
  }

  verifyWebhook(input: Readonly<PaymentWebhookInput>): Promise<VerifiedProviderPaymentEvent> {
    void input;
    return Promise.reject(
      new PaymentLifecycleError('PROVIDER_UNAVAILABLE', 'Payment provider is not configured.')
    );
  }

  createRefund(
    command: Readonly<PaymentProviderRefundCommand>
  ): Promise<PaymentProviderRefundResult> {
    void command;
    return Promise.reject(
      new PaymentLifecycleError('PROVIDER_UNAVAILABLE', 'Payment provider is not configured.')
    );
  }

  retrievePayment(providerPaymentReference: string): Promise<PaymentProviderSnapshot> {
    void providerPaymentReference;
    return Promise.reject(
      new PaymentLifecycleError('PROVIDER_UNAVAILABLE', 'Payment provider is not configured.')
    );
  }
}
