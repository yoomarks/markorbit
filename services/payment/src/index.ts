import { createServiceRuntime } from '@markorbit/service-kit';
import { createPaymentHttpRoutes, type PaymentHttpOptions } from './payment-http.js';
import {
  createPaymentLifecycleHttpRoutes,
  type PaymentLifecycleHttpOptions
} from './payment-lifecycle-http.js';

export * from './payment-service.js';
export * from './payment-postgres.js';
export * from './payment-lifecycle.js';
export * from './payment-http.js';
export * from './payment-lifecycle-http.js';
export * from './payment-runtime.js';
export * from './stripe-provider.js';

export const serviceManifest = Object.freeze({
  name: 'payment',
  port: Number(process.env.PORT ?? '4108'),
  version: '0.1.0'
});

export interface PaymentRuntimeOptions extends PaymentHttpOptions {
  port?: number;
  lifecycleService?: PaymentLifecycleHttpOptions['service'];
  providerCode?: PaymentLifecycleHttpOptions['providerCode'];
}

export function createRuntime(options: PaymentRuntimeOptions = {}) {
  const providerCode = options.providerCode ?? 'UNCONFIGURED';
  return createServiceRuntime(
    { ...serviceManifest, port: options.port ?? serviceManifest.port },
    {
      routes: [
        ...createPaymentHttpRoutes(options),
        ...createPaymentLifecycleHttpRoutes({
          providerCode,
          ...(options.lifecycleService ? { service: options.lifecycleService } : {}),
          ...(options.internalServiceSecret
            ? { internalServiceSecret: options.internalServiceSecret }
            : {})
        })
      ]
    }
  );
}
