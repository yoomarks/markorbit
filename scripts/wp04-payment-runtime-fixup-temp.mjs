import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);

{
  const path = 'services/payment/tests/payment-postgres.test.ts';
  let source = read(path);
  const old = `          findCheckout: (workspaceId, checkoutSessionId) =>\n            Promise.resolve(\n              workspaceId === checkout.workspaceId &&\n                checkoutSessionId === checkout.checkoutSessionId`;
  const next = `          findCheckout: (_principal, workspaceId, checkoutSessionId) =>\n            Promise.resolve(\n              workspaceId === checkout.workspaceId &&\n                checkoutSessionId === checkout.checkoutSessionId`;
  if (!source.includes(old)) throw new Error('Postgres CheckoutSource test harness changed.');
  source = source.replace(old, next);
  write(path, source);
}

{
  const path = 'services/payment/src/payment-runtime.ts';
  let source = read(path);
  source = source.replace(
    `import type {\n  PaymentLifecycleProviderAdapter,\n  PaymentProviderRefundResult,\n  PaymentProviderSnapshot\n} from './payment-lifecycle.js';`,
    `import type {\n  PaymentLifecycleProviderAdapter,\n  PaymentProviderRefundCommand,\n  PaymentProviderRefundResult,\n  PaymentProviderSnapshot,\n  PaymentWebhookInput\n} from './payment-lifecycle.js';`
  );
  source = source.replace(
    `  PaymentCheckoutSource,\n  PaymentProviderAdapter,\n  PaymentProviderCreateResult\n} from './payment-service.js';`,
    `  PaymentCheckoutSource,\n  PaymentProviderAdapter,\n  PaymentProviderCreateCommand,\n  PaymentProviderCreateResult\n} from './payment-service.js';`
  );
  source = source.replace(
    `  createPayment(): Promise<PaymentProviderCreateResult> {\n    return Promise.reject(`,
    `  createPayment(command: Readonly<PaymentProviderCreateCommand>): Promise<PaymentProviderCreateResult> {\n    void command;\n    return Promise.reject(`
  );
  source = source.replace(
    `  resumePayment(): Promise<PaymentProviderAction> {\n    return Promise.reject(`,
    `  resumePayment(providerPaymentReference: string): Promise<PaymentProviderAction> {\n    void providerPaymentReference;\n    return Promise.reject(`
  );
  source = source.replace(
    `  verifyWebhook(): Promise<VerifiedProviderPaymentEvent> {\n    return Promise.reject(`,
    `  verifyWebhook(input: Readonly<PaymentWebhookInput>): Promise<VerifiedProviderPaymentEvent> {\n    void input;\n    return Promise.reject(`
  );
  source = source.replace(
    `  createRefund(): Promise<PaymentProviderRefundResult> {\n    return Promise.reject(`,
    `  createRefund(command: Readonly<PaymentProviderRefundCommand>): Promise<PaymentProviderRefundResult> {\n    void command;\n    return Promise.reject(`
  );
  source = source.replace(
    `  retrievePayment(): Promise<PaymentProviderSnapshot> {\n    return Promise.reject(`,
    `  retrievePayment(providerPaymentReference: string): Promise<PaymentProviderSnapshot> {\n    void providerPaymentReference;\n    return Promise.reject(`
  );
  for (const expected of [
    'PaymentProviderCreateCommand',
    'PaymentProviderRefundCommand',
    'PaymentWebhookInput',
    'void command;',
    'void providerPaymentReference;',
    'void input;'
  ]) {
    if (!source.includes(expected)) throw new Error(`Runtime provider signature fix missing: ${expected}`);
  }
  write(path, source);
}

{
  const path = '.env.example';
  let source = read(path);
  source = source.replace(
    `PAYMENT_DATABASE_URL=postgresql://markorbit:markorbit@127.0.0.1:5432/markorbit_payment\n`,
    ''
  );
  write(path, source);
}
